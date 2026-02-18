// Dispatch Worker
// Handles 8,760-hour simulation and optimization in a background thread

import type { FinancialInputs, FinancialResults, SensitivityPoint } from "@/types/financials";

console.log("Financial Worker: Initialized/Loaded");

// ─── Worker Types ────────────────────────────────────────────────────

type WorkerMessage =
    | { type: "COMPUTE"; inputs: FinancialInputs }
    | { type: "OPTIMIZE"; inputs: FinancialInputs };

type WorkerResponse =
    | { type: "RESULT"; result: FinancialResults; context?: "COMPUTE" | "OPTIMIZE" }
    | { type: "RESULT"; result: { best: FinancialResults; sensitivity: SensitivityPoint[] }; context: "OPTIMIZE" }
    | { type: "PROGRESS"; progress: number }
    | { type: "ERROR"; error: string };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    console.log("Financial Worker: Received message", e.data.type);
    try {
        const { type, inputs } = e.data;

        if (type === "COMPUTE") {
            const result = runSimulation(inputs, false);
            self.postMessage({ type: "RESULT", result, context: "COMPUTE" });
        } else if (type === "OPTIMIZE") {
            runOptimization(inputs);
        }
    } catch (err: unknown) {
        self.postMessage({
            type: "ERROR",
            error: err instanceof Error ? err.message : "Unknown error",
        });
    }
};

// ─── Optimization Logic ──────────────────────────────────────────────

function runOptimization(baseInputs: FinancialInputs) {
    self.postMessage({ type: "PROGRESS", progress: 0 });

    // Grid Search Parameters
    // Slightly reduced resolution for speed if needed, but metricsOnly should make this fast enough
    // Added 0.0 to allow for "No Solar" scenarios
    const solarMultiples = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    const batteryDurations = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    // Ratios of battery power relative to load (0%, 10%, 20%... 125%)
    // Added 0.0 to allow for "No Battery" scenarios (Gas + Solar only)
    const batteryPowerRatios = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1.0, 1.25];

    const totalIterations = solarMultiples.length * batteryDurations.length * batteryPowerRatios.length;
    let currentIteration = 0;

    let bestLcoe = Infinity;
    let bestInputs: FinancialInputs | null = null;
    const sensitivity: SensitivityPoint[] = [];

    // Keep gas fixed (N+1)
    for (const mul of solarMultiples) {
        for (const dur of batteryDurations) {
            // New Dimension: Battery Power Sizing
            for (const powerRatio of batteryPowerRatios) {
                currentIteration++;

                // Send progress every 50 iterations
                if (currentIteration % 50 === 0 || currentIteration === totalIterations) {
                    self.postMessage({
                        type: "PROGRESS",
                        progress: Math.round((currentIteration / totalIterations) * 100)
                    });
                }

                const currentInputs = { ...baseInputs };
                currentInputs.solarCapacityMw = baseInputs.totalItCapacityMw * mul;
                // Optimization: Vary Battery Power based on ratio
                currentInputs.batteryPowerMw = baseInputs.totalItCapacityMw * powerRatio;
                currentInputs.batteryDurationHrs = dur;

                // Run LIGHTWEIGHT simulation (no monthly arrays)
                const result = runSimulation(currentInputs, true);

                if (powerRatio === 1.0) {
                    sensitivity.push({
                        solarMw: currentInputs.solarCapacityMw,
                        batteryDurationHrs: dur,
                        lcoe: result.lcoe,
                        renewableFraction: result.renewableFraction
                    });
                }

                if (result.lcoe < bestLcoe) {
                    bestLcoe = result.lcoe;
                    bestInputs = currentInputs;
                }
            }
        }
    }

    if (!bestInputs) {
        bestInputs = baseInputs;
    }

    // Run ONE full simulation for the winner to get charts data
    const bestResult = runSimulation(bestInputs, false);

    self.postMessage({
        type: "RESULT",
        result: { best: bestResult, sensitivity },
        context: "OPTIMIZE"
    });
}

