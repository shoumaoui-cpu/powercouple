"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { RegionStats } from "@/types";

interface LCOEBreakdownProps {
  data: RegionStats[];
}

export function LCOEBreakdown({ data }: LCOEBreakdownProps) {
  const chartData = data
    .filter((r) => r.avgLcoeGasOnly != null || r.avgLcoeHybrid != null)
    .map((r) => ({
      region: r.region,
      "Gas Only": r.avgLcoeGasOnly ? Math.round(r.avgLcoeGasOnly) : 0,
      Hybrid: r.avgLcoeHybrid ? Math.round(r.avgLcoeHybrid) : 0,
      plants: r.plantCount,
    }))
    .sort((a, b) => a.Hybrid - b.Hybrid);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No LCOE data available
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="region"
            tick={{ fill: "#a3a3a3", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
          />
          <YAxis
            label={{
              value: "LCOE ($/MWh)",
              angle: -90,
              position: "insideLeft",
              fill: "#a3a3a3",
              fontSize: 12,
            }}
            tick={{ fill: "#a3a3a3", fontSize: 12 }}
            axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#16213e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#eaeaea",
            }}
            formatter={(value: number, name: string) => [
              `$${value}/MWh`,
              name,
            ]}
          />
          <Legend />
          <Bar
            dataKey="Gas Only"
            fill="#e74c3c"
            radius={[4, 4, 0, 0]}
            opacity={0.8}
          />
          <Bar
            dataKey="Hybrid"
            fill="#4ecca3"
            radius={[4, 4, 0, 0]}
            opacity={0.8}
          />
          {/* Reference lines for announced data center power contracts */}
          <ReferenceLine
            y={100}
            stroke="#FFC15E"
            strokeDasharray="4 4"
            label={{
              value: "TMI ~$100",
              fill: "#FFC15E",
              fontSize: 10,
              position: "right",
            }}
          />
          <ReferenceLine
            y={85}
            stroke="#7799B6"
            strokeDasharray="4 4"
            label={{
              value: "Susquehanna ~$85",
              fill: "#7799B6",
              fontSize: 10,
              position: "right",
            }}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Chart Key */}
      <div className="mt-4 p-3 rounded-lg border border-border bg-muted/20">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Reference Lines Key
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-start gap-2">
            <div className="mt-1.5 w-6 border-t-2 border-dashed border-[#FFC15E] shrink-0" />
            <div>
              <span className="font-semibold text-[#FFC15E]">TMI ~$100/MWh</span>
              <p className="text-muted-foreground mt-0.5">
                Three Mile Island (Constellation) restart PPA with Microsoft
                for nuclear-powered data center capacity in PJM.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-1.5 w-6 border-t-2 border-dashed border-[#7799B6] shrink-0" />
            <div>
              <span className="font-semibold text-[#7799B6]">Susquehanna ~$85/MWh</span>
              <p className="text-muted-foreground mt-0.5">
                Susquehanna nuclear plant (Talen Energy) direct PPA with
                Amazon Web Services for behind-the-meter data center power.
              </p>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 italic">
          These reference lines represent publicly announced power purchase agreements
          for data center loads, providing market context for hybrid LCOE competitiveness.
        </p>
      </div>
    </div>
  );
}
