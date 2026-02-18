export const PRIME_MOVER_LABELS: Record<string, string> = {
  CA: "Combined Cycle Steam Part",
  CS: "Combined Cycle Single Shaft",
  CT: "Combustion Turbine",
  IC: "Internal Combustion",
  ST: "Steam Turbine",
};

export const PRIME_MOVER_TYPES = Object.keys(PRIME_MOVER_LABELS);

export const NERC_REGIONS = [
  "WECC",
  "TRE",
  "REC",
  "SERC",
  "RFC",
  "NPCC",
  "MRO",
] as const;

// ISO/RTO demand regions used for filtering (matches demandRegion in plant data)
export const DEMAND_REGIONS = [
  "PJM",
  "ERCOT",
  "MISO",
  "CAISO",
  "SPP",
  "SERC",
  "NWPP",
  "NYISO",
  "ISO-NE",
  "SWPP",
  "FRCC",
] as const;

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

export const DEFAULT_GAS_PRICE_PER_MMBTU = 3.50;
export const ACRES_PER_MW_SOLAR = 6;
export const DEFAULT_MAX_GAS_BACKUP_PCT = 0.05;
export const DEFAULT_COMMISSIONING_YEAR = 2028;
export const DEFAULT_COST_SCENARIO = "base";
export const DC_PROXIMITY_KM = 80;

export const COST_SCENARIOS = [
  { value: "base", label: "Base (BNEF 2024)" },
  { value: "optimistic", label: "Optimistic" },
  { value: "conservative", label: "Conservative" },
] as const;

export const DEFAULT_FILTER_STATE = {
  regions: [] as string[],
  states: [] as string[],
  capacityRange: [0, 5000] as [number, number],
  capacityFactorRange: [0, 1] as [number, number],
  utilizationRange: [0, 1] as [number, number],
  primeMoverTypes: [] as string[],
  nearbyDCsOnly: false,
  lcoeRange: [0, 200] as [number, number],
};

// Map tile source (Carto dark basemap - free, no API key)
export const MAP_TILE_URL =
  "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png";

export const MAP_CENTER: [number, number] = [-98.5, 39.8];
export const MAP_ZOOM = 4;
