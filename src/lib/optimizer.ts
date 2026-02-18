/**
 * Client-side hybrid optimization engine.
 * Implements a simplified version of the MILP model from Chojkiewicz et al. (2026)
 * using a heuristic approach (no LP solver needed).
 *
 * Uses 288 representative timesteps (12 months × 24 hours) to size:
 *   - Solar PV capacity (MW)
 *   - Battery storage power (MW) & energy (MWh)
 * Subject to:
 *   - Meeting target load every timestep
 *   - Gas backup ≤ maxGasBackupPct of total energy
 */

import type { GasPlant, OptimizationResult, LcoeBreakdown, DispatchHour } from "@/types";
import { DEFAULT_GAS_PRICE_PER_MMBTU } from "@/lib/constants";

// ── Cost parameters by scenario and year ──────────────────────────
interface CostParams {
  solarCapexPerKw: number;
  batteryCapexPerKwh: number;
  batteryCapexPerKw: number;
  solarOmPerKwYear: number;
  batteryOmPerKwYear: number;
  wacc: number;
  projectLifetimeYrs: number;
  batteryRte: number;
  inverterEff: number;
  maxBatteryDurationHrs: number;
}

const COST_DB: Record<string, Record<number, CostParams>> = {
  base: {
    2027: { solarCapexPerKw: 950, batteryCapexPerKwh: 250, batteryCapexPerKw: 400, solarOmPerKwYear: 17, batteryOmPerKwYear: 12, wacc: 0.075, projectLifetimeYrs: 25, batteryRte: 0.85, inverterEff: 0.96, maxBatteryDurationHrs: 6 },
    2028: { solarCapexPerKw: 912, batteryCapexPerKwh: 227, batteryCapexPerKw: 374, solarOmPerKwYear: 16.3, batteryOmPerKwYear: 11.3, wacc: 0.075, projectLifetimeYrs: 25, batteryRte: 0.86, inverterEff: 0.96, maxBatteryDurationHrs: 6 },
    2029: { solarCapexPerKw: 856, batteryCapexPerKwh: 204, batteryCapexPerKw: 347, solarOmPerKwYear: 15.7, batteryOmPerKwYear: 10.7, wacc: 0.075, projectLifetimeYrs: 25, batteryRte: 0.86, inverterEff: 0.96, maxBatteryDurationHrs: 6 },
    2030: { solarCapexPerKw: 800, batteryCapexPerKwh: 180, batteryCapexPerKw: 320, solarOmPerKwYear: 15, batteryOmPerKwYear: 10, wacc: 0.075, projectLifetimeYrs: 25, batteryRte: 0.87, inverterEff: 0.96, maxBatteryDurationHrs: 6 },
  },
  optimistic: {
    2027: { solarCapexPerKw: 800, batteryCapexPerKwh: 200, batteryCapexPerKw: 330, solarOmPerKwYear: 15, batteryOmPerKwYear: 10, wacc: 0.065, projectLifetimeYrs: 25, batteryRte: 0.87, inverterEff: 0.97, maxBatteryDurationHrs: 6 },
    2028: { solarCapexPerKw: 750, batteryCapexPerKwh: 180, batteryCapexPerKw: 305, solarOmPerKwYear: 14.3, batteryOmPerKwYear: 9.3, wacc: 0.065, projectLifetimeYrs: 25, batteryRte: 0.87, inverterEff: 0.97, maxBatteryDurationHrs: 6 },
    2029: { solarCapexPerKw: 700, batteryCapexPerKwh: 160, batteryCapexPerKw: 278, solarOmPerKwYear: 13.7, batteryOmPerKwYear: 8.7, wacc: 0.065, projectLifetimeYrs: 25, batteryRte: 0.88, inverterEff: 0.97, maxBatteryDurationHrs: 6 },
    2030: { solarCapexPerKw: 650, batteryCapexPerKwh: 140, batteryCapexPerKw: 250, solarOmPerKwYear: 13, batteryOmPerKwYear: 8, wacc: 0.065, projectLifetimeYrs: 25, batteryRte: 0.88, inverterEff: 0.97, maxBatteryDurationHrs: 6 },
  },
  conservative: {
    2027: { solarCapexPerKw: 1100, batteryCapexPerKwh: 310, batteryCapexPerKw: 480, solarOmPerKwYear: 20, batteryOmPerKwYear: 14, wacc: 0.085, projectLifetimeYrs: 25, batteryRte: 0.84, inverterEff: 0.95, maxBatteryDurationHrs: 6 },
    2028: { solarCapexPerKw: 1050, batteryCapexPerKwh: 284, batteryCapexPerKw: 453, solarOmPerKwYear: 19.3, batteryOmPerKwYear: 13.3, wacc: 0.085, projectLifetimeYrs: 25, batteryRte: 0.84, inverterEff: 0.95, maxBatteryDurationHrs: 6 },
    2029: { solarCapexPerKw: 1000, batteryCapexPerKwh: 257, batteryCapexPerKw: 427, solarOmPerKwYear: 18.7, batteryOmPerKwYear: 12.7, wacc: 0.085, projectLifetimeYrs: 25, batteryRte: 0.85, inverterEff: 0.95, maxBatteryDurationHrs: 6 },
    2030: { solarCapexPerKw: 950, batteryCapexPerKwh: 230, batteryCapexPerKw: 400, solarOmPerKwYear: 18, batteryOmPerKwYear: 12, wacc: 0.085, projectLifetimeYrs: 25, batteryRte: 0.85, inverterEff: 0.96, maxBatteryDurationHrs: 6 },
  },
};

