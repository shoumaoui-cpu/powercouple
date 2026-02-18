"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

export function PlantDataLoader() {
  const setPlants = useAppStore((s) => s.setPlants);
  const setDataCenters = useAppStore((s) => s.setDataCenters);
  const setNuclearPlants = useAppStore((s) => s.setNuclearPlants);
  const filters = useAppStore((s) => s.filters);

  // Load plants (filtered)
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.states.length) params.set("states", filters.states.join(","));
    if (filters.regions.length) params.set("regions", filters.regions.join(","));
    if (filters.primeMoverTypes.length)
      params.set("primeMovers", filters.primeMoverTypes.join(","));

    params.set("minCapacity", String(filters.capacityRange[0]));
    params.set("maxCapacity", String(filters.capacityRange[1]));
    params.set("minCf", String(filters.capacityFactorRange[0]));
    params.set("maxCf", String(filters.capacityFactorRange[1]));
    params.set("minLcoe", String(filters.lcoeRange[0]));
    params.set("maxLcoe", String(filters.lcoeRange[1]));

    if (filters.nearbyDCsOnly) params.set("nearbyDCs", "true");

    const controller = new AbortController();

    fetch(`/api/plants?${params}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setPlants)
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch plants:", err);
        }
      });

    return () => controller.abort();
  }, [filters, setPlants]);

  // Load data centers (once, unfiltered)
  useEffect(() => {
    fetch("/api/datacenters")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setDataCenters)
      .catch((err) => {
        console.error("Failed to fetch data centers:", err);
      });
  }, [setDataCenters]);

  // Load nuclear plants (once, unfiltered)
  useEffect(() => {
    fetch("/api/nuclear")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setNuclearPlants)
      .catch((err) => {
        console.error("Failed to fetch nuclear plants:", err);
      });
  }, [setNuclearPlants]);

  return null;
}
