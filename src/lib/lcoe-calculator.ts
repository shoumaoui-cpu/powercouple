/**
 * Dynamic LCOE calculator for the comparison page.
 *
 * Recomputes gas-only and hybrid LCOE for each region under user-selected
 * scenario assumptions. This allows toggling:
 *   - Cost scenario (base / optimistic / conservative)
 *   - Gas price ($/MMBtu)
 *   - Commissioning year (affects solar+storage capex learning curve)
 *   - Max gas backup fraction (drives solar+battery sizing)
 *   - Solar ITC / PTC incentives
 *
 * The gas-only LCOE uses a simple heat-rate × fuel-price model plus
 * capital recovery and O&M. The hybrid LCOE uses the same client-side
 * optimizer logic to size solar + battery to meet the gas backup target.
 */

export interface ScenarioInputs {
  costScenario: "base" | "optimistic" | "conservative";
  gasPricePerMmbtu: number;
  commissioningYear: number;
  maxGasBackupPct: number;       // 0–1
  solarItcPct: number;           // 0–0.4 (e.g., 0.30 = 30% ITC)
  targetLoadMw: number;          // reference load for sizing
}

export interface RegionLcoeResult {
  region: string;
  gasOnlyLcoe: number;
  hybridLcoe: number;
  savings: number;
  savingsPct: number;
  solarSizeMw: number;
  batterySizeMwh: number;
  gridTariff: number | null;
  behindMeterSavings: number | null;   // vs grid tariff
  behindMeterSavingsPct: number | null;
}

// ── Cost learning curves ──────────────────────────────────────────
interface CostSet {
  solarCapexKw: number;
  battCapexKwh: number;
  battCapexKw: number;
  solarOmKwYr: number;
  battOmKwYr: number;
  wacc: number;
  battRte: number;
}

function getCostSet(scenario: string, year: number): CostSet {
  // Base year costs (2027) and annual decline rates
  const base: Record<string, { s: number; bKwh: number; bKw: number; sOm: number; bOm: number; wacc: number; rte: number }> = {
    base:         { s: 950,  bKwh: 250, bKw: 400, sOm: 17, bOm: 12, wacc: 0.075, rte: 0.85 },
    optimistic:   { s: 800,  bKwh: 200, bKw: 330, sOm: 15, bOm: 10, wacc: 0.065, rte: 0.87 },
    conservative: { s: 1100, bKwh: 310, bKw: 480, sOm: 20, bOm: 14, wacc: 0.085, rte: 0.84 },
  };

  const b = base[scenario] ?? base.base;
  const yearsFromBase = Math.max(0, year - 2027);

  // Annual learning rate: solar ~5%/yr, battery ~8%/yr
  const solarDecline = scenario === "optimistic" ? 0.06 : scenario === "conservative" ? 0.03 : 0.05;
  const battDecline = scenario === "optimistic" ? 0.10 : scenario === "conservative" ? 0.05 : 0.08;

  return {
    solarCapexKw: b.s * Math.pow(1 - solarDecline, yearsFromBase),
    battCapexKwh: b.bKwh * Math.pow(1 - battDecline, yearsFromBase),
    battCapexKw: b.bKw * Math.pow(1 - battDecline, yearsFromBase),
    solarOmKwYr: b.sOm,
    battOmKwYr: b.bOm,
    wacc: b.wacc,
    battRte: b.rte + yearsFromBase * 0.003, // slight RTE improvement over time
  };
}

function crf(wacc: number, n: number): number {
  return (wacc * Math.pow(1 + wacc, n)) / (Math.pow(1 + wacc, n) - 1);
}

// ── Regional average characteristics ──────────────────────────────
// Average heat rate, CF, and solar CF by ISO/RTO region
interface RegionCharacteristics {
  avgHeatRate: number;
  avgCf: number;
  avgSolarCf: number;
}

const REGION_CHARS: Record<string, RegionCharacteristics> = {
  ERCOT:  { avgHeatRate: 8200, avgCf: 0.33, avgSolarCf: 0.21 },
  PJM:    { avgHeatRate: 7800, avgCf: 0.34, avgSolarCf: 0.15 },
  CAISO:  { avgHeatRate: 7600, avgCf: 0.33, avgSolarCf: 0.22 },
  SERC:   { avgHeatRate: 7300, avgCf: 0.38, avgSolarCf: 0.17 },
  FRCC:   { avgHeatRate: 7100, avgCf: 0.46, avgSolarCf: 0.18 },
  "ISO-NE": { avgHeatRate: 7800, avgCf: 0.31, avgSolarCf: 0.15 },
  NYISO:  { avgHeatRate: 7400, avgCf: 0.38, avgSolarCf: 0.15 },
  MISO:   { avgHeatRate: 7800, avgCf: 0.30, avgSolarCf: 0.15 },
  SPP:    { avgHeatRate: 7500, avgCf: 0.34, avgSolarCf: 0.18 },
  SWPP:   { avgHeatRate: 7600, avgCf: 0.31, avgSolarCf: 0.26 },
  NWPP:   { avgHeatRate: 7600, avgCf: 0.35, avgSolarCf: 0.15 },
};

// ── Gas-only LCOE ─────────────────────────────────────────────────
function computeGasOnlyLcoe(
  heatRate: number,
  cf: number,
  gasPricePerMmbtu: number,
  wacc: number,
): number {
  const lifetime = 25;
  const annuity = crf(wacc, lifetime);
  const gasCapex = 900; // $/kW existing plant (maintenance capex)
  const fixedOm = 15;   // $/kW-yr
  const varOm = 3.5;    // $/MWh

  const fuelCost = (heatRate * gasPricePerMmbtu) / 1000; // $/MWh
  const capitalPerMwh = (gasCapex * annuity * 1000) / (cf * 8760);
  const fixedOmPerMwh = (fixedOm * 1000) / (cf * 8760);

  return capitalPerMwh + fuelCost + varOm + fixedOmPerMwh;
}

