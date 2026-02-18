#!/usr/bin/env python3
"""
load_costs.py - Insert default cost assumption scenarios into PostgreSQL.

Defines three cost scenarios (base, optimistic, conservative) for solar+battery
hybrid projects with a 2028 commissioning year and upserts them into the
cost_assumptions table.
"""

import argparse
import logging
import os
import uuid

from dotenv import load_dotenv
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    create_engine,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("load_costs")

Base = declarative_base()


# ---------------------------------------------------------------------------
# SQLAlchemy model
# ---------------------------------------------------------------------------


class CostAssumption(Base):
    __tablename__ = "cost_assumptions"

    id = Column(String, primary_key=True)
    scenario_name = Column(String, unique=True, nullable=False)
    commissioning_year = Column(Integer, nullable=False)
    solar_capex_per_kw = Column(Float)
    battery_capex_per_kwh = Column(Float)
    battery_capex_per_kw = Column(Float)
    solar_om_per_kw_year = Column(Float)
    battery_om_per_kw_year = Column(Float)
    wacc = Column(Float)
    crf = Column(Float)
    project_lifetime_yrs = Column(Integer)
    battery_rte = Column(Float)
    inverter_efficiency = Column(Float)
    max_battery_duration = Column(Float)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Scenario definitions
# ---------------------------------------------------------------------------

SCENARIOS = [
    {
        "scenario_name": "base",
        "commissioning_year": 2028,
        "solar_capex_per_kw": 805,
        "battery_capex_per_kwh": 176,
        "battery_capex_per_kw": 87,
        "solar_om_per_kw_year": 16.1,
        "battery_om_per_kw_year": 2.37,
        "wacc": 0.06,
        "crf": 0.078,
        "project_lifetime_yrs": 25,
        "battery_rte": 0.85,
        "inverter_efficiency": 0.96,
        "max_battery_duration": 6,
    },
    {
        "scenario_name": "optimistic",
        "commissioning_year": 2028,
        "solar_capex_per_kw": 650,
        "battery_capex_per_kwh": 140,
        "battery_capex_per_kw": 70,
        "solar_om_per_kw_year": 13.0,
        "battery_om_per_kw_year": 2.0,
        "wacc": 0.05,
        "crf": 0.071,
        "project_lifetime_yrs": 25,
        "battery_rte": 0.85,
        "inverter_efficiency": 0.96,
        "max_battery_duration": 6,
    },
    {
        "scenario_name": "conservative",
        "commissioning_year": 2028,
        "solar_capex_per_kw": 1000,
        "battery_capex_per_kwh": 220,
        "battery_capex_per_kw": 110,
        "solar_om_per_kw_year": 20.0,
        "battery_om_per_kw_year": 3.0,
        "wacc": 0.08,
        "crf": 0.094,
        "project_lifetime_yrs": 25,
        "battery_rte": 0.85,
        "inverter_efficiency": 0.96,
        "max_battery_duration": 6,
    },
]


# ---------------------------------------------------------------------------
# Load logic
# ---------------------------------------------------------------------------


def _get_engine():
    """Create SQLAlchemy engine from DATABASE_URL."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set.")
    return create_engine(database_url, echo=False)


def load_cost_assumptions(engine=None) -> int:
    """Upsert all cost assumption scenarios. Returns count of upserted rows."""
    if engine is None:
        engine = _get_engine()

    Base.metadata.create_all(engine)
    logger.info("Ensured cost_assumptions table exists.")

    Session = sessionmaker(bind=engine)
    session = Session()

    upserted = 0

    try:
        for scenario in SCENARIOS:
            scenario_name = scenario["scenario_name"]
            logger.info("Upserting scenario: %s", scenario_name)

            stmt = pg_insert(CostAssumption.__table__).values(
                id=str(uuid.uuid4()),
                **scenario,
            )

            # On conflict, update all columns except id and created_at
            update_cols = {k: v for k, v in scenario.items()}
            update_cols["updated_at"] = func.now()

            stmt = stmt.on_conflict_do_update(
                index_elements=["scenario_name"],
                set_=update_cols,
            )

            session.execute(stmt)
            upserted += 1

        session.commit()
        logger.info("Successfully upserted %d cost assumption scenarios.", upserted)

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return upserted


def log_summary(engine=None):
    """Print current cost assumptions from the database."""
    if engine is None:
        engine = _get_engine()

    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        rows = session.query(CostAssumption).order_by(CostAssumption.scenario_name).all()

        print(f"\n{'='*80}")
        print("Cost Assumptions Summary")
        print(f"{'='*80}")

        for row in rows:
            print(f"\n  Scenario: {row.scenario_name} (year {row.commissioning_year})")
            print(f"    Solar CAPEX:          ${row.solar_capex_per_kw}/kW")
            print(f"    Battery CAPEX:        ${row.battery_capex_per_kwh}/kWh, ${row.battery_capex_per_kw}/kW")
            print(f"    Solar O&M:            ${row.solar_om_per_kw_year}/kW-yr")
            print(f"    Battery O&M:          ${row.battery_om_per_kw_year}/kW-yr")
            print(f"    WACC:                 {row.wacc:.1%}")
            print(f"    CRF:                  {row.crf:.3f}")
            print(f"    Project lifetime:     {row.project_lifetime_yrs} yrs")
            print(f"    Battery RTE:          {row.battery_rte:.0%}")
            print(f"    Inverter efficiency:  {row.inverter_efficiency:.0%}")
            print(f"    Max battery duration: {row.max_battery_duration} hrs")

        print(f"\n{'='*80}")

    finally:
        session.close()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Load cost assumption scenarios into PostgreSQL."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print scenarios without writing to database",
    )
    args = parser.parse_args()

    if args.dry_run:
        print("DRY RUN: Would upsert the following scenarios:\n")
        for s in SCENARIOS:
            print(f"  {s['scenario_name']}:")
            for k, v in s.items():
                if k != "scenario_name":
                    print(f"    {k}: {v}")
            print()
        return

    engine = _get_engine()
    count = load_cost_assumptions(engine=engine)
    logger.info("Loaded %d scenarios.", count)
    log_summary(engine=engine)


if __name__ == "__main__":
    main()
