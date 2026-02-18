"use client";

import { useFinancialsStore } from "@/store/useFinancialsStore";
import type { FinancialInputs } from "@/types/financials";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InputFieldProps {
    id: keyof FinancialInputs;
    label: string;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    format?: "number" | "currency" | "percent";
}

export function InputField({
    id,
    label,
    unit,
    min,
    max,
    step = 1,
    className,
}: InputFieldProps) {
    const value = useFinancialsStore((s) => s.inputs[id]);
    const setInputs = useFinancialsStore((s) => s.setInputs);
    const safeValue = typeof value === "number" && Number.isFinite(value) ? value : "";

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value === "") {
            setInputs({ [id]: 0 });
            return;
        }
        const numVal = parseFloat(e.target.value);
        if (!isNaN(numVal)) {
            setInputs({ [id]: numVal });
        }
    };

    return (
        <div className={cn("space-y-1.5", className)}>
            <Label htmlFor={id} className="text-xs text-muted-foreground font-medium">
                {label}
            </Label>
            <div className="relative">
                <Input
                    id={id}
                    type="number"
                    value={safeValue}
                    onChange={handleChange}
                    min={min}
                    max={max}
                    step={step}
                    className="h-8 font-mono text-sm bg-pc-dark-secondary border-white/10 focus:border-pc-green/50 pr-8"
                />
                {unit && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {unit}
                    </div>
                )}
            </div>
        </div>
    );
}
