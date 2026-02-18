"use client";

import { useFinancialsStore } from "@/store/useFinancialsStore";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

export function CashFlowSheet() {
    const results = useFinancialsStore((s) => s.results);
    const annualRows = useMemo(() => results?.byoc?.annualCashFlow ?? [], [results?.byoc?.annualCashFlow]);

    // ─── Projections ────────────────────────────────────────────────────
    const years = annualRows.map((r) => r.year);

    // Prepare Chart Data
    const chartData = useMemo(() => {
        return annualRows.map((r) => {
            const net = r.netFreeCashFlowUsd;
            return {
                year: r.year,
                yearLabel: `Yr ${r.year}`,
                Revenue: r.grossRevenueUsd,
                OpEx: r.totalPowerCostsUsd + r.totalOpexUsd + r.curtailmentLossUsd,
                Debt: 0,
                Net: net > 0 ? net : 0, // Visual clamp for stacked chart
                NetActual: net
            };
        });
    }, [annualRows]);

    if (!results?.byoc?.annualCashFlow || results.byoc.annualCashFlow.length === 0) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
                <h2 className="text-xl font-semibold text-white">4. Cash Flow Waterfall</h2>
                <p className="text-sm text-muted-foreground">Run the simulation to populate annual cash flow from the BYOC engine.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            <h2 className="text-xl font-semibold text-white">4. Cash Flow Waterfall</h2>

            <Card className="bg-pc-dark border-white/10 overflow-hidden">
                <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                    <div className="flex w-max space-x-4 p-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="w-[200px] sticky left-0 bg-pc-dark z-10 border-r border-white/5 font-bold text-white">Line Item</TableHead>
                                    {years.map((y) => (
                                        <TableHead key={y} className="text-right min-w-[100px] text-muted-foreground">Year {y}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Revenue / Savings */}
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="sticky left-0 bg-pc-dark z-10 border-r border-white/5 font-medium text-pc-green">Gross Revenue</TableCell>
                                    {annualRows.map((row) => {
                                        return <TableCell key={row.year} className="text-right">{formatCurrency(row.grossRevenueUsd)}</TableCell>;
                                    })}
                                </TableRow>

                                {/* OpEx */}
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="sticky left-0 bg-pc-dark z-10 border-r border-white/5 font-medium text-pc-red">Total OpEx</TableCell>
                                    {annualRows.map((row) => {
                                        return <TableCell key={row.year} className="text-right text-muted-foreground">({formatCurrency(row.totalPowerCostsUsd + row.totalOpexUsd + row.curtailmentLossUsd)})</TableCell>;
                                    })}
                                </TableRow>

                                {/* EBITDA */}
                                <TableRow className="border-white/5 hover:bg-white/5 font-bold bg-white/5">
                                    <TableCell className="sticky left-0 bg-pc-dark-secondary z-10 border-r border-white/5">EBITDA</TableCell>
                                    {annualRows.map((row) => {
                                        return <TableCell key={row.year} className="text-right">{formatCurrency(row.ebitdaUsd)}</TableCell>;
                                    })}
                                </TableRow>

                                {/* Debt Service */}
                                <TableRow className="border-white/5 hover:bg-white/5">
                                    <TableCell className="sticky left-0 bg-pc-dark z-10 border-r border-white/5 font-medium text-pc-red">Debt Service</TableCell>
                                    {annualRows.map((row) => {
                                        return <TableCell key={row.year} className="text-right text-muted-foreground">-</TableCell>;
                                    })}
                                </TableRow>

                                {/* Cash Flow Available for Equity */}
                                <TableRow className="border-white/5 hover:bg-white/5 font-bold border-t border-white/10 text-white">
                                    <TableCell className="sticky left-0 bg-pc-dark z-10 border-r border-white/5">Net Cash Flow</TableCell>
                                    {annualRows.map((row) => {
                                        return <TableCell key={row.year} className="text-right font-mono text-pc-gold">
                                            {formatCurrency(row.netFreeCashFlowUsd)}
                                        </TableCell>;
                                    })}
                                </TableRow>

                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </div>
                </ScrollArea>
            </Card>


            {/* Visual Waterfall */}
            <h2 className="text-xl font-semibold text-white pt-6">Annual Cash Flow Visualization</h2>
            <Card className="bg-pc-dark border-white/10 p-6">
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis
                                dataKey="yearLabel"
                                stroke="#ffffff50"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#ffffff50"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => `$${val / 1000000}M`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1a1b26", borderColor: "#ffffff20", borderRadius: "8px" }}
                                itemStyle={{ color: "#fff" }}
                                formatter={(val: number) => formatCurrency(val)}
                            />
                            <Legend wrapperStyle={{ paddingTop: "20px" }} />

                            {/* Stacked Bars representing Composition of Revenue */}
                            <Bar dataKey="OpEx" stackId="a" fill="#ef4444" name="OpEx" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Debt" stackId="a" fill="#f59e0b" name="Debt Service" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Net" stackId="a" fill="#22c55e" name="Net Cash Flow" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div >
    );
}
