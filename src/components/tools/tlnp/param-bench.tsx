"use client";

import { useState } from "react";
import { Check, Info, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Chip from "./chip";
import {
  createCustomParam,
  joinMulti,
  splitMulti,
  type ParamEntry,
} from "@/lib/calculations/tlnp-params";

interface Props {
  entries: ParamEntry[];
  onChange: (next: ParamEntry[]) => void;
  title?: string;
  hint?: string;
}

/**
 * The click-to-pick parameter bench.
 *
 * Three behaviours make this worth its own component rather than a pile of
 * inputs:
 *
 * - Clicking a chip sets the value; clicking the selected chip clears it.
 *   Nothing here is required — a half-filled batch is a normal batch. A `multi`
 *   entry (检测指标) toggles instead, because an assay genuinely reads out on
 *   several measures at once.
 * - Typing something not in the options offers 存为选项, which pushes it into
 *   the entry's own `options`. The pickers get better the more the notebook is
 *   used, and because options live on the entry that improvement is persisted.
 * - 新增参数 appends a user-defined field. Presets can be cleared but not
 *   deleted — they would only reappear from the preset bank on next load, and
 *   a delete button that silently doesn't work is worse than no button.
 */
export default function ParamBench({
  entries,
  onChange,
  title = "实验参数",
  hint = "点击选择，或手动输入；也可以新增自己的参数字段",
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const patch = (id: string, next: Partial<ParamEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...next } : e)));

  function promote(entry: ParamEntry) {
    const v = entry.multi
      ? (splitMulti(entry.value).find((x) => !entry.options.includes(x)) ?? "")
      : entry.value.trim();
    if (!v || entry.options.includes(v)) return;
    patch(entry.id, { options: [...entry.options, v] });
  }

  function addCustom() {
    const label = newLabel.trim();
    if (!label) return;
    onChange([...entries, createCustomParam(label)]);
    setNewLabel("");
    setAdding(false);
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="cursor-help text-muted-foreground" title={hint}>
          <Info className="h-3.5 w-3.5" />
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 gap-1 text-xs"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          新增参数
        </Button>
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="新参数名称，例如 芯片型号"
            className="h-8 max-w-64 flex-1 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") addCustom();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <Button size="sm" className="h-8 text-xs" onClick={addCustom}>
            添加
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setAdding(false)}
          >
            取消
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry) => (
          <ParamRow
            key={entry.id}
            entry={entry}
            onValue={(value) => patch(entry.id, { value })}
            onLabel={(label) => patch(entry.id, { label })}
            onPromote={() => promote(entry)}
            onRemove={() => onChange(entries.filter((e) => e.id !== entry.id))}
          />
        ))}
      </div>
    </div>
  );
}

function ParamRow({
  entry,
  onValue,
  onLabel,
  onPromote,
  onRemove,
}: {
  entry: ParamEntry;
  onValue: (v: string) => void;
  onLabel: (v: string) => void;
  onPromote: () => void;
  onRemove: () => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const typed = entry.value.trim();
  const picked = entry.multi ? splitMulti(entry.value) : [];
  // A multi entry's free-text box only ever holds what isn't already a chip, so
  // 存为选项 stays meaningful: promoting "Cell Titer" out of a value that reads
  // "Luciferase、Cell Titer" would offer a chip nobody could ever match.
  const extra = entry.multi
    ? picked.filter((v) => !entry.options.includes(v))
    : [];
  const canPromote = entry.multi
    ? extra.length === 1
    : typed !== "" && !entry.options.includes(typed);

  function toggle(opt: string) {
    if (!entry.multi) {
      onValue(entry.value === opt ? "" : opt);
      return;
    }
    onValue(
      joinMulti(
        picked.includes(opt)
          ? picked.filter((v) => v !== opt)
          : [...picked, opt]
      )
    );
  }

  /** For a multi entry the input edits only the values not offered as chips. */
  function setFreeText(text: string) {
    if (!entry.multi) {
      onValue(text);
      return;
    }
    const kept = picked.filter((v) => entry.options.includes(v));
    onValue(joinMulti([...kept, ...splitMulti(text)]));
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-start">
      <div className="flex items-center gap-1 pt-1.5">
        {editingLabel ? (
          <Input
            value={entry.label}
            onChange={(e) => onLabel(e.target.value)}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditingLabel(false);
            }}
            className="h-7 text-xs"
            autoFocus
          />
        ) : (
          <Label
            className={`text-xs text-muted-foreground ${
              entry.custom ? "cursor-text" : ""
            }`}
            onClick={() => entry.custom && setEditingLabel(true)}
            title={entry.custom ? "点击重命名" : undefined}
          >
            {entry.label}
          </Label>
        )}
        {entry.custom && !editingLabel && (
          <button
            type="button"
            onClick={onRemove}
            title="删除该参数"
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {entry.options.map((opt) => (
          <Chip
            key={opt}
            active={entry.multi ? picked.includes(opt) : entry.value === opt}
            // Clicking a selected chip clears it — nothing here is required.
            onClick={() => toggle(opt)}
          >
            {opt}
          </Chip>
        ))}

        <Input
          value={entry.multi ? joinMulti(extra) : entry.value}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder={entry.placeholder ?? "手动输入"}
          className="h-8 w-40 text-xs"
        />

        {canPromote && (
          <button
            type="button"
            onClick={onPromote}
            title="把这个值存成常用选项，下次可直接点选"
            className="flex items-center gap-1 rounded-md border border-dashed border-primary/50 px-2 py-1 text-[11px] text-primary hover:bg-primary/10"
          >
            <Check className="h-3 w-3" />
            存为选项
          </button>
        )}
      </div>
    </div>
  );
}
