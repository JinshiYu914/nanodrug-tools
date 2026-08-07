"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GroupedBarChart, LiverSpleenChart } from "./assay-charts";
import {
  groupRoi,
  liverSpleenRatio,
  parseRoiTable,
} from "@/lib/calculations/tlnp-roi";
import type { RoiRun } from "@/lib/calculations/tlnp-experiment";

const EXAMPLE = `tLNP-1\tliver\t2.31e8\t4.52e6
tLNP-1\tspleen\t8.40e7\t1.63e6
tLNP-1\tlung\t1.12e7\t3.10e5`;

interface Props {
  run: RoiRun;
  onChange: (next: RoiRun) => void;
  onRemove: () => void;
  /** Open on the paste box — a run that was just created has nothing to show. */
  startEditing?: boolean;
}

/**
 * One imaging session: a name, the three figures, and the paste behind them.
 *
 * Same shape as a chromatogram card, and for the same reason — the raw block is
 * thirty lines of scientific notation that nobody reads once it has been
 * plotted, so it collapses away and comes back under the pencil when a row
 * needs correcting.
 */
export default function RoiRunCard({
  run,
  onChange,
  onRemove,
  startEditing = false,
}: Props) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(run.rawText);

  const parsed = useMemo(() => parseRoiTable(draft), [draft]);
  const grouped = useMemo(() => groupRoi(run.rows), [run.rows]);
  const ratio = useMemo(() => liverSpleenRatio(run.rows), [run.rows]);

  function save() {
    onChange({ ...run, rawText: draft, rows: parsed.rows });
    setEditing(false);
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={run.name}
          onChange={(e) => onChange({ ...run, name: e.target.value })}
          placeholder="成像结果名称"
          className="h-8 max-w-64 px-2 text-xs font-medium"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {run.rows.length} 行 · {grouped.samples.length} 样本 ·{" "}
            {grouped.organs.length} 器官
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft(run.rawText);
              setEditing((v) => !v);
            }}
            title="重新编辑这组成像数据"
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="删除该成像结果"
            className="p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          {/* max-h + overflow keeps a 60-row paste inside its own scrollbar.
              shadcn's Textarea is field-sizing-content, so without a ceiling
              the box grows to the full paste and takes over the page. */}
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            autoFocus
            className="max-h-64 min-h-32 overflow-y-auto font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Button size="sm" className="h-8 text-xs" onClick={save}>
              保存并出图
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setDraft(run.rawText);
                setEditing(false);
              }}
            >
              取消
            </Button>
            <span className="text-muted-foreground">
              读到 {parsed.rows.length} 行
            </span>
            {parsed.warnings.map((w) => (
              <span
                key={w}
                className="rounded border border-warning/35 bg-warning-subtle px-1.5 py-0.5 text-warning"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      ) : run.rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          还没有数据 —— 点铅笔粘贴 样本名 / 器官 / Total ROI / Avg ROI 四列。
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <GroupedBarChart
            samples={grouped.samples}
            series={grouped.total}
            unit="Total Flux (p/s)"
            title="Total ROI"
          />
          <GroupedBarChart
            samples={grouped.samples}
            series={grouped.avg}
            unit="Avg Radiance (p/s/cm²/sr)"
            title="Avg ROI"
          />
          <LiverSpleenChart bars={ratio} />
        </div>
      )}

      <Input
        value={run.note}
        onChange={(e) => onChange({ ...run, note: e.target.value })}
        placeholder="备注"
        className="h-7 px-2 text-xs"
      />
    </div>
  );
}
