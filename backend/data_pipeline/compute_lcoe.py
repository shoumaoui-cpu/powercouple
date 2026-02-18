#!/usr/bin/env python3
"""
compute_lcoe.py - Compute simplified LCOE estimates for all gas plants.

Calculates:
  - Gas-only LCOE based on variable cost and fixed O&M
  - Hybrid (solar+battery+gas backup) LCOE estimate
and writes the results back to the gas_plants table.
"""

import argparse
import logging
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("compute_lcoe")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Fixed O&M estimates ($/kW-yr) by prime mover class
FIXED_OM_CT = 15.0   # Combustion turbine
FIXED_OM_CC = 20.0   # Combined cycle

# CT-class prime movers
CT_MOVERS = {"CT", "GT", "IC"}
# CCGT-class prime movers
CCGT_MOVERS = {"CA", "CS", "CC", "ST"}

HOURS_PER_YEAR = 8760

# Default cost scenario values (base) - used as fallback if DB has no cost_assumptions
DEFAULT_SOLAR_CAPEX_PER_KW = 805
DEFAULT_SOLAR_OM_PER_KW_YR = 16.1
DEFAULT_CRF = 0.078
DEFAULT_BATTERY_COST_MULTIPLIER = 1.5  # battery component as fraction of solar LCOE
DEFAULT_GAS_BACKUP_FRACTION = 0.05     # 5% gas backup in hybrid


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_engine():
    """Create SQLAlchemy engine from DATABASE_URL."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set")
    return create_engine(database_url)


def _load_cost_assumptions(engine, scenario: str = "base") -> dict:
    """Load cost assumptions from the database. Falls back to defaults."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT * FROM cost_assumptions WHERE scenario_name = :scenario LIMIT 1"
            ),
            {"scenario": scenario},
        ).fetchone()

    if row is None:
        logger.warning(
            "No '%s' cost assumptions found in DB; using built-in defaults.", scenario
        )
        return {
            "solar_capex_per_kw": DEFAULT_SOLAR_CAPEX_PER_KW,
            "solar_om_per_kw_year": DEFAULT_SOLAR_OM_PER_KW_YR,
            "crf": DEFAULT_CRF,
        }

    # Convert row to dict - handle both Row and RowMapping
    try:
        return dict(row._mapping)
    except AttributeError:
        # Fallback for older SQLAlchemy
        cols = row.keys() if hasattr(row, "keys") else []
        return {c: getattr(row, c, None) for c in cols}


# ---------------------------------------------------------------------------
# LCOE computations
# ---------------------------------------------------------------------------


def compute_gas_only_lcoe(
    variable_cost: float | None,
    capacity_factor: float | None,
    prime_mover: str | None,
) -> float | None:
    """Compute gas-only LCOE in $/MWh.

    LCOE = variable_cost + (fixed_om / (CF * 8760))

    variable_cost is already in $/MWh.
    fixed_om is in $/kW-yr, so fixed_om / (CF * 8760) converts to $/MWh.
    """
    if variable_cost is None or capacity_factor is None or capacity_factor <= 0:
        return None

    pm = str(prime_mover).upper() if prime_mover else "CT"
    fixed_om = FIXED_OM_CT if pm in CT_MOVERS else FIXED_OM_CC

    # fixed_om is $/kW-yr; divide by (CF * 8760 hr) to get $/kWh, then * 1000 for $/MWh
    fixed_component = (fixed_om * 1000) / (capacity_factor * HOURS_PER_YEAR)

    lcoe = variable_cost + fixed_component
    return lcoe


