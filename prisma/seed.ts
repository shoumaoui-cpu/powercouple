import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Realistic US gas plants based on EIA-860/923 data patterns
// These represent actual plant characteristics (names/locations are representative)
const PLANTS = [
  // TEXAS - largest gas fleet
  { code: 3456, name: "West Texas Generating Station", operator: "Luminant", state: "TX", county: "Ector", lat: 31.95, lon: -102.10, cap: 1200, pm: "CA", region: "ERCOT", nerc: "TRE", cf: 0.42, hr: 7200, solar: 0.22 },
  { code: 3457, name: "Midland Energy Center", operator: "Vistra Corp", state: "TX", county: "Midland", lat: 31.99, lon: -102.08, cap: 850, pm: "CT", region: "ERCOT", nerc: "TRE", cf: 0.15, hr: 10500, solar: 0.22 },
  { code: 3458, name: "Odessa Power Plant", operator: "NAES Corp", state: "TX", county: "Ector", lat: 31.85, lon: -102.35, cap: 1050, pm: "CA", region: "ERCOT", nerc: "TRE", cf: 0.55, hr: 7100, solar: 0.23 },
  { code: 3459, name: "Permian Basin Generating", operator: "Talen Energy", state: "TX", county: "Ward", lat: 31.50, lon: -103.15, cap: 640, pm: "CT", region: "ERCOT", nerc: "TRE", cf: 0.08, hr: 11200, solar: 0.24 },
  { code: 3460, name: "Eagle Ford Energy Center", operator: "Calpine Corp", state: "TX", county: "Dimmit", lat: 28.40, lon: -99.75, cap: 920, pm: "CA", region: "ERCOT", nerc: "TRE", cf: 0.48, hr: 7300, solar: 0.21 },
  { code: 3461, name: "San Antonio South Plant", operator: "CPS Energy", state: "TX", county: "Bexar", lat: 29.30, lon: -98.50, cap: 780, pm: "CA", region: "ERCOT", nerc: "TRE", cf: 0.38, hr: 7500, solar: 0.20 },
  { code: 3462, name: "Houston Ship Channel GT", operator: "NRG Energy", state: "TX", county: "Harris", lat: 29.73, lon: -95.22, cap: 1450, pm: "CA", region: "ERCOT", nerc: "TRE", cf: 0.62, hr: 6900, solar: 0.18 },
  { code: 3463, name: "Corpus Christi Peakers", operator: "Topaz Power", state: "TX", county: "Nueces", lat: 27.80, lon: -97.40, cap: 340, pm: "CT", region: "ERCOT", nerc: "TRE", cf: 0.05, hr: 12000, solar: 0.21 },
  { code: 3464, name: "Dallas Fort Worth CC", operator: "Luminant", state: "TX", county: "Tarrant", lat: 32.75, lon: -97.33, cap: 1100, pm: "CA", region: "ERCOT", nerc: "TRE", cf: 0.52, hr: 7150, solar: 0.19 },
  { code: 3465, name: "Laredo Gateway Energy", operator: "AEP", state: "TX", county: "Webb", lat: 27.50, lon: -99.50, cap: 500, pm: "CA", region: "ERCOT", nerc: "TRE", cf: 0.35, hr: 7600, solar: 0.23 },
  { code: 3466, name: "Gulf Coast Peaking", operator: "Calpine Corp", state: "TX", county: "Brazoria", lat: 29.05, lon: -95.45, cap: 270, pm: "CT", region: "ERCOT", nerc: "TRE", cf: 0.07, hr: 11500, solar: 0.19 },
  { code: 3467, name: "Panhandle Wind Support GT", operator: "Xcel Energy", state: "TX", county: "Potter", lat: 35.19, lon: -101.85, cap: 380, pm: "CT", region: "SPP", nerc: "SPP", cf: 0.10, hr: 10800, solar: 0.22 },

  // CALIFORNIA
  { code: 4001, name: "Haynes Generating Station", operator: "LADWP", state: "CA", county: "Los Angeles", lat: 33.78, lon: -118.22, cap: 1610, pm: "CA", region: "CAISO", nerc: "WECC", cf: 0.28, hr: 7800, solar: 0.20 },
  { code: 4002, name: "Mountainview Power", operator: "Southern Cal Edison", state: "CA", county: "San Bernardino", lat: 34.08, lon: -117.55, cap: 1056, pm: "CA", region: "CAISO", nerc: "WECC", cf: 0.32, hr: 7400, solar: 0.22 },
  { code: 4003, name: "Inland Empire Energy Center", operator: "GE Energy", state: "CA", county: "Riverside", lat: 33.90, lon: -117.42, cap: 775, pm: "CA", region: "CAISO", nerc: "WECC", cf: 0.45, hr: 7100, solar: 0.23 },
  { code: 4004, name: "El Segundo Peakers", operator: "NRG Energy", state: "CA", county: "Los Angeles", lat: 33.92, lon: -118.43, cap: 550, pm: "CT", region: "CAISO", nerc: "WECC", cf: 0.06, hr: 11800, solar: 0.20 },
  { code: 4005, name: "Blythe Energy Project", operator: "NextEra Energy", state: "CA", county: "Riverside", lat: 33.62, lon: -114.62, cap: 520, pm: "CA", region: "CAISO", nerc: "WECC", cf: 0.40, hr: 7200, solar: 0.26 },
  { code: 4006, name: "Sacramento Valley CC", operator: "SMUD", state: "CA", county: "Sacramento", lat: 38.55, lon: -121.50, cap: 680, pm: "CA", region: "CAISO", nerc: "WECC", cf: 0.36, hr: 7500, solar: 0.21 },
  { code: 4007, name: "Moss Landing Power", operator: "Vistra Corp", state: "CA", county: "Monterey", lat: 36.80, lon: -121.78, cap: 1020, pm: "CA", region: "CAISO", nerc: "WECC", cf: 0.22, hr: 8200, solar: 0.19 },
  { code: 4008, name: "San Diego Peaking", operator: "SDG&E", state: "CA", county: "San Diego", lat: 32.72, lon: -117.15, cap: 290, pm: "CT", region: "CAISO", nerc: "WECC", cf: 0.04, hr: 12500, solar: 0.21 },

  // FLORIDA
  { code: 5001, name: "Manatee Power Plant", operator: "FPL", state: "FL", county: "Manatee", lat: 27.60, lon: -82.45, cap: 1800, pm: "CA", region: "FRCC", nerc: "FRCC", cf: 0.55, hr: 7000, solar: 0.18 },
  { code: 5002, name: "Port Everglades Next Gen", operator: "FPL", state: "FL", county: "Broward", lat: 26.09, lon: -80.12, cap: 1260, pm: "CA", region: "FRCC", nerc: "FRCC", cf: 0.60, hr: 6800, solar: 0.17 },
  { code: 5003, name: "Riviera Beach Clean Energy", operator: "FPL", state: "FL", county: "Palm Beach", lat: 26.77, lon: -80.06, cap: 1250, pm: "CA", region: "FRCC", nerc: "FRCC", cf: 0.58, hr: 6900, solar: 0.18 },
  { code: 5004, name: "Martin Peaker Station", operator: "FPL", state: "FL", county: "Martin", lat: 27.05, lon: -80.55, cap: 420, pm: "CT", region: "FRCC", nerc: "FRCC", cf: 0.09, hr: 11000, solar: 0.18 },
  { code: 5005, name: "Jacksonville Energy Center", operator: "JEA", state: "FL", county: "Duval", lat: 30.33, lon: -81.65, cap: 900, pm: "CA", region: "FRCC", nerc: "FRCC", cf: 0.44, hr: 7300, solar: 0.17 },
  { code: 5006, name: "Tampa Bay CC", operator: "Duke Energy", state: "FL", county: "Hillsborough", lat: 27.87, lon: -82.39, cap: 1050, pm: "CA", region: "FRCC", nerc: "FRCC", cf: 0.50, hr: 7100, solar: 0.18 },

  // PJM REGION (PA, NJ, OH, VA, WV, MD)
  { code: 6001, name: "Limerick Peaking", operator: "Exelon", state: "PA", county: "Montgomery", lat: 40.22, lon: -75.59, cap: 560, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.11, hr: 10500, solar: 0.16 },
  { code: 6002, name: "Panda Liberty CC", operator: "Panda Power", state: "PA", county: "Luzerne", lat: 41.20, lon: -75.88, cap: 830, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.48, hr: 7200, solar: 0.15 },
  { code: 6003, name: "Lower Mount Bethel Energy", operator: "Talen Energy", state: "PA", county: "Northampton", lat: 40.85, lon: -75.10, cap: 600, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.42, hr: 7400, solar: 0.15 },
  { code: 6004, name: "Bayonne Energy Center", operator: "PSEG", state: "NJ", county: "Hudson", lat: 40.66, lon: -74.10, cap: 644, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.50, hr: 7100, solar: 0.15 },
  { code: 6005, name: "Linden Generating Station", operator: "NRG Energy", state: "NJ", county: "Union", lat: 40.64, lon: -74.22, cap: 940, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.55, hr: 7000, solar: 0.15 },
  { code: 6006, name: "Carroll County Energy", operator: "Competitive Power", state: "OH", county: "Carroll", lat: 40.55, lon: -81.10, cap: 700, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.53, hr: 7050, solar: 0.14 },
  { code: 6007, name: "Oregon Clean Energy Center", operator: "Oregon Clean", state: "OH", county: "Lucas", lat: 41.65, lon: -83.42, cap: 860, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.47, hr: 7250, solar: 0.14 },
  { code: 6008, name: "Ashland County Peakers", operator: "AEP", state: "OH", county: "Ashland", lat: 40.87, lon: -82.32, cap: 310, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.06, hr: 11200, solar: 0.14 },
  { code: 6009, name: "Loudoun County GT", operator: "Dominion", state: "VA", county: "Loudoun", lat: 39.05, lon: -77.48, cap: 450, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.08, hr: 10800, solar: 0.16, dcNear: 5 },
  { code: 6010, name: "Prince William Power", operator: "Dominion", state: "VA", county: "Prince William", lat: 38.75, lon: -77.48, cap: 1340, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.45, hr: 7300, solar: 0.16, dcNear: 4 },
  { code: 6011, name: "Fairfax County Peakers", operator: "Dominion", state: "VA", county: "Fairfax", lat: 38.85, lon: -77.30, cap: 280, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.07, hr: 11000, solar: 0.16, dcNear: 8 },
  { code: 6012, name: "Chesterfield CC", operator: "Dominion", state: "VA", county: "Chesterfield", lat: 37.38, lon: -77.43, cap: 1240, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.52, hr: 7100, solar: 0.16 },
  { code: 6013, name: "Harrison County Power", operator: "FirstEnergy", state: "WV", county: "Harrison", lat: 39.28, lon: -80.35, cap: 580, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.40, hr: 7500, solar: 0.14 },
  { code: 6014, name: "CPV St. Charles Energy", operator: "CPV", state: "MD", county: "Charles", lat: 38.50, lon: -77.00, cap: 745, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.49, hr: 7150, solar: 0.16, dcNear: 3 },

  // NEW ENGLAND (ISO-NE)
  { code: 7001, name: "Mystic Generating Station", operator: "Constellation", state: "MA", county: "Middlesex", lat: 42.40, lon: -71.07, cap: 1740, pm: "CA", region: "ISO-NE", nerc: "NPCC", cf: 0.35, hr: 7600, solar: 0.15 },
  { code: 7002, name: "Canal Station Peakers", operator: "Constellation", state: "MA", county: "Barnstable", lat: 41.73, lon: -70.61, cap: 530, pm: "CT", region: "ISO-NE", nerc: "NPCC", cf: 0.09, hr: 10900, solar: 0.15 },
  { code: 7003, name: "Milford Power Plant", operator: "GenOn", state: "CT", county: "New Haven", lat: 41.22, lon: -73.06, cap: 580, pm: "CA", region: "ISO-NE", nerc: "NPCC", cf: 0.38, hr: 7400, solar: 0.15 },
  { code: 7004, name: "Burrillville Energy", operator: "Invenergy", state: "RI", county: "Providence", lat: 41.98, lon: -71.72, cap: 485, pm: "CA", region: "ISO-NE", nerc: "NPCC", cf: 0.42, hr: 7300, solar: 0.15 },

  // NEW YORK (NYISO)
  { code: 7101, name: "Astoria Energy LLC", operator: "Astoria Energy", state: "NY", county: "Queens", lat: 40.78, lon: -73.90, cap: 620, pm: "CA", region: "NYISO", nerc: "NPCC", cf: 0.55, hr: 7000, solar: 0.15 },
  { code: 7102, name: "Bayonne Peakers NY", operator: "PSEG", state: "NY", county: "Kings", lat: 40.65, lon: -74.02, cap: 290, pm: "CT", region: "NYISO", nerc: "NPCC", cf: 0.08, hr: 11000, solar: 0.15 },
  { code: 7103, name: "Cricket Valley Energy", operator: "Cricket Valley", state: "NY", county: "Dutchess", lat: 41.55, lon: -73.60, cap: 1100, pm: "CA", region: "NYISO", nerc: "NPCC", cf: 0.52, hr: 7050, solar: 0.15 },

  // MIDWEST (MISO)
  { code: 8001, name: "Grand Haven Peakers", operator: "Grand Haven BLP", state: "MI", county: "Ottawa", lat: 43.06, lon: -86.23, cap: 320, pm: "CT", region: "MISO", nerc: "RFC", cf: 0.06, hr: 11500, solar: 0.14 },
  { code: 8002, name: "Kalamazoo River CC", operator: "Consumers Energy", state: "MI", county: "Kalamazoo", lat: 42.29, lon: -85.59, cap: 760, pm: "CA", region: "MISO", nerc: "RFC", cf: 0.45, hr: 7200, solar: 0.14 },
  { code: 8003, name: "Gibson City Energy", operator: "Vistra Corp", state: "IL", county: "Ford", lat: 40.47, lon: -88.38, cap: 580, pm: "CA", region: "MISO", nerc: "RFC", cf: 0.40, hr: 7400, solar: 0.15 },
  { code: 8004, name: "Elwood Energy LLC", operator: "Elwood Energy", state: "IL", county: "Will", lat: 41.40, lon: -88.07, cap: 1350, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.10, hr: 10600, solar: 0.15 },
  { code: 8005, name: "Joppa Steam Plant CC", operator: "Vistra Corp", state: "IL", county: "Massac", lat: 37.20, lon: -88.85, cap: 480, pm: "CA", region: "MISO", nerc: "SERC", cf: 0.38, hr: 7500, solar: 0.16 },
  { code: 8006, name: "Wabash Valley Energy", operator: "Duke Energy", state: "IN", county: "Vigo", lat: 39.47, lon: -87.41, cap: 670, pm: "CA", region: "MISO", nerc: "RFC", cf: 0.43, hr: 7300, solar: 0.15 },
  { code: 8007, name: "Faribault Energy Park", operator: "Xcel Energy", state: "MN", county: "Rice", lat: 44.30, lon: -93.27, cap: 360, pm: "CT", region: "MISO", nerc: "MRO", cf: 0.07, hr: 11200, solar: 0.14 },
  { code: 8008, name: "Mankato Energy Center", operator: "Xcel Energy", state: "MN", county: "Blue Earth", lat: 44.17, lon: -94.00, cap: 760, pm: "CA", region: "MISO", nerc: "MRO", cf: 0.50, hr: 7100, solar: 0.14 },
  { code: 8009, name: "Wisconsin Rapids GT", operator: "Wisconsin Public Svc", state: "WI", county: "Wood", lat: 44.38, lon: -89.82, cap: 250, pm: "CT", region: "MISO", nerc: "MRO", cf: 0.05, hr: 12000, solar: 0.14 },

  // SOUTHEAST (SERC)
  { code: 9001, name: "Plant McDonough-Atkinson", operator: "Georgia Power", state: "GA", county: "Cobb", lat: 33.82, lon: -84.55, cap: 2520, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.50, hr: 7100, solar: 0.17 },
  { code: 9002, name: "Franklin Combined Cycle", operator: "Southern Co", state: "AL", county: "Franklin", lat: 34.45, lon: -87.84, cap: 850, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.46, hr: 7250, solar: 0.17 },
  { code: 9003, name: "Duke Energy Sutton CC", operator: "Duke Energy", state: "NC", county: "New Hanover", lat: 34.28, lon: -77.94, cap: 640, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.42, hr: 7350, solar: 0.17 },
  { code: 9004, name: "South Carolina Peaking", operator: "SCE&G", state: "SC", county: "Richland", lat: 34.00, lon: -81.03, cap: 380, pm: "CT", region: "SERC", nerc: "SERC", cf: 0.08, hr: 10900, solar: 0.17 },
  { code: 9005, name: "Allen Combined Cycle", operator: "Duke Energy", state: "NC", county: "Gaston", lat: 35.22, lon: -81.10, cap: 1160, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.54, hr: 7000, solar: 0.17, dcNear: 2 },
  { code: 9006, name: "Caledonia CC Plant", operator: "Mississippi Power", state: "MS", county: "Lowndes", lat: 33.68, lon: -88.32, cap: 720, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.41, hr: 7400, solar: 0.17 },

  // SOUTHWEST / MOUNTAIN WEST
  { code: 10001, name: "Arlington Valley CC", operator: "APS", state: "AZ", county: "Maricopa", lat: 33.32, lon: -112.72, cap: 580, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.38, hr: 7500, solar: 0.26, dcNear: 2 },
  { code: 10002, name: "Gila River Power Station", operator: "SRP", state: "AZ", county: "Maricopa", lat: 32.95, lon: -112.65, cap: 2200, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.35, hr: 7600, solar: 0.27 },
  { code: 10003, name: "Mesquite Power Plant", operator: "SRP", state: "AZ", county: "Maricopa", lat: 33.30, lon: -112.88, cap: 1250, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.42, hr: 7200, solar: 0.27, dcNear: 3 },
  { code: 10004, name: "Redhawk Generating", operator: "APS", state: "AZ", county: "Maricopa", lat: 33.38, lon: -112.82, cap: 1050, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.30, hr: 7800, solar: 0.27 },
  { code: 10005, name: "Luna Energy Facility", operator: "PNM Resources", state: "NM", county: "Luna", lat: 32.20, lon: -107.75, cap: 570, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.36, hr: 7500, solar: 0.25 },
  { code: 10006, name: "Las Vegas Peaking", operator: "NV Energy", state: "NV", county: "Clark", lat: 36.08, lon: -115.17, cap: 440, pm: "CT", region: "SWPP", nerc: "WECC", cf: 0.10, hr: 10500, solar: 0.26 },
  { code: 10007, name: "Silverhawk Generating", operator: "NV Energy", state: "NV", county: "Clark", lat: 36.28, lon: -115.22, cap: 580, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.40, hr: 7300, solar: 0.26 },
  { code: 10008, name: "Saguaro Power Plant", operator: "APS", state: "AZ", county: "Pinal", lat: 32.55, lon: -111.52, cap: 390, pm: "CT", region: "SWPP", nerc: "WECC", cf: 0.07, hr: 11200, solar: 0.26 },

  // COLORADO / MOUNTAIN
  { code: 10101, name: "Rocky Mountain Energy Center", operator: "Xcel Energy", state: "CO", county: "Weld", lat: 40.35, lon: -104.70, cap: 620, pm: "CA", region: "SPP", nerc: "WECC", cf: 0.43, hr: 7300, solar: 0.20 },
  { code: 10102, name: "Front Range Power Station", operator: "Tri-State G&T", state: "CO", county: "Adams", lat: 39.85, lon: -104.82, cap: 480, pm: "CA", region: "SPP", nerc: "WECC", cf: 0.38, hr: 7500, solar: 0.20 },
  { code: 10103, name: "Blue Spruce Energy Center", operator: "Xcel Energy", state: "CO", county: "Douglas", lat: 39.55, lon: -105.00, cap: 310, pm: "CT", region: "SPP", nerc: "WECC", cf: 0.06, hr: 11500, solar: 0.19 },

  // NORTHWEST
  { code: 10201, name: "Hermiston Generating", operator: "PGE", state: "OR", county: "Umatilla", lat: 45.83, lon: -119.28, cap: 620, pm: "CA", region: "NWPP", nerc: "WECC", cf: 0.35, hr: 7500, solar: 0.16 },
  { code: 10202, name: "Chehalis Generating", operator: "TransAlta", state: "WA", county: "Lewis", lat: 46.63, lon: -122.87, cap: 520, pm: "CA", region: "NWPP", nerc: "WECC", cf: 0.38, hr: 7400, solar: 0.14 },
  { code: 10203, name: "Sumas Energy 2", operator: "Sumas Energy", state: "WA", county: "Whatcom", lat: 48.99, lon: -122.27, cap: 280, pm: "CA", region: "NWPP", nerc: "WECC", cf: 0.32, hr: 7700, solar: 0.13 },

  // SPP (Oklahoma, Kansas)
  { code: 10301, name: "Oklahoma Cogeneration CC", operator: "OG&E", state: "OK", county: "Oklahoma", lat: 35.47, lon: -97.52, cap: 780, pm: "CA", region: "SPP", nerc: "SPP", cf: 0.45, hr: 7200, solar: 0.19 },
  { code: 10302, name: "Tulsa Peaking Station", operator: "PSO", state: "OK", county: "Tulsa", lat: 36.15, lon: -95.99, cap: 340, pm: "CT", region: "SPP", nerc: "SPP", cf: 0.08, hr: 11000, solar: 0.18 },
  { code: 10303, name: "Redbud Power Plant", operator: "OG&E", state: "OK", county: "McClain", lat: 35.10, lon: -97.38, cap: 1230, pm: "CA", region: "SPP", nerc: "SPP", cf: 0.50, hr: 7100, solar: 0.19 },
  { code: 10304, name: "West Gardner Energy Center", operator: "Evergy", state: "KS", county: "Johnson", lat: 38.81, lon: -94.93, cap: 560, pm: "CA", region: "SPP", nerc: "SPP", cf: 0.42, hr: 7350, solar: 0.17 },

  // LOUISIANA
  { code: 10401, name: "Calcasieu Energy Center", operator: "Entergy", state: "LA", county: "Calcasieu", lat: 30.22, lon: -93.22, cap: 840, pm: "CA", region: "MISO", nerc: "SERC", cf: 0.48, hr: 7200, solar: 0.18 },
  { code: 10402, name: "Baton Rouge Peaking", operator: "Entergy", state: "LA", county: "East Baton Rouge", lat: 30.45, lon: -91.19, cap: 310, pm: "CT", region: "MISO", nerc: "SERC", cf: 0.07, hr: 11200, solar: 0.18 },

  // TENNESSEE / KENTUCKY
  { code: 10501, name: "Caledonia MS CC", operator: "TVA", state: "TN", county: "Shelby", lat: 35.15, lon: -90.05, cap: 900, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.44, hr: 7300, solar: 0.17 },
  { code: 10502, name: "Johnsonville CC", operator: "TVA", state: "TN", county: "Humphreys", lat: 36.03, lon: -87.58, cap: 1200, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.50, hr: 7100, solar: 0.16 },
  { code: 10503, name: "Cane Run CC", operator: "Louisville G&E", state: "KY", county: "Jefferson", lat: 38.20, lon: -85.87, cap: 640, pm: "CA", region: "MISO", nerc: "SERC", cf: 0.46, hr: 7250, solar: 0.15 },

  // DATA CENTER CORRIDOR SPECIALS (Northern Virginia)
  { code: 11001, name: "Ashburn Energy Center", operator: "Dominion", state: "VA", county: "Loudoun", lat: 39.04, lon: -77.49, cap: 340, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.12, hr: 10200, solar: 0.16, dcNear: 12 },
  { code: 11002, name: "Manassas Junction GT", operator: "Dominion", state: "VA", county: "Prince William", lat: 38.75, lon: -77.47, cap: 520, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.14, hr: 10000, solar: 0.16, dcNear: 9 },
  { code: 11003, name: "Sterling Park CC", operator: "Dominion", state: "VA", county: "Loudoun", lat: 39.01, lon: -77.40, cap: 780, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.52, hr: 7050, solar: 0.16, dcNear: 15 },

  // More data center proximate plants
  { code: 11004, name: "Phoenix West Valley CC", operator: "APS", state: "AZ", county: "Maricopa", lat: 33.45, lon: -112.35, cap: 680, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.40, hr: 7300, solar: 0.27, dcNear: 4 },
  { code: 11005, name: "Hillsboro Energy Center", operator: "PGE", state: "OR", county: "Washington", lat: 45.52, lon: -122.89, cap: 420, pm: "CA", region: "NWPP", nerc: "WECC", cf: 0.35, hr: 7600, solar: 0.15, dcNear: 3 },
  { code: 11006, name: "Quincy Peaking GT", operator: "Grant County PUD", state: "WA", county: "Grant", lat: 47.23, lon: -119.85, cap: 180, pm: "CT", region: "NWPP", nerc: "WECC", cf: 0.05, hr: 12000, solar: 0.17, dcNear: 6 },
  { code: 11007, name: "Council Bluffs CC", operator: "MidAmerican", state: "IA", county: "Pottawattamie", lat: 41.26, lon: -95.86, cap: 560, pm: "CA", region: "MISO", nerc: "MRO", cf: 0.44, hr: 7300, solar: 0.16, dcNear: 2 },
  { code: 11008, name: "Elk River GT Station", operator: "Xcel Energy", state: "MN", county: "Sherburne", lat: 45.30, lon: -93.57, cap: 330, pm: "CT", region: "MISO", nerc: "MRO", cf: 0.06, hr: 11500, solar: 0.14, dcNear: 1 },
  { code: 11009, name: "Joliet Generating Station", operator: "NRG Energy", state: "IL", county: "Will", lat: 41.52, lon: -88.08, cap: 1200, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.48, hr: 7200, solar: 0.15, dcNear: 3 },
  { code: 11010, name: "Carrollton Peaker", operator: "Georgia Power", state: "GA", county: "Fulton", lat: 33.75, lon: -84.39, cap: 280, pm: "CT", region: "SERC", nerc: "SERC", cf: 0.09, hr: 10800, solar: 0.17, dcNear: 4 },
] as const;

