"""
Solver wrapper: orchestrates solar profile loading, cost parameter lookup,
MILP optimization, LCOE computation, and result assembly.
"""

from __future__ import annotations

import logging
import math
import random

from optimizer.lcoe import compute_annual_costs, compute_crf, compute_lcoe_gas
from optimizer.model import build_and_solve

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default plant parameters (used when no DB lookup is available)
# ---------------------------------------------------------------------------
DEFAULT_GAS_HEAT_RATE = 8500       # BTU/kWh
DEFAULT_GAS_CAPACITY_FACTOR = 0.30
DEFAULT_LATITUDE = 35.0            # mid-latitude US default
DEFAULT_GAS_FIXED_OM = 15.0        # $/kW-yr

# Emissions factor for natural gas: 53.1 kg CO2 per MMBtu
CO2_KG_PER_MMBTU = 53.1


# ---------------------------------------------------------------------------
# Synthetic solar profile generation
# ---------------------------------------------------------------------------

def generate_synthetic_solar_profile(latitude: float) -> list[float]:
    """Generate a 288-hour synthetic solar profile (12 months x 24 hours).

    Uses a simple trigonometric model:
    - Peak solar around noon (hour 12 of each day).
    - Seasonal variation driven by latitude: summer months (May-Aug) have
      higher capacity factors; winter months are lower.
    - Dawn/dusk cosine ramp with sunrise/sunset shifting by season.

    Parameters
    ----------
    latitude : float
        Site latitude in degrees (positive = northern hemisphere).

    Returns
    -------
    list[float]
        288 capacity-factor values in [0, 1].
    """
    profile = []
    abs_lat = abs(latitude)

    for month in range(12):  # 0=Jan .. 11=Dec
        # Solar declination approximation (degrees)
        # Peaks in June (month 5), trough in December (month 11)
        declination = 23.45 * math.sin(math.radians((360 / 12) * (month - 2.5)))

        # Day length proxy (hours of usable sun, 6-14h range)
        day_length = 12.0 + 2.5 * math.sin(math.radians((360 / 12) * (month - 2.5)))
        # Adjust for latitude -- higher latitudes get more seasonal swing
        lat_factor = abs_lat / 90.0
        day_length += 2.0 * lat_factor * math.sin(
            math.radians((360 / 12) * (month - 2.5))
        )
        day_length = max(8.0, min(16.0, day_length))

        sunrise = 12.0 - day_length / 2.0
        sunset = 12.0 + day_length / 2.0

        # Peak CF for this month (base ~0.22 at equator, higher in summer
        # at mid-latitudes due to clearer skies assumption)
        peak_cf = 0.22 + 0.08 * math.sin(math.radians((360 / 12) * (month - 2.5)))
        # Latitude adjustment: lower latitudes -> slightly higher annual CF
        peak_cf += 0.05 * (1.0 - abs_lat / 60.0)
        peak_cf = max(0.10, min(0.40, peak_cf))

        for hour in range(24):
            if sunrise <= hour <= sunset:
                # Cosine shape centered at solar noon
                angle = math.pi * (hour - 12.0) / (day_length / 2.0)
                cf = peak_cf * max(0.0, math.cos(angle))
            else:
                cf = 0.0

            profile.append(round(cf, 5))

    return profile


def compress_to_representative_days(profile_8760: list[float]) -> list[float]:
    """Average each month's hourly profiles into a single representative day
    per month.

    Parameters
    ----------
    profile_8760 : list[float]
        8760 hourly capacity factors for a full year.

    Returns
    -------
    list[float]
        288 capacity-factor values (12 months x 24 hours).
    """
    if len(profile_8760) != 8760:
        raise ValueError(f"Expected 8760 hours, got {len(profile_8760)}")

    # Days per month (non-leap year)
    days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    profile_288 = []

    hour_idx = 0
    for m, ndays in enumerate(days_in_month):
        # Collect all hourly data for this month
        month_hours = ndays * 24
        month_data = profile_8760[hour_idx : hour_idx + month_hours]
        hour_idx += month_hours

        # Average into a single representative 24-hour day
        for h in range(24):
            values = [month_data[d * 24 + h] for d in range(ndays)]
            avg = sum(values) / len(values)
            profile_288.append(round(avg, 5))

    return profile_288


