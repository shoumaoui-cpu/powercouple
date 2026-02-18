#!/usr/bin/env python3
"""
fetch_pvgis.py - Fetch solar irradiance profiles from the PVGIS API.

Creates a grid of points across the continental US and retrieves hourly solar
capacity factors from PVGIS (v5.2).  Cached profiles are stored as CSV files
so the script can resume after interruptions.  Each gas plant is assigned the
nearest grid-cell profile and its annual-average solar CF is written back to
the database.
"""

import argparse
import logging
import math
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from sqlalchemy import Column, Float, Integer, String, create_engine, text, func
from sqlalchemy.orm import sessionmaker

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("fetch_pvgis")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PVGIS_API_URL = "https://re.jrc.ec.europa.eu/api/v5_2/seriescalc"

# Continental US bounding box
US_LAT_MIN = 25.0
US_LAT_MAX = 49.0
US_LON_MIN = -125.0
US_LON_MAX = -67.0

DEFAULT_GRID_RESOLUTION = 0.5  # degrees
DEFAULT_YEAR = 2020
REQUEST_DELAY_SECONDS = 2.0

SOLAR_PROFILES_DIR = "data/raw/solar"


# ---------------------------------------------------------------------------
# Grid generation
# ---------------------------------------------------------------------------


def generate_grid(
    lat_min: float = US_LAT_MIN,
    lat_max: float = US_LAT_MAX,
    lon_min: float = US_LON_MIN,
    lon_max: float = US_LON_MAX,
    resolution: float = DEFAULT_GRID_RESOLUTION,
) -> list[tuple[float, float]]:
    """Generate a grid of (lat, lon) cell centers covering the specified area."""
    lats = np.arange(lat_min + resolution / 2, lat_max, resolution)
    lons = np.arange(lon_min + resolution / 2, lon_max, resolution)
    grid = [(round(lat, 4), round(lon, 4)) for lat in lats for lon in lons]
    logger.info(
        "Generated grid: %d cells (%.1f deg resolution, %d lats x %d lons)",
        len(grid),
        resolution,
        len(lats),
        len(lons),
    )
    return grid


# ---------------------------------------------------------------------------
# PVGIS fetch
# ---------------------------------------------------------------------------


def _grid_cell_filename(lat: float, lon: float) -> str:
    """Deterministic filename for a grid cell CSV."""
    lat_str = f"{lat:+08.4f}".replace(".", "p").replace("+", "N").replace("-", "S")
    lon_str = f"{lon:+09.4f}".replace(".", "p").replace("+", "E").replace("-", "W")
    return f"solar_{lat_str}_{lon_str}.csv"


