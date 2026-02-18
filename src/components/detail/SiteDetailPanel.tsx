"use client";

import { useAppStore } from "@/store/useAppStore";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PRIME_MOVER_LABELS } from "@/lib/constants";
import { OptimizationTab } from "./OptimizationTab";
import { SolarProfileTab } from "./SolarProfileTab";
import { ConflictTab } from "./ConflictTab";
import { DispatchTab } from "./DispatchTab";
import { LandUseTab } from "./LandUseTab";

export function SiteDetailPanel() {
  const selectedPlantId = useAppStore((s) => s.selectedPlantId);
  const selectPlant = useAppStore((s) => s.selectPlant);
  const detailPanelOpen = useAppStore((s) => s.detailPanelOpen);
  const setDetailPanelOpen = useAppStore((s) => s.setDetailPanelOpen);
  const activeDetailTab = useAppStore((s) => s.activeDetailTab);
  const setActiveDetailTab = useAppStore((s) => s.setActiveDetailTab);
  const optimizationResult = useAppStore((s) => s.optimizationResult);
  const plants = useAppStore((s) => s.plants);

  if (!selectedPlantId || !detailPanelOpen) return null;

  const plant = plants.find((p) => p.id === selectedPlantId);
  if (!plant) return null;

  const handleClose = () => {
    setDetailPanelOpen(false);
    selectPlant(null);
  };

  const formatMw = (val: number | null) =>
    val != null ? `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW` : "--";

  const formatPct = (val: number | null) =>
    val != null ? `${(val * 100).toFixed(1)}%` : "--";

  const formatLcoe = (val: number | null) =>
    val != null ? `$${val.toFixed(1)}/MWh` : "--";

  return (
    <div className="fixed right-0 top-0 z-30 flex h-full w-[480px] flex-col border-l border-border bg-background shadow-xl">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border p-4">
        {/* Top row: close button */}
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {plant.plantName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {plant.county ? `${plant.county}, ` : ""}
              {plant.state}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-2 flex-shrink-0"
            onClick={handleClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </Button>
        </div>

        {/* Badges */}
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge className="bg-pc-blue/20 text-pc-blue border-pc-blue/30">
            {PRIME_MOVER_LABELS[plant.primeMover] ?? plant.primeMover}
          </Badge>
          <Badge className="bg-pc-green/20 text-pc-green border-pc-green/30">
            {formatMw(plant.nameplateCapacityMw)}
          </Badge>
          {plant.operatorName && (
            <Badge variant="outline" className="text-muted-foreground">
              {plant.operatorName}
            </Badge>
          )}
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-2">
          <KpiCell
            label="Capacity"
            value={formatMw(plant.nameplateCapacityMw)}
          />
          <KpiCell
            label="Cap Factor"
            value={formatPct(plant.capacityFactor)}
          />
          <KpiCell
            label="Utilization"
            value={formatPct(plant.utilizationRate ?? null)}
          />
          <KpiCell
            label="Gas LCOE"
            value={formatLcoe(plant.lcoeGasOnly)}
          />
          <KpiCell
            label="Hybrid LCOE"
            value={
              optimizationResult
                ? formatLcoe(optimizationResult.netLcoe)
                : formatLcoe(plant.lcoeHybrid)
            }
            highlight={
              optimizationResult != null ||
              (plant.lcoeHybrid != null &&
                plant.lcoeGasOnly != null &&
                plant.lcoeHybrid < plant.lcoeGasOnly)
            }
          />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Tabs
        value={activeDetailTab}
        onValueChange={setActiveDetailTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-shrink-0 border-b border-border px-4 pt-2">
          <TabsList className="w-full justify-start bg-transparent">
            <TabsTrigger value="optimization" className="text-xs">
              Optimization
            </TabsTrigger>
            <TabsTrigger value="solar" className="text-xs">
              Solar
            </TabsTrigger>
            <TabsTrigger value="conflict" className="text-xs">
              Conflict
            </TabsTrigger>
            <TabsTrigger value="dispatch" className="text-xs">
              Dispatch
            </TabsTrigger>
            <TabsTrigger value="land" className="text-xs">
              Land Use
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <TabsContent value="optimization" className="mt-0">
              <OptimizationTab plant={plant} />
            </TabsContent>
            <TabsContent value="solar" className="mt-0">
              <SolarProfileTab plant={plant} />
            </TabsContent>
            <TabsContent value="conflict" className="mt-0">
              <ConflictTab plant={plant} />
            </TabsContent>
            <TabsContent value="dispatch" className="mt-0">
              <DispatchTab plant={plant} />
            </TabsContent>
            <TabsContent value="land" className="mt-0">
              <LandUseTab plant={plant} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

/* ── Small KPI helper ─────────────────────────────────────────────── */

function KpiCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-mono font-semibold ${
          highlight ? "text-pc-green" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
