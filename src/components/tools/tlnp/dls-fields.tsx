"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DlsResult } from "@/lib/calculations/tlnp-experiment";

interface Props {
  value: DlsResult;
  onChange: (next: DlsResult) => void;
  /** Zeta and instrument are noise in the per-sample row; shown in module 3. */
  compact?: boolean;
}

export default function DlsFields({ value, onChange, compact = false }: Props) {
  const set = (patch: Partial<DlsResult>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium">DLS</span>
      <div
        className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}
      >
        <Field
          label="粒径 (nm)"
          value={value.size_nm}
          onChange={(v) => set({ size_nm: v })}
        />
        <Field label="PDI" value={value.pdi} onChange={(v) => set({ pdi: v })} />
        {!compact && (
          <>
            <Field
              label="Zeta (mV)"
              value={value.zeta_mV}
              onChange={(v) => set({ zeta_mV: v })}
            />
            <Field
              label="仪器"
              value={value.instrument}
              onChange={(v) => set({ instrument: v })}
              mono={false}
            />
          </>
        )}
      </div>
      {!compact && (
        <Input
          value={value.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="备注：稀释倍数、测量温度等"
          className="h-7 text-xs"
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={mono ? "decimal" : undefined}
        className={`h-7 text-xs ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
