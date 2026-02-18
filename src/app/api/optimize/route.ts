import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import path from "node:path";

const COST_SCENARIOS: Record<
  string,
  {
    solarCapexPerKw: number;
    batteryEnergyCapexPerKwh: number;
    batteryPowerCapexPerKw: number;
    solarOmPerKwYear: number;
    batteryOmPerKwYear: number;
    gasPricePerMmbtu: number;
    waccPct: number;
  }
> = {
  base: {
    solarCapexPerKw: 950,
    batteryEnergyCapexPerKwh: 250,
    batteryPowerCapexPerKw: 150,
    solarOmPerKwYear: 12,
    batteryOmPerKwYear: 8,
    gasPricePerMmbtu: 3.5,
    waccPct: 6,
  },
  low: {
    solarCapexPerKw: 750,
    batteryEnergyCapexPerKwh: 180,
    batteryPowerCapexPerKw: 120,
    solarOmPerKwYear: 10,
    batteryOmPerKwYear: 6,
    gasPricePerMmbtu: 3.5,
    waccPct: 5,
  },
  high: {
    solarCapexPerKw: 1200,
    batteryEnergyCapexPerKwh: 320,
    batteryPowerCapexPerKw: 200,
    solarOmPerKwYear: 15,
    batteryOmPerKwYear: 10,
    gasPricePerMmbtu: 5,
    waccPct: 8,
  },
  high_gas: {
    solarCapexPerKw: 950,
    batteryEnergyCapexPerKwh: 250,
    batteryPowerCapexPerKw: 150,
    solarOmPerKwYear: 12,
    batteryOmPerKwYear: 8,
    gasPricePerMmbtu: 6,
    waccPct: 6,
  },
};

