"use client";

import { useFinancialsStore } from "@/store/useFinancialsStore";
import { useDispatchWorker } from "@/hooks/useDispatchWorker";
import type { SheetName } from "@/types/financials";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { getMarketProfile } from "@/lib/market-data";
import { useEffect } from "react";

import { InputsSheet } from "@/components/financials/sheets/InputsSheet";
import { CalculationsSheet } from "@/components/financials/sheets/CalculationsSheet";
import { SourcesUsesSheet } from "@/components/financials/sheets/SourcesUsesSheet";
import { CashFlowSheet } from "@/components/financials/sheets/CashFlowSheet";
import { ReturnsSheet } from "@/components/financials/sheets/ReturnsSheet";
import { SensitivitySheet } from "@/components/financials/sheets/SensitivitySheet";
import { ChartsSheet } from "@/components/financials/sheets/ChartsSheet";

const SHEETS: { id: SheetName; label: string; Component: React.ComponentType }[] = [
    { id: "Inputs", label: "1. Inputs", Component: InputsSheet },
    { id: "Calculations", label: "2. Calculations", Component: CalculationsSheet },
    { id: "Sources & Uses", label: "3. Sources & Uses", Component: SourcesUsesSheet },
    { id: "Cash Flow", label: "4. Cash Flow", Component: CashFlowSheet },
    { id: "Returns", label: "5. Returns", Component: ReturnsSheet },
    { id: "Sensitivity", label: "6. Sensitivity", Component: SensitivitySheet },
    { id: "Charts", label: "7. Charts", Component: ChartsSheet },
];

export function FinancialModel() {
    console.log("FinancialModel: Rendering...");
    const activeSheet = useFinancialsStore((s) => s.activeSheet);
    const setActiveSheet = useFinancialsStore((s) => s.setActiveSheet);

    // ─── Site Integration ─────────────────────────────────────────────
    // Watch for Map Selection and auto-configure/optimize
    const selectedPlantId = useAppStore((s) => s.selectedPlantId);
    const plants = useAppStore((s) => s.plants);
    const dataCenters = useAppStore((s) => s.dataCenters);
    const nuclearPlants = useAppStore((s) => s.nuclearPlants);

    // Store actions
    const setInputs = useFinancialsStore((s) => s.setInputs);
    const triggerOptimization = useFinancialsStore((s) => s.triggerOptimization);
    const isOptimizing = useFinancialsStore((s) => s.isOptimizing);
    const optimizationProgress = useFinancialsStore((s) => s.optimizationProgress);

    useEffect(() => {
        if (!selectedPlantId) return;

        console.log("FinancialModel: Site Selected", selectedPlantId);

        // Find the entity
        const gasPlant = plants.find(p => p.id === selectedPlantId);
        const dc = dataCenters.find(d => d.id === selectedPlantId);
        const nuclear = nuclearPlants.find(n => n.id === selectedPlantId);

        let state = "US";
        let capacityMw = 100; // Default
        let name = "Unknown Site";
        let capacityFactor = 0.5;
        let heatRate = 9500;

        if (gasPlant) {
            state = gasPlant.state;
            capacityMw = gasPlant.nameplateCapacityMw;
            name = gasPlant.plantName;
            const rawCf = gasPlant.capacityFactor ?? 0.5;
            capacityFactor = rawCf > 1 ? rawCf / 100 : rawCf;
            heatRate = gasPlant.heatRateBtuKwh ?? 9500;
        } else if (dc) {
            // No state in DC interface? MapView uses coordinates. 
            // We'd need a lat/lon to state mapper. 
            // For now, default to National Avg if DC.
            // Or maybe DataCenter interface has more fields I missed? 
            // It has 'status', 'operator'.
            // Let's rely on coordinates to at least pick a region logic if we had it.
            // For MVP: Default to National.
            capacityMw = dc.itLoadMw || 100;
            name = dc.name;
        } else if (nuclear) {
            state = nuclear.state || "US";
            capacityMw = nuclear.capacityMw;
            name = nuclear.name;
        }

        const market = getMarketProfile(state);

        // Update Inputs
        console.log(`FinancialModel: Setting inputs for ${name} (${state})`, {
            wholesale: market.wholesalePrice,
            gasPrice: market.gasPriceMmbtu
        });

        setInputs({
            // Site Name? We don't have a field for it yet in inputs, maybe project description?
            // B. Data Center
            totalItCapacityMw: Math.max(50, Math.min(capacityMw, 500)), // Clamp for sanity? Or just use it.
            // F. Grid
            marketPricePerMwh: market.wholesalePrice,
            // C. Gas
            // Inject Regional Gas Price (Default to 3.50 if missing in old data)
            fuelPricePerMmbtu: market.gasPriceMmbtu || 3.50,
            genCapacityFactor: Math.max(0.2, Math.min(0.98, capacityFactor)),
            heatRateBtuKwh: Math.max(6500, Math.min(15000, heatRate)),
            // D. Solar
            // Set Solar Capacity roughly 2x-3x load as a starting point for optimization?
            solarCapacityMw: capacityMw * 3,
            // Adjust specific yield/availability based on irradiance? 
            // We updated Availability input. Let's use irradiance to tweak capacity factor?
            // Actually, the Solar Profile is currently hardcoded sine wave. 
            // We should use `solarAvailability` to model regional differences.
            // Base CF ~20%. If Irradiance is 6.0 vs 4.5, we scale.
            solarAvailability: (market.solarCf / 0.20), // Normalize to ~20% base
        });

        // Trigger Optimization logic
        // We delay slightly to let state settle?
        setTimeout(() => {
            console.log(`FinancialModel: Triggering Optimization for ${name} (${state})`);
            triggerOptimization();
            // Show Returns tab to see results
            setActiveSheet("Returns");
        }, 500);

    }, [selectedPlantId, plants, dataCenters, nuclearPlants, setInputs, triggerOptimization, setActiveSheet]);

    // Initialize the main thread optimization engine
    useDispatchWorker();

    const ActiveComponent = SHEETS.find((s) => s.id === activeSheet)?.Component || InputsSheet;

    return (
        <div className="flex flex-col h-full">
            {/* Optimization Overlay */}
            {isOptimizing && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
                    <div className="text-xl font-bold mb-4">Optimizing Site Configuration...</div>
                    <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-pc-green transition-all duration-300"
                            style={{ width: `${optimizationProgress}%` }}
                        />
                    </div>
                    <div className="text-sm font-mono mt-2 text-gray-300">{optimizationProgress}%</div>
                </div>
            )}

            {/* ── Content Area ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto bg-background/50 relative">
                <ActiveComponent />
            </div>

            {/* ── Bottom Sheet Tabs ──────────────────────────────────────── */}
            <div className="h-10 border-t border-border bg-pc-dark flex items-end px-2 gap-1 overflow-x-auto">
                {SHEETS.map((sheet) => (
                    <button
                        key={sheet.id}
                        onClick={() => setActiveSheet(sheet.id)}
                        className={cn(
                            "px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider rounded-t-lg transition-colors border-t border-x border-transparent translate-y-[1px]",
                            activeSheet === sheet.id
                                ? "bg-background text-pc-green border-border z-10"
                                : "bg-pc-dark hover:bg-white/5 text-muted-foreground hover:text-white"
                        )}
                    >
                        {sheet.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
