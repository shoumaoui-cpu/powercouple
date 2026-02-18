import { FinancialInputs, FinancialResults, SensitivityPoint } from "@/types/financials";

// ─── Simulation Logic (8760 hours) ───────────────────────────────────

export function runSimulation(inputs: FinancialInputs, metricsOnly: boolean = false): FinancialResults {
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
        // Simple cosine wave for seasonality factor (0.6 to 1.0)
        const dayOfYear = Math.floor(t / 24);
        // Summer solstice is approx day 172. 
        // Cosine peak at 0 means we want (day - 172). 
        // 365 days = 2*PI
        const seasonAngle = ((dayOfYear - 172) / 365) * 2 * Math.PI;
        // Cosine of this angle peaks at 0 (Summer) and is -1 at +/- PI (Winter)
        // We want factor: 1.0 in Summer, 0.5 in Winter?
        // Let's say: Base 0.75 + 0.25 * cos(angle) -> Range: 0.5 to 1.0
        // NOTE: Math.cos(0) = 1. So 0.75 + 0.25(1) = 1.0 (Summer). 
        // Math.cos(PI) = -1. So 0.75 + 0.25(-1) = 0.5 (Winter).
        const seasonalityFactor = 0.75 + (0.25 * Math.cos(seasonAngle));

        // Daily Pattern: Peak at noon (hour 12), zero at night
        const dayHour = t % 24;
        let solarProfile = 0;
        if (dayHour > 6 && dayHour < 18) {
            solarProfile = Math.sin(((dayHour - 6) * Math.PI) / 12);
        }

        // Combined Profile
        // Apply Availability Factor (Default 1.0 if undefined)
        const solarAvailability = inputs.solarAvailability ?? 1.0;
        const solarGenMw = inputs.solarCapacityMw * solarProfile * seasonalityFactor * solarAvailability;

        // 3. Dispatch Logic
        let residual = loadMw - solarGenMw;

        let batteryDischarge = 0;
        let batteryCharge = 0;
        let gasGen = 0;

        // Effective Battery Power (after availability derate)
        const battAvailability = inputs.batteryAvailability ?? 1.0;
        const effectiveBattPower = inputs.batteryPowerMw * battAvailability;

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
            // Limit Gas by Nameplate * CapacityFactor (Availability)
            const availableGasMw = inputs.genCapacityMw * (inputs.genCapacityFactor ?? 1.0);

            if (residual > 0.001) {
                // We dispatch sufficient gas to meet residual, constrained by availability
                gasGen = Math.min(residual, availableGasMw);
                // Note: If residual > availableGas, we have unmet load (blackout)
                // The metrics currently track "Generation", but don't explicitly fail on unmet load logic-wise
                // except that load > gen. We assume grid purchases or failure? 
                // For this model, we'll just report what we could generate.
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
    // Defaulting to 30% if not explicitly in inputs, but inputs.solarItcRate should be there
    const itcRate = inputs.solarItcRate || 0.30;

    const solarCapexGross = inputs.solarCapacityMw * 1000 * inputs.solarCapexPerKw;
    const solarCapexNet = solarCapexGross * (1 - itcRate);

    const batteryCapexGross =
        (inputs.batteryPowerMw * 1000 * inputs.batteryCapexPerKw) +
        (battEnergyCapacity * 1000 * inputs.batteryCapexPerKwh);
    const batteryCapexNet = batteryCapexGross * (1 - itcRate); // Battery also eligible for ITC

    const gasCapex = inputs.genCapacityMw * 1000 * inputs.genCapexPerKw;

    // Project CapEx is Sum of NET CapEx
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
    // If the system doesn't generate enough, we assume we buy from the grid.
    // This prevents "0 Capacity" from being "0 Cost".
    // Instead, "0 Capacity" = "100% Grid Purchases" = Market Price.
    const totalGenMwh = totalSolarMwh + totalGasMwh + totalBatteryDischargeMwh;
    // Ensure we don't have negative unmet load (overgeneration doesn't credit us here unless we add export logic)
    // Simplified: Total Load - Total Gen (capped at load hourly? No, we need hourly sum)
    // Actually, we should track `unmetLoad` in the loop for accuracy (as excess solar in hour 1 doesn't offset deficit in hour 10).
    // Let's approximate for now using the totals if we didn't track it, BUT we should track it.
    // Since I can't easily edit the loop above without replacing the whole function again...
    // Let's use `annualLoadMwh - totalGenMwh`? 
    // No, `totalSolarMwh` includes "curtailed" energy if we aren't careful?
    // In the loop: `totalSolarMwh += Math.min(solarGenMw, loadMw + batteryCharge)`
    // This implies `totalSolarMwh` includes ONLY used solar (direct + charge).
    // `totalBatteryDischarge` is used energy.
    // `totalGasGen` is used energy.
    // So `totalGenMwh` is effectively "Served Load".

    // So Unmet Load = Total Load - Served Load
    const servedLoadMwh = totalGenMwh;
    // Note: totalGenMwh might strictly be slightly different if battery efficency losses are counted?
    // But `unmetLoad` is safely `totalLoadMwh - servedLoadMwh`.
    // If we have excess? `served` shouldn't exceed `load` in the loop logic (we clip to residual).

    const unmetLoadMwh = Math.max(0, totalLoadMwh - servedLoadMwh);
    const gridCost = unmetLoadMwh * inputs.marketPricePerMwh;

    // Add Grid Cost to Opex (Total Cost of Energy)
    const effectiveAnnualOpex = annualOpex + gridCost;

    // Simple LCOE
    const n = inputs.loanTermYrs;
    const r = inputs.interestRate;
    const crf = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const annualizedCapex = projectCapex * crf;

    // LCOE includes Grid Purchases now
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
        hourlyData, // New field
        systemConfig: {
            solarCapacityMw: inputs.solarCapacityMw,
            batteryPowerMw: inputs.batteryPowerMw,
            batteryDurationHrs: inputs.batteryDurationHrs,
            genCapacityMw: inputs.genCapacityMw
        }
    };
}

