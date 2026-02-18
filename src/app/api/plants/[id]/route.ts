import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const plant = await prisma.gasPlant.findUnique({
      where: { id },
      include: {
        solarProfiles: {
          orderBy: { hour: "asc" },
          select: { hour: true, cf: true },
        },
        optimizationResults: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!plant) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }

    // Find nearby data centers using simple distance calculation
    // (Without PostGIS, we compute Haversine distance in JS)
    let nearbyDataCenters: { id: string; name: string; operator: string | null; status: string | null; latitude: number; longitude: number; capacityMw: number | null; distanceKm: number }[] = [];
    try {
      const allDCs = await prisma.dataCenter.findMany();
      const R = 6371; // Earth radius in km
      nearbyDataCenters = allDCs
        .map((dc) => {
          const dLat = ((dc.latitude - plant.latitude) * Math.PI) / 180;
          const dLon = ((dc.longitude - plant.longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((plant.latitude * Math.PI) / 180) *
              Math.cos((dc.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return { ...dc, distanceKm: Math.round(distanceKm * 10) / 10 };
        })
        .filter((dc) => dc.distanceKm <= 80)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    } catch {
      // Data centers table might not exist yet
    }

    return NextResponse.json({
      ...plant,
      nearbyDataCenters,
    });
  } catch (error) {
    console.error("Error fetching plant:", error);
    return NextResponse.json(
      { error: "Failed to fetch plant" },
      { status: 500 }
    );
  }
}
