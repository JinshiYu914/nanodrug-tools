"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardPaste,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Save,
  Sheet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  applyClipboardToSamples,
  buildResultTsv,
  createBlankSample,
  effectiveSampleName,
  defaultSampleName,
  parseClipboardGrid,
  stepDilution,
  type BatchComputed,
  type CopyMode,
  type CorrectionSetting,
  type PasteField,
  type SampleRow,
} from "@/lib/calculations/ribogreen";

const fmt = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !isFinite(v) ? "--" : v.toFixed(digits);

// The sticky label column needs an OPAQUE background or the scrolling columns
// show through. Background is a parameter rather than baked in, so highlighted
// rows can override it without fighting class order.
const stickyCell = (bg = "bg-card") =>
  `sticky left-0 z-10 ${bg} px-2 py-1 text-left text-xs font-medium whitespace-nowrap`;
const STICKY = stickyCell();

// Tint for the highlighted result rows. color-mix keeps it fully OPAQUE (a
// `bg-primary/5` would let the scrolling columns show through the sticky
// label cell) while still tracking the light/dark theme tokens.
const KEY_BG = "bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))]";

interface SampleGridProps {
  rows: SampleRow[];
  /** the batch whose numbers are displayed (raw or corrected) */
  display: BatchComputed;
  /** the authoritative corrected batch — drives the correction bar */
  batch: BatchComputed;
  correction: CorrectionSetting;
  showCorrected: boolean;
  experimentDate: string;
  onRowsChange: (next: SampleRow[]) => void;
  onCorrectionChange: (next: CorrectionSetting) => void;
  onShowCorrectedChange: (next: boolean) => void;
  onReset: () => void;
  onSave: () => void;
  onExportXlsx: () => void;
}

const INPUT_ROWS: {
  field: PasteField;
  label: string;
  type: "text" | "number";
  title?: string;
  required?: boolean;
  pasteHint?: boolean;
}[] = [
  { field: "name", label: "样本名", type: "text" },
  { field: "dilution", label: "稀释倍数", type: "number", required: true },
  {
    field: "readTriton",
    label: "读数 · TE (1% Triton)",
    type: "number",
    pasteHint: true,
  },
  { field: "readTe", label: "读数 · TE buffer", type: "number", pasteHint: true },
  {
    field: "lnpVolume",
    label: "LNP 体积 (µL)",
    type: "number",
    title: "制剂终体积，不是检测孔内体积（孔内稀释已由稀释倍数体现）",
  },
  { field: "rnaInput", label: "投入 RNA 量 (µg)", type: "number" },
  { field: "needMass", label: "需取用 LNP-RNA (µg)", type: "number" },
];

/** Result rows the user actually reads off — rendered with emphasis. */
const KEY_ROWS = new Set([
  "LNP-RNA 浓度 (ng/µL)",
  "包封率 (%)",
  "取样体积 (µL)",
]);

