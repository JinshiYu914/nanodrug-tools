"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Clock,
  Dna,
  Library,
  Loader2,
  LogIn,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/lib/supabase/use-user";
import { type LnpSavedItem } from "@/lib/supabase/lnp-service";
import { listIvtBatches } from "@/lib/supabase/ivt-service";
import {
  copyRnaMethod,
  createSampleNumber,
  emptyIvtRna,
  parseIvtBatch,
  rnaLibraryStatus,
  rnaTotalMassUg,
  type IvtRnaRecord,
} from "@/lib/calculations/ivt-experiment";
import IvtBatchSidebar from "./batch-sidebar";
import RnaEditor from "./rna-editor";
import RnaLibraryView from "./rna-library";
import { useIvtBatch } from "./use-ivt-batch";

type ViewKey = "batch" | "library";

export default function IvtWorkbench() {
  const { user, loading: authLoading } = useUser();
  const authed: boolean | null = authLoading ? null : !!user;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: ViewKey = searchParams.get("view") === "library" ? "library" : "batch";
  const batchParam = searchParams.get("batch");
  const rnaParam = searchParams.get("rna");
  const restoreAttempted = useRef<string | null>(null);

  const { batch, data, update, select, clear, saving, lastSavedAt, refreshToken } = useIvtBatch();

  const writeUrl = useCallback(
    (next: { view?: ViewKey; batchId?: string | null; rnaId?: string | null }) => {
      const params = new URLSearchParams();
      params.set("view", next.view ?? view);
      const batchId = next.batchId === undefined ? batch?.id ?? batchParam : next.batchId;
      const rnaId = next.rnaId === undefined ? rnaParam : next.rnaId;
      if (batchId) params.set("batch", batchId);
      if (rnaId) params.set("rna", rnaId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [batch?.id, batchParam, pathname, rnaParam, router, view]
  );

  useEffect(() => {
    if (!authed || !batchParam || batch?.id === batchParam || restoreAttempted.current === batchParam) return;
    restoreAttempted.current = batchParam;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listIvtBatches();
        if (cancelled) return;
        const match = rows.find((item) => item.id === batchParam && !item.is_folder);
        if (match) select(match);
      } catch (error) {
        console.warn("[ivt] 恢复批次失败", error);
        if (!cancelled) toast.error("载入 IVT 批次失败");
      }
    })();
    return () => {
      cancelled = true;
      if (restoreAttempted.current === batchParam) restoreAttempted.current = null;
    };
  }, [authed, batch?.id, batchParam, select]);

  const activeRna = useMemo(
    () => data.rnas.find((rna) => rna.id === rnaParam) ?? data.rnas[0] ?? null,
    [data.rnas, rnaParam]
  );

  const handleSelectBatch = useCallback(
    (item: LnpSavedItem) => {
      restoreAttempted.current = item.id;
      select(item);
      const first = parseIvtBatch(item.data).rnas[0]?.id ?? null;
      writeUrl({ view: "batch", batchId: item.id, rnaId: first });
    },
    [select, writeUrl]
  );

  function addRna() {
    const seed = data.rnas[data.rnas.length - 1] ?? null;
    const usedNames = new Set(data.rnas.map((rna) => rna.name));
    let sampleIndex = data.rnas.length;
    while (usedNames.has(createSampleNumber(sampleIndex))) sampleIndex += 1;
    const next = emptyIvtRna(seed, sampleIndex);
    update((previous) => ({ ...previous, rnas: [...previous.rnas, next] }));
    writeUrl({ view: "batch", rnaId: next.id });
  }

  function updateRna(next: IvtRnaRecord) {
    update((previous) => ({
      ...previous,
      rnas: previous.rnas.map((rna) => (rna.id === next.id ? next : rna)),
    }));
  }

  function removeRna(rna: IvtRnaRecord) {
    if (!window.confirm(`删除 RNA「${rna.name || rna.rnaType || "未命名 RNA"}」？`)) return;
    const remaining = data.rnas.filter((item) => item.id !== rna.id);
    update((previous) => ({ ...previous, rnas: remaining }));
    writeUrl({ rnaId: remaining[0]?.id ?? null });
  }

  function copyMethod(targetIds: string[]) {
    if (!activeRna) return;
    const targets = new Set(targetIds);
    update((previous) => ({
      ...previous,
      rnas: previous.rnas.map((rna) =>
        targets.has(rna.id) ? copyRnaMethod(activeRna, rna) : rna
      ),
    }));
    toast.success(`方法已复制到 ${targets.size} 条 RNA`);
  }

  function deleteBatch(id: string) {
    if (batch?.id !== id) return;
    restoreAttempted.current = null;
    clear();
    writeUrl({ batchId: null, rnaId: null });
  }

  if (authed === null) {
    return <Shell><Card><CardContent className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />加载中</CardContent></Card></Shell>;
  }

  if (!authed) {
    return (
      <Shell>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-primary" />IVT mRNA 工作台需要登录</CardTitle><CardDescription>登录后可按批次记录 IVT 并维护个人 RNA 库。</CardDescription></CardHeader><CardContent><Link href="/login"><Button className="gap-2"><LogIn className="h-4 w-4" />前往登录</Button></Link></CardContent></Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b pb-3">
        <ViewButton active={view === "batch"} icon={<Dna className="h-3.5 w-3.5" />} label="IVT 批次记录" onClick={() => writeUrl({ view: "batch" })} />
        <ViewButton active={view === "library"} icon={<Library className="h-3.5 w-3.5" />} label="我的 RNA 库" onClick={() => writeUrl({ view: "library" })} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside><IvtBatchSidebar activeBatchId={batch?.id ?? null} onSelectBatch={handleSelectBatch} onBatchDeleted={deleteBatch} refreshToken={refreshToken} /></aside>
        <main className="min-w-0">
          {view === "library" ? (
            <RnaLibraryView refreshToken={refreshToken} />
          ) : !batch ? (
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Dna className="h-4 w-4 text-primary" />新建或选择一个 IVT 批次</CardTitle><CardDescription>一个批次可包含多条 RNA，每条 RNA 可以使用不同方法。</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">使用左侧 <Plus className="inline h-3.5 w-3.5" /> 新建批次，或打开已有批次继续记录。</p></CardContent></Card>
          ) : (
            <div className="space-y-5">
              <BatchHeader batchName={batch.name} data={data} update={update} saving={saving} lastSavedAt={lastSavedAt} />
              <RnaStrip rnas={data.rnas} activeRnaId={activeRna?.id ?? null} onSelect={(id) => writeUrl({ rnaId: id })} onAdd={addRna} onDelete={removeRna} />
              {activeRna ? (
                <RnaEditor rna={activeRna} allRnas={data.rnas} onChange={updateRna} onCopyMethod={copyMethod} />
              ) : (
                <Card><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">该批次还没有 RNA。</p><Button className="mt-3 gap-1.5" size="sm" onClick={addRna}><Plus className="h-3.5 w-3.5" />添加第一个 RNA</Button></CardContent></Card>
              )}
            </div>
          )}
        </main>
      </div>
    </Shell>
  );
}

