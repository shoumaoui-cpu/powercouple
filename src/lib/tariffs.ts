/**
 * Regional utility tariff data for large-load (data center) interconnections.
 *
 * These represent typical all-in electricity rates for large industrial/
 * data center customers under published tariff schedules, including:
 *   - Energy charges ($/MWh)
 *   - Demand charges ($/kW-month, amortized to $/MWh)
 *   - Transmission & distribution riders
 *   - Capacity payments / resource adequacy
 *
 * Sources: EIA-861 average industrial rates, FERC-filed tariffs,
 * state PUC rate orders, and data center industry benchmarks.
 * Rates are approximate all-in costs for 2023-2024.
 */

export interface RegionalTariff {
  region: string;
  utilityName: string;
  tariffSchedule: string;
  energyRate: number;          // $/MWh weighted avg energy charge
  demandCharge: number;        // $/kW-month
  demandChargePerMwh: number;  // demand amortized to $/MWh at typical LF
  transmissionRate: number;    // $/MWh transmission
  distributionRate: number;    // $/MWh distribution
  ridersSurcharges: number;    // $/MWh all riders, environmental, etc.
  allInRate: number;           // $/MWh total all-in cost
  loadFactor: number;          // assumed load factor for demand amortization
  notes: string;
}

export const REGIONAL_TARIFFS: RegionalTariff[] = [
  {
    region: "PJM",
    utilityName: "Dominion Energy Virginia",
    tariffSchedule: "Schedule GS-3 / GS-4 (Large General Svc >500 kW)",
    energyRate: 42.5,
    demandCharge: 12.80,
    demandChargePerMwh: 17.5,
    transmissionRate: 8.2,
    distributionRate: 5.4,
    ridersSurcharges: 4.8,
    allInRate: 78.4,
    loadFactor: 0.90,
    notes: "Northern Virginia data center corridor; includes Rider T1 transmission",
  },
  {
    region: "ERCOT",
    utilityName: "Oncor / TDU pass-through",
    tariffSchedule: "Large Industrial (>1 MW deregulated)",
    energyRate: 38.0,
    demandCharge: 8.50,
    demandChargePerMwh: 11.6,
    transmissionRate: 6.8,
    distributionRate: 4.2,
    ridersSurcharges: 3.5,
    allInRate: 64.1,
    loadFactor: 0.90,
    notes: "Deregulated market; energy via bilateral PPA or spot; high volatility risk",
  },
  {
    region: "CAISO",
    utilityName: "Southern California Edison",
    tariffSchedule: "TOU-8-D (>500 kW demand)",
    energyRate: 68.0,
    demandCharge: 22.50,
    demandChargePerMwh: 30.8,
    transmissionRate: 12.5,
    distributionRate: 8.3,
    ridersSurcharges: 9.4,
    allInRate: 129.0,
    loadFactor: 0.90,
    notes: "Highest utility rates in CONUS; drives self-generation economics",
  },
  {
    region: "SERC",
    utilityName: "Georgia Power",
    tariffSchedule: "PLH (Power and Light - High Load Factor)",
    energyRate: 36.0,
    demandCharge: 10.20,
    demandChargePerMwh: 14.0,
    transmissionRate: 5.8,
    distributionRate: 3.9,
    ridersSurcharges: 3.3,
    allInRate: 63.0,
    loadFactor: 0.90,
    notes: "Regulated market; includes nuclear baseload allocation; stable rates",
  },
  {
    region: "FRCC",
    utilityName: "Florida Power & Light",
    tariffSchedule: "GSLD-1 (General Svc Large Demand)",
    energyRate: 40.0,
    demandCharge: 11.00,
    demandChargePerMwh: 15.1,
    transmissionRate: 6.5,
    distributionRate: 4.5,
    ridersSurcharges: 4.2,
    allInRate: 70.3,
    loadFactor: 0.90,
    notes: "Regulated; fuel clause adjustment adds volatility; solar mandate credit",
  },
  {
    region: "ISO-NE",
    utilityName: "Eversource Energy",
    tariffSchedule: "Rate 37 (Large Time-of-Use)",
    energyRate: 72.0,
    demandCharge: 18.50,
    demandChargePerMwh: 25.3,
    transmissionRate: 14.0,
    distributionRate: 9.8,
    ridersSurcharges: 7.5,
    allInRate: 128.6,
    loadFactor: 0.90,
    notes: "Constrained pipeline region; winter price spikes; high capacity costs",
  },
  {
    region: "NYISO",
    utilityName: "Con Edison",
    tariffSchedule: "SC-9 Rate II (Large General >1.5 MW)",
    energyRate: 65.0,
    demandCharge: 24.00,
    demandChargePerMwh: 32.9,
    transmissionRate: 11.0,
    distributionRate: 10.5,
    ridersSurcharges: 8.6,
    allInRate: 128.0,
    loadFactor: 0.90,
    notes: "NYC metro; highest demand charges in US; congestion pricing",
  },
  {
    region: "MISO",
    utilityName: "Consumers Energy / DTE",
    tariffSchedule: "GP (General Primary >1 MW)",
    energyRate: 44.0,
    demandCharge: 9.80,
    demandChargePerMwh: 13.4,
    transmissionRate: 7.2,
    distributionRate: 4.8,
    ridersSurcharges: 3.6,
    allInRate: 73.0,
    loadFactor: 0.90,
    notes: "Moderate rates; wind integration reducing energy costs; capacity tight",
  },
  {
    region: "SPP",
    utilityName: "OG&E / Evergy",
    tariffSchedule: "LPL (Large Power and Light)",
    energyRate: 35.0,
    demandCharge: 8.00,
    demandChargePerMwh: 11.0,
    transmissionRate: 5.5,
    distributionRate: 3.5,
    ridersSurcharges: 3.0,
    allInRate: 58.0,
    loadFactor: 0.90,
    notes: "Wind-rich region; lowest wholesale prices; transmission expansion ongoing",
  },
  {
    region: "SWPP",
    utilityName: "Arizona Public Service",
    tariffSchedule: "E-36 (Large General Service TOU >3 MW)",
    energyRate: 45.0,
    demandCharge: 14.00,
    demandChargePerMwh: 19.2,
    transmissionRate: 7.8,
    distributionRate: 5.0,
    ridersSurcharges: 4.5,
    allInRate: 81.5,
    loadFactor: 0.90,
    notes: "High solar resource; afternoon peak pricing; Palo Verde hub pricing",
  },
  {
    region: "NWPP",
    utilityName: "PGE / BPA pass-through",
    tariffSchedule: "Schedule 83 (Large Nonresidential >1 MW)",
    energyRate: 38.0,
    demandCharge: 7.50,
    demandChargePerMwh: 10.3,
    transmissionRate: 6.0,
    distributionRate: 3.8,
    ridersSurcharges: 3.2,
    allInRate: 61.3,
    loadFactor: 0.90,
    notes: "Hydro-dominated; BPA wholesale rate anchor; data center friendly",
  },
];

export function getTariffByRegion(region: string): RegionalTariff | undefined {
  return REGIONAL_TARIFFS.find((t) => t.region === region);
}

/** Gas price sensitivities (Henry Hub $/MMBtu) */
export const GAS_PRICE_SCENARIOS = [
  { value: 2.50, label: "$2.50/MMBtu (Low)" },
  { value: 3.00, label: "$3.00/MMBtu" },
  { value: 3.50, label: "$3.50/MMBtu (Base)" },
  { value: 4.50, label: "$4.50/MMBtu" },
  { value: 6.00, label: "$6.00/MMBtu (High)" },
  { value: 8.00, label: "$8.00/MMBtu (Stress)" },
] as const;