// Data centers (major facilities) — enhanced with IT load, campus capacity, completion year
const DATA_CENTERS = [
  // ─── NORTHERN VIRGINIA (Data Center Alley) ───────────────────────────
  { name: "Equinix DC11 Ashburn", operator: "Equinix", lat: 39.0405, lon: -77.4878, mw: 42, itMw: 36, status: "operational", year: 2018, sqft: 236000, phase: "Phase 3" },
  { name: "AWS US-East-1 Campus", operator: "Amazon", lat: 39.0420, lon: -77.4830, mw: 120, itMw: 100, status: "operational", year: 2014, sqft: 500000, phase: "Multi-phase" },
  { name: "Microsoft Azure East US", operator: "Microsoft", lat: 39.0110, lon: -77.4620, mw: 96, itMw: 80, status: "operational", year: 2016, sqft: 420000, phase: "Phase 2" },
  { name: "Google Virginia Campus", operator: "Google", lat: 39.0330, lon: -77.4700, mw: 72, itMw: 60, status: "operational", year: 2019, sqft: 375000, phase: "Phase 2" },
  { name: "QTS Ashburn Mega Data Center", operator: "QTS Realty", lat: 39.0500, lon: -77.4610, mw: 54, itMw: 45, status: "operational", year: 2020, sqft: 280000, phase: "Phase 1" },
  { name: "CoreSite VA1", operator: "CoreSite", lat: 38.9610, lon: -77.4490, mw: 30, itMw: 25, status: "operational", year: 2015, sqft: 140000, phase: null },
  { name: "Digital Realty Ashburn Campus", operator: "Digital Realty", lat: 39.0220, lon: -77.4980, mw: 38, itMw: 32, status: "operational", year: 2017, sqft: 175000, phase: "Phase 2" },
  { name: "CyrusOne Sterling", operator: "CyrusOne", lat: 39.0010, lon: -77.4110, mw: 34, itMw: 28, status: "operational", year: 2019, sqft: 165000, phase: "Phase 1" },
  { name: "Aligned Ashburn Campus", operator: "Aligned Energy", lat: 39.0310, lon: -77.5060, mw: 66, itMw: 55, status: "operational", year: 2021, sqft: 310000, phase: "Phase 2" },
  { name: "CloudHQ Ashburn", operator: "CloudHQ", lat: 39.0460, lon: -77.4550, mw: 108, itMw: 90, status: "under_construction", year: 2026, sqft: 450000, phase: "Phase 1" },
  { name: "Vantage Loudoun Campus", operator: "Vantage", lat: 39.0380, lon: -77.4600, mw: 84, itMw: 70, status: "under_construction", year: 2026, sqft: 380000, phase: "Phase 1" },

  // ─── PACIFIC NORTHWEST (Oregon / Washington) ────────────────────────
  { name: "AWS US-West-2 Oregon", operator: "Amazon", lat: 45.6000, lon: -121.1800, mw: 144, itMw: 120, status: "operational", year: 2011, sqft: 600000, phase: "Multi-phase" },
  { name: "Google The Dalles Campus", operator: "Google", lat: 45.6010, lon: -121.2010, mw: 60, itMw: 50, status: "operational", year: 2006, sqft: 290000, phase: "Phase 4" },
  { name: "Meta Prineville Campus", operator: "Meta", lat: 44.3000, lon: -120.8340, mw: 72, itMw: 60, status: "operational", year: 2011, sqft: 490000, phase: "Phase 4" },
  { name: "Microsoft Quincy Campus", operator: "Microsoft", lat: 47.2310, lon: -119.8530, mw: 84, itMw: 70, status: "operational", year: 2007, sqft: 470000, phase: "Multi-phase" },
  { name: "Yahoo! Quincy DC", operator: "Yahoo", lat: 47.2200, lon: -119.8580, mw: 36, itMw: 30, status: "operational", year: 2008, sqft: 150000, phase: null },
  { name: "Sabey Intergate Quincy", operator: "Sabey Corp", lat: 47.2420, lon: -119.8410, mw: 24, itMw: 20, status: "operational", year: 2012, sqft: 120000, phase: "Phase 2" },
  { name: "Vantage Quincy Campus", operator: "Vantage", lat: 47.2340, lon: -119.8320, mw: 48, itMw: 40, status: "under_construction", year: 2026, sqft: 220000, phase: "Phase 1" },

  // ─── SOUTHWEST (Arizona / Nevada) ────────────────────────────────────
  { name: "Switch SUPERNAP Las Vegas", operator: "Switch", lat: 36.0800, lon: -115.1510, mw: 120, itMw: 100, status: "operational", year: 2013, sqft: 750000, phase: "Phase 4" },
  { name: "Apple Mesa Campus", operator: "Apple", lat: 33.4190, lon: -111.8330, mw: 60, itMw: 50, status: "operational", year: 2018, sqft: 330000, phase: "Phase 2" },
  { name: "CyrusOne Chandler AZ", operator: "CyrusOne", lat: 33.4520, lon: -112.0690, mw: 42, itMw: 35, status: "operational", year: 2020, sqft: 200000, phase: "Phase 1" },
  { name: "EdgeConneX Phoenix", operator: "EdgeConneX", lat: 33.4380, lon: -112.3990, mw: 30, itMw: 25, status: "operational", year: 2021, sqft: 130000, phase: null },
  { name: "Meta Mesa Campus", operator: "Meta", lat: 33.4170, lon: -111.8180, mw: 180, itMw: 150, status: "under_construction", year: 2027, sqft: 960000, phase: "Phase 1 of 3" },

  // ─── MIDWEST (Iowa / Minnesota / Illinois) ──────────────────────────
  { name: "Google Council Bluffs Campus", operator: "Google", lat: 41.2590, lon: -95.8620, mw: 60, itMw: 50, status: "operational", year: 2009, sqft: 350000, phase: "Phase 3" },
  { name: "Microsoft West Des Moines", operator: "Microsoft", lat: 41.5870, lon: -93.6230, mw: 48, itMw: 40, status: "operational", year: 2014, sqft: 260000, phase: "Phase 2" },
  { name: "Meta DeKalb Campus", operator: "Meta", lat: 41.9280, lon: -88.7530, mw: 72, itMw: 60, status: "planned", year: 2028, sqft: 380000, phase: "Phase 1" },
  { name: "Compass Elk River MN", operator: "Compass DC", lat: 45.3070, lon: -93.5700, mw: 24, itMw: 20, status: "operational", year: 2020, sqft: 110000, phase: null },

  // ─── SOUTHEAST (North Carolina / Georgia) ───────────────────────────
  { name: "Google Lenoir NC Campus", operator: "Google", lat: 35.9100, lon: -81.5410, mw: 54, itMw: 45, status: "operational", year: 2009, sqft: 290000, phase: "Phase 3" },
  { name: "Apple Maiden NC Campus", operator: "Apple", lat: 35.5690, lon: -81.1910, mw: 48, itMw: 40, status: "operational", year: 2010, sqft: 500000, phase: "Phase 2" },
  { name: "Meta Newton County GA", operator: "Meta", lat: 33.5470, lon: -83.8600, mw: 60, itMw: 50, status: "operational", year: 2020, sqft: 340000, phase: "Phase 2" },
  { name: "QTS Atlanta Metro", operator: "QTS Realty", lat: 33.7600, lon: -84.3970, mw: 36, itMw: 30, status: "operational", year: 2017, sqft: 180000, phase: "Phase 1" },
  { name: "Google Douglas County GA", operator: "Google", lat: 33.7310, lon: -84.7640, mw: 96, itMw: 80, status: "under_construction", year: 2026, sqft: 480000, phase: "Phase 1" },

  // ─── TEXAS (Dallas / Houston / San Antonio) ─────────────────────────
  { name: "Equinix Dallas Campus", operator: "Equinix", lat: 32.8980, lon: -96.8310, mw: 36, itMw: 30, status: "operational", year: 2016, sqft: 170000, phase: "Phase 2" },
  { name: "CyrusOne Houston West", operator: "CyrusOne", lat: 29.7630, lon: -95.3620, mw: 48, itMw: 40, status: "operational", year: 2019, sqft: 230000, phase: "Phase 2" },
  { name: "T5 Dallas", operator: "T5 Data Centers", lat: 32.8350, lon: -96.6560, mw: 30, itMw: 25, status: "operational", year: 2022, sqft: 145000, phase: null },
  { name: "QTS Dallas-Fort Worth Mega", operator: "QTS Realty", lat: 32.7770, lon: -97.0870, mw: 96, itMw: 80, status: "under_construction", year: 2027, sqft: 500000, phase: "Phase 1 of 2" },
  { name: "Skybox Houston Deer Park", operator: "Skybox DC", lat: 29.7150, lon: -95.1250, mw: 60, itMw: 50, status: "planned", year: 2028, sqft: 300000, phase: "Phase 1" },
];

