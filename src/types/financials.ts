export type SheetName =
    | "Inputs"
    | "Calculations"
    | "Sources & Uses"
    | "Cash Flow"
    | "Returns"
    | "Sensitivity"
    | "Charts";

export interface FinancialInputs {
    // A. Site
    projectMetricsDate: string;
    projectCod: string;
    projectLifeYrs: number;
    taxRate: number;
    inflationRate: number;

    // B. Data Center
    totalItCapacityMw: number;
    pue: number;
    loadVariation: number;

    // C. Generator
    genCapacityMw: number;
    genCapacityFactor: number; // Availability / De-rate (e.g. 0.95)
    genCapexPerKw: number;
    genFixedOmPerKwr: number;
    genVarOmPerMwh: number;
    heatRateBtuKwh: number;
    fuelPricePerMmbtu: number;
    fuelEscalator: number;

    // D. Solar
    solarCapacityMw: number;
    solarAvailability: number; // Derate/Availability (e.g. 0.98)
    solarCapexPerKw: number;
    solarFixedOmPerKw: number;
    solarDegradation: number;
    solarItcRate: number;

    // E. Battery
    batteryPowerMw: number;
    batteryAvailability: number; // Derate/Availability (e.g. 0.98)
    batteryDurationHrs: number;
    batteryCapexPerKw: number;
    batteryCapexPerKwh: number;
    batteryFixedOmPerKw: number;
    batteryRte: number;
    batteryItcRate: number;

    // F. Grid
    marketPricePerMwh: number;
    marketEscalator: number;

    // G. Financials
    debtRatio: number;
    interestRate: number;
    loanTermYrs: number;
    targetIrr: number;
}

export interface FinancialResults {
    annualGenerationMwh: number;
    annualLoadMwh: number;
    annualGasBurnMwh: number;
    annualSolarMwh: number;
    annualBatteryDischargeMwh: number;
    renewableFraction: number;
    lcoe: number;
    irr: number;
    npv: number;

    // Comparisons
    userLcoe: number;
    userRenewableFraction: number;

    // Arrays for charts (simplified monthly)
    monthlyData: {
        month: string;
        solarMwh: number;
        gasMwh: number;
        batteryMwh: number;
        loadMwh: number;
    }[];
    // System Config Snapshot
    systemConfig: {
        solarCapacityMw: number;
        batteryPowerMw: number;
        batteryDurationHrs: number;
        genCapacityMw: number;
    };
    // Hourly Data (8760) - Optional, only populated for full runs
    hourlyData?: {
        hour: number;
        load: number;
        solar: number;
        batteryDischarge: number;
        batteryCharge: number;
        batterySoc: number;
        gasGen: number;
    }[];

    byoc?: {
        summaryKpis?: {
            totalProjectCostUsd?: number;
            annualRevenueLostUsd?: number;
            coverageRatio?: number;
            paybackPeriodYears?: number | null;
            moic?: number;
        };
        capitalCosts?: {
            landCostUsd?: number;
            totalPreconstructionUsd?: number;
            totalPowerInfrastructureUsd?: number;
            poweredLandCostUsd?: number;
            totalDataCenterCapexUsd?: number;
            solarCapexUsd?: number;
            windCapexUsd?: number;
            batteryCapexUsd?: number;
            gasCapexUsd?: number;
            totalByocCapexUsd?: number;
            totalProjectCostUsd?: number;
        };
        resourceMix?: {
            solarMw?: number;
            batteryPowerMw?: number;
            batteryEnergyMwh?: number;
            gasMw?: number;
            esaMw?: number;
            totalFirmAccreditedMw?: number;
            coverageRatio?: number;
        };
        curtailment?: {
            estimatedAnnualCurtailmentMwh?: number;
            weightedAverageCurtailmentCostUsdPerMwh?: number;
            annualRevenueLostUsd?: number;
        };
        annualCashFlow?: {
            year: number;
            occupancyRate: number;
            grossRevenueUsd: number;
            totalPowerCostsUsd: number;
            curtailmentLossUsd: number;
            totalOpexUsd: number;
            ebitdaUsd: number;
            depreciationUsd: number;
            ebitUsd: number;
            netFreeCashFlowUsd: number;
            cumulativeCashFlowUsd: number;
        }[];
    };
}

export interface SensitivityPoint {
    // Legacy fields (kept optional for backward compatibility)
    solarMw?: number;
    batteryDurationHrs?: number;
    lcoe?: number;
    renewableFraction?: number;

    // Generic dynamic sensitivity fields
    xValue?: number;
    yValue?: number;
    zValue?: number;
    xLabel?: string;
    yLabel?: string;
    zLabel?: string;
}
