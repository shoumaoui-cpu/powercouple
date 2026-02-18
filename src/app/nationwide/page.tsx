"use client";

import { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMw } from "@/lib/utils";
import { MAP_TILE_URL, US_STATES } from "@/lib/constants";
import type { StatePotential } from "@/types";

// Static state centroid data for the choropleth (major gas-producing states)
const STATE_CENTROIDS: Record<string, [number, number]> = {
  TX: [-99.9, 31.97], CA: [-119.42, 36.78], FL: [-81.52, 27.66],
  PA: [-77.21, 41.2], LA: [-91.87, 30.98], NY: [-75.0, 43.0],
  IL: [-89.4, 40.63], OH: [-82.91, 40.42], GA: [-83.5, 32.17],
  NC: [-79.0, 35.76], MI: [-84.54, 44.31], NJ: [-74.41, 40.06],
  VA: [-79.45, 37.77], AZ: [-111.09, 34.05], MA: [-71.38, 42.41],
  IN: [-86.13, 40.27], TN: [-86.58, 35.52], MO: [-91.83, 38.57],
  WI: [-89.62, 43.78], CO: [-105.37, 39.11], SC: [-81.16, 33.84],
  AL: [-86.9, 32.32], MN: [-94.69, 46.73], MD: [-76.64, 39.05],
  NV: [-116.42, 38.8], OK: [-97.09, 35.47], MS: [-89.68, 32.35],
  AR: [-92.37, 34.75], KS: [-98.48, 38.5], CT: [-72.76, 41.6],
  UT: [-111.09, 39.32], NM: [-105.87, 34.52], WV: [-80.95, 38.6],
  NE: [-99.81, 41.49], ID: [-114.74, 44.07], HI: [-155.5, 19.9],
  ME: [-69.45, 45.25], NH: [-71.57, 43.99], RI: [-71.48, 41.58],
  MT: [-109.53, 46.88], DE: [-75.51, 39.16], SD: [-99.9, 43.97],
  ND: [-101.0, 47.55], AK: [-153.37, 64.26], VT: [-72.58, 44.56],
  WY: [-107.29, 43.08], OR: [-120.55, 43.8], WA: [-120.74, 47.75],
  IA: [-93.1, 42.01], KY: [-84.27, 37.84], DC: [-77.03, 38.91],
};

export default function NationwidePage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [stateData, setStateData] = useState<StatePotential[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch state-level aggregation from plants API
  useEffect(() => {
    fetch("/api/plants")
      .then((r) => r.json())
      .then((plants: { state: string; nameplateCapacityMw: number; lcoeHybrid: number | null; lcoeGasOnly: number | null }[]) => {
        // Aggregate by state
        const stateMap = new Map<
          string,
          { count: number; totalMw: number; lcoeSavingsSum: number; lcoeSavingsCount: number }
        >();

        for (const p of plants) {
          const existing = stateMap.get(p.state) ?? {
            count: 0,
            totalMw: 0,
            lcoeSavingsSum: 0,
            lcoeSavingsCount: 0,
          };
          existing.count++;
          existing.totalMw += p.nameplateCapacityMw;
          if (p.lcoeGasOnly != null && p.lcoeHybrid != null) {
            existing.lcoeSavingsSum += p.lcoeGasOnly - p.lcoeHybrid;
            existing.lcoeSavingsCount++;
          }
          stateMap.set(p.state, existing);
        }

        const result: StatePotential[] = Array.from(stateMap.entries())
          .map(([state, data]) => ({
            state: US_STATES[state] ?? state,
            stateCode: state,
            plantCount: data.count,
            totalCapacityMw: data.totalMw,
            hybridPotentialMw: data.totalMw * 0.8, // rough estimate
            avgLcoeSavings:
              data.lcoeSavingsCount > 0
                ? data.lcoeSavingsSum / data.lcoeSavingsCount
                : null,
          }))
          .sort((a, b) => b.totalCapacityMw - a.totalCapacityMw);

        setStateData(result);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
            attribution: "&copy; CARTO &copy; OpenStreetMap",
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
      center: [-98.5, 39.8],
      zoom: 4,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add state markers when data is available
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stateData.length === 0) return;

    const maxCapacity = Math.max(...stateData.map((s) => s.totalCapacityMw));

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: stateData
        .filter((s) => STATE_CENTROIDS[s.stateCode])
        .map((s) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: STATE_CENTROIDS[s.stateCode],
          },
          properties: {
            state: s.stateCode,
            stateName: s.state,
            capacity: s.totalCapacityMw,
            plants: s.plantCount,
            normalized: s.totalCapacityMw / maxCapacity,
          },
        })),
    };

    const addLayers = () => {
      if (map.getSource("state-potential")) {
        (map.getSource("state-potential") as maplibregl.GeoJSONSource).setData(geojson);
        return;
      }

      map.addSource("state-potential", { type: "geojson", data: geojson });

      map.addLayer({
        id: "state-bubbles",
        type: "circle",
        source: "state-potential",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "normalized"],
            0, 8,
            0.3, 16,
            0.6, 28,
            1, 42,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "normalized"],
            0, "rgba(78, 204, 163, 0.2)",
            0.3, "rgba(78, 204, 163, 0.4)",
            0.6, "rgba(78, 204, 163, 0.6)",
            1, "rgba(78, 204, 163, 0.8)",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#4ecca3",
        },
      });

      map.addLayer({
        id: "state-labels",
        type: "symbol",
        source: "state-potential",
        layout: {
          "text-field": [
            "concat",
            ["get", "state"],
            "\n",
            ["to-string", ["round", ["get", "capacity"]]],
            " MW",
          ],
          "text-size": 11,
          "text-font": ["Open Sans Regular"],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1,
        },
      });
    };

    if (map.isStyleLoaded()) addLayers();
    else map.on("load", addLayers);
  }, [stateData]);

  return (
    <div className="flex flex-col h-screen bg-pc-dark">
      <Navigation />

      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full" />
        </div>

        {/* Side panel */}
        <aside className="w-96 bg-background border-l border-border overflow-y-auto">
          <div className="p-4 border-b border-border">
            <h1 className="font-mono text-lg font-bold tracking-wider">
              Nationwide Potential
            </h1>
            <p className="text-muted-foreground text-xs mt-1">
              Gas plant capacity by state available for hybrid conversion
            </p>
          </div>

          {loading ? (
            <div className="p-4 text-muted-foreground text-sm font-mono">
              Loading...
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stateData.slice(0, 25).map((s) => (
                <div key={s.stateCode} className="p-3 hover:bg-accent/30">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{s.state}</span>
                    <span className="font-mono text-sm text-pc-green">
                      {formatMw(s.totalCapacityMw)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>{s.plantCount} plants</span>
                    {s.avgLcoeSavings != null && (
                      <span className="text-pc-green">
                        Avg savings: ${Math.round(s.avgLcoeSavings)}/MWh
                      </span>
                    )}
                  </div>
                  {/* Capacity bar */}
                  <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pc-green rounded-full"
                      style={{
                        width: `${(s.totalCapacityMw / (stateData[0]?.totalCapacityMw || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
