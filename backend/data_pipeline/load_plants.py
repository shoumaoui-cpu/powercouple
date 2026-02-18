#!/usr/bin/env python3
"""
load_plants.py - Load processed EIA plant data into PostgreSQL with PostGIS.

Reads the plant-level DataFrame produced by download_eia.py and upserts records
into the gas_plants table, populating the PostGIS geometry column and mapping
NERC regions and balancing authorities.
"""

import argparse
import logging
import os
import uuid
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from geoalchemy2 import Geometry
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
logger = logging.getLogger("load_plants")

Base = declarative_base()


# ---------------------------------------------------------------------------
# SQLAlchemy model
# ---------------------------------------------------------------------------


class GasPlant(Base):
    __tablename__ = "gas_plants"

    id = Column(String, primary_key=True)
    eia_plant_code = Column(Integer, unique=True)
    plant_name = Column(String)
    operator_name = Column(String)
    state = Column(String)
    county = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    geom = Column(Geometry("POINT", srid=4326))
    nameplate_capacity_mw = Column(Float)
    summer_capacity_mw = Column(Float)
    winter_capacity_mw = Column(Float)
    ct_capacity_mw = Column(Float)
    ccgt_capacity_mw = Column(Float)
    capacity_factor = Column(Float)
    ct_capacity_factor = Column(Float)
    ccgt_capacity_factor = Column(Float)
    annual_gen_mwh = Column(Float)
    heat_rate_btu_kwh = Column(Float)
    variable_cost_ct = Column(Float)
    variable_cost_ccgt = Column(Float)
    prime_mover = Column(String)
    operating_status = Column(String)
    demand_region = Column(String)
    balancing_authority = Column(String)
    nerc_region = Column(String)
    solar_potential_mw = Column(Float)
    solar_cf = Column(Float)
    lcoe_hybrid = Column(Float)
    lcoe_gas_only = Column(Float)
    nearby_dc_count = Column(Integer, default=0)
    eia_860_year = Column(Integer)
    eia_923_year = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# NERC Region -> demand region mapping
# ---------------------------------------------------------------------------

NERC_TO_DEMAND_REGION = {
    "WECC": "WECC",
    "TRE": "ERCOT",
    "ERCOT": "ERCOT",
    "SERC": "SERC",
    "RFC": "PJM",
    "PJM": "PJM",
    "NPCC": "NPCC",
    "MRO": "MISO",
    "MISO": "MISO",
    "SPP": "SPP",
    "FRCC": "FRCC",
    "HICC": "HICC",
    "ASCC": "ASCC",
}


def _generate_id() -> str:
    """Generate a unique string ID for a plant record."""
    return str(uuid.uuid4())


