import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const states = sp.get("states")?.split(",").filter(Boolean);
  const regions = sp.get("regions")?.split(",").filter(Boolean);
  const primeMovers = sp.get("primeMovers")?.split(",").filter(Boolean);
  const minCapacity = parseFloat(sp.get("minCapacity") ?? "0");
  const maxCapacity = parseFloat(sp.get("maxCapacity") ?? "99999");
  const minCf = parseFloat(sp.get("minCf") ?? "0");
  const maxCf = parseFloat(sp.get("maxCf") ?? "1");
  const minLcoe = parseFloat(sp.get("minLcoe") ?? "0");
  const maxLcoe = parseFloat(sp.get("maxLcoe") ?? "9999");
  const nearbyDCs = sp.get("nearbyDCs") === "true";

  // Build filter
  const where: Prisma.GasPlantWhereInput = {
    operatingStatus: "OP",
    nameplateCapacityMw: { gte: minCapacity, lte: maxCapacity },
  };

  if (states?.length) where.state = { in: states };
  if (regions?.length) where.demandRegion = { in: regions };
  if (primeMovers?.length) where.primeMover = { in: primeMovers };
  if (nearbyDCs) where.nearbyDcCount = { gt: 0 };

  if (minCf > 0 || maxCf < 1) {
    where.capacityFactor = { gte: minCf, lte: maxCf };
  }

  if (minLcoe > 0 || maxLcoe < 9999) {
    where.OR = [
      { lcoeHybrid: { gte: minLcoe, lte: maxLcoe } },
      { lcoeGasOnly: { gte: minLcoe, lte: maxLcoe } },
    ];
  }

  try {
    const plants = await prisma.gasPlant.findMany({
      where,
      orderBy: { nameplateCapacityMw: "desc" },
      select: {
        id: true,
        eiaPlantCode: true,
        plantName: true,
        operatorName: true,
        state: true,
        county: true,
        latitude: true,
        longitude: true,
        nameplateCapacityMw: true,
        summerCapacityMw: true,
        winterCapacityMw: true,
        ctCapacityMw: true,
        ccgtCapacityMw: true,
        capacityFactor: true,
        ctCapacityFactor: true,
        ccgtCapacityFactor: true,
        annualGenMwh: true,
        heatRateBtuKwh: true,
        variableCostCt: true,
        variableCostCcgt: true,
        primeMover: true,
        operatingStatus: true,
        demandRegion: true,
        balancingAuthority: true,
        nercRegion: true,
        solarPotentialMw: true,
        solarCf: true,
        lcoeHybrid: true,
        lcoeGasOnly: true,
        nearbyDcCount: true,
        eia860Year: true,
        eia923Year: true,
      },
    });

    return NextResponse.json(plants);
  } catch (error) {
    console.error("Error fetching plants:", error);
    return NextResponse.json(
      { error: "Failed to fetch plants" },
      { status: 500 }
    );
  }
}
