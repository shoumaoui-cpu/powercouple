import { NextRequest, NextResponse } from "next/server";
import { filterEia860Plants, loadEia860Data } from "@/lib/eia860-data";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    const states = sp.get("states")?.split(",").filter(Boolean) ?? [];
    const regions = sp.get("regions")?.split(",").filter(Boolean) ?? [];
    const primeMovers = sp.get("primeMovers")?.split(",").filter(Boolean) ?? [];
    const minCapacity = parseFloat(sp.get("minCapacity") ?? "0");
    const maxCapacity = parseFloat(sp.get("maxCapacity") ?? "99999");
    const minCf = parseFloat(sp.get("minCf") ?? "0");
    const maxCf = parseFloat(sp.get("maxCf") ?? "1");
    const minUtilization = parseFloat(sp.get("minUtilization") ?? "0");
    const maxUtilization = parseFloat(sp.get("maxUtilization") ?? "1");
    const minLcoe = parseFloat(sp.get("minLcoe") ?? "0");
    const maxLcoe = parseFloat(sp.get("maxLcoe") ?? "9999");
    const set = (sp.get("set") ?? "operating").toLowerCase();

    const data = loadEia860Data();

    const base =
      set === "proposed"
        ? data.proposed
        : set === "all"
          ? [...data.operating, ...data.proposed]
          : data.operating;

    const filtered = filterEia860Plants(base, {
      states,
      regions,
      primeMovers,
      minCapacity,
      maxCapacity,
      minCf,
      maxCf,
      minUtilization,
      maxUtilization,
      minLcoe,
      maxLcoe,
    });

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error loading EIA860 plants:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch EIA860 plants", detail },
      { status: 500 }
    );
  }
}
