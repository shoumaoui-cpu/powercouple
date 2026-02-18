"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { LCOEBreakdown } from "@/components/charts/LCOEBreakdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMw } from "@/lib/utils";
import type { RegionStats } from "@/types";

export default function ComparePage() {
  const [regions, setRegions] = useState<RegionStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then(setRegions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-pc-dark">
      <Navigation />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-wider">
            LCOE Comparison
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Regional comparison of gas-only vs. hybrid solar+storage LCOE
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground font-mono text-sm">
            Loading regional data...
          </div>
        ) : (
          <>
            {/* Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  LCOE by Region ($/MWh)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LCOEBreakdown data={regions} />
              </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Region Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                          Region
                        </th>
                        <th className="pb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                          Plants
                        </th>
                        <th className="pb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                          Total Capacity
                        </th>
                        <th className="pb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                          Avg CF
                        </th>
                        <th className="pb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                          Gas-Only LCOE
                        </th>
                        <th className="pb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                          Hybrid LCOE
                        </th>
                        <th className="pb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground text-right">
                          Savings
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {regions.map((r) => {
                        const savings =
                          r.avgLcoeGasOnly && r.avgLcoeHybrid
                            ? (
                                ((r.avgLcoeGasOnly - r.avgLcoeHybrid) /
                                  r.avgLcoeGasOnly) *
                                100
                              ).toFixed(1)
                            : null;
                        return (
                          <tr
                            key={r.region}
                            className="border-b border-border/50 hover:bg-accent/30"
                          >
                            <td className="py-2 font-medium">{r.region}</td>
                            <td className="py-2 text-right">{r.plantCount}</td>
                            <td className="py-2 text-right">
                              {formatMw(r.totalCapacityMw)}
                            </td>
                            <td className="py-2 text-right">
                              {(r.avgCapacityFactor * 100).toFixed(1)}%
                            </td>
                            <td className="py-2 text-right text-pc-red">
                              {r.avgLcoeGasOnly
                                ? `$${Math.round(r.avgLcoeGasOnly)}`
                                : "N/A"}
                            </td>
                            <td className="py-2 text-right text-pc-green">
                              {r.avgLcoeHybrid
                                ? `$${Math.round(r.avgLcoeHybrid)}`
                                : "N/A"}
                            </td>
                            <td className="py-2 text-right">
                              {savings ? (
                                <span className="text-pc-green font-medium">
                                  {savings}%
                                </span>
                              ) : (
                                "N/A"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
