import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GAS_PRICE = 3.50;

const PLANTS = [
  // TEXAS
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
  // PJM
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
  // NEW ENGLAND
  { code: 7001, name: "Mystic Generating Station", operator: "Constellation", state: "MA", county: "Middlesex", lat: 42.40, lon: -71.07, cap: 1740, pm: "CA", region: "ISO-NE", nerc: "NPCC", cf: 0.35, hr: 7600, solar: 0.15 },
  { code: 7002, name: "Canal Station Peakers", operator: "Constellation", state: "MA", county: "Barnstable", lat: 41.73, lon: -70.61, cap: 530, pm: "CT", region: "ISO-NE", nerc: "NPCC", cf: 0.09, hr: 10900, solar: 0.15 },
  { code: 7003, name: "Milford Power Plant", operator: "GenOn", state: "CT", county: "New Haven", lat: 41.22, lon: -73.06, cap: 580, pm: "CA", region: "ISO-NE", nerc: "NPCC", cf: 0.38, hr: 7400, solar: 0.15 },
  { code: 7004, name: "Burrillville Energy", operator: "Invenergy", state: "RI", county: "Providence", lat: 41.98, lon: -71.72, cap: 485, pm: "CA", region: "ISO-NE", nerc: "NPCC", cf: 0.42, hr: 7300, solar: 0.15 },
  // NEW YORK
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
  // SOUTHEAST
  { code: 9001, name: "Plant McDonough-Atkinson", operator: "Georgia Power", state: "GA", county: "Cobb", lat: 33.82, lon: -84.55, cap: 2520, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.50, hr: 7100, solar: 0.17 },
  { code: 9002, name: "Franklin Combined Cycle", operator: "Southern Co", state: "AL", county: "Franklin", lat: 34.45, lon: -87.84, cap: 850, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.46, hr: 7250, solar: 0.17 },
  { code: 9003, name: "Duke Energy Sutton CC", operator: "Duke Energy", state: "NC", county: "New Hanover", lat: 34.28, lon: -77.94, cap: 640, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.42, hr: 7350, solar: 0.17 },
  { code: 9004, name: "South Carolina Peaking", operator: "SCE&G", state: "SC", county: "Richland", lat: 34.00, lon: -81.03, cap: 380, pm: "CT", region: "SERC", nerc: "SERC", cf: 0.08, hr: 10900, solar: 0.17 },
  { code: 9005, name: "Allen Combined Cycle", operator: "Duke Energy", state: "NC", county: "Gaston", lat: 35.22, lon: -81.10, cap: 1160, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.54, hr: 7000, solar: 0.17, dcNear: 2 },
  { code: 9006, name: "Caledonia CC Plant", operator: "Mississippi Power", state: "MS", county: "Lowndes", lat: 33.68, lon: -88.32, cap: 720, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.41, hr: 7400, solar: 0.17 },
  // SOUTHWEST
  { code: 10001, name: "Arlington Valley CC", operator: "APS", state: "AZ", county: "Maricopa", lat: 33.32, lon: -112.72, cap: 580, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.38, hr: 7500, solar: 0.26, dcNear: 2 },
  { code: 10002, name: "Gila River Power Station", operator: "SRP", state: "AZ", county: "Maricopa", lat: 32.95, lon: -112.65, cap: 2200, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.35, hr: 7600, solar: 0.27 },
  { code: 10003, name: "Mesquite Power Plant", operator: "SRP", state: "AZ", county: "Maricopa", lat: 33.30, lon: -112.88, cap: 1250, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.42, hr: 7200, solar: 0.27, dcNear: 3 },
  { code: 10004, name: "Redhawk Generating", operator: "APS", state: "AZ", county: "Maricopa", lat: 33.38, lon: -112.82, cap: 1050, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.30, hr: 7800, solar: 0.27 },
  { code: 10005, name: "Luna Energy Facility", operator: "PNM Resources", state: "NM", county: "Luna", lat: 32.20, lon: -107.75, cap: 570, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.36, hr: 7500, solar: 0.25 },
  { code: 10006, name: "Las Vegas Peaking", operator: "NV Energy", state: "NV", county: "Clark", lat: 36.08, lon: -115.17, cap: 440, pm: "CT", region: "SWPP", nerc: "WECC", cf: 0.10, hr: 10500, solar: 0.26 },
  { code: 10007, name: "Silverhawk Generating", operator: "NV Energy", state: "NV", county: "Clark", lat: 36.28, lon: -115.22, cap: 580, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.40, hr: 7300, solar: 0.26 },
  { code: 10008, name: "Saguaro Power Plant", operator: "APS", state: "AZ", county: "Pinal", lat: 32.55, lon: -111.52, cap: 390, pm: "CT", region: "SWPP", nerc: "WECC", cf: 0.07, hr: 11200, solar: 0.26 },
  // COLORADO
  { code: 10101, name: "Rocky Mountain Energy Center", operator: "Xcel Energy", state: "CO", county: "Weld", lat: 40.35, lon: -104.70, cap: 620, pm: "CA", region: "SPP", nerc: "WECC", cf: 0.43, hr: 7300, solar: 0.20 },
  { code: 10102, name: "Front Range Power Station", operator: "Tri-State G&T", state: "CO", county: "Adams", lat: 39.85, lon: -104.82, cap: 480, pm: "CA", region: "SPP", nerc: "WECC", cf: 0.38, hr: 7500, solar: 0.20 },
  { code: 10103, name: "Blue Spruce Energy Center", operator: "Xcel Energy", state: "CO", county: "Douglas", lat: 39.55, lon: -105.00, cap: 310, pm: "CT", region: "SPP", nerc: "WECC", cf: 0.06, hr: 11500, solar: 0.19 },
  // NORTHWEST
  { code: 10201, name: "Hermiston Generating", operator: "PGE", state: "OR", county: "Umatilla", lat: 45.83, lon: -119.28, cap: 620, pm: "CA", region: "NWPP", nerc: "WECC", cf: 0.35, hr: 7500, solar: 0.16 },
  { code: 10202, name: "Chehalis Generating", operator: "TransAlta", state: "WA", county: "Lewis", lat: 46.63, lon: -122.87, cap: 520, pm: "CA", region: "NWPP", nerc: "WECC", cf: 0.38, hr: 7400, solar: 0.14 },
  { code: 10203, name: "Sumas Energy 2", operator: "Sumas Energy", state: "WA", county: "Whatcom", lat: 48.99, lon: -122.27, cap: 280, pm: "CA", region: "NWPP", nerc: "WECC", cf: 0.32, hr: 7700, solar: 0.13 },
  // SPP
  { code: 10301, name: "Oklahoma Cogeneration CC", operator: "OG&E", state: "OK", county: "Oklahoma", lat: 35.47, lon: -97.52, cap: 780, pm: "CA", region: "SPP", nerc: "SPP", cf: 0.45, hr: 7200, solar: 0.19 },
  { code: 10302, name: "Tulsa Peaking Station", operator: "PSO", state: "OK", county: "Tulsa", lat: 36.15, lon: -95.99, cap: 340, pm: "CT", region: "SPP", nerc: "SPP", cf: 0.08, hr: 11000, solar: 0.18 },
  { code: 10303, name: "Redbud Power Plant", operator: "OG&E", state: "OK", county: "McClain", lat: 35.10, lon: -97.38, cap: 1230, pm: "CA", region: "SPP", nerc: "SPP", cf: 0.50, hr: 7100, solar: 0.19 },
  { code: 10304, name: "West Gardner Energy Center", operator: "Evergy", state: "KS", county: "Johnson", lat: 38.81, lon: -94.93, cap: 560, pm: "CA", region: "SPP", nerc: "SPP", cf: 0.42, hr: 7350, solar: 0.17 },
  // LOUISIANA
  { code: 10401, name: "Calcasieu Energy Center", operator: "Entergy", state: "LA", county: "Calcasieu", lat: 30.22, lon: -93.22, cap: 840, pm: "CA", region: "MISO", nerc: "SERC", cf: 0.48, hr: 7200, solar: 0.18 },
  { code: 10402, name: "Baton Rouge Peaking", operator: "Entergy", state: "LA", county: "East Baton Rouge", lat: 30.45, lon: -91.19, cap: 310, pm: "CT", region: "MISO", nerc: "SERC", cf: 0.07, hr: 11200, solar: 0.18 },
  // TENNESSEE/KENTUCKY
  { code: 10501, name: "Caledonia MS CC", operator: "TVA", state: "TN", county: "Shelby", lat: 35.15, lon: -90.05, cap: 900, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.44, hr: 7300, solar: 0.17 },
  { code: 10502, name: "Johnsonville CC", operator: "TVA", state: "TN", county: "Humphreys", lat: 36.03, lon: -87.58, cap: 1200, pm: "CA", region: "SERC", nerc: "SERC", cf: 0.50, hr: 7100, solar: 0.16 },
  { code: 10503, name: "Cane Run CC", operator: "Louisville G&E", state: "KY", county: "Jefferson", lat: 38.20, lon: -85.87, cap: 640, pm: "CA", region: "MISO", nerc: "SERC", cf: 0.46, hr: 7250, solar: 0.15 },
  // DATA CENTER CORRIDOR
  { code: 11001, name: "Ashburn Energy Center", operator: "Dominion", state: "VA", county: "Loudoun", lat: 39.04, lon: -77.49, cap: 340, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.12, hr: 10200, solar: 0.16, dcNear: 12 },
  { code: 11002, name: "Manassas Junction GT", operator: "Dominion", state: "VA", county: "Prince William", lat: 38.75, lon: -77.47, cap: 520, pm: "CT", region: "PJM", nerc: "RFC", cf: 0.14, hr: 10000, solar: 0.16, dcNear: 9 },
  { code: 11003, name: "Sterling Park CC", operator: "Dominion", state: "VA", county: "Loudoun", lat: 39.01, lon: -77.40, cap: 780, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.52, hr: 7050, solar: 0.16, dcNear: 15 },
  { code: 11004, name: "Phoenix West Valley CC", operator: "APS", state: "AZ", county: "Maricopa", lat: 33.45, lon: -112.35, cap: 680, pm: "CA", region: "SWPP", nerc: "WECC", cf: 0.40, hr: 7300, solar: 0.27, dcNear: 4 },
  { code: 11005, name: "Hillsboro Energy Center", operator: "PGE", state: "OR", county: "Washington", lat: 45.52, lon: -122.89, cap: 420, pm: "CA", region: "NWPP", nerc: "WECC", cf: 0.35, hr: 7600, solar: 0.15, dcNear: 3 },
  { code: 11006, name: "Quincy Peaking GT", operator: "Grant County PUD", state: "WA", county: "Grant", lat: 47.23, lon: -119.85, cap: 180, pm: "CT", region: "NWPP", nerc: "WECC", cf: 0.05, hr: 12000, solar: 0.17, dcNear: 6 },
  { code: 11007, name: "Council Bluffs CC", operator: "MidAmerican", state: "IA", county: "Pottawattamie", lat: 41.26, lon: -95.86, cap: 560, pm: "CA", region: "MISO", nerc: "MRO", cf: 0.44, hr: 7300, solar: 0.16, dcNear: 2 },
  { code: 11008, name: "Elk River GT Station", operator: "Xcel Energy", state: "MN", county: "Sherburne", lat: 45.30, lon: -93.57, cap: 330, pm: "CT", region: "MISO", nerc: "MRO", cf: 0.06, hr: 11500, solar: 0.14, dcNear: 1 },
  { code: 11009, name: "Joliet Generating Station", operator: "NRG Energy", state: "IL", county: "Will", lat: 41.52, lon: -88.08, cap: 1200, pm: "CA", region: "PJM", nerc: "RFC", cf: 0.48, hr: 7200, solar: 0.15, dcNear: 3 },
  { code: 11010, name: "Carrollton Peaker", operator: "Georgia Power", state: "GA", county: "Fulton", lat: 33.75, lon: -84.39, cap: 280, pm: "CT", region: "SERC", nerc: "SERC", cf: 0.09, hr: 10800, solar: 0.17, dcNear: 4 },
];