def _get_engine():
    """Create SQLAlchemy engine from DATABASE_URL environment variable."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Set it in .env or export it before running."
        )
    return create_engine(database_url, echo=False)


def _ensure_table(engine):
    """Create the gas_plants table if it does not exist."""
    Base.metadata.create_all(engine)
    logger.info("Ensured gas_plants table exists.")


# ---------------------------------------------------------------------------
# Load logic
# ---------------------------------------------------------------------------


def load_plants_from_dataframe(df: pd.DataFrame, engine=None) -> int:
    """Upsert plant records from a DataFrame into PostgreSQL.

    Returns the number of rows upserted.
    """
    if engine is None:
        engine = _get_engine()

    _ensure_table(engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    upserted = 0

    try:
        for _, row in df.iterrows():
            plant_code = int(row["plant_code"])
            lat = row.get("latitude")
            lon = row.get("longitude")
            nerc = row.get("nerc_region")
            ba_code = row.get("balancing_authority_code")

            # Build the geometry WKT expression
            geom_expr = None
            if pd.notna(lat) and pd.notna(lon):
                geom_expr = func.ST_SetSRID(
                    func.ST_MakePoint(float(lon), float(lat)), 4326
                )

            # Map NERC region to demand region
            demand_region = NERC_TO_DEMAND_REGION.get(str(nerc).strip(), str(nerc))

            values = {
                "eia_plant_code": plant_code,
                "plant_name": row.get("plant_name"),
                "operator_name": row.get("operator_name"),
                "state": row.get("state"),
                "county": row.get("county"),
                "latitude": float(lat) if pd.notna(lat) else None,
                "longitude": float(lon) if pd.notna(lon) else None,
                "nameplate_capacity_mw": _safe_float(row, "nameplate_capacity_mw"),
                "summer_capacity_mw": _safe_float(row, "summer_capacity_mw"),
                "winter_capacity_mw": _safe_float(row, "winter_capacity_mw"),
                "ct_capacity_mw": _safe_float(row, "ct_capacity_mw"),
                "ccgt_capacity_mw": _safe_float(row, "ccgt_capacity_mw"),
                "capacity_factor": _safe_float(row, "capacity_factor"),
                "ct_capacity_factor": _safe_float(row, "ct_capacity_factor"),
                "ccgt_capacity_factor": _safe_float(row, "ccgt_capacity_factor"),
                "annual_gen_mwh": _safe_float(row, "annual_gen_mwh"),
                "heat_rate_btu_kwh": _safe_float(row, "heat_rate_btu_kwh"),
                "variable_cost_ct": _safe_float(row, "variable_cost_ct"),
                "variable_cost_ccgt": _safe_float(row, "variable_cost_ccgt"),
                "prime_mover": row.get("prime_mover"),
                "operating_status": row.get("operating_status", "OP"),
                "demand_region": demand_region,
                "balancing_authority": ba_code,
                "nerc_region": nerc,
                "eia_860_year": int(row.get("eia_860_year", 0)) or None,
                "eia_923_year": int(row.get("eia_923_year", 0)) or None,
            }

            # Use PostgreSQL INSERT ... ON CONFLICT for upsert
            stmt = pg_insert(GasPlant.__table__).values(
                id=_generate_id(),
                **values,
            )

            # On conflict with eia_plant_code, update everything except id and created_at
            update_cols = {k: v for k, v in values.items()}
            update_cols["updated_at"] = func.now()
            if geom_expr is not None:
                update_cols["geom"] = geom_expr

            stmt = stmt.on_conflict_do_update(
                index_elements=["eia_plant_code"],
                set_=update_cols,
            )

            # For new inserts, also set the geometry
            if geom_expr is not None:
                # We need to handle geom separately for inserts via a raw UPDATE
                pass

            session.execute(stmt)
            upserted += 1

            if upserted % 200 == 0:
                session.commit()
                logger.info("Upserted %d plants so far...", upserted)

        session.commit()

        # Update geometry for all rows that have lat/lon but no geom
        session.execute(
            text(
                """
                UPDATE gas_plants
                SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                WHERE latitude IS NOT NULL
                  AND longitude IS NOT NULL
                  AND (geom IS NULL OR geom != ST_SetSRID(ST_MakePoint(longitude, latitude), 4326))
                """
            )
        )
        session.commit()

        logger.info("Successfully upserted %d plant records.", upserted)
        return upserted

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _safe_float(row, col):
    """Safely extract a float value from a DataFrame row."""
    val = row.get(col)
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Summary logging
# ---------------------------------------------------------------------------


def log_summary(engine):
    """Log summary statistics from the gas_plants table."""
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        total = session.query(func.count(GasPlant.id)).scalar()
        total_mw = session.query(func.sum(GasPlant.nameplate_capacity_mw)).scalar() or 0

        logger.info("=" * 60)
        logger.info("Plant Load Summary")
        logger.info("=" * 60)
        logger.info("Total plants loaded: %d", total)
        logger.info("Total nameplate capacity: %.0f MW", total_mw)

        # By state
        state_results = (
            session.query(
                GasPlant.state,
                func.count(GasPlant.id),
                func.sum(GasPlant.nameplate_capacity_mw),
            )
            .group_by(GasPlant.state)
            .order_by(func.sum(GasPlant.nameplate_capacity_mw).desc())
            .limit(15)
            .all()
        )
        logger.info("\nTop states by capacity:")
        for state, count, mw in state_results:
            logger.info("  %s: %d plants, %.0f MW", state, count, mw or 0)

        # By prime mover
        pm_results = (
            session.query(
                GasPlant.prime_mover,
                func.count(GasPlant.id),
                func.sum(GasPlant.nameplate_capacity_mw),
            )
            .group_by(GasPlant.prime_mover)
            .order_by(func.sum(GasPlant.nameplate_capacity_mw).desc())
            .all()
        )
        logger.info("\nBy prime mover type:")
        for pm, count, mw in pm_results:
            logger.info("  %s: %d plants, %.0f MW", pm, count, mw or 0)

        logger.info("=" * 60)

    finally:
        session.close()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Load EIA gas plant data into PostgreSQL."
    )
    parser.add_argument(
        "--csv",
        type=str,
        help="Path to CSV file produced by download_eia.py (alternative to running download_eia directly)",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2023,
        help="If no CSV provided, download and process EIA data for this year (default: 2023)",
    )
    parser.add_argument(
        "--gas-price",
        type=float,
        default=3.50,
        help="Gas price in $/MMBtu for variable cost computation (default: 3.50)",
    )
    args = parser.parse_args()

    engine = _get_engine()
    _ensure_table(engine)

    if args.csv:
        logger.info("Loading plants from CSV: %s", args.csv)
        df = pd.read_csv(args.csv)
    else:
        logger.info("Running EIA download for year %d...", args.year)
        from download_eia import download_and_process

        df = download_and_process(
            year=args.year,
            gas_price=args.gas_price,
            save_csv=True,
        )

    count = load_plants_from_dataframe(df, engine=engine)
    logger.info("Loaded %d plants into database.", count)

    log_summary(engine)


if __name__ == "__main__":
    main()
