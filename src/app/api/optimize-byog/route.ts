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

function runLocalByogOptimization(payload: Record<string, unknown>) {
  const script = `
import json
import sys
from optimizer.byog_optimizer import OptimizerService

payload = json.loads(sys.argv[1])
job = payload.get("optimization_job", {})
mode = job.get("mode")

service = OptimizerService(payload)
if mode == "single_variable_goal_seek":
    out = service.single_variable_goal_seek(job)
elif mode == "multi_variable":
    out = service.multi_variable_optimize(job)
elif mode == "sensitivity_heatmap":
    out = service.dynamic_sensitivity_heatmap(job)
else:
    raise ValueError(f"Unsupported optimization mode: {mode}")

print(json.dumps(out))
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

  throw new Error(`Local BYOG optimization fallback failed: ${String(lastErr)}`);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const fastApiUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";
  const shouldSkipFastApi = Date.now() < fastApiUnavailableUntil;

  if (!shouldSkipFastApi) {
    try {
      const response = await fetchWithTimeout(
        `${fastApiUrl}/optimize/byog`,
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
      console.warn("FastAPI BYOG optimization returned non-OK, using local fallback", {
        status: response.status,
      });
    } catch (error) {
      fastApiUnavailableUntil = Date.now() + FASTAPI_COOLDOWN_MS;
      console.warn("FastAPI BYOG optimization unreachable, using local fallback", error);
    }
  }

  try {
    const result = runLocalByogOptimization(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error calling BYOG optimization backend and local fallback:", error);
    return NextResponse.json(
      {
        error:
          "Optimization service unavailable. FastAPI and local BYOG fallback both failed.",
      },
      { status: 503 }
    );
  }
}
