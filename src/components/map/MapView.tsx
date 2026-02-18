"use client";

import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAppStore } from "@/store/useAppStore";
import { MAP_TILE_URL, MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import type { GasPlant, DataCenter, NuclearPlant } from "@/types";

function plantsToGeoJSON(plants: GasPlant[]) {
  return {
    type: "FeatureCollection" as const,
    features: plants.map((p) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [p.longitude, p.latitude],
      },
      properties: {
        id: p.id,
        name: p.plantName,
        state: p.state,
        capacity: p.nameplateCapacityMw,
        lcoe: p.lcoeHybrid ?? p.lcoeGasOnly ?? 999,
        cf: p.capacityFactor ?? 0,
        primeMover: p.primeMover,
        nearbyDcs: p.nearbyDcCount,
        operatingStatus: p.operatingStatus,
      },
    })),
  };
}

const DC_GREY = "#6B7280";
const DC_STATUS_COLORS: Record<string, string> = {
  operational: "#10B981", // Emerald Green
  under_construction: "#F59E0B", // Amber
  planned: "#3B82F6", // Blue
};

const DC_STATUS_LABELS: Record<string, string> = {
  operational: "Operational",
  under_construction: "Under Construction",
  planned: "Planned",
};

function dataCentersToGeoJSON(dcs: DataCenter[]) {
  return {
    type: "FeatureCollection" as const,
    features: dcs.map((dc) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [dc.longitude, dc.latitude],
      },
      properties: {
        id: dc.id,
        name: dc.name,
        operator: dc.operator ?? "Unknown",
        status: dc.status ?? "Unknown",
        capacityMw: dc.capacityMw ?? 0,
        itLoadMw: dc.itLoadMw ?? 0,
        completionYear: dc.completionYear ?? 0,
        campusSqft: dc.campusSqft ?? 0,
        phase: dc.phase ?? "",
        color: DC_STATUS_COLORS[dc.status ?? ""] ?? "#7799B6",
      },
    })),
  };
}

// Deep navy blue for all nuclear facility types
const NUCLEAR_COLOR = "#0a1f44";
const NUCLEAR_COLORS: Record<string, string> = {
  operating: "#0a1f44",
  restart: "#0f2b5e",
  coal_to_nuclear: "#132f6a",
  legacy: "#1a2540",
};

// Generate a square icon image for map markers
function createSquareIcon(map: maplibregl.Map, name: string, color: string, size: number, borderColor = "#ffffff", borderWidth = 2) {
  if (map.hasImage(name)) return;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = borderColor;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.fillRect(borderWidth, borderWidth, size - borderWidth * 2, size - borderWidth * 2);
  map.addImage(name, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
}

// Generate a triangle icon image for nuclear markers
function createTriangleIcon(map: maplibregl.Map, name: string, color: string, size: number, borderColor = "#ffffff", borderWidth = 2) {
  if (map.hasImage(name)) return;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  // Border triangle
  ctx.fillStyle = borderColor;
  ctx.beginPath();
  ctx.moveTo(cx, 1);
  ctx.lineTo(size - 1, size - 1);
  ctx.lineTo(1, size - 1);
  ctx.closePath();
  ctx.fill();
  // Inner triangle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, borderWidth + 2);
  ctx.lineTo(size - borderWidth - 2, size - borderWidth - 1);
  ctx.lineTo(borderWidth + 2, size - borderWidth - 1);
  ctx.closePath();
  ctx.fill();
  map.addImage(name, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
}

const NUCLEAR_LABELS: Record<string, string> = {
  operating: "Operating",
  restart: "Restart Candidate",
  coal_to_nuclear: "New Build / Conversion",
  legacy: "Decommissioned",
};

function nuclearPlantsToGeoJSON(nps: NuclearPlant[]) {
  return {
    type: "FeatureCollection" as const,
    features: nps.map((np) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [np.longitude, np.latitude],
      },
      properties: {
        id: np.id,
        name: np.name,
        facilityType: np.facilityType,
        status: np.status,
        capacityMw: np.capacityMw,
        region: np.region ?? "N/A",
        state: np.state ?? "N/A",
        operator: np.operator ?? "Unknown",
        notes: np.notes ?? "",
        color: NUCLEAR_COLORS[np.facilityType] ?? "#888888",
      },
    })),
  };
}