// Nuclear infrastructure data - from US Nuclear Infrastructure Map
const NUCLEAR_PLANTS = [
  // ─── OPERATING NUCLEAR PLANTS ──────────────────────────────────────
  { name: "Palo Verde Nuclear Generating Station", type: "operating", status: "Operating", mw: 3937, region: "SWPP", state: "AZ", lat: 33.3881, lon: -112.8614, operator: "Arizona Public Service", notes: "Largest nuclear power plant in the US, 3 PWR units" },
  { name: "Browns Ferry Nuclear Plant", type: "operating", status: "Operating", mw: 3954, region: "SERC", state: "AL", lat: 34.7042, lon: -87.1186, operator: "Tennessee Valley Authority", notes: "3 BWR units on Wheeler Reservoir" },
  { name: "South Texas Project", type: "operating", status: "Operating", mw: 2560, region: "ERCOT", state: "TX", lat: 28.7953, lon: -96.0480, operator: "STP Nuclear Operating Co", notes: "2 PWR units, one of the largest in Texas" },
  { name: "Peach Bottom Atomic Power Station", type: "operating", status: "Operating", mw: 2770, region: "PJM", state: "PA", lat: 39.7589, lon: -76.2688, operator: "Exelon Generation", notes: "2 BWR units in southeastern Pennsylvania" },
  { name: "Braidwood Generating Station", type: "operating", status: "Operating", mw: 2386, region: "PJM", state: "IL", lat: 41.2414, lon: -88.2275, operator: "Exelon Generation", notes: "2 PWR units in Will County" },
  { name: "Byron Generating Station", type: "operating", status: "Operating", mw: 2347, region: "PJM", state: "IL", lat: 42.0756, lon: -89.2817, operator: "Exelon Generation", notes: "2 PWR units in Ogle County" },
  { name: "Vogtle Electric Generating Plant", type: "operating", status: "Operating", mw: 4600, region: "SERC", state: "GA", lat: 33.1414, lon: -81.7630, operator: "Southern Nuclear", notes: "4 units including new AP1000 Units 3 & 4" },
  { name: "Comanche Peak Nuclear Power Plant", type: "operating", status: "Operating", mw: 2430, region: "ERCOT", state: "TX", lat: 32.2987, lon: -97.7852, operator: "Luminant Generation", notes: "2 PWR units in Somervell County" },
  { name: "Susquehanna Steam Electric Station", type: "operating", status: "Operating", mw: 2600, region: "PJM", state: "PA", lat: 41.1004, lon: -76.1469, operator: "Talen Energy", notes: "2 BWR units, PPA with Amazon Web Services" },
  { name: "Limerick Generating Station", type: "operating", status: "Operating", mw: 2242, region: "PJM", state: "PA", lat: 40.2233, lon: -75.5886, operator: "Exelon Generation", notes: "2 BWR units in Montgomery County" },
  { name: "Oconee Nuclear Station", type: "operating", status: "Operating", mw: 2554, region: "SERC", state: "SC", lat: 34.7917, lon: -82.8986, operator: "Duke Energy", notes: "3 PWR units on Lake Keowee" },
  { name: "McGuire Nuclear Station", type: "operating", status: "Operating", mw: 2258, region: "SERC", state: "NC", lat: 35.4322, lon: -80.9483, operator: "Duke Energy", notes: "2 PWR units on Lake Norman" },
  { name: "Catawba Nuclear Station", type: "operating", status: "Operating", mw: 2258, region: "SERC", state: "SC", lat: 35.0519, lon: -81.0689, operator: "Duke Energy", notes: "2 PWR units on Lake Wylie" },
  { name: "Donald C. Cook Nuclear Plant", type: "operating", status: "Operating", mw: 2191, region: "MISO", state: "MI", lat: 41.9750, lon: -86.5650, operator: "Indiana Michigan Power", notes: "2 PWR units on Lake Michigan" },
  { name: "Calvert Cliffs Nuclear Power Plant", type: "operating", status: "Operating", mw: 1756, region: "PJM", state: "MD", lat: 38.4347, lon: -76.4419, operator: "Constellation Energy", notes: "2 PWR units on Chesapeake Bay" },
  { name: "Nine Mile Point Nuclear Station", type: "operating", status: "Operating", mw: 1850, region: "NYISO", state: "NY", lat: 43.5222, lon: -76.4100, operator: "Constellation Energy", notes: "2 units (BWR), on Lake Ontario" },
  { name: "North Anna Power Station", type: "operating", status: "Operating", mw: 1892, region: "PJM", state: "VA", lat: 38.0608, lon: -77.7908, operator: "Dominion Energy", notes: "2 PWR units near data center corridor" },
  { name: "Surry Power Station", type: "operating", status: "Operating", mw: 1602, region: "PJM", state: "VA", lat: 37.1656, lon: -76.6983, operator: "Dominion Energy", notes: "2 PWR units on James River" },
  { name: "Columbia Generating Station", type: "operating", status: "Operating", mw: 1190, region: "NWPP", state: "WA", lat: 46.4711, lon: -119.3328, operator: "Energy Northwest", notes: "Single BWR near Hanford Site" },
  { name: "Grand Gulf Nuclear Station", type: "operating", status: "Operating", mw: 1419, region: "MISO", state: "MS", lat: 32.0069, lon: -91.0478, operator: "Entergy Nuclear", notes: "Single BWR, largest single-unit in US" },
  { name: "River Bend Station", type: "operating", status: "Operating", mw: 974, region: "MISO", state: "LA", lat: 30.7572, lon: -91.3314, operator: "Entergy Nuclear", notes: "Single BWR on Mississippi River" },
  { name: "Waterford Steam Electric Station", type: "operating", status: "Operating", mw: 1168, region: "MISO", state: "LA", lat: 29.9956, lon: -90.4714, operator: "Entergy Nuclear", notes: "Single PWR near New Orleans" },
  { name: "Turkey Point Nuclear Generating Station", type: "operating", status: "Operating", mw: 1760, region: "FRCC", state: "FL", lat: 25.4350, lon: -80.3311, operator: "Florida Power & Light", notes: "2 PWR units south of Miami" },
  { name: "St. Lucie Nuclear Power Plant", type: "operating", status: "Operating", mw: 2000, region: "FRCC", state: "FL", lat: 27.3486, lon: -80.2464, operator: "Florida Power & Light", notes: "2 PWR units on Hutchinson Island" },
  { name: "Diablo Canyon Power Plant", type: "operating", status: "Operating", mw: 2256, region: "CAISO", state: "CA", lat: 35.2119, lon: -120.8542, operator: "Pacific Gas & Electric", notes: "2 PWR units, license extended through 2030" },
  { name: "Watts Bar Nuclear Plant", type: "operating", status: "Operating", mw: 2330, region: "SERC", state: "TN", lat: 35.6028, lon: -84.7919, operator: "Tennessee Valley Authority", notes: "2 PWR units, Unit 2 is newest US reactor (2016)" },
  { name: "Sequoyah Nuclear Plant", type: "operating", status: "Operating", mw: 2282, region: "SERC", state: "TN", lat: 35.2264, lon: -85.0886, operator: "Tennessee Valley Authority", notes: "2 PWR units near Chattanooga" },

  // ─── RESTART CANDIDATES ────────────────────────────────────────────
  { name: "Palisades Nuclear Plant", type: "restart", status: "Restart Candidate", mw: 800, region: "MISO", state: "MI", lat: 42.3225, lon: -86.3153, operator: "Holtec International", notes: "Potential first US nuclear plant restart, DOE loan support" },
  { name: "Three Mile Island Unit 1", type: "restart", status: "Restart Candidate", mw: 837, region: "PJM", state: "PA", lat: 40.1531, lon: -76.7269, operator: "Constellation Energy", notes: "PPA with Microsoft for data center power at ~$100/MWh" },
  { name: "Duane Arnold Energy Center", type: "restart", status: "Restart Candidate", mw: 601, region: "MISO", state: "IA", lat: 42.1008, lon: -91.7775, operator: "NextEra Energy", notes: "Shut down in 2020, under review for potential restart" },

  // ─── COAL-TO-NUCLEAR CONVERSION SITES ──────────────────────────────
  { name: "Kemmerer (TerraPower Natrium)", type: "coal_to_nuclear", status: "Under Construction", mw: 345, region: "NWPP", state: "WY", lat: 41.7911, lon: -110.5300, operator: "TerraPower / PacifiCorp", notes: "Advanced sodium-cooled reactor with molten salt energy storage" },
  { name: "Sherco (Xcel Energy SMR)", type: "coal_to_nuclear", status: "Planned", mw: 2238, region: "MISO", state: "MN", lat: 45.3814, lon: -93.8883, operator: "Xcel Energy", notes: "Proposed SMR site at retiring coal plant" },
  { name: "Monroe Power Plant", type: "coal_to_nuclear", status: "Under Review", mw: 3300, region: "MISO", state: "MI", lat: 41.8894, lon: -83.3925, operator: "DTE Energy", notes: "Large coal plant being evaluated for nuclear conversion" },
  { name: "Crystal River (Next Nuclear)", type: "coal_to_nuclear", status: "Planned", mw: 900, region: "FRCC", state: "FL", lat: 28.9569, lon: -82.6981, operator: "Duke Energy Florida", notes: "Coal/nuclear site with potential for new nuclear build" },
  { name: "Prairie Island (MISO Hub)", type: "coal_to_nuclear", status: "Under Review", mw: 1100, region: "MISO", state: "MN", lat: 44.6219, lon: -92.6322, operator: "Xcel Energy", notes: "Existing nuclear site with expansion potential" },
  { name: "Midland Nuclear (DOW SMR)", type: "coal_to_nuclear", status: "Planned", mw: 300, region: "MISO", state: "MI", lat: 43.6236, lon: -84.2319, operator: "Dow Chemical / TerraPower", notes: "Industrial SMR for process heat and power" },
  { name: "Point Beach (NextEra)", type: "coal_to_nuclear", status: "Under Review", mw: 1200, region: "MISO", state: "WI", lat: 44.2811, lon: -87.5361, operator: "NextEra Energy", notes: "Existing 2-unit plant with expansion potential" },
  { name: "Clinch River (TVA SMR)", type: "coal_to_nuclear", status: "Planned", mw: 800, region: "SERC", state: "TN", lat: 35.8914, lon: -84.3900, operator: "Tennessee Valley Authority", notes: "TVA early site permit for SMR deployment" },
  { name: "Bellefonte Nuclear Plant", type: "coal_to_nuclear", status: "Under Review", mw: 2600, region: "SERC", state: "AL", lat: 34.7144, lon: -85.9275, operator: "Tennessee Valley Authority", notes: "Partially built, never completed, under reassessment" },
  { name: "Comanche Peak (Unit 3/4)", type: "coal_to_nuclear", status: "Under Review", mw: 3400, region: "ERCOT", state: "TX", lat: 32.2987, lon: -97.7852, operator: "Vistra Corp", notes: "Potential additional units at existing nuclear site" },
  { name: "Grand Gulf (Unit 2 site)", type: "coal_to_nuclear", status: "Under Review", mw: 1500, region: "MISO", state: "MS", lat: 32.0069, lon: -91.0478, operator: "Entergy Nuclear", notes: "Prepared site for second unit, never built" },
  { name: "Savannah River (DOE SMR)", type: "coal_to_nuclear", status: "Planned", mw: 160, region: "SERC", state: "SC", lat: 33.2500, lon: -81.6500, operator: "DOE / Savannah River Nuclear Solutions", notes: "DOE microreactor demonstration project" },
  { name: "Callaway Energy Center (Expansion)", type: "coal_to_nuclear", status: "Under Review", mw: 1200, region: "MISO", state: "MO", lat: 38.7614, lon: -91.7817, operator: "Ameren Missouri", notes: "Existing 1-unit PWR site with room for expansion" },
  { name: "La Crosse (Dairyland SMR)", type: "coal_to_nuclear", status: "Planned", mw: 600, region: "MISO", state: "WI", lat: 43.6983, lon: -91.2331, operator: "Dairyland Power Cooperative", notes: "Former nuclear site, proposed for new SMR deployment" },
  { name: "Abilene (West Texas Nuclear)", type: "coal_to_nuclear", status: "Planned", mw: 475, region: "ERCOT", state: "TX", lat: 32.4487, lon: -99.7331, operator: "Luminant / Vistra", notes: "Proposed greenfield nuclear for ERCOT grid reliability" },
  { name: "PSEG Hope Creek Expansion", type: "coal_to_nuclear", status: "Under Review", mw: 1200, region: "PJM", state: "NJ", lat: 39.4628, lon: -75.5361, operator: "PSEG Nuclear", notes: "Existing site with potential for additional reactor" },
  { name: "STP Nuclear (Units 3/4)", type: "coal_to_nuclear", status: "Under Review", mw: 2700, region: "ERCOT", state: "TX", lat: 28.7953, lon: -96.0480, operator: "STP Nuclear Operating Co", notes: "Previously planned ABWR units, site still available" },
  { name: "AmerenUE Callaway Unit 2", type: "coal_to_nuclear", status: "Under Review", mw: 1200, region: "MISO", state: "MO", lat: 38.7700, lon: -91.7900, operator: "Ameren Missouri", notes: "Separate expansion from Callaway Unit 1" },

  // ─── LEGACY / DECOMMISSIONED SITES ─────────────────────────────────
  { name: "Indian Point Energy Center", type: "legacy", status: "Decommissioned", mw: 2069, region: "NYISO", state: "NY", lat: 41.2697, lon: -73.9531, operator: "Holtec International (decom)", notes: "Closed 2021, decommissioning underway in Hudson Valley" },
  { name: "San Onofre Nuclear Generating Station", type: "legacy", status: "Decommissioned", mw: 2254, region: "CAISO", state: "CA", lat: 33.3681, lon: -117.5567, operator: "Southern California Edison (decom)", notes: "Closed 2013, decommissioning in progress" },
  { name: "Pilgrim Nuclear Power Station", type: "legacy", status: "Decommissioned", mw: 677, region: "ISO-NE", state: "MA", lat: 41.9444, lon: -70.5797, operator: "Holtec International (decom)", notes: "Closed 2019, decommissioning underway" },
  { name: "Zion Nuclear Power Station", type: "legacy", status: "Decommissioned", mw: 2120, region: "PJM", state: "IL", lat: 42.4464, lon: -87.8019, operator: "ZionSolutions (decom)", notes: "Closed 1998, decommissioning largely complete" },
  { name: "Vermont Yankee Nuclear Power Station", type: "legacy", status: "Decommissioned", mw: 620, region: "ISO-NE", state: "VT", lat: 42.7803, lon: -72.5142, operator: "NorthStar (decom)", notes: "Closed 2014, accelerated decommissioning" },
  { name: "Fort Calhoun Station", type: "legacy", status: "Decommissioned", mw: 502, region: "SPP", state: "NE", lat: 41.5208, lon: -96.0769, operator: "OPPD (decom)", notes: "Closed 2016, smallest PWR in the US at closure" },
  { name: "Oyster Creek Nuclear Generating Station", type: "legacy", status: "Decommissioned", mw: 619, region: "PJM", state: "NJ", lat: 39.8136, lon: -74.2064, operator: "Holtec International (decom)", notes: "Closed 2018, oldest operating US nuclear plant at closure" },
  { name: "Kewaunee Power Station", type: "legacy", status: "Decommissioned", mw: 556, region: "MISO", state: "WI", lat: 44.3433, lon: -87.5356, operator: "Dominion (decom)", notes: "Closed 2013, decommissioning in progress" },
  { name: "Crystal River Unit 3", type: "legacy", status: "Decommissioned", mw: 860, region: "FRCC", state: "FL", lat: 28.9569, lon: -82.6981, operator: "Duke Energy (decom)", notes: "Closed 2013 after containment building damage" },
];

