"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import type { GasPlant, SolarProfilePoint } from "@/types";

interface SolarProfileTabProps {
  plant: GasPlant;
}

export function SolarProfileTab({ plant }: SolarProfileTabProps) {
  const [profileData, setProfileData] = useState<SolarProfilePoint[] | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/plants/${plant.id}`);
        if (!res.ok) throw new Error(`Failed to load plant data (${res.status})`);
        const data = await res.json();

        if (!cancelled) {
          if (data.solarProfile && data.solarProfile.length > 0) {
            setProfileData(data.solarProfile);
          } else {
            setProfileData([]);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load solar profile"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [plant.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-pc-gold border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">
            Loading solar profile...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-pc-red">{error}</p>
    );
  }

  if (!profileData || profileData.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No solar profile data available for this plant.
        </p>
        {plant.solarCf != null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Estimated annual solar capacity factor:{" "}
            <span className="font-semibold text-pc-gold">
              {(plant.solarCf * 100).toFixed(1)}%
            </span>
          </p>
        )}
      </div>
    );
  }

  // Compute summary stats
  const avgCf =
    profileData.reduce((sum, p) => sum + p.cf, 0) / profileData.length;
  const peakPoint = profileData.reduce((best, p) =>
    p.cf > best.cf ? p : best
  );
  const minPoint = profileData.reduce((worst, p) =>
    p.cf < worst.cf ? p : worst
  );

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Annual Solar CF
            </p>
            <p className="text-sm font-mono font-semibold text-pc-gold">
              {(avgCf * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Peak Hour
            </p>
            <p className="text-sm font-mono font-semibold text-pc-gold">
              {peakPoint.hour}:00
            </p>
            <p className="text-[10px] text-muted-foreground">
              CF: {(peakPoint.cf * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Min Hour
            </p>
            <p className="text-sm font-mono font-semibold text-muted-foreground">
              {minPoint.hour}:00
            </p>
            <p className="text-[10px] text-muted-foreground">
              CF: {(minPoint.cf * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 24-hour solar profile chart */}
      <Card className="border-border">
        <CardContent className="p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Average 24-Hour Solar Profile
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={profileData}
                margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient
                    id="solarGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#FFC15E" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FFC15E" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "#999" }}
                  tickFormatter={(h) => `${h}h`}
                  stroke="#555"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#999" }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  domain={[0, "auto"]}
                  stroke="#555"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a2e",
                    border: "1px solid #333",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(h) => `Hour ${h}:00`}
                  formatter={(value: number) => [
                    `${(value * 100).toFixed(1)}%`,
                    "Capacity Factor",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="cf"
                  stroke="#FFC15E"
                  strokeWidth={2}
                  fill="url(#solarGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Location reference */}
      <p className="text-xs text-muted-foreground">
        Solar resource data at{" "}
        <span className="font-mono">
          {plant.latitude.toFixed(4)}, {plant.longitude.toFixed(4)}
        </span>
      </p>
    </div>
  );
}
