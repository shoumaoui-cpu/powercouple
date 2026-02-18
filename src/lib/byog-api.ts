import type { FinancialInputs, FinancialResults, SensitivityPoint } from "@/types/financials";

const SIMULATE_TIMEOUT_MS = 25_000;
const OPTIMIZE_TIMEOUT_MS = 60_000;
const SENSITIVITY_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

interface BYOGSummaryKpis {
  project_irr_levered_pct: number;
  npv_usd: number;
  lcoe_usd_kwh: number;
  lcoe_usd_mwh?: number;
  simple_payback_years: number | null;
  payback_period_years?: number | null;
  total_project_cost_usd?: number;
  annual_revenue_lost_usd?: number;
  coverage_ratio?: number;
  moic?: number;
  co2_emissions_delta_tons?: number;
  min_dscr?: number | null;
}

interface BYOGSimulationResponse {
  simulation_results: {
    summary_kpis: BYOGSummaryKpis;
    calculation_breakdown?: {
      capital_costs?: {
        land_cost_usd?: number;
        total_preconstruction_usd?: number;
        total_power_infrastructure_usd?: number;
        powered_land_cost_usd?: number;
        total_data_center_capex_usd?: number;
        solar_capex_usd?: number;
        wind_capex_usd?: number;
        battery_capex_usd?: number;
        gas_capex_usd?: number;
        total_byoc_capex_usd?: number;
        total_project_cost_usd?: number;
      };
      resource_mix?: {
        solar_mw?: number;
        battery_power_mw?: number;
        battery_energy_mwh?: number;
        gas_mw?: number;
        esa_mw?: number;
        annual_energy_demand_mwh?: number;
        annual_solar_generation_mwh?: number;
        annual_gas_generation_mwh?: number;
        annual_esa_import_mwh?: number;
        annual_battery_discharge_mwh?: number;
        total_firm_accredited_mw?: number;
        coverage_ratio?: number;
      };
      curtailment?: {
        estimated_annual_curtailment_mwh?: number;
        weighted_average_curtailment_cost_usd_per_mwh?: number;
        annual_revenue_lost_usd?: number;
      };
    };
    cash_flow_waterfall: Array<{
      year: number;
      occupancy_rate?: number;
      gross_revenue_usd?: number;
      total_power_costs_usd?: number;
      curtailment_loss_usd?: number;
      total_opex_usd?: number;
      ebitda_usd?: number;
      depreciation_usd?: number;
      ebit_usd?: number;
      net_free_cash_flow_usd: number;
      cumulative_cash_flow_usd: number;
    }>;
  };
}

interface BYOGOptimizeResponse {
  optimization_job: Record<string, unknown>;
  simulation_results: BYOGSimulationResponse["simulation_results"];
  best_configuration?: {
    asset_parameters?: {
      nameplate_capacity_kw?: number;
    };
    financial_assumptions?: {
      debt_equity_ratio_pct?: number;
    };
  };
}

interface BYOGSensitivityResponse {
  optimization_job: Record<string, unknown>;
  points: Array<{ x: number; y: number; z: number | null }>;
}

function buildMonthlyStub(
  annualLoadMwh: number,
  annualGasMwh: number,
  annualSolarMwh: number,
  annualBatteryDischargeMwh: number
) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthlySolarShape = [0.65, 0.75, 0.9, 1.0, 1.1, 1.15, 1.2, 1.15, 1.0, 0.9, 0.75, 0.65];
  const solarShapeTotal = monthlySolarShape.reduce((sum, v) => sum + v, 0);

  return months.map((m) => ({
    month: m,
    solarMwh: annualSolarMwh * (monthlySolarShape[months.indexOf(m)] / solarShapeTotal),
    gasMwh: annualGasMwh / 12,
    batteryMwh: annualBatteryDischargeMwh / 12,
    loadMwh: annualLoadMwh / 12,
  }));
}

