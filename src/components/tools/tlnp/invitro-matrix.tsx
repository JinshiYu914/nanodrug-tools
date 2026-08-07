"use client";

import { useState } from "react";
import { ClipboardPaste, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseClipboardGrid } from "@/lib/calculations/ribogreen";
import {
  applyGridToInVitro,
  createInVitroColumn,
  createInVitroReplicate,
  inVitroFromGrid,
  inVitroToTsv,
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
 *
 * Because it is the same shape as the sheet the numbers arrive in, the whole
 * block pastes in one go — either into a cell (filling right and down from
 * there, growing the table) or through 「粘贴数据」 for a fresh table with its
 * sample names on the header row. 复制 sends it back the same way.
 */
export default function InVitroMatrix({
  results,
  onChange,
  subjects,
  unit,
}: Props) {
  const { columns, replicates } = results;
  const [bulk, setBulk] = useState<string | null>(null);

  function pasteInto(rowIndex: number, colIndex: number, text: string): boolean {
    const grid = parseClipboardGrid(text);
    // A single cell is an ordinary edit — let the input handle it so undo,
    // selection and partial replacement all keep working.
    if (grid.length <= 1 && (grid[0]?.length ?? 0) <= 1) return false;
    onChange(applyGridToInVitro(results, grid, rowIndex, colIndex));
    toast.success(`已粘贴 ${grid.length} 行 × ${grid[0]?.length ?? 0} 列`);
    return true;
  }

  function applyBulk() {
    const grid = parseClipboardGrid(bulk ?? "");
    const next = inVitroFromGrid(grid);
    if (next.columns.length === 0) {
      toast.error("没有读到数据");
      return;
    }
    onChange({ ...results, ...next });
    setBulk(null);
    toast.success(
      `已读入 ${next.columns.length} 个样本 × ${next.replicates.length} 次重复`
    );
  }

  async function copyOut() {
    try {
      await navigator.clipboard.writeText(inVitroToTsv(results));
      toast.success("已复制，可直接粘贴回 Excel");
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限");
    }
  }

  const bulkBox = bulk !== null && (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs font-medium">
        从 Excel 粘贴整块数据（第一行是样本名，下面每行一次重复）
      </p>
      <Textarea
        value={bulk}
        onChange={(e) => setBulk(e.target.value)}
        placeholder={"tLNP-1\ttLNP-2\n12000\t48000\n13500\t51000"}
        spellCheck={false}
        autoFocus
        className="max-h-64 min-h-28 overflow-y-auto font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8 text-xs" onClick={applyBulk}>
          读入
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => setBulk(null)}
        >
          取消
        </Button>
        <span className="text-[11px] text-muted-foreground">
          会替换现有的样本列与重复行。
        </span>
      </div>
    </div>
  );

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
      <div className="space-y-3">
        {bulkBox}
        {bulk === null && (
          <div className="space-y-3 rounded-lg border border-dashed py-8 text-center">
            <p className="text-sm text-muted-foreground">
              还没有样本列。每一列是一个样本，每一行是一次重复。
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => setBulk("")}>
                <ClipboardPaste className="h-3.5 w-3.5" />
                从 Excel 粘贴数据
              </Button>
              {subjects.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={fillSubjects}
                >
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
        )}
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
                      onPaste={(e) => {
                        // A row of names copied from the sheet's header fills
                        // the names rightward, same as values do below.
                        const grid = parseClipboardGrid(
                          e.clipboardData.getData("text")
                        );
                        const names = grid[0] ?? [];
                        if (names.length <= 1) return;
                        e.preventDefault();
                        const next = [...columns];
                        names.forEach((name, k) => {
                          const at = i + k;
                          next[at] = next[at]
                            ? { ...next[at], name: name.trim() }
                            : createInVitroColumn(name.trim());
                        });
                        onChange({
                          ...results,
                          columns: next,
                          replicates: replicates.map((r) => ({
                            ...r,
                            values: Array.from(
                              { length: next.length },
                              (_, k) => r.values[k] ?? ""
                            ),
                          })),
                        });
                      }}
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
                      onPaste={(e) => {
                        if (pasteInto(ri, ci, e.clipboardData.getData("text"))) {
                          e.preventDefault();
                        }
                      }}
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

      {bulkBox}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setBulk("")}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          从 Excel 粘贴
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={copyOut}>
          <Copy className="h-3.5 w-3.5" />
          复制到 Excel
        </Button>
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
          还没有重复行 —— 点「添加重复」手动填，或用「从 Excel
          粘贴」一次读入整块数据。
        </p>
      )}
    </div>
  );
}
