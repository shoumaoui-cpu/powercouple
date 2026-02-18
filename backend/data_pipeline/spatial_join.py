#!/usr/bin/env python3
"""
spatial_join.py - Load US data center locations and run PostGIS spatial join.

Maintains a curated list of ~50 major US data center locations, inserts them
into the data_centers table, then runs a spatial join to count how many data
centers fall within 80 km of each gas plant.  The result is written to the
nearby_dc_count column on gas_plants.
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
from geoalchemy2 import Geometry

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("spatial_join")

Base = declarative_base()


# ---------------------------------------------------------------------------
# SQLAlchemy model
# ---------------------------------------------------------------------------


class DataCenter(Base):
    __tablename__ = "data_centers"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    operator = Column(String)
    status = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    capacity_mw = Column(Float)
    geom = Column(Geometry("POINT", srid=4326))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ---------------------------------------------------------------------------
# Curated US data center locations
# ---------------------------------------------------------------------------

DATA_CENTERS = [
    # Northern Virginia (Ashburn cluster) - largest market in the world
    {"name": "Ashburn VA - Digital Realty IAD", "operator": "Digital Realty", "status": "operational", "lat": 39.0438, "lon": -77.4874, "capacity_mw": 150},
    {"name": "Ashburn VA - Equinix DC", "operator": "Equinix", "status": "operational", "lat": 39.0458, "lon": -77.4839, "capacity_mw": 130},
    {"name": "Ashburn VA - AWS US-East-1", "operator": "Amazon", "status": "operational", "lat": 39.0420, "lon": -77.4900, "capacity_mw": 200},
    {"name": "Ashburn VA - Microsoft Azure East", "operator": "Microsoft", "status": "operational", "lat": 39.0500, "lon": -77.4780, "capacity_mw": 180},
    {"name": "Ashburn VA - QTS Data Centers", "operator": "QTS", "status": "operational", "lat": 39.0470, "lon": -77.4810, "capacity_mw": 100},
    {"name": "Manassas VA - AWS", "operator": "Amazon", "status": "operational", "lat": 38.7509, "lon": -77.4753, "capacity_mw": 120},
    {"name": "Sterling VA - Vantage", "operator": "Vantage", "status": "operational", "lat": 39.0066, "lon": -77.4286, "capacity_mw": 90},
    # Dallas / Fort Worth TX
    {"name": "Dallas TX - Equinix DA", "operator": "Equinix", "status": "operational", "lat": 32.8975, "lon": -96.9530, "capacity_mw": 80},
    {"name": "Dallas TX - Digital Realty DFW", "operator": "Digital Realty", "status": "operational", "lat": 32.9290, "lon": -96.9800, "capacity_mw": 100},
    {"name": "Dallas TX - CyrusOne Carrollton", "operator": "CyrusOne", "status": "operational", "lat": 32.9537, "lon": -96.8900, "capacity_mw": 110},
    {"name": "Fort Worth TX - Facebook", "operator": "Meta", "status": "operational", "lat": 32.8151, "lon": -97.3947, "capacity_mw": 150},
    # Phoenix / Mesa AZ
    {"name": "Phoenix AZ - CyrusOne Chandler", "operator": "CyrusOne", "status": "operational", "lat": 33.2830, "lon": -111.8500, "capacity_mw": 100},
    {"name": "Mesa AZ - Apple", "operator": "Apple", "status": "operational", "lat": 33.3943, "lon": -111.7180, "capacity_mw": 130},
    {"name": "Goodyear AZ - Microsoft Azure West", "operator": "Microsoft", "status": "operational", "lat": 33.4353, "lon": -112.3580, "capacity_mw": 120},
    {"name": "Phoenix AZ - Stream Data Centers", "operator": "Stream", "status": "under_construction", "lat": 33.4484, "lon": -112.0740, "capacity_mw": 80},
    # Columbus OH
    {"name": "Columbus OH - AWS US-East-2", "operator": "Amazon", "status": "operational", "lat": 39.9612, "lon": -82.9988, "capacity_mw": 150},
    {"name": "Columbus OH - Google", "operator": "Google", "status": "operational", "lat": 39.9800, "lon": -83.0500, "capacity_mw": 120},
    {"name": "Columbus OH - QTS", "operator": "QTS", "status": "operational", "lat": 40.0000, "lon": -82.8800, "capacity_mw": 80},
    # Chicago IL
    {"name": "Chicago IL - Equinix CH", "operator": "Equinix", "status": "operational", "lat": 41.8525, "lon": -87.6514, "capacity_mw": 70},
    {"name": "Chicago IL - Digital Realty ORD", "operator": "Digital Realty", "status": "operational", "lat": 41.8430, "lon": -87.7300, "capacity_mw": 80},
    {"name": "Elk Grove Village IL - Digital Realty", "operator": "Digital Realty", "status": "operational", "lat": 42.0042, "lon": -87.9706, "capacity_mw": 60},
    # Silicon Valley / Bay Area CA
    {"name": "Santa Clara CA - Equinix SV", "operator": "Equinix", "status": "operational", "lat": 37.3541, "lon": -121.9552, "capacity_mw": 90},
    {"name": "San Jose CA - Digital Realty SJC", "operator": "Digital Realty", "status": "operational", "lat": 37.3382, "lon": -121.8863, "capacity_mw": 85},
    {"name": "Fremont CA - Equinix", "operator": "Equinix", "status": "operational", "lat": 37.5485, "lon": -121.9886, "capacity_mw": 50},
    # Oregon (The Dalles, Prineville)
    {"name": "The Dalles OR - Google", "operator": "Google", "status": "operational", "lat": 45.5946, "lon": -121.1787, "capacity_mw": 200},
    {"name": "Prineville OR - Meta (Facebook)", "operator": "Meta", "status": "operational", "lat": 44.3100, "lon": -120.8340, "capacity_mw": 180},
    {"name": "Hillsboro OR - Intel Campus", "operator": "Intel", "status": "operational", "lat": 45.5401, "lon": -122.9365, "capacity_mw": 60},
    # Atlanta GA
    {"name": "Atlanta GA - Equinix AT", "operator": "Equinix", "status": "operational", "lat": 33.7490, "lon": -84.3880, "capacity_mw": 65},
    {"name": "Atlanta GA - QTS Metro", "operator": "QTS", "status": "operational", "lat": 33.7700, "lon": -84.4200, "capacity_mw": 80},
    {"name": "Lithia Springs GA - Google", "operator": "Google", "status": "operational", "lat": 33.7800, "lon": -84.6500, "capacity_mw": 120},
    # New York / New Jersey
    {"name": "Secaucus NJ - Equinix NY", "operator": "Equinix", "status": "operational", "lat": 40.7895, "lon": -74.0565, "capacity_mw": 70},
    {"name": "Weehawken NJ - Digital Realty", "operator": "Digital Realty", "status": "operational", "lat": 40.7690, "lon": -74.0200, "capacity_mw": 60},
    {"name": "Piscataway NJ - CoreSite", "operator": "CoreSite", "status": "operational", "lat": 40.5515, "lon": -74.4590, "capacity_mw": 55},
    # Salt Lake City UT
    {"name": "Salt Lake City UT - Aligned DC", "operator": "Aligned", "status": "operational", "lat": 40.7608, "lon": -111.8910, "capacity_mw": 60},
    {"name": "West Jordan UT - Facebook", "operator": "Meta", "status": "operational", "lat": 40.6097, "lon": -111.9391, "capacity_mw": 100},
    # Las Vegas NV
    {"name": "Las Vegas NV - Switch SuperNAP", "operator": "Switch", "status": "operational", "lat": 36.0800, "lon": -115.1522, "capacity_mw": 200},
    {"name": "Reno NV - Switch Citadel", "operator": "Switch", "status": "operational", "lat": 39.5296, "lon": -119.8138, "capacity_mw": 150},
    # San Antonio TX
    {"name": "San Antonio TX - Microsoft Azure South Central", "operator": "Microsoft", "status": "operational", "lat": 29.4241, "lon": -98.4936, "capacity_mw": 100},
    {"name": "San Antonio TX - CyrusOne", "operator": "CyrusOne", "status": "operational", "lat": 29.5100, "lon": -98.5700, "capacity_mw": 90},
    # Iowa
    {"name": "Altoona IA - Meta (Facebook)", "operator": "Meta", "status": "operational", "lat": 41.6444, "lon": -93.4629, "capacity_mw": 150},
    {"name": "Council Bluffs IA - Google", "operator": "Google", "status": "operational", "lat": 41.2619, "lon": -95.8608, "capacity_mw": 130},
    # North Carolina
    {"name": "Durham NC - Google", "operator": "Google", "status": "operational", "lat": 35.9940, "lon": -78.8986, "capacity_mw": 100},
    {"name": "Maiden NC - Apple", "operator": "Apple", "status": "operational", "lat": 35.5704, "lon": -81.1998, "capacity_mw": 100},
    # Seattle / Eastern WA
    {"name": "Quincy WA - Microsoft Azure West", "operator": "Microsoft", "status": "operational", "lat": 47.2346, "lon": -119.8527, "capacity_mw": 200},
    {"name": "Quincy WA - Yahoo/Verizon", "operator": "Yahoo", "status": "operational", "lat": 47.2360, "lon": -119.8500, "capacity_mw": 60},
    {"name": "Moses Lake WA - Microsoft", "operator": "Microsoft", "status": "under_construction", "lat": 47.1301, "lon": -119.2780, "capacity_mw": 100},
    # Denver CO
    {"name": "Denver CO - CoreSite", "operator": "CoreSite", "status": "operational", "lat": 39.7392, "lon": -104.9903, "capacity_mw": 50},
    {"name": "Cheyenne WY - Microsoft Azure", "operator": "Microsoft", "status": "operational", "lat": 41.1400, "lon": -104.8202, "capacity_mw": 80},
    # Kansas City
    {"name": "Kansas City MO - Google", "operator": "Google", "status": "operational", "lat": 39.0997, "lon": -94.5786, "capacity_mw": 70},
    # Houston TX
    {"name": "Houston TX - CyrusOne", "operator": "CyrusOne", "status": "operational", "lat": 29.7604, "lon": -95.3698, "capacity_mw": 90},
    {"name": "Houston TX - Digital Realty", "operator": "Digital Realty", "status": "operational", "lat": 29.7500, "lon": -95.4000, "capacity_mw": 70},
]


# ---------------------------------------------------------------------------
# Load data centers
# ---------------------------------------------------------------------------


def load_data_centers(engine=None) -> int:
    """Upsert data center records into PostgreSQL. Returns count of upserted rows."""
    if engine is None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL not set")
        engine = create_engine(database_url)

    Base.metadata.create_all(engine)
    logger.info("Ensured data_centers table exists.")

    Session = sessionmaker(bind=engine)
    session = Session()

    upserted = 0

    try:
        for dc in DATA_CENTERS:
            dc_id = str(uuid.uuid4())

            # Use raw SQL for upsert with geometry
            session.execute(
                text(
                    """
                    INSERT INTO data_centers (id, name, operator, status, latitude, longitude, capacity_mw, geom, created_at, updated_at)
                    VALUES (:id, :name, :operator, :status, :lat, :lon, :capacity_mw,
                            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), NOW(), NOW())
                    ON CONFLICT (name) DO UPDATE SET
                        operator = EXCLUDED.operator,
                        status = EXCLUDED.status,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        capacity_mw = EXCLUDED.capacity_mw,
                        geom = ST_SetSRID(ST_MakePoint(EXCLUDED.longitude, EXCLUDED.latitude), 4326),
                        updated_at = NOW()
                    """
                ),
                {
                    "id": dc_id,
                    "name": dc["name"],
                    "operator": dc["operator"],
                    "status": dc["status"],
                    "lat": dc["lat"],
                    "lon": dc["lon"],
                    "capacity_mw": dc["capacity_mw"],
                },
            )
            upserted += 1

        session.commit()
        logger.info("Upserted %d data center records.", upserted)

        # Ensure unique constraint on name exists (for upsert)
        session.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'data_centers_name_unique'
                    ) THEN
                        ALTER TABLE data_centers ADD CONSTRAINT data_centers_name_unique UNIQUE (name);
                    END IF;
                END $$;
                """
            )
        )
        session.commit()

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return upserted


