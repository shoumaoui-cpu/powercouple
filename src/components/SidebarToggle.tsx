"use client";

import { useAppStore } from "@/store/useAppStore";

export function SidebarToggle() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  if (sidebarOpen) return null;

  return (
    <button
      onClick={toggleSidebar}
      className="absolute top-2 left-2 z-10 bg-background border border-border rounded-md p-2 shadow-md hover:bg-accent transition-colors"
      title="Open sidebar"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <line x1="9" x2="9" y1="3" y2="21" />
      </svg>
    </button>
  );
}