function BatchHeader({ batchName, data, update, saving, lastSavedAt }: { batchName: string; data: ReturnType<typeof useIvtBatch>["data"]; update: ReturnType<typeof useIvtBatch>["update"]; saving: boolean; lastSavedAt: Date | null }) {
  const setMeta = (patch: Partial<typeof data.meta>) => update((previous) => ({ ...previous, meta: { ...previous.meta, ...patch } }));
  return (
    <Card><CardContent className="space-y-4 py-4">
      <div><h2 className="font-semibold">{batchName}</h2><div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">{saving ? <span className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" />保存中</span> : lastSavedAt ? <span className="flex items-center gap-1 text-success"><Save className="h-3 w-3" />已保存 {lastSavedAt.toLocaleTimeString()}</span> : <span className="flex items-center gap-1"><Clock className="h-3 w-3" />等待编辑</span>}<span>{data.rnas.length} 条 RNA</span></div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="批次编号"><Input className="h-8 text-xs" value={data.meta.batchCode} onChange={(event) => setMeta({ batchCode: event.target.value })} placeholder="IVT-0812-A" /></Field><Field label="实验日期"><Input type="date" className="h-8 text-xs" value={data.meta.date} onChange={(event) => setMeta({ date: event.target.value })} /></Field><Field label="负责人"><Input className="h-8 text-xs" value={data.meta.operator} onChange={(event) => setMeta({ operator: event.target.value })} /></Field><Field label="实验目的"><Input className="h-8 text-xs" value={data.meta.objective} onChange={(event) => setMeta({ objective: event.target.value })} /></Field></div>
      <Field label="批次备注"><Textarea rows={2} value={data.meta.note} onChange={(event) => setMeta({ note: event.target.value })} /></Field>
    </CardContent></Card>
  );
}

function RnaStrip({ rnas, activeRnaId, onSelect, onAdd, onDelete }: { rnas: IvtRnaRecord[]; activeRnaId: string | null; onSelect: (id: string) => void; onAdd: () => void; onDelete: (rna: IvtRnaRecord) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">本批 RNA</h3><Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onAdd}><Plus className="h-3.5 w-3.5" />添加 RNA</Button></div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rnas.map((rna, index) => {
          const status = rnaLibraryStatus(rna);
          const mass = rnaTotalMassUg(rna);
          return <div key={rna.id} className={`group flex min-w-44 items-center rounded-md border transition-colors ${rna.id === activeRnaId ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}><button type="button" className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => onSelect(rna.id)}><span className="block truncate text-xs font-medium">{rna.name || rna.rnaType || `RNA ${index + 1}`}</span><span className="block truncate text-[10px] text-muted-foreground">{status === "validated" ? "已验证" : status === "ready" ? `${mass?.toFixed(2)} µg` : "记录中"} · {rna.vector || "未选载体"}</span></button><button type="button" title="删除 RNA" className="mr-1 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={() => onDelete(rna)}><Trash2 className="h-3.5 w-3.5" /></button></div>;
        })}
      </div>
    </div>
  );
}

function ViewButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{icon}{label}</button>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6"><div className="mb-2"><Link href="/tools" className="text-sm text-muted-foreground hover:text-primary">&larr; 返回常用工具</Link></div><div className="mb-7"><div className="mb-2 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Dna className="h-5 w-5 text-primary" /></div><h1 className="text-3xl font-bold tracking-tight">IVT mRNA 工作台</h1></div><p className="max-w-3xl text-muted-foreground">按批次记录质粒线性化、IVT、RNA 纯化和表达验证；所有 RNA 自动汇入 RNA 库。</p></div>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
