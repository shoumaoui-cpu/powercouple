#!/usr/bin/env python3
"""
run_pipeline.py - Master pipeline runner for the PowerCouple EIA data pipeline.

Orchestrates all pipeline steps in order:
  1. Download EIA-860/923 data
  2. Load gas plants into PostgreSQL
  3. Fetch PVGIS solar profiles
  4. Load cost assumptions
  5. Load data centers and run spatial join
  6. Compute LCOE estimates

Each step can be skipped via command-line flags for incremental runs.
"""

import argparse
import logging
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("run_pipeline")


# ---------------------------------------------------------------------------
# Pipeline steps
# ---------------------------------------------------------------------------


def step_download_eia(year: int, output_dir: str, gas_price: float):
    """Step 1: Download and process EIA-860/923 data."""
    logger.info("=" * 60)
    logger.info("STEP 1: Download EIA Data (year=%d)", year)
    logger.info("=" * 60)

    from download_eia import download_and_process

    df = download_and_process(
        year=year,
        output_dir=output_dir,
        gas_price=gas_price,
        save_csv=True,
    )
    logger.info("Downloaded and processed %d plants.", len(df))
    return df


def step_load_plants(df, engine):
    """Step 2: Load gas plants into PostgreSQL."""
    logger.info("=" * 60)
    logger.info("STEP 2: Load Plants into Database")
    logger.info("=" * 60)

    from load_plants import load_plants_from_dataframe, log_summary

    count = load_plants_from_dataframe(df, engine=engine)
    logger.info("Loaded %d plants.", count)
    log_summary(engine)
    return count


def step_fetch_pvgis(grid_resolution: float, year: int, output_dir: str, engine=None):
    """Step 3: Fetch PVGIS solar profiles."""
    logger.info("=" * 60)
    logger.info("STEP 3: Fetch PVGIS Solar Profiles")
    logger.info("=" * 60)

    from fetch_pvgis import (
        generate_grid,
        fetch_all_grid_profiles,
        assign_solar_to_plants,
        store_hourly_profiles,
    )

    grid = generate_grid(resolution=grid_resolution)
    profiles = fetch_all_grid_profiles(
        grid,
        output_dir=output_dir,
        year=year,
    )
    logger.info("Fetched %d grid cell profiles.", len(profiles))

    if engine is not None:
        assign_solar_to_plants(profiles, engine=engine)
        # Skip hourly storage in pipeline mode by default (very large)
        logger.info("Skipping hourly profile storage in pipeline mode (use fetch_pvgis.py directly for this).")

    return profiles


def step_load_costs(engine):
    """Step 4: Load cost assumptions."""
    logger.info("=" * 60)
    logger.info("STEP 4: Load Cost Assumptions")
    logger.info("=" * 60)

    from load_costs import load_cost_assumptions, log_summary

    count = load_cost_assumptions(engine=engine)
    logger.info("Loaded %d cost scenarios.", count)
    log_summary(engine=engine)
    return count


def step_spatial_join(engine, radius_km: float = 80):
    """Step 5: Load data centers and run spatial join."""
    logger.info("=" * 60)
    logger.info("STEP 5: Load Data Centers & Spatial Join")
    logger.info("=" * 60)

    from spatial_join import load_data_centers, run_spatial_join, log_summary

    dc_count = load_data_centers(engine=engine)
    logger.info("Loaded %d data centers.", dc_count)

    updated = run_spatial_join(engine=engine, radius_km=radius_km)
    logger.info("Updated nearby_dc_count for %d plants.", updated)

    log_summary(engine=engine)
    return updated


def step_compute_lcoe(engine, scenario: str = "base"):
    """Step 6: Compute LCOE estimates."""
    logger.info("=" * 60)
    logger.info("STEP 6: Compute LCOE Estimates (scenario=%s)", scenario)
    logger.info("=" * 60)

    from compute_lcoe import compute_all_lcoe, log_summary

    updated = compute_all_lcoe(engine=engine, scenario=scenario)
    logger.info("Computed LCOE for %d plants.", updated)

    log_summary(engine=engine)
    return updated


# ---------------------------------------------------------------------------
# Final summary
# ---------------------------------------------------------------------------