export function mapInputsToScenarioPayload(inputs: FinancialInputs) {
  const peakKw = inputs.totalItCapacityMw * inputs.pue * 1000;
  const peakMw = inputs.totalItCapacityMw * inputs.pue;
  const tier4 = peakMw * 0.2222;
  const tier3 = peakMw * 0.2222;
  const tier2 = peakMw * 0.1667;
  const tier1 = Math.max(peakMw - (tier4 + tier3 + tier2), 0);

  return {
    site_context: {
      facility_peak_load_kw: peakKw,
      current_utility_rate_usd_kwh: inputs.marketPricePerMwh / 1000,
      utility_escalation_rate_pct: inputs.marketEscalator * 100,
    },
    asset_parameters: {
      technology_type: "reciprocating_engine",
      nameplate_capacity_kw: inputs.genCapacityMw * 1000,
      fuel_type: "natural_gas",
      fuel_price_usd_per_mmbtu: inputs.fuelPricePerMmbtu,
      fuel_escalator_pct: inputs.fuelEscalator * 100,
      heat_rate_btu_kwh: inputs.heatRateBtuKwh,
      availability_factor: Math.max(0.01, Math.min(1, inputs.genCapacityFactor ?? 0.95)),
    },
    financial_assumptions: {
      discount_rate_pct: inputs.targetIrr * 100,
      inflation_rate_pct: inputs.inflationRate * 100,
    },
    byoc_inputs: {
      data_center: {
        total_it_capacity_mw: inputs.totalItCapacityMw,
      },
      load_profile: {
        peak_it_load_mw: inputs.totalItCapacityMw * inputs.pue,
        min_operating_load_mw: inputs.totalItCapacityMw * inputs.pue * 0.33,
        load_factor: 0.85,
      },
      resource_costs: {
        solar: {
          capital_cost_per_kw_usd: inputs.solarCapexPerKw,
          fixed_om_per_kw_year_usd: inputs.solarFixedOmPerKw,
          capacity_factor_pct: Math.max(0, Math.min(100, inputs.solarAvailability * 100)),
        },
        battery: {
          duration_hours: inputs.batteryDurationHrs,
          power_cost_per_kw_usd: inputs.batteryCapexPerKw,
          energy_cost_per_kwh_usd: inputs.batteryCapexPerKwh,
          fixed_om_per_kw_year_usd: inputs.batteryFixedOmPerKw,
          round_trip_efficiency_pct: Math.max(0, Math.min(100, inputs.batteryRte * 100)),
        },
        natural_gas: {
          capital_cost_per_kw_usd: inputs.genCapexPerKw,
          fixed_om_per_kw_year_usd: inputs.genFixedOmPerKwr,
          variable_om_per_mwh_usd: inputs.genVarOmPerMwh,
          heat_rate_mmbtu_per_mwh: inputs.heatRateBtuKwh / 1000,
          fuel_cost_usd_per_mmbtu: inputs.fuelPricePerMmbtu,
          fuel_price_escalation_pct: inputs.fuelEscalator * 100,
        },
        esa_grid: {
          energy_rate_usd_per_mwh: inputs.marketPricePerMwh,
          energy_escalation_pct: inputs.marketEscalator * 100,
        },
      },
      revenue: {
        leasable_it_capacity_mw: inputs.totalItCapacityMw * 0.9,
        base_lease_rate_wholesale_usd_per_mw_month: 120000,
        contract_escalation_rate_pct: 2.5,
        absorption_period_years: 2,
        stabilized_occupancy_pct: 95,
      },
      analysis: {
        required_equity_return_pct: inputs.targetIrr * 100,
        discount_rate_pct: inputs.targetIrr * 100,
        analysis_period_years: Math.max(10, Math.min(40, inputs.projectLifeYrs)),
        general_inflation_rate_pct: inputs.inflationRate * 100,
      },
      curtailment: {
        tiers: [
          { name: "tier4", mw: tier4, max_event_hours: 8, max_events: 50, revenue_loss_per_mwh: 50 },
          { name: "tier3", mw: tier3, max_event_hours: 4, max_events: 30, revenue_loss_per_mwh: 120 },
          { name: "tier2", mw: tier2, max_event_hours: 2, max_events: 15, revenue_loss_per_mwh: 250 },
          { name: "tier1", mw: tier1, max_event_hours: 0, max_events: 0, revenue_loss_per_mwh: 0 },
        ],
      },
    },
  };
}