// ── Hybrid LCOE (simplified sizing heuristic) ─────────────────────
function computeHybridLcoe(
  heatRate: number,
  solarCf: number,
  gasPricePerMmbtu: number,
  maxGasBackupPct: number,
  costs: CostSet,
  solarItcPct: number,
  targetLoadMw: number,
): { lcoe: number; solarMw: number; battMwh: number } {
  const lifetime = 25;
  const annuity = crf(costs.wacc, lifetime);

  const gasFuelPerMwh = (heatRate * gasPricePerMmbtu) / 1000;
  const gasVarOm = 3.5;

  // Generate simplified solar profile for sizing
  // Peak solar hours roughly = solarCf * 24 (effective)
  const effectiveSolarHours = solarCf * 24;

  // Search over solar ratios and battery durations
  let bestLcoe = Infinity;
  let bestSolar = 0;
  let bestBattEnergy = 0;

  const solarRatios = [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.3, 2.5, 3.0, 3.5, 4.0];
  const battDurations = [0, 1, 2, 3, 4, 5, 6];

  for (const sr of solarRatios) {
    const solarMw = targetLoadMw * sr;

    for (const bd of battDurations) {
      const battPower = bd > 0 ? targetLoadMw * 0.8 : 0;
      const battEnergy = battPower * bd;

      // Estimate gas backup fraction
      // Solar covers: solarMw * solarCf / targetLoadMw of energy
      const solarFraction = Math.min((solarMw * solarCf) / targetLoadMw, 1);
      // Battery extends solar by storing excess and discharging at night
      const batteryExtension = battEnergy > 0
        ? Math.min((battEnergy * costs.battRte) / (targetLoadMw * (24 - effectiveSolarHours)), 0.3)
        : 0;

      const renewableFraction = Math.min(solarFraction + batteryExtension, 0.99);
      const gasFraction = 1 - renewableFraction;

      // Check gas backup constraint
      if (gasFraction > maxGasBackupPct * 1.05) continue;

      // Compute costs
      const solarCapexNet = costs.solarCapexKw * (1 - solarItcPct); // ITC reduces capex
      const solarCapAnnual = solarMw * 1000 * solarCapexNet * annuity;
      const solarOmAnnual = solarMw * 1000 * costs.solarOmKwYr;

      const battCapAnnual = battPower > 0
        ? (battPower * 1000 * costs.battCapexKw + battEnergy * 1000 * costs.battCapexKwh) * annuity
        : 0;
      const battOmAnnual = battPower > 0 ? battPower * 1000 * costs.battOmKwYr : 0;

      const gasEnergyAnnual = gasFraction * targetLoadMw * 8760;
      const gasFuelAnnual = gasEnergyAnnual * gasFuelPerMwh;
      const gasOmAnnual = gasEnergyAnnual * gasVarOm;

      const totalAnnual = solarCapAnnual + solarOmAnnual + battCapAnnual + battOmAnnual + gasFuelAnnual + gasOmAnnual;
      const annualEnergy = targetLoadMw * 8760;
      const lcoe = totalAnnual / annualEnergy;

      if (lcoe < bestLcoe) {
        bestLcoe = lcoe;
        bestSolar = solarMw;
        bestBattEnergy = battEnergy;
      }
    }
  }

  return { lcoe: bestLcoe, solarMw: bestSolar, battMwh: bestBattEnergy };
}

// ── Main entry point ──────────────────────────────────────────────
import { REGIONAL_TARIFFS } from "./tariffs";

export function computeRegionalLcoes(inputs: ScenarioInputs): RegionLcoeResult[] {
  const costs = getCostSet(inputs.costScenario, inputs.commissioningYear);

  return Object.entries(REGION_CHARS).map(([region, chars]) => {
    const gasOnly = computeGasOnlyLcoe(
      chars.avgHeatRate,
      chars.avgCf,
      inputs.gasPricePerMmbtu,
      costs.wacc,
    );

    const hybrid = computeHybridLcoe(
      chars.avgHeatRate,
      chars.avgSolarCf,
      inputs.gasPricePerMmbtu,
      inputs.maxGasBackupPct,
      costs,
      inputs.solarItcPct,
      inputs.targetLoadMw,
    );

    const savings = gasOnly - hybrid.lcoe;
    const savingsPct = gasOnly > 0 ? (savings / gasOnly) * 100 : 0;

    const tariff = REGIONAL_TARIFFS.find((t) => t.region === region);
    const gridRate = tariff?.allInRate ?? null;

    return {
      region,
      gasOnlyLcoe: Math.round(gasOnly * 10) / 10,
      hybridLcoe: Math.round(hybrid.lcoe * 10) / 10,
      savings: Math.round(savings * 10) / 10,
      savingsPct: Math.round(savingsPct * 10) / 10,
      solarSizeMw: Math.round(hybrid.solarMw * 10) / 10,
      batterySizeMwh: Math.round(hybrid.battMwh * 10) / 10,
      gridTariff: gridRate,
      behindMeterSavings: gridRate != null ? Math.round((gridRate - hybrid.lcoe) * 10) / 10 : null,
      behindMeterSavingsPct: gridRate != null && gridRate > 0
        ? Math.round(((gridRate - hybrid.lcoe) / gridRate) * 1000) / 10
        : null,
    };
  });
}
