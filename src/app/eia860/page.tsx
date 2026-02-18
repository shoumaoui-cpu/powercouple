"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { KpiBar } from "@/components/KpiBar";
import { FilterPanel } from "@/components/sidebar/FilterPanel";
import { PlantList } from "@/components/sidebar/PlantList";
import { SiteDetailPanel } from "@/components/detail/SiteDetailPanel";
import { SidebarToggle } from "@/components/SidebarToggle";
import { Eia860PlantDataLoader } from "@/components/Eia860PlantDataLoader";
import { useAppStore } from "@/store/useAppStore";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-pc-dark flex items-center justify-center">
      <div className="text-muted-foreground font-mono text-sm">Loading map...</div>
    </div>
  ),
});

type PlantSet = "operating" | "proposed" | "all";

export default function Eia860DashboardPage() {
  const [plantSet, setPlantSet] = useState<PlantSet>("operating");

  const setDataCenters = useAppStore((s) => s.setDataCenters);
  const setNuclearPlants = useAppStore((s) => s.setNuclearPlants);
  const setShowDataCenters = useAppStore((s) => s.setShowDataCenters);
  const setShowNuclearPlants = useAppStore((s) => s.setShowNuclearPlants);

  useEffect(() => {
    setDataCenters([]);
    setNuclearPlants([]);
    setShowDataCenters(false);
    setShowNuclearPlants(false);
  }, [setDataCenters, setNuclearPlants, setShowDataCenters, setShowNuclearPlants]);

  return (
    <div className="flex flex-col h-screen bg-pc-dark">
      <Navigation />
      <KpiBar />

      <div className="px-4 py-2 border-b border-white/10 bg-pc-dark-secondary/80 flex items-center gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mr-2">
          EIA860 Dataset
        </span>
        <DatasetButton active={plantSet === "operating"} onClick={() => setPlantSet("operating")}>
          Operating Plants
        </DatasetButton>
        <DatasetButton
          active={plantSet === "proposed"}
          tone="proposed"
          onClick={() => setPlantSet("proposed")}
        >
          Proposed Plants
        </DatasetButton>
        <DatasetButton active={plantSet === "all"} onClick={() => setPlantSet("all")}>
          All EIA860 Sites
        </DatasetButton>
      </div>

      <div className="flex flex-1 min-h-0">
        <aside className="w-80 bg-background border-r border-border flex flex-col overflow-hidden relative">
          <SidebarToggle />
          <FilterPanel />
          <PlantList />
        </aside>

        <main className="flex-1 relative">
          <MapView />
        </main>

        <SiteDetailPanel />
      </div>

      <Eia860PlantDataLoader plantSet={plantSet} />
    </div>
  );
}

function DatasetButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone?: "default" | "proposed";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass =
    tone === "proposed"
      ? "bg-[#FFC78A]/20 text-[#FFC78A] border-[#FFC78A]/45"
      : "bg-pc-green/20 text-pc-green border-pc-green/40";

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition-colors border ${
        active
          ? activeClass
          : "bg-pc-dark border-white/10 text-muted-foreground hover:text-white hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}
