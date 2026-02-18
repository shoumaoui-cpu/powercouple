import { NextRequest, NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import path from "node:path";

const BACKEND_TIMEOUT_MS = 25_000;
const FASTAPI_TIMEOUT_MS = 8_000;
const FASTAPI_COOLDOWN_MS = 60_000;
let fastApiUnavailableUntil = 0;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = BACKEND_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function runLocalByogSimulation(payload: Record<string, unknown>) {
  const script = `
import json
import sys
from optimizer.byog_engine import CalculationClass

payload = json.loads(sys.argv[1])
print(json.dumps(CalculationClass(payload).run()))
`;

  const pythonCandidates = [
    path.join(process.cwd(), "backend/.venv/bin/python"),
    "python3",
    "python",
  ];

  let lastErr: unknown;
  for (const py of pythonCandidates) {
    try {
      const raw = execFileSync(py, ["-c", script, JSON.stringify(payload)], {
        cwd: path.join(process.cwd(), "backend"),
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 50,
      });
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(`Local BYOG simulation fallback failed: ${String(lastErr)}`);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const fastApiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";
  const shouldSkipFastApi = Date.now() < fastApiUnavailableUntil;

  if (!shouldSkipFastApi) {
    try {
      const response = await fetchWithTimeout(
        `${fastApiUrl}/simulate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        FASTAPI_TIMEOUT_MS
      );

      if (response.ok) {
        fastApiUnavailableUntil = 0;
        const result = await response.json();
        return NextResponse.json(result);
      }

      fastApiUnavailableUntil = Date.now() + FASTAPI_COOLDOWN_MS;
      console.warn("FastAPI simulation returned non-OK, using local fallback", {
        status: response.status,
      });
    } catch (error) {
      fastApiUnavailableUntil = Date.now() + FASTAPI_COOLDOWN_MS;
      console.warn("FastAPI simulation unreachable, using local fallback", error);
    }
  }

  try {
    const result = runLocalByogSimulation(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error calling simulation backend and local fallback:", error);
    return NextResponse.json(
      {
        error: "Simulation service unavailable. FastAPI and local BYOG fallback both failed.",
      },
      { status: 503 }
    );
  }
}
