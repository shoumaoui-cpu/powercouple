"use client";

import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { GasPlant, DispatchHour } from "@/types";

interface DispatchTabProps {
  plant: GasPlant;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function DispatchTab({ plant }: DispatchTabProps) {
  const optimizationResult = useAppStore((s) => s.optimizationResult);

  // Compute energy share percentages
  const energyShares = useMemo(() => {
    if (!optimizationResult?.hourlyDispatch) return null;

    const dispatch = optimizationResult.hourlyDispatch;
    let totalSolar = 0;
    let totalBattery = 0;
    let totalGas = 0;
    let totalLoad = 0;

    for (const h of dispatch) {
      totalSolar += Math.max(0, h.solarMw);
      totalBattery += Math.max(0, h.batteryMw); // only discharge
      totalGas += Math.max(0, h.gasMw);
      totalLoad += h.loadMw;
    }

    const totalServed = totalSolar + totalBattery + totalGas;
    if (totalServed === 0) return null;

    return {
      solarPct: (totalSolar / totalServed) * 100,
      batteryPct: (totalBattery / totalServed) * 100,
      gasPct: (totalGas / totalServed) * 100,
      totalLoad,
    };
  }, [optimizationResult]);

  // Prepare chart data -- use discharge only for stacking
  const chartData = useMemo(() => {
    if (!optimizationResult?.hourlyDispatch) return [];

    return optimizationResult.hourlyDispatch.map((h) => ({
      hour: h.hour,
      solar: Math.max(0, h.solarMw),
      battery: Math.max(0, h.batteryMw),
      gas: Math.max(0, h.gasMw),
      load: h.loadMw,
    }));
  }, [optimizationResult]);

  if (!optimizationResult) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-6 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-2 text-muted-foreground"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <p className="text-sm text-muted-foreground">
          Run optimization first to see dispatch profile.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          The dispatch chart shows how solar, battery, and gas serve the target
          load across representative days.
        </p>
      </div>
    );
  }

  if (!optimizationResult.hourlyDispatch || chartData.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No hourly dispatch data available for this optimization result.
        </p>
      </div>
    );
  }

  // Compute tick positions for month labels (288 hours = 12 months x 24 hours)
  const monthTicks = MONTH_LABELS.map((_, i) => i * 24);

  return (
    <div className="space-y-4">
      {/* Dispatch chart */}
      <Card className="border-border">
        <CardContent className="p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Hourly Dispatch Profile
          </p>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient
                    id="solarFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#FFC15E" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#FFC15E" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient
                    id="batteryFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#7799B6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#7799B6" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient
                    id="gasFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#e74c3c" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#e74c3c" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: "#999" }}
                  ticks={monthTicks}
                  tickFormatter={(h) => {
                    const monthIdx = Math.floor(h / 24);
                    return MONTH_LABELS[monthIdx] ?? "";
                  }}
                  stroke="#555"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#999" }}
                  tickFormatter={(v) => `${v}`}
                  label={{
                    value: "MW",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "#999" },
                  }}
                  stroke="#555"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a2e",
                    border: "1px solid #333",
                    borderRadius: "6px",
                    fontSize: "11px",
                  }}
                  labelFormatter={(h) => {
                    const monthIdx = Math.floor(Number(h) / 24);
                    const hourOfDay = Number(h) % 24;
                    return `${MONTH_LABELS[monthIdx] ?? "?"} - Hour ${hourOfDay}`;
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)} MW`,
                    name.charAt(0).toUpperCase() + name.slice(1),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="solar"
                  stackId="dispatch"
                  stroke="#FFC15E"
                  fill="url(#solarFill)"
                  strokeWidth={0}
                />
                <Area
                  type="monotone"
                  dataKey="battery"
                  stackId="dispatch"
                  stroke="#7799B6"
                  fill="url(#batteryFill)"
                  strokeWidth={0}
                />
                <Area
                  type="monotone"
                  dataKey="gas"
                  stackId="dispatch"
                  stroke="#e74c3c"
                  fill="url(#gasFill)"
                  strokeWidth={0}
                />
                <Line
                  type="monotone"
                  dataKey="load"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs">
            <LegendItem color="bg-pc-gold" label="Solar" />
            <LegendItem color="bg-pc-blue" label="Battery" />
            <LegendItem color="bg-pc-red" label="Gas" />
            <span className="flex items-center gap-1">
              <span className="inline-block h-px w-4 border-t border-dashed border-white" />
              <span className="text-muted-foreground">Load</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Energy share summary */}
      {energyShares && (
        <Card className="border-border">
          <CardContent className="p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Energy Served By Source
            </p>
            <div className="space-y-2">
              <ShareBar
                label="Solar"
                pct={energyShares.solarPct}
                color="bg-pc-gold"
                textColor="text-pc-gold"
              />
              <ShareBar
                label="Battery"
                pct={energyShares.batteryPct}
                color="bg-pc-blue"
                textColor="text-pc-blue"
              />
              <ShareBar
                label="Gas"
                pct={energyShares.gasPct}
                color="bg-pc-red"
                textColor="text-pc-red"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Helper sub-components ────────────────────────────────────────── */

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function ShareBar({
  label,
  pct,
  color,
  textColor,
}: {
  label: string;
  pct: number;
  color: string;
  textColor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-3 rounded bg-muted overflow-hidden">
        <div
          className={`h-full rounded ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`w-12 text-right text-xs font-mono font-semibold ${textColor}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
