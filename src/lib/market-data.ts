
// Mock database of market conditions by state
// In a real app, this would query an API (EIA, ISOs)

interface MarketProfile {
    region: string;
    wholesalePrice: number; // $/MWh
    solarIrradiance: number; // kWh/mz/day (approx) or Capacity Factor proxy
    solarCf: number; // Annual Capacity Factor
    carbonIntensity: number; // lbs/MWh
    gasPriceMmbtu: number; // $/MMBtu (Fuel Cost)
}

const DEFAULT_MARKET: MarketProfile = {
    region: "National Avg",
    wholesalePrice: 45,
    solarIrradiance: 4.5,
    solarCf: 0.18,
    carbonIntensity: 800,
    gasPriceMmbtu: 3.50
};

// Data based on approx 2024-2025 trends
const MARKET_DATA: Record<string, MarketProfile> = {
    // ERCOT
    "TX": { region: "ERCOT", wholesalePrice: 38, solarIrradiance: 5.5, solarCf: 0.24, carbonIntensity: 900, gasPriceMmbtu: 2.80 },

    // PJM
    "VA": { region: "PJM", wholesalePrice: 52, solarIrradiance: 4.2, solarCf: 0.17, carbonIntensity: 750, gasPriceMmbtu: 3.80 },
    "OH": { region: "PJM", wholesalePrice: 48, solarIrradiance: 3.8, solarCf: 0.15, carbonIntensity: 1100, gasPriceMmbtu: 3.20 },
    "PA": { region: "PJM", wholesalePrice: 45, solarIrradiance: 3.8, solarCf: 0.15, carbonIntensity: 850, gasPriceMmbtu: 2.50 }, // Low gas due to Marcellus
    "NJ": { region: "PJM", wholesalePrice: 58, solarIrradiance: 4.1, solarCf: 0.16, carbonIntensity: 600, gasPriceMmbtu: 4.50 },
    "IL": { region: "PJM/MISO", wholesalePrice: 42, solarIrradiance: 4.0, solarCf: 0.16, carbonIntensity: 700, gasPriceMmbtu: 3.00 },

    // CAISO
    "CA": { region: "CAISO", wholesalePrice: 65, solarIrradiance: 5.8, solarCf: 0.26, carbonIntensity: 500, gasPriceMmbtu: 7.50 }, // High gas
    "NV": { region: "WECC", wholesalePrice: 55, solarIrradiance: 6.0, solarCf: 0.27, carbonIntensity: 650, gasPriceMmbtu: 5.50 },
    "AZ": { region: "WECC", wholesalePrice: 50, solarIrradiance: 6.2, solarCf: 0.28, carbonIntensity: 700, gasPriceMmbtu: 4.80 },

    // NYISO
    "NY": { region: "NYISO", wholesalePrice: 55, solarIrradiance: 3.8, solarCf: 0.14, carbonIntensity: 400, gasPriceMmbtu: 5.00 },

    // SERC (Southeast - Regulated)
    "GA": { region: "SERC", wholesalePrice: 48, solarIrradiance: 4.8, solarCf: 0.20, carbonIntensity: 800, gasPriceMmbtu: 3.60 },
    "NC": { region: "SERC", wholesalePrice: 50, solarIrradiance: 4.6, solarCf: 0.19, carbonIntensity: 750, gasPriceMmbtu: 3.70 },
    "FL": { region: "FRCC", wholesalePrice: 45, solarIrradiance: 5.2, solarCf: 0.22, carbonIntensity: 900, gasPriceMmbtu: 4.00 },
};

export function getMarketProfile(state: string | null): MarketProfile {
    if (!state) return DEFAULT_MARKET;
    return MARKET_DATA[state] || DEFAULT_MARKET;
}
