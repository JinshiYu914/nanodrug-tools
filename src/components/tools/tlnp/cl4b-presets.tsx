"use client";

import { useCallback, useEffect, useState } from "react";
import { Columns3, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteCl4bPreset,
  listCl4bPresets,
  saveCl4bPreset,
  type Cl4bPresetItem,
} from "@/lib/supabase/tlnp-library";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";
import type { Cl4bParams } from "@/lib/calculations/tlnp-experiment";

const MIGRATION = "005_tlnp_libraries.sql";

interface Props {
  current: Cl4bParams;
  onApply: (p: Cl4bParams) => void;
}

/**
 * Saved columns, available in every batch.
 *
 * A packed CL-4B column is a physical object that outlives any one experiment:
 * its length, diameter, flow rate and running buffer are the same next month.
 * Retyping them per batch is how they end up inconsistent between batches that
 * actually used the same column.
 */
export default function Cl4bPresets({ current, onApply }: Props) {
  const [presets, setPresets] = useState<Cl4bPresetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPresets(await listCl4bPresets());
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    const label = name.trim();
    if (!label) {
      toast.error("给这根柱子起个名字");
      return;
    }
    try {
      await saveCl4bPreset(label, current);
      setName("");
      setNaming(false);
      await reload();
      toast.success(`已保存柱子预设：${label}`);
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  async function remove(p: Cl4bPresetItem) {
    if (!confirm(`删除柱子预设「${p.name}」？已经用过它的批次不受影响。`)) return;
    try {
      await deleteCl4bPreset(p.id);
      await reload();
      toast.success("已删除");
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <Columns3 className="h-3.5 w-3.5 text-pillar-utr" />
          我的柱子
        </span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : presets.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">
            还没有保存过柱子参数
          </span>
        ) : (
          presets.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1 rounded-md border border-input bg-card px-2 py-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  onApply({
                    columnLength: p.columnLength,
                    columnDiameter: p.columnDiameter,
                    flowRate: p.flowRate,
                    buffer: p.buffer,
                  });
                  toast.success(`已套用「${p.name}」`);
                }}
                title={`${p.columnLength || "?"} × ${p.columnDiameter || "?"} cm · ${p.flowRate || "?"} mL/min · ${p.buffer || "未填 buffer"}`}
                className="text-xs hover:text-primary"
              >
                {p.name}
              </button>
              <button
                type="button"
                onClick={() => void remove(p)}
                title="删除该预设"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {naming ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setNaming(false);
            }}
            placeholder="例如 CL4B-1.5×30"
            autoFocus
            className="h-7 max-w-56 px-2 text-xs"
          />
          <Button size="sm" className="h-7 text-xs" onClick={() => void save()}>
            保存
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setNaming(false)}
          >
            取消
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-[11px]"
          onClick={() => setNaming(true)}
        >
          <Save className="h-3 w-3" />
          把当前参数存为预设
        </Button>
      )}
    </div>
  );
}