def fetch_pvgis_profile(
    lat: float,
    lon: float,
    year: int = DEFAULT_YEAR,
) -> pd.DataFrame | None:
    """Call the PVGIS API for a single point and return an hourly DataFrame.

    Returns DataFrame with columns: timestamp, power_w_per_kwp, capacity_factor
    or None on failure.
    """
    params = {
        "lat": lat,
        "lon": lon,
        "startyear": year,
        "endyear": year,
        "pvcalculation": 1,
        "peakpower": 1,  # 1 kWp reference system
        "loss": 0,
        "angle": int(round(abs(lat))),  # tilt = latitude
        "aspect": 0,  # south-facing
        "outputformat": "json",
    }

    try:
        resp = requests.get(PVGIS_API_URL, params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        logger.warning("PVGIS request failed for (%.4f, %.4f): %s", lat, lon, exc)
        return None
    except ValueError as exc:
        logger.warning("PVGIS JSON parse error for (%.4f, %.4f): %s", lat, lon, exc)
        return None

    # Extract hourly data
    try:
        hourly = data["outputs"]["hourly"]
    except KeyError:
        logger.warning("No hourly data in PVGIS response for (%.4f, %.4f)", lat, lon)
        return None

    df = pd.DataFrame(hourly)

    if df.empty:
        logger.warning("Empty hourly data from PVGIS for (%.4f, %.4f)", lat, lon)
        return None

    # Parse timestamp
    df["timestamp"] = pd.to_datetime(df["time"], format="%Y%m%d:%H%M", errors="coerce")

    # P is power in W for 1 kWp system; capacity factor = P / 1000
    df["power_w_per_kwp"] = pd.to_numeric(df["P"], errors="coerce").fillna(0)
    df["capacity_factor"] = (df["power_w_per_kwp"] / 1000).clip(0, 1)

    return df[["timestamp", "power_w_per_kwp", "capacity_factor"]]


def fetch_all_grid_profiles(
    grid: list[tuple[float, float]],
    output_dir: str = SOLAR_PROFILES_DIR,
    year: int = DEFAULT_YEAR,
    delay: float = REQUEST_DELAY_SECONDS,
) -> dict[tuple[float, float], Path]:
    """Fetch PVGIS profiles for every grid cell, with resume support.

    Returns dict mapping (lat, lon) -> path to CSV file.
    """
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    results = {}
    total = len(grid)

    for idx, (lat, lon) in enumerate(grid, 1):
        fname = _grid_cell_filename(lat, lon)
        fpath = out_path / fname

        # Resume support: skip if file already exists
        if fpath.exists() and fpath.stat().st_size > 100:
            results[(lat, lon)] = fpath
            continue

        logger.info(
            "[%d/%d] Fetching PVGIS profile for (%.4f, %.4f)...",
            idx,
            total,
            lat,
            lon,
        )

        df = fetch_pvgis_profile(lat, lon, year=year)

        if df is not None and not df.empty:
            df.to_csv(fpath, index=False)
            results[(lat, lon)] = fpath
            logger.info(
                "  Saved %d hours, avg CF=%.3f",
                len(df),
                df["capacity_factor"].mean(),
            )
        else:
            logger.warning("  No data for (%.4f, %.4f), skipping.", lat, lon)

        # Rate limiting
        time.sleep(delay)

    logger.info("Fetched %d / %d grid cell profiles.", len(results), total)
    return results


# ---------------------------------------------------------------------------
# Assign profiles to plants
# ---------------------------------------------------------------------------


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in km between two lat/lon points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def find_nearest_grid_cell(
    lat: float, lon: float, grid_cells: list[tuple[float, float]]
) -> tuple[float, float]:
    """Return the nearest grid cell (lat, lon) to the given point."""
    best = None
    best_dist = float("inf")
    for glat, glon in grid_cells:
        d = _haversine_km(lat, lon, glat, glon)
        if d < best_dist:
            best_dist = d
            best = (glat, glon)
    return best


def assign_solar_to_plants(
    profiles: dict[tuple[float, float], Path],
    engine=None,
):
    """Read each plant's lat/lon from DB, find nearest grid cell, compute
    annual average CF, and update the plant record."""
    if engine is None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL not set")
        engine = create_engine(database_url)

    Session = sessionmaker(bind=engine)
    session = Session()

    grid_cells = list(profiles.keys())

    try:
        plants = session.execute(
            text("SELECT id, latitude, longitude FROM gas_plants WHERE latitude IS NOT NULL AND longitude IS NOT NULL")
        ).fetchall()

        logger.info("Assigning solar profiles to %d plants...", len(plants))
        updated = 0

        for plant_id, lat, lon in plants:
            nearest = find_nearest_grid_cell(lat, lon, grid_cells)
            if nearest is None:
                continue

            profile_path = profiles.get(nearest)
            if profile_path is None or not profile_path.exists():
                continue

            try:
                profile_df = pd.read_csv(profile_path)
                avg_cf = profile_df["capacity_factor"].mean()
            except Exception as exc:
                logger.warning("Error reading profile %s: %s", profile_path, exc)
                continue

            session.execute(
                text(
                    "UPDATE gas_plants SET solar_cf = :cf, updated_at = NOW() WHERE id = :id"
                ),
                {"cf": float(avg_cf), "id": plant_id},
            )
            updated += 1

        session.commit()
        logger.info("Updated solar_cf for %d plants.", updated)

    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Store hourly profiles in solar_profiles table
# ---------------------------------------------------------------------------


def store_hourly_profiles(
    profiles: dict[tuple[float, float], Path],
    engine=None,
):
    """Store hourly solar profiles in the solar_profiles table."""
    if engine is None:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL not set")
        engine = create_engine(database_url)

    # Create solar_profiles table if it does not exist
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS solar_profiles (
                    id SERIAL PRIMARY KEY,
                    grid_lat DOUBLE PRECISION NOT NULL,
                    grid_lon DOUBLE PRECISION NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    capacity_factor DOUBLE PRECISION NOT NULL,
                    UNIQUE(grid_lat, grid_lon, timestamp)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_solar_profiles_grid
                ON solar_profiles (grid_lat, grid_lon)
                """
            )
        )

    logger.info("Storing hourly profiles in solar_profiles table...")
    stored = 0

    for (lat, lon), fpath in profiles.items():
        if not fpath.exists():
            continue

        try:
            df = pd.read_csv(fpath)
        except Exception as exc:
            logger.warning("Cannot read %s: %s", fpath, exc)
            continue

        if df.empty:
            continue

        df["grid_lat"] = lat
        df["grid_lon"] = lon
        df["timestamp"] = pd.to_datetime(df["timestamp"])

        # Bulk insert, ignoring conflicts
        records = df[["grid_lat", "grid_lon", "timestamp", "capacity_factor"]].to_dict(
            orient="records"
        )

        with engine.begin() as conn:
            for rec in records:
                conn.execute(
                    text(
                        """
                        INSERT INTO solar_profiles (grid_lat, grid_lon, timestamp, capacity_factor)
                        VALUES (:grid_lat, :grid_lon, :timestamp, :capacity_factor)
                        ON CONFLICT (grid_lat, grid_lon, timestamp) DO NOTHING
                        """
                    ),
                    rec,
                )

        stored += 1
        if stored % 50 == 0:
            logger.info("  Stored profiles for %d grid cells...", stored)

    logger.info("Stored hourly profiles for %d grid cells total.", stored)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Fetch solar profiles from PVGIS and assign to gas plants."
    )
    parser.add_argument(
        "--grid-resolution",
        type=float,
        default=DEFAULT_GRID_RESOLUTION,
        help=f"Grid resolution in degrees (default: {DEFAULT_GRID_RESOLUTION})",
    )
    parser.add_argument(
        "--year",
        type=int,
        default=DEFAULT_YEAR,
        help=f"Year for PVGIS data (default: {DEFAULT_YEAR})",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=SOLAR_PROFILES_DIR,
        help=f"Directory to cache solar profile CSVs (default: {SOLAR_PROFILES_DIR})",
    )
    parser.add_argument(
        "--skip-fetch",
        action="store_true",
        help="Skip fetching from PVGIS; use existing cached files only",
    )
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="Skip database operations (assign to plants, store profiles)",
    )
    parser.add_argument(
        "--skip-hourly-store",
        action="store_true",
        help="Skip storing hourly profiles in database (saves time/space)",
    )
    args = parser.parse_args()

    grid = generate_grid(resolution=args.grid_resolution)

    if args.skip_fetch:
        # Load existing cached files
        out_path = Path(args.output_dir)
        profiles = {}
        for lat, lon in grid:
            fname = _grid_cell_filename(lat, lon)
            fpath = out_path / fname
            if fpath.exists() and fpath.stat().st_size > 100:
                profiles[(lat, lon)] = fpath
        logger.info("Loaded %d cached profiles (skip-fetch mode).", len(profiles))
    else:
        profiles = fetch_all_grid_profiles(
            grid,
            output_dir=args.output_dir,
            year=args.year,
        )

    if not args.skip_db:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            logger.error("DATABASE_URL not set; skipping database operations.")
            return

        engine = create_engine(database_url)

        # Assign nearest profile to each plant
        assign_solar_to_plants(profiles, engine=engine)

        # Store hourly profiles
        if not args.skip_hourly_store:
            store_hourly_profiles(profiles, engine=engine)

    # Print summary
    if profiles:
        avg_cfs = []
        for fpath in profiles.values():
            try:
                df = pd.read_csv(fpath)
                avg_cfs.append(df["capacity_factor"].mean())
            except Exception:
                continue

        if avg_cfs:
            print(f"\nSolar Profile Summary:")
            print(f"  Grid cells with data: {len(avg_cfs)}")
            print(f"  Average solar CF:     {np.mean(avg_cfs):.3f}")
            print(f"  Min solar CF:         {np.min(avg_cfs):.3f}")
            print(f"  Max solar CF:         {np.max(avg_cfs):.3f}")


if __name__ == "__main__":
    main()
