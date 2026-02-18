"use client";

import { useFinancialsStore } from "@/store/useFinancialsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val: number, decimals = 1) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(val);
}

export function CalculationsSheet() {
    const results = useFinancialsStore((s) => s.results);
    const cap = results?.byoc?.capitalCosts;
    const mix = results?.byoc?.resourceMix;
    const curtail = results?.byoc?.curtailment;

    const totalProject = cap?.totalProjectCostUsd ?? 0;
    const totalByoc = cap?.totalByocCapexUsd ?? 0;
    const solarCapex = cap?.solarCapexUsd ?? 0;
    const battCapex = cap?.batteryCapexUsd ?? 0;
    const gasCapex = cap?.gasCapexUsd ?? 0;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            <h2 className="text-xl font-semibold text-white">2. Intermediate Calculations</h2>

            {!results?.byoc && (
                <p className="text-sm text-muted-foreground">
                    Run the simulation to populate calculation breakdown from the unified BYOC engine.
                </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* CapEx Breakdown */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                            Capital Stack (Engine Output)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-muted-foreground w-[200px]">Component</TableHead>
                                    <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">Powered Land</TableCell>
                                    <TableCell className="text-right">{formatCurrency(cap?.poweredLandCostUsd ?? 0)}</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium text-white">Data Center CapEx</TableCell>
                                    <TableCell className="text-right">{formatCurrency(cap?.totalDataCenterCapexUsd ?? 0)}</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium text-pc-gold">Solar PV</TableCell>
                                    <TableCell className="text-right">{formatCurrency(solarCapex)}</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium text-pc-blue">Battery Storage</TableCell>
                                    <TableCell className="text-right">{formatCurrency(battCapex)}</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium text-pc-red">Natural Gas</TableCell>
                                    <TableCell className="text-right">{formatCurrency(gasCapex)}</TableCell>
                                </TableRow>
                                <TableRow className="border-t border-white/10 font-bold bg-white/5 hover:bg-white/5">
                                    <TableCell>Total Project Cost</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalProject)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* OpEx Breakdown */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                            Resource Mix & Curtailment
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-muted-foreground w-[200px]">Metric</TableHead>
                                    <TableHead className="text-right text-muted-foreground">Value</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium">Solar / Battery / Gas</TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(mix?.solarMw ?? 0)} / {formatNumber(mix?.batteryPowerMw ?? 0)} / {formatNumber(mix?.gasMw ?? 0)} MW
                                    </TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium">ESA Capacity</TableCell>
                                    <TableCell className="text-right">{formatNumber(mix?.esaMw ?? 0)} MW</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium">Coverage Ratio</TableCell>
                                    <TableCell className="text-right">{formatNumber(mix?.coverageRatio ?? 0, 3)}x</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium">Est. Curtailment</TableCell>
                                    <TableCell className="text-right">{formatNumber(curtail?.estimatedAnnualCurtailmentMwh ?? 0)} MWh</TableCell>
                                </TableRow>
                                <TableRow className="border-t border-white/10 font-bold bg-white/5 hover:bg-white/5">
                                    <TableCell>Annual Curtailment Loss</TableCell>
                                    <TableCell className="text-right">{formatCurrency(curtail?.annualRevenueLostUsd ?? 0)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Key Performance Indicators derived from Calculation */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: "BYOC CapEx", val: totalByoc, currency: true },
                    { label: "Total Project Cost", val: totalProject, currency: true },
                    { label: "Firm Coverage", val: (mix?.coverageRatio ?? 0) * 100, unit: "%" },
                    { label: "Curtailment Cost", val: curtail?.weightedAverageCurtailmentCostUsdPerMwh ?? 0, currency: true },
                ].map((item, i) => (
                    <Card key={i} className="bg-pc-dark-secondary border-white/10">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">{item.label}</p>
                            <p className="text-2xl font-mono text-white">
                                {item.currency ? "$" : ""}{formatNumber(item.val, 1)}{item.unit}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
