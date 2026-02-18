import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const datacenters = await prisma.dataCenter.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(datacenters);
  } catch (error) {
    console.error("Error fetching data centers:", error);
    return NextResponse.json(
      { error: "Failed to fetch data centers" },
      { status: 500 }
    );
  }
}
