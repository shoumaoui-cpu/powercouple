import { useEffect, useRef, useCallback } from "react";
import { useFinancialsStore } from "@/store/useFinancialsStore";
import type { FinancialInputs } from "@/types/financials";
import { runByogOptimization, runByogSimulation } from "@/lib/byog-api";

export function useDispatchWorker() {
    const inputs = useFinancialsStore((s) => s.inputs);
    const setResults = useFinancialsStore((s) => s.setResults);
    const setIsCalculating = useFinancialsStore((s) => s.setIsCalculating);
    const setOptimalResults = useFinancialsStore((s) => s.setOptimalResults);
    const setSensitivityData = useFinancialsStore((s) => s.setSensitivityData);
    const setIsOptimizing = useFinancialsStore((s) => s.setIsOptimizing);
    const setOptimizationProgress = useFinancialsStore((s) => s.setOptimizationProgress);

    const optimizationTrigger = useFinancialsStore((s) => s.optimizationTrigger);

    // internal state to track last processed inputs to avoid loops if needed
    const lastInputsRef = useRef<string>("");
    const lastOptimizationTriggerRef = useRef<number>(0);

    // Effect to trigger optimization (Main Thread)
    useEffect(() => {
        if (optimizationTrigger > 0 && optimizationTrigger !== lastOptimizationTriggerRef.current) {
            lastOptimizationTriggerRef.current = optimizationTrigger;
            setIsOptimizing(true);
            setOptimizationProgress(0);

            // Run async optimization on main thread
            // Progress is currently coarse for server-based optimization
            setOptimizationProgress(10);
            runByogOptimization(inputs)
                .then(({ model, best, sensitivity }) => {
                    setResults(model);
                    setOptimalResults(best);
                    setSensitivityData(sensitivity);
                    setIsOptimizing(false);
                    setOptimizationProgress(100);
                })
                .catch(err => {
                    console.error("Optimization failed:", err);
                    setIsOptimizing(false);
                });
        }
    }, [optimizationTrigger, inputs, setIsOptimizing, setOptimalResults, setSensitivityData, setOptimizationProgress, setResults]);

    const debouncedCalculate = useCallback((currentInputs: FinancialInputs) => {
        setIsCalculating(true);
        // Debounced server simulation for consistency with optimizer engine
        setTimeout(() => {
            try {
                runByogSimulation(currentInputs)
                    .then((result) => setResults(result))
                    .catch((e) => console.error("Simulation failed:", e))
                    .finally(() => setIsCalculating(false));
            } catch (e) {
                console.error("Simulation failed:", e);
                setIsCalculating(false);
            }
        }, 500); // 500ms debounce
    }, [setIsCalculating, setResults]);

    // Effect to trigger calc on input change
    useEffect(() => {
        const inputsStr = JSON.stringify(inputs);
        if (inputsStr !== lastInputsRef.current) {
            lastInputsRef.current = inputsStr;
            // Clear previous timeout handling is implicit in debounce if we used a ref for timeout, 
            // but here we just used setTimeout.
            // Actually, we should use a proper debounce with cleanup.
        }
    }, [inputs]);

    // Better debounce implementation
    useEffect(() => {
        const timer = setTimeout(() => {
            debouncedCalculate(inputs);
        }, 500);
        return () => clearTimeout(timer);
    }, [inputs, debouncedCalculate]);
}
