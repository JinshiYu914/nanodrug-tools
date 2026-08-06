"use client";

import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ScatterFitChart from "./scatter-fit-chart";
import {
  createBlankPoint,
  formatFitEquation,
  formatR2,
  negativeThreshold,
  type CurvePoint,
  type CurveSpec,
  type LinearFit,
} from "@/lib/calculations/ribogreen";

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

interface StandardCurveEditorProps {
  title: string;
  subtitle: string;
  spec: CurveSpec;
  fit: LinearFit;
  /** Only custom curves may add/remove rows. */
  editable: boolean;
  onChange: (next: CurveSpec) => void;
}

export default function StandardCurveEditor({
  title,
  subtitle,
  spec,
  fit,
  editable,
  onChange,
}: StandardCurveEditorProps) {
  const patchPoint = (id: string, patch: Partial<CurvePoint>) =>
    onChange({
      ...spec,
      points: spec.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const enabledCount = spec.points.filter((p) => p.enabled).length;
  const allEnabled = enabledCount === spec.points.length;
  const negThreshold = negativeThreshold(fit);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground">{subtitle} · 浓度单位 ng/mL</p>
      </div>

      {/* Table narrower than the chart so both curves fit side by side.
          minmax(0,…) stops the table from blowing the column out. */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
        {/* ── 左：标准点数值 ── */}
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="w-7 px-1 py-1.5 text-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={allEnabled && spec.points.length > 0}
                      title={allEnabled ? "全部取消" : "全部启用"}
                      onChange={() =>
                        onChange({
                          ...spec,
                          points: spec.points.map((p) => ({
                            ...p,
                            enabled: !allEnabled,
                          })),
                        })
                      }
                    />
                  </th>
                  <th className="px-1 py-1.5 text-left">读数</th>
                  <th className="px-1 py-1.5 text-left">浓度</th>
                  {editable && <th className="w-7 px-1 py-1.5" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {spec.points.map((p) => (
                  <tr key={p.id} className={p.enabled ? "" : "opacity-50"}>
                    <td className="px-1 py-1 text-center">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={p.enabled}
                        title={p.enabled ? "从拟合中剔除此点" : "重新纳入此点"}
                        onChange={(e) =>
                          patchPoint(p.id, { enabled: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        step="any"
                        value={p.reading}
                        onChange={(e) =>
                          patchPoint(p.id, { reading: e.target.value })
                        }
                        onFocus={(e) => e.target.select()}
                        className="h-7 font-mono text-xs"
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        step="any"
                        value={p.conc}
                        onChange={(e) =>
                          patchPoint(p.id, { conc: e.target.value })
                        }
                        onFocus={(e) => e.target.select()}
                        className="h-7 font-mono text-xs"
                      />
                    </td>
                    {editable && (
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          title="删除此点"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            onChange({
                              ...spec,
                              points: spec.points.filter((q) => q.id !== p.id),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editable && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() =>
                onChange({
                  ...spec,
                  points: [...spec.points, createBlankPoint()],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              添加标准点
            </Button>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={spec.throughOrigin}
              onChange={(e) =>
                onChange({ ...spec, throughOrigin: e.target.checked })
              }
            />
            过原点拟合 (b = 0)
          </label>
        </div>

        {/* ── 右：曲线图 + 公式 ── */}
        <div className="space-y-2">
          <ScatterFitChart
            points={spec.points.map((p) => ({
              x: num(p.reading),
              y: num(p.conc),
              enabled: p.enabled,
            }))}
            fit={fit}
          />

          <div className="rounded-md bg-muted/50 p-2 space-y-0.5">
            <p className="font-mono text-xs break-words">
              {formatFitEquation(fit)}
            </p>
            <p className="text-xs text-muted-foreground">
              R² = <span className="font-mono">{formatR2(fit)}</span>
              {fit.valid && (
                <>
                  {" · "}
                  {fit.n} 点 · 范围{" "}
                  <span className="font-mono">
                    {fit.minX}~{fit.maxX}
                  </span>
                </>
              )}
            </p>
          </div>

          {!fit.valid && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              至少需要 2 个启用且填写完整的标准点才能拟合。
            </p>
          )}

          {negThreshold !== null && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                截距为负：读数低于{" "}
                <span className="font-mono">{negThreshold.toPrecision(4)}</span>{" "}
                时会算出负浓度。可勾选「过原点拟合」或剔除低端离群点。
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