export function mapSimulationToFinancialResults(
  response: BYOGSimulationResponse,
  inputs: FinancialInputs,
  overrides?: Partial<FinancialResults["systemConfig"]>
): FinancialResults {
  const summary = response.simulation_results.summary_kpis;
  const breakdown = response.simulation_results.calculation_breakdown;
  const mix = breakdown?.resource_mix;
  const peakLoadMw = inputs.totalItCapacityMw * inputs.pue;
  const assumedLoadFactor = 0.85;
  const annualLoadMwh =
    mix?.annual_energy_demand_mwh ?? peakLoadMw * assumedLoadFactor * 8760;
  const annualSolarMwh = mix?.annual_solar_generation_mwh ?? 0;
  const annualGasMwh =
    mix?.annual_gas_generation_mwh ??
    Math.min(annualLoadMwh, inputs.genCapacityMw * (inputs.genCapacityFactor ?? 0.95) * 8760);
  const annualBatteryDischargeMwh = mix?.annual_battery_discharge_mwh ?? 0;
  const annualServedMwh =
    annualSolarMwh + annualGasMwh + annualBatteryDischargeMwh + (mix?.annual_esa_import_mwh ?? 0);
  const renewableNumerator = annualSolarMwh + annualBatteryDischargeMwh;
  const renewableFraction = annualServedMwh > 0 ? renewableNumerator / annualServedMwh : 0;
  const lcoeMwh = summary.lcoe_usd_mwh ?? summary.lcoe_usd_kwh * 1000;

  return {
    annualGenerationMwh: annualServedMwh,
    annualLoadMwh: annualLoadMwh,
    annualGasBurnMwh: annualGasMwh,
    annualSolarMwh,
    annualBatteryDischargeMwh,
    renewableFraction,
    lcoe: lcoeMwh,
    irr: summary.project_irr_levered_pct / 100,
    npv: summary.npv_usd,
    userLcoe: lcoeMwh,
    userRenewableFraction: renewableFraction,
    monthlyData: buildMonthlyStub(
      annualLoadMwh,
      annualGasMwh,
      annualSolarMwh,
      annualBatteryDischargeMwh
    ),
    hourlyData: undefined,
    systemConfig: {
      solarCapacityMw: overrides?.solarCapacityMw ?? mix?.solar_mw ?? 0,
      batteryPowerMw: overrides?.batteryPowerMw ?? mix?.battery_power_mw ?? 0,
      batteryDurationHrs:
        overrides?.batteryDurationHrs ??
        ((mix?.battery_power_mw ?? 0) > 0 ? (mix?.battery_energy_mwh ?? 0) / (mix?.battery_power_mw ?? 1) : 0),
      genCapacityMw: overrides?.genCapacityMw ?? mix?.gas_mw ?? inputs.genCapacityMw,
    },
    byoc: {
      summaryKpis: {
        totalProjectCostUsd: summary.total_project_cost_usd,
        annualRevenueLostUsd: summary.annual_revenue_lost_usd,
        coverageRatio: summary.coverage_ratio,
        paybackPeriodYears: summary.payback_period_years ?? summary.simple_payback_years,
        moic: summary.moic,
      },
      capitalCosts: {
        landCostUsd: breakdown?.capital_costs?.land_cost_usd,
        totalPreconstructionUsd: breakdown?.capital_costs?.total_preconstruction_usd,
        totalPowerInfrastructureUsd: breakdown?.capital_costs?.total_power_infrastructure_usd,
        poweredLandCostUsd: breakdown?.capital_costs?.powered_land_cost_usd,
        totalDataCenterCapexUsd: breakdown?.capital_costs?.total_data_center_capex_usd,
        solarCapexUsd: breakdown?.capital_costs?.solar_capex_usd,
        windCapexUsd: breakdown?.capital_costs?.wind_capex_usd,
        batteryCapexUsd: breakdown?.capital_costs?.battery_capex_usd,
        gasCapexUsd: breakdown?.capital_costs?.gas_capex_usd,
        totalByocCapexUsd: breakdown?.capital_costs?.total_byoc_capex_usd,
        totalProjectCostUsd: breakdown?.capital_costs?.total_project_cost_usd,
      },
      resourceMix: {
        solarMw: breakdown?.resource_mix?.solar_mw,
        batteryPowerMw: breakdown?.resource_mix?.battery_power_mw,
        batteryEnergyMwh: breakdown?.resource_mix?.battery_energy_mwh,
        gasMw: breakdown?.resource_mix?.gas_mw,
        esaMw: breakdown?.resource_mix?.esa_mw,
        totalFirmAccreditedMw: breakdown?.resource_mix?.total_firm_accredited_mw,
        coverageRatio: breakdown?.resource_mix?.coverage_ratio,
      },
      curtailment: {
        estimatedAnnualCurtailmentMwh: breakdown?.curtailment?.estimated_annual_curtailment_mwh,
        weightedAverageCurtailmentCostUsdPerMwh:
          breakdown?.curtailment?.weighted_average_curtailment_cost_usd_per_mwh,
        annualRevenueLostUsd: breakdown?.curtailment?.annual_revenue_lost_usd,
      },
      annualCashFlow: response.simulation_results.cash_flow_waterfall.map((row) => ({
        year: row.year,
        occupancyRate: row.occupancy_rate ?? 0,
        grossRevenueUsd: row.gross_revenue_usd ?? 0,
        totalPowerCostsUsd: row.total_power_costs_usd ?? 0,
        curtailmentLossUsd: row.curtailment_loss_usd ?? 0,
        totalOpexUsd: row.total_opex_usd ?? 0,
        ebitdaUsd: row.ebitda_usd ?? 0,
        depreciationUsd: row.depreciation_usd ?? 0,
        ebitUsd: row.ebit_usd ?? 0,
        netFreeCashFlowUsd: row.net_free_cash_flow_usd,
        cumulativeCashFlowUsd: row.cumulative_cash_flow_usd,
      })),
    },
  };
}

