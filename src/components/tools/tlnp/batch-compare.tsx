"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  parseTlnpExperiment,
  summarizeBatch,
  type TlnpBatchSummary,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";
import { listAllItems, type LnpSavedItem } from "@/lib/supabase/lnp-service";
import { exportCompareToXlsx } from "@/lib/export/tlnp-report-xlsx";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";
import { PERSONAL_SCOPE, type DataScope } from "@/lib/projects/types";

const MAX_COMPARE = 4;

const n = (v: number | null, digits = 1): string =>
  v === null || !isFinite(v) ? "--" : v.toFixed(digits);

interface Loaded {
  item: LnpSavedItem;
  data: TlnpExperimentData;
  summary: TlnpBatchSummary;
}

interface Props {
  /** Pre-checked so the batch you came from is already in the comparison. */
  activeBatchId: string | null;
  scope?: DataScope;
}

/**
 * Side-by-side comparison of up to four batches.
 *
 * Same data path as everywhere else — list the rows, parse each blob,
 * summarizeBatch — so a number here can't disagree with the same number on the
 * batch's own report page.
 */
export default function BatchCompare({ activeBatchId, scope = PERSONAL_SCOPE }: Props) {
  const [rows, setRows] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(activeBatchId ? [activeBatchId] : [])
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listAllItems("tlnp_experiment", scope);
      setRows(
        items
          .filter((i) => !i.is_folder)
          .map((item) => {
            const data = parseTlnpExperiment(item.data);
            return { item, data, summary: summarizeBatch(data) };
          })
      );
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, "004_tlnp_experiment.sql"));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size >= MAX_COMPARE) {
        toast.error(`最多同时对比 ${MAX_COMPARE} 个批次`);
        return prev;
      } else next.add(id);
      return next;
    });
  }

  const selected = useMemo(
    () => rows.filter((r) => checked.has(r.item.id)),
    [rows, checked]
  );

  const FIELDS: { label: string; get: (r: Loaded) => string }[] = [
    { label: "批次编号", get: (r) => r.data.meta.batchCode },
    { label: "实验日期", get: (r) => r.data.meta.experimentDate },
    { label: "负责人", get: (r) => r.data.meta.operator },
    { label: "阳离子脂质", get: (r) => r.summary.cationicLipid },
    { label: "反应 linker", get: (r) => r.summary.linker },
    { label: "Cargo", get: (r) => r.summary.cargo },
    { label: "制备方法", get: (r) => r.summary.mixing },
    { label: "溶剂置换", get: (r) => r.summary.solventLabel },
    { label: "纯化方式", get: (r) => r.summary.purificationLabel },
    { label: "样品数", get: (r) => String(r.summary.sampleCount) },
    { label: "抗体数", get: (r) => String(r.summary.proteinCount) },
    {
      label: "抗体信息",
      get: (r) =>
        r.data.conjugation.proteins
          .map((p, i) =>
            [p.name || `抗体 ${i + 1}`, p.source, p.expressionSystem, p.expressionDate]
              .filter(Boolean)
              .join(" / ")
          )
          .join("；"),
    },
    { label: "反应体系数", get: (r) => String(r.summary.systemCount) },
    { label: "平均粒径 (nm)", get: (r) => n(r.summary.meanSize_nm) },
    { label: "平均 PDI", get: (r) => n(r.summary.meanPdi, 3) },
    { label: "平均包封率 (%)", get: (r) => n(r.summary.meanEe_percent) },
    { label: "平均得率 (%)", get: (r) => n(r.summary.meanYield_percent) },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">选择要对比的批次</CardTitle>
              <CardDescription>最多 {MAX_COMPARE} 个。</CardDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => void reload()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              加载中...
            </p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              还没有其他批次。
            </p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <label
                  key={r.item.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-3.5 w-3.5 accent-primary"
                    checked={checked.has(r.item.id)}
                    onChange={() => toggle(r.item.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.item.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.summary.sampleCount} 样品 ·{" "}
                      {r.data.meta.experimentDate || "无日期"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">对比结果</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  try {
                    exportCompareToXlsx(
                      selected.map((r) => ({ name: r.item.name, data: r.data }))
                    );
                    toast.success("对比 Excel 已生成");
                  } catch (e) {
                    console.error(e);
                    toast.error("导出失败");
                  }
                }}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                导出对比 Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="sticky left-0 z-10 min-w-28 bg-muted px-2 py-2 text-left font-medium">
                      项目
                    </th>
                    {selected.map((r) => (
                      <th
                        key={r.item.id}
                        className="min-w-36 px-2 py-2 text-left font-medium"
                      >
                        <Link
                          href={`/tools/tlnp?batch=${r.item.id}&m=report`}
                          className="text-primary hover:underline"
                        >
                          {r.item.name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f) => (
                    <tr key={f.label} className="border-b last:border-b-0">
                      <th className="sticky left-0 z-10 bg-card px-2 py-1.5 text-left font-medium text-muted-foreground">
                        {f.label}
                      </th>
                      {selected.map((r) => (
                        <td key={r.item.id} className="px-2 py-1.5 font-mono">
                          {f.get(r) || "--"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
