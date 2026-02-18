"use client";

import { useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { ACRES_PER_MW_SOLAR } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import type { GasPlant } from "@/types";

interface LandUseTabProps {
  plant: GasPlant;
}

const ACRES_PER_SQ_KM = 247.105;
const FOOTBALL_FIELDS_PER_ACRE = 0.756; // 1 acre ~ 0.756 football fields

export function LandUseTab({ plant }: LandUseTabProps) {
  const optimizationResult = useAppStore((s) => s.optimizationResult);

  const landMetrics = useMemo(() => {
    const solarMw = optimizationResult
      ? optimizationResult.solarCapacityMw
      : plant.solarPotentialMw;

    if (solarMw == null || solarMw <= 0) return null;

    const acres = solarMw * ACRES_PER_MW_SOLAR;
    const sqKm = acres / ACRES_PER_SQ_KM;
    const footballFields = Math.round(acres * FOOTBALL_FIELDS_PER_ACRE);

    return {
      solarMw,
      acres,
      sqKm,
      footballFields,
      isFromOptimization: optimizationResult != null,
    };
  }, [optimizationResult, plant.solarPotentialMw]);

  return (
    <div className="space-y-4">
      {/* Source label */}
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Land use estimates are based on an average of{" "}
          <span className="font-semibold text-foreground">
            {ACRES_PER_MW_SOLAR} acres per MW
          </span>{" "}
          of solar capacity, which accounts for panel spacing, access roads,
          inverter pads, and buffer zones for utility-scale solar installations.
        </p>
      </div>

      {landMetrics ? (
        <>
          {/* Main metrics */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Solar Capacity
                </p>
                <p className="text-lg font-mono font-semibold text-pc-gold">
                  {landMetrics.solarMw.toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground">MW</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Land Area
                </p>
                <p className="text-lg font-mono font-semibold text-pc-green">
                  {landMetrics.acres.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-[10px] text-muted-foreground">acres</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Area (metric)
                </p>
                <p className="text-lg font-mono font-semibold text-pc-blue">
                  {landMetrics.sqKm.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">sq km</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Equivalent Area
                </p>
                <p className="text-lg font-mono font-semibold text-foreground">
                  ~{landMetrics.footballFields.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  football fields
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Data source note */}
          {!landMetrics.isFromOptimization && (
            <div className="rounded-md border border-pc-gold/30 bg-pc-gold/5 p-3">
              <p className="text-xs text-pc-gold">
                These estimates use the plant&apos;s solar potential ({landMetrics.solarMw.toFixed(1)} MW).
                Run an optimization for a more precise solar capacity sizing.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No solar capacity data available to estimate land use.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Run an optimization to determine the required solar capacity.
          </p>
        </div>
      )}

      {/* Plant location */}
      <Card className="border-border">
        <CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Plant Location
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-sm text-foreground">
              {plant.latitude.toFixed(4)}N, {Math.abs(plant.longitude).toFixed(4)}
              {plant.longitude < 0 ? "W" : "E"}
            </span>
            <span className="text-xs text-muted-foreground">
              {plant.county ? `${plant.county}, ` : ""}
              {plant.state}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
