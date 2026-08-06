"use client";

import { useMemo } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { genId } from "@/lib/calculations/ribogreen";
import {
  createTlnpSample,
  type TlnpPrepSample,
} from "@/lib/calculations/tlnp-experiment";
import type { LipidEntry } from "@/lib/calculations/lnp-formula";

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

function entryName(e: LipidEntry): string {
  return (e.isCustomLipid ? e.customLipidName : e.lipidName) || e.label;
}

function ratioSum(s: TlnpPrepSample): number {
  return s.lipidEntries.reduce((acc, e) => acc + num(e.molarRatio), 0);
}

interface Props {
  samples: TlnpPrepSample[];
  onChange: (next: TlnpPrepSample[]) => void;
  onEdit: (sample: TlnpPrepSample) => void;
  /** From the 反应 linker design parameter — names the 5th component so the
   *  formulation and the design section can't disagree about the linker. */
  linkerName?: string;
}

/**
 * The multi-sample design grid.
 *
 * Across a screen of formulations only the molar ratios move — lipid
 * identities, MWs, stock concentrations and prep params are constant — so this
 * table edits ratios inline and sends everything else to the sample editor.
 * 添加样品 clones the last row for the same reason.
 *
 * Column headers come from the FIRST sample's lipid entries. When a later
 * sample uses different lipids in the same slots the header would be a lie, so
 * each row also shows its own composition underneath its name.
 */
export default function SampleTable({
  samples,
  onChange,
  onEdit,
  linkerName,
}: Props) {
  const columns = useMemo(
    () => samples[0]?.lipidEntries.map((e) => entryName(e)) ?? [],
    [samples]
  );

  const patch = (id: string, next: Partial<TlnpPrepSample>) =>
    onChange(samples.map((s) => (s.id === id ? { ...s, ...next } : s)));

  function setRatio(sample: TlnpPrepSample, index: number, value: string) {
    const lipidEntries = sample.lipidEntries.map((e, i) =>
      i === index ? { ...e, molarRatio: value } : e
    );
    patch(sample.id, { lipidEntries });
  }

  function addSample() {
    const last = samples[samples.length - 1] ?? null;
    onChange([
      ...samples,
      createTlnpSample(last, `样品 ${samples.length + 1}`, linkerName),
    ]);
  }

  function duplicate(sample: TlnpPrepSample) {
    const copy: TlnpPrepSample = {
      ...sample,
      id: genId(),
      name: `${sample.name || "样品"} (副本)`,
      lipidEntries: sample.lipidEntries.map((e) => ({ ...e })),
      prep: { ...sample.prep },
      createdAt: new Date().toISOString(),
    };
    const at = samples.findIndex((s) => s.id === sample.id);
    onChange([...samples.slice(0, at + 1), copy, ...samples.slice(at + 1)]);
  }

  function remove(sample: TlnpPrepSample) {
    if (!confirm(`删除样品「${sample.name || "未命名"}」？`)) return;
    onChange(samples.filter((s) => s.id !== sample.id));
  }

  if (samples.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed py-10 text-center">
        <p className="text-sm text-muted-foreground">
          还没有样品。添加第一个后即可填写各组分摩尔比并一键生成配方。
        </p>
        <Button size="sm" className="gap-1.5" onClick={addSample}>
          <Plus className="h-3.5 w-3.5" />
          添加样品
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* The min width has to cover every declared column width put together.
          When it doesn't, the table shrinks the numeric columns past their
          padding and the values scroll out of sight inside their own inputs —
          which is exactly what adding the fifth lipid column did to N/P and
          RNA. Recount this when a column is added. */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[66rem] border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="w-8 px-2 py-2 text-left font-medium">#</th>
              <th className="min-w-40 px-2 py-2 text-left font-medium">
                样品名
              </th>
              {columns.map((label, i) => (
                <th
                  key={`${label}-${i}`}
                  className="min-w-20 px-2 py-2 text-left font-medium"
                  title={`${label} 摩尔比 (%)`}
                >
                  {label}
                  <span className="ml-0.5 text-muted-foreground">%</span>
                </th>
              ))}
              <th className="w-16 px-2 py-2 text-left font-medium">合计</th>
              <th className="w-20 px-2 py-2 text-left font-medium">N/P</th>
              <th className="w-24 px-2 py-2 text-left font-medium">FRR</th>
              <th className="w-24 px-2 py-2 text-left font-medium">
                RNA (µg)
              </th>
              <th className="w-20 px-2 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => {
              const sum = ratioSum(s);
              const ok = Math.abs(sum - 100) <= 0.1;
              return (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5 font-mono text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={s.name}
                      onChange={(e) => patch(s.id, { name: e.target.value })}
                      placeholder={`样品 ${i + 1}`}
                      className="h-7 text-xs"
                    />
                  </td>
                  {s.lipidEntries.map((e, idx) => (
                    <td key={e.id} className="px-2 py-1.5">
                      <Input
                        value={e.molarRatio}
                        onChange={(ev) => setRatio(s, idx, ev.target.value)}
                        inputMode="decimal"
                        className="h-7 font-mono text-xs"
                        title={entryName(e)}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[11px] ${
                        ok
                          ? "bg-success-subtle text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                      title={ok ? "摩尔比合计正常" : "摩尔比合计必须为 100%"}
                    >
                      {sum.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={s.prep.npRatio}
                      onChange={(ev) =>
                        patch(s.id, {
                          prep: { ...s.prep, npRatio: ev.target.value },
                        })
                      }
                      inputMode="decimal"
                      className="h-7 px-2 font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-0.5">
                      <Input
                        value={s.prep.frrAqueous}
                        onChange={(ev) =>
                          patch(s.id, {
                            prep: { ...s.prep, frrAqueous: ev.target.value },
                          })
                        }
                        className="h-7 w-9 px-1 text-center font-mono text-xs"
                      />
                      <span className="text-muted-foreground">:</span>
                      <Input
                        value={s.prep.frrOrganic}
                        onChange={(ev) =>
                          patch(s.id, {
                            prep: { ...s.prep, frrOrganic: ev.target.value },
                          })
                        }
                        className="h-7 w-9 px-1 text-center font-mono text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={s.prep.rnaMass}
                      onChange={(ev) =>
                        patch(s.id, {
                          prep: { ...s.prep, rnaMass: ev.target.value },
                        })
                      }
                      inputMode="decimal"
                      className="h-7 px-2 font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => onEdit(s)}
                        title="编辑完整配方与制备参数"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicate(s)}
                        title="复制该样品"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(s)}
                        title="删除该样品"
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button size="sm" variant="outline" className="gap-1.5" onClick={addSample}>
        <Plus className="h-3.5 w-3.5" />
        添加样品（复制上一行）
      </Button>
    </div>
  );
}
