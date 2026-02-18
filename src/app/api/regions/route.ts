import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const regions = await prisma.gasPlant.groupBy({
      by: ["demandRegion"],
      where: {
        operatingStatus: "OP",
        demandRegion: { not: null },
      },
      _count: { id: true },
      _sum: { nameplateCapacityMw: true },
      _avg: {
        capacityFactor: true,
        lcoeGasOnly: true,
        lcoeHybrid: true,
      },
    });

    const result = regions
      .filter((r) => r.demandRegion)
      .map((r) => ({
        region: r.demandRegion!,
        plantCount: r._count.id,
        totalCapacityMw: r._sum.nameplateCapacityMw ?? 0,
        avgCapacityFactor: r._avg.capacityFactor ?? 0,
        avgLcoeGasOnly: r._avg.lcoeGasOnly,
        avgLcoeHybrid: r._avg.lcoeHybrid,
      }))
      .sort((a, b) => b.totalCapacityMw - a.totalCapacityMw);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching region stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch region statistics" },
      { status: 500 }
    );
  }
}
