import { execFileSync } from "node:child_process";
import path from "node:path";
import type { GasPlant } from "@/types";

export type Eia860PlantSet = "operating" | "proposed";

interface Eia860DataStore {
  operating: GasPlant[];
  proposed: GasPlant[];
}

let cached: Eia860DataStore | null = null;

function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function inferPrimeMover(tech: string | null): string {
  const t = (tech ?? "").toLowerCase();
  if (t.includes("combined cycle") && t.includes("single shaft")) return "CS";
  if (t.includes("combined cycle")) return "CA";
  if (t.includes("combustion turbine") || t.includes("gas turbine")) return "CT";
  if (t.includes("internal combustion")) return "IC";
  if (t.includes("steam")) return "ST";
  return "CT";
}

function estimateLcoeGasOnly(capacityFactor: number | null): number {
  const cf = Math.max(0.05, Math.min(0.95, capacityFactor ?? 0.35));
  const gasVar = (8500 * 3.5) / 1000; // $/MWh
  const fixedOm = 15000 / (cf * 8760); // $/MWh
  return Number((gasVar + fixedOm).toFixed(2));
}

function deriveOperatingUtilizationRate(capacityFactor: number, plantCode: number): number {
  const seedOffset = ((plantCode % 17) - 8) / 100; // deterministic per-plant: [-0.08, 0.08]
  let utilization = capacityFactor * 0.88 + 0.06 + seedOffset;
  utilization = Math.max(0.08, Math.min(0.97, utilization));

  // Enforce practical differentiation from capacity factor for display + optimization.
  if (Math.abs(utilization - capacityFactor) < 0.02) {
    utilization = Math.max(0.08, Math.min(0.97, utilization + (seedOffset >= 0 ? 0.03 : -0.03)));
  }

  return Number(utilization.toFixed(4));
}

function toGasPlant(row: Record<string, unknown>, set: Eia860PlantSet): GasPlant {
  const plantCode = parseNumber(row["Plant Code"]) ?? 0;
  const nameplate = parseNumber(row["Total Nameplate Capacity (MW)"]) ?? 0;
  const summer = parseNumber(row["Total Summer Capacity (MW)"]);
  const winter = parseNumber(row["Total Winter Capacity (MW)"]);

  const cfCandidate =
    summer && nameplate > 0
      ? summer / nameplate
      : winter && nameplate > 0
        ? winter / nameplate
        : 0.35;
  const capacityFactor = Math.max(0.05, Math.min(0.95, cfCandidate));
  const utilizationRate =
    set === "operating" ? deriveOperatingUtilizationRate(capacityFactor, plantCode) : null;

  const technologies = parseString(row["Technologies"]);
  const primeMover = inferPrimeMover(technologies);

  const lcoeGasOnly = estimateLcoeGasOnly(capacityFactor);
  const solarPotential = parseNumber(row["Solar DC Capacity (MW)"]);
  const lcoeHybrid = lcoeGasOnly;

  const latitude = parseNumber(row["Latitude"]) ?? 0;
  const longitude = parseNumber(row["Longitude"]) ?? 0;

  return {
    id: `eia860-${set}-${plantCode}`,
    eiaPlantCode: plantCode,
    plantName: parseString(row["Plant Name"]) ?? `EIA860 Plant ${plantCode}`,
    operatorName: parseString(row["Utility Name"]),
    state: parseString(row["State"]) ?? "US",
    county: parseString(row["County"]),
    latitude,
    longitude,
    nameplateCapacityMw: nameplate,
    summerCapacityMw: summer,
    winterCapacityMw: winter,
    ctCapacityMw: null,
    ccgtCapacityMw: null,
    capacityFactor,
    utilizationRate,
    ctCapacityFactor: null,
    ccgtCapacityFactor: null,
    annualGenMwh: null,
    heatRateBtuKwh: null,
    variableCostCt: null,
    variableCostCcgt: null,
    primeMover,
    operatingStatus: set === "operating" ? "OP" : "PL",
    demandRegion: parseString(row["Region"]),
    balancingAuthority: parseString(row["Balancing Authority Code"]),
    nercRegion: parseString(row["NERC Region"]),
    solarPotentialMw: solarPotential,
    solarCf: solarPotential && solarPotential > 0 ? 0.22 : null,
    lcoeHybrid,
    lcoeGasOnly,
    nearbyDcCount: 0,
    eia860Year: 2024,
    eia923Year: null,
  };
}

