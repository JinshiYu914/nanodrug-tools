"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  computeBenchFormulation,
  type BenchComputed,
} from "@/lib/calculations/lnp-bench";
import { formatVolume } from "@/lib/calculations/lnp-formula";
import type { TlnpPrepSample } from "@/lib/calculations/tlnp-experiment";
import { exportBenchToXlsx } from "@/lib/export/lnp-bench-xlsx";
import type { LipidEntry } from "@/lib/calculations/lnp-formula";

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

function entryName(e: LipidEntry): string {
  return (e.isCustomLipid ? e.customLipidName : e.lipidName) || e.label;
}

/** Non-blocking: a half-entered sample should still show what it can. */
function warningsFor(s: TlnpPrepSample, c: BenchComputed): string[] {
  const out: string[] = [];
  const sum = s.lipidEntries.reduce((a, e) => a + num(e.molarRatio), 0);
  if (Math.abs(sum - 100) > 0.1) out.push(`摩尔比合计 ${sum.toFixed(1)}%，应为 100%`);
  for (const e of s.lipidEntries) {
    if (!(num(e.molarWeight) > 0)) out.push(`「${entryName(e)}」缺分子量`);
    if (!(num(e.stockConc) > 0)) out.push(`「${entryName(e)}」缺母液浓度`);
  }
  if (!(num(s.prep.rnaMass) > 0)) out.push("缺 RNA 用量");
  if (!c.totalConc) out.push("无法计算总浓度");
  return out;
}

interface Props {
  batchName: string;
  createdAt: string;
  updatedAt: string;
  samples: TlnpPrepSample[];
}

/**
 * 生成配方 — the计算 half of module 1.
 *
 * Every number here comes from computeBenchFormulation, the same function the
 * LNP calculator's screening mode uses, so a formulation built in either place
 * produces identical volumes. Both download buttons call the existing bench
 * exporters directly: samples are BenchFormulations, so there is no adapter and
 * no second copy of the export logic to keep in sync.
 */
export default function FormulationOutput({
  batchName,
  createdAt,
  updatedAt,
  samples,
}: Props) {
  const [exporting, setExporting] = useState(false);

  const computed = useMemo(
    () => samples.map((s) => ({ s, c: computeBenchFormulation(s) })),
    [samples]
  );

  async function exportPdf() {
    if (samples.length === 0) return;
    setExporting(true);
    const toastId = toast.loading("PDF 生成中，请等待...");
    try {
      const mod = await import("@/lib/export/lnp-bench-pdf");
      await mod.exportBenchToPdf(batchName, createdAt, updatedAt, samples);
      toast.success("PDF 已导出", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("导出 PDF 失败", { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  function exportXlsx() {
    if (samples.length === 0) return;
    try {
      exportBenchToXlsx(batchName, createdAt, updatedAt, samples);
      toast.success("Excel 已生成");
    } catch (e) {
      console.error(e);
      toast.error("导出 Excel 失败");
    }
  }

  if (samples.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        添加样品后，这里会显示每个配方的吸取体积与水相/脂相体系。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={exportPdf}
          disabled={exporting}
        >
          <FileText className="h-3.5 w-3.5" />
          {exporting ? "导出中..." : "下载配方 PDF"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={exportXlsx}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          下载配方 Excel
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {computed.map(({ s, c }) => {
          const warnings = warningsFor(s, c);
          return (
            <div key={s.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-semibold">
                  {s.name || "(未命名样品)"}
                </h4>
                {c.totalConc && (
                  <span className="font-mono text-xs text-muted-foreground">
                    总浓度{" "}
                    {c.totalConc.mM >= 1
                      ? `${c.totalConc.mM.toFixed(2)} mM`
                      : `${c.totalConc.uM.toFixed(0)} µM`}{" "}
                    ({c.totalConc.massConc_mg_per_mL.toFixed(2)} mg/mL)
                  </span>
                )}
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Lipid Mix 吸取体积
                </p>
                <ul className="space-y-0.5">
                  {s.lipidEntries.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-baseline justify-between gap-2 text-xs"
                    >
                      <span className="truncate">
                        {entryName(e)}
                        <span className="ml-1 text-muted-foreground">
                          {e.molarRatio}%
                        </span>
                      </span>
                      <span className="shrink-0 font-mono">
                        {c.stockVolumes?.[e.id]
                          ? formatVolume(c.stockVolumes[e.id].uL)
                          : "--"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Phase
                  dotClass="bg-pillar-utr"
                  title="水相 Aqueous"
                  rows={[
                    ["RNA", c.prepVolumes.rnaVolume_uL],
                    ["Citrate buffer", c.prepVolumes.cbBuffer_uL],
                    ["合计", c.prepVolumes.aqueousTotal_uL],
                  ]}
                />
                <Phase
                  dotClass="bg-pillar-lnp"
                  title="脂相 Organic"
                  rows={[
                    ["Lipid mix", c.prepVolumes.lipidMix_uL],
                    ["乙醇", c.prepVolumes.ethanol_uL],
                    ["合计", c.prepVolumes.organicTotal_uL],
                  ]}
                />
              </div>

              {warnings.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {warnings.map((w) => (
                    <span
                      key={w}
                      className="flex items-center gap-1 rounded border border-warning/35 bg-warning-subtle px-1.5 py-0.5 text-[11px] text-warning"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Phase({
  dotClass,
  title,
  rows,
}: {
  dotClass: string;
  title: string;
  rows: [string, number | null][];
}) {
  return (
    <div className="rounded-md bg-muted/40 p-2.5">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {title}
      </p>
      <ul className="space-y-0.5">
        {rows.map(([label, value]) => (
          <li
            key={label}
            className="flex items-baseline justify-between gap-2 text-xs"
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono">{formatVolume(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
