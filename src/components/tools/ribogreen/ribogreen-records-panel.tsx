"use client";

import { useMemo, useState } from "react";
import {
  LogIn,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  FlaskConical,
  CalendarDays,
  Beaker,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LnpSavedItem } from "@/lib/supabase/lnp-service";
import {
  countFilledSamples,
  getItemYearMonth,
} from "@/lib/calculations/ribogreen";
import { INSTRUMENT_OPTIONS } from "@/lib/calculations/ribogreen-presets";
import { useRibogreenSaved } from "./use-ribogreen-saved";

const SELECT_CLASS =
  "flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function recordDate(item: LnpSavedItem): string {
  const raw =
    item.data && typeof item.data === "object"
      ? (item.data as Record<string, unknown>).experimentDate
      : null;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(item.created_at);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function instrumentLabel(item: LnpSavedItem): string {
  const raw =
    item.data && typeof item.data === "object"
      ? (item.data as Record<string, unknown>).instrument
      : null;
  return INSTRUMENT_OPTIONS.find((o) => o.key === raw)?.label ?? "自定义曲线";
}

interface Props {
  refreshToken: number;
  onLoad: (data: Record<string, unknown>, item: LnpSavedItem) => void;
  activeItemId: string | null;
}

export default function RibogreenRecordsPanel({
  refreshToken,
  onLoad,
  activeItemId,
}: Props) {
  const { userId, authLoading, items, loading, rename, remove } =
    useRibogreenSaved("ribogreen_result", refreshToken);

  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [renameTarget, setRenameTarget] = useState<LnpSavedItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const it of items) {
      const { year: y } = getItemYearMonth(it.data, it.created_at);
      if (y > 0) set.add(y);
    }
    return [...set].sort((a, b) => b - a);
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => {
        const { year: y, month: m } = getItemYearMonth(it.data, it.created_at);
        if (year !== "all" && y !== Number(year)) return false;
        if (month !== "all" && m !== Number(month)) return false;
        if (q && !it.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => recordDate(b).localeCompare(recordDate(a)));
  }, [items, query, year, month]);

  function handleLoad(it: LnpSavedItem) {
    if (!it.data) {
      toast.error("该记录没有可载入的数据");
      return;
    }
    if (!window.confirm(`载入「${it.name}」会覆盖当前表格内容，确定继续？`)) return;
    onLoad(it.data, it);
    toast.success(`已载入「${it.name}」`);
  }

  if (authLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  if (!userId) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            <CardTitle>我的实验记录</CardTitle>
          </div>
          <CardDescription>
            登录后可保存每批检测结果，并按年月归档查看历史数据。
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
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <CardTitle>我的实验记录</CardTitle>
        </div>
        <CardDescription>
          共 {items.length} 条记录{visible.length !== items.length && ` · 当前筛选出 ${visible.length} 条`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索记录名称"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <select
            className={SELECT_CLASS}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="all">全部年份</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y} 年
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="all">全部月份</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>
          {(query || year !== "all" || month !== "all") && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => {
                setQuery("");
                setYear("all");
                setMonth("all");
              }}
            >
              重置筛选
            </Button>
          )}
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">加载中...</p>
        ) : visible.length === 0 ? (
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "还没有保存的实验记录 — 在上方点击「保存实验记录」创建第一条"
              : "没有符合条件的记录"}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((it) => {
              const active = it.id === activeItemId;
              return (
                <div
                  key={it.id}
                  className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40 ${
                    active ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={it.name}>
                        {it.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {recordDate(it)}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          title="更多操作"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleLoad(it)}>
                          <Download className="h-4 w-4" />
                          载入
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameTarget(it);
                            setRenameValue(it.name);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => void remove(it)}
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Beaker className="h-3 w-3" />
                      {countFilledSamples(it.data)} 个样本
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {instrumentLabel(it)}
                    </Badge>
                    {active && <Badge className="text-xs">当前</Badge>}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-auto h-7 w-full gap-1.5 text-xs"
                    onClick={() => handleLoad(it)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    载入这条记录
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameTarget && renameValue.trim()) {
                void rename(renameTarget.id, renameValue.trim());
                setRenameTarget(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (renameTarget && renameValue.trim()) {
                  void rename(renameTarget.id, renameValue.trim());
                }
                setRenameTarget(null);
              }}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
