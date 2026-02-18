"""
MILP formulation for hybrid solar+storage optimization using PuLP.

Uses representative days (24 hours x 12 months = 288 time steps) for fast
solving.  The HiGHS solver (open-source, bundled with PuLP) is used by
default with a 120-second time limit.
"""

from __future__ import annotations

import logging
import math

import pulp

from optimizer.lcoe import compute_crf

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
HOURS_PER_REPR = 288          # 12 months x 24 hours
MONTHS = 12
HOURS_PER_DAY = 24
DAYS_PER_MONTH = 365.0 / 12  # ~30.42
TIME_LIMIT_SEC = 120


def build_and_solve(
    target_load_mw: float,
    max_gas_backup_pct: float,
    solar_profile_288: list[float],
    gas_capacity_mw: float,
    gas_heat_rate: float,
    gas_variable_cost: float,
    cost_params: dict,
    max_solar_mw: float | None = None,
    conflict_hours: set[int] | None = None,
) -> dict:
    """Build and solve the MILP for hybrid solar+storage co-located with gas.

    Parameters
    ----------
    target_load_mw : float
        Constant load to serve every hour (MW).
    max_gas_backup_pct : float
        Maximum fraction of total energy that can come from gas (0-1).
    solar_profile_288 : list[float]
        288 capacity-factor values (0-1), one per representative hour.
    gas_capacity_mw : float
        Nameplate gas capacity (MW).
    gas_heat_rate : float
        Gas plant heat rate (BTU/kWh).
    gas_variable_cost : float
        Variable cost of gas generation in $/MWh.
    cost_params : dict
        Cost scenario parameters.
    max_solar_mw : float | None
        Upper bound on solar capacity (MW).  ``None`` means no limit.
    conflict_hours : set[int] | None
        Set of representative-hour indices (0-287) where gas is restricted to 0.

    Returns
    -------
    dict
        Optimization results including capacities, dispatch, costs, and status.
    """
    if len(solar_profile_288) != HOURS_PER_REPR:
        raise ValueError(
            f"solar_profile_288 must have {HOURS_PER_REPR} entries, "
            f"got {len(solar_profile_288)}"
        )

    conflict_hours = conflict_hours or set()

    # -----------------------------------------------------------------------
    # Derived parameters
    # -----------------------------------------------------------------------
    solar_crf = compute_crf(cost_params["wacc"], cost_params["solar_life_years"])
    battery_crf = compute_crf(cost_params["wacc"], cost_params["battery_life_years"])

    inverter_eff = cost_params["inverter_efficiency"]
    rte = cost_params["battery_rte"]
    sqrt_rte = math.sqrt(rte)

    # Annualization: each representative hour maps to DAYS_PER_MONTH real
    # hours, so the total energy scale factor from 288 steps to a full year
    # is DAYS_PER_MONTH.
    scale = DAYS_PER_MONTH  # ~30.42

    # Cost coefficients (annual)
    # Solar: capex * CRF + O&M  ($/kW-yr -> per MW multiply by 1000)
    solar_annual_per_mw = (
        cost_params["solar_capex_per_kw"] * solar_crf
        + cost_params["solar_om_per_kw_year"]
    ) * 1_000.0  # $/MW-yr

    # Battery energy: capex * CRF  ($/kWh-yr -> per MWh multiply by 1000)
    batt_energy_annual_per_mwh = (
        cost_params["battery_energy_capex_per_kwh"] * battery_crf
    ) * 1_000.0  # $/MWh-yr

    # Battery power: capex * CRF + O&M  ($/kW-yr -> per MW multiply by 1000)
    batt_power_annual_per_mw = (
        cost_params["battery_power_capex_per_kw"] * battery_crf
        + cost_params["battery_om_per_kw_year"]
    ) * 1_000.0  # $/MW-yr

    logger.info(
        "Building MILP: target=%.1f MW, max_gas=%.1f%%, %d conflict hours",
        target_load_mw,
        max_gas_backup_pct * 100,
        len(conflict_hours),
    )

    # -----------------------------------------------------------------------
    # Problem and decision variables
    # -----------------------------------------------------------------------
    prob = pulp.LpProblem("PowerCouple_HybridOpt", pulp.LpMinimize)

    T = list(range(HOURS_PER_REPR))

    # Capacity variables
    solar_cap = pulp.LpVariable("solar_cap", lowBound=0, cat="Continuous")
    batt_power = pulp.LpVariable("batt_power", lowBound=0, cat="Continuous")
    batt_energy = pulp.LpVariable("batt_energy", lowBound=0, cat="Continuous")

    # Dispatch variables (indexed over 288 hours)
    solar_gen = pulp.LpVariable.dicts("solar_gen", T, lowBound=0, cat="Continuous")
    batt_charge = pulp.LpVariable.dicts("batt_charge", T, lowBound=0, cat="Continuous")
    batt_discharge = pulp.LpVariable.dicts("batt_discharge", T, lowBound=0, cat="Continuous")
    gas_gen = pulp.LpVariable.dicts("gas_gen", T, lowBound=0, cat="Continuous")
    soc = pulp.LpVariable.dicts("soc", T, lowBound=0, cat="Continuous")

    # -----------------------------------------------------------------------
    # Objective: minimize annualized total cost
    # -----------------------------------------------------------------------
    # Capacity costs (already annualized)
    capacity_cost = (
        solar_annual_per_mw * solar_cap
        + batt_energy_annual_per_mwh * batt_energy
        + batt_power_annual_per_mw * batt_power
    )

    # Operational costs: gas variable cost scaled to annual
    gas_op_cost = gas_variable_cost * scale * pulp.lpSum(gas_gen[t] for t in T)

    prob += capacity_cost + gas_op_cost, "Total_Annual_Cost"

    # -----------------------------------------------------------------------
    # Constraints
    # -----------------------------------------------------------------------
    for t in T:
        # 1. Energy balance: supply >= demand
        prob += (
            solar_gen[t] * inverter_eff
            + batt_discharge[t] * sqrt_rte
            - batt_charge[t] / sqrt_rte
            + gas_gen[t]
            >= target_load_mw
        ), f"EnergyBalance_{t}"

        # 2. Solar generation limited by capacity and resource
        prob += (
            solar_gen[t] <= solar_cap * solar_profile_288[t]
        ), f"SolarLimit_{t}"

        # 3. Battery charge limited by power rating
        prob += batt_charge[t] <= batt_power, f"ChargeLimit_{t}"

        # 4. Battery discharge limited by power rating
        prob += batt_discharge[t] <= batt_power, f"DischargeLimit_{t}"

        # 5. SOC dynamics (cyclic: t=0 wraps from t=287)
        t_prev = T[-1] if t == 0 else t - 1
        prob += (
            soc[t] == soc[t_prev] + batt_charge[t] - batt_discharge[t]
        ), f"SOC_Dynamics_{t}"

        # 6. SOC upper bound
        prob += soc[t] <= batt_energy, f"SOC_Upper_{t}"

        # 10. Gas capacity limit
        prob += gas_gen[t] <= gas_capacity_mw, f"GasCap_{t}"

        # 12. Conflict hours: no gas allowed
        if t in conflict_hours:
            prob += gas_gen[t] == 0, f"ConflictHour_{t}"

    # 7. Maximum battery duration: 6-hour limit
    prob += batt_energy <= 6 * batt_power, "MaxBattDuration"

    # 8. Battery power cannot exceed solar capacity
    prob += batt_power <= solar_cap, "BattPowerLimit"

    # 9. Gas backup limit (fraction of total energy across 288 representative hours)
    prob += (
        pulp.lpSum(gas_gen[t] for t in T)
        <= max_gas_backup_pct * target_load_mw * HOURS_PER_REPR
    ), "GasBackupLimit"

    # 11. Solar capacity upper bound (if provided)
    if max_solar_mw is not None:
        prob += solar_cap <= max_solar_mw, "SolarCapLimit"

    # -----------------------------------------------------------------------
    # Solve
    # -----------------------------------------------------------------------
    solver = pulp.HiGHS_CMD(msg=False, timeLimit=TIME_LIMIT_SEC)
    logger.info("Launching HiGHS solver (time limit %ds)...", TIME_LIMIT_SEC)
    try:
        prob.solve(solver)
    except pulp.PulpSolverError:
        logger.warning("HiGHS executable not available; falling back to CBC solver")
        fallback = pulp.PULP_CBC_CMD(msg=False, timeLimit=TIME_LIMIT_SEC)
        prob.solve(fallback)

    status = pulp.LpStatus[prob.status]
    logger.info("Solver finished: status=%s  objective=%.0f", status, pulp.value(prob.objective) or 0)

    if prob.status not in (pulp.constants.LpStatusOptimal,):
        logger.warning("Solver did not find optimal solution. Status: %s", status)

    # -----------------------------------------------------------------------
    # Extract results
    # -----------------------------------------------------------------------
    sol_solar_cap = pulp.value(solar_cap) or 0.0
    sol_batt_power = pulp.value(batt_power) or 0.0
    sol_batt_energy = pulp.value(batt_energy) or 0.0

    hourly_dispatch = []
    total_gas_gen = 0.0
    total_solar_gen = 0.0

    for t in T:
        s = pulp.value(solar_gen[t]) or 0.0
        bc = pulp.value(batt_charge[t]) or 0.0
        bd = pulp.value(batt_discharge[t]) or 0.0
        g = pulp.value(gas_gen[t]) or 0.0
        sc = pulp.value(soc[t]) or 0.0

        # Net battery contribution (positive = discharging)
        batt_net = bd * sqrt_rte - bc / sqrt_rte

        hourly_dispatch.append({
            "hour": t,
            "solar_mw": round(s * inverter_eff, 4),
            "battery_mw": round(batt_net, 4),
            "gas_mw": round(g, 4),
            "load_mw": round(target_load_mw, 4),
            "soc": round(sc, 4),
        })

        total_gas_gen += g
        total_solar_gen += s

    # Scale to annual totals
    annual_gas_gen_mwh = total_gas_gen * scale
    annual_solar_gen_mwh = total_solar_gen * scale
    annual_load_mwh = target_load_mw * 8760

    objective_value = pulp.value(prob.objective) or 0.0

    return {
        "solar_capacity_mw": round(sol_solar_cap, 3),
        "battery_power_mw": round(sol_batt_power, 3),
        "battery_energy_mwh": round(sol_batt_energy, 3),
        "hourly_dispatch": hourly_dispatch,
        "total_cost": round(objective_value, 2),
        "gas_gen_total": round(annual_gas_gen_mwh, 2),
        "solar_gen_total": round(annual_solar_gen_mwh, 2),
        "solver_status": status,
        "objective_value": round(objective_value, 2),
    }
