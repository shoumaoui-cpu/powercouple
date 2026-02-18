"use client";

import { createStore, useStore } from "zustand";
import { createContext, useContext } from "react";
import type { GasPlant, DataCenter, NuclearPlant, FilterState, OptimizationResult } from "@/types";
import { DEFAULT_FILTER_STATE } from "@/lib/constants";

// ─── State shape ─────────────────────────────────────────────────────

interface AppState {
  // Plant data
  plants: GasPlant[];
  dataCenters: DataCenter[];
  nuclearPlants: NuclearPlant[];
  setPlants: (plants: GasPlant[]) => void;
  setDataCenters: (dcs: DataCenter[]) => void;
  setNuclearPlants: (nps: NuclearPlant[]) => void;

  // Selection
  selectedPlantId: string | null;
  selectPlant: (id: string | null) => void;

  // Filters
  filters: FilterState;
  setFilters: (partial: Partial<FilterState>) => void;
  resetFilters: () => void;

  // Optimization
  optimizationResult: OptimizationResult | null;
  isOptimizing: boolean;
  setOptimizationResult: (result: OptimizationResult | null) => void;
  setIsOptimizing: (val: boolean) => void;

  // UI state
  sidebarOpen: boolean;
  detailPanelOpen: boolean;
  activeDetailTab: string;
  showDataCenters: boolean;
  showNuclearPlants: boolean;
  showRegions: boolean;
  toggleSidebar: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  setActiveDetailTab: (tab: string) => void;
  setShowDataCenters: (show: boolean) => void;
  setShowNuclearPlants: (show: boolean) => void;
  setShowRegions: (show: boolean) => void;
}

// ─── Store factory ───────────────────────────────────────────────────

export const createAppStore = () =>
  createStore<AppState>((set) => ({
    // Plant data
    plants: [],
    dataCenters: [],
    nuclearPlants: [],
    setPlants: (plants) => set({ plants }),
    setDataCenters: (dataCenters) => set({ dataCenters }),
    setNuclearPlants: (nuclearPlants) => set({ nuclearPlants }),

    // Selection
    selectedPlantId: null,
    selectPlant: (id) =>
      set({
        selectedPlantId: id,
        detailPanelOpen: id !== null,
        optimizationResult: null,
        activeDetailTab: "optimization",
      }),

    // Filters
    filters: { ...DEFAULT_FILTER_STATE },
    setFilters: (partial) =>
      set((s) => ({ filters: { ...s.filters, ...partial } })),
    resetFilters: () => set({ filters: { ...DEFAULT_FILTER_STATE } }),

    // Optimization
    optimizationResult: null,
    isOptimizing: false,
    setOptimizationResult: (result) => set({ optimizationResult: result }),
    setIsOptimizing: (val) => set({ isOptimizing: val }),

    // UI
    sidebarOpen: true,
    detailPanelOpen: false,
    activeDetailTab: "optimization",
    showDataCenters: true,
    showNuclearPlants: true,
    showRegions: false,
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
    setActiveDetailTab: (tab) => set({ activeDetailTab: tab }),
    setShowDataCenters: (show) => set({ showDataCenters: show }),
    setShowNuclearPlants: (show) => set({ showNuclearPlants: show }),
    setShowRegions: (show) => set({ showRegions: show }),
  }));

// ─── Context for App Router ──────────────────────────────────────────

export type AppStoreType = ReturnType<typeof createAppStore>;
export const AppStoreContext = createContext<AppStoreType | null>(null);

export function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext);
  if (!store) {
    throw new Error("useAppStore must be used within <StoreProvider>");
  }
  return useStore(store, selector);
}
