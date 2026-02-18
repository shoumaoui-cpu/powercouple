"use client";

import { useAppStore } from "@/store/useAppStore";
import { DEMAND_REGIONS, NERC_REGIONS, US_STATES, PRIME_MOVER_LABELS } from "@/lib/constants";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

function MultiCheckbox({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div>
      <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`px-2 py-1 text-xs rounded-md border transition-colors ${
              selected.includes(opt.value)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-input hover:bg-accent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterPanel() {
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const pathname = usePathname();

  const isEia860 = pathname?.startsWith("/eia860");
  const isEnergyInstituteDashboard = pathname === "/";
  const regionLabel = isEia860 ? "NERC Region (Column M)" : "Region (ISO/RTO)";
  const regionOptions = (isEia860 ? NERC_REGIONS : DEMAND_REGIONS).map((r) => ({
    value: r,
    label: r,
  }));

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-shrink-0">
      {isEnergyInstituteDashboard && (
        <a
          href="https://haas.berkeley.edu/wp-content/uploads/WP356.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md border border-input bg-muted/40 px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="font-semibold text-foreground">Source:</span>{" "}
          Utilizing Noncoincident Needs to Site Data Centers with Solar+Storage at Existing Gas Plants
        </a>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wider font-semibold">
          Filters
        </h2>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      <Separator />

      {/* Region filter */}
      <MultiCheckbox
        label={regionLabel}
        options={regionOptions}
        selected={filters.regions}
        onChange={(regions) => setFilters({ regions })}
      />

      {/* State filter */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          State
        </Label>
        <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto">
          {Object.entries(US_STATES).map(([code, name]) => (
            <button
              key={code}
              onClick={() => {
                const states = filters.states.includes(code)
                  ? filters.states.filter((s) => s !== code)
                  : [...filters.states, code];
                setFilters({ states });
              }}
              title={name}
              className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                filters.states.includes(code)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-input hover:bg-accent"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      {/* Technology type */}
      <MultiCheckbox
        label="Technology"
        options={Object.entries(PRIME_MOVER_LABELS).map(([value, label]) => ({
          value,
          label: `${value} - ${label}`,
        }))}
        selected={filters.primeMoverTypes}
        onChange={(primeMoverTypes) => setFilters({ primeMoverTypes })}
      />

      <Separator />

      {/* Capacity range */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Capacity: {filters.capacityRange[0]}–{filters.capacityRange[1]} MW
        </Label>
        <Slider
          className="mt-2"
          min={0}
          max={5000}
          step={10}
          value={filters.capacityRange}
          onValueChange={(value) =>
            setFilters({ capacityRange: value as [number, number] })
          }
        />
      </div>

      {/* Capacity factor range */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Capacity Factor: {(filters.capacityFactorRange[0] * 100).toFixed(0)}–
          {(filters.capacityFactorRange[1] * 100).toFixed(0)}%
        </Label>
        <Slider
          className="mt-2"
          min={0}
          max={1}
          step={0.01}
          value={filters.capacityFactorRange}
          onValueChange={(value) =>
            setFilters({ capacityFactorRange: value as [number, number] })
          }
        />
      </div>

      {/* Utilization range */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Utilization: {(filters.utilizationRange[0] * 100).toFixed(0)}–
          {(filters.utilizationRange[1] * 100).toFixed(0)}%
        </Label>
        <Slider
          className="mt-2"
          min={0}
          max={1}
          step={0.01}
          value={filters.utilizationRange}
          onValueChange={(value) =>
            setFilters({ utilizationRange: value as [number, number] })
          }
        />
      </div>

      {/* LCOE range */}
      <div>
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          LCOE: ${filters.lcoeRange[0]}–${filters.lcoeRange[1]}/MWh
        </Label>
        <Slider
          className="mt-2"
          min={0}
          max={200}
          step={5}
          value={filters.lcoeRange}
          onValueChange={(value) =>
            setFilters({ lcoeRange: value as [number, number] })
          }
        />
      </div>

      <Separator />

      {/* Near data centers toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Near Data Centers Only
        </Label>
        <Switch
          checked={filters.nearbyDCsOnly}
          onCheckedChange={(nearbyDCsOnly) => setFilters({ nearbyDCsOnly })}
        />
      </div>
    </div>
  );
}
