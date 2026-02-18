// ─── Gas Plant ───────────────────────────────────────────────────────

export interface GasPlant {
  id: string;
  eiaPlantCode: number;
  plantName: string;
  operatorName: string | null;
  state: string;
  county: string | null;
  latitude: number;
  longitude: number;

  nameplateCapacityMw: number;
  summerCapacityMw: number | null;
  winterCapacityMw: number | null;
  ctCapacityMw: number | null;
  ccgtCapacityMw: number | null;

  capacityFactor: number | null;
  utilizationRate?: number | null;
  ctCapacityFactor: number | null;
  ccgtCapacityFactor: number | null;
  annualGenMwh: number | null;
  heatRateBtuKwh: number | null;
  variableCostCt: number | null;
  variableCostCcgt: number | null;

  primeMover: string;
  operatingStatus: string;
  demandRegion: string | null;
  balancingAuthority: string | null;
  nercRegion: string | null;

  solarPotentialMw: number | null;
  solarCf: number | null;

  lcoeHybrid: number | null;
  lcoeGasOnly: number | null;

  nearbyDcCount: number;
  eia860Year: number | null;
  eia923Year: number | null;
}

// ─── Data Center ─────────────────────────────────────────────────────

export interface DataCenter {
  id: string;
  name: string;
  operator: string | null;
  status: string | null;
  latitude: number;
  longitude: number;
  capacityMw: number | null;
  itLoadMw: number | null;
  completionYear: number | null;
  campusSqft: number | null;
  phase: string | null;
  source: string | null;
}

// ─── Nuclear Plant ──────────────────────────────────────────────────

export interface NuclearPlant {
  id: string;
  name: string;
  facilityType: string; // "operating", "restart", "coal_to_nuclear", "legacy"
  status: string;
  capacityMw: number;
  region: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  operator: string | null;
  notes: string | null;
  sourceUrl: string | null;
}

// ─── Filters ─────────────────────────────────────────────────────────

export interface FilterState {
  regions: string[];
  states: string[];
  capacityRange: [number, number];
  capacityFactorRange: [number, number];
  utilizationRange: [number, number];
  primeMoverTypes: string[];
  nearbyDCsOnly: boolean;
  lcoeRange: [number, number];
}

// ─── Optimization ────────────────────────────────────────────────────

export interface OptimizationParams {
  plantId: string;
  targetLoadMw: number;
  maxGasBackupPct: number;
  commissioningYear: number;
  costScenario: string;
  conflictPct: number | null;
}

export interface OptimizationResult {
  solarCapacityMw: number;
  batteryPowerMw: number;
  batteryEnergyMwh: number;
  netLcoe: number;
  lcoeGasOnly: number;
  gasBackupActual: number;
  emissionsFactor: number | null;
  excessSolarMwh: number | null;
  solarToLoadRatio: number | null;
  conflictHours: number | null;
  solverStatus: string;
  lcoeBreakdown: LcoeBreakdown | null;
  hourlyDispatch: DispatchHour[] | null;
}

export interface LcoeBreakdown {
  solarCost: number;
  batteryCost: number;
  gasCost: number;
  excessSolarRevenue: number;
  total: number;
}

export interface DispatchHour {
  hour: number;
  solarMw: number;
  batteryMw: number; // positive = discharge, negative = charge
  gasMw: number;
  loadMw: number;
  soc: number; // state of charge 0-1
}

// ─── Solar Profile ───────────────────────────────────────────────────

export interface SolarProfilePoint {
  hour: number;
  cf: number;
}

// ─── Region Stats ────────────────────────────────────────────────────

export interface RegionStats {
  region: string;
  plantCount: number;
  totalCapacityMw: number;
  avgCapacityFactor: number;
  avgLcoeGasOnly: number | null;
  avgLcoeHybrid: number | null;
  totalSupportableLoadMw: number | null;
}

// ─── Nationwide Potential ────────────────────────────────────────────

export interface StatePotential {
  state: string;
  stateCode: string;
  plantCount: number;
  totalCapacityMw: number;
  hybridPotentialMw: number | null;
  avgLcoeSavings: number | null;
}

// ─── Cost Assumptions ────────────────────────────────────────────────

export interface CostAssumption {
  scenario: string;
  commissioningYear: number;
  solarCapexPerKw: number;
  batteryCapexPerKwh: number;
  batteryCapexPerKw: number;
  solarOmPerKwYear: number;
  batteryOmPerKwYear: number;
  wacc: number;
  crf: number;
  projectLifetimeYrs: number;
  batteryRte: number;
  inverterEfficiency: number;
  maxBatteryDuration: number;
}