def compute_hybrid_lcoe(
    solar_cf: float | None,
    gas_variable_cost: float | None,
    costs: dict,
) -> float | None:
    """Compute a simplified hybrid LCOE (solar + battery + gas backup) in $/MWh.

    Solar component:  (solar_capex * CRF + solar_om) / (solar_cf * 8760) * 1000
    Battery component: 1.5x solar component (simplified)
    Gas component:     gas_variable_cost * 0.05 (5% backup)
    Hybrid LCOE:       solar + battery + gas backup
    """
    if solar_cf is None or solar_cf <= 0:
        return None

    solar_capex = costs.get("solar_capex_per_kw", DEFAULT_SOLAR_CAPEX_PER_KW)
    solar_om = costs.get("solar_om_per_kw_year", DEFAULT_SOLAR_OM_PER_KW_YR)
    crf = costs.get("crf", DEFAULT_CRF)

    # Solar LCOE in $/MWh: (capex * CRF + O&M) / (CF * 8760) * 1000
    # Note: capex and O&M are in $/kW, CF*8760 gives kWh/kW, result is $/kWh, *1000 -> $/MWh
    solar_lcoe = (solar_capex * crf + solar_om) / (solar_cf * HOURS_PER_YEAR) * 1000

    # Battery component (simplified: 1.5x of solar LCOE)
    battery_lcoe = solar_lcoe * DEFAULT_BATTERY_COST_MULTIPLIER

    # Gas backup component
    gas_component = 0.0
    if gas_variable_cost is not None:
        gas_component = gas_variable_cost * DEFAULT_GAS_BACKUP_FRACTION

    hybrid_lcoe = solar_lcoe + battery_lcoe + gas_component
    return hybrid_lcoe


# ---------------------------------------------------------------------------
# Main computation loop
# ---------------------------------------------------------------------------