function getCosts(scenario: string, year: number): CostParams {
  const scenarioDB = COST_DB[scenario] ?? COST_DB.base;
  // Find the closest year
  const years = Object.keys(scenarioDB).map(Number).sort();
  let bestYear = years[0];
  for (const y of years) {
    if (Math.abs(y - year) < Math.abs(bestYear - year)) bestYear = y;
  }
  return scenarioDB[bestYear];
}

function crf(wacc: number, n: number): number {
  return (wacc * Math.pow(1 + wacc, n)) / (Math.pow(1 + wacc, n) - 1);
}

// ── Generate representative solar profile (12 months × 24 hours) ──
// Uses latitude-based model to simulate typical PV output
function generateSolarProfile(latitude: number, solarCf: number | null): number[] {
  const cf = solarCf ?? 0.18;
  // Ensure a reasonable minimum CF so we always get some solar output
  const effectiveCf = Math.max(cf, 0.12);
  const profile: number[] = [];

  // Clamp latitude to avoid extreme edge cases with trig
  const clampedLat = Math.max(-60, Math.min(60, latitude));

  for (let month = 0; month < 12; month++) {
    // Day length varies by latitude and month
    const declination = 23.45 * Math.sin(((2 * Math.PI) / 365) * (284 + (month * 30 + 15)));
    const latRad = (clampedLat * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;

    // Clamp the hour angle calculation to avoid NaN from acos
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
    const clampedCos = Math.max(-0.99, Math.min(0.99, cosHourAngle));
    const hourAngle = Math.acos(clampedCos);
    const dayLengthHours = (2 * hourAngle * 12) / Math.PI;

    const sunrise = 12 - dayLengthHours / 2;
    const sunset = 12 + dayLengthHours / 2;

    // Seasonal multiplier (summer months get more irradiance)
    // Northern hemisphere: June (month=5) is peak; Southern hemisphere: December (month=11)
    const peakMonth = clampedLat >= 0 ? 5 : 11;
    const seasonalFactor = 1 + 0.3 * Math.cos(((month - peakMonth) * Math.PI) / 6);

    for (let hour = 0; hour < 24; hour++) {
      if (hour < sunrise || hour > sunset) {
        profile.push(0);
      } else {
        // Bell curve peaking at solar noon
        const solarNoon = (sunrise + sunset) / 2;
        const halfDay = (sunset - sunrise) / 2;
        if (halfDay <= 0) {
          profile.push(0);
        } else {
          const normalized = (hour - solarNoon) / halfDay;
          const rawCf = Math.max(0, Math.cos((normalized * Math.PI) / 2)) * seasonalFactor;
          profile.push(rawCf);
        }
      }
    }
  }

  // Normalize so annual average equals target CF
  const avgRaw = profile.reduce((a, b) => a + b, 0) / profile.length;
  const scale = avgRaw > 0 ? effectiveCf / avgRaw : 0;
  return profile.map((v) => Math.min(v * scale, 1));
}

// ── Dispatch simulation for a given solar/battery configuration ──
interface DispatchResult {
  totalGasEnergy: number;
  totalSolarCurtailed: number;
  dispatch: { solar: number; battery: number; gas: number; soc: number }[];
  gasFraction: number;
}

function simulateDispatch(
  solarMw: number,
  battPower: number,
  battEnergy: number,
  targetLoadMw: number,
  solarProfile: number[],
  costs: CostParams,
): DispatchResult {
  const T = solarProfile.length;
  let totalGasEnergy = 0;
  let totalSolarCurtailed = 0;
  let soc = battEnergy * 0.5; // start half-charged
  const dispatch: { solar: number; battery: number; gas: number; soc: number }[] = [];

  for (let t = 0; t < T; t++) {
    const solarGen = solarMw * solarProfile[t] * costs.inverterEff;
    let residual = targetLoadMw - solarGen;

    let batteryDischarge = 0;
    let batteryCharge = 0;
    let gasGen = 0;
    const solarToLoad = Math.min(solarGen, targetLoadMw);
    let curtailed = 0;

    if (residual <= 0) {
      // Excess solar — charge battery
      const excess = -residual;
      const maxCharge = battEnergy > 0 ? Math.min(excess, battPower, (battEnergy - soc) / costs.batteryRte) : 0;
      batteryCharge = Math.max(0, maxCharge);
      curtailed = excess - batteryCharge;
      totalSolarCurtailed += curtailed;
      soc = Math.min(soc + batteryCharge * costs.batteryRte, battEnergy);
      residual = 0;
    } else {
      // Need more power — discharge battery, then gas
      if (battPower > 0 && soc > 0) {
        batteryDischarge = Math.min(residual, battPower, soc);
        soc -= batteryDischarge;
        residual -= batteryDischarge;
      }

      if (residual > 0.001) {
        gasGen = residual;
        totalGasEnergy += gasGen;
      }
    }

    dispatch.push({
      solar: solarToLoad,
      battery: batteryDischarge - batteryCharge,
      gas: gasGen,
      soc,
    });
  }

  const gasFraction = totalGasEnergy / (targetLoadMw * T);

  return { totalGasEnergy, totalSolarCurtailed, dispatch, gasFraction };
}

// ── Compute LCOE for a given configuration ──
function computeConfigLcoe(
  solarMw: number,
  battPower: number,
  battEnergy: number,
  totalGasEnergy: number,
  targetLoadMw: number,
  costs: CostParams,
  gasFuelCost: number,
  annuity: number,
): number {
  // Solar costs
  const solarCapitalAnnual = solarMw * 1000 * costs.solarCapexPerKw * annuity;
  const solarOmAnnual = solarMw * 1000 * costs.solarOmPerKwYear;

  // Battery costs
  const battCapitalAnnual = battPower > 0
    ? (battPower * 1000 * costs.batteryCapexPerKw + battEnergy * 1000 * costs.batteryCapexPerKwh) * annuity
    : 0;
  const battOmAnnual = battPower > 0 ? battPower * 1000 * costs.batteryOmPerKwYear : 0;

  // Gas fuel cost (annualized from representative hours)
  // Each representative hour represents 365/12 ≈ 30.4 days
  const hoursPerRep = 365 / 12;
  const annualGasEnergy = totalGasEnergy * hoursPerRep;
  const gasFuelAnnual = annualGasEnergy * gasFuelCost;
  const gasOmAnnual = annualGasEnergy * 3.5; // variable O&M

  const totalAnnualCost = solarCapitalAnnual + solarOmAnnual + battCapitalAnnual + battOmAnnual + gasFuelAnnual + gasOmAnnual;
  const annualEnergyMwh = targetLoadMw * 8760;
  return totalAnnualCost / annualEnergyMwh;
}

// ── Main optimization function ────────────────────────────────────
export interface OptimizeParams {
  plant: GasPlant;
  targetLoadMw: number;
  maxGasBackupPct: number; // 0-1
  commissioningYear: number;
  costScenario: string;
}

export function runClientOptimization(params: OptimizeParams): OptimizationResult {
  const { plant, targetLoadMw, maxGasBackupPct, commissioningYear, costScenario } = params;
  const costs = getCosts(costScenario, commissioningYear);
  const annuity = crf(costs.wacc, costs.projectLifetimeYrs);

  // Generate 288 representative hours (12×24)
  const solarProfile = generateSolarProfile(plant.latitude, plant.solarCf);
  const T = solarProfile.length; // 288

  const gasPrice = DEFAULT_GAS_PRICE_PER_MMBTU;
  const heatRate = plant.heatRateBtuKwh ?? 9000;
  const gasFuelCost = (heatRate * gasPrice) / 1000; // $/MWh

  // ── Heuristic sizing via iterative search ──
  // Extended search grid to handle plants with varying solar resources and load profiles.
  // For plants requiring very low gas backup, we need larger solar+battery ratios.
  const solarRatios = [
    0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.3, 2.5, 2.8,
    3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0,
  ];
  const battDurations = [0, 1, 2, 3, 4, 5, 6, 8, 10]; // hours at battPower
  const battPowerRatios = [0.6, 0.8, 1.0]; // fraction of target load

  let bestLcoe = Infinity;
  let bestSolar = 0;
  let bestBattPower = 0;
  let bestBattEnergy = 0;
  let bestGasEnergy = 0;
  let bestDispatch: { solar: number; battery: number; gas: number; soc: number }[] = [];
  let bestGasFraction = 1;

  // Also track the best "close" solution in case nothing meets the strict constraint
  let closestLcoe = Infinity;
  let closestSolar = 0;
  let closestBattPower = 0;
  let closestBattEnergy = 0;
  let closestGasEnergy = 0;
  let closestDispatch: { solar: number; battery: number; gas: number; soc: number }[] = [];
  let closestGasFraction = 1;

  for (const solarRatio of solarRatios) {
    const solarMw = targetLoadMw * solarRatio;

    for (const bpr of battPowerRatios) {
      for (const battDur of battDurations) {
        const battPower = battDur > 0 ? targetLoadMw * bpr : 0;
        const battEnergy = battPower * battDur;

        // Simulate dispatch
        const result = simulateDispatch(
          solarMw, battPower, battEnergy, targetLoadMw, solarProfile, costs,
        );

        // Compute LCOE
        const lcoe = computeConfigLcoe(
          solarMw, battPower, battEnergy, result.totalGasEnergy,
          targetLoadMw, costs, gasFuelCost, annuity,
        );

        // Track the best solution that meets the gas constraint
        if (result.gasFraction <= maxGasBackupPct * 1.05) {
          if (lcoe < bestLcoe) {
            bestLcoe = lcoe;
            bestSolar = solarMw;
            bestBattPower = battPower;
            bestBattEnergy = battEnergy;
            bestGasEnergy = result.totalGasEnergy;
            bestDispatch = result.dispatch;
            bestGasFraction = result.gasFraction;
          }
        }

        // Also track the best solution that has the lowest gas fraction
        // (for cases where the strict constraint can't be met)
        if (result.gasFraction < closestGasFraction ||
            (Math.abs(result.gasFraction - closestGasFraction) < 0.01 && lcoe < closestLcoe)) {
          closestLcoe = lcoe;
          closestSolar = solarMw;
          closestBattPower = battPower;
          closestBattEnergy = battEnergy;
          closestGasEnergy = result.totalGasEnergy;
          closestDispatch = result.dispatch;
          closestGasFraction = result.gasFraction;
        }
      }
    }
  }

  // If no feasible solution found, use the closest one
  let solverStatus = "optimal";
  if (bestLcoe === Infinity || !isFinite(bestLcoe)) {
    solverStatus = `near-optimal (gas backup: ${(closestGasFraction * 100).toFixed(1)}%)`;
    bestLcoe = closestLcoe;
    bestSolar = closestSolar;
    bestBattPower = closestBattPower;
    bestBattEnergy = closestBattEnergy;
    bestGasEnergy = closestGasEnergy;
    bestDispatch = closestDispatch;
    bestGasFraction = closestGasFraction;
  }

  // Final safety check: if still Infinity (shouldn't happen), build a reasonable default
  if (!isFinite(bestLcoe) || bestSolar === 0) {
    // Use a moderate solar+battery config as fallback
    const fallbackSolar = targetLoadMw * 2.0;
    const fallbackBattPower = targetLoadMw * 0.8;
    const fallbackBattEnergy = fallbackBattPower * 4;

    const fallbackResult = simulateDispatch(
      fallbackSolar, fallbackBattPower, fallbackBattEnergy,
      targetLoadMw, solarProfile, costs,
    );

    bestLcoe = computeConfigLcoe(
      fallbackSolar, fallbackBattPower, fallbackBattEnergy,
      fallbackResult.totalGasEnergy, targetLoadMw, costs, gasFuelCost, annuity,
    );
    bestSolar = fallbackSolar;
    bestBattPower = fallbackBattPower;
    bestBattEnergy = fallbackBattEnergy;
    bestGasEnergy = fallbackResult.totalGasEnergy;
    bestDispatch = fallbackResult.dispatch;
    bestGasFraction = fallbackResult.gasFraction;
    solverStatus = `fallback (gas backup: ${(bestGasFraction * 100).toFixed(1)}%)`;
  }

  // ── Compute gas-only LCOE for comparison ──
  const gasCapex = 900; // $/kW
  const gasFixedOm = 15; // $/kW-yr
  const gasVarOm = 3.5; // $/MWh
  const gasCapitalAnnual = targetLoadMw * 1000 * gasCapex * annuity;
  const gasFixedOmAnnual = targetLoadMw * 1000 * gasFixedOm;
  const gasFuelCostOnly = targetLoadMw * 8760 * gasFuelCost;
  const gasVarOmOnly = targetLoadMw * 8760 * gasVarOm;
  const gasOnlyLcoe = (gasCapitalAnnual + gasFixedOmAnnual + gasFuelCostOnly + gasVarOmOnly) / (targetLoadMw * 8760);

  // ── Build LCOE breakdown ──
  const annualEnergy = targetLoadMw * 8760;
  const hoursPerRep = 365 / 12;
  const solarCostLcoe = (bestSolar * 1000 * costs.solarCapexPerKw * annuity + bestSolar * 1000 * costs.solarOmPerKwYear) / annualEnergy;
  const batteryCostLcoe = bestBattPower > 0
    ? ((bestBattPower * 1000 * costs.batteryCapexPerKw + bestBattEnergy * 1000 * costs.batteryCapexPerKwh) * annuity + bestBattPower * 1000 * costs.batteryOmPerKwYear) / annualEnergy
    : 0;
  const gasCostLcoe = (bestGasEnergy * hoursPerRep * (gasFuelCost + gasVarOm)) / annualEnergy;
  const excessSolarRev = 0; // simplified: no excess solar revenue

  const breakdown: LcoeBreakdown = {
    solarCost: Math.round(solarCostLcoe * 10) / 10,
    batteryCost: Math.round(batteryCostLcoe * 10) / 10,
    gasCost: Math.round(gasCostLcoe * 10) / 10,
    excessSolarRevenue: excessSolarRev,
    total: Math.round(bestLcoe * 10) / 10,
  };

  // ── Build hourly dispatch (24-hr average day) ──
  const hourlyDispatch: DispatchHour[] = [];
  for (let h = 0; h < 24; h++) {
    let solarAvg = 0, battAvg = 0, gasAvg = 0;
    for (let m = 0; m < 12; m++) {
      const d = bestDispatch[m * 24 + h];
      if (d) {
        solarAvg += d.solar;
        battAvg += d.battery;
        gasAvg += d.gas;
      }
    }
    hourlyDispatch.push({
      hour: h,
      solarMw: Math.round((solarAvg / 12) * 10) / 10,
      batteryMw: Math.round((battAvg / 12) * 10) / 10,
      gasMw: Math.round((gasAvg / 12) * 10) / 10,
      loadMw: targetLoadMw,
      soc: 0, // simplified (0-1)
    });
  }

  const gasBackupActual = bestGasFraction;
  const conflictHrs = bestDispatch.filter((d) => d.gas > 0 && d.solar > 0).length;

  // Emissions: gas backup × emissions intensity
  const gasEmissionsRate = 0.41; // tCO2/MWh for gas
  const emissionsFactor = gasBackupActual * gasEmissionsRate;

  return {
    solarCapacityMw: Math.round(bestSolar * 10) / 10,
    batteryPowerMw: Math.round(bestBattPower * 10) / 10,
    batteryEnergyMwh: Math.round(bestBattEnergy * 10) / 10,
    netLcoe: Math.round(bestLcoe * 10) / 10,
    lcoeGasOnly: Math.round(gasOnlyLcoe * 10) / 10,
    gasBackupActual: Math.round(gasBackupActual * 1000) / 1000,
    emissionsFactor: Math.round(emissionsFactor * 100) / 100,
    excessSolarMwh: 0,
    solarToLoadRatio: Math.round((bestSolar / targetLoadMw) * 100) / 100,
    conflictHours: conflictHrs,
    solverStatus,
    lcoeBreakdown: breakdown,
    hourlyDispatch,
  };
}
