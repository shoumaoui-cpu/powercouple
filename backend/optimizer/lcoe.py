"""
LCOE (Levelized Cost of Energy) calculation functions for the PowerCouple
optimization backend.
"""

import logging

logger = logging.getLogger(__name__)


def compute_crf(wacc: float, years: int) -> float:
    """Capital Recovery Factor.

    Converts a present-value lump-sum cost into an equivalent annual payment
    over *years* at a weighted-average cost of capital *wacc*.
    """
    if wacc == 0:
        return 1.0 / years
    return (wacc * (1 + wacc) ** years) / ((1 + wacc) ** years - 1)


def compute_lcoe_gas(
    heat_rate_btu_kwh: float,
    gas_price_per_mmbtu: float = 3.50,
    fixed_om_per_kw_year: float = 15.0,
    capacity_factor: float = 0.3,
    capex_per_kw: float = 0.0,  # existing plant -- no new capex
    wacc: float = 0.06,
    life_years: int = 30,
) -> float:
    """Compute gas-only LCOE in $/MWh.

    Parameters
    ----------
    heat_rate_btu_kwh : float
        Plant heat rate in BTU/kWh (e.g. 8500 for a mid-efficiency CT).
    gas_price_per_mmbtu : float
        Natural gas commodity price in $/MMBtu.
    fixed_om_per_kw_year : float
        Fixed O&M cost in $/kW-year.
    capacity_factor : float
        Assumed annual capacity factor (0-1).
    capex_per_kw : float
        Overnight capital cost in $/kW (0 for existing plants).
    wacc : float
        Weighted-average cost of capital.
    life_years : int
        Economic lifetime in years.

    Returns
    -------
    float
        LCOE in $/MWh.
    """
    # Fuel cost component: (heat_rate BTU/kWh) * ($/MMBtu) / 1000 -> $/MWh
    fuel_cost_per_mwh = heat_rate_btu_kwh * gas_price_per_mmbtu / 1_000.0

    # Fixed O&M component: $/kW-yr -> $/MWh
    # hours_per_year * CF gives equivalent full-load hours
    hours_per_year = 8760
    if capacity_factor > 0:
        fixed_om_per_mwh = (fixed_om_per_kw_year * 1_000.0) / (
            hours_per_year * capacity_factor * 1_000.0
        )
        # Simplifies to fixed_om_per_kw_year / (hours_per_year * capacity_factor)
        fixed_om_per_mwh = fixed_om_per_kw_year / (hours_per_year * capacity_factor)
    else:
        fixed_om_per_mwh = 0.0

    # Capital cost component
    if capex_per_kw > 0 and capacity_factor > 0:
        crf = compute_crf(wacc, life_years)
        # $/kW * CRF -> $/kW-yr -> $/MWh
        capex_per_mwh = (capex_per_kw * crf) / (hours_per_year * capacity_factor) * 1_000.0
        # Convert to $/MWh properly: capex_per_kw is $/kW
        capex_per_mwh = (capex_per_kw * crf * 1_000.0) / (
            hours_per_year * capacity_factor * 1_000.0
        )
        capex_per_mwh = (capex_per_kw * crf) / (hours_per_year * capacity_factor)
    else:
        capex_per_mwh = 0.0

    # Convert fixed_om and capex from $/kWh-equivalent to $/MWh
    lcoe = fuel_cost_per_mwh + fixed_om_per_mwh * 1_000.0 + capex_per_mwh * 1_000.0

    # The above over-converts. Let's redo cleanly:
    # fuel_cost: $/MWh (already correct)
    # fixed_om: $/kW-yr / (CF * 8760 h/yr) = $/kW / kWh -> * 1000 kW/MW = $/MWh
    # capex: same treatment
    lcoe = fuel_cost_per_mwh  # $/MWh

    # fixed O&M: $/kW-yr -> $/MWh
    if capacity_factor > 0:
        lcoe += (fixed_om_per_kw_year / (capacity_factor * hours_per_year)) * 1_000.0

    # capex: $/kW -> annualized $/kW-yr via CRF -> $/MWh
    if capex_per_kw > 0 and capacity_factor > 0:
        crf = compute_crf(wacc, life_years)
        lcoe += (capex_per_kw * crf / (capacity_factor * hours_per_year)) * 1_000.0

    logger.debug(
        "Gas LCOE: fuel=%.1f  fixed_om=%.1f  capex=%.1f  total=%.1f $/MWh",
        fuel_cost_per_mwh,
        (fixed_om_per_kw_year / (capacity_factor * hours_per_year) * 1_000.0)
        if capacity_factor > 0
        else 0.0,
        0.0,
        lcoe,
    )

    return lcoe


def compute_annual_costs(
    solar_mw: float,
    batt_power_mw: float,
    batt_energy_mwh: float,
    gas_gen_mwh: float,
    gas_variable_cost: float,
    cost_params: dict,
) -> dict:
    """Compute annualized costs for each component.

    Parameters
    ----------
    solar_mw : float
        Installed solar capacity in MW.
    batt_power_mw : float
        Battery power rating in MW.
    batt_energy_mwh : float
        Battery energy capacity in MWh.
    gas_gen_mwh : float
        Total annual gas generation in MWh.
    gas_variable_cost : float
        Variable cost of gas generation in $/MWh (fuel + variable O&M).
    cost_params : dict
        Cost scenario parameters from COST_SCENARIOS.

    Returns
    -------
    dict
        Keys: solar_cost, battery_cost, gas_cost, excess_solar_revenue, total.
        All values in $/year.
    """
    solar_crf = compute_crf(cost_params["wacc"], cost_params["solar_life_years"])
    battery_crf = compute_crf(cost_params["wacc"], cost_params["battery_life_years"])

    # Solar: CAPEX annualized + O&M
    # CAPEX is $/kW, solar_mw is MW -> multiply by 1000 to get kW
    solar_capex_annual = (
        cost_params["solar_capex_per_kw"] * solar_mw * 1_000.0 * solar_crf
    )
    solar_om_annual = cost_params["solar_om_per_kw_year"] * solar_mw * 1_000.0
    solar_cost = solar_capex_annual + solar_om_annual

    # Battery: energy CAPEX + power CAPEX annualized + O&M
    battery_energy_capex_annual = (
        cost_params["battery_energy_capex_per_kwh"] * batt_energy_mwh * 1_000.0 * battery_crf
    )
    battery_power_capex_annual = (
        cost_params["battery_power_capex_per_kw"] * batt_power_mw * 1_000.0 * battery_crf
    )
    battery_om_annual = cost_params["battery_om_per_kw_year"] * batt_power_mw * 1_000.0
    battery_cost = battery_energy_capex_annual + battery_power_capex_annual + battery_om_annual

    # Gas: variable cost only (existing plant, no new capex)
    gas_cost = gas_gen_mwh * gas_variable_cost

    total = solar_cost + battery_cost + gas_cost

    logger.debug(
        "Annual costs: solar=$%.0f  battery=$%.0f  gas=$%.0f  total=$%.0f",
        solar_cost,
        battery_cost,
        gas_cost,
        total,
    )

    return {
        "solar_cost": solar_cost,
        "battery_cost": battery_cost,
        "gas_cost": gas_cost,
        "excess_solar_revenue": 0.0,  # placeholder -- computed in solver if applicable
        "total": total,
    }