const GAS_PRICE = 3.50; // $/MMBtu

function computeLcoeGas(heatRate: number, cf: number): number {
  const fuelCost = (heatRate * GAS_PRICE) / 1000; // $/MWh
  const fixedOm = 15; // $/kW-yr
  const variableOm = 3.5; // $/MWh
  const capex = 900; // $/kW for a gas turbine
  const wacc = 0.075;
  const lifetime = 25;
  const crf = (wacc * Math.pow(1 + wacc, lifetime)) / (Math.pow(1 + wacc, lifetime) - 1);
  const capitalCost = (capex * crf * 1000) / (cf * 8760); // $/MWh
  const fixedOmMwh = (fixedOm * 1000) / (cf * 8760);
  return capitalCost + fuelCost + variableOm + fixedOmMwh;
}

function computeLcoeHybrid(heatRate: number, cf: number, solarCf: number): number {
  const gasLcoe = computeLcoeGas(heatRate, cf);
  // Hybrid typically saves 15-35% depending on solar resource
  const solarBenefit = solarCf * 1.2; // higher solar CF = more savings
  const hybridDiscount = 0.15 + solarBenefit * 0.5; // 15-35% discount range
  return gasLcoe * (1 - Math.min(hybridDiscount, 0.35));
}

// Simple distance calculation (Haversine approximation)
function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

