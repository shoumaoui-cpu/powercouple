"use client";

import { useFinancialsStore } from "@/store/useFinancialsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, AreaChart, Area, Brush } from "recharts";

export function ChartsSheet() {
    const results = useFinancialsStore((s) => s.results);

    if (!results) {
        return (
            <div className="p-6 max-w-7xl mx-auto pb-20 text-center pt-20">
                <h2 className="text-xl font-semibold text-white mb-2">No Data Available</h2>
                <p className="text-muted-foreground">Adjust inputs to run the simulation and generate charts.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20">
            <h2 className="text-xl font-semibold text-white">7. Visualization</h2>

            {/* Monthly Generation Stack */}
            <Card className="bg-pc-dark border-white/10">
                <CardHeader className="pb-3 border-b border-white/5">
                    <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                        Monthly Generation Stack
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={results.monthlyData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="month" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Generation (MWh)', angle: -90, position: 'insideLeft', fill: '#888' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #333' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend />

                            <Bar dataKey="solarMwh" name="Solar PV" stackId="a" fill="#f5c542" />
                            <Bar dataKey="batteryMwh" name="Battery Discharge" stackId="a" fill="#3b82f6" />
                            <Bar dataKey="gasMwh" name="Gas Gen" stackId="a" fill="#ef4444" />

                            <ReferenceLine y={0} stroke="#000" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Hourly Dispatch Profile */}
            <Card className="bg-pc-dark border-white/10">
                <CardHeader className="pb-3 border-b border-white/5">
                    <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">
                        Hourly Dispatch Profile (8760)
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Inspect hourly operation. Use the slider below to zoom into specific weeks/days.
                    </p>
                </CardHeader>
                <CardContent className="pt-6 h-[500px]">
                    {results.hourlyData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={results.hourlyData}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f5c542" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f5c542" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorBatt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="hour"
                                    stroke="#888"
                                    fontSize={12}
                                    tickFormatter={(val) => `Hr ${val}`}
                                />
                                <YAxis stroke="#888" fontSize={12} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1f2e', border: '1px solid #333' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelFormatter={(val) => `Hour ${val}`}
                                />
                                <Legend verticalAlign="top" />

                                {/* Stacked Areas */}
                                <Area type="monotone" dataKey="solar" stackId="1" stroke="#f5c542" fill="url(#colorSolar)" name="Solar PV" />
                                <Area type="monotone" dataKey="batteryDischarge" stackId="1" stroke="#3b82f6" fill="url(#colorBatt)" name="Battery Discharge" />
                                <Area type="monotone" dataKey="gasGen" stackId="1" stroke="#ef4444" fill="url(#colorGas)" name="Gas Gen" />

                                {/* Load Line */}
                                <Area type="step" dataKey="load" stroke="#ffffff" fill="transparent" strokeWidth={2} name="Load Req" />

                                {/* Brush for Zooming - defaulted to snippet */}
                                <Brush
                                    dataKey="hour"
                                    height={30}
                                    stroke="#eccb8d"
                                    startIndex={3600} // Start zooming in Summer (approx Hour 3600 = June)
                                    endIndex={3768}   // Show 1 week (168 hrs)
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No hourly data available. Run a full verification to generate.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
