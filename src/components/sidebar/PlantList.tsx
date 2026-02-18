"use client";

import { useAppStore } from "@/store/useAppStore";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMw, formatLcoe, formatPercent, lcoeColor } from "@/lib/utils";
import { PRIME_MOVER_LABELS } from "@/lib/constants";
import type { GasPlant } from "@/types";

function PlantItem({
  plant,
  isSelected,
  onClick,
}: {
  plant: GasPlant;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lcoe = plant.lcoeHybrid ?? plant.lcoeGasOnly;
  const isEia860Plant = plant.id.startsWith("eia860-");
  const statusLabel = plant.operatingStatus === "PL" ? "Proposed" : "Operating";
  const statusClass =
    plant.operatingStatus === "PL"
      ? "bg-[#FFC78A]/20 text-[#FFC78A] border-[#FFC78A]/50"
      : "bg-pc-green/20 text-pc-green border-pc-green/40";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-accent/50 ${
        isSelected ? "bg-accent" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{plant.plantName}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {plant.state}
            {plant.county ? `, ${plant.county}` : ""}
          </div>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 text-[10px] px-1.5"
          style={{ borderColor: lcoeColor(lcoe) }}
        >
          {PRIME_MOVER_LABELS[plant.primeMover] ? plant.primeMover : "NG"}
        </Badge>
      </div>
      {isEia860Plant && (
        <div className="mt-1">
          <Badge variant="outline" className={`text-[10px] px-1.5 ${statusClass}`}>
            {statusLabel}
          </Badge>
        </div>
      )}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {formatMw(plant.nameplateCapacityMw)}
        </span>
        <span>CF: {formatPercent(plant.capacityFactor)}</span>
        {lcoe != null && (
          <span style={{ color: lcoeColor(lcoe) }}>
            {formatLcoe(lcoe)}
          </span>
        )}
        {plant.nearbyDcCount > 0 && (
          <span className="text-pc-blue">
            {plant.nearbyDcCount} DC{plant.nearbyDcCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}

export function PlantList() {
  const plants = useAppStore((s) => s.plants);
  const selectedPlantId = useAppStore((s) => s.selectedPlantId);
  const selectPlant = useAppStore((s) => s.selectPlant);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {plants.length} plant{plants.length !== 1 ? "s" : ""}
        </span>
      </div>
      <ScrollArea className="flex-1">
        {plants.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No plants match current filters
          </div>
        ) : (
          plants.map((plant) => (
            <PlantItem
              key={plant.id}
              plant={plant}
              isSelected={plant.id === selectedPlantId}
              onClick={() => selectPlant(plant.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