// Haversine distance in miles
function distMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DC_PROXIMITY_MILES = 10;

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const dcLayersAdded = useRef(false);
  const nuclearLayersAdded = useRef(false);

  const plants = useAppStore((s) => s.plants);
  const dataCenters = useAppStore((s) => s.dataCenters);
  const nuclearPlants = useAppStore((s) => s.nuclearPlants);
  const selectedPlantId = useAppStore((s) => s.selectedPlantId);
  const selectPlant = useAppStore((s) => s.selectPlant);
  const showDataCenters = useAppStore((s) => s.showDataCenters);
  const showNuclearPlants = useAppStore((s) => s.showNuclearPlants);
  const nearbyDCsOnly = useAppStore((s) => s.filters.nearbyDCsOnly);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          carto: {
            type: "raster",
            tiles: [MAP_TILE_URL],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: "carto-tiles",
            type: "raster",
            source: "carto",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      maxZoom: 15,
      minZoom: 3,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200 }),
      "bottom-left"
    );

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      dcLayersAdded.current = false;
      nuclearLayersAdded.current = false;
    };
  }, []);

  // Update plant markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const geojson = plantsToGeoJSON(plants);

    const addLayers = () => {
      if (map.getSource("plants")) {
        (map.getSource("plants") as maplibregl.GeoJSONSource).setData(
          geojson as GeoJSON.FeatureCollection
        );
        return;
      }

      map.addSource("plants", {
        type: "geojson",
        data: geojson as GeoJSON.FeatureCollection,
      });

      // Plant bubble layer
      map.addLayer({
        id: "plant-bubbles",
        type: "circle",
        source: "plants",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "capacity"],
            10, 4,
            50, 6,
            100, 8,
            500, 12,
            1000, 16,
            3000, 22,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "operatingStatus"], "PL"],
            "#FFC78A",
            [
              "interpolate",
              ["linear"],
              ["get", "lcoe"],
              30,
              "#4ecca3",
              60,
              "#4ecca3",
              80,
              "#FFC15E",
              100,
              "#FFC15E",
              140,
              "#e74c3c",
              200,
              "#e74c3c",
            ],
          ],
          "circle-opacity": 0.75,
          "circle-stroke-width": [
            "case",
            ["==", ["get", "id"], selectedPlantId ?? ""],
            3,
            1,
          ],
          "circle-stroke-color": [
            "case",
            ["==", ["get", "id"], selectedPlantId ?? ""],
            "#ffffff",
            "rgba(255,255,255,0.4)",
          ],
        },
      });

      // Click handler
      map.on("click", "plant-bubbles", (e) => {
        const feature = e.features?.[0];
        if (feature?.properties?.id) {
          selectPlant(feature.properties.id);
        }
      });

      // Hover popup for plants
      map.on("mouseenter", "plant-bubbles", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature) return;

        const props = feature.properties;
        const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
          number,
          number,
        ];
        const isEia860 = String(props.id).startsWith("eia860-");
        const status = props.operatingStatus === "PL" ? "Proposed" : "Operating";

        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
        })
          .setLngLat(coords)
          .setHTML(
            `<div class="font-sans">
              <div class="font-semibold text-sm">${props.name}</div>
              <div class="text-xs text-gray-500">${props.state} &middot; ${props.primeMover}</div>
              ${isEia860
                ? `<div class="text-xs mt-0.5" style="color:${props.operatingStatus === "PL" ? "#FFC78A" : "#4ecca3"};font-weight:600">${status}</div>`
                : ""
              }
              <div class="mt-1 text-xs">
                <span class="font-medium">${Math.round(props.capacity)} MW</span>
                &middot; CF: ${(props.cf * 100).toFixed(1)}%
              </div>
              ${props.lcoe < 900
              ? `<div class="text-xs mt-0.5">LCOE: <span class="font-medium">$${Math.round(props.lcoe)}/MWh</span></div>`
              : ""
            }
              ${props.nearbyDcs > 0
              ? `<div class="text-xs text-blue-600 mt-0.5">${props.nearbyDcs} nearby data center(s)</div>`
              : ""
            }
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "plant-bubbles", () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.on("load", addLayers);
    }
  }, [plants, selectedPlantId, selectPlant]);

  // Update data center markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || dataCenters.length === 0) return;

    const geojson = dataCentersToGeoJSON(dataCenters);

    const addDcLayers = () => {
      // If source exists, just update data
      if (map.getSource("datacenters")) {
        (map.getSource("datacenters") as maplibregl.GeoJSONSource).setData(
          geojson as GeoJSON.FeatureCollection
        );
      } else {
        map.addSource("datacenters", {
          type: "geojson",
          data: geojson as GeoJSON.FeatureCollection,
        });
      }

      // Only add layers once
      if (!dcLayersAdded.current) {
        dcLayersAdded.current = true;

        // Generate grey square icon for data centers
        createSquareIcon(map, "dc-sq", DC_GREY, 28);
        createSquareIcon(map, "dc-sq-lg", DC_GREY, 36);

        // Data center outer glow ring
        map.addLayer({
          id: "dc-glow",
          type: "circle",
          source: "datacenters",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "capacityMw"],
              20, 14,
              50, 17,
              100, 22,
              200, 28,
            ],
            "circle-color": DC_GREY,
            "circle-opacity": 0.10,
            "circle-stroke-width": 0,
          },
        });

        // Data center marker — grey square boxes
        map.addLayer({
          id: "dc-markers",
          type: "symbol",
          source: "datacenters",
          layout: {
            "icon-image": "dc-sq",
            "icon-size": [
              "interpolate",
              ["linear"],
              ["get", "capacityMw"],
              20, 0.5,
              50, 0.65,
              100, 0.8,
              200, 1.0,
            ],
            "icon-allow-overlap": true,
          },
        });

        // Data center label (operator + capacity at higher zoom)
        map.addLayer({
          id: "dc-labels",
          type: "symbol",
          source: "datacenters",
          minzoom: 6,
          layout: {
            "text-field": [
              "concat",
              ["get", "operator"],
              " (",
              ["to-string", ["get", "itLoadMw"]],
              " MW)",
            ],
            "text-size": 10,
            "text-font": ["Open Sans Regular"],
            "text-offset": [0, 1.8],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-optional": true,
            "text-max-width": 14,
          },
          paint: {
            "text-color": "#b0c4de",
            "text-halo-color": "rgba(0,0,0,0.85)",
            "text-halo-width": 1.2,
          },
        });

        // Hover popup for data centers
        map.on("mouseenter", "dc-markers", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties;
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
            number,
            number,
          ];
          const color = props.color as string;
          const statusLabel = DC_STATUS_LABELS[props.status as string] ?? props.status;

          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            maxWidth: "300px",
          })
            .setLngLat(coords)
            .setHTML(
              `<div class="font-sans" style="min-width:200px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <div style="width:10px;height:10px;background:${color};border-radius:2px;border:2px solid #fff"></div>
                  <span style="color:${color};font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Data Center</span>
                </div>
                <div class="font-semibold text-sm">${props.name}</div>
                <div class="text-xs text-gray-500">${props.operator}</div>
                <div class="text-xs mt-1" style="color:${color};font-weight:600">${statusLabel}</div>
                <div class="text-xs mt-0.5">
                  IT Load: <span class="font-medium">${Number(props.itLoadMw)} MW</span>
                  &middot; Campus: <span class="font-medium">${Number(props.capacityMw)} MW</span>
                </div>
                ${Number(props.completionYear) > 0 ? `<div class="text-xs mt-0.5 text-gray-400">${Number(props.completionYear) > 2025 ? "Expected" : "Online"}: ${props.completionYear}</div>` : ""}
              </div>`
            )
            .addTo(map);
        });

        map.on("mouseleave", "dc-markers", () => {
          map.getCanvas().style.cursor = "";
          popupRef.current?.remove();
        });

        // Click popup (sticky) for data centers
        map.on("click", "dc-markers", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties;
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
            number,
            number,
          ];
          const color = props.color as string;
          const statusLabel = DC_STATUS_LABELS[props.status as string] ?? props.status;
          const sqft = Number(props.campusSqft);
          const sqftStr = sqft > 0 ? `${(sqft / 1000).toFixed(0)}K sq ft` : "N/A";

          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 14,
            maxWidth: "340px",
          })
            .setLngLat(coords)
            .setHTML(
              `<div class="font-sans" style="min-width:220px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                  <div style="width:12px;height:12px;background:${color};border-radius:2px;border:2px solid #fff"></div>
                  <span style="color:${color};font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Data Center</span>
                </div>
                <div class="font-semibold text-sm" style="margin-bottom:2px">${props.name}</div>
                <div class="text-xs text-gray-500" style="margin-bottom:6px">${props.operator}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;font-size:11px">
                  <div><span style="color:#888">Status:</span> <span style="color:${color};font-weight:600">${statusLabel}</span></div>
                  <div><span style="color:#888">${Number(props.completionYear) > 2025 ? "Expected" : "Online"}:</span> <span class="font-medium">${Number(props.completionYear) > 0 ? props.completionYear : "N/A"}</span></div>
                  <div><span style="color:#888">IT Load:</span> <span class="font-medium">${Number(props.itLoadMw)} MW</span></div>
                  <div><span style="color:#888">Campus Power:</span> <span class="font-medium">${Number(props.capacityMw)} MW</span></div>
                  <div><span style="color:#888">Campus Size:</span> <span class="font-medium">${sqftStr}</span></div>
                  ${props.phase ? `<div><span style="color:#888">Phase:</span> <span class="font-medium">${props.phase}</span></div>` : ""}
                </div>
              </div>`
            )
            .addTo(map);
        });
      }

      // Toggle visibility
      const visibility = showDataCenters ? "visible" : "none";
      if (map.getLayer("dc-glow")) map.setLayoutProperty("dc-glow", "visibility", visibility);
      if (map.getLayer("dc-markers")) map.setLayoutProperty("dc-markers", "visibility", visibility);
      if (map.getLayer("dc-labels")) map.setLayoutProperty("dc-labels", "visibility", visibility);
    };

    if (map.isStyleLoaded()) {
      addDcLayers();
    } else {
      map.on("load", addDcLayers);
    }
  }, [dataCenters, showDataCenters]);

  // Update nuclear plant markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || nuclearPlants.length === 0) return;

    // Filter nuclear plants by DC proximity when "Near Data Centers Only" is on
    const filteredNuclear = nearbyDCsOnly
      ? nuclearPlants.filter((np) =>
        dataCenters.some(
          (dc) => distMiles(np.latitude, np.longitude, dc.latitude, dc.longitude) <= DC_PROXIMITY_MILES
        )
      )
      : nuclearPlants;

    const geojson = nuclearPlantsToGeoJSON(filteredNuclear);

    const addNuclearLayers = () => {
      // If source exists, just update data
      if (map.getSource("nuclear-plants")) {
        (map.getSource("nuclear-plants") as maplibregl.GeoJSONSource).setData(
          geojson as GeoJSON.FeatureCollection
        );
      } else {
        map.addSource("nuclear-plants", {
          type: "geojson",
          data: geojson as GeoJSON.FeatureCollection,
        });
      }

      // Only add layers once
      if (!nuclearLayersAdded.current) {
        nuclearLayersAdded.current = true;

        // Generate triangle icon images for each nuclear facility type
        Object.entries(NUCLEAR_COLORS).forEach(([type, color]) => {
          createTriangleIcon(map, `nuclear-tri-${type}`, color, 30);
        });
        // Default fallback icon
        createTriangleIcon(map, "nuclear-tri-default", NUCLEAR_COLOR, 30);

        // Nuclear outer glow
        map.addLayer({
          id: "nuclear-glow",
          type: "circle",
          source: "nuclear-plants",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "capacityMw"],
              100, 14,
              500, 18,
              1000, 22,
              2000, 26,
              4000, 32,
            ],
            "circle-color": NUCLEAR_COLOR,
            "circle-opacity": 0.12,
            "circle-stroke-width": 0,
          },
        });

        // Nuclear marker - triangle icons using symbol layer
        map.addLayer({
          id: "nuclear-markers",
          type: "symbol",
          source: "nuclear-plants",
          layout: {
            "icon-image": [
              "match",
              ["get", "facilityType"],
              "operating", "nuclear-tri-operating",
              "restart", "nuclear-tri-restart",
              "coal_to_nuclear", "nuclear-tri-coal_to_nuclear",
              "legacy", "nuclear-tri-legacy",
              "nuclear-tri-default",
            ],
            "icon-size": [
              "interpolate",
              ["linear"],
              ["get", "capacityMw"],
              100, 0.5,
              500, 0.65,
              1000, 0.8,
              2000, 0.95,
              4000, 1.15,
            ],
            "icon-allow-overlap": true,
          },
        });

        // Nuclear label (plant name at higher zoom)
        map.addLayer({
          id: "nuclear-labels",
          type: "symbol",
          source: "nuclear-plants",
          minzoom: 6,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 10,
            "text-font": ["Open Sans Regular"],
            "text-offset": [0, 1.8],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-optional": true,
            "text-max-width": 12,
          },
          paint: {
            "text-color": NUCLEAR_COLOR,
            "text-halo-color": "rgba(255,255,255,0.85)",
            "text-halo-width": 1.2,
          },
        });

        // Radioactive symbol (☢) at center of marker
        map.addLayer({
          id: "nuclear-icons",
          type: "symbol",
          source: "nuclear-plants",
          layout: {
            "text-field": "☢",
            "text-size": [
              "interpolate",
              ["linear"],
              ["get", "capacityMw"],
              100, 8,
              1000, 11,
              4000, 14,
            ],
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": "#ffffff",
            "text-opacity": 0.9,
          },
        });

        // Hover popup for nuclear plants
        map.on("mouseenter", "nuclear-markers", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties;
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
            number,
            number,
          ];
          const color = props.color as string;
          const typeLabel = NUCLEAR_LABELS[props.facilityType as string] ?? props.facilityType;

          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            maxWidth: "300px",
          })
            .setLngLat(coords)
            .setHTML(
              `<div class="font-sans" style="min-width:200px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <div style="width:10px;height:10px;background:${color};border-radius:2px;border:2px solid #fff"></div>
                  <span style="color:${color};font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Nuclear ☢</span>
                </div>
                <div class="font-semibold text-sm">${props.name}</div>
                <div class="text-xs text-gray-500">${props.state} &middot; ${props.region}</div>
                <div class="text-xs mt-1">
                  <span style="color:${color};font-weight:600">${typeLabel}</span>
                </div>
                <div class="text-xs mt-0.5">
                  Capacity: <span class="font-medium">${Number(props.capacityMw).toLocaleString()} MW</span>
                </div>
                ${props.operator !== "Unknown" ? `<div class="text-xs mt-0.5 text-gray-500">${props.operator}</div>` : ""}
                ${props.notes ? `<div class="text-xs mt-1 text-gray-400" style="max-width:250px">${props.notes}</div>` : ""}
              </div>`
            )
            .addTo(map);
        });

        map.on("mouseleave", "nuclear-markers", () => {
          map.getCanvas().style.cursor = "";
          popupRef.current?.remove();
        });

        // Click popup (sticky)
        map.on("click", "nuclear-markers", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const props = feature.properties;
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [
            number,
            number,
          ];
          const color = props.color as string;
          const typeLabel = NUCLEAR_LABELS[props.facilityType as string] ?? props.facilityType;

          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            offset: 14,
            maxWidth: "320px",
          })
            .setLngLat(coords)
            .setHTML(
              `<div class="font-sans" style="min-width:220px">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                  <div style="width:12px;height:12px;background:${color};border-radius:2px;border:2px solid #fff"></div>
                  <span style="color:${color};font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Nuclear ☢</span>
                </div>
                <div class="font-semibold text-sm" style="margin-bottom:2px">${props.name}</div>
                <div class="text-xs text-gray-500" style="margin-bottom:4px">${props.operator}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
                  <div><span style="color:#888">Type:</span> <span style="color:${color};font-weight:600">${typeLabel}</span></div>
                  <div><span style="color:#888">Status:</span> <span class="font-medium">${props.status}</span></div>
                  <div><span style="color:#888">Capacity:</span> <span class="font-medium">${Number(props.capacityMw).toLocaleString()} MW</span></div>
                  <div><span style="color:#888">Region:</span> <span class="font-medium">${props.region}</span></div>
                </div>
                ${props.notes ? `<div class="text-xs mt-2 text-gray-400" style="border-top:1px solid rgba(255,255,255,0.1);padding-top:4px">${props.notes}</div>` : ""}
              </div>`
            )
            .addTo(map);
        });
      }

      // Toggle visibility
      const visibility = showNuclearPlants ? "visible" : "none";
      if (map.getLayer("nuclear-glow")) map.setLayoutProperty("nuclear-glow", "visibility", visibility);
      if (map.getLayer("nuclear-markers")) map.setLayoutProperty("nuclear-markers", "visibility", visibility);
      if (map.getLayer("nuclear-labels")) map.setLayoutProperty("nuclear-labels", "visibility", visibility);
      if (map.getLayer("nuclear-icons")) map.setLayoutProperty("nuclear-icons", "visibility", visibility);
    };

    if (map.isStyleLoaded()) {
      addNuclearLayers();
    } else {
      map.on("load", addNuclearLayers);
    }
  }, [nuclearPlants, showNuclearPlants, nearbyDCsOnly, dataCenters]);

  // Fly to selected plant
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlantId) return;

    const plant = plants.find((p) => p.id === selectedPlantId);
    if (!plant) return;

    map.flyTo({
      center: [plant.longitude, plant.latitude],
      zoom: Math.max(map.getZoom(), 8),
      duration: 1000,
    });

    // Update stroke highlight
    if (map.getLayer("plant-bubbles")) {
      map.setPaintProperty("plant-bubbles", "circle-stroke-width", [
        "case",
        ["==", ["get", "id"], selectedPlantId],
        3,
        1,
      ]);
      map.setPaintProperty("plant-bubbles", "circle-stroke-color", [
        "case",
        ["==", ["get", "id"], selectedPlantId],
        "#ffffff",
        "rgba(255,255,255,0.4)",
      ]);
    }
  }, [selectedPlantId, plants]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
