"use client";

import { useFinancialsStore } from "@/store/useFinancialsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

export function SourcesUsesSheet() {
    const results = useFinancialsStore((s) => s.results);
    const cap = results?.byoc?.capitalCosts;

    const poweredLand = cap?.poweredLandCostUsd ?? 0;
    const dataCenter = cap?.totalDataCenterCapexUsd ?? 0;
    const solarCapex = cap?.solarCapexUsd ?? 0;
    const battCapex = cap?.batteryCapexUsd ?? 0;
    const genCapex = cap?.gasCapexUsd ?? 0;
    const totalUses = cap?.totalProjectCostUsd ?? 0;
    const sponsorEquity = totalUses;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            <h2 className="text-xl font-semibold text-white">3. Sources & Uses</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Uses Table */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                            Uses of Funds
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-muted-foreground">Item</TableHead>
                                    <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                                    <TableHead className="text-right text-muted-foreground">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="border-white/5 hover:bg-white/5 group">
                                    <TableCell className="font-medium text-white">Powered Land</TableCell>
                                    <TableCell className="text-right">{formatCurrency(poweredLand)}</TableCell>
                                    <TableCell className="text-right">{totalUses > 0 ? (poweredLand / totalUses * 100).toFixed(1) : "0.0"}%</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5 group">
                                    <TableCell className="font-medium text-white">Data Center Construction</TableCell>
                                    <TableCell className="text-right">{formatCurrency(dataCenter)}</TableCell>
                                    <TableCell className="text-right">{totalUses > 0 ? (dataCenter / totalUses * 100).toFixed(1) : "0.0"}%</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5 group">
                                    <TableCell className="font-medium text-pc-gold">Solar EPC</TableCell>
                                    <TableCell className="text-right">{formatCurrency(solarCapex)}</TableCell>
                                    <TableCell className="text-right">{totalUses > 0 ? (solarCapex / totalUses * 100).toFixed(1) : "0.0"}%</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5 group">
                                    <TableCell className="font-medium text-pc-blue">Battery EPC</TableCell>
                                    <TableCell className="text-right">{formatCurrency(battCapex)}</TableCell>
                                    <TableCell className="text-right">{totalUses > 0 ? (battCapex / totalUses * 100).toFixed(1) : "0.0"}%</TableCell>
                                </TableRow>
                                <TableRow className="border-white/5 hover:bg-white/5 group">
                                    <TableCell className="font-medium text-pc-red">Natural Gas EPC</TableCell>
                                    <TableCell className="text-right">{formatCurrency(genCapex)}</TableCell>
                                    <TableCell className="text-right">{totalUses > 0 ? (genCapex / totalUses * 100).toFixed(1) : "0.0"}%</TableCell>
                                </TableRow>
                                <TableRow className="border-t border-white/10 font-bold bg-white/5">
                                    <TableCell>Total Uses</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalUses)}</TableCell>
                                    <TableCell className="text-right">100.0%</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Sources Table */}
                <Card className="bg-pc-dark border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                            Sources of Funds
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-muted-foreground">Source</TableHead>
                                    <TableHead className="text-right text-muted-foreground">Amount</TableHead>
                                    <TableHead className="text-right text-muted-foreground">%</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="font-medium text-pc-green">Sponsor Equity</TableCell>
                                    <TableCell className="text-right">{formatCurrency(sponsorEquity)}</TableCell>
                                    <TableCell className="text-right">100.0%</TableCell>
                                </TableRow>
                                <TableRow className="border-t border-white/10 font-bold bg-white/5">
                                    <TableCell>Total Sources</TableCell>
                                    <TableCell className="text-right">{formatCurrency(sponsorEquity)}</TableCell>
                                    <TableCell className="text-right">{totalUses > 0 ? ((sponsorEquity / totalUses) * 100).toFixed(1) : "0.0"}%</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
