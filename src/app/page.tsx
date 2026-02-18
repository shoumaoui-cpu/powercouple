"use client";

import dynamic from "next/dynamic";
import { Navigation } from "@/components/Navigation";
import { KpiBar } from "@/components/KpiBar";
import { FilterPanel } from "@/components/sidebar/FilterPanel";
import { PlantList } from "@/components/sidebar/PlantList";
import { SiteDetailPanel } from "@/components/detail/SiteDetailPanel";
import { PlantDataLoader } from "@/components/PlantDataLoader";
import { SidebarToggle } from "@/components/SidebarToggle";
import { useAppStore } from "@/store/useAppStore";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-pc-dark flex items-center justify-center">
      <div className="text-muted-foreground font-mono text-sm">
        Loading map...
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-screen bg-pc-dark">
      <Navigation />
      <KpiBar />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <SidebarWrapper />

        {/* Map */}
        <main className="flex-1 relative">
          <MapView />
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <DataCenterToggle />
            <NuclearToggle />
          </div>
          <MapLegend />
        </main>

        {/* Detail Panel */}
        <SiteDetailPanel />
      </div>

      {/* Data loader (invisible) */}
      <PlantDataLoader />
    </div>
  );
}

function SidebarWrapper() {
  return (
    <aside className="w-80 bg-background border-r border-border flex flex-col overflow-hidden relative">
      <SidebarToggle />
      <FilterPanel />
      <PlantList />
    </aside>
  );
}

function DataCenterToggle() {
  const showDataCenters = useAppStore((s) => s.showDataCenters);
  const setShowDataCenters = useAppStore((s) => s.setShowDataCenters);
  const dataCenters = useAppStore((s) => s.dataCenters);

  return (
    <button
      onClick={() => setShowDataCenters(!showDataCenters)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono font-semibold transition-all ${showDataCenters
        ? "bg-[#6B7280]/20 border-[#6B7280]/50 text-[#9CA3AF]"
        : "bg-pc-dark-secondary/90 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
        }`}
    >
      <div
        className={`w-3 h-3 rounded-none border-2 ${showDataCenters
          ? "bg-[#6B7280] border-white"
          : "bg-transparent border-muted-foreground"
          }`}
      />
      <span>Data Centers</span>
      <span className={`font-bold ${showDataCenters ? "text-[#9CA3AF]" : "text-muted-foreground"}`}>
        {dataCenters.length}
      </span>
    </button>
  );
}

function NuclearToggle() {
  const showNuclearPlants = useAppStore((s) => s.showNuclearPlants);
  const setShowNuclearPlants = useAppStore((s) => s.setShowNuclearPlants);
  const nuclearPlants = useAppStore((s) => s.nuclearPlants);

  return (
    <button
      onClick={() => setShowNuclearPlants(!showNuclearPlants)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono font-semibold transition-all ${showNuclearPlants
        ? "bg-[#0a1f44]/30 border-[#0a1f44] text-[#4a7ab5]"
        : "bg-pc-dark-secondary/90 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
        }`}
    >
      <div
        style={{ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }}
        className={`w-3.5 h-3 ${showNuclearPlants
          ? "bg-[#0a1f44]"
          : "bg-muted-foreground"
          }`}
      />
      <span>Nuclear ☢</span>
      <span className={`font-bold ${showNuclearPlants ? "text-[#4a7ab5]" : "text-muted-foreground"}`}>
        {nuclearPlants.length}
      </span>
    </button>
  );
}

function MapLegend() {
  const showDataCenters = useAppStore((s) => s.showDataCenters);
  const showNuclearPlants = useAppStore((s) => s.showNuclearPlants);

  return (
    <div className="absolute bottom-8 right-4 bg-pc-dark-secondary/90 backdrop-blur rounded-lg border border-white/10 p-3 text-xs max-h-[60vh] overflow-y-auto">
      <div className="font-mono uppercase tracking-wider text-muted-foreground mb-2">
        Legend
      </div>
      <div className="space-y-2">
        {/* Gas Plants section */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
            Gas Plants
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Bubble size:</span>
              <span className="text-white">Capacity (MW)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Color:</span>
              <span className="text-white">Hybrid LCOE</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-3 h-3 rounded-full bg-pc-green" />
              <span className="text-muted-foreground">&lt;$60</span>
              <div className="w-3 h-3 rounded-full bg-pc-gold ml-2" />
              <span className="text-muted-foreground">$60-100</span>
              <div className="w-3 h-3 rounded-full bg-pc-red ml-2" />
              <span className="text-muted-foreground">&gt;$100</span>
            </div>
          </div>
        </div>

        {/* Data Centers section (shown when toggle is on) */}
        {showDataCenters && (
          <div className="border-t border-white/10 pt-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
              Data Centers
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-none bg-[#10B981] border-2 border-white" />
                <span className="text-[#10B981]">Operational</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-none bg-[#F59E0B] border-2 border-white" />
                <span className="text-[#F59E0B]">Under Construction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-none bg-[#3B82F6] border-2 border-white" />
                <span className="text-[#3B82F6]">Planned</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground">Size:</span>
                <span className="text-white">Campus power (MW)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Label:</span>
                <span className="text-[#b0c4de]">Operator (IT MW)</span>
              </div>
            </div>
          </div>
        )}

        {/* Nuclear Plants section (shown when toggle is on) */}
        {showNuclearPlants && (
          <div className="border-t border-white/10 pt-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">
              Nuclear Infrastructure ☢
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[12px] border-l-transparent border-r-transparent border-b-[#0a1f44]" />
                <span className="text-[#4a7ab5]">Operating</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[12px] border-l-transparent border-r-transparent border-b-[#0f2b5e]" />
                <span className="text-[#5a8ac5]">Restart Candidate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[12px] border-l-transparent border-r-transparent border-b-[#132f6a]" />
                <span className="text-[#6a9ad5]">New Build / Conversion</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-b-[12px] border-l-transparent border-r-transparent border-b-[#1a2540]" />
                <span className="text-[#556680]">Decommissioned</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground">Size:</span>
                <span className="text-white">Capacity (MW)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