# ---------------------------------------------------------------------------
# Conflict hours generation
# ---------------------------------------------------------------------------

def _generate_conflict_hours(
    conflict_pct: float,
    solar_profile_288: list[float],
) -> set[int]:
    """Select representative hours where gas operation is restricted.

    Conflict hours are biased toward nighttime (non-solar) hours since those
    represent periods where emissions or permitting conflicts are most acute.

    Parameters
    ----------
    conflict_pct : float
        Fraction of hours (0-1) that should have gas restrictions.
    solar_profile_288 : list[float]
        288-element solar profile for weighting.

    Returns
    -------
    set[int]
        Set of hour indices (0-287) where gas is restricted.
    """
    n_conflict = int(round(conflict_pct * 288))
    if n_conflict == 0:
        return set()

    # Weight nighttime hours more heavily
    weights = []
    for t in range(288):
        cf = solar_profile_288[t]
        # Inverse weighting: lower solar -> higher chance of conflict
        w = 1.0 - cf + 0.1
        weights.append(w)

    total_w = sum(weights)
    probs = [w / total_w for w in weights]

    # Deterministic seed for reproducibility
    rng = random.Random(42)
    conflict_set: set[int] = set()

    while len(conflict_set) < n_conflict:
        r = rng.random()
        cumulative = 0.0
        for t, p in enumerate(probs):
            cumulative += p
            if r <= cumulative:
                conflict_set.add(t)
                break

    return conflict_set


# ---------------------------------------------------------------------------
# Gas variable cost calculation
# ---------------------------------------------------------------------------

def _gas_variable_cost(heat_rate: float, gas_price: float) -> float:
    """Compute gas variable cost in $/MWh from heat rate and gas price.

    Parameters
    ----------
    heat_rate : float
        BTU/kWh.
    gas_price : float
        $/MMBtu.

    Returns
    -------
    float
        Variable cost in $/MWh.
    """
    # (BTU/kWh) * ($/MMBtu) / (1e6 BTU/MMBtu) * (1000 kWh/MWh)
    # = heat_rate * gas_price / 1000
    return heat_rate * gas_price / 1_000.0


# ---------------------------------------------------------------------------
# Emissions factor
# ---------------------------------------------------------------------------

def _compute_emissions_factor(
    heat_rate: float,
    gas_gen_mwh: float,
    total_load_mwh: float,
) -> float:
    """Compute blended emissions factor in kg CO2 per MWh of total load.

    Solar and battery contribute zero direct emissions. Gas emissions are
    proportional to gas generation.

    Formula for gas: heat_rate_BTU/kWh * 53.1 kg CO2/MMBtu * 1e-3 MMBtu/BTU
    -> gives kg CO2/kWh -> * 1000 = kg CO2/MWh (but that double-converts).

    Correctly: (heat_rate BTU/kWh) / (1e6 BTU/MMBtu) * (53.1 kg/MMBtu)
               = heat_rate * 53.1 / 1e6  kg CO2/kWh
               = heat_rate * 53.1 / 1e3  kg CO2/MWh

    Parameters
    ----------
    heat_rate : float
        BTU/kWh.
    gas_gen_mwh : float
        Annual gas generation in MWh.
    total_load_mwh : float
        Annual total load served in MWh.

    Returns
    -------
    float
        Blended emissions factor in kg CO2 per MWh of total load.
    """
    if total_load_mwh <= 0:
        return 0.0

    # Gas-only emissions intensity (kg CO2/MWh of gas generation)
    gas_emission_intensity = heat_rate * CO2_KG_PER_MMBTU / 1_000.0

    # Total emissions from gas
    total_emissions_kg = gas_emission_intensity * gas_gen_mwh

    # Blended over total load
    return total_emissions_kg / total_load_mwh


# ---------------------------------------------------------------------------
# Main solver entry point
# ---------------------------------------------------------------------------

