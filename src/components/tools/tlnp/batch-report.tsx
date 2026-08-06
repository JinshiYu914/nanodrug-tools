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
import ConjugationMapStatic from "./conjugation-map-static";
import { describeMethod } from "@/lib/calculations/lnp-bench";
import { productName } from "@/lib/calculations/tlnp-conjugation";
import {
  PURIFICATION_METHOD_LABELS,
  resolveEe,
  serializeTlnpExperiment,
  summarizeBatch,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";
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

  const products = data.conjugation.products.map((p) => ({
    id: p.id,
    name: productName(
      p,
      data.prep.samples.find((s) => s.id === p.sampleId)?.name ?? "",
      data.conjugation.conditions.find((c) => c.id === p.conditionId)?.name ?? ""
    ),
    observation: data.conjugation.results.observations.find(
      (o) => o.productId === p.id
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
            <Stat label="反应条件" value={String(summary.conditionCount)} />
            <Stat label="tLNP 产物" value={String(summary.productCount)} />
            <Stat label="平均粒径" value={`${n(summary.meanSize_nm)} nm`} />
            <Stat label="平均包封率" value={`${n(summary.meanEe_percent)} %`} />
            <Stat label="平均得率" value={`${n(summary.meanYield_percent)} %`} />
          </div>

          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="批次编号" value={data.meta.batchCode} mono />
            <Meta label="实验日期" value={data.meta.experimentDate} mono />
            <Meta label="负责人" value={data.meta.operator} />
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.conjugation.nodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">偶联关系</CardTitle>
            <CardDescription>
              {products.length} 个 tLNP 产物
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-lg border p-3">
              <ConjugationMapStatic
                nodes={data.conjugation.nodes}
                edges={data.conjugation.edges}
              />
            </div>
            {products.length > 0 && (
              <ul className="grid gap-1 sm:grid-cols-2">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-baseline justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-xs"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {p.observation?.turbidity === "turbid"
                        ? "浑浊"
                        : p.observation?.turbidity === "slight"
                          ? "微浑"
                          : p.observation?.turbidity === "clear"
                            ? "澄清"
                            : "--"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