const DATA_CENTERS = [
  { name: "Equinix DC11 Ashburn", operator: "Equinix", lat: 39.04, lon: -77.49, mw: 36, status: "operational" },
  { name: "AWS US-East-1", operator: "Amazon", lat: 39.04, lon: -77.48, mw: 100, status: "operational" },
  { name: "Microsoft Azure East US", operator: "Microsoft", lat: 39.01, lon: -77.46, mw: 80, status: "operational" },
  { name: "Google Virginia DC", operator: "Google", lat: 39.03, lon: -77.47, mw: 60, status: "operational" },
  { name: "QTS Ashburn Mega DC", operator: "QTS Realty", lat: 39.05, lon: -77.46, mw: 45, status: "operational" },
  { name: "CoreSite VA1", operator: "CoreSite", lat: 38.96, lon: -77.45, mw: 25, status: "operational" },
  { name: "Digital Realty Ashburn", operator: "Digital Realty", lat: 39.02, lon: -77.50, mw: 32, status: "operational" },
  { name: "CyrusOne Sterling VA", operator: "CyrusOne", lat: 39.00, lon: -77.41, mw: 28, status: "operational" },
  { name: "AWS US-West-2 Oregon", operator: "Amazon", lat: 45.60, lon: -121.18, mw: 120, status: "operational" },
  { name: "Google The Dalles", operator: "Google", lat: 45.60, lon: -121.20, mw: 50, status: "operational" },
  { name: "Facebook Prineville", operator: "Meta", lat: 44.30, lon: -120.83, mw: 60, status: "operational" },
  { name: "Microsoft Quincy WA", operator: "Microsoft", lat: 47.23, lon: -119.85, mw: 70, status: "operational" },
  { name: "Yahoo Quincy WA", operator: "Yahoo", lat: 47.22, lon: -119.86, mw: 30, status: "operational" },
  { name: "Sabey Quincy WA", operator: "Sabey Corp", lat: 47.24, lon: -119.84, mw: 20, status: "operational" },
  { name: "Switch Las Vegas SUPERNAP", operator: "Switch", lat: 36.08, lon: -115.15, mw: 100, status: "operational" },
  { name: "Apple Mesa AZ", operator: "Apple", lat: 33.42, lon: -111.83, mw: 50, status: "operational" },
  { name: "CyrusOne Phoenix", operator: "CyrusOne", lat: 33.45, lon: -112.07, mw: 35, status: "operational" },
  { name: "EdgeConneX Phoenix", operator: "EdgeConneX", lat: 33.44, lon: -112.40, mw: 25, status: "operational" },
  { name: "Facebook Mesa AZ", operator: "Meta", lat: 33.42, lon: -111.82, mw: 45, status: "under_construction" },
  { name: "Google Council Bluffs", operator: "Google", lat: 41.26, lon: -95.86, mw: 50, status: "operational" },
  { name: "Microsoft Des Moines", operator: "Microsoft", lat: 41.59, lon: -93.62, mw: 40, status: "operational" },
  { name: "Meta DeKalb IL", operator: "Meta", lat: 41.93, lon: -88.75, mw: 60, status: "planned" },
  { name: "Google Lenoir NC", operator: "Google", lat: 35.91, lon: -81.54, mw: 45, status: "operational" },
  { name: "Apple Maiden NC", operator: "Apple", lat: 35.57, lon: -81.19, mw: 40, status: "operational" },
  { name: "Meta Newton County GA", operator: "Meta", lat: 33.55, lon: -83.86, mw: 50, status: "operational" },
  { name: "QTS Atlanta Metro", operator: "QTS Realty", lat: 33.76, lon: -84.40, mw: 30, status: "operational" },
  { name: "Equinix Dallas TX", operator: "Equinix", lat: 32.90, lon: -96.83, mw: 30, status: "operational" },
  { name: "CyrusOne Houston", operator: "CyrusOne", lat: 29.76, lon: -95.36, mw: 40, status: "operational" },
  { name: "T5 Dallas TX", operator: "T5 Data Centers", lat: 32.83, lon: -96.66, mw: 25, status: "operational" },
  { name: "Vantage Quincy WA", operator: "Vantage", lat: 47.23, lon: -119.83, mw: 40, status: "under_construction" },
  { name: "Elk River MN DC", operator: "Compass DC", lat: 45.31, lon: -93.57, mw: 20, status: "operational" },
  { name: "Aligned Ashburn VA", operator: "Aligned Energy", lat: 39.03, lon: -77.51, mw: 55, status: "operational" },
];

