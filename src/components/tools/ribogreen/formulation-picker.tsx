"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FlaskConical, Loader2, Search } from "lucide-react";
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
import {
  composeLipidSummary,
  describeMethod,
  parseBenchSession,
  type BenchFormulation,
} from "@/lib/calculations/lnp-bench";
import { listAllItems, type LnpSavedItem } from "@/lib/supabase/lnp-service";

export interface PickedFormulation {
  sessionId: string;
  sessionName: string;
  formulationId: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Replaces the sample columns' names, or appends new columns. */
  onPick: (picks: PickedFormulation[], mode: "replace" | "append") => void;
}

/**
 * Lists every screening session the user owns and lets them pull formulation
 * names straight into the sample grid, keeping a link back to the bench row.
 */
export default function FormulationPicker({
  open,
  onOpenChange,
  onPick,
}: Props) {
  const [sessions, setSessions] = useState<LnpSavedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listAllItems("screening_session");
      const real = rows.filter((r) => !r.is_folder);
      setSessions(real);
      setSessionId((prev) =>
        prev && real.some((r) => r.id === prev) ? prev : real[0]?.id ?? ""
      );
      setLoaded(true);
    } catch (e) {
      console.error(e);
      toast.error("加载配方筛选会话失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on first open only — the list rarely changes mid-plate-read, and a
  // refresh button covers the case where it does.
  useEffect(() => {
    if (open && !loaded) void load();
  }, [open, loaded, load]);

  const activeSession = sessions.find((s) => s.id === sessionId) ?? null;

  const formulations: BenchFormulation[] = useMemo(
    () => (activeSession ? parseBenchSession(activeSession.data).formulations : []),
    [activeSession]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return formulations;
    return formulations.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        composeLipidSummary(f).toLowerCase().includes(q)
    );
  }, [formulations, query]);

  // Switching sessions clears the selection — ids are per-session and a
  // cross-session mix would be a surprise, not a feature.
  function selectSession(id: string) {
    setSessionId(id);
    setChecked(new Set());
    setQuery("");
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) =>
      prev.size === visible.length
        ? new Set()
        : new Set(visible.map((f) => f.id))
    );
  }

  function submit(mode: "replace" | "append") {
    if (!activeSession) return;
    const picks: PickedFormulation[] = formulations
      .filter((f) => checked.has(f.id))
      .map((f) => ({
        sessionId: activeSession.id,
        sessionName: activeSession.name,
        formulationId: f.id,
        name: f.name || "(未命名)",
      }));
    if (picks.length === 0) {
      toast.error("请至少勾选一个配方");
      return;
    }
    onPick(picks, mode);
    onOpenChange(false);
    setChecked(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>从配方筛选载入样本名</DialogTitle>
          <DialogDescription>
            勾选配方后写入样本名，并与实验台的配方建立链接 —— 之后可从样本列直接跳回该配方，也能在实验台看到这批检测结果。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="flex h-8 min-w-48 flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={sessionId}
              onChange={(e) => selectSession(e.target.value)}
              disabled={sessions.length === 0}
            >
              {sessions.length === 0 && <option value="">没有筛选会话</option>}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "刷新"
              )}
            </Button>
          </div>

          {formulations.length > 3 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索配方名称或脂质组成"
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}

          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-md border p-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                加载中...
              </p>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {sessions.length === 0
                  ? "还没有配方筛选会话 —— 先到「配方筛选（批量）」标签页建立一个。"
                  : formulations.length === 0
                    ? "该筛选会话还没有加入配方。"
                    : "没有符合搜索条件的配方。"}
              </p>
            ) : (
              visible.map((f) => {
                const method = describeMethod(f.method);
                return (
                  <label
                    key={f.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-3.5 w-3.5 accent-primary"
                      checked={checked.has(f.id)}
                      onChange={() => toggle(f.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {f.name || "(未命名)"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {composeLipidSummary(f)}
                        {method && ` · ${method}`}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {visible.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {checked.size === visible.length ? "取消全选" : "全选"}（已选{" "}
              {checked.size} 个）
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => submit("append")}
          >
            <FlaskConical className="h-4 w-4" />
            追加为新样本列
          </Button>
          <Button onClick={() => submit("replace")}>从第 1 列开始填入</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
