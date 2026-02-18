"use client";

import { useFinancialsStore } from "@/store/useFinancialsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatPercent(val: number) {
    return new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val);
}

import { Progress } from "@/components/ui/progress";

export function ReturnsSheet() {
    const inputs = useFinancialsStore((s) => s.inputs);
    const results = useFinancialsStore((s) => s.results);
    const optimalResults = useFinancialsStore((s) => s.optimalResults);
    const isOptimizing = useFinancialsStore((s) => s.isOptimizing);
    const optimizationProgress = useFinancialsStore((s) => s.optimizationProgress);
    const triggerOptimization = useFinancialsStore((s) => s.triggerOptimization);

    // Compute metrics from results (or use placeholders)
    const lcoe = results?.lcoe ?? 0;
    const irr = results?.irr ?? 0;
    const npv = results?.npv ?? 0;
    const renewableFraction = results?.renewableFraction ?? 0;
    const byocSummary = results?.byoc?.summaryKpis;
    const payback = byocSummary?.paybackPeriodYears;
    const moic = byocSummary?.moic ?? 0;
    const coverage = byocSummary?.coverageRatio ?? 0;
    const curtailLoss = byocSummary?.annualRevenueLostUsd ?? 0;
    const requiredLoadMw = inputs.totalItCapacityMw * inputs.pue;
    const modelAnnualLoadMwh = results?.annualLoadMwh ?? 0;
    const optimizedAnnualLoadMwh = optimalResults?.annualLoadMwh ?? 0;
    const modelAnnualGasMwh = results?.annualGasBurnMwh ?? 0;
    const optimizedAnnualGasMwh = optimalResults?.annualGasBurnMwh ?? 0;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">5. Returns & Comparison</h2>
                <Button
                    variant="outline"
                    className="border-pc-gold text-pc-gold hover:bg-pc-gold/10"
                    onClick={triggerOptimization}
                    disabled={isOptimizing}
                >
                    {isOptimizing ? "Running..." : "Refresh Analysis / Optimize"}
                </Button>
            </div>

            {/* Main Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-pc-dark border-white/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Levelized Cost (LCOE)</p>
                        <p className="text-3xl font-mono font-bold text-pc-green">${lcoe.toFixed(1)}/MWh</p>
                    </CardContent>
                </Card>
                <Card className="bg-pc-dark border-white/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Levered IRR</p>
                        <p className="text-3xl font-mono font-bold text-pc-gold">{formatPercent(irr)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-pc-dark border-white/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Net Present Value</p>
                        <p className="text-3xl font-mono font-bold text-white">{formatCurrency(npv)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-pc-dark border-white/10">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Renewable Fraction</p>
                        <p className="text-3xl font-mono font-bold text-pc-blue">{formatPercent(renewableFraction)}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-pc-dark border-white/10">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">MOIC</p>
                        <p className="text-2xl font-mono font-bold text-white">{moic.toFixed(2)}x</p>
                    </CardContent>
                </Card>
                <Card className="bg-pc-dark border-white/10">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Payback</p>
                        <p className="text-2xl font-mono font-bold text-white">{payback != null ? `${payback.toFixed(1)} yrs` : "N/A"}</p>
                    </CardContent>
                </Card>
                <Card className="bg-pc-dark border-white/10">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Firm Coverage</p>
                        <p className="text-2xl font-mono font-bold text-pc-green">{coverage.toFixed(3)}x</p>
                    </CardContent>
                </Card>
                <Card className="bg-pc-dark border-white/10">
                    <CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Curtailment Loss</p>
                        <p className="text-2xl font-mono font-bold text-pc-red">{formatCurrency(curtailLoss)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Comparison Table */}
            <Card className="bg-pc-dark border-white/10">
                <CardHeader className="pb-3 border-b border-white/5">
                    <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                        Resource Mix Comparison
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="rounded-md border border-white/10 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow className="border-white/10 hover:bg-transparent">
                                    <TableHead className="w-[200px] text-white font-bold">Metric</TableHead>
                                    <TableHead className="text-center text-white font-bold relative overflow-visible">
                                        Your Model
                                        {optimalResults && lcoe < optimalResults.lcoe && (
                                            <div className="absolute -top-3 right-0 bg-pc-green text-pc-dark text-[9px] px-1.5 py-0.5 rounded font-bold">RECOMMENDED</div>
                                        )}
                                    </TableHead>
                                    <TableHead className="text-center text-pc-gold font-bold relative overflow-visible">
                                        Optimizer
                                        {optimalResults && optimalResults.lcoe <= lcoe && (
                                            <div className="absolute -top-3 right-0 bg-pc-gold text-pc-dark text-[9px] px-1.5 py-0.5 rounded font-bold">RECOMMENDED</div>
                                        )}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Calculated Load Requirement */}
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-muted-foreground">Required Load (IT + PUE)</TableCell>
                                    <TableCell className="text-center font-mono">{requiredLoadMw.toFixed(1)} MW</TableCell>
                                    <TableCell className="text-center font-mono">{requiredLoadMw.toFixed(1)} MW</TableCell>
                                </TableRow>
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-muted-foreground">Annual Required Energy</TableCell>
                                    <TableCell className="text-center font-mono">{modelAnnualLoadMwh.toFixed(0)} MWh</TableCell>
                                    <TableCell className="text-center font-mono">{optimizedAnnualLoadMwh.toFixed(0)} MWh</TableCell>
                                </TableRow>

                                {/* Solar */}
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">Solar Capacity</TableCell>
                                    <TableCell className="text-center font-mono">{inputs.solarCapacityMw.toFixed(0)} MW</TableCell>
                                    <TableCell className="text-center font-mono text-pc-gold">
                                        {optimalResults ? `${optimalResults.systemConfig.solarCapacityMw.toFixed(0)} MW` : "--"}
                                    </TableCell>
                                </TableRow>

                                {/* Battery */}
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">Battery Storage</TableCell>
                                    <TableCell className="text-center font-mono">{inputs.batteryPowerMw.toFixed(0)} MW / {inputs.batteryDurationHrs}h</TableCell>
                                    <TableCell className="text-center font-mono text-pc-gold">
                                        {optimalResults ? `${optimalResults.systemConfig.batteryPowerMw.toFixed(0)} MW / ${optimalResults.systemConfig.batteryDurationHrs}h` : "--"}
                                    </TableCell>
                                </TableRow>

                                {/* Gas Capacity */}
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">Gas Capacity</TableCell>
                                    <TableCell className="text-center font-mono">{inputs.genCapacityMw.toFixed(0)} MW</TableCell>
                                    <TableCell className="text-center font-mono text-pc-gold">
                                        {optimalResults ? `${optimalResults.systemConfig.genCapacityMw.toFixed(0)} MW` : "--"}
                                    </TableCell>
                                </TableRow>
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">Annual Gas Generation</TableCell>
                                    <TableCell className="text-center font-mono">{modelAnnualGasMwh.toFixed(0)} MWh</TableCell>
                                    <TableCell className="text-center font-mono text-pc-gold">
                                        {optimalResults ? `${optimizedAnnualGasMwh.toFixed(0)} MWh` : "--"}
                                    </TableCell>
                                </TableRow>

                                {/* LCOE */}
                                <TableRow className="border-white/10 hover:bg-white/5 bg-white/5">
                                    <TableCell className="font-bold text-white">Levelized Cost (LCOE)</TableCell>
                                    <TableCell className="text-center font-bold font-mono text-lg text-pc-green">
                                        ${lcoe.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">/MWh</span>
                                    </TableCell>
                                    <TableCell className="text-center font-bold font-mono text-lg text-pc-gold">
                                        {optimalResults ? `$${optimalResults.lcoe.toFixed(1)}` : "--"} <span className="text-xs font-normal text-muted-foreground">/MWh</span>
                                    </TableCell>
                                </TableRow>

                                {/* Initial CapEx (Net) */}
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">
                                        Initial CapEx (Net)
                                        <div className="text-[10px] text-muted-foreground font-normal">After approx. 30% ITC</div>
                                    </TableCell>
                                    <TableCell className="text-center font-mono">
                                        {/* Estimate Net CapEx for User Model */}
                                        {(() => {
                                            const itc = inputs.solarItcRate || 0.30;
                                            const s = inputs.solarCapacityMw * 1000 * inputs.solarCapexPerKw * (1 - itc);
                                            const b = ((inputs.batteryPowerMw * 1000 * inputs.batteryCapexPerKw) + (inputs.batteryPowerMw * inputs.batteryDurationHrs * 1000 * inputs.batteryCapexPerKwh)) * (1 - itc);
                                            const g = inputs.genCapacityMw * 1000 * inputs.genCapexPerKw;
                                            return formatCurrency(s + b + g);
                                        })()}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-pc-gold">
                                        {/* We'd need to calculate this for optimal, but valid approximation for display if we re-run sim */}
                                        {optimalResults ? "Calculated in Sim" : "--"}
                                    </TableCell>
                                </TableRow>

                                {/* Renewable Fraction */}
                                <TableRow className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">Renewable %</TableCell>
                                    <TableCell className="text-center font-mono text-pc-blue">
                                        {formatPercent(renewableFraction)}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-pc-blue">
                                        {optimalResults ? formatPercent(optimalResults.renewableFraction) : "--"}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <div className="w-[300px]">
                            <Button
                                className="w-full bg-pc-gold hover:bg-pc-gold/90 text-pc-dark font-bold relative"
                                onClick={triggerOptimization}
                                disabled={isOptimizing}
                            >
                                {isOptimizing ? "Running Optimization..." : "Run Optimizer Analysis"}
                                {isOptimizing && (
                                    <div className="absolute inset-x-0 -bottom-2">
                                        <Progress value={optimizationProgress} className="h-1 bg-pc-dark" />
                                    </div>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isOptimizing && (
                <div className="text-center text-pc-gold animate-pulse text-sm">
                    Simulating 80+ configurations over 8760 hours...
                </div>
            )}

        </div>
    );
}
