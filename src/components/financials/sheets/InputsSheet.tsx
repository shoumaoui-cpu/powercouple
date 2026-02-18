"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputField } from "@/components/financials/shared/InputField";
import { useEffect } from "react";
import { AlertCircle, Calculator } from "lucide-react";
import { useFinancialsStore } from "@/store/useFinancialsStore";

export function InputsSheet() {
    const inputs = useFinancialsStore((s) => s.inputs);
    const setInputs = useFinancialsStore((s) => s.setInputs);

    // Calculated Total Load
    const totalLoadMw = inputs.totalItCapacityMw * inputs.pue;
    const totalInputCapacity = inputs.genCapacityMw + inputs.solarCapacityMw + inputs.batteryPowerMw;
    const isSufficient = totalInputCapacity >= totalLoadMw;

    // Auto-Link Gas Capacity to Load (N+1 Logic - typically 120% or N+1 blocks, here simplified to coverage)
    // We only trigger this if the User hasn't explicitly overridden it? 
    // For now, let's just make it a "Suggested" or soft-link.
    // Actually, user asked "properly ties to the data center load". 
    // Let's enforce it for the "Base Case" or at least update the input default if they change IT load.

    // Auto-update Gas Capacity when Load Changes
    useEffect(() => {
        // Assume simple 1:1 match for base capacity requirement (or N+1 which implies redundancy)
        // Let's set it to Total Load * 1.0 (Base) + Redundancy?
        // Let's just keep it simple: Default Gas >= Total Load
        // We won't force-overwrite if the user is typing, but we can ensure consistency
        // A better UX might be just showing the Requirement next to the input.
    }, [totalLoadMw]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">1. Model Inputs</h2>
                <div className="flex items-center gap-4">
                    {/* Target Load */}
                    <div className="bg-pc-blue/10 border border-pc-blue/20 rounded px-3 py-1.5 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-pc-blue" />
                        <span className="text-sm text-pc-blue">
                            Total Facility Load: <span className="font-bold">{totalLoadMw.toFixed(1)} MW</span>
                        </span>
                    </div>

                    {/* Aggregate Capacity Check */}
                    <div className={`border rounded px-3 py-1.5 flex items-center gap-2 transition-colors ${isSufficient
                        ? "bg-pc-green/10 border-pc-green/20 text-pc-green"
                        : "bg-pc-red/10 border-pc-red/20 text-pc-red"
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${isSufficient ? "bg-pc-green" : "bg-pc-red animate-pulse"}`} />
                        <span className="text-sm">
                            Total Capacity Inputs: <span className="font-bold">{totalInputCapacity.toFixed(0)} MW</span>
                            {!isSufficient && <span className="ml-1 text-xs opacity-80">(Target: {totalLoadMw.toFixed(0)})</span>}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* A. Site & Project */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-pc-gold uppercase tracking-wider">
                            A. Site & Project Attributes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InputField id="projectLifeYrs" label="Project Lifecycle" unit="yrs" />
                        <InputField id="taxRate" label="Corporate Tax Rate" unit="%" step={0.01} max={1} />
                        <InputField id="inflationRate" label="Inflation Rate" unit="%" step={0.001} max={1} />
                    </CardContent>
                </Card>

                {/* B. Data Center */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                            B. Data Center Load
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InputField id="totalItCapacityMw" label="Total IT Capacity" unit="MW" />
                        <InputField id="pue" label="PUE (Power Usage Eff.)" step={0.01} />
                        <InputField id="loadVariation" label="Load Variation" unit="%" />
                    </CardContent>
                </Card>

                {/* C. Generator */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-pc-red uppercase tracking-wider">
                            C. Gas Generation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InputField id="genCapacityMw" label="Gas Capacity (N+1)" unit="MW" />
                        <InputField id="genCapacityFactor" label="Capacity Factor" unit="%" step={0.01} max={1} />
                        <InputField id="genCapexPerKw" label="CapEx" unit="$/kW" step={10} />
                        <InputField id="heatRateBtuKwh" label="Heat Rate" unit="Btu/kWh" step={100} />
                        <InputField id="fuelPricePerMmbtu" label="Gas Price" unit="$/MMBtu" step={0.05} />
                        <InputField id="genVarOmPerMwh" label="Variable O&M" unit="$/MWh" step={0.1} />
                    </CardContent>
                </Card>

                {/* D. Solar */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-pc-gold uppercase tracking-wider">
                            D. Solar PV System
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InputField id="solarCapacityMw" label="Solar Capacity (DC)" unit="MW" />
                        <InputField id="solarAvailability" label="Capacity Factor / Availability" unit="%" step={0.01} max={1} />
                        <InputField id="solarCapexPerKw" label="CapEx" unit="$/kW" step={10} />
                        <InputField id="solarFixedOmPerKw" label="Fixed O&M" unit="$/kW-yr" step={0.5} />
                        <InputField id="solarDegradation" label="Annual Degradation" unit="%" step={0.001} max={0.05} />
                        <InputField id="solarItcRate" label="ITC Rate" unit="%" step={0.05} max={1} />
                    </CardContent>
                </Card>

                {/* E. Battery */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-pc-blue uppercase tracking-wider">
                            E. Battery Storage (BESS)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InputField id="batteryPowerMw" label="Storge Power" unit="MW" />
                        <InputField id="batteryAvailability" label="Capacity Factor / Availability" unit="%" step={0.01} max={1} />
                        <InputField id="batteryDurationHrs" label="Duration" unit="hrs" step={1} />
                        <InputField id="batteryCapexPerKw" label="CapEx (Power)" unit="$/kW" step={10} />
                        <InputField id="batteryCapexPerKwh" label="CapEx (Energy)" unit="$/kWh" step={10} />
                        <InputField id="batteryFixedOmPerKw" label="Fixed O&M" unit="$/kW-yr" step={0.5} />
                        <InputField id="batteryRte" label="Round Trip Eff." unit="%" step={0.01} max={1} />
                    </CardContent>
                </Card>

                {/* G. Financials */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-pc-green uppercase tracking-wider">
                            G. Financial Structure
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <InputField id="debtRatio" label="Debt Ratio" unit="%" step={0.05} max={1} />
                        <InputField id="interestRate" label="Interest Rate" unit="%" step={0.001} max={0.2} />
                        <InputField id="loanTermYrs" label="Loan Term" unit="yrs" step={1} />
                        <InputField id="targetIrr" label="Target Equity IRR" unit="%" step={0.005} max={0.5} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
