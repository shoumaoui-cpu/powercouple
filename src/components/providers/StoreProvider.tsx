"use client";

import { useRef } from "react";
import {
  createAppStore,
  AppStoreContext,
  type AppStoreType,
} from "@/store/useAppStore";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStoreType | null>(null);
  if (!storeRef.current) {
    storeRef.current = createAppStore();
  }
  return (
    <AppStoreContext.Provider value={storeRef.current}>
      {children}
    </AppStoreContext.Provider>
  );
}
