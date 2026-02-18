"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Energy Institute Dashboard" },
  { href: "/eia860", label: "EIA860 Dashboard" },
  { href: "/compare", label: "LCOE Comparison" },
  { href: "/nationwide", label: "Nationwide Potential" },
  { href: "/financials", label: "Financial Model" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 px-4 py-2 bg-pc-dark border-b border-white/10">
      <Link href="/" className="font-mono text-sm font-bold text-pc-green mr-4 tracking-wider">
        POWERCOUPLE
      </Link>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-md transition-colors",
            pathname === item.href
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
