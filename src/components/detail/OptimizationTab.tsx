"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  COST_SCENARIOS,
  DEFAULT_COMMISSIONING_YEAR,
} from "@/lib/constants";
import type { GasPlant, OptimizationResult } from "@/types";

interface OptimizationTabProps {
  plant: GasPlant;
}

function FactorRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-border px-2 py-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-foreground">{value}</p>
    </div>
  );
}

export function OptimizationTab({ plant }: OptimizationTabProps) {
  const optimizationResult = useAppStore((s) => s.optimizationResult);
  const isOptimizing = useAppStore((s) => s.isOptimizing);
  const setOptimizationResult = useAppStore((s) => s.setOptimizationResult);
  const setIsOptimizing = useAppStore((s) => s.setIsOptimizing);

  const [targetLoadMw, setTargetLoadMw] = useState<number>(
    plant.nameplateCapacityMw
  );
  const [maxGasBackupPct, setMaxGasBackupPct] = useState<number>(5);
  const [commissioningYear, setCommissioningYear] = useState<number>(
    DEFAULT_COMMISSIONING_YEAR
  );
  const [costScenario, setCostScenario] = useState<string>("base");
  const [error, setError] = useState<string | null>(null);

  const gasUtilizationInput = plant.utilizationRate ?? plant.capacityFactor;
  const normalizedGasCf =
    gasUtilizationInput != null
      ? (gasUtilizationInput > 1 ? gasUtilizationInput / 100 : gasUtilizationInput)
      : null;
  const normalizedSolarCf =
    plant.solarCf != null
      ? (plant.solarCf > 1 ? plant.solarCf / 100 : plant.solarCf)
      : null;

  const handleOptimize = async () => {
    setError(null);
    setIsOptimizing(true);
    setOptimizationResult(null);

    const backupPctDecimal = maxGasBackupPct / 100;

    // Try FastAPI backend first
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plantId: plant.id,
          targetLoadMw,
          maxGasBackupPct: backupPctDecimal,
          commissioningYear,
          costScenario,
          latitude: plant.latitude,
          gasHeatRateBtuKwh: plant.heatRateBtuKwh,
          gasCapacityFactor: normalizedGasCf,
          solarCfHint: normalizedSolarCf,
          maxSolarMw: plant.solarPotentialMw,
        }),
      });

      if (res.ok) {
        const result: OptimizationResult = await res.json();
        setOptimizationResult(result);
        setIsOptimizing(false);
        return;
      }
      const raw = await res.text();
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        setError(parsed.error ?? raw ?? "Optimization failed");
      } catch {
        setError(raw || "Optimization failed");
      }
    } catch {
      setError("Optimization service unavailable. Ensure FastAPI backend is running.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const lcoeColor = (lcoe: number) => {
    if (lcoe < 40) return "text-pc-green";
    if (lcoe < 70) return "text-pc-gold";
    return "text-pc-red";
  };

  return (
    <div className="space-y-4">
      {/* ── Input Form ───────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="targetLoad" className="text-xs">
              Target Load (MW)
            </Label>
            <Input
              id="targetLoad"
              type="number"
              min={1}
              step={1}
              value={targetLoadMw}
              onChange={(e) => setTargetLoadMw(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gasBackup" className="text-xs">
              Max Gas Backup (%)
            </Label>
            <Input
              id="gasBackup"
              type="number"
              min={0}
              max={100}
              step={1}
              value={maxGasBackupPct}
              onChange={(e) => setMaxGasBackupPct(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="commYear" className="text-xs">
              Commissioning Year
            </Label>
            <Input
              id="commYear"
              type="number"
              min={2025}
              max={2040}
              step={1}
              value={commissioningYear}
              onChange={(e) => setCommissioningYear(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="costScenario" className="text-xs">
              Cost Scenario
            </Label>
            <Select value={costScenario} onValueChange={setCostScenario}>
              <SelectTrigger id="costScenario">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COST_SCENARIOS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="w-full bg-pc-green hover:bg-pc-green/90 text-pc-dark font-semibold"
        >
          {isOptimizing ? "Optimizing..." : "Run Optimization"}
        </Button>

        {error && (
          <p className="text-sm text-pc-red">{error}</p>
        )}

        <Card className="border-border">
          <CardContent className="p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Site Factors Used
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <FactorRow
                label="Latitude"
                value={plant.latitude != null ? `${plant.latitude.toFixed(2)}°` : "Default"}
              />
              <FactorRow
                label="Heat Rate"
                value={
                  plant.heatRateBtuKwh != null
                    ? `${plant.heatRateBtuKwh.toFixed(0)} BTU/kWh`
                    : "Default"
                }
              />
              <FactorRow
                label="Gas Utilization"
                value={
                  normalizedGasCf != null
                    ? `${(normalizedGasCf * 100).toFixed(1)}%`
                    : "Default"
                }
              />
              <FactorRow
                label="Solar CF Hint"
                value={
                  normalizedSolarCf != null
                    ? `${(normalizedSolarCf * 100).toFixed(1)}%`
                    : "Default"
                }
              />
              <FactorRow
                label="Max Solar"
                value={
                  plant.solarPotentialMw != null
                    ? `${plant.solarPotentialMw.toFixed(0)} MW`
                    : "Uncapped"
                }
              />
              <FactorRow
                label="Plant ID"
                value={plant.id.slice(0, 10)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Loading ──────────────────────────────────────────── */}
      {isOptimizing && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-pc-green border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">Optimizing...</p>
          </div>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────── */}
      {optimizationResult && !isOptimizing && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Optimization Results
            </h3>
            <Badge
              className={
                optimizationResult.solverStatus.toLowerCase() === "optimal"
                  ? "bg-pc-green/20 text-pc-green border-pc-green/30"
                  : "bg-pc-gold/20 text-pc-gold border-pc-gold/30"
              }
            >
              {optimizationResult.solverStatus}
            </Badge>
          </div>

          {/* Result cards */}
          <div className="grid grid-cols-2 gap-2">
            <ResultCard
              label="Optimal Solar"
              value={`${optimizationResult.solarCapacityMw.toFixed(1)} MW`}
              color="text-pc-gold"
            />
            <ResultCard
              label="Battery"
              value={`${optimizationResult.batteryPowerMw.toFixed(1)} MW / ${optimizationResult.batteryEnergyMwh.toFixed(0)} MWh`}
              color="text-pc-blue"
            />
            <ResultCard
              label="Net LCOE"
              value={`$${optimizationResult.netLcoe.toFixed(1)}/MWh`}
              color={lcoeColor(optimizationResult.netLcoe)}
            />
            <ResultCard
              label="Gas Backup"
              value={`${(optimizationResult.gasBackupActual * 100).toFixed(1)}%`}
              color="text-pc-red"
            />
          </div>

          {/* LCOE Comparison */}
          <Card className="border-border">
            <CardContent className="p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                LCOE Comparison
              </p>
              <div className="space-y-2">
                <LcoeBar
                  label="Gas-Only"
                  value={optimizationResult.lcoeGasOnly}
                  maxVal={Math.max(
                    optimizationResult.lcoeGasOnly,
                    optimizationResult.netLcoe
                  )}
                  color="bg-pc-red"
                />
                <LcoeBar
                  label="Hybrid"
                  value={optimizationResult.netLcoe}
                  maxVal={Math.max(
                    optimizationResult.lcoeGasOnly,
                    optimizationResult.netLcoe
                  )}
                  color="bg-pc-green"
                />
              </div>
              {optimizationResult.lcoeGasOnly > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Savings:{" "}
                  <span className="font-semibold text-pc-green">
                    {(
                      ((optimizationResult.lcoeGasOnly -
                        optimizationResult.netLcoe) /
                        optimizationResult.lcoeGasOnly) *
                      100
                    ).toFixed(1)}
                    %
                  </span>{" "}
                  reduction in LCOE
                </p>
              )}
            </CardContent>
          </Card>

          {/* LCOE Breakdown */}
          {optimizationResult.lcoeBreakdown && (
            <Card className="border-border">
              <CardContent className="p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  LCOE Breakdown
                </p>
                <div className="space-y-1 text-xs">
                  <BreakdownRow
                    label="Solar"
                    value={optimizationResult.lcoeBreakdown.solarCost}
                    color="text-pc-gold"
                  />
                  <BreakdownRow
                    label="Battery"
                    value={optimizationResult.lcoeBreakdown.batteryCost}
                    color="text-pc-blue"
                  />
                  <BreakdownRow
                    label="Gas"
                    value={optimizationResult.lcoeBreakdown.gasCost}
                    color="text-pc-red"
                  />
                  {optimizationResult.lcoeBreakdown.excessSolarRevenue > 0 && (
                    <BreakdownRow
                      label="Excess Solar Rev."
                      value={
                        -optimizationResult.lcoeBreakdown.excessSolarRevenue
                      }
                      color="text-pc-green"
                    />
                  )}
                  <div className="border-t border-border pt-1">
                    <BreakdownRow
                      label="Total"
                      value={optimizationResult.lcoeBreakdown.total}
                      color="text-foreground"
                      bold
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helper sub-components ────────────────────────────────────────── */

function ResultCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`text-sm font-mono font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function LcoeBar({
  label,
  value,
  maxVal,
  color,
}: {
  label: string;
  value: number;
  maxVal: number;
  color: string;
}) {
  const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
        <div
          className={`h-full rounded ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 text-right text-xs font-mono text-foreground">
        ${value.toFixed(1)}/MWh
      </span>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: number;
  color: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`${color} ${bold ? "font-semibold" : ""}`}
      >
        {label}
      </span>
      <span
        className={`font-mono ${color} ${bold ? "font-semibold" : ""}`}
      >
        ${value.toFixed(1)}/MWh
      </span>
    </div>
  );
}