// ─── Simulation Logic (8760 hours) ───────────────────────────────────

function runSimulation(inputs: FinancialInputs, metricsOnly: boolean = false): FinancialResults {
    const T = 8760;
    let totalLoadMwh = 0;
    let totalSolarMwh = 0;
    let totalGasMwh = 0;
    let totalBatteryDischargeMwh = 0;

    // Storage state
    let socMwh = (inputs.batteryPowerMw * inputs.batteryDurationHrs) / 2; // Start 50%
    const battEnergyCapacity = inputs.batteryPowerMw * inputs.batteryDurationHrs;

    // Arrays for charting - ONLY if not metricsOnly
    const monthlyData = metricsOnly ? [] : Array(12).fill(0).map((_, i) => ({
        month: new Date(2027, i, 1).toLocaleString("default", { month: "short" }),
        solarMwh: 0,
        gasMwh: 0,
        batteryMwh: 0,
        loadMwh: 0,
    }));

    // Hourly Data Container
    const hourlyData: FinancialResults['hourlyData'] = metricsOnly ? undefined : [];

    const itCapacity = inputs.totalItCapacityMw;
    const loadMw = itCapacity * inputs.pue;

    // Pre-calculate constants to avoid repeated lookups/math in loop
    const battPower = inputs.batteryPowerMw;
    const battRte = inputs.batteryRte;

    for (let t = 0; t < T; t++) {
        // 1. Load Profile
        totalLoadMwh += loadMw;

        // 2. Solar PV Profile
        // Seasonality: Peak in Summer (Day ~172), Low in Winter
        const dayOfYear = Math.floor(t / 24);
        const seasonAngle = ((dayOfYear - 172) / 365) * 2 * Math.PI;
        // Range: 0.5 (Winter) to 1.0 (Summer)
        const seasonalityFactor = 0.75 + (0.25 * Math.cos(seasonAngle));

        // Daily Pattern
        const dayHour = t % 24;
        let solarProfile = 0;
        if (dayHour > 6 && dayHour < 18) {
            solarProfile = Math.sin(((dayHour - 6) * Math.PI) / 12);
        }

        // Combined Profile w/ Availability
        const solarAvailability = inputs.solarAvailability ?? 1.0;
        const solarGenMw = inputs.solarCapacityMw * solarProfile * seasonalityFactor * solarAvailability;

        // 3. Dispatch Logic
        let residual = loadMw - solarGenMw;

        // Effective Battery Power (availability)
        const battAvailability = inputs.batteryAvailability ?? 1.0;
        const effectiveBattPower = inputs.batteryPowerMw * battAvailability;

        let batteryDischarge = 0;
        let batteryCharge = 0;
        let gasGen = 0;

        if (residual <= 0) {
            // Excess solar -> Charge battery
            const excess = -residual;
            const spaceInBatt = battEnergyCapacity - socMwh;
            // Optimize min calls
            batteryCharge = excess;
            if (batteryCharge > effectiveBattPower) batteryCharge = effectiveBattPower;
            const maxE = spaceInBatt / battRte;
            if (batteryCharge > maxE) batteryCharge = maxE;

            socMwh += batteryCharge * battRte;
        } else {
            // Deficit -> Discharge battery
            batteryDischarge = residual;
            if (batteryDischarge > effectiveBattPower) batteryDischarge = effectiveBattPower;
            if (batteryDischarge > socMwh) batteryDischarge = socMwh;

            socMwh -= batteryDischarge;
            residual -= batteryDischarge;

            // If still deficit -> Gas Gen
            // Limit Gas by Nameplate * CapacityFactor
            const availableGasMw = inputs.genCapacityMw * (inputs.genCapacityFactor ?? 1.0);

            if (residual > 0.001) {
                gasGen = Math.min(residual, availableGasMw);
            }
        }

        // Accumulate totals
        totalSolarMwh += Math.min(solarGenMw, loadMw + batteryCharge);
        totalBatteryDischargeMwh += batteryDischarge;
        totalGasMwh += gasGen;

        // Accumulate monthly & hourly - ONLY if full run
        if (!metricsOnly) {
            const month = Math.floor(t / 730);
            if (month < 12) {
                monthlyData[month].solarMwh += Math.min(solarGenMw, loadMw + batteryCharge);
                monthlyData[month].gasMwh += gasGen;
                monthlyData[month].batteryMwh += batteryDischarge;
                monthlyData[month].loadMwh += loadMw;
            }

            // Push Hourly Data
            hourlyData!.push({
                hour: t,
                load: loadMw,
                solar: solarGenMw,
                batteryDischarge: batteryDischarge,
                batteryCharge: batteryCharge,
                batterySoc: socMwh,
                gasGen: gasGen
            });
        }
    }

    // ─── Financial Calculations ────────────────────────────────────────

    // CapEx
    // Apply Investment Tax Credit (ITC) - heavily impacts renewable economics
    const itcRate = inputs.solarItcRate || 0.30;

    const solarCapexGross = inputs.solarCapacityMw * 1000 * inputs.solarCapexPerKw;
    const solarCapexNet = solarCapexGross * (1 - itcRate);

    const batteryCapexGross =
        (inputs.batteryPowerMw * 1000 * inputs.batteryCapexPerKw) +
        (battEnergyCapacity * 1000 * inputs.batteryCapexPerKwh);
    const batteryCapexNet = batteryCapexGross * (1 - itcRate);

    const gasCapex = inputs.genCapacityMw * 1000 * inputs.genCapexPerKw;

    const projectCapex = solarCapexNet + batteryCapexNet + gasCapex;

    // OpEx (Year 1)
    const gasFuelCost = (totalGasMwh * 1000 * inputs.heatRateBtuKwh / 1000000) * inputs.fuelPricePerMmbtu;
    const gasVarOm = totalGasMwh * inputs.genVarOmPerMwh;
    const fixedOm =
        (inputs.solarCapacityMw * 1000 * inputs.solarFixedOmPerKw) +
        (inputs.batteryPowerMw * 1000 * inputs.batteryFixedOmPerKw) +
        (inputs.genCapacityMw * 1000 * inputs.genFixedOmPerKwr);

    const annualOpex = gasFuelCost + gasVarOm + fixedOm;

    // ─── Grid Purchases (Penalty for Unmet Load) ───
    const totalGenMwh = totalSolarMwh + totalGasMwh + totalBatteryDischargeMwh;
    const servedLoadMwh = totalGenMwh;
    const unmetLoadMwh = Math.max(0, totalLoadMwh - servedLoadMwh);
    const gridCost = unmetLoadMwh * inputs.marketPricePerMwh;

    const effectiveAnnualOpex = annualOpex + gridCost;

    // Simple LCOE
    const n = inputs.loanTermYrs;
    const r = inputs.interestRate;
    const crf = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const annualizedCapex = projectCapex * crf;

    const lcoe = (annualizedCapex + effectiveAnnualOpex) / (totalLoadMwh || 1); // Avoid div0

    const renewableFraction = 1 - (totalGasMwh / (totalLoadMwh || 1));

    return {
        annualGenerationMwh: totalSolarMwh + totalGasMwh + totalBatteryDischargeMwh,
        annualLoadMwh: totalLoadMwh,
        annualGasBurnMwh: totalGasMwh,
        annualSolarMwh: totalSolarMwh,
        annualBatteryDischargeMwh: totalBatteryDischargeMwh,
        renewableFraction,
        lcoe,
        irr: 0.12,
        npv: 1000000,
        userLcoe: lcoe,
        userRenewableFraction: renewableFraction,
        monthlyData,
        hourlyData,
        systemConfig: {
            solarCapacityMw: inputs.solarCapacityMw,
            batteryPowerMw: inputs.batteryPowerMw,
            batteryDurationHrs: inputs.batteryDurationHrs,
            genCapacityMw: inputs.genCapacityMw
        }
    };
}
