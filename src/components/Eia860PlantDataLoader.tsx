"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

export function Eia860PlantDataLoader({
  plantSet,
}: {
  plantSet: "operating" | "proposed" | "all";
}) {
  const setPlants = useAppStore((s) => s.setPlants);
  const filters = useAppStore((s) => s.filters);
  const selectedPlantId = useAppStore((s) => s.selectedPlantId);
  const selectPlant = useAppStore((s) => s.selectPlant);

  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.states.length) params.set("states", filters.states.join(","));
    if (filters.regions.length) params.set("regions", filters.regions.join(","));
    if (filters.primeMoverTypes.length) {
      params.set("primeMovers", filters.primeMoverTypes.join(","));
    }

    params.set("minCapacity", String(filters.capacityRange[0]));
    params.set("maxCapacity", String(filters.capacityRange[1]));
    params.set("minCf", String(filters.capacityFactorRange[0]));
    params.set("maxCf", String(filters.capacityFactorRange[1]));
    params.set("minUtilization", String(filters.utilizationRange[0]));
    params.set("maxUtilization", String(filters.utilizationRange[1]));
    params.set("minLcoe", String(filters.lcoeRange[0]));
    params.set("maxLcoe", String(filters.lcoeRange[1]));
    params.set("set", plantSet);

    const controller = new AbortController();

    fetch(`/api/eia860/plants?${params.toString()}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((plants) => {
        setPlants(plants);

        if (selectedPlantId && !plants.some((p: { id: string }) => p.id === selectedPlantId)) {
          selectPlant(null);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch EIA860 plants:", err);
        }
      });

    return () => controller.abort();
  }, [filters, plantSet, selectedPlantId, selectPlant, setPlants]);

  return null;
}
