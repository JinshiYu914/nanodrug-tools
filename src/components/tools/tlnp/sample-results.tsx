"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DlsFields from "./dls-fields";
import EePanel, { useRibogreenRecords } from "./ee-panel";
import type { TlnpPrepSample } from "@/lib/calculations/tlnp-experiment";

interface Props {
  samples: TlnpPrepSample[];
  onChange: (next: TlnpPrepSample[]) => void;
}

/**
 * 表征结果, one card per sample: RiboGreen 包封率 plus 粒径 / PDI.
 *
 * The RiboGreen record list is fetched once for the whole module rather than
 * per sample — it is a single query whose result every card filters.
 */
export default function SampleResults({ samples, onChange }: Props) {
  const { records, loading, reload } = useRibogreenRecords(samples.length > 0);

  const patch = (id: string, next: Partial<TlnpPrepSample>) =>
    onChange(samples.map((s) => (s.id === id ? { ...s, ...next } : s)));

  if (samples.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        添加样品后，这里会为每个样品记录包封率、粒径与 PDI。
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {samples.map((s, i) => (
        <div key={s.id} className="space-y-3 rounded-lg border p-4">
          <h4 className="text-sm font-semibold">
            {s.name || `样品 ${i + 1}`}
          </h4>

          <EePanel
            sampleId={s.id}
            value={s.ee}
            onChange={(ee) => patch(s.id, { ee })}
            candidates={records.get(s.id) ?? []}
            onRefreshRecords={() => void reload()}
            recordsLoading={loading}
          />

          <DlsFields
            value={s.dls}
            onChange={(dls) => patch(s.id, { dls })}
          />

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              该样品备注
            </Label>
            <Input
              value={s.resultNote}
              onChange={(e) => patch(s.id, { resultNote: e.target.value })}
              placeholder="例如：偏浑浊，复测一次"
              className="h-7 text-xs"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
