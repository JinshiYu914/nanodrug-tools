"use client";

import { Droplets, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Chip from "./chip";
import {
  DIALYSIS_OPTIONS,
  ULTRAFILTRATION_OPTIONS,
  describeMethod,
  type BenchMethod,
  type PostProcessKey,
} from "@/lib/calculations/lnp-bench";
import type { SolventExchange } from "@/lib/calculations/tlnp-experiment";

const POST_OPTIONS: { key: PostProcessKey; label: string }[] = [
  { key: "none", label: "不做置换" },
  { key: "dialysis", label: "透析" },
  { key: "ultrafiltration", label: "超滤" },
];

interface Props {
  value: SolventExchange;
  onChange: (next: SolventExchange) => void;
}

/**
 * 溶剂置换 — 透析 / 超滤 plus the buffer it was exchanged into.
 *
 * The method half is a plain BenchMethod, so 透析 durations and 超滤 cycles come
 * from the same option tables the screening bench uses and `describeMethod`
 * renders the summary. Mixing lives in the parameter bench above, not here, so
 * the two never disagree about how the batch was made.
 */
export default function SolventExchangePicker({ value, onChange }: Props) {
  const setMethod = (patch: Partial<BenchMethod>) =>
    onChange({ ...value, method: { ...value.method, ...patch } });
  const setBuffer = (v: string) =>
    onChange({ ...value, buffer: { ...value.buffer, value: v } });

  const summary = describeMethod(value.method);
  const post = value.method.postProcess;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Droplets className="h-4 w-4 text-pillar-utr" />
        <h3 className="text-sm font-semibold">溶剂置换</h3>
        <span
          className="cursor-help text-muted-foreground"
          title="除去乙醇并换入目标 buffer。会写进每个新建样品的实验方法，导出时一并带上"
        >
          <Info className="h-3.5 w-3.5" />
        </span>
        {summary && (
          <span className="ml-auto rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
            {summary}
          </span>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">置换方式</Label>
          <div className="flex flex-wrap gap-2">
            {POST_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                active={post === o.key}
                onClick={() => setMethod({ postProcess: o.key })}
              >
                {o.label}
              </Chip>
            ))}
          </div>

          {post === "dialysis" && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap gap-2">
                {DIALYSIS_OPTIONS.map((o) => (
                  <Chip
                    key={o.key}
                    active={value.method.dialysisDuration === o.key}
                    onClick={() => setMethod({ dialysisDuration: o.key })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
              {value.method.dialysisDuration === "custom" && (
                <Input
                  value={value.method.dialysisCustom}
                  onChange={(e) => setMethod({ dialysisCustom: e.target.value })}
                  placeholder="例如 过夜 / 6 h 换液两次"
                  className="h-8 text-xs"
                />
              )}
            </div>
          )}

          {post === "ultrafiltration" && (
            <div className="flex flex-wrap gap-2 pt-1">
              {ULTRAFILTRATION_OPTIONS.map((o) => (
                <Chip
                  key={o.key}
                  active={value.method.ultrafiltration === o.key}
                  onClick={() => setMethod({ ultrafiltration: o.key })}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {value.buffer.label}
          </Label>
          <div className="flex flex-wrap gap-2">
            {value.buffer.options.map((opt) => (
              <Chip
                key={opt}
                active={value.buffer.value === opt}
                onClick={() => setBuffer(value.buffer.value === opt ? "" : opt)}
              >
                {opt}
              </Chip>
            ))}
          </div>
          <Input
            value={value.buffer.value}
            onChange={(e) => setBuffer(e.target.value)}
            placeholder={value.buffer.placeholder ?? "自定义 buffer"}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">备注（可选）</Label>
        <Input
          value={value.method.note}
          onChange={(e) => setMethod({ note: e.target.value })}
          placeholder="例如 100 kDa 超滤管 3000 g 15 min，换液 3 次"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}
