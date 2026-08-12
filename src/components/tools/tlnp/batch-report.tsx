"use client";

import { useMemo, useState } from "react";
import { FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ChromatogramChart from "./chromatogram-chart";
import {
  GroupedBarChart,
  LiverSpleenChart,
  SampleBarChart,
} from "./assay-charts";
import { describeMethod } from "@/lib/calculations/lnp-bench";
import {
  computeConjugationDose,
  findProtein,
  proteinName,
  systemName,
} from "@/lib/calculations/tlnp-conjugation";
import {
  INVITRO_READOUT_LABELS,
  invitroUnitLabel,
  PURIFICATION_METHOD_LABELS,
  resolveEe,
  serializeTlnpExperiment,
  summarizeBatch,
  summarizeInVitro,
  TEM_LABELS,
  type AssayDesign,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";
import { groupRoi, liverSpleenRatio } from "@/lib/calculations/tlnp-roi";
import { exportTlnpToXlsx } from "@/lib/export/tlnp-report-xlsx";

const n = (v: number | null, digits = 1): string =>
  v === null || !isFinite(v) ? "--" : v.toFixed(digits);

interface Props {
  batchName: string;
  createdAt: string;
  updatedAt: string;
  data: TlnpExperimentData;
}

/** Read-only view of the whole batch, plus the three export formats. */
export default function BatchReport({
  batchName,
  createdAt,
  updatedAt,
  data,
}: Props) {
  const [exporting, setExporting] = useState(false);
  const summary = useMemo(() => summarizeBatch(data), [data]);

  async function exportPdf() {
    setExporting(true);
    const toastId = toast.loading("PDF 生成中，请等待...");
    try {
      const mod = await import("@/lib/export/tlnp-report-pdf");
      await mod.exportTlnpToPdf(batchName, createdAt, updatedAt, data);
      toast.success("PDF 已导出", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("导出 PDF 失败", { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  function exportXlsx() {
    try {
      exportTlnpToXlsx(batchName, createdAt, updatedAt, data);
      toast.success("Excel 已生成");
    } catch (e) {
      console.error(e);
      toast.error("导出 Excel 失败");
    }
  }

  /** The only lossless format — re-importable, unlike the report exports. */
  function exportJson() {
    try {
      const blob = new Blob(
        [JSON.stringify(serializeTlnpExperiment(data), null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batchName.replace(/[\\/:*?"<>|]+/g, "_").trim() || "tlnp-batch"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("JSON 已导出");
    } catch (e) {
      console.error(e);
      toast.error("导出 JSON 失败");
    }
  }

  const systems = data.conjugation.systems.map((s, i) => ({
    system: s,
    name: systemName(s, i),
    protein: findProtein(data.conjugation.proteins, s.proteinId),
    dose: computeConjugationDose(
      s,
      findProtein(data.conjugation.proteins, s.proteinId)
    ),
    observation: data.conjugation.results.observations.find(
      (o) => o.systemId === s.id
    ),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">批次总览</CardTitle>
          <CardDescription>
            关键实验设计与结果。导出内容包含全部模块，JSON 为无损格式。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={exportPdf}
              disabled={exporting}
            >
              <FileText className="h-3.5 w-3.5" />
              {exporting ? "导出中..." : "导出 PDF"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={exportXlsx}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              导出 Excel
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={exportJson}
            >
              <FileJson className="h-3.5 w-3.5" />
              导出 JSON
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="样品" value={String(summary.sampleCount)} />
            <Stat label="抗体" value={String(summary.proteinCount)} />
            <Stat label="反应体系" value={String(summary.systemCount)} />
            <Stat label="平均粒径" value={`${n(summary.meanSize_nm)} nm`} />
            <Stat label="平均包封率" value={`${n(summary.meanEe_percent)} %`} />
            <Stat label="平均得率" value={`${n(summary.meanYield_percent)} %`} />
          </div>

          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="批次编号" value={data.meta.batchCode} mono />
            <Meta label="实验日期" value={data.meta.experimentDate} mono />
            <Meta label="负责人" value={data.meta.operator} />
            <Meta label="制备日期" value={data.prep.design.date} mono />
            <Meta label="偶联日期" value={data.conjugation.design.date} mono />
            <Meta label="纯化日期" value={data.purification.design.date} mono />
            <Meta label="阳离子脂质" value={summary.cationicLipid} />
            <Meta label="反应 linker" value={summary.linker} />
            <Meta label="Cargo" value={summary.cargo} />
            <Meta label="制备方法" value={summary.mixing} />
            <Meta
              label="溶剂置换"
              value={describeMethod(data.prep.design.solvent.method)}
            />
            <Meta
              label="纯化方式"
              value={
                data.purification.design.method
                  ? PURIFICATION_METHOD_LABELS[data.purification.design.method]
                  : ""
              }
            />
          </dl>

          {data.meta.objective.trim() !== "" && (
            <p className="rounded-md bg-muted/50 p-3 text-sm">
              <span className="font-medium">实验目的：</span>
              {data.meta.objective}
            </p>
          )}
        </CardContent>
      </Card>

      {data.prep.samples.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">样品与表征</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[40rem] border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-2 py-2 text-left font-medium">样品</th>
                    <th className="px-2 py-2 text-left font-medium">摩尔比</th>
                    <th className="px-2 py-2 text-left font-medium">
                      浓度 (ng/µL)
                    </th>
                    <th className="px-2 py-2 text-left font-medium">包封率 %</th>
                    <th className="px-2 py-2 text-left font-medium">得率 %</th>
                    <th className="px-2 py-2 text-left font-medium">粒径 nm</th>
                    <th className="px-2 py-2 text-left font-medium">PDI</th>
                    <th className="px-2 py-2 text-left font-medium">TEM</th>
                  </tr>
                </thead>
                <tbody>
                  {data.prep.samples.map((s, i) => {
                    const ee = resolveEe(s.ee);
                    return (
                      <tr key={s.id} className="border-b last:border-b-0">
                        <td className="px-2 py-1.5">{s.name || `样品 ${i + 1}`}</td>
                        <td className="px-2 py-1.5 font-mono">
                          {s.lipidEntries.map((e) => e.molarRatio || "0").join(":")}
                        </td>
                        <td className="px-2 py-1.5 font-mono">{n(ee.conc, 2)}</td>
                        <td className="px-2 py-1.5 font-mono">{n(ee.ee)}</td>
                        <td className="px-2 py-1.5 font-mono">{n(ee.yield_)}</td>
                        <td className="px-2 py-1.5 font-mono">
                          {s.dls.size_nm || "--"}
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {s.dls.pdi || "--"}
                        </td>
                        <td className="px-2 py-1.5">
                          {s.tem === "" ? "--" : TEM_LABELS[s.tem]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {(systems.length > 0 || data.conjugation.proteins.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">偶联反应</CardTitle>
            <CardDescription>
              {systems.length} 个反应体系 · {data.conjugation.proteins.length} 个抗体
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.conjugation.proteins.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[48rem] border-collapse text-xs">
                  <thead><tr className="border-b bg-muted/40"><th className="px-2 py-2 text-left font-medium">抗体</th><th className="px-2 py-2 text-left font-medium">来源</th><th className="px-2 py-2 text-left font-medium">表达载体</th><th className="px-2 py-2 text-left font-medium">表达日期</th><th className="px-2 py-2 text-left font-medium">浓度</th><th className="px-2 py-2 text-left font-medium">备注</th></tr></thead>
                  <tbody>{data.conjugation.proteins.map((protein, index) => <tr key={protein.id} className="border-b last:border-b-0"><td className="px-2 py-1.5">{proteinName(protein, index)}</td><td className="px-2 py-1.5">{protein.source || "--"}</td><td className="px-2 py-1.5">{protein.expressionSystem || "--"}</td><td className="px-2 py-1.5 font-mono">{protein.expressionDate || "--"}</td><td className="px-2 py-1.5 font-mono">{protein.conc ? `${protein.conc} ${protein.concUnit === "uM" ? "µM" : "mg/mL"}` : "--"}</td><td className="px-2 py-1.5 text-muted-foreground">{protein.note || "--"}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {systems.length > 0 && <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[62rem] border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-2 py-2 text-left font-medium">反应体系</th>
                    <th className="px-2 py-2 text-left font-medium">抗体</th>
                    <th className="px-2 py-2 text-left font-medium">
                      linker:抗体
                    </th>
                    <th className="px-2 py-2 text-left font-medium">
                      投料 RNA µg
                    </th>
                    <th className="px-2 py-2 text-left font-medium">LNP µL</th>
                    <th className="px-2 py-2 text-left font-medium">抗体 µL</th>
                    <th className="px-2 py-2 text-left font-medium">
                      buffer µL
                    </th>
                    <th className="px-2 py-2 text-left font-medium">总 µL</th>
                    <th className="px-2 py-2 text-left font-medium">反应条件</th>
                    <th className="px-2 py-2 text-left font-medium">外观</th>
                  </tr>
                </thead>
                <tbody>
                  {systems.map((row) => (
                    <tr key={row.system.id} className="border-b last:border-b-0">
                      <td className="px-2 py-1.5">{row.name}</td>
                      <td className="px-2 py-1.5">
                        {proteinName(row.protein) || "--"}
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {row.system.molarRatio ? `1:${row.system.molarRatio}` : "--"}
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {n(row.dose.rnaMass_ug, 2)}
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {n(row.dose.lnpVolume_uL)}
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {n(row.dose.proteinVolume_uL)}
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {n(row.dose.bufferVolume_uL)}
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {n(row.dose.totalVolume_uL)}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {[
                          row.system.temperature,
                          row.system.duration,
                          row.system.shaking,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "--"}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {row.observation?.turbidity === "turbid"
                          ? "浑浊"
                          : row.observation?.turbidity === "slight"
                            ? "微浑"
                            : row.observation?.turbidity === "clear"
                              ? "澄清"
                              : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </CardContent>
        </Card>
      )}

      {data.purification.results.systems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">纯化后表征</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[40rem] border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-2 py-2 text-left font-medium">反应体系</th>
                    <th className="px-2 py-2 text-left font-medium">
                      浓度 (ng/µL)
                    </th>
                    <th className="px-2 py-2 text-left font-medium">包封率 %</th>
                    <th className="px-2 py-2 text-left font-medium">得率 %</th>
                    <th className="px-2 py-2 text-left font-medium">粒径 nm</th>
                    <th className="px-2 py-2 text-left font-medium">PDI</th>
                    <th className="px-2 py-2 text-left font-medium">Zeta mV</th>
                    <th className="px-2 py-2 text-left font-medium">TEM</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conjugation.systems.map((sys, i) => {
                    const r = data.purification.results.systems.find(
                      (x) => x.systemId === sys.id
                    );
                    if (!r) return null;
                    const ee = resolveEe(r.ee);
                    return (
                      <tr key={sys.id} className="border-b last:border-b-0">
                        <td className="px-2 py-1.5">{systemName(sys, i)}</td>
                        <td className="px-2 py-1.5 font-mono">{n(ee.conc, 2)}</td>
                        <td className="px-2 py-1.5 font-mono">{n(ee.ee)}</td>
                        <td className="px-2 py-1.5 font-mono">{n(ee.yield_)}</td>
                        <td className="px-2 py-1.5 font-mono">
                          {r.dls.size_nm || "--"}
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {r.dls.pdi || "--"}
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {r.dls.zeta_mV || "--"}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.tem === "" ? "--" : TEM_LABELS[r.tem]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.purification.chromatograms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">层析结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {data.purification.chromatograms.map((c) => (
              <div key={c.id} className="space-y-2">
                <p className="text-sm font-medium">{c.name}</p>
                <ChromatogramChart chromatogram={c} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AssaySection data={data} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">讨论记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Discussion label="LNP 制备" text={data.prep.results.discussion} />
          <Discussion label="偶联反应" text={data.conjugation.results.discussion} />
          <Discussion label="LNP 纯化" text={data.purification.results.discussion} />
          <Discussion label="体外实验" text={data.assay.invitro.results.discussion} />
          <Discussion label="体内实验" text={data.assay.invivo.results.discussion} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Module 4, read-only: each arm's parameter bench plus its own chart.
 *
 * The charts are the same components module 4 edits with, not a second
 * rendering — a report that redrew the data its own way would be a report that
 * could disagree with the page it summarises.
 */
function AssaySection({ data }: { data: TlnpExperimentData }) {
  const vitro = data.assay.invitro;
  const vivo = data.assay.invivo;
  const stats = useMemo(
    () => summarizeInVitro(vitro.results),
    [vitro.results]
  );
  const runs = useMemo(
    () =>
      vivo.results.runs
        .filter((r) => r.rows.length > 0)
        .map((r) => ({
          run: r,
          grouped: groupRoi(r.rows),
          ratio: liverSpleenRatio(r.rows),
        })),
    [vivo.results.runs]
  );

  const hasVitro = stats.some((s) => s.mean !== null);
  const hasVivo = runs.length > 0;
  const vitroDesign = vitro.design.params.some((p) => p.value.trim() !== "");
  const vivoDesign = vivo.design.params.some((p) => p.value.trim() !== "");
  if (!hasVitro && !hasVivo && !vitroDesign && !vivoDesign) return null;

  const unit = invitroUnitLabel(vitro.results);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">体内外实验</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {(vitroDesign || hasVitro) && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              体外
              {vitro.design.date && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {vitro.design.date}
                </span>
              )}
            </p>
            <ParamGrid design={vitro.design} />
            {hasVitro && (
              <div className="max-w-md">
                <SampleBarChart
                  stats={stats}
                  unit={unit}
                  title={`${INVITRO_READOUT_LABELS[vitro.results.readout]}（${unit}）`}
                />
              </div>
            )}
          </div>
        )}

        {(vivoDesign || hasVivo) && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              体内
              {vivo.design.date && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {vivo.design.date}
                </span>
              )}
            </p>
            <ParamGrid design={vivo.design} />
            {runs.map(({ run, grouped, ratio }) => (
              <div key={run.id} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {run.name}
                  {run.note.trim() && ` · ${run.note}`}
                </p>
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParamGrid({ design }: { design: AssayDesign }) {
  const filled = design.params.filter((p) => p.value.trim() !== "");
  if (filled.length === 0) return null;
  return (
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {filled.map((p) => (
        <Meta key={p.id} label={p.label} value={p.value} />
      ))}
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={`truncate ${mono ? "font-mono text-xs" : ""}`}>
        {value || "--"}
      </dd>
    </div>
  );
}

function Discussion({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}
