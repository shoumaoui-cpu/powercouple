"use client";

import { useFinancialsStore } from "@/store/useFinancialsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function SensitivitySheet() {
    const sensitivityData = useFinancialsStore((s) => s.sensitivityData);
    const inputs = useFinancialsStore((s) => s.inputs);

    const hasDynamicAxes = sensitivityData.some((d) => d.xValue !== undefined && d.yValue !== undefined);
    const xLabel = hasDynamicAxes ? (sensitivityData[0]?.xLabel ?? "X") : "Solar (x)";
    const yLabel = hasDynamicAxes ? (sensitivityData[0]?.yLabel ?? "Y") : "Batt (h)";
    const zLabel = hasDynamicAxes ? (sensitivityData[0]?.zLabel ?? "Value") : "LCOE ($/MWh)";

    // Group data for heatmap: Rows = Battery Duration, Cols = Solar Multiple
    // Extract unique values
    const uniqueSolarMultiples = hasDynamicAxes
        ? Array.from(new Set(sensitivityData.map((d) => d.xValue ?? 0))).sort((a, b) => a - b)
        : Array.from(new Set(sensitivityData.map((d) => Math.round(((d.solarMw ?? 0) / inputs.totalItCapacityMw) * 10) / 10))).sort((a, b) => a - b);
    const uniqueDurations = hasDynamicAxes
        ? Array.from(new Set(sensitivityData.map((d) => d.yValue ?? 0))).sort((a, b) => a - b)
        : Array.from(new Set(sensitivityData.map((d) => d.batteryDurationHrs ?? 0))).sort((a, b) => a - b);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            <h2 className="text-xl font-semibold text-white">6. Sensitivity Analysis</h2>

            {sensitivityData.length === 0 ? (
                <Alert className="bg-pc-dark-secondary border-pc-gold/20 text-pc-gold">
                    <Info className="h-4 w-4" />
                    <AlertTitle>No Sensitivity Data</AlertTitle>
                    <AlertDescription>
                        Please run the <strong>Optimization</strong> in the Returns tab to generate sensitivity data.
                    </AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-6">
                    {/* Heatmap */}
                    <Card className="bg-pc-dark border-white/10 overflow-hidden">
                        <CardHeader className="pb-3 border-b border-white/5">
                            <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                                {hasDynamicAxes
                                    ? `${zLabel} Heatmap: ${xLabel} vs ${yLabel}`
                                    : "LCOE Heatmap: Solar Multiple vs Battery Duration ($/MWh)"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 overflow-x-auto">
                            <div className="min-w-[600px]">
                                {/* Header Row (Solar Multiples) */}
                                <div className="flex">
                                    <div className="w-24 shrink-0 flex items-end justify-center pb-2 font-bold text-xs text-muted-foreground">
                                        {yLabel} \ {xLabel}
                                    </div>
                                    {uniqueSolarMultiples.map(mul => (
                                        <div key={mul} className="flex-1 text-center font-bold text-sm text-white pb-2 border-b border-white/10">
                                            {hasDynamicAxes ? mul.toFixed(1) : `${mul.toFixed(1)}x`}
                                        </div>
                                    ))}
                                </div>

                                {/* Data Rows (Durations) */}
                                {uniqueDurations.map(dur => (
                                    <div key={dur} className="flex h-12 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                        <div className="w-24 shrink-0 flex items-center justify-center font-bold text-sm text-white border-r border-white/10 bg-white/5">
                                            {hasDynamicAxes ? dur.toFixed(1) : `${dur}h`}
                                        </div>
                                        {uniqueSolarMultiples.map(mul => {
                                            const point = hasDynamicAxes
                                                ? sensitivityData.find((d) =>
                                                    Math.abs((d.yValue ?? 0) - dur) < 0.0001 &&
                                                    Math.abs((d.xValue ?? 0) - mul) < 0.0001
                                                )
                                                : (() => {
                                                    const mw = Math.round(mul * inputs.totalItCapacityMw);
                                                    return sensitivityData.find((d) =>
                                                        Math.abs((d.batteryDurationHrs ?? 0) - dur) < 0.1 &&
                                                        Math.abs((d.solarMw ?? 0) - mw) < 1
                                                    );
                                                })();

                                            // Color scale logic (Green = Low LCOE, Red = High)
                                            // Find global min/max for scaling
                                            const values = sensitivityData.map((d) => hasDynamicAxes ? (d.zValue ?? 0) : (d.lcoe ?? 0));
                                            const minLcoe = Math.min(...values);
                                            const maxLcoe = Math.max(...values);
                                            const val = hasDynamicAxes ? (point?.zValue ?? 0) : (point?.lcoe ?? 0);

                                            // Normalize 0-1
                                            const norm = (val - minLcoe) / (maxLcoe - minLcoe || 1);

                                            // Color: Green (120 hue) to Red (0 hue). Low LCOE is Green (120). High is Red.
                                            const hue = 120 - (norm * 120);
                                            const bgColor = `hsla(${hue}, 70%, 30%, 0.3)`;
                                            const textColor = `hsl(${hue}, 90%, 70%)`;

                                            return (
                                                <div
                                                    key={mul}
                                                    className="flex-1 flex items-center justify-center font-mono text-sm font-semibold relative group"
                                                    style={{ backgroundColor: bgColor, color: textColor }}
                                                    title={hasDynamicAxes
                                                        ? `${zLabel}: ${val.toFixed(2)}`
                                                        : `LCOE: $${val.toFixed(2)} | RF: ${(((point?.renewableFraction ?? 0) * 100)).toFixed(1)}%`}
                                                >
                                                    {hasDynamicAxes ? val.toFixed(1) : `$${val.toFixed(0)}`}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