# ---------------------------------------------------------------------------
# Spatial join: count nearby data centers per gas plant
# ---------------------------------------------------------------------------

DEFAULT_RADIUS_KM = 80


def run_spatial_join(engine=None, radius_km: float = DEFAULT_RADIUS_KM) -> int:
    """Count data centers within radius_km of each gas plant and update
    the nearby_dc_count column.

    Returns the number of plants updated.
    """
    if engine is None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL not set")
        engine = create_engine(database_url)

    radius_meters = radius_km * 1000

    logger.info(
        "Running spatial join: counting data centers within %.0f km of each plant...",
        radius_km,
    )

    with engine.begin() as conn:
        # Ensure spatial indexes exist
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_gas_plants_geom
                ON gas_plants USING GIST (geom);
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_data_centers_geom
                ON data_centers USING GIST (geom);
                """
            )
        )

        # Update nearby_dc_count using a subquery
        result = conn.execute(
            text(
                """
                UPDATE gas_plants gp
                SET nearby_dc_count = sub.dc_count,
                    updated_at = NOW()
                FROM (
                    SELECT gp2.id,
                           COUNT(dc.id) AS dc_count
                    FROM gas_plants gp2
                    LEFT JOIN data_centers dc
                        ON ST_DWithin(
                            gp2.geom::geography,
                            dc.geom::geography,
                            :radius_meters
                        )
                    WHERE gp2.geom IS NOT NULL
                    GROUP BY gp2.id
                ) sub
                WHERE gp.id = sub.id
                """
            ),
            {"radius_meters": radius_meters},
        )

        updated = result.rowcount
        logger.info("Updated nearby_dc_count for %d plants.", updated)

    return updated


def log_summary(engine=None):
    """Print summary of spatial join results."""
    if engine is None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            return
        engine = create_engine(database_url)

    with engine.connect() as conn:
        # Total data centers
        dc_count = conn.execute(text("SELECT COUNT(*) FROM data_centers")).scalar()

        # Plants with nearby DCs
        plants_with_dc = conn.execute(
            text("SELECT COUNT(*) FROM gas_plants WHERE nearby_dc_count > 0")
        ).scalar()

        total_plants = conn.execute(
            text("SELECT COUNT(*) FROM gas_plants")
        ).scalar()

        # Top plants by nearby DC count
        top_plants = conn.execute(
            text(
                """
                SELECT plant_name, state, nearby_dc_count, nameplate_capacity_mw
                FROM gas_plants
                WHERE nearby_dc_count > 0
                ORDER BY nearby_dc_count DESC
                LIMIT 15
                """
            )
        ).fetchall()

        print(f"\n{'='*70}")
        print("Spatial Join Summary")
        print(f"{'='*70}")
        print(f"Total data centers loaded:       {dc_count}")
        print(f"Total gas plants:                {total_plants}")
        print(f"Plants near data centers (80km): {plants_with_dc}")
        print(f"\nTop plants by nearby data center count:")
        for name, state, dc_n, mw in top_plants:
            print(f"  {name} ({state}): {dc_n} DCs within 80km, {mw:.0f} MW")
        print(f"{'='*70}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Load data center locations and run PostGIS spatial join with gas plants."
    )
    parser.add_argument(
        "--radius-km",
        type=float,
        default=DEFAULT_RADIUS_KM,
        help=f"Radius in km for spatial join (default: {DEFAULT_RADIUS_KM})",
    )
    parser.add_argument(
        "--skip-load",
        action="store_true",
        help="Skip loading data centers (only run spatial join)",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL not set.")
        return

    engine = create_engine(database_url)

    if not args.skip_load:
        load_data_centers(engine=engine)

    run_spatial_join(engine=engine, radius_km=args.radius_km)
    log_summary(engine=engine)


if __name__ == "__main__":
    main()