def print_final_summary(engine):
    """Print a comprehensive summary of the pipeline results."""
    logger.info("=" * 70)
    logger.info("PIPELINE COMPLETE - FINAL SUMMARY")
    logger.info("=" * 70)

    with engine.connect() as conn:
        total_plants = conn.execute(text("SELECT COUNT(*) FROM gas_plants")).scalar()
        total_mw = conn.execute(
            text("SELECT COALESCE(SUM(nameplate_capacity_mw), 0) FROM gas_plants")
        ).scalar()
        total_gen = conn.execute(
            text("SELECT COALESCE(SUM(annual_gen_mwh), 0) FROM gas_plants")
        ).scalar()
        avg_cf = conn.execute(
            text("SELECT AVG(capacity_factor) FROM gas_plants WHERE capacity_factor IS NOT NULL")
        ).scalar()
        plants_with_solar = conn.execute(
            text("SELECT COUNT(*) FROM gas_plants WHERE solar_cf IS NOT NULL")
        ).scalar()
        plants_near_dc = conn.execute(
            text("SELECT COUNT(*) FROM gas_plants WHERE nearby_dc_count > 0")
        ).scalar()
        plants_with_lcoe = conn.execute(
            text("SELECT COUNT(*) FROM gas_plants WHERE lcoe_gas_only IS NOT NULL")
        ).scalar()
        hybrid_wins = conn.execute(
            text(
                """
                SELECT COUNT(*) FROM gas_plants
                WHERE lcoe_hybrid IS NOT NULL AND lcoe_gas_only IS NOT NULL
                AND lcoe_hybrid < lcoe_gas_only
                """
            )
        ).scalar()
        avg_gas_lcoe = conn.execute(
            text("SELECT AVG(lcoe_gas_only) FROM gas_plants WHERE lcoe_gas_only IS NOT NULL")
        ).scalar()
        avg_hybrid_lcoe = conn.execute(
            text("SELECT AVG(lcoe_hybrid) FROM gas_plants WHERE lcoe_hybrid IS NOT NULL")
        ).scalar()

        # Top states
        top_states = conn.execute(
            text(
                """
                SELECT state, COUNT(*) AS cnt, SUM(nameplate_capacity_mw) AS mw
                FROM gas_plants
                GROUP BY state
                ORDER BY mw DESC
                LIMIT 10
                """
            )
        ).fetchall()

        # Data center stats
        dc_count = 0
        try:
            dc_count = conn.execute(text("SELECT COUNT(*) FROM data_centers")).scalar()
        except Exception:
            pass

        # Cost scenarios
        scenarios = []
        try:
            scenarios = conn.execute(
                text("SELECT scenario_name, solar_capex_per_kw, crf FROM cost_assumptions ORDER BY scenario_name")
            ).fetchall()
        except Exception:
            pass

    print(f"\n{'='*70}")
    print("PowerCouple Pipeline - Final Summary")
    print(f"{'='*70}")
    print(f"\nGas Plants:")
    print(f"  Total plants:              {total_plants:,}")
    print(f"  Total nameplate capacity:  {total_mw:,.0f} MW")
    print(f"  Total annual generation:   {total_gen:,.0f} MWh")
    print(f"  Average capacity factor:   {avg_cf:.3f}" if avg_cf else "  Average capacity factor:   N/A")

    print(f"\nSolar Analysis:")
    print(f"  Plants with solar CF:      {plants_with_solar:,}")

    print(f"\nData Center Proximity:")
    print(f"  Data centers loaded:       {dc_count:,}")
    print(f"  Plants near data centers:  {plants_near_dc:,}")

    print(f"\nLCOE Analysis:")
    print(f"  Plants with LCOE:          {plants_with_lcoe:,}")
    if avg_gas_lcoe:
        print(f"  Avg gas-only LCOE:         ${avg_gas_lcoe:,.1f}/MWh")
    if avg_hybrid_lcoe:
        print(f"  Avg hybrid LCOE:           ${avg_hybrid_lcoe:,.1f}/MWh")
    print(f"  Plants where hybrid wins:  {hybrid_wins:,}")

    if scenarios:
        print(f"\nCost Scenarios Loaded:")
        for name, capex, crf in scenarios:
            print(f"  {name}: solar CAPEX=${capex}/kW, CRF={crf:.3f}")

    print(f"\nTop States by Capacity:")
    for state, cnt, mw in top_states:
        print(f"  {state}: {cnt} plants, {mw:,.0f} MW")

    print(f"\n{'='*70}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Run the full PowerCouple EIA data pipeline."
    )

    # Data parameters
    parser.add_argument("--year", type=int, default=2023, help="EIA data year (default: 2023)")
    parser.add_argument("--gas-price", type=float, default=3.50, help="Gas price $/MMBtu (default: 3.50)")
    parser.add_argument("--output-dir", type=str, default="data/raw", help="Output directory for raw files")
    parser.add_argument("--solar-dir", type=str, default="data/raw/solar", help="Output directory for solar profiles")
    parser.add_argument("--grid-resolution", type=float, default=0.5, help="PVGIS grid resolution in degrees")
    parser.add_argument("--scenario", type=str, default="base", help="Cost scenario for LCOE computation")
    parser.add_argument("--radius-km", type=float, default=80, help="Spatial join radius in km")

    # Skip flags
    parser.add_argument("--skip-download", action="store_true", help="Skip EIA data download (use existing CSV)")
    parser.add_argument("--skip-load-plants", action="store_true", help="Skip loading plants into database")
    parser.add_argument("--skip-solar", action="store_true", help="Skip PVGIS solar profile fetch")
    parser.add_argument("--skip-costs", action="store_true", help="Skip loading cost assumptions")
    parser.add_argument("--skip-spatial", action="store_true", help="Skip data center load and spatial join")
    parser.add_argument("--skip-lcoe", action="store_true", help="Skip LCOE computation")

    # CSV override
    parser.add_argument("--csv", type=str, help="Path to pre-existing plant CSV (skips download)")

    args = parser.parse_args()

    # Set up DB engine
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL environment variable is not set.")
        sys.exit(1)

    engine = create_engine(database_url)

    start_time = time.time()

    # ---- Step 1: Download EIA data ----
    df = None
    if not args.skip_download:
        if args.csv:
            import pandas as pd
            logger.info("Loading plants from CSV: %s", args.csv)
            df = pd.read_csv(args.csv)
        else:
            df = step_download_eia(
                year=args.year,
                output_dir=args.output_dir,
                gas_price=args.gas_price,
            )
    else:
        logger.info("Skipping Step 1: EIA data download")
        # Try to load from existing CSV
        csv_path = Path(args.output_dir) / f"gas_plants_{args.year}.csv"
        if csv_path.exists():
            import pandas as pd
            df = pd.read_csv(csv_path)
            logger.info("Loaded %d plants from existing CSV: %s", len(df), csv_path)

    # ---- Step 2: Load plants ----
    if not args.skip_load_plants:
        if df is not None:
            step_load_plants(df, engine)
        else:
            logger.warning("No plant DataFrame available; skipping plant load.")
    else:
        logger.info("Skipping Step 2: Load plants")

    # ---- Step 3: Fetch PVGIS solar profiles ----
    if not args.skip_solar:
        step_fetch_pvgis(
            grid_resolution=args.grid_resolution,
            year=2020,
            output_dir=args.solar_dir,
            engine=engine,
        )
    else:
        logger.info("Skipping Step 3: PVGIS solar profiles")

    # ---- Step 4: Load cost assumptions ----
    if not args.skip_costs:
        step_load_costs(engine)
    else:
        logger.info("Skipping Step 4: Cost assumptions")

    # ---- Step 5: Spatial join ----
    if not args.skip_spatial:
        step_spatial_join(engine, radius_km=args.radius_km)
    else:
        logger.info("Skipping Step 5: Spatial join")

    # ---- Step 6: Compute LCOE ----
    if not args.skip_lcoe:
        step_compute_lcoe(engine, scenario=args.scenario)
    else:
        logger.info("Skipping Step 6: LCOE computation")

    # ---- Final summary ----
    elapsed = time.time() - start_time
    print_final_summary(engine)

    logger.info("Pipeline completed in %.1f seconds.", elapsed)


if __name__ == "__main__":
    main()
