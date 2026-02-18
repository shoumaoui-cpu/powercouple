#!/usr/bin/env python3
"""
download_eia.py - Download and process EIA-860 and EIA-923 data files.

Downloads generator (EIA-860) and generation/fuel (EIA-923) datasets from the
US Energy Information Administration, filters for natural gas plants, computes
capacity factors and variable costs, and produces a merged plant-level DataFrame.
"""

import argparse
import io
import logging
import os
import sys
import time
import zipfile
from pathlib import Path

import pandas as pd
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("download_eia")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

EIA_860_URL_TEMPLATE = (
    "https://www.eia.gov/electricity/data/eia860/xls/eia860{year}.zip"
)
EIA_923_URL_TEMPLATE = (
    "https://www.eia.gov/electricity/data/eia923/xls/f923_{year}.zip"
)

# Natural-gas prime movers we care about
NG_PRIME_MOVERS = {"CT", "CA", "CS", "CC", "ST", "GT", "IC"}

# EIA-860 columns we want (names may have slight variations by year)
EIA860_COLUMNS_MAP = {
    "Plant Code": "plant_code",
    "Plant Name": "plant_name",
    "Operator Name": "operator_name",
    "State": "state",
    "County": "county",
    "Latitude": "latitude",
    "Longitude": "longitude",
    "Nameplate Capacity (MW)": "nameplate_capacity_mw",
    "Summer Capacity (MW)": "summer_capacity_mw",
    "Winter Capacity (MW)": "winter_capacity_mw",
    "Prime Mover": "prime_mover",
    "Operating Status": "operating_status",
    "NERC Region": "nerc_region",
    "Balancing Authority Code": "balancing_authority_code",
    "Energy Source 1": "energy_source_1",
}

# CT-class vs CCGT-class prime movers
CT_MOVERS = {"CT", "GT", "IC"}
CCGT_MOVERS = {"CA", "CS", "CC", "ST"}

# Default gas price in $/MMBtu
DEFAULT_GAS_PRICE = 3.50


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _download_with_retries(url: str, retries: int = 3, backoff: float = 5.0) -> bytes:
    """Download a URL with retry logic. Returns raw bytes."""
    for attempt in range(1, retries + 1):
        try:
            logger.info("Downloading %s (attempt %d/%d)", url, attempt, retries)
            resp = requests.get(url, timeout=120)
            resp.raise_for_status()
            logger.info("Downloaded %.1f MB", len(resp.content) / 1e6)
            return resp.content
        except requests.RequestException as exc:
            logger.warning("Attempt %d failed: %s", attempt, exc)
            if attempt < retries:
                time.sleep(backoff * attempt)
            else:
                raise RuntimeError(
                    f"Failed to download {url} after {retries} attempts"
                ) from exc


def _save_zip(data: bytes, dest: Path) -> Path:
    """Persist raw ZIP bytes to disk."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    logger.info("Saved ZIP to %s", dest)
    return dest


def _find_sheet(zip_bytes: bytes, pattern: str) -> tuple[str, str]:
    """Return (filename_inside_zip, sheet_name) matching *pattern* (case-insensitive)."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            if name.endswith(".xlsx") or name.endswith(".xls"):
                try:
                    with zf.open(name) as f:
                        xls = pd.ExcelFile(io.BytesIO(f.read()), engine="openpyxl")
                        for sheet in xls.sheet_names:
                            if pattern.lower() in sheet.lower():
                                return name, sheet
                except Exception:
                    continue
    raise FileNotFoundError(f"No sheet matching '{pattern}' found in ZIP archive")


# ---------------------------------------------------------------------------
# EIA-860 processing
# ---------------------------------------------------------------------------


