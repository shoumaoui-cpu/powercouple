"use client";

import { createStore, useStore } from "zustand";
import { createContext, useContext } from "react";
import type { FinancialInputs, FinancialResults, SheetName, SensitivityPoint } from "@/types/financials";

// ─── Default Inputs (based on requirements) ──────────────────────────

const DEFAULT_INPUTS: FinancialInputs = {
    // A. Site & Project
    projectMetricsDate: new Date().toISOString().split("T")[0],
    projectCod: "2027-01-01",
    projectLifeYrs: 30,
    taxRate: 0.25,
    inflationRate: 0.025,

    // B. Data Center
    totalItCapacityMw: 100,
    pue: 1.15,
    loadVariation: 0,

    // C. Generator
    genCapacityMw: 120, // N+1 
    genCapacityFactor: 0.95,
    genCapexPerKw: 900,
    genFixedOmPerKwr: 15,
    genVarOmPerMwh: 3.5,
    heatRateBtuKwh: 9000,
    fuelPricePerMmbtu: 3.50,
    fuelEscalator: 0.02,

    // D. Solar
    solarCapacityMw: 200,
    solarAvailability: 1.0, // Default 100% (User can derate)
    solarCapexPerKw: 950,
    solarFixedOmPerKw: 15,
    solarDegradation: 0.005,
    solarItcRate: 0.30,

    // E. Battery
    batteryPowerMw: 100,
    batteryAvailability: 1.0, // Default 100% (User can derate)
    batteryDurationHrs: 4,
    batteryCapexPerKw: 350,
    batteryCapexPerKwh: 220,
    batteryFixedOmPerKw: 10,
    batteryRte: 0.85,
    batteryItcRate: 0.30,

    // F. Grid / Market
    marketPricePerMwh: 45,
    marketEscalator: 0.02,

    // G. Financials
    debtRatio: 0.60,
    interestRate: 0.06,
    loanTermYrs: 20,
    targetIrr: 0.12,
};

// ─── Types ───────────────────────────────────────────────────────────

interface FinancialsState {
    inputs: FinancialInputs;
    results: FinancialResults | null;
    optimalResults: FinancialResults | null;
    sensitivityData: SensitivityPoint[];
    activeSheet: SheetName;
    isCalculating: boolean;
    isOptimizing: boolean;
    optimizationTrigger: number; // Timestamp to trigger optimization
    optimizationProgress: number; // 0 to 100

    setInputs: (partial: Partial<FinancialInputs>) => void;
    setResults: (results: FinancialResults | null) => void;
    setOptimalResults: (results: FinancialResults | null) => void;
    setSensitivityData: (data: SensitivityPoint[]) => void;
    setActiveSheet: (sheet: SheetName) => void;
    setIsCalculating: (isCalc: boolean) => void;
    setIsOptimizing: (isOpt: boolean) => void;
    setOptimizationProgress: (progress: number) => void;
    triggerOptimization: () => void;
    resetInputs: () => void;
}

// ─── Store Factory ───────────────────────────────────────────────────

export const createFinancialsStore = () =>
    createStore<FinancialsState>((set) => ({
        inputs: { ...DEFAULT_INPUTS },
        results: null,
        optimalResults: null,
        sensitivityData: [],
        activeSheet: "Inputs",
        isCalculating: false,
        isOptimizing: false,
        optimizationTrigger: 0,
        optimizationProgress: 0,

        // Merge defaults to ensure new fields exist if state is restored/partial
        setInputs: (partial) =>
            set((s) => ({ inputs: { ...DEFAULT_INPUTS, ...s.inputs, ...partial } })),
        setResults: (results) => set({ results }),
        setOptimalResults: (optimalResults) => set({ optimalResults }),
        setSensitivityData: (sensitivityData) => set({ sensitivityData }),
        setActiveSheet: (activeSheet) => set({ activeSheet }),
        setIsCalculating: (isCalculating) => set({ isCalculating }),
        setIsOptimizing: (isOptimizing) => set({ isOptimizing, optimizationProgress: isOptimizing ? 0 : 100 }),
        setOptimizationProgress: (optimizationProgress) => set({ optimizationProgress }),
        triggerOptimization: () => set({ optimizationTrigger: Date.now(), isOptimizing: true, optimizationProgress: 0 }),
        resetInputs: () => set({ inputs: { ...DEFAULT_INPUTS } }),
    }));

// ─── Context ─────────────────────────────────────────────────────────

export type FinancialsStoreType = ReturnType<typeof createFinancialsStore>;
export const FinancialsStoreContext = createContext<FinancialsStoreType | null>(
    null
);

export function useFinancialsStore<T>(
    selector: (state: FinancialsState) => T
): T {
    const store = useContext(FinancialsStoreContext);
    if (!store) {
        throw new Error(
            "useFinancialsStore must be used within <FinancialsStoreProvider>"
        );
    }
    return useStore(store, selector);
}