export async function runByogSimulation(inputs: FinancialInputs): Promise<FinancialResults> {
  const payload = mapInputsToScenarioPayload(inputs);
  const res = await fetchWithTimeout(
    "/api/simulate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    SIMULATE_TIMEOUT_MS
  );
  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data: BYOGSimulationResponse = await res.json();
  return mapSimulationToFinancialResults(data, inputs);
}

export async function runByogOptimization(inputs: FinancialInputs): Promise<{
  model: FinancialResults;
  best: FinancialResults;
  sensitivity: SensitivityPoint[];
}> {
  const base = mapInputsToScenarioPayload(inputs);
  const genKwMin = Math.max(500, Math.floor((inputs.totalItCapacityMw * inputs.pue * 1000) * 0.4));
  const genKwMax = Math.ceil(inputs.totalItCapacityMw * inputs.pue * 1000);
  const genRangeKw = Math.max(genKwMax - genKwMin, 0);
  const genStepKw = Math.max(500, Math.ceil(genRangeKw / 20 / 100) * 100);

  let model: FinancialResults;
  try {
    const baselineRes = await fetchWithTimeout(
      "/api/simulate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(base),
      },
      SIMULATE_TIMEOUT_MS
    );
    if (!baselineRes.ok) {
      throw new Error(await baselineRes.text());
    }
    const baselineData: BYOGSimulationResponse = await baselineRes.json();
    model = mapSimulationToFinancialResults(baselineData, inputs);
  } catch {
    // Ensure optimization can still complete even if baseline simulation endpoint is unavailable.
    model = {
      annualGenerationMwh: 0,
      annualLoadMwh: 0,
      annualGasBurnMwh: 0,
      annualSolarMwh: 0,
      annualBatteryDischargeMwh: 0,
      renewableFraction: 0,
      lcoe: 0,
      irr: 0,
      npv: 0,
      userLcoe: 0,
      userRenewableFraction: 0,
      monthlyData: [],
      systemConfig: {
        solarCapacityMw: inputs.solarCapacityMw,
        batteryPowerMw: inputs.batteryPowerMw,
        batteryDurationHrs: inputs.batteryDurationHrs,
        genCapacityMw: inputs.genCapacityMw,
      },
    };
  }

  const optimizeRes = await fetchWithTimeout(
    "/api/optimize-byog",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...base,
        optimization_job: {
          mode: "multi_variable",
          target_variable: "npv_usd",
          goal: "maximize",
          constraints: [
            { metric: "min_dscr", operator: "greater_than_equal", value: 1.25 },
          ],
          decision_variables: {
            "asset_parameters.nameplate_capacity_kw": {
              min: genKwMin,
              max: genKwMax,
              step: genStepKw,
            },
            "financial_assumptions.debt_equity_ratio_pct": {
              min: 0,
              max: 90,
              step: 15,
            },
          },
        },
      }),
    },
    OPTIMIZE_TIMEOUT_MS
  );

  if (!optimizeRes.ok) {
    throw new Error(await optimizeRes.text());
  }

  const optimizeData: BYOGOptimizeResponse = await optimizeRes.json();
  const bestGenKw = optimizeData.best_configuration?.asset_parameters?.nameplate_capacity_kw;

  const best = mapSimulationToFinancialResults(
    { simulation_results: optimizeData.simulation_results },
    inputs,
    {
      genCapacityMw: bestGenKw ? bestGenKw / 1000 : inputs.genCapacityMw,
    }
  );

  let sensitivity: SensitivityPoint[] = [];
  try {
    const sensitivityRes = await fetchWithTimeout(
      "/api/optimize-byog",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...base,
          optimization_job: {
            mode: "sensitivity_heatmap",
            x_axis: {
              path: "asset_parameters.fuel_price_usd_per_mmbtu",
              min: 3.0,
              max: 8.0,
              step: 1.0,
            },
            y_axis: {
              path: "site_context.utility_escalation_rate_pct",
              min: 1.0,
              max: 5.0,
              step: 1.0,
            },
            z_metric: "project_irr_levered_pct",
          },
        }),
      },
      SENSITIVITY_TIMEOUT_MS
    );

    if (sensitivityRes.ok) {
      const sensitivityData: BYOGSensitivityResponse = await sensitivityRes.json();
      sensitivity = sensitivityData.points.map((p) => ({
        xValue: p.x,
        yValue: p.y,
        zValue: p.z ?? 0,
        xLabel: "Fuel Price ($/MMBtu)",
        yLabel: "Utility Escalation (%)",
        zLabel: "Project IRR (%)",
      }));
    }
  } catch {
    // Sensitivity is informational; do not block optimization completion.
    sensitivity = [];
  }

  return { model, best, sensitivity };
}