def process_eia860(zip_bytes: bytes, year: int) -> pd.DataFrame:
    """Extract natural-gas generator records from EIA-860 ZIP bytes."""
    pattern = f"Generator_Y{year}"
    # Fall back to broader pattern if year-specific not found
    try:
        fname, sheet = _find_sheet(zip_bytes, pattern)
    except FileNotFoundError:
        fname, sheet = _find_sheet(zip_bytes, "Generator")

    logger.info("Reading EIA-860 sheet '%s' from '%s'", sheet, fname)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        with zf.open(fname) as f:
            df = pd.read_excel(
                io.BytesIO(f.read()),
                sheet_name=sheet,
                header=1,  # header row is typically row 2
                engine="openpyxl",
            )

    logger.info("Raw EIA-860 rows: %d, columns: %d", len(df), len(df.columns))

    # Normalise column names (strip whitespace)
    df.columns = df.columns.str.strip()

    # Filter: natural gas, relevant prime movers, operating
    mask_ng = df["Energy Source 1"].astype(str).str.upper() == "NG"
    mask_pm = df["Prime Mover"].astype(str).str.upper().isin(NG_PRIME_MOVERS)
    mask_op = df["Operating Status"].astype(str).str.upper() == "OP"
    df = df.loc[mask_ng & mask_pm & mask_op].copy()
    logger.info("After filtering: %d generators", len(df))

    # Keep and rename relevant columns
    available = {c: v for c, v in EIA860_COLUMNS_MAP.items() if c in df.columns}
    df = df[list(available.keys())].rename(columns=available)

    # Coerce numeric columns
    for col in [
        "nameplate_capacity_mw",
        "summer_capacity_mw",
        "winter_capacity_mw",
        "latitude",
        "longitude",
    ]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df["plant_code"] = df["plant_code"].astype(int)
    df["prime_mover"] = df["prime_mover"].str.upper()

    return df


# ---------------------------------------------------------------------------
# EIA-923 processing
# ---------------------------------------------------------------------------


def process_eia923(zip_bytes: bytes, year: int) -> pd.DataFrame:
    """Extract natural-gas generation data from EIA-923 ZIP bytes."""
    try:
        fname, sheet = _find_sheet(zip_bytes, "Page 1 Generation and Fuel")
    except FileNotFoundError:
        fname, sheet = _find_sheet(zip_bytes, "Generation and Fuel")

    logger.info("Reading EIA-923 sheet '%s' from '%s'", sheet, fname)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        with zf.open(fname) as f:
            df = pd.read_excel(
                io.BytesIO(f.read()),
                sheet_name=sheet,
                header=5,  # typical header row for EIA-923
                engine="openpyxl",
            )

    logger.info("Raw EIA-923 rows: %d", len(df))
    df.columns = df.columns.str.strip()

    # Identify key columns (naming varies slightly by year)
    fuel_col = None
    for candidate in [
        "Reported Fuel Type Code",
        "Reported\nFuel Type Code",
        "AER Fuel Type Code",
        "FUEL_TYPE",
    ]:
        if candidate in df.columns:
            fuel_col = candidate
            break
    if fuel_col is None:
        raise KeyError("Cannot find fuel type column in EIA-923 data")

    plant_code_col = None
    for candidate in ["Plant Id", "Plant ID", "PLANT_ID", "Plant Code"]:
        if candidate in df.columns:
            plant_code_col = candidate
            break
    if plant_code_col is None:
        raise KeyError("Cannot find Plant ID column in EIA-923 data")

    # Net generation columns (monthly or total)
    net_gen_cols = [c for c in df.columns if "Net Generation" in str(c)]
    # Elec fuel consumption columns (MMBtu)
    fuel_cols = [
        c
        for c in df.columns
        if "Elec Fuel Consumption MMBtu" in str(c)
        or "ELEC_FUEL_CONSUMPTION_MMBTU" in str(c)
        or "Total Fuel Consumption\nMMBtu" in str(c)
        or "Elec_Fuel_Consumption_MMBtu" in str(c)
    ]

    # Also look for individual month MMBtu columns
    if not fuel_cols:
        fuel_cols = [
            c
            for c in df.columns
            if "MMBtu" in str(c) and "Elec" in str(c)
        ]

    # Filter for natural gas
    mask_ng = df[fuel_col].astype(str).str.upper() == "NG"
    df = df.loc[mask_ng].copy()

    df["plant_code"] = pd.to_numeric(df[plant_code_col], errors="coerce").astype(
        "Int64"
    )

    # Compute total net generation per row
    for col in net_gen_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["net_gen_mwh"] = df[net_gen_cols].sum(axis=1)

    # Compute total fuel consumption per row
    for col in fuel_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["fuel_mmbtu"] = df[fuel_cols].sum(axis=1) if fuel_cols else 0

    # Aggregate by plant code
    agg = (
        df.groupby("plant_code", dropna=True)
        .agg(annual_gen_mwh=("net_gen_mwh", "sum"), total_fuel_mmbtu=("fuel_mmbtu", "sum"))
        .reset_index()
    )

    # Heat rate: BTU/kWh = (MMBtu * 1000) / MWh  (since 1 MWh = 1000 kWh, 1 MMBtu = 1e6 BTU)
    # heat_rate = total_fuel_mmbtu * 1000 / annual_gen_mwh
    agg["heat_rate_btu_kwh"] = (agg["total_fuel_mmbtu"] * 1000).div(
        agg["annual_gen_mwh"].replace(0, float("nan"))
    )

    logger.info("EIA-923 aggregated: %d plants", len(agg))
    return agg[["plant_code", "annual_gen_mwh", "heat_rate_btu_kwh"]]


