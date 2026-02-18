"use client";

import { useMemo } from "react";

interface HeatmapChartProps {
  /** 8760 or 288 hourly values (e.g., capacity factors, demand) */
  data: number[];
  /** Color scale: "solar" (yellow), "demand" (blue-red), "conflict" (green-red) */
  colorScale?: "solar" | "demand" | "conflict";
  /** Label for the color bar */
  label?: string;
  height?: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function interpolateColor(
  t: number,
  scale: "solar" | "demand" | "conflict"
): string {
  const clamp = Math.max(0, Math.min(1, t));

  switch (scale) {
    case "solar": {
      // dark -> gold -> bright yellow
      const r = Math.round(26 + clamp * (255 - 26));
      const g = Math.round(26 + clamp * (193 - 26));
      const b = Math.round(46 + clamp * (94 - 46));
      return `rgb(${r},${g},${b})`;
    }
    case "demand": {
      // blue -> white -> red
      if (clamp < 0.5) {
        const s = clamp * 2;
        const r = Math.round(40 + s * (255 - 40));
        const g = Math.round(80 + s * (255 - 80));
        const b = Math.round(180 + s * (255 - 180));
        return `rgb(${r},${g},${b})`;
      }
      const s = (clamp - 0.5) * 2;
      const r = Math.round(255);
      const g = Math.round(255 - s * (255 - 74));
      const b = Math.round(255 - s * (255 - 60));
      return `rgb(${r},${g},${b})`;
    }
    case "conflict": {
      // green -> yellow -> red
      if (clamp < 0.5) {
        const s = clamp * 2;
        const r = Math.round(78 + s * (255 - 78));
        const g = Math.round(204 + s * (193 - 204));
        const b = Math.round(163 - s * 163);
        return `rgb(${r},${g},${b})`;
      }
      const s = (clamp - 0.5) * 2;
      const r = Math.round(255);
      const g = Math.round(193 - s * (193 - 74));
      const b = Math.round(s * 60);
      return `rgb(${r},${g},${b})`;
    }
  }
}

export function HeatmapChart({
  data,
  colorScale = "solar",
  label = "Value",
  height = 200,
}: HeatmapChartProps) {
  const { grid, maxVal, isRepresentative } = useMemo(() => {
    if (data.length === 0) return { grid: [], maxVal: 0, isRepresentative: false };

    const isRep = data.length <= 288;
    const hoursPerDay = 24;
    const days = isRep ? 12 : Math.ceil(data.length / hoursPerDay);
    const maxV = Math.max(...data.filter(Number.isFinite));

    // Build grid: rows = hours of day (0-23), cols = days/months
    const g: number[][] = [];
    for (let h = 0; h < hoursPerDay; h++) {
      const row: number[] = [];
      for (let d = 0; d < days; d++) {
        const idx = d * hoursPerDay + h;
        row.push(idx < data.length ? data[idx] : 0);
      }
      g.push(row);
    }

    return { grid: g, maxVal: maxV, isRepresentative: isRep };
  }, [data]);

  if (grid.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        No data available for heatmap
      </div>
    );
  }

  const cols = grid[0].length;
  const cellW = Math.max(2, Math.floor(420 / cols));
  const cellH = Math.max(4, Math.floor((height - 40) / 24));
  const svgW = cols * cellW + 50;
  const svgH = 24 * cellH + 30;

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={svgH} className="block">
        {/* Y-axis labels (hours) */}
        {[0, 6, 12, 18].map((h) => (
          <text
            key={h}
            x={28}
            y={h * cellH + cellH / 2 + 4}
            textAnchor="end"
            fill="#a3a3a3"
            fontSize={9}
          >
            {h.toString().padStart(2, "0")}:00
          </text>
        ))}

        {/* Heatmap cells */}
        {grid.map((row, h) =>
          row.map((val, d) => (
            <rect
              key={`${h}-${d}`}
              x={32 + d * cellW}
              y={h * cellH}
              width={cellW}
              height={cellH}
              fill={interpolateColor(maxVal > 0 ? val / maxVal : 0, colorScale)}
              rx={1}
            >
              <title>
                {isRepresentative
                  ? `${MONTH_LABELS[d] ?? d} ${h}:00 — ${val.toFixed(3)}`
                  : `Day ${d + 1} ${h}:00 — ${val.toFixed(3)}`}
              </title>
            </rect>
          ))
        )}

        {/* X-axis labels */}
        {isRepresentative
          ? MONTH_LABELS.map((m, i) => (
              <text
                key={m}
                x={32 + i * cellW + cellW / 2}
                y={24 * cellH + 14}
                textAnchor="middle"
                fill="#a3a3a3"
                fontSize={8}
              >
                {m}
              </text>
            ))
          : [0, 3, 6, 9].map((m) => {
              const d = Math.floor(m * (cols / 12));
              return (
                <text
                  key={m}
                  x={32 + d * cellW}
                  y={24 * cellH + 14}
                  textAnchor="start"
                  fill="#a3a3a3"
                  fontSize={8}
                >
                  {MONTH_LABELS[m]}
                </text>
              );
            })}
      </svg>

      {/* Color scale legend */}
      <div className="flex items-center gap-2 mt-2 px-1">
        <span className="text-[10px] text-muted-foreground">0</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background: `linear-gradient(to right, ${interpolateColor(0, colorScale)}, ${interpolateColor(0.5, colorScale)}, ${interpolateColor(1, colorScale)})`,
          }}
        />
        <span className="text-[10px] text-muted-foreground">
          {maxVal.toFixed(2)}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">{label}</span>
      </div>
    </div>
  );
}
