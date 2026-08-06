"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, Clock, Loader2, LogIn, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/lib/supabase/use-user";
import { listAllItems, type LnpSavedItem } from "@/lib/supabase/lnp-service";
import { moduleFilled } from "@/lib/calculations/tlnp-experiment";
import BatchSidebar from "./batch-sidebar";
import ModuleNav, { type ModuleKey } from "./module-nav";
import ModulePrep from "./module-prep";
import ModuleConjugation from "./module-conjugation";
import { useTlnpBatch } from "./use-tlnp-batch";

const MODULE_KEYS: ModuleKey[] = ["1", "2", "3", "4", "report", "compare"];

function parseModule(raw: string | null): ModuleKey {
  return MODULE_KEYS.includes(raw as ModuleKey) ? (raw as ModuleKey) : "1";
}

export default function TlnpWorkbench() {
  const { user, loading: authLoading } = useUser();
  const authed: boolean | null = authLoading ? null : !!user;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const batchParam = searchParams.get("batch");
  const moduleParam = parseModule(searchParams.get("m"));

  const {
    batch,
    data,
    update,
    select,
    clear,
    saving,
    lastSavedAt,
    refreshToken,
  } = useTlnpBatch();

  // The URL is the source of truth for which batch is open, so a link from the
  // RiboGreen grid — or a refresh — lands on the right one.
  const [restoring, setRestoring] = useState(false);
  const restoreAttempted = useRef<string | null>(null);

  useEffect(() => {
    if (!authed || !batchParam) return;
    if (batch?.id === batchParam) return;
    if (restoreAttempted.current === batchParam) return;
    restoreAttempted.current = batchParam;

    let cancelled = false;
    setRestoring(true);
    void (async () => {
      try {
        const rows = await listAllItems("tlnp_experiment");
        if (cancelled) return;
        const hit = rows.find((r) => r.id === batchParam && !r.is_folder);
        if (hit) select(hit);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, batchParam, batch?.id, select]);

  const writeUrl = useCallback(
    (batchId: string | null, module: ModuleKey) => {
      const params = new URLSearchParams();
      if (batchId) params.set("batch", batchId);
      params.set("m", module);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router]
  );

  const handleSelectBatch = useCallback(
    (item: LnpSavedItem) => {
      restoreAttempted.current = item.id;
      select(item);
      writeUrl(item.id, moduleParam);
    },
    [select, writeUrl, moduleParam]
  );

  const handleBatchDeleted = useCallback(
    (id: string) => {
      if (batch?.id !== id) return;
      restoreAttempted.current = null;
      clear();
      writeUrl(null, moduleParam);
    },
    [batch?.id, clear, writeUrl, moduleParam]
  );

  const handleModuleChange = useCallback(
    (key: ModuleKey) => writeUrl(batch?.id ?? null, key),
    [writeUrl, batch?.id]
  );

  const filled = useMemo(
    () => [
      moduleFilled(data, 1),
      moduleFilled(data, 2),
      moduleFilled(data, 3),
      moduleFilled(data, 4),
    ],
    [data]
  );

  if (authed === null) {
    return (
      <Shell>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            加载中...
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!authed) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" />
              <CardTitle>tLNP 工作台需要登录</CardTitle>
            </div>
            <CardDescription>
              登录后可新建实验批次，记录从 LNP 制备到体内外实验的完整流程，并导出
              PDF / Excel。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="gap-2">
                <LogIn className="h-4 w-4" />
                前往登录
              </Button>
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside>
          <BatchSidebar
            activeBatchId={batch?.id ?? null}
            onSelectBatch={handleSelectBatch}
            onBatchDeleted={handleBatchDeleted}
            refreshToken={refreshToken}
          />
        </aside>

        <div className="min-w-0 space-y-6">
          {!batch ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-primary" />
                  <CardTitle>新建或选择一个实验批次</CardTitle>
                </div>
                <CardDescription>
                  每个批次记录一次完整的 tLNP 实验：LNP 制备 → 偶联反应 → LNP
                  纯化 → 体内外实验。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {restoring ? (
                    "正在载入批次..."
                  ) : (
                    <>
                      左侧点击 <Plus className="inline h-3.5 w-3.5" />{" "}
                      新建一个批次，或选择已有批次继续。
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <BatchHeader
                batch={batch}
                data={data}
                update={update}
                saving={saving}
                lastSavedAt={lastSavedAt}
              />

              <ModuleNav
                active={moduleParam}
                onChange={handleModuleChange}
                filled={filled}
              />

              {moduleParam === "1" ? (
                <ModulePrep
                  data={data}
                  update={update}
                  batchName={batch.name}
                  createdAt={batch.created_at}
                  updatedAt={batch.updated_at}
                />
              ) : moduleParam === "2" ? (
                <ModuleConjugation data={data} update={update} />
              ) : (
                <ModulePlaceholder module={moduleParam} />
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

// ─── Page shell ───────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mb-2">
        <Link
          href="/tools"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          &larr; 返回常用工具
        </Link>
      </div>
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Boxes className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">tLNP 制备工作台</h1>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          按批次记录靶向 LNP 的完整实验链路：LNP 制备 → 偶联反应 → LNP 纯化 →
          体内外实验。每一步都分实验设计与实验结果两部分，可随时导出、跨批次对比。
        </p>
      </div>
      {children}
    </div>
  );
}

// ─── Batch header ─────────────────────────────────────────

function BatchHeader({
  batch,
  data,
  update,
  saving,
  lastSavedAt,
}: {
  batch: LnpSavedItem;
  data: ReturnType<typeof useTlnpBatch>["data"];
  update: ReturnType<typeof useTlnpBatch>["update"];
  saving: boolean;
  lastSavedAt: Date | null;
}) {
  const setMeta = (patch: Partial<typeof data.meta>) =>
    update((prev) => ({ ...prev, meta: { ...prev.meta, ...patch } }));

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Boxes className="h-4 w-4 shrink-0 text-primary" />
            <h2 className="truncate text-base font-semibold">{batch.name}</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              创建 {formatDateTime(batch.created_at)}
            </span>
            {saving ? (
              <span className="flex items-center gap-1 text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                保存中
              </span>
            ) : lastSavedAt ? (
              <span className="flex items-center gap-1 text-success">
                <Save className="h-3 w-3" />
                已保存 {formatTime(lastSavedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="批次编号">
            <Input
              value={data.meta.batchCode}
              onChange={(e) => setMeta({ batchCode: e.target.value })}
              placeholder="例如 T-0806-A"
              className="h-8 font-mono text-xs"
            />
          </Field>
          <Field label="实验日期">
            <Input
              type="date"
              value={data.meta.experimentDate}
              onChange={(e) => setMeta({ experimentDate: e.target.value })}
              className="h-8 font-mono text-xs"
            />
          </Field>
          <Field label="负责人">
            <Input
              value={data.meta.operator}
              onChange={(e) => setMeta({ operator: e.target.value })}
              placeholder="姓名或缩写"
              className="h-8 text-xs"
            />
          </Field>
          <Field label="实验目的">
            <Input
              value={data.meta.objective}
              onChange={(e) => setMeta({ objective: e.target.value })}
              placeholder="一句话说明这批要验证什么"
              className="h-8 text-xs"
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ─── Temporary module placeholder ─────────────────────────

const MODULE_TITLES: Record<ModuleKey, string> = {
  "1": "LNP 制备",
  "2": "偶联反应",
  "3": "LNP 纯化",
  "4": "体内外实验",
  report: "总览与导出",
  compare: "批次对比",
};

function ModulePlaceholder({ module }: { module: ModuleKey }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{MODULE_TITLES[module]}</CardTitle>
        <CardDescription>该模块正在搭建中。</CardDescription>
      </CardHeader>
    </Card>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