# ---------------------------------------------------------------------------
# Merge and plant-level rollup
# ---------------------------------------------------------------------------


def merge_and_compute(
    eia860: pd.DataFrame,
    eia923: pd.DataFrame,
    gas_price: float = DEFAULT_GAS_PRICE,
) -> pd.DataFrame:
    """Join EIA-860 generators with EIA-923 generation, compute metrics, and
    roll up to plant level."""

    # Merge on plant_code (left join so we keep all 860 plants even without 923 data)
    merged = eia860.merge(eia923, on="plant_code", how="left")

    # Per-generator capacity factor
    merged["capacity_factor"] = merged["annual_gen_mwh"] / (
        merged["nameplate_capacity_mw"] * 8760
    )
    merged["capacity_factor"] = merged["capacity_factor"].clip(0, 1)

    # Variable cost = heat_rate (BTU/kWh) * gas_price ($/MMBtu) / 1000
    merged["variable_cost"] = merged["heat_rate_btu_kwh"] * gas_price / 1000

    # Classify generator type
    merged["is_ct"] = merged["prime_mover"].isin(CT_MOVERS)
    merged["is_ccgt"] = merged["prime_mover"].isin(CCGT_MOVERS)

    # ---- Plant-level aggregation ----
    def _weighted_avg(group, val_col, weight_col):
        vals = group[val_col].fillna(0)
        weights = group[weight_col].fillna(0)
        total_w = weights.sum()
        if total_w == 0:
            return float("nan")
        return (vals * weights).sum() / total_w

    plants = []
    for plant_code, grp in merged.groupby("plant_code"):
        row = {
            "plant_code": int(plant_code),
            "plant_name": grp["plant_name"].iloc[0],
            "operator_name": grp.get("operator_name", pd.Series([None])).iloc[0],
            "state": grp["state"].iloc[0],
            "county": grp["county"].iloc[0] if "county" in grp.columns else None,
            "latitude": grp["latitude"].iloc[0],
            "longitude": grp["longitude"].iloc[0],
            "nerc_region": grp["nerc_region"].iloc[0]
            if "nerc_region" in grp.columns
            else None,
            "balancing_authority_code": grp["balancing_authority_code"].iloc[0]
            if "balancing_authority_code" in grp.columns
            else None,
            # Capacity sums
            "nameplate_capacity_mw": grp["nameplate_capacity_mw"].sum(),
            "summer_capacity_mw": grp["summer_capacity_mw"].sum(),
            "winter_capacity_mw": grp["winter_capacity_mw"].sum(),
            "ct_capacity_mw": grp.loc[grp["is_ct"], "nameplate_capacity_mw"].sum(),
            "ccgt_capacity_mw": grp.loc[grp["is_ccgt"], "nameplate_capacity_mw"].sum(),
            # Generation
            "annual_gen_mwh": grp["annual_gen_mwh"].iloc[0]
            if "annual_gen_mwh" in grp.columns
            else float("nan"),
            # Weighted average heat rate
            "heat_rate_btu_kwh": _weighted_avg(
                grp, "heat_rate_btu_kwh", "nameplate_capacity_mw"
            ),
            # Weighted average capacity factor
            "capacity_factor": _weighted_avg(
                grp, "capacity_factor", "nameplate_capacity_mw"
            ),
            # CT-specific CF
            "ct_capacity_factor": _weighted_avg(
                grp.loc[grp["is_ct"]],
                "capacity_factor",
                "nameplate_capacity_mw",
            )
            if grp["is_ct"].any()
            else float("nan"),
            # CCGT-specific CF
            "ccgt_capacity_factor": _weighted_avg(
                grp.loc[grp["is_ccgt"]],
                "capacity_factor",
                "nameplate_capacity_mw",
            )
            if grp["is_ccgt"].any()
            else float("nan"),
            # Variable costs (CT vs CCGT can differ)
            "variable_cost_ct": _weighted_avg(
                grp.loc[grp["is_ct"]],
                "variable_cost",
                "nameplate_capacity_mw",
            )
            if grp["is_ct"].any()
            else float("nan"),
            "variable_cost_ccgt": _weighted_avg(
                grp.loc[grp["is_ccgt"]],
                "variable_cost",
                "nameplate_capacity_mw",
            )
            if grp["is_ccgt"].any()
            else float("nan"),
            # Dominant prime mover (by capacity)
            "prime_mover": grp.groupby("prime_mover")["nameplate_capacity_mw"]
            .sum()
            .idxmax(),
            "operating_status": "OP",
        }
        plants.append(row)

    result = pd.DataFrame(plants)
    logger.info(
        "Plant-level rollup: %d plants, %.0f MW total nameplate capacity",
        len(result),
        result["nameplate_capacity_mw"].sum(),
    )
    return result


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def download_and_process(
    year: int = 2023,
    output_dir: str = "data/raw",
    gas_price: float = DEFAULT_GAS_PRICE,
    save_csv: bool = True,
) -> pd.DataFrame:
    """Full pipeline: download, extract, filter, merge, compute, save."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # ---- Download EIA-860 ----
    eia860_url = EIA_860_URL_TEMPLATE.format(year=year)
    eia860_zip = _download_with_retries(eia860_url)
    _save_zip(eia860_zip, output_path / f"eia860_{year}.zip")

    # ---- Download EIA-923 ----
    eia923_url = EIA_923_URL_TEMPLATE.format(year=year)
    eia923_zip = _download_with_retries(eia923_url)
    _save_zip(eia923_zip, output_path / f"eia923_{year}.zip")

    # ---- Process ----
    df_860 = process_eia860(eia860_zip, year)
    df_923 = process_eia923(eia923_zip, year)
    result = merge_and_compute(df_860, df_923, gas_price=gas_price)

    # Tag source years
    result["eia_860_year"] = year
    result["eia_923_year"] = year

    # ---- Save ----
    if save_csv:
        csv_path = output_path / f"gas_plants_{year}.csv"
        result.to_csv(csv_path, index=False)
        logger.info("Saved %d plants to %s", len(result), csv_path)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Download and process EIA-860/923 data for natural gas plants."
    )
    parser.add_argument(
        "--year",
        type=int,
        default=2023,
        help="Data year to download (default: 2023)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/raw",
        help="Directory to save downloaded/processed files (default: data/raw)",
    )
    parser.add_argument(
        "--gas-price",
        type=float,
        default=DEFAULT_GAS_PRICE,
        help=f"Natural gas price in $/MMBtu (default: {DEFAULT_GAS_PRICE})",
    )
    parser.add_argument(
        "--no-csv",
        action="store_true",
        help="Skip saving output to CSV",
    )
    args = parser.parse_args()

    df = download_and_process(
        year=args.year,
        output_dir=args.output_dir,
        gas_price=args.gas_price,
        save_csv=not args.no_csv,
    )

    # Print summary
    print(f"\n{'='*60}")
    print(f"EIA Data Download Summary (Year: {args.year})")
    print(f"{'='*60}")
    print(f"Total plants:          {len(df)}")
    print(f"Total nameplate (MW):  {df['nameplate_capacity_mw'].sum():,.0f}")
    print(f"Total annual gen (MWh):{df['annual_gen_mwh'].sum():,.0f}")
    print(f"Avg capacity factor:   {df['capacity_factor'].mean():.3f}")
    print(f"Avg heat rate (BTU/kWh): {df['heat_rate_btu_kwh'].mean():,.0f}")
    print(f"\nPlants by state (top 10):")
    state_counts = df.groupby("state")["nameplate_capacity_mw"].sum().sort_values(
        ascending=False
    )
    for state, mw in state_counts.head(10).items():
        print(f"  {state}: {mw:,.0f} MW")
    print(f"{'='*60}\n")

    return df


if __name__ == "__main__":
    main()