export default function SampleGrid({
  rows,
  display,
  batch,
  correction,
  showCorrected,
  experimentDate,
  onRowsChange,
  onCorrectionChange,
  onShowCorrectedChange,
  onReset,
  onSave,
  onExportXlsx,
}: SampleGridProps) {
  const [copied, setCopied] = useState(false);

  const computedById = useMemo(
    () => new Map(display.samples.map((s) => [s.id, s])),
    [display]
  );

  const patch = (id: string, field: keyof SampleRow, value: string) =>
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const handlePaste =
    (field: PasteField, colIndex: number) =>
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const grid = parseClipboardGrid(e.clipboardData.getData("text/plain"));
      // A plain single-cell paste keeps native behavior (cursor, selection).
      if (grid.length === 0) return;
      if (grid.length === 1 && grid[0].length === 1) return;

      e.preventDefault();
      const res = applyClipboardToSamples(rows, grid, { field, colIndex });
      onRowsChange(res.rows);
      if (res.appended > 0) toast.success(`已新增 ${res.appended} 个样本列`);
      if (res.truncated > 0) {
        toast.warning(`有 ${res.truncated} 项超出范围被忽略（最多 96 个样本）`);
      }
    };

  const warnings = useMemo(() => {
    const out: string[] = [];
    const fits = batch.fits;
    display.samples.forEach((s, i) => {
      const label = rows[i]
        ? effectiveSampleName(rows[i], i, experimentDate)
        : `样本 ${i + 1}`;
      if (s.flags.missingDilution) out.push(`${label}：缺少稀释倍数`);
      if (s.flags.tritonRange === "above" || s.flags.tritonRange === "below") {
        out.push(
          `${label}：Triton 读数超出标曲范围（${fits.triton.minX} ~ ${fits.triton.maxX}），结果可能不准确`
        );
      }
      if (s.flags.teRange === "above" || s.flags.teRange === "below") {
        out.push(
          `${label}：TE 读数超出标曲范围（${fits.te.minX} ~ ${fits.te.maxX}），结果可能不准确`
        );
      }
      if (s.flags.negativeTotal) out.push(`${label}：总浓度为负，读数低于标曲下限`);
      if (s.flags.negativeFree) out.push(`${label}：游离浓度为负，读数低于标曲下限`);
      if (s.flags.negativeLnpRna && !s.flags.negativeTotal) {
        out.push(`${label}：游离浓度高于总浓度，LNP-RNA 为负`);
      }
    });
    return out;
  }, [display, batch, rows, experimentDate]);

  const outOfRange = (flag: string) => flag === "above" || flag === "below";

  const handleCopy = async (mode: CopyMode) => {
    try {
      await navigator.clipboard.writeText(
        buildResultTsv(rows, display, experimentDate, mode)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(
        mode === "key"
          ? "关键结果已复制，可直接粘贴回 Excel"
          : "全部结果已复制，可直接粘贴回 Excel"
      );
    } catch {
      toast.error("复制失败，浏览器拒绝了剪贴板访问");
    }
  };

  const corr = batch.correction;
  const corrected = corr.applied && showCorrected;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <ClipboardPaste className="h-3.5 w-3.5" />
          {rows.length} 个样本 · 两行读数支持从 Excel 直接粘贴（整行 / 整列 / 两行一起）
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onRowsChange([...rows, createBlankSample()])}
          >
            <Plus className="h-3.5 w-3.5" />
            添加样本
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            清空样本数据
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className={STICKY} />
              {rows.map((r, i) => (
                <th key={r.id} className="min-w-32 px-2 py-1 text-xs font-medium">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-muted-foreground">样本 {i + 1}</span>
                    <button
                      type="button"
                      title="删除此样本"
                      className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                      disabled={rows.length <= 1}
                      onClick={() =>
                        onRowsChange(rows.filter((q) => q.id !== r.id))
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y">
            {INPUT_ROWS.map((def) => (
              <tr key={def.field}>
                <td className={STICKY} title={def.title}>
                  <span className="flex items-center gap-1">
                    {def.label}
                    {def.required && <span className="text-destructive">*</span>}
                    {def.pasteHint && (
                      <ClipboardPaste
                        className="h-3 w-3 text-primary"
                        aria-label="可粘贴"
                      />
                    )}
                  </span>
                </td>
                {rows.map((r, i) => {
                  const c = computedById.get(r.id);
                  const flagged =
                    (def.field === "readTriton" &&
                      c &&
                      outOfRange(c.flags.tritonRange)) ||
                    (def.field === "readTe" &&
                      c &&
                      outOfRange(c.flags.teRange)) ||
                    (def.field === "dilution" && c?.flags.missingDilution);

                  const commonClass = `h-7 text-xs ${
                    def.type === "number" ? "font-mono" : ""
                  } ${
                    flagged
                      ? "border-amber-500 text-amber-600 dark:text-amber-400"
                      : ""
                  }`;

                  if (def.field === "dilution") {
                    return (
                      <td key={r.id} className="px-2 py-1">
                        <div className="relative">
                          <Input
                            type="number"
                            step="any"
                            value={r.dilution}
                            onChange={(e) =>
                              patch(r.id, "dilution", e.target.value)
                            }
                            onPaste={handlePaste("dilution", i)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key !== "ArrowUp" && e.key !== "ArrowDown")
                                return;
                              e.preventDefault();
                              patch(
                                r.id,
                                "dilution",
                                stepDilution(
                                  r.dilution,
                                  e.key === "ArrowUp" ? 1 : -1
                                )
                              );
                            }}
                            className={`${commonClass} pr-5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                          />
                          <span className="absolute right-0.5 top-0 flex h-7 flex-col justify-center">
                            <button
                              type="button"
                              tabIndex={-1}
                              title="上一档 (25/50/100/200/300/400/500)"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                patch(r.id, "dilution", stepDilution(r.dilution, 1))
                              }
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              tabIndex={-1}
                              title="下一档 (25/50/100/200/300/400/500)"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                patch(
                                  r.id,
                                  "dilution",
                                  stepDilution(r.dilution, -1)
                                )
                              }
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </span>
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={r.id} className="px-2 py-1">
                      <Input
                        type={def.type}
                        step={def.type === "number" ? "any" : undefined}
                        // Sample names show the auto value (date + index) as a
                        // real value, not a placeholder; clearing the box
                        // falls back to the auto name again.
                        value={
                          def.field === "name"
                            ? r.name || defaultSampleName(experimentDate, i)
                            : r[def.field]
                        }
                        placeholder={def.pasteHint ? "可粘贴" : undefined}
                        onChange={(e) => patch(r.id, def.field, e.target.value)}
                        onPaste={handlePaste(def.field, i)}
                        onFocus={(e) => e.target.select()}
                        className={commonClass}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr>
              <td
                colSpan={rows.length + 1}
                className="bg-muted/40 px-2 py-1.5 text-xs font-semibold"
              >
                <span className="flex items-center gap-2">
                  计算结果
                  {corr.applied &&
                    (corrected ? (
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500">
                        已按标准品校正 ×{corr.factor.toFixed(3)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">原始值（未校正）</Badge>
                    ))}
                </span>
              </td>
            </tr>

            {(
              [
                ["总浓度 (ng/µL)", (id: string) => fmt(computedById.get(id)?.total_ng_uL)],
                ["游离浓度 (ng/µL)", (id: string) => fmt(computedById.get(id)?.free_ng_uL)],
                [
                  "LNP-RNA 浓度 (ng/µL)",
                  (id: string) => fmt(computedById.get(id)?.lnpRna_ng_uL),
                ],
                ["包封率 (%)", (id: string) => fmt(computedById.get(id)?.ee_percent, 1)],
                ["得率 (%)", (id: string) => fmt(computedById.get(id)?.yield_percent, 1)],
                [
                  "取样体积 (µL)",
                  (id: string) => fmt(computedById.get(id)?.sampleVolume_uL),
                ],
              ] as [string, (id: string) => string][]
            ).map(([label, get]) => {
              const key = KEY_ROWS.has(label);
              return (
                <tr
                  key={label}
                  className={
                    key
                      ? `${KEY_BG} ${corrected ? "border-l-2 border-l-emerald-500" : ""}`
                      : ""
                  }
                >
                  <td
                    className={
                      key ? `${stickyCell(KEY_BG)} font-semibold` : STICKY
                    }
                  >
                    {label}
                  </td>
                  {rows.map((r) => {
                    const c = computedById.get(r.id);
                    const value = get(r.id);
                    const negative =
                      (label.startsWith("总浓度") && c?.flags.negativeTotal) ||
                      (label.startsWith("游离浓度") && c?.flags.negativeFree) ||
                      (label.startsWith("LNP-RNA") && c?.flags.negativeLnpRna);
                    // 取样体积 only counts as a headline number when it has one.
                    const emphasize = key && value !== "--";
                    return (
                      <td
                        key={r.id}
                        className={`px-2 py-1.5 text-right font-mono text-xs ${
                          negative
                            ? "text-amber-600 dark:text-amber-400"
                            : emphasize
                              ? "text-sm font-semibold text-primary"
                              : ""
                        }`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── 标准品校正 ───────────────────────────────── */}
      <div className="rounded-md border p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-primary"
            checked={correction.enabled}
            onChange={(e) =>
              onCorrectionChange({ ...correction, enabled: e.target.checked })
            }
          />
          标准品校正
        </label>

        {correction.enabled && (
          <>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">怎么填标准品</p>
              <p>
                1. 标准品必须是上表中的<strong>某一列样本</strong>——先把它当普通样本录进去，再在这里选中它。
              </p>
              <p>
                2. 该列<strong>必填稀释倍数</strong>，读数则
                <strong>只需填一个就够</strong>：填了 TE (1% Triton)
                就用它算（推荐，对应总浓度）；只填了 TE buffer
                也可以，会自动改用 TE 曲线；两个都填时优先用 Triton。
              </p>
              <p>
                3. 「已知浓度」填这支标准品<strong>标称的真实浓度</strong>（ng/µL）。
                校正系数 = 已知浓度 ÷ 该列实测浓度，会同时乘到<strong>所有样本</strong>
                的总浓度和游离浓度上。
              </p>
              <p>
                因为总浓度和游离浓度乘的是同一个系数，<strong>包封率不会变</strong>；
                得率按系数等比变化，取样体积按其倒数变化。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">标准品样本</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={correction.standardSampleId ?? ""}
                  onChange={(e) =>
                    onCorrectionChange({
                      ...correction,
                      standardSampleId: e.target.value || null,
                    })
                  }
                >
                  <option value="">— 请选择 —</option>
                  {rows.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      {effectiveSampleName(r, i, experimentDate)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  标准品已知浓度 (ng/µL)
                </label>
                <Input
                  type="number"
                  step="any"
                  value={correction.knownConc}
                  onChange={(e) =>
                    onCorrectionChange({
                      ...correction,
                      knownConc: e.target.value,
                    })
                  }
                  onFocus={(e) => e.target.select()}
                  placeholder="例如 10"
                  className="font-mono"
                />
              </div>
            </div>

            {corr.applied ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-emerald-300 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  校正系数{" "}
                  <span className="font-mono font-semibold">
                    {corr.factor.toFixed(4)}
                  </span>{" "}
                  = 已知 {correction.knownConc} ÷ 实测{" "}
                  <span className="font-mono">{fmt(corr.baseConc)}</span>
                  （取自 {corr.basis === "triton" ? "TE (1% Triton) 读数" : "TE buffer 读数"}）
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 text-xs"
                  onClick={() => onShowCorrectedChange(!showCorrected)}
                >
                  {showCorrected ? "查看原始值" : "查看校正值"}
                </Button>
              </div>
            ) : (
              <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {corr.reason === "no-sample" && "请选择一个标准品样本。"}
                {corr.reason === "no-known" && "请填写标准品的已知浓度（需大于 0）。"}
                {corr.reason === "no-reading" &&
                  "标准品需要填写稀释倍数，以及至少一个读数（TE (1% Triton) 或 TE buffer）。"}
                {corr.reason === "invalid-fit" && "对应的标准曲线尚未拟合成功。"}
                {corr.reason === "non-positive-base" &&
                  "标准品实测浓度不为正，无法计算校正系数。"}
                {corr.reason === "disabled" && "校正未生效。"}
              </p>
            )}
          </>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            结果可能不准确
          </p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
            {warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 导出 / 保存 ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              {copied ? (
                <CheckCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "已复制" : "复制结果"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleCopy("all")}>
              复制全部结果
              <span className="ml-auto pl-4 text-xs text-muted-foreground">
                含读数与稀释
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleCopy("key")}>
              只复制关键结果
              <span className="ml-auto pl-4 text-xs text-muted-foreground">
                浓度 / 包封率 / 得率 / 体积
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" className="gap-2" onClick={onExportXlsx}>
          <Sheet className="h-4 w-4" />
          导出 Excel
        </Button>

        <Button className="ml-auto gap-2" onClick={onSave}>
          <Save className="h-4 w-4" />
          保存实验记录
        </Button>
      </div>
    </div>
  );
}