const BACKEND_TIMEOUT_MS = 25_000;
const EIA860_FASTAPI_TIMEOUT_MS = 5_000;
const FASTAPI_COOLDOWN_MS = 60_000;
let fastApiUnavailableUntil = 0;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = BACKEND_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function runLocalByogSimulation(payload: unknown) {
  const script = `
import json
import sys
from optimizer.byog_engine import CalculationClass

input_payload = json.loads(sys.argv[1])
print(json.dumps(CalculationClass(input_payload).run()))
`;

  const pythonCandidates = [
    path.join(process.cwd(), "backend/.venv/bin/python"),
    "python3",
    "python",
  ];

  let lastErr: unknown;
  for (const py of pythonCandidates) {
    try {
      const raw = execFileSync(py, ["-c", script, JSON.stringify(payload)], {
        cwd: path.join(process.cwd(), "backend"),
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 20,
      });
      if (raw) {
        return JSON.parse(raw) as Record<string, unknown>;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(`Local BYOG simulation fallback failed: ${String(lastErr)}`);
}

function extractLcoeUsdMwh(simulationOutput: Record<string, unknown>): number {
  const simulationResults =
    (simulationOutput.simulation_results as Record<string, unknown> | undefined) ?? {};
  const summary =
    (simulationResults.summary_kpis as Record<string, unknown> | undefined) ?? {};

  if (typeof summary.lcoe_usd_mwh === "number") return summary.lcoe_usd_mwh;
  if (typeof summary.lcoe_usd_kwh === "number") return summary.lcoe_usd_kwh * 1000;
  return 0;
}

function buildGasOnlyScenarioPayload(basePayload: Record<string, unknown>): Record<string, unknown> {
  const cloned = JSON.parse(JSON.stringify(basePayload)) as Record<string, unknown>;
  const byocInputs = (cloned.byoc_inputs as Record<string, unknown> | undefined) ?? {};
  const resourceCosts = (byocInputs.resource_costs as Record<string, unknown> | undefined) ?? {};

  const solar = (resourceCosts.solar as Record<string, unknown> | undefined) ?? {};
  solar.max_deployable_mw = 0;
  solar.elcc = 0;
  solar.capital_cost_per_kw_usd = 0;
  solar.fixed_om_per_kw_year_usd = 0;
  resourceCosts.solar = solar;

  const battery = (resourceCosts.battery as Record<string, unknown> | undefined) ?? {};
  battery.elcc = 0;
  battery.duration_hours = 0;
  battery.power_cost_per_kw_usd = 0;
  battery.energy_cost_per_kwh_usd = 0;
  battery.fixed_om_per_kw_year_usd = 0;
  resourceCosts.battery = battery;

  const esa = (resourceCosts.esa_grid as Record<string, unknown> | undefined) ?? {};
  esa.available = false;
  esa.max_capacity_mw = 0;
  esa.transmission_import_limit_mw = 0;
  esa.elcc = 0;
  esa.energy_rate_usd_per_mwh = 0;
  esa.demand_charge_usd_per_mw_month = 0;
  resourceCosts.esa_grid = esa;

  byocInputs.resource_costs = resourceCosts;
  cloned.byoc_inputs = byocInputs;
  return cloned;
}

function mapByogSimulationToOptimizeResponse(
  simulationOutput: Record<string, unknown>,
  peakLoadMw: number,
  heatRate: number,
  gasPricePerMmbtu: number,
  gasCf: number,
  lcoeGasOnlyOverride?: number
) {
  const simulationResults =
    (simulationOutput.simulation_results as Record<string, unknown> | undefined) ?? {};
  const summary =
    (simulationResults.summary_kpis as Record<string, unknown> | undefined) ?? {};
  const breakdown =
    (simulationResults.calculation_breakdown as Record<string, unknown> | undefined) ?? {};
  const mix = (breakdown.resource_mix as Record<string, unknown> | undefined) ?? {};

  const lcoeMwhFromKwh =
    typeof summary.lcoe_usd_kwh === "number" ? summary.lcoe_usd_kwh * 1000 : 0;
  const netLcoe =
    typeof summary.lcoe_usd_mwh === "number" ? summary.lcoe_usd_mwh : lcoeMwhFromKwh;

  const lcoeGasOnly =
    typeof lcoeGasOnlyOverride === "number"
      ? lcoeGasOnlyOverride
      : estimateGasOnlyLcoe(heatRate, gasPricePerMmbtu, gasCf);
  const firmAvailable =
    (typeof summary.firm_capacity_available_mw === "number"
      ? summary.firm_capacity_available_mw
      : 0) ||
    (typeof mix.total_firm_accredited_mw === "number" ? mix.total_firm_accredited_mw : 0);
  const gasFirmMw =
    typeof mix.gas_firm_accredited_mw === "number"
      ? mix.gas_firm_accredited_mw
      : typeof mix.gas_mw === "number"
        ? mix.gas_mw
        : 0;
  const gasBackupActual = firmAvailable > 0 ? gasFirmMw / firmAvailable : 0;

  return {
    solarCapacityMw: typeof mix.solar_mw === "number" ? mix.solar_mw : 0,
    batteryPowerMw: typeof mix.battery_power_mw === "number" ? mix.battery_power_mw : 0,
    batteryEnergyMwh: typeof mix.battery_energy_mwh === "number" ? mix.battery_energy_mwh : 0,
    netLcoe,
    lcoeGasOnly,
    gasBackupActual,
    emissionsFactor: null,
    excessSolarMwh: null,
    solarToLoadRatio:
      peakLoadMw > 0 && typeof mix.solar_mw === "number" ? mix.solar_mw / peakLoadMw : 0,
    conflictHours: null,
    solverStatus: "optimal",
    lcoeBreakdown: null,
    hourlyDispatch: null,
  };
}

function normalizeFraction(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return fallback;
  if (value > 1) return value / 100;
  return value;
}

function estimateGasOnlyLcoe(
  heatRateBtuKwh: number,
  gasPricePerMmbtu: number,
  capacityFactor: number
): number {
  const cf = Math.max(0.05, Math.min(0.95, capacityFactor));
  const fuelCostPerMwh = (heatRateBtuKwh * gasPricePerMmbtu) / 1000;
  const fixedOmPerMwh = (15 / (cf * 8760)) * 1000;
  return fuelCostPerMwh + fixedOmPerMwh;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const fastApiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";
  const isEia860Plant = typeof body.plantId === "string" && body.plantId.startsWith("eia860-");

  const selectedScenario =
    COST_SCENARIOS[String(body.costScenario ?? "base").toLowerCase()] ?? COST_SCENARIOS.base;

  if (isEia860Plant) {
    const peakLoadMw = Number(body.targetLoadMw) || 0;
    const gasCf = normalizeFraction(body.gasCapacityFactor, 0.9);
    const solarCf = normalizeFraction(body.solarCfHint, 0.26);
    const heatRate = Number(body.gasHeatRateBtuKwh) > 0 ? Number(body.gasHeatRateBtuKwh) : 8500;
    const solarPotentialMw = Number(body.maxSolarMw) > 0 ? Number(body.maxSolarMw) : peakLoadMw * 2.5;

    const maxGasBackupPct = Math.max(0, Math.min(1, normalizeFraction(body.maxGasBackupPct, 0.05)));

    const byogPayload: Record<string, unknown> = {
      request_meta: { job_type: "simulate" },
      site_context: {
        facility_peak_load_kw: peakLoadMw * 1000,
        current_utility_rate_usd_kwh: selectedScenario.gasPricePerMmbtu >= 5 ? 0.14 : 0.12,
        utility_escalation_rate_pct: 2.5,
      },
      asset_parameters: {
        technology_type: "reciprocating_engine",
        nameplate_capacity_kw: peakLoadMw * 1000,
        fuel_type: "natural_gas",
        fuel_price_usd_per_mmbtu: selectedScenario.gasPricePerMmbtu,
        fuel_escalator_pct: 2.5,
        heat_rate_btu_kwh: heatRate,
        availability_factor: gasCf,
      },
      financial_assumptions: {
        discount_rate_pct: selectedScenario.waccPct,
        inflation_rate_pct: 2.5,
      },
      byoc_inputs: {
        data_center: {
          total_it_capacity_mw: Math.max(1, peakLoadMw * 0.85),
        },
        load_profile: {
          peak_it_load_mw: peakLoadMw,
          min_operating_load_mw: peakLoadMw * 0.33,
          load_factor: 0.9,
        },
        resource_costs: {
          solar: {
            capital_cost_per_kw_usd: selectedScenario.solarCapexPerKw,
            fixed_om_per_kw_year_usd: selectedScenario.solarOmPerKwYear,
            capacity_factor_pct: Math.max(8, Math.min(45, solarCf * 100)),
            max_deployable_mw: Math.max(0, solarPotentialMw),
          },
          battery: {
            duration_hours: 4,
            power_cost_per_kw_usd: selectedScenario.batteryPowerCapexPerKw,
            energy_cost_per_kwh_usd: selectedScenario.batteryEnergyCapexPerKwh,
            fixed_om_per_kw_year_usd: selectedScenario.batteryOmPerKwYear,
            round_trip_efficiency_pct: 87,
          },
          natural_gas: {
            capital_cost_per_kw_usd: 900,
            fixed_om_per_kw_year_usd: 15,
            variable_om_per_mwh_usd: 4,
            heat_rate_mmbtu_per_mwh: heatRate / 1000,
            fuel_cost_usd_per_mmbtu: selectedScenario.gasPricePerMmbtu,
            fuel_price_escalation_pct: 2.5,
          },
          esa_grid: {
            energy_rate_usd_per_mwh: selectedScenario.gasPricePerMmbtu >= 5 ? 140 : 120,
            energy_escalation_pct: 2.5,
          },
        },
        analysis: {
          required_equity_return_pct: Math.max(selectedScenario.waccPct + 2, 8),
          discount_rate_pct: selectedScenario.waccPct,
          analysis_period_years: 25,
          general_inflation_rate_pct: 2.5,
          max_gas_backup_pct: maxGasBackupPct,
        },
      },
    };

    let byogResult: Record<string, unknown> | null = null;
    let fastApiFailure: string | null = null;
    const shouldSkipFastApi = Date.now() < fastApiUnavailableUntil;

    if (!shouldSkipFastApi) {
      try {
        const response = await fetchWithTimeout(
          `${fastApiUrl}/simulate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(byogPayload),
          },
          EIA860_FASTAPI_TIMEOUT_MS
        );

        if (response.ok) {
          byogResult = (await response.json()) as Record<string, unknown>;
          fastApiUnavailableUntil = 0;
        } else {
          fastApiFailure = `FastAPI /simulate failed: ${await response.text()}`;
          fastApiUnavailableUntil = Date.now() + FASTAPI_COOLDOWN_MS;
        }
      } catch (error) {
        fastApiFailure =
          error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        fastApiUnavailableUntil = Date.now() + FASTAPI_COOLDOWN_MS;
      }
    } else {
      const secondsLeft = Math.ceil((fastApiUnavailableUntil - Date.now()) / 1000);
      fastApiFailure = `Skipped FastAPI /simulate due to cooldown (${secondsLeft}s remaining)`;
    }

    if (!byogResult) {
      try {
        byogResult = runLocalByogSimulation(byogPayload);
      } catch (fallbackError) {
        const detail =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        const status = fastApiFailure?.includes("AbortError") ? 504 : 503;

        return NextResponse.json(
          {
            error:
              "Optimization failed after FastAPI timeout/error and local fallback attempt.",
            detail: {
              fastApi: fastApiFailure,
              fallback: detail,
            },
          },
          { status }
        );
      }
    }

    let lcoeGasOnlyOverride: number | undefined;
    try {
      const gasOnlyPayload = buildGasOnlyScenarioPayload(byogPayload);
      const gasOnlyResult = runLocalByogSimulation(gasOnlyPayload);
      const gasOnlyLcoe = extractLcoeUsdMwh(gasOnlyResult);
      if (gasOnlyLcoe > 0) {
        lcoeGasOnlyOverride = gasOnlyLcoe;
      }
    } catch (baselineError) {
      console.warn("Gas-only baseline fallback failed; using heuristic gas-only LCOE", baselineError);
    }

    return NextResponse.json(
      mapByogSimulationToOptimizeResponse(
        byogResult,
        peakLoadMw,
        heatRate,
        selectedScenario.gasPricePerMmbtu,
        gasCf,
        lcoeGasOnlyOverride
      )
    );
  }

  const backendPayload = {
    plant_id: body.plantId,
    target_load_mw: body.targetLoadMw,
    max_gas_backup_pct: body.maxGasBackupPct,
    commissioning_year: body.commissioningYear,
    cost_scenario: body.costScenario,
    conflict_pct: body.conflictPct ?? null,
    latitude: body.latitude ?? null,
    gas_heat_rate_btu_kwh: body.gasHeatRateBtuKwh ?? null,
    gas_capacity_factor: body.gasCapacityFactor ?? null,
    solar_cf_hint: body.solarCfHint ?? null,
    max_solar_mw: body.maxSolarMw ?? null,
  };

  try {
    const response = await fetchWithTimeout(`${fastApiUrl}/optimize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Optimization failed: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    const mappedResult = {
      solarCapacityMw: result.solar_capacity_mw,
      batteryPowerMw: result.battery_power_mw,
      batteryEnergyMwh: result.battery_energy_mwh,
      netLcoe: result.net_lcoe,
      lcoeGasOnly: result.lcoe_gas_only,
      gasBackupActual: result.gas_backup_actual,
      emissionsFactor: result.emissions_factor,
      excessSolarMwh: result.excess_solar_mwh,
      solarToLoadRatio: result.solar_to_load_ratio,
      conflictHours: result.conflict_hours,
      solverStatus: result.solver_status,
      lcoeBreakdown: result.lcoe_breakdown
        ? {
            solarCost: result.lcoe_breakdown.solar_cost,
            batteryCost: result.lcoe_breakdown.battery_cost,
            gasCost: result.lcoe_breakdown.gas_cost,
            excessSolarRevenue: result.lcoe_breakdown.excess_solar_revenue,
            total: result.lcoe_breakdown.total,
          }
        : null,
      hourlyDispatch: Array.isArray(result.hourly_dispatch)
        ? result.hourly_dispatch.map((h: {
            hour: number;
            solar_mw: number;
            battery_mw: number;
            gas_mw: number;
            load_mw: number;
            soc: number;
          }) => ({
            hour: h.hour,
            solarMw: h.solar_mw,
            batteryMw: h.battery_mw,
            gasMw: h.gas_mw,
            loadMw: h.load_mw,
            soc: h.soc,
          }))
        : null,
    };

    return NextResponse.json(mappedResult);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        {
          error:
            "Optimization timed out waiting for backend response. Please retry and verify FastAPI is healthy.",
        },
        { status: 504 }
      );
    }
    console.error("Error calling optimization backend:", error);
    return NextResponse.json(
      { error: "Optimization service unavailable. Is the FastAPI backend running?" },
      { status: 503 }
    );
  }
}
