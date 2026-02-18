import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMw(mw: number): string {
  if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`;
  return `${Math.round(mw)} MW`;
}

export function formatLcoe(lcoe: number | null): string {
  if (lcoe == null) return "N/A";
  return `$${lcoe.toFixed(0)}/MWh`;
}

export function formatPercent(value: number | null): string {
  if (value == null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function lcoeColor(lcoe: number | null): string {
  if (lcoe == null) return "#a3a3a3";
  if (lcoe <= 60) return "#4ecca3";
  if (lcoe <= 100) return "#FFC15E";
  return "#e74c3c";
}

export function capacityColor(primeMover: string): string {
  switch (primeMover) {
    case "CT":
      return "#FFC15E";
    case "CA":
    case "CS":
      return "#7799B6";
    case "ST":
      return "#e74c3c";
    default:
      return "#a3a3a3";
  }
}
