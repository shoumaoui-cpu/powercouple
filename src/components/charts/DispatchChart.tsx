"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DispatchHour } from "@/types";

interface DispatchChartProps {
  data: DispatchHour[];
  height?: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function DispatchChart({ data, height = 350 }: DispatchChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      hour: d.hour,
      Solar: Math.max(0, d.solarMw),
      Battery: Math.max(0, d.batteryMw),
      Gas: Math.max(0, d.gasMw),
      Load: d.loadMw,
      "Battery Charge": Math.min(0, d.batteryMw),
      SOC: d.soc * 100,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No dispatch data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="hour"
          tick={{ fill: "#a3a3a3", fontSize: 10 }}
          axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
          tickFormatter={(hour: number) => {
            if (data.length <= 288) {
              const monthIdx = Math.floor(hour / 24);
              return monthIdx < 12 ? MONTH_LABELS[monthIdx] : "";
            }
            const dayOfYear = Math.floor(hour / 24);
            const monthIdx = Math.floor(dayOfYear / 30.4);
            return monthIdx < 12 ? MONTH_LABELS[monthIdx] : "";
          }}
          interval={data.length <= 288 ? 23 : Math.floor(data.length / 12)}
        />
        <YAxis
          tick={{ fill: "#a3a3a3", fontSize: 10 }}
          axisLine={{ stroke: "rgba(255,255,255,0.2)" }}
          label={{
            value: "MW",
            angle: -90,
            position: "insideLeft",
            fill: "#a3a3a3",
            fontSize: 11,
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#16213e",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#eaeaea",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            `${value.toFixed(1)} MW`,
            name,
          ]}
          labelFormatter={(hour: number) => {
            if (data.length <= 288) {
              const monthIdx = Math.floor(hour / 24);
              const hourOfDay = hour % 24;
              return `${MONTH_LABELS[monthIdx] ?? "?"} ${hourOfDay}:00`;
            }
            return `Hour ${hour}`;
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="Solar"
          stackId="dispatch"
          fill="#FFC15E"
          stroke="#FFC15E"
          fillOpacity={0.7}
        />
        <Area
          type="monotone"
          dataKey="Battery"
          stackId="dispatch"
          fill="#7799B6"
          stroke="#7799B6"
          fillOpacity={0.7}
        />
        <Area
          type="monotone"
          dataKey="Gas"
          stackId="dispatch"
          fill="#e74c3c"
          stroke="#e74c3c"
          fillOpacity={0.7}
        />
        <Line
          type="monotone"
          dataKey="Load"
          stroke="#ffffff"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
