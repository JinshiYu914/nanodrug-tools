"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Library, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listIvtBatches } from "@/lib/supabase/ivt-service";
import {
  flattenRnaLibrary,
  type RnaLibraryEntry,
} from "@/lib/calculations/ivt-experiment";
import { exportRnaLibraryXlsx } from "@/lib/export/ivt-rna-library-xlsx";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";

export default function RnaLibraryView({ refreshToken }: { refreshToken?: number }) {
  const [entries, setEntries] = useState<RnaLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [vector, setVector] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(flattenRnaLibrary(await listIvtBatches()));
    } catch (error) {
      toast.error(describeError(error, "006_ivt_mrna.sql"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void reload(), [reload, refreshToken]);

  const types = useMemo(() => [...new Set(entries.map((entry) => entry.rna.rnaType).filter(Boolean))].sort(), [entries]);
  const vectors = useMemo(() => [...new Set(entries.map((entry) => entry.rna.vector).filter(Boolean))].sort(), [entries]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (type && entry.rna.rnaType !== type) return false;
      if (vector && entry.rna.vector !== vector) return false;
      if (date && entry.batchDate !== date) return false;
      if (status && entry.status !== status) return false;
      return !needle || [entry.rna.name, entry.rna.rnaType, entry.rna.vector, entry.batchName, entry.batchCode].join(" ").toLowerCase().includes(needle);
    });
  }, [entries, query, type, vector, date, status]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><Library className="h-4 w-4 text-primary" />我的 RNA 库</CardTitle><p className="mt-1 text-xs text-muted-foreground">自动汇总全部 IVT 批次，共 {entries.length} 条 RNA。</p></div>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={entries.length === 0} onClick={() => { exportRnaLibraryXlsx(entries); toast.success("RNA 库 Excel 已生成"); }}><Download className="h-3.5 w-3.5" />导出所有 RNA</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input className="h-9 pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 RNA 或批次" /></div>
          <Filter value={type} onChange={setType} label="全部 RNA" options={types} />
          <Filter value={vector} onChange={setVector} label="全部 T7质粒载体" options={vectors} />
          <Input type="date" className="h-9" value={date} onChange={(event) => setDate(event.target.value)} />
          <Filter value={status} onChange={setStatus} label="全部状态" options={["recording", "ready", "validated"]} labels={{ recording: "记录中", ready: "可用", validated: "已验证" }} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />加载 RNA 库</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed py-14 text-center text-sm text-muted-foreground">没有匹配的 RNA</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[68rem] text-xs">
              <thead><tr className="border-b bg-muted/40"><th className="px-3 py-2 text-left">样本序号</th><th className="px-3 py-2 text-left">RNA</th><th className="px-3 py-2 text-left">T7质粒载体</th><th className="px-3 py-2 text-left">批次</th><th className="px-3 py-2 text-left">日期</th><th className="px-3 py-2 text-left">浓度</th><th className="px-3 py-2 text-left">终体积</th><th className="px-3 py-2 text-left">总得量</th><th className="px-3 py-2 text-left">表达</th><th className="w-16" /></tr></thead>
              <tbody>{filtered.map((entry) => (
                <tr key={entry.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{entry.rna.name || "未命名 RNA"}</td>
                  <td className="px-3 py-2">{entry.rna.rnaType || "--"}</td>
                  <td className="px-3 py-2">{entry.rna.vector || "--"}</td>
                  <td className="px-3 py-2"><span className="block">{entry.batchName}</span><span className="text-[10px] text-muted-foreground">{entry.batchCode}</span></td>
                  <td className="px-3 py-2 font-mono">{entry.batchDate}</td>
                  <td className="px-3 py-2 font-mono">{entry.rna.purification.concentrationUgUl ? `${entry.rna.purification.concentrationUgUl} µg/µL` : "--"}</td>
                  <td className="px-3 py-2 font-mono">{entry.rna.purification.finalVolumeUl ? `${entry.rna.purification.finalVolumeUl} µL` : "--"}</td>
                  <td className="px-3 py-2 font-mono">{entry.totalMassUg === null ? "--" : `${entry.totalMassUg.toFixed(2)} µg`}</td>
                  <td className="px-3 py-2"><Status status={entry.status} /></td>
                  <td className="px-3 py-2 text-right"><Link href={`/tools/ivt?view=batch&batch=${entry.batchId}&rna=${entry.rna.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">打开<ExternalLink className="h-3 w-3" /></Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Filter({ value, onChange, label, options, labels = {} }: { value: string; onChange: (value: string) => void; label: string; options: string[]; labels?: Record<string, string> }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"><option value="">{label}</option>{options.map((option) => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select>;
}

function Status({ status }: { status: RnaLibraryEntry["status"] }) {
  const label = status === "validated" ? "已验证" : status === "ready" ? "可用" : "记录中";
  const color = status === "validated" ? "bg-success-subtle text-success" : status === "ready" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] ${color}`}>{label}</span>;
}
