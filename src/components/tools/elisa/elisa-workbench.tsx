"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type PointerEvent,
} from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Beaker,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  CloudOff,
  Copy,
  Download,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ELISA_FIT_METHODS,
  calculateElisaSample,
  createBlankSample,
  createInitialSamples,
  createInitialStandardPoints,
  elisaResultsToTsv,
  fitElisaCurve,
  fitParameterRows,
  formatNumber,
  parseClipboardMatrix,
  parsePlateClipboard,
  standardPointMean,
  stepElisaDilution,
  type ElisaFitMethod,
  type ElisaSampleRow,
  type ElisaStandardPoint,
} from "@/lib/calculations/elisa";
import ElisaCurveChart from "./curve-chart";

const UNIT_OPTIONS = ["pg/mL", "ng/mL", "µg/mL", "ng/L"] as const;
const STANDARD_FIELDS = ["concentration", "od1", "od2", "od3"] as const;
const SAMPLE_FIELDS = ["group", "od", "dilution"] as const;
const MAX_SAMPLES = 384;

function localDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeLabel(range: ReturnType<typeof calculateElisaSample>["range"]) {
  if (range === "within") return "范围内";
  if (range === "below") return "低于标曲";
  if (range === "above") return "高于标曲";
  return "--";
}

export default function ElisaWorkbench() {
  const [experimentName, setExperimentName] = useState("");
  const [operator, setOperator] = useState("");
  const [experimentDate, setExperimentDate] = useState(localDateString);
  const [unitChoice, setUnitChoice] = useState<string>("pg/mL");
  const [customUnit, setCustomUnit] = useState("");
  const [fitMethod, setFitMethod] = useState<ElisaFitMethod>("four-pl");
  const [standards, setStandards] = useState<ElisaStandardPoint[]>(createInitialStandardPoints);
  const [samples, setSamples] = useState<ElisaSampleRow[]>(() => createInitialSamples(80));
  const [batchCount, setBatchCount] = useState("8");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [plateDialogOpen, setPlateDialogOpen] = useState(false);
  const [plateText, setPlateText] = useState("");
  const [exporting, setExporting] = useState(false);
  const curvePreviewRef = useRef<HTMLDivElement>(null);
  const dragAnchor = useRef<number | null>(null);
  const dragBase = useRef<Set<string>>(new Set());

  const concentrationUnit = unitChoice === "custom" ? customUnit.trim() || "自定义单位" : unitChoice;
  const fit = useMemo(() => fitElisaCurve(standards, fitMethod), [standards, fitMethod]);
  const results = useMemo(
    () => samples.map((sample) => calculateElisaSample(sample, fit)),
    [samples, fit]
  );
  const importedPlateValues = useMemo(() => parsePlateClipboard(plateText), [plateText]);
  const completedSamples = samples.filter((sample) => sample.od.trim() !== "").length;
  const outOfRangeSamples = results.filter(
    (result) => result.range === "above" || result.range === "below"
  ).length;

  useEffect(() => {
    const stopDragging = () => {
      dragAnchor.current = null;
    };
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("blur", stopDragging);
    return () => {
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("blur", stopDragging);
    };
  }, []);

  const patchStandard = (id: string, field: keyof ElisaStandardPoint, value: string) => {
    setStandards((current) =>
      current.map((point) => (point.id === id ? { ...point, [field]: value } : point))
    );
  };

  const patchSample = (id: string, field: keyof ElisaSampleRow, value: string) => {
    setSamples((current) =>
      current.map((sample) => (sample.id === id ? { ...sample, [field]: value } : sample))
    );
  };

  const handleStandardPaste = (
    event: ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startField: number
  ) => {
    const matrix = parseClipboardMatrix(event.clipboardData.getData("text/plain"));
    if (matrix.length === 0 || (matrix.length === 1 && matrix[0].length === 1)) return;
    event.preventDefault();
    const written = matrix.reduce((count, row, rowOffset) => {
      if (startRow + rowOffset >= standards.length) return count;
      return count + Math.min(row.length, STANDARD_FIELDS.length - startField);
    }, 0);
    setStandards((current) => {
      const next = current.map((point) => ({ ...point }));
      matrix.forEach((row, rowOffset) => {
        const targetRow = startRow + rowOffset;
        if (!next[targetRow]) return;
        row.forEach((value, columnOffset) => {
          const field = STANDARD_FIELDS[startField + columnOffset];
          if (!field) return;
          next[targetRow][field] = value;
        });
      });
      return next;
    });
    toast.success(`已粘贴 ${written} 个标准曲线单元格`);
  };

  const applySampleMatrix = (matrix: string[][], startRow: number, startField: number) => {
    if (matrix.length === 0) return 0;
    const requiredRows = Math.min(MAX_SAMPLES, startRow + matrix.length);
    const written = matrix.reduce((count, row, rowOffset) => {
      if (startRow + rowOffset >= MAX_SAMPLES) return count;
      return count + Math.min(row.length, SAMPLE_FIELDS.length - startField);
    }, 0);
    setSamples((current) => {
      const next = current.map((sample) => ({ ...sample }));
      while (next.length < requiredRows) next.push(createBlankSample(next.length));
      matrix.forEach((row, rowOffset) => {
        const targetRow = startRow + rowOffset;
        if (!next[targetRow] || targetRow >= MAX_SAMPLES) return;
        row.forEach((value, columnOffset) => {
          const field = SAMPLE_FIELDS[startField + columnOffset];
          if (!field) return;
          next[targetRow][field] = value;
        });
      });
      return next;
    });
    return written;
  };

  const handleSamplePaste = (
    event: ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startField: number
  ) => {
    const matrix = parseClipboardMatrix(event.clipboardData.getData("text/plain"));
    if (matrix.length === 0 || (matrix.length === 1 && matrix[0].length === 1)) return;
    event.preventDefault();
    const written = applySampleMatrix(matrix, startRow, startField);
    toast.success(`已从第 ${startRow + 1} 行开始粘贴 ${written} 个单元格`);
  };

  const addSamples = () => {
    const requested = Math.max(1, Math.floor(Number(batchCount) || 1));
    const available = MAX_SAMPLES - samples.length;
    const count = Math.min(requested, available);
    if (count <= 0) {
      toast.warning(`最多支持 ${MAX_SAMPLES} 个样本`);
      return;
    }
    setSamples((current) => [
      ...current,
      ...Array.from({ length: count }, (_, index) => createBlankSample(current.length + index)),
    ]);
    toast.success(`已添加 ${count} 行样本`);
  };

  const deleteSelected = () => {
    if (selected.size === 0) {
      toast.info("请在序号列按住鼠标并上下拖动选择样本");
      return;
    }
    setSamples((current) => current.filter((sample) => !selected.has(sample.id)));
    toast.success(`已删除 ${selected.size} 行样本`);
    setSelected(new Set());
  };

  const resetSamples = () => {
    setSamples(createInitialSamples(80));
    setSelected(new Set());
    toast.success("样本区已重置为 80 行空白数据");
  };

  const fillDilutionFromFirst = () => {
    const seed = samples.find((sample) => sample.dilution.trim() !== "");
    if (!seed) {
      toast.info("请先填写一个稀释倍数");
      return;
    }
    setSamples((current) => current.map((sample) => ({ ...sample, dilution: seed.dilution })));
    toast.success(`已用 ${seed.dilution} 填满稀释倍数列`);
  };

  const applyPlateValues = (values: string[]) => {
    if (values.length === 0) return;
    const matrix = values.slice(0, MAX_SAMPLES).map((value) => [value]);
    const written = applySampleMatrix(matrix, 0, 1);
    if (values.length > MAX_SAMPLES) toast.warning(`超过 ${MAX_SAMPLES} 个样本的数值已忽略`);
    return written;
  };

  const importPlate = () => {
    if (importedPlateValues.length === 0) {
      toast.error("没有识别到可导入的数据");
      return;
    }
    const written = applyPlateValues(importedPlateValues) ?? 0;
    setPlateDialogOpen(false);
    setPlateText("");
    toast.success(`已按列导入 ${written} 个 OD450 数值`);
  };

  const selectThrough = (index: number) => {
    if (dragAnchor.current === null) return;
    const start = Math.min(dragAnchor.current, index);
    const end = Math.max(dragAnchor.current, index);
    const next = new Set(dragBase.current);
    for (let row = start; row <= end; row++) {
      if (samples[row]) next.add(samples[row].id);
    }
    setSelected(next);
  };

  const beginDragSelection = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragAnchor.current = index;
    dragBase.current = event.metaKey || event.ctrlKey ? new Set(selected) : new Set();
    selectThrough(index);
  };

  const exportXlsx = async () => {
    if (!fit.valid) {
      toast.error("请先完成有效的标准曲线拟合");
      return;
    }
    const chartSvg = curvePreviewRef.current?.querySelector("svg");
    if (!chartSvg) {
      toast.error("未找到标准曲线图，请刷新页面后重试");
      return;
    }
    setExporting(true);
    try {
      const mod = await import("@/lib/export/elisa-xlsx");
      await mod.exportElisaToXlsx({
        experimentName,
        experimentDate,
        operator,
        concentrationUnit,
        standards,
        samples,
        fit,
        chartSvg,
      });
      toast.success("ELISA Excel 已生成，已包含拟合图");
    } catch (error) {
      console.error(error);
      toast.error("Excel 生成失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  const copyResults = async () => {
    if (!fit.valid || completedSamples === 0) {
      toast.error("请先完成标曲并输入样本 OD450");
      return;
    }
    try {
      await navigator.clipboard.writeText(elisaResultsToTsv(samples, fit, concentrationUnit));
      toast.success(`已复制 ${completedSamples} 行结果，可直接粘贴到 Excel`);
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限");
    }
  };

  return (
    <div className="mx-auto max-w-[1080px] space-y-10 px-4 py-8 sm:px-6 lg:py-10">
      <header className="border-b pb-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Beaker className="h-4 w-4" />Laboratory Tools
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">ELISA计算</h1>
          <p className="mt-2 text-sm text-muted-foreground">8 点标准曲线拟合与样本浓度反算。</p>
        </div>
      </header>

      <section aria-labelledby="experiment-settings" className="space-y-4">
        <div>
          <h2 id="experiment-settings" className="font-display text-xl font-bold">实验信息</h2>
          <p className="mt-1 text-sm text-muted-foreground">随标准曲线和样本结果一起导出。</p>
        </div>
        <div className="flex max-w-[900px] flex-wrap gap-x-4 gap-y-4 border-y py-5">
          <div className="w-full space-y-2 sm:w-[280px]">
            <Label htmlFor="experiment-name">实验名称</Label>
            <Input
              id="experiment-name"
              value={experimentName}
              onChange={(event) => setExperimentName(event.target.value)}
              placeholder="例如：IL-6 ELISA"
            />
          </div>
          <div className="w-full space-y-2 sm:w-[240px]">
            <Label htmlFor="operator">实验人</Label>
            <Input
              id="operator"
              value={operator}
              onChange={(event) => setOperator(event.target.value)}
              placeholder="姓名或实验人员编号"
            />
          </div>
          <div className="w-full space-y-2 sm:w-[180px]">
            <Label htmlFor="experiment-date">实验日期</Label>
            <Input
              id="experiment-date"
              type="date"
              value={experimentDate}
              onChange={(event) => setExperimentDate(event.target.value)}
            />
          </div>
          <div className={cn("w-full space-y-2", unitChoice === "custom" ? "sm:w-[360px]" : "sm:w-[200px]")}>
            <Label htmlFor="concentration-unit">浓度单位</Label>
            <div className="flex gap-2">
              <select
                id="concentration-unit"
                value={unitChoice}
                onChange={(event) => setUnitChoice(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                <option value="custom">自定义…</option>
              </select>
              {unitChoice === "custom" && (
                <Input
                  value={customUnit}
                  onChange={(event) => setCustomUnit(event.target.value)}
                  placeholder="如 IU/mL"
                  className="w-32"
                  aria-label="自定义浓度单位"
                />
              )}
            </div>
          </div>
          <div className="w-full space-y-2 sm:w-[400px]">
            <Label htmlFor="fit-method">标准曲线拟合方法</Label>
            <select
              id="fit-method"
              value={fitMethod}
              onChange={(event) => setFitMethod(event.target.value as ElisaFitMethod)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              {ELISA_FIT_METHODS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {ELISA_FIT_METHODS.find((method) => method.value === fitMethod)?.description}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="standard-curve" className="space-y-5 border-t pt-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="standard-curve" className="font-display text-xl font-bold">1. 标准曲线</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <ClipboardPaste className="h-3.5 w-3.5 text-primary" />可从任意输入格粘贴 Excel 多行、多列数据（推荐 8 行 × 4 列）。
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStandards(createInitialStandardPoints())}>
            <RotateCcw className="h-3.5 w-3.5" />清空
          </Button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,610px)_minmax(0,1fr)]">
          <div className="overflow-x-auto rounded-xl border bg-background">
            <table className="w-full min-w-[590px] table-fixed border-collapse text-xs">
              <thead className="bg-muted/35 text-muted-foreground">
                <tr>
                  <th className="w-12 border-b px-2 py-2.5 text-center font-medium">点</th>
                  <th className="w-28 border-b px-2 py-2.5 text-left font-medium">浓度 ({concentrationUnit})</th>
                  <th className="w-24 border-b px-2 py-2.5 text-left font-medium">OD450-1</th>
                  <th className="w-24 border-b px-2 py-2.5 text-left font-medium">OD450-2</th>
                  <th className="w-24 border-b px-2 py-2.5 text-left font-medium">OD450-3</th>
                  <th className="w-24 border-b px-2 py-2.5 text-right font-medium">平均值</th>
                </tr>
              </thead>
              <tbody>
                {standards.map((point, rowIndex) => (
                  <tr key={point.id} className="border-b last:border-b-0 hover:bg-muted/15">
                    <td className="px-2 py-1.5 text-center font-mono text-muted-foreground">{rowIndex + 1}</td>
                    {STANDARD_FIELDS.map((field, fieldIndex) => (
                      <td key={field} className="px-1.5 py-1">
                        <Input
                          inputMode="decimal"
                          value={point[field]}
                          onChange={(event) => patchStandard(point.id, field, event.target.value)}
                          onPaste={(event) => handleStandardPaste(event, rowIndex, fieldIndex)}
                          onFocus={(event) => event.target.select()}
                          className="h-7 bg-background px-2 text-right font-mono text-xs"
                          aria-label={`标准点 ${rowIndex + 1} ${field}`}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">
                      {formatNumber(standardPointMean(point), 5)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="min-w-0 space-y-3 rounded-xl border bg-background p-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <p className="text-sm font-semibold">拟合预览</p>
              <span className="text-xs text-muted-foreground">
                {ELISA_FIT_METHODS.find((method) => method.value === fitMethod)?.label}
              </span>
            </div>
            <div ref={curvePreviewRef}>
              <ElisaCurveChart points={standards} fit={fit} unit={concentrationUnit} />
            </div>
            <div className="space-y-2 rounded-md bg-muted/45 p-3">
              <p className="break-words font-mono text-xs leading-5">{fit.equation}</p>
              <p className="text-xs text-muted-foreground">
                R² = <span className="font-mono text-foreground">{fit.valid ? fit.r2.toFixed(5) : "--"}</span>
                {fit.valid && (
                  <>
                    {" · "}{fit.n} 点 · OD 范围{" "}
                    <span className="font-mono text-foreground">
                      {formatNumber(fit.minOd, 4)}–{formatNumber(fit.maxOd, 4)}
                    </span>
                  </>
                )}
              </p>
              {fit.valid && fitParameterRows(fit).length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 text-xs">
                  {fitParameterRows(fit).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!fit.valid && (
              <p className="flex items-start gap-1.5 px-1 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {fit.method === "four-pl" ? "至少填写 4 个标准点后开始拟合。" : "至少填写 2 个标准点后开始拟合。"}
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="sample-results" className="space-y-5 border-t pt-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 id="sample-results" className="font-display text-xl font-bold">2. 样本结果</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {samples.length} 行 · 已输入 {completedSamples} 个 OD450
              {outOfRangeSamples > 0 ? ` · ${outOfRangeSamples} 个超出标曲` : ""}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClipboardPaste className="h-3.5 w-3.5 text-primary" />可粘贴单列或“分组 / OD450 / 稀释倍数”多列表格。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPlateDialogOpen(true)}>
              <ClipboardPaste className="h-3.5 w-3.5" />粘贴 96 孔板
            </Button>
            <div className="flex items-center gap-1 rounded-md border bg-background p-1">
              <Input
                value={batchCount}
                onChange={(event) => setBatchCount(event.target.value)}
                inputMode="numeric"
                aria-label="批量添加行数"
                className="h-7 w-14 border-0 px-2 text-center shadow-none"
              />
              <Button variant="ghost" size="xs" onClick={addSamples}>
                <Plus className="h-3 w-3" />添加行
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={deleteSelected} disabled={selected.size === 0}>
              <Trash2 className="h-3.5 w-3.5" />删除已选{selected.size > 0 ? ` ${selected.size}` : ""}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetSamples}>
              <RotateCcw className="h-3.5 w-3.5" />重置
            </Button>
          </div>
        </div>

        {!fit.valid && (
          <div className="flex items-center gap-2 border-y border-warning/25 bg-warning-subtle/55 px-3 py-2 text-sm text-warning-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />完成标准曲线后，样本浓度会自动计算。
          </div>
        )}

        <div className="max-h-[720px] overflow-auto rounded-xl border bg-background">
          <table className="w-full min-w-[940px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
              <tr className="text-xs text-muted-foreground">
                <th className="w-24 px-2 py-3 text-center font-medium">
                  <button
                    type="button"
                    className="rounded px-2 py-1 hover:bg-muted"
                    onClick={() =>
                      setSelected(
                        selected.size === samples.length ? new Set() : new Set(samples.map((sample) => sample.id))
                      )
                    }
                  >
                    序号{selected.size > 0 ? ` · ${selected.size}` : ""}
                  </button>
                </th>
                <th className="min-w-48 px-3 py-3 text-left font-medium">分组（选填）</th>
                <th className="w-36 px-3 py-3 text-right font-medium">原始 OD450</th>
                <th className="w-40 px-3 py-3 text-right font-medium">
                  <span className="flex items-center justify-end gap-1.5">
                    稀释倍数
                    <button
                      type="button"
                      title="用第一个已填值填满整列"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                      onClick={fillDilutionFromFirst}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </th>
                <th className="w-44 bg-success-subtle/45 px-3 py-3 text-right font-medium">标曲反算浓度</th>
                <th className="w-48 bg-success-subtle/45 px-3 py-3 text-right font-medium">终浓度 ({concentrationUnit})</th>
                <th className="w-28 px-3 py-3 text-center font-medium">范围</th>
                <th className="w-12 px-3 py-3"><span className="sr-only">删除</span></th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample, index) => {
                const result = results[index];
                const outOfRange = result.range === "above" || result.range === "below";
                const isSelected = selected.has(sample.id);
                return (
                  <tr key={sample.id} className={cn("border-b last:border-b-0 hover:bg-muted/15", isSelected && "bg-primary/8")}>
                    <td className="p-0 text-center">
                      <button
                        type="button"
                        aria-label={`拖动选择样本 ${index + 1}`}
                        aria-pressed={isSelected}
                        onPointerDown={(event) => beginDragSelection(event, index)}
                        onPointerEnter={(event) => {
                          if (event.buttons === 1) selectThrough(index);
                        }}
                        className={cn(
                          "flex h-11 w-full touch-none select-none items-center justify-center gap-1 font-mono text-xs text-muted-foreground",
                          "cursor-ns-resize hover:bg-muted/60",
                          isSelected && "bg-primary/12 font-semibold text-primary"
                        )}
                        title="按住鼠标并上下拖动，可连续选择多行"
                      >
                        <GripVertical className="h-3.5 w-3.5" />{index + 1}
                      </button>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={sample.group}
                        onChange={(event) => patchSample(sample.id, "group", event.target.value)}
                        onPaste={(event) => handleSamplePaste(event, index, 0)}
                        placeholder="如 Control"
                        className="h-8 bg-background"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={sample.od}
                        onChange={(event) => patchSample(sample.id, "od", event.target.value)}
                        onPaste={(event) => handleSamplePaste(event, index, 1)}
                        onFocus={(event) => event.target.select()}
                        inputMode="decimal"
                        className={cn("h-8 bg-background text-right font-mono", outOfRange && "border-warning bg-warning-subtle")}
                        aria-label={`样本 ${index + 1} 原始 OD450`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="relative">
                        <Input
                          value={sample.dilution}
                          onChange={(event) => patchSample(sample.id, "dilution", event.target.value)}
                          onPaste={(event) => handleSamplePaste(event, index, 2)}
                          onFocus={(event) => event.target.select()}
                          onKeyDown={(event) => {
                            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                            event.preventDefault();
                            patchSample(
                              sample.id,
                              "dilution",
                              stepElisaDilution(sample.dilution, event.key === "ArrowUp" ? 1 : -1)
                            );
                          }}
                          inputMode="decimal"
                          className="h-8 bg-background pr-6 text-right font-mono"
                          aria-label={`样本 ${index + 1} 稀释倍数`}
                        />
                        <span className="absolute right-1 top-0 flex h-8 flex-col justify-center">
                          <button
                            type="button"
                            tabIndex={-1}
                            title="增大到下一档"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => patchSample(sample.id, "dilution", stepElisaDilution(sample.dilution, 1))}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            tabIndex={-1}
                            title="减小到上一档"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => patchSample(sample.id, "dilution", stepElisaDilution(sample.dilution, -1))}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </span>
                      </div>
                    </td>
                    <td className="bg-success-subtle/20 px-3 py-1.5 text-right font-mono">
                      {formatNumber(result.measuredConcentration, 6)}
                    </td>
                    <td className="bg-success-subtle/20 px-3 py-1.5 text-right font-mono font-semibold">
                      {formatNumber(result.finalConcentration, 6)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {result.range === "within" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" />范围内
                        </span>
                      ) : outOfRange ? (
                        <span className="inline-flex items-center gap-1 text-xs text-warning">
                          <AlertTriangle className="h-3.5 w-3.5" />{rangeLabel(result.range)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          setSamples((current) => current.filter((row) => row.id !== sample.id));
                          setSelected((current) => {
                            const next = new Set(current);
                            next.delete(sample.id);
                            return next;
                          });
                        }}
                        aria-label={`删除样本 ${index + 1}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {samples.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">没有样本行，请使用“添加行”创建。</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">提示：在左侧序号列按住鼠标并向上或向下拖动，可连续选择多行。</p>
      </section>

      <footer className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CloudOff className="h-3.5 w-3.5" />仅导出当前页面数据，不会保存到云端。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 sm:min-w-32"
            onClick={copyResults}
            disabled={!fit.valid || completedSamples === 0}
          >
            <Copy className="h-4 w-4" />复制结果
          </Button>
          <Button className="gap-2 sm:min-w-40" onClick={exportXlsx} disabled={!fit.valid || exporting}>
            <Download className="h-4 w-4" />{exporting ? "正在生成…" : "导出 Excel"}
          </Button>
        </div>
      </footer>

      <Dialog open={plateDialogOpen} onOpenChange={setPlateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>粘贴 96 孔板 OD450 矩阵</DialogTitle>
            <DialogDescription>
              从 Excel 或酶标仪软件复制 8 × 12 矩阵。系统按列展开：A1 → B1 → … → H1 → A2；超过现有行数时会自动补行。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={plateText}
            onChange={(event) => setPlateText(event.target.value)}
            placeholder={"0.121\t0.182\t0.245\n0.118\t0.176\t0.239\n…"}
            className="min-h-64 resize-y font-mono text-xs"
            autoFocus
          />
          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">识别结果</span>
            <span className="font-medium">{importedPlateValues.length} 个非空数值</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlateDialogOpen(false)}>取消</Button>
            <Button onClick={importPlate} disabled={importedPlateValues.length === 0}>按列导入 OD450</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