def run_optimization(
    plant_id: str,
    target_load_mw: float,
    max_gas_backup_pct: float,
    commissioning_year: int,
    cost_params: dict,
    conflict_pct: float | None = None,
    solar_profile: list[float] | None = None,
    latitude: float | None = None,
    gas_heat_rate_btu_kwh: float | None = None,
    gas_capacity_factor: float | None = None,
    solar_cf_hint: float | None = None,
    max_solar_mw: float | None = None,
) -> dict:
    """Run the full optimization pipeline.

    1. Load or generate solar profile.
    2. Compress to 288 representative hours (if 8760 provided).
    3. Run MILP optimization.
    4. Compute LCOE breakdown and emissions.
    5. Return complete result dict.

    Parameters
    ----------
    plant_id : str
        Identifier for the gas plant.
    target_load_mw : float
        Constant load to serve (MW).
    max_gas_backup_pct : float
        Maximum gas backup fraction (0-1).
    commissioning_year : int
        Target commissioning year.
    cost_params : dict
        Cost scenario parameters.
    conflict_pct : float | None
        Fraction of hours with gas restrictions (0-1), or None.
    solar_profile : list[float] | None
        Solar capacity factors -- either 8760 or 288 entries, or None
        to use a synthetic profile.

    Returns
    -------
    dict
        Complete optimization result matching OptimizeResponse schema.
    """
    logger.info(
        "Starting optimization for plant=%s  load=%.1f MW  year=%d",
        plant_id,
        target_load_mw,
        commissioning_year,
    )

    # -------------------------------------------------------------------
    # 1. Solar profile
    # -------------------------------------------------------------------
    site_latitude = latitude if latitude is not None else DEFAULT_LATITUDE

    if solar_profile is not None:
        if len(solar_profile) == 8760:
            logger.info("Compressing 8760-hour profile to 288 representative hours")
            solar_profile_288 = compress_to_representative_days(solar_profile)
        elif len(solar_profile) == 288:
            solar_profile_288 = solar_profile
        else:
            raise ValueError(
                f"solar_profile must have 288 or 8760 entries, got {len(solar_profile)}"
            )
    else:
        logger.info(
            "No solar profile provided; generating synthetic profile at lat=%.1f",
            site_latitude,
        )
        solar_profile_288 = generate_synthetic_solar_profile(site_latitude)

    if solar_cf_hint is not None and solar_cf_hint > 0:
        normalized_cf = solar_cf_hint / 100.0 if solar_cf_hint > 1 else solar_cf_hint
        normalized_cf = max(0.05, min(0.45, normalized_cf))
        profile_avg = sum(solar_profile_288) / max(len(solar_profile_288), 1)
        if profile_avg > 0:
            scale_cf = normalized_cf / profile_avg
            solar_profile_288 = [max(0.0, min(1.0, round(v * scale_cf, 5))) for v in solar_profile_288]

    # -------------------------------------------------------------------
    # 2. Gas parameters
    # -------------------------------------------------------------------
    gas_heat_rate = gas_heat_rate_btu_kwh if gas_heat_rate_btu_kwh is not None else DEFAULT_GAS_HEAT_RATE
    gas_price = cost_params["gas_price_per_mmbtu"]
    gas_var_cost = _gas_variable_cost(gas_heat_rate, gas_price)
    # Gas capacity: assume existing plant can cover full load
    gas_capacity_mw = target_load_mw

    logger.info(
        "Gas parameters: heat_rate=%d BTU/kWh  price=$%.2f/MMBtu  var_cost=$%.2f/MWh",
        gas_heat_rate,
        gas_price,
        gas_var_cost,
    )

    # -------------------------------------------------------------------
    # 3. Conflict hours
    # -------------------------------------------------------------------
    conflict_hours: set[int] | None = None
    n_conflict = 0
    if conflict_pct is not None and conflict_pct > 0:
        conflict_hours = _generate_conflict_hours(conflict_pct, solar_profile_288)
        n_conflict = len(conflict_hours)
        logger.info("Generated %d conflict hours (%.1f%%)", n_conflict, conflict_pct * 100)

    # -------------------------------------------------------------------
    # 4. Run MILP
    # -------------------------------------------------------------------
    result = build_and_solve(
        target_load_mw=target_load_mw,
        max_gas_backup_pct=max_gas_backup_pct,
        solar_profile_288=solar_profile_288,
        gas_capacity_mw=gas_capacity_mw,
        gas_heat_rate=gas_heat_rate,
        gas_variable_cost=gas_var_cost,
        cost_params=cost_params,
        max_solar_mw=max_solar_mw,
        conflict_hours=conflict_hours,
    )

    # -------------------------------------------------------------------
    # 5. Compute LCOE breakdown
    # -------------------------------------------------------------------
    annual_load_mwh = target_load_mw * 8760
    annual_gas_gen = result["gas_gen_total"]
    annual_solar_gen = result.get("solar_gen_total", 0.0)

    # Annual costs
    costs = compute_annual_costs(
        solar_mw=result["solar_capacity_mw"],
        batt_power_mw=result["battery_power_mw"],
        batt_energy_mwh=result["battery_energy_mwh"],
        gas_gen_mwh=annual_gas_gen,
        gas_variable_cost=gas_var_cost,
        cost_params=cost_params,
    )

    # Net LCOE (total annual cost / total annual load)
    net_lcoe = costs["total"] / annual_load_mwh if annual_load_mwh > 0 else 0.0

    # Gas-only LCOE for comparison
    gas_cf = gas_capacity_factor if gas_capacity_factor is not None else DEFAULT_GAS_CAPACITY_FACTOR
    if gas_cf > 1:
        gas_cf = gas_cf / 100.0
    gas_cf = max(0.05, min(0.95, gas_cf))

    lcoe_gas_only = compute_lcoe_gas(
        heat_rate_btu_kwh=gas_heat_rate,
        gas_price_per_mmbtu=gas_price,
        fixed_om_per_kw_year=DEFAULT_GAS_FIXED_OM,
        capacity_factor=gas_cf,
        capex_per_kw=0.0,
        wacc=cost_params["wacc"],
        life_years=cost_params["solar_life_years"],
    )

    # Gas backup actual percentage
    gas_backup_actual = annual_gas_gen / annual_load_mwh if annual_load_mwh > 0 else 0.0

    # Excess solar: generation beyond load served (approximate)
    excess_solar_mwh = max(0.0, annual_solar_gen - annual_load_mwh)

    # Solar-to-load ratio
    solar_to_load_ratio = (
        result["solar_capacity_mw"] / target_load_mw if target_load_mw > 0 else 0.0
    )

    # -------------------------------------------------------------------
    # 6. Emissions factor
    # -------------------------------------------------------------------
    emissions_factor = _compute_emissions_factor(
        heat_rate=gas_heat_rate,
        gas_gen_mwh=annual_gas_gen,
        total_load_mwh=annual_load_mwh,
    )

    # -------------------------------------------------------------------
    # 7. LCOE breakdown in $/MWh
    # -------------------------------------------------------------------
    lcoe_breakdown = {
        "solar_cost": round(costs["solar_cost"] / annual_load_mwh, 2)
        if annual_load_mwh > 0
        else 0.0,
        "battery_cost": round(costs["battery_cost"] / annual_load_mwh, 2)
        if annual_load_mwh > 0
        else 0.0,
        "gas_cost": round(costs["gas_cost"] / annual_load_mwh, 2)
        if annual_load_mwh > 0
        else 0.0,
        "excess_solar_revenue": 0.0,
        "total": round(net_lcoe, 2),
    }

    # -------------------------------------------------------------------
    # 8. Assemble response
    # -------------------------------------------------------------------
    response = {
        "solar_capacity_mw": round(result["solar_capacity_mw"], 2),
        "battery_power_mw": round(result["battery_power_mw"], 2),
        "battery_energy_mwh": round(result["battery_energy_mwh"], 2),
        "net_lcoe": round(net_lcoe, 2),
        "lcoe_gas_only": round(lcoe_gas_only, 2),
        "gas_backup_actual": round(gas_backup_actual, 4),
        "emissions_factor": round(emissions_factor, 2),
        "excess_solar_mwh": round(excess_solar_mwh, 1),
        "solar_to_load_ratio": round(solar_to_load_ratio, 2),
        "conflict_hours": n_conflict if conflict_pct is not None else None,
        "solver_status": result["solver_status"],
        "lcoe_breakdown": lcoe_breakdown,
        "hourly_dispatch": result["hourly_dispatch"],
    }

    logger.info(
        "Optimization result: LCOE=%.2f $/MWh (gas-only=%.2f)  "
        "solar=%.1f MW  batt=%.1f MW/%.1f MWh  gas_backup=%.1f%%  "
        "emissions=%.1f kg/MWh",
        net_lcoe,
        lcoe_gas_only,
        result["solar_capacity_mw"],
        result["battery_power_mw"],
        result["battery_energy_mwh"],
        gas_backup_actual * 100,
        emissions_factor,
    )

    return response
