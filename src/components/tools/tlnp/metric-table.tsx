"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMetricRow, type MetricRow } from "@/lib/calculations/tlnp-experiment";

interface Props {
  rows: MetricRow[];
  onChange: (next: MetricRow[]) => void;
  /** Names offered as a datalist for 样本 — the batch's samples and products. */
  subjects: string[];
}

/**
 * A deliberately generic results table: 样本 / 分组 / 数值 / 单位 / 备注.
 *
 * In-vitro and in-vivo assays measure wildly different things — luciferase RLU,
 * %GFP+, organ radiance, body weight — so a fixed column set would be wrong for
 * most of them. 分组 carries whatever second axis the assay needs (timepoint,
 * dose group, replicate).
 *
 * 一键铺样本 fills one row per sample so the common case isn't typed by hand.
 */
export default function MetricTable({ rows, onChange, subjects }: Props) {
  const listId = "tlnp-metric-subjects";

  const patch = (id: string, next: Partial<MetricRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...next } : r)));

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[44rem] border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="min-w-40 px-2 py-2 text-left font-medium">
                  样本
                </th>
                <th className="w-28 px-2 py-2 text-left font-medium">分组</th>
                <th className="w-28 px-2 py-2 text-left font-medium">数值</th>
                <th className="w-24 px-2 py-2 text-left font-medium">单位</th>
                <th className="px-2 py-2 text-left font-medium">备注</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5">
                    <Input
                      value={r.label}
                      onChange={(e) => patch(r.id, { label: e.target.value })}
                      list={listId}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={r.group}
                      onChange={(e) => patch(r.id, { group: e.target.value })}
                      placeholder="24 h"
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={r.value}
                      onChange={(e) => patch(r.id, { value: e.target.value })}
                      inputMode="decimal"
                      className="h-7 font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={r.unit}
                      onChange={(e) => patch(r.id, { unit: e.target.value })}
                      placeholder="RLU"
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={r.note}
                      onChange={(e) => patch(r.id, { note: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                      title="删除该行"
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <datalist id={listId}>
        {subjects.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onChange([...rows, createMetricRow()])}
        >
          <Plus className="h-3.5 w-3.5" />
          添加一行
        </Button>
        {subjects.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs"
            onClick={() =>
              onChange([...rows, ...subjects.map((s) => createMetricRow(s))])
            }
          >
            一键铺入本批次样本（{subjects.length}）
          </Button>
        )}
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          还没有结果。可以一行一个样本，用「分组」区分时间点或剂量组。
        </p>
      )}
    </div>
  );
}