def compute_all_lcoe(engine=None, scenario: str = "base") -> int:
    """Compute and store LCOE values for all gas plants.

    Returns the number of plants updated.
    """
    if engine is None:
        engine = _get_engine()

    costs = _load_cost_assumptions(engine, scenario=scenario)
    logger.info("Using cost assumptions (scenario=%s): solar_capex=%.0f, crf=%.3f",
                scenario,
                costs.get("solar_capex_per_kw", 0),
                costs.get("crf", 0))

    with engine.connect() as conn:
        plants = conn.execute(
            text(
                """
                SELECT id, prime_mover, capacity_factor,
                       variable_cost_ct, variable_cost_ccgt,
                       solar_cf, nameplate_capacity_mw,
                       ct_capacity_mw, ccgt_capacity_mw
                FROM gas_plants
                """
            )
        ).fetchall()

    logger.info("Computing LCOE for %d plants...", len(plants))

    updates = []
    for row in plants:
        plant_id = row[0]
        prime_mover = row[1]
        cf = row[2]
        var_cost_ct = row[3]
        var_cost_ccgt = row[4]
        solar_cf = row[5]
        nameplate = row[6]
        ct_mw = row[7] or 0
        ccgt_mw = row[8] or 0

        # Determine the most appropriate variable cost
        # Use CT cost if plant is primarily CT, otherwise CCGT cost
        pm = str(prime_mover).upper() if prime_mover else "CT"
        if pm in CT_MOVERS:
            var_cost = var_cost_ct
        elif pm in CCGT_MOVERS:
            var_cost = var_cost_ccgt
        else:
            # Use whichever is available, weighted by capacity
            if ct_mw > 0 and ccgt_mw > 0 and var_cost_ct and var_cost_ccgt:
                total = ct_mw + ccgt_mw
                var_cost = (var_cost_ct * ct_mw + var_cost_ccgt * ccgt_mw) / total
            elif var_cost_ct is not None:
                var_cost = var_cost_ct
            else:
                var_cost = var_cost_ccgt

        # Gas-only LCOE
        lcoe_gas = compute_gas_only_lcoe(var_cost, cf, prime_mover)

        # Hybrid LCOE
        lcoe_hybrid = compute_hybrid_lcoe(solar_cf, var_cost, costs)

        updates.append({
            "id": plant_id,
            "lcoe_gas_only": lcoe_gas,
            "lcoe_hybrid": lcoe_hybrid,
        })

    # Batch update
    updated = 0
    with engine.begin() as conn:
        for upd in updates:
            conn.execute(
                text(
                    """
                    UPDATE gas_plants
                    SET lcoe_gas_only = :lcoe_gas_only,
                        lcoe_hybrid = :lcoe_hybrid,
                        updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                upd,
            )
            updated += 1

    logger.info("Updated LCOE for %d plants.", updated)
    return updated


def log_summary(engine=None):
    """Print LCOE summary statistics."""
    if engine is None:
        engine = _get_engine()

    with engine.connect() as conn:
        stats = conn.execute(
            text(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(lcoe_gas_only) AS has_gas_lcoe,
                    COUNT(lcoe_hybrid) AS has_hybrid_lcoe,
                    AVG(lcoe_gas_only) AS avg_gas_lcoe,
                    MIN(lcoe_gas_only) AS min_gas_lcoe,
                    MAX(lcoe_gas_only) AS max_gas_lcoe,
                    AVG(lcoe_hybrid) AS avg_hybrid_lcoe,
                    MIN(lcoe_hybrid) AS min_hybrid_lcoe,
                    MAX(lcoe_hybrid) AS max_hybrid_lcoe
                FROM gas_plants
                """
            )
        ).fetchone()

        # By prime mover
        by_pm = conn.execute(
            text(
                """
                SELECT
                    prime_mover,
                    COUNT(*) AS cnt,
                    AVG(lcoe_gas_only) AS avg_gas,
                    AVG(lcoe_hybrid) AS avg_hybrid
                FROM gas_plants
                WHERE lcoe_gas_only IS NOT NULL
                GROUP BY prime_mover
                ORDER BY avg_gas
                """
            )
        ).fetchall()

        # Plants where hybrid < gas
        hybrid_wins = conn.execute(
            text(
                """
                SELECT COUNT(*)
                FROM gas_plants
                WHERE lcoe_hybrid IS NOT NULL
                  AND lcoe_gas_only IS NOT NULL
                  AND lcoe_hybrid < lcoe_gas_only
                """
            )
        ).scalar()

    print(f"\n{'='*70}")
    print("LCOE Computation Summary")
    print(f"{'='*70}")
    print(f"Total plants:            {stats[0]}")
    print(f"Plants with gas LCOE:    {stats[1]}")
    print(f"Plants with hybrid LCOE: {stats[2]}")
    print(f"\nGas-only LCOE ($/MWh):")
    print(f"  Average: ${stats[3]:,.1f}" if stats[3] else "  Average: N/A")
    print(f"  Min:     ${stats[4]:,.1f}" if stats[4] else "  Min:     N/A")
    print(f"  Max:     ${stats[5]:,.1f}" if stats[5] else "  Max:     N/A")
    print(f"\nHybrid LCOE ($/MWh):")
    print(f"  Average: ${stats[6]:,.1f}" if stats[6] else "  Average: N/A")
    print(f"  Min:     ${stats[7]:,.1f}" if stats[7] else "  Min:     N/A")
    print(f"  Max:     ${stats[8]:,.1f}" if stats[8] else "  Max:     N/A")
    print(f"\nPlants where hybrid < gas-only: {hybrid_wins}")
    print(f"\nBy prime mover:")
    for pm, cnt, avg_gas, avg_hybrid in by_pm:
        gas_str = f"${avg_gas:,.1f}" if avg_gas else "N/A"
        hyb_str = f"${avg_hybrid:,.1f}" if avg_hybrid else "N/A"
        print(f"  {pm}: {cnt} plants, avg gas={gas_str}, avg hybrid={hyb_str}")
    print(f"{'='*70}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Compute LCOE estimates for all gas plants."
    )
    parser.add_argument(
        "--scenario",
        type=str,
        default="base",
        choices=["base", "optimistic", "conservative"],
        help="Cost assumption scenario to use (default: base)",
    )
    args = parser.parse_args()

    engine = _get_engine()
    compute_all_lcoe(engine=engine, scenario=args.scenario)
    log_summary(engine=engine)


if __name__ == "__main__":
    main()
