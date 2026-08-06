"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BATCH_FIELDS,
  effectiveSampleName,
  type BatchField,
  type SampleRow,
} from "@/lib/calculations/ribogreen";

type Scope = "all" | "empty" | "pick";

interface Props {
  /** Always true — the parent mounts this only while the dialog is open, so
   *  every open starts from clean state without a reset effect. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: SampleRow[];
  experimentDate: string;
  onApply: (
    values: Partial<Record<BatchField, string>>,
    opts: { targetIds?: Set<string>; onlyEmpty?: boolean }
  ) => void;
}

/**
 * Batch fill for the four "same for every sample most of the time" inputs.
 * Per-column editing stays untouched — this only writes the fields the user
 * ticks, over the samples they choose.
 */
export default function BatchFillDialog({
  open,
  onOpenChange,
  rows,
  experimentDate,
  onApply,
}: Props) {
  const [enabled, setEnabled] = useState<Set<BatchField>>(() => new Set());
  const [values, setValues] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<Scope>("all");
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.id))
  );

  const toggleField = (f: BatchField) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  function apply() {
    const payload: Partial<Record<BatchField, string>> = {};
    for (const f of enabled) payload[f] = values[f] ?? "";
    onApply(payload, {
      targetIds: scope === "pick" ? picked : undefined,
      onlyEmpty: scope === "empty",
    });
    onOpenChange(false);
  }

  const count =
    scope === "pick" ? picked.size : rows.length;
  const canApply =
    enabled.size > 0 && (scope !== "pick" || picked.size > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>批量修改</DialogTitle>
          <DialogDescription>
            勾选要写入的字段，只有勾选的会被覆盖；未勾选的字段以及未选中的样本保持原样。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {BATCH_FIELDS.map(({ field, label }) => {
              const on = enabled.has(field);
              return (
                <div key={field} className="flex items-center gap-3">
                  <label className="flex min-w-44 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={on}
                      onChange={() => toggleField(field)}
                    />
                    {label}
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={values[field] ?? ""}
                    disabled={!on}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                    onFocus={(e) => {
                      if (!on) toggleField(field);
                      e.target.select();
                    }}
                    placeholder="留空则清除该字段"
                    className="h-8 flex-1 font-mono text-xs"
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label className="text-xs text-muted-foreground">应用范围</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              {(
                [
                  ["all", `全部 ${rows.length} 个样本`],
                  ["empty", "只填空白单元格"],
                  ["pick", "指定样本"],
                ] as [Scope, string][]
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <input
                    type="radio"
                    name="batch-scope"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={scope === key}
                    onChange={() => setScope(key)}
                  />
                  {label}
                </label>
              ))}
            </div>

            {scope === "pick" && (
              <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                <div className="flex flex-wrap gap-1.5">
                  {rows.map((r, i) => {
                    const on = picked.has(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                        className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {effectiveSampleName(r, i, experimentDate)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={!canApply} onClick={apply}>
            应用到 {count} 个样本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
