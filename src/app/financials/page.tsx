"use client";

import { useRef, ReactNode } from "react";
import { Navigation } from "@/components/Navigation";
import { FinancialModel } from "@/components/financials/FinancialModel";
import { createFinancialsStore, FinancialsStoreContext, FinancialsStoreType } from "@/store/useFinancialsStore";

// ─── Provider Wrapper ───────────────────────────────────────────────

function FinancialsStoreProvider({ children }: { children: ReactNode }) {
    const storeRef = useRef<FinancialsStoreType | null>(null);
    if (!storeRef.current) {
        storeRef.current = createFinancialsStore();
    }

    return (
        <FinancialsStoreContext.Provider value={storeRef.current}>
            {children}
        </FinancialsStoreContext.Provider>
    );
}

// ─── Page Layout ────────────────────────────────────────────────────

export default function FinancialsPage() {
    return (
        <div className="flex flex-col h-screen bg-pc-dark text-foreground">
            <Navigation />
            <FinancialsStoreProvider>
                <main className="flex-1 overflow-hidden flex flex-col">
                    <FinancialModel />
                </main>
            </FinancialsStoreProvider>
        </div>
    );
}
