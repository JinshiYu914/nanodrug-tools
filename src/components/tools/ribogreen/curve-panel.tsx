"use client";

import type { ReactNode } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StandardCurveEditor from "./standard-curve-editor";
import {
  createCurvePair,
  formatR2,
  isCurvePairModified,
  type CurvePair,
  type LinearFit,
} from "@/lib/calculations/ribogreen";
import {
  INSTRUMENT_OPTIONS,
  type InstrumentKey,
} from "@/lib/calculations/ribogreen-presets";

interface CurvePanelProps {
  instrument: InstrumentKey;
  curves: CurvePair;
  fits: { triton: LinearFit; te: LinearFit };
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  onInstrumentChange: (key: InstrumentKey) => void;
  onCurvesChange: (next: CurvePair) => void;
  /** Saved-curve panel, rendered inside the expanded area. */
  savedSlot?: ReactNode;
}

export default function CurvePanel({
  instrument,
  curves,
  fits,
  expanded,
  onExpandedChange,
  onInstrumentChange,
  onCurvesChange,
  savedSlot,
}: CurvePanelProps) {
  const modified = isCurvePairModified(instrument, curves);

  function handleClick(key: InstrumentKey) {
    if (key === instrument) {
      // Re-clicking the active instrument toggles the detail panel.
      onExpandedChange(!expanded);
    } else {
      onInstrumentChange(key);
      onExpandedChange(true);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {INSTRUMENT_OPTIONS.map((opt) => {
          const active = opt.key === instrument;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleClick(opt.key)}
              aria-expanded={active ? expanded : undefined}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-input hover:bg-muted/50"
              }`}
            >
              <span>
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {opt.meta}
                </span>
              </span>
              {active && (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>
          );
        })}

        {modified && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">已修改</Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => onCurvesChange(createCurvePair(instrument))}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认
            </Button>
          </div>
        )}
      </div>

      {/* Collapsed summary — keeps the fit visible without the full detail. */}
      {!expanded && (
        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          className="w-full rounded-md border border-dashed px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/40"
        >
          总浓度 R² <span className="font-mono">{formatR2(fits.triton)}</span> ·
          游离浓度 R² <span className="font-mono">{formatR2(fits.te)}</span>
          <span className="ml-2">— 点击展开标准点与曲线图</span>
        </button>
      )}

      {expanded && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <StandardCurveEditor
              title="TE buffer (1% Triton)"
              subtitle="裂解 LNP → 用于计算总浓度"
              spec={curves.triton}
              fit={fits.triton}
              editable={instrument === "custom"}
              onChange={(next) => onCurvesChange({ ...curves, triton: next })}
            />
            <StandardCurveEditor
              title="TE buffer"
              subtitle="仅游离 RNA → 用于计算游离浓度"
              spec={curves.te}
              fit={fits.te}
              editable={instrument === "custom"}
              onChange={(next) => onCurvesChange({ ...curves, te: next })}
            />
          </div>
          {savedSlot}
        </div>
      )}
    </div>
  );
}
