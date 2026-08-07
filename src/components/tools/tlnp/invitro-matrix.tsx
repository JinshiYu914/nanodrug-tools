"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createInVitroColumn,
  createInVitroReplicate,
  type InVitroResults,
} from "@/lib/calculations/tlnp-experiment";

interface Props {
  results: InVitroResults;
  onChange: (next: InVitroResults) => void;
  /** The batch's reaction systems (or samples), offered as ready-made columns. */
  subjects: string[];
  unit: string;
}

/**
 * 体外结果 — one column per sample, one row per replicate.
 *
 * This is the shape the plate is read in: a row of wells is one repeat across
 * every condition, so typing goes left to right exactly as the plate reader
 * prints. The previous 样本/分组/数值 list needed the sample name retyped once
 * per well and had no idea which values were repeats of each other, so it could
 * not produce a mean, an error bar, or a chart.
 */
export default function InVitroMatrix({
  results,
  onChange,
  subjects,
  unit,
}: Props) {
  const { columns, replicates } = results;

  function setValue(rowId: string, col: number, value: string) {
    onChange({
      ...results,
      replicates: replicates.map((r) =>
        r.id === rowId
          ? { ...r, values: r.values.map((v, i) => (i === col ? value : v)) }
          : r
      ),
    });
  }

  function addColumn(name = "") {
    onChange({
      ...results,
      columns: [...columns, createInVitroColumn(name)],
      // Every row grows with the table, so `values[i]` always addresses the
      // column at index i — the alternative is ragged rows and off-by-one bars.
      replicates: replicates.map((r) => ({ ...r, values: [...r.values, ""] })),
    });
  }

  function fillSubjects() {
    const missing = subjects.filter((s) => !columns.some((c) => c.name === s));
    if (missing.length === 0) return;
    onChange({
      ...results,
      columns: [...columns, ...missing.map((s) => createInVitroColumn(s))],
      replicates: replicates.map((r) => ({
        ...r,
        values: [...r.values, ...missing.map(() => "")],
      })),
    });
  }

  function removeColumn(at: number) {
    onChange({
      ...results,
      columns: columns.filter((_, i) => i !== at),
      replicates: replicates.map((r) => ({
        ...r,
        values: r.values.filter((_, i) => i !== at),
      })),
    });
  }

  function addReplicate() {
    onChange({
      ...results,
      replicates: [...replicates, createInVitroReplicate(columns.length)],
    });
  }

  if (columns.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed py-8 text-center">
        <p className="text-sm text-muted-foreground">
          还没有样本列。每一列是一个样本，每一行是一次重复。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {subjects.length > 0 && (
            <Button size="sm" className="gap-1.5" onClick={fillSubjects}>
              <Plus className="h-3.5 w-3.5" />
              用本批次的 {subjects.length} 个样本建立
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => addColumn()}
          >
            <Plus className="h-3.5 w-3.5" />
            手动添加一列
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 w-20 border-r bg-muted px-2 py-2 text-left font-medium">
                重复
              </th>
              {columns.map((c, i) => (
                <th
                  key={c.id}
                  className="min-w-36 border-r px-2 py-1.5 last:border-r-0"
                >
                  <div className="flex items-center gap-1">
                    <Input
                      value={c.name}
                      onChange={(e) =>
                        onChange({
                          ...results,
                          columns: columns.map((x) =>
                            x.id === c.id ? { ...x, name: e.target.value } : x
                          ),
                        })
                      }
                      placeholder={`样本 ${i + 1}`}
                      className="h-7 px-2 text-xs font-medium"
                    />
                    <button
                      type="button"
                      title="删除该列"
                      onClick={() => removeColumn(i)}
                      className="shrink-0 p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {replicates.map((r, ri) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <th className="sticky left-0 z-10 border-r bg-card px-2 py-1.5 text-left text-xs font-normal text-muted-foreground">
                  <div className="flex items-center justify-between gap-1">
                    <span>#{ri + 1}</span>
                    <button
                      type="button"
                      title="删除该重复"
                      onClick={() =>
                        onChange({
                          ...results,
                          replicates: replicates.filter((x) => x.id !== r.id),
                        })
                      }
                      className="p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </th>
                {columns.map((c, ci) => (
                  <td
                    key={c.id}
                    className="border-r px-2 py-1.5 align-top last:border-r-0"
                  >
                    <Input
                      value={r.values[ci] ?? ""}
                      onChange={(e) => setValue(r.id, ci, e.target.value)}
                      inputMode="decimal"
                      className="h-7 px-2 font-mono text-xs"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={addReplicate}
        >
          <Plus className="h-3.5 w-3.5" />
          添加重复
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => addColumn()}
        >
          <Plus className="h-3.5 w-3.5" />
          添加样本
        </Button>
        {subjects.some((s) => !columns.some((c) => c.name === s)) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs"
            onClick={fillSubjects}
          >
            补齐本批次样本
          </Button>
        )}
        <span className="text-[11px] text-muted-foreground">单位：{unit}</span>
      </div>

      {replicates.length === 0 && (
        <p className="text-xs text-muted-foreground">
          还没有重复行 —— 点「添加重复」开始填数值。
        </p>
      )}
    </div>
  );
}
