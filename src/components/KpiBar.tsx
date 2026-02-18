"use client";

import { useAppStore } from "@/store/useAppStore";
import { formatMw, formatNumber } from "@/lib/utils";

export function KpiBar() {
  const plants = useAppStore((s) => s.plants);

  const totalCapacity = plants.reduce(
    (sum, p) => sum + p.nameplateCapacityMw,
    0
  );
  const plantsWithLcoe = plants.filter((p) => p.lcoeHybrid != null);
  const lcoeMin = plantsWithLcoe.length
    ? Math.min(...plantsWithLcoe.map((p) => p.lcoeHybrid!))
    : null;
  const lcoeMax = plantsWithLcoe.length
    ? Math.max(...plantsWithLcoe.map((p) => p.lcoeHybrid!))
    : null;
  const avgCf =
    plants.length > 0
      ? plants.reduce((sum, p) => sum + (p.capacityFactor ?? 0), 0) /
        plants.length
      : 0;
  const dcPlants = plants.filter((p) => p.nearbyDcCount > 0);

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-pc-dark-secondary/80 backdrop-blur border-b border-white/10 text-xs font-mono">
      <KpiItem label="Sites" value={formatNumber(plants.length)} />
      <KpiItem label="Total Capacity" value={formatMw(totalCapacity)} />
      <KpiItem
        label="Avg CF"
        value={`${(avgCf * 100).toFixed(1)}%`}
      />
      {lcoeMin != null && lcoeMax != null && (
        <KpiItem
          label="LCOE Range"
          value={`$${Math.round(lcoeMin)}–$${Math.round(lcoeMax)}/MWh`}
          accent
        />
      )}
      {dcPlants.length > 0 && (
        <KpiItem
          label="Near DCs"
          value={`${dcPlants.length} sites`}
          accent
        />
      )}
    </div>
  );
}

function KpiItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground uppercase tracking-wider">
        {label}:
      </span>
      <span className={accent ? "text-pc-green font-semibold" : "text-white font-semibold"}>
        {value}
      </span>
    </div>
  );
}
