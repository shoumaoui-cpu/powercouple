"use client";

import { HeatmapChart } from "./HeatmapChart";

interface ConflictHeatmapProps {
  /** Solar capacity factors (8760 or 288 hours) */
  solarCf: number[];
  /** System demand (8760 or 288 hours), normalized 0-1 */
  demandNormalized: number[];
  height?: number;
}

export function ConflictHeatmap({
  solarCf,
  demandNormalized,
  height = 200,
}: ConflictHeatmapProps) {
  // Conflict metric: high demand + low solar = high conflict
  const conflictData = solarCf.map((cf, i) => {
    const demand = demandNormalized[i] ?? 0;
    // Conflict = demand * (1 - solar_cf): high when demand is high but solar is low
    return demand * (1 - cf);
  });

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Solar Resource
        </h4>
        <HeatmapChart
          data={solarCf}
          colorScale="solar"
          label="CF"
          height={height}
        />
      </div>

      <div>
        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          System Demand
        </h4>
        <HeatmapChart
          data={demandNormalized}
          colorScale="demand"
          label="Demand"
          height={height}
        />
      </div>

      <div>
        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Conflict Score (High Demand + Low Solar)
        </h4>
        <HeatmapChart
          data={conflictData}
          colorScale="conflict"
          label="Conflict"
          height={height}
        />
      </div>
    </div>
  );
}
