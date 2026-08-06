"use client";

import { Beaker, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DIALYSIS_OPTIONS,
  MIXING_OPTIONS,
  ULTRAFILTRATION_OPTIONS,
  describeMethod,
  type BenchMethod,
  type PostProcessKey,
} from "@/lib/calculations/lnp-bench";

const POST_OPTIONS: { key: PostProcessKey; label: string }[] = [
  { key: "none", label: "不做后处理" },
  { key: "dialysis", label: "透析" },
  { key: "ultrafiltration", label: "超滤" },
];

/** Pill button — selected state carries the primary tint, same as the tabs. */
function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-input text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

interface Props {
  value: BenchMethod;
  onChange: (next: BenchMethod) => void;
}

/**
 * 实验方法 — recorded alongside every screening formulation so the bench
 * card, the PDF and the Excel export can all say how the batch was made.
 * Both halves (制备 and 后处理) are always shown; neither is required.
 */
export default function MethodPicker({ value, onChange }: Props) {
  const set = (patch: Partial<BenchMethod>) => onChange({ ...value, ...patch });
  const summary = describeMethod(value);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Beaker className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">实验方法</h3>
        <span
          className="text-muted-foreground cursor-help"
          title="随配方一起存入实验台，导出的 PDF / Excel 也会带上，方便日后回忆制备方式"
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
        {/* ── 制备方法 ── */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">制备方法</Label>
          <div className="flex flex-wrap gap-2">
            {MIXING_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                active={value.mixing === o.key}
                // Clicking the selected chip clears it — nothing here is required.
                onClick={() =>
                  set({ mixing: value.mixing === o.key ? "" : o.key })
                }
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* ── 后处理 ── */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">后处理</Label>
          <div className="flex flex-wrap gap-2">
            {POST_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                active={value.postProcess === o.key}
                onClick={() => set({ postProcess: o.key })}
              >
                {o.label}
              </Chip>
            ))}
          </div>

          {value.postProcess === "dialysis" && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap gap-2">
                {DIALYSIS_OPTIONS.map((o) => (
                  <Chip
                    key={o.key}
                    active={value.dialysisDuration === o.key}
                    onClick={() => set({ dialysisDuration: o.key })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
              {value.dialysisDuration === "custom" && (
                <Input
                  value={value.dialysisCustom}
                  onChange={(e) => set({ dialysisCustom: e.target.value })}
                  placeholder="例如 过夜 / 6 h 换液两次"
                  className="h-8 text-xs"
                />
              )}
            </div>
          )}

          {value.postProcess === "ultrafiltration" && (
            <div className="flex flex-wrap gap-2 pt-1">
              {ULTRAFILTRATION_OPTIONS.map((o) => (
                <Chip
                  key={o.key}
                  active={value.ultrafiltration === o.key}
                  onClick={() => set({ ultrafiltration: o.key })}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">备注（可选）</Label>
        <Input
          value={value.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="例如 流速 12 mL/min，PBS 换液 3 次"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}