async function main() {
  console.log("Seeding database...");

  // Clear existing data
  await prisma.optimizationResult.deleteMany();
  await prisma.solarProfile.deleteMany();
  await prisma.systemDemand.deleteMany();
  await prisma.costAssumption.deleteMany();
  await prisma.nuclearPlant.deleteMany();
  await prisma.dataCenter.deleteMany();
  await prisma.gasPlant.deleteMany();

  // Seed gas plants
  console.log(`Seeding ${PLANTS.length} gas plants...`);
  for (const p of PLANTS) {
    const gasOnlyLcoe = computeLcoeGas(p.hr, p.cf || 0.01);
    const hybridLcoe = computeLcoeHybrid(p.hr, p.cf || 0.01, p.solar);

    // Count nearby DCs (within 80km)
    const nearbyCount = "dcNear" in p ? (p as { dcNear: number }).dcNear : DATA_CENTERS.filter(
      (dc) => distKm(p.lat, p.lon, dc.lat, dc.lon) < 80
    ).length;

    await prisma.gasPlant.create({
      data: {
        eiaPlantCode: p.code,
        plantName: p.name,
        operatorName: p.operator,
        state: p.state,
        county: p.county,
        latitude: p.lat,
        longitude: p.lon,
        nameplateCapacityMw: p.cap,
        summerCapacityMw: p.cap * 0.95,
        winterCapacityMw: p.cap * 1.02,
        capacityFactor: p.cf,
        annualGenMwh: p.cap * p.cf * 8760,
        heatRateBtuKwh: p.hr,
        variableCostCt: p.pm === "CT" ? (p.hr * GAS_PRICE) / 1000 : null,
        variableCostCcgt: p.pm === "CA" ? (p.hr * GAS_PRICE) / 1000 : null,
        primeMover: p.pm,
        operatingStatus: "OP",
        demandRegion: p.region,
        nercRegion: p.nerc,
        solarCf: p.solar,
        solarPotentialMw: p.cap * 1.5,
        lcoeGasOnly: Math.round(gasOnlyLcoe * 100) / 100,
        lcoeHybrid: Math.round(hybridLcoe * 100) / 100,
        nearbyDcCount: nearbyCount,
        eia860Year: 2023,
        eia923Year: 2023,
      },
    });
  }
  console.log(`  Created ${PLANTS.length} plants`);

  // Seed data centers
  console.log(`Seeding ${DATA_CENTERS.length} data centers...`);
  for (const dc of DATA_CENTERS) {
    await prisma.dataCenter.create({
      data: {
        name: dc.name,
        operator: dc.operator,
        latitude: dc.lat,
        longitude: dc.lon,
        capacityMw: dc.mw,
        itLoadMw: dc.itMw,
        completionYear: dc.year,
        campusSqft: dc.sqft,
        phase: dc.phase,
        status: dc.status,
        source: "Industry reports",
      },
    });
  }
  console.log(`  Created ${DATA_CENTERS.length} data centers`);

  // Seed nuclear plants
  console.log(`Seeding ${NUCLEAR_PLANTS.length} nuclear plants...`);
  for (const np of NUCLEAR_PLANTS) {
    await prisma.nuclearPlant.create({
      data: {
        name: np.name,
        facilityType: np.type,
        status: np.status,
        capacityMw: np.mw,
        region: np.region,
        state: np.state,
        latitude: np.lat,
        longitude: np.lon,
        operator: np.operator,
        notes: np.notes,
      },
    });
  }
  console.log(`  Created ${NUCLEAR_PLANTS.length} nuclear plants`);

  // Seed cost assumptions
  console.log("Seeding cost assumptions...");
  const scenarios = [
    { scenario: "base", year: 2027, solarCapex: 950, battCapexKwh: 250, battCapexKw: 400, solarOm: 17, battOm: 12, wacc: 0.075 },
    { scenario: "base", year: 2030, solarCapex: 800, battCapexKwh: 180, battCapexKw: 320, solarOm: 15, battOm: 10, wacc: 0.075 },
    { scenario: "optimistic", year: 2027, solarCapex: 800, battCapexKwh: 200, battCapexKw: 330, solarOm: 15, battOm: 10, wacc: 0.065 },
    { scenario: "optimistic", year: 2030, solarCapex: 650, battCapexKwh: 140, battCapexKw: 250, solarOm: 13, battOm: 8, wacc: 0.065 },
    { scenario: "conservative", year: 2027, solarCapex: 1100, battCapexKwh: 310, battCapexKw: 480, solarOm: 20, battOm: 14, wacc: 0.085 },
    { scenario: "conservative", year: 2030, solarCapex: 950, battCapexKwh: 230, battCapexKw: 400, solarOm: 18, battOm: 12, wacc: 0.085 },
  ];

  for (const s of scenarios) {
    const wacc = s.wacc;
    const lifetime = 25;
    const crf = (wacc * Math.pow(1 + wacc, lifetime)) / (Math.pow(1 + wacc, lifetime) - 1);

    await prisma.costAssumption.create({
      data: {
        scenario: s.scenario,
        commissioningYear: s.year,
        solarCapexPerKw: s.solarCapex,
        batteryCapexPerKwh: s.battCapexKwh,
        batteryCapexPerKw: s.battCapexKw,
        solarOmPerKwYear: s.solarOm,
        batteryOmPerKwYear: s.battOm,
        wacc: s.wacc,
        crf: Math.round(crf * 10000) / 10000,
        projectLifetimeYrs: lifetime,
      },
    });
  }
  console.log("  Created 6 cost assumption scenarios");

  console.log("Seeding complete!");
  console.log(`  ${PLANTS.length} gas plants`);
  console.log(`  ${DATA_CENTERS.length} data centers`);
  console.log(`  ${NUCLEAR_PLANTS.length} nuclear plants`);
  console.log("  6 cost assumptions (3 scenarios x 2 years)");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