function computeLcoeGas(heatRate, cf) {
  const fuelCost = (heatRate * GAS_PRICE) / 1000;
  const fixedOm = 15;
  const variableOm = 3.5;
  const capex = 900;
  const wacc = 0.075;
  const lifetime = 25;
  const crf = (wacc * Math.pow(1 + wacc, lifetime)) / (Math.pow(1 + wacc, lifetime) - 1);
  const capitalCost = (capex * crf * 1000) / (cf * 8760);
  const fixedOmMwh = (fixedOm * 1000) / (cf * 8760);
  return capitalCost + fuelCost + variableOm + fixedOmMwh;
}

function computeLcoeHybrid(heatRate, cf, solarCf) {
  const gasLcoe = computeLcoeGas(heatRate, cf);
  const solarBenefit = solarCf * 1.2;
  const hybridDiscount = 0.15 + solarBenefit * 0.5;
  return gasLcoe * (1 - Math.min(hybridDiscount, 0.35));
}

function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  console.log("Seeding database...");

  // Clear
  await prisma.optimizationResult.deleteMany();
  await prisma.solarProfile.deleteMany();
  await prisma.systemDemand.deleteMany();
  await prisma.costAssumption.deleteMany();
  await prisma.dataCenter.deleteMany();
  await prisma.gasPlant.deleteMany();

  // Plants
  console.log(`Seeding ${PLANTS.length} gas plants...`);
  for (const p of PLANTS) {
    const gasOnlyLcoe = computeLcoeGas(p.hr, Math.max(p.cf, 0.01));
    const hybridLcoe = computeLcoeHybrid(p.hr, Math.max(p.cf, 0.01), p.solar);
    const nearbyCount = p.dcNear ?? DATA_CENTERS.filter(dc => distKm(p.lat, p.lon, dc.lat, dc.lon) < 80).length;

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

  // Data Centers
  console.log(`Seeding ${DATA_CENTERS.length} data centers...`);
  for (const dc of DATA_CENTERS) {
    await prisma.dataCenter.create({
      data: {
        name: dc.name,
        operator: dc.operator,
        latitude: dc.lat,
        longitude: dc.lon,
        capacityMw: dc.mw,
        status: dc.status,
        source: "Industry reports",
      },
    });
  }
  console.log(`  Created ${DATA_CENTERS.length} data centers`);

  // Cost Assumptions
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

  console.log("\nSeeding complete!");
  console.log(`  ${PLANTS.length} gas plants`);
  console.log(`  ${DATA_CENTERS.length} data centers`);
  console.log("  6 cost assumptions");
}

main()
  .catch((e) => { console.error("Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
