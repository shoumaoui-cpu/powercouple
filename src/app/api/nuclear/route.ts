import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const nuclearPlants = await prisma.nuclearPlant.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(nuclearPlants);
  } catch (error) {
    console.error("Error fetching nuclear plants:", error);
    return NextResponse.json(
      { error: "Failed to fetch nuclear plants" },
      { status: 500 }
    );
  }
}