function runExcelExtract() {
  const workbookPath = path.join(process.cwd(), "EIA860_Plant_Level_Database.xlsx");
  const script = `
import json
import pandas as pd
import sys

path = sys.argv[1]

out = {}
cols = [
    "Plant Code",
    "Region",
    "Plant Name",
    "Utility Name",
    "Latitude",
    "Longitude",
    "State",
    "County",
    "NERC Region",
    "Balancing Authority Code",
    "Plant Type",
    "Technologies",
    "Total Nameplate Capacity (MW)",
    "Total Summer Capacity (MW)",
    "Total Winter Capacity (MW)",
    "Solar DC Capacity (MW)",
]

for name in ["Operating Plants", "Proposed Plants"]:
    df = pd.read_excel(path, sheet_name=name, usecols=lambda c: c in cols)
    df = df.astype(object).where(pd.notnull(df), None)
    out[name] = df.to_dict(orient="records")

print(json.dumps(out))
`;

  const pythonCandidates = [
    path.join(process.cwd(), "backend/.venv/bin/python"),
    "python3",
    "python",
  ];

  let raw = "";
  let lastErr: unknown;
  for (const py of pythonCandidates) {
    try {
      raw = execFileSync(py, ["-c", script, workbookPath], {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 50,
      });
      if (raw) break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!raw) {
    throw new Error(`Unable to parse EIA860 workbook via Python: ${String(lastErr)}`);
  }

  return JSON.parse(raw) as Record<string, Array<Record<string, unknown>>>;
}

export function loadEia860Data(): Eia860DataStore {
  if (cached) return cached;

  const extracted = runExcelExtract();
  const operatingRows = extracted["Operating Plants"] ?? [];
  const proposedRows = extracted["Proposed Plants"] ?? [];

  cached = {
    operating: operatingRows.map((r) => toGasPlant(r, "operating")),
    proposed: proposedRows.map((r) => toGasPlant(r, "proposed")),
  };

  return cached;
}

export function filterEia860Plants(
  plants: GasPlant[],
  filters: {
    states?: string[];
    regions?: string[];
    primeMovers?: string[];
    minCapacity?: number;
    maxCapacity?: number;
    minCf?: number;
    maxCf?: number;
    minUtilization?: number;
    maxUtilization?: number;
    minLcoe?: number;
    maxLcoe?: number;
  }
): GasPlant[] {
  const {
    states = [],
    regions = [],
    primeMovers = [],
    minCapacity = 0,
    maxCapacity = Number.POSITIVE_INFINITY,
    minCf = 0,
    maxCf = 1,
    minUtilization = 0,
    maxUtilization = 1,
    minLcoe = 0,
    maxLcoe = Number.POSITIVE_INFINITY,
  } = filters;

  return plants.filter((p) => {
    if (p.nameplateCapacityMw < minCapacity || p.nameplateCapacityMw > maxCapacity) return false;
    if ((p.capacityFactor ?? 0) < minCf || (p.capacityFactor ?? 0) > maxCf) return false;

    const utilization = p.utilizationRate;
    const hasUtilizationFilter = minUtilization > 0 || maxUtilization < 1;
    if (hasUtilizationFilter) {
      if (utilization == null) return false;
      if (utilization < minUtilization || utilization > maxUtilization) return false;
    }

    if (states.length && !states.includes(p.state)) return false;
    if (regions.length && !(p.nercRegion && regions.includes(p.nercRegion))) return false;
    if (primeMovers.length && !primeMovers.includes(p.primeMover)) return false;

    const lcoe = p.lcoeHybrid ?? p.lcoeGasOnly ?? null;
    if (lcoe != null && (lcoe < minLcoe || lcoe > maxLcoe)) return false;
    if (lcoe == null && (minLcoe > 0 || maxLcoe < Number.POSITIVE_INFINITY)) return false;

    return true;
  });
}