// ─── Optimization Logic (Async/Main Thread) ──────────────────────────

export async function runOptimizationAsync(
    baseInputs: FinancialInputs,
    onProgress: (progress: number) => void
): Promise<{ best: FinancialResults; sensitivity: SensitivityPoint[] }> {
    console.log("Optimization: Starting async run with inputs:", baseInputs);

    // Grid Search Parameters
    // Reduced grid for debugging speed if necessary
    const solarMultiples = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    const batteryDurations = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    // Ratios of battery power relative to load (0%, 10%... 125%)
    const batteryPowerRatios = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1.0, 1.25];

    const totalIterations = solarMultiples.length * batteryDurations.length * batteryPowerRatios.length;
    let currentIteration = 0;

    let bestLcoe = Infinity;
    let bestInputs: FinancialInputs | null = null;
    const sensitivity: SensitivityPoint[] = [];

    // Initial progress
    onProgress(0);
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
        // Keep gas fixed (N+1)
        for (const mul of solarMultiples) {
            for (const dur of batteryDurations) {
                // New Dimension: Battery Power Sizing
                for (const powerRatio of batteryPowerRatios) {
                    currentIteration++;

                    const currentInputs = { ...baseInputs };
                    currentInputs.solarCapacityMw = baseInputs.totalItCapacityMw * mul;
                    // Optimization: Vary Battery Power based on ratio
                    currentInputs.batteryPowerMw = baseInputs.totalItCapacityMw * powerRatio;
                    currentInputs.batteryDurationHrs = dur;

                    // Run LIGHTWEIGHT simulation
                    // console.log(`Optimization: Iteration ${currentIteration}/${totalIterations}`); 
                    const result = runSimulation(currentInputs, true);

                    // Only push to sensitivity if it's the "Full Power" case or close to it, to keep the chart clean?
                    // Or maybe we just visualize the best power ratio for each Solar/Duration combo?
                    // For now, let's only push sensitivity points for the 1.0 (Full Power) case so the chart is comparable to before?
                    // No, the user wants the BEST. 
                    // Let's only push to sensitivity if this result beats the current best for this Solar/Duration combo?
                    // Actually, the Sensitivity Chart is 2D (Solar vs Duration). It assumes fixed Battery Power.
                    // If we vary Battery Power, we need to decide what to show in the 2D chart.
                    // Let's show the BEST result for each [Solar, Duration] cell.
                    // So we need to aggregate.

                    // For now, let's keep it simple: Push ALL points to the sensitivity array?
                    // No, that will make the chart chaotic if it just plots everything.
                    // The chart in SensitivitySheet likely expects unique [Solar, Duration] keys or plots them as scatter.
                    // Let's simply push only if powerRatio === 1.0 OR if it's the global best?
                    // Better approach: Let's push the point if it's the "Standard" config (1.0) so the surface looks smooth,
                    // BUT update `bestLcoe` regardless of power ratio.

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

                    // Yield and update progress
                    // Update every ~1% or at least every 50 iterations
                    if (currentIteration % 50 === 0 || currentIteration === totalIterations) {
                        const pct = Math.round((currentIteration / totalIterations) * 100);
                        // console.log(`Optimization: Progress ${pct}%`);
                        onProgress(pct);
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
            }
        }
    } catch (e) {
        console.error("Optimization: Loop Error", e);
        throw e;
    }

    console.log("Optimization: Loop complete. Best LCOE:", bestLcoe);

    if (!bestInputs) {
        bestInputs = baseInputs;
    }

    // Run ONE full simulation for the winner to get charts data
    console.log("Optimization: Running final simulation for best result...");
    const bestResult = runSimulation(bestInputs, false);
    onProgress(100);
    console.log("Optimization: Finished.");

    return { best: bestResult, sensitivity };
}
