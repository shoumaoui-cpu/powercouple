"use client";

import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GasPlant } from "@/types";

interface ConflictTabProps {
  plant: GasPlant;
}

export function ConflictTab({ plant }: ConflictTabProps) {
  const optimizationResult = useAppStore((s) => s.optimizationResult);

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <h3 className="mb-1 text-sm font-semibold text-foreground">
          Conflict Analysis
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Conflict analysis identifies hours when gas plant dispatch overlaps
          with system peak demand. During these periods, retiring gas capacity
          and replacing it with solar+storage may require additional grid
          support. Understanding conflict hours helps size battery storage and
          assess grid reliability impacts.
        </p>
      </div>

      {/* Plant demand region */}
      <Card className="border-border">
        <CardContent className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Demand Region
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {plant.demandRegion ?? "Unknown"}
            </span>
            {plant.balancingAuthority && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                BA: {plant.balancingAuthority}
              </Badge>
            )}
            {plant.nercRegion && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                NERC: {plant.nercRegion}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Optimization-based conflict metrics */}
      {optimizationResult ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Conflict Metrics
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Conflict Hours
                </p>
                <p className="text-sm font-mono font-semibold text-pc-gold">
                  {optimizationResult.conflictHours != null
                    ? `${optimizationResult.conflictHours} hrs`
                    : "--"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Gas Backup Required
                </p>
                <p className="text-sm font-mono font-semibold text-pc-red">
                  {(optimizationResult.gasBackupActual * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {optimizationResult.conflictHours != null &&
            optimizationResult.conflictHours > 0 && (
              <div className="rounded-md border border-pc-gold/30 bg-pc-gold/5 p-3">
                <p className="text-xs text-pc-gold">
                  This plant has {optimizationResult.conflictHours} hours of
                  potential conflict where gas dispatch coincides with peak
                  system demand. The hybrid configuration includes battery
                  storage to cover{" "}
                  {(100 - optimizationResult.gasBackupActual * 100).toFixed(0)}%
                  of these periods.
                </p>
              </div>
            )}
        </div>
      ) : (
        /* Placeholder when no optimization has been run */
        <div className="rounded-md border border-border bg-muted/20 p-6 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-2 text-muted-foreground"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm text-muted-foreground">
            Conflict analysis will be available after optimization data and
            system demand profiles are loaded.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Run an optimization from the Optimization tab to generate conflict
            metrics.
          </p>
        </div>
      )}
    </div>
  );
}
