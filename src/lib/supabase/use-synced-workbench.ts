"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "./client";
import {
  createItem,
  DataSyncConflictError,
  getItem,
  listAllItems,
  updateItemData,
  type LnpSavedItem,
} from "./lnp-service";
import {
  cacheCloudItems,
  deleteWorkbenchCache,
  getWorkbenchCache,
  putWorkbenchCache,
  revisionOf,
  type SyncedWorkbenchType,
  type WorkbenchCacheEntry,
} from "./workbench-cache";
import { decideCloudLoad } from "./sync-policy";

export type WorkbenchSyncState =
  | "idle"
  | "pulling"
  | "synced"
  | "saving"
  | "local-draft"
  | "conflict-copy"
  | "error";

interface Pending<T> {
  item: LnpSavedItem;
  data: T;
  baseRevision: number;
  token: number;
}

interface Options<T> {
  userId: string | null;
  type: SyncedWorkbenchType;
  empty: () => T;
  parse: (raw: unknown) => T;
  serialize: (data: T) => Record<string, unknown>;
  autosaveDelay?: number;
  migration: string;
}

export interface SyncedWorkbenchState<T> {
  item: LnpSavedItem | null;
  data: T;
  update: (updater: (previous: T) => T) => void;
  select: (candidate: LnpSavedItem) => void;
  clear: () => void;
  syncState: WorkbenchSyncState;
  saving: boolean;
  lastSavedAt: Date | null;
  refreshToken: number;
}

function conflictName(name: string): string {
  const stamp = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replaceAll("/", "-")
    .replaceAll(":", "");
  return `${name}（冲突副本 ${stamp}）`;
}

/**
 * Cloud-first workbench state with an IndexedDB draft and optimistic locking.
 * Selecting a sidebar row always re-reads its body from Supabase; the sidebar's
 * copy is only a locator and an offline fallback.
 */
export function useSyncedWorkbench<T>({
  userId,
  type,
  empty,
  parse,
  serialize,
  autosaveDelay = 800,
  migration,
}: Options<T>): SyncedWorkbenchState<T> {
  const [item, setItem] = useState<LnpSavedItem | null>(null);
  const [data, setData] = useState<T>(empty);
  const [syncState, setSyncState] = useState<WorkbenchSyncState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const itemRef = useRef<LnpSavedItem | null>(null);
  const dataRef = useRef<T>(data);
  const pendingRef = useRef<Pending<T> | null>(null);
  const editRequestedRef = useRef(false);
  const editTokenRef = useRef(0);
  const selectTokenRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const cache = useCallback(
    async (row: LnpSavedItem, value: T, baseRevision: number, dirty: boolean) => {
      if (!userId) return;
      try {
        await putWorkbenchCache({
          userId,
          type,
          itemId: row.id,
          item: { ...row, data: serialize(value) },
          data: serialize(value),
          baseRevision,
          dirty,
          localUpdatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.warn(`[${type}] 本机草稿缓存失败`, error);
      }
    },
    [serialize, type, userId]
  );

  const adopt = useCallback(
    (row: LnpSavedItem, value: T, state: WorkbenchSyncState) => {
      itemRef.current = row;
      dataRef.current = value;
      setItem(row);
      setData(value);
      setSyncState(state);
    },
    []
  );

  const preserveConflict = useCallback(
    async (pending: Pending<T>) => {
      if (!userId) return;
      const latest = pendingRef.current?.item.id === pending.item.id
        ? pendingRef.current
        : pending;
      const payload = serialize(latest.data);
      let copy: LnpSavedItem;
      const base = {
        type,
        is_folder: false,
        name: conflictName(latest.item.name),
        data: payload,
        sort_order: latest.item.sort_order + 1,
      } as const;
      try {
        copy = await createItem({ ...base, parent_id: latest.item.parent_id });
      } catch (error) {
        // A remotely deleted parent should not prevent rescue of the record.
        const code = (error as { code?: string })?.code;
        if (code !== "23503") throw error;
        copy = await createItem({ ...base, parent_id: null });
      }

      pendingRef.current = null;
      await deleteWorkbenchCache(userId, type, latest.item.id).catch(() => undefined);
      await cache(copy, latest.data, revisionOf(copy), false);
      adopt(copy, latest.data, "conflict-copy");
      setLastSavedAt(new Date(copy.updated_at));
      setRefreshToken((value) => value + 1);
      toast.warning(`云端已有新版本，本机内容已保留为「${copy.name}」`);
    },
    [adopt, cache, serialize, type, userId]
  );

  const flush = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const attempt = pendingRef.current;
    if (!attempt || !userId) return;

    const task = (async () => {
      setSyncState("saving");
      try {
        const saved = await updateItemData(
          attempt.item.id,
          serialize(attempt.data),
          attempt.baseRevision
        );
        const latest = pendingRef.current;
        const valueNow = dataRef.current;
        itemRef.current = { ...saved, data: serialize(valueNow) };
        setItem(itemRef.current);
        setLastSavedAt(new Date(saved.updated_at));
        setRefreshToken((value) => value + 1);

        if (!latest || latest.token === attempt.token) {
          pendingRef.current = null;
          await cache(saved, attempt.data, revisionOf(saved), false);
          setSyncState("synced");
        } else {
          latest.item = saved;
          latest.baseRevision = revisionOf(saved);
          await cache(saved, latest.data, latest.baseRevision, true);
          setSyncState("local-draft");
          if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = window.setTimeout(() => void flushRef.current(), autosaveDelay);
        }
      } catch (error) {
        if (error instanceof DataSyncConflictError) {
          const rescue = pendingRef.current ?? attempt;
          try {
            await preserveConflict(rescue);
          } catch (rescueError) {
            pendingRef.current = rescue;
            await cache(rescue.item, rescue.data, rescue.baseRevision, true);
            setSyncState("local-draft");
            console.warn(`[${type}] 冲突副本创建失败`, rescueError);
            toast.error("云端存在冲突，本机草稿已保留，联网后将重试");
          }
          return;
        }
        const latest = pendingRef.current ?? attempt;
        pendingRef.current = latest;
        await cache(latest.item, latest.data, latest.baseRevision, true);
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setSyncState(offline ? "local-draft" : "error");
        console.warn(`[${type}] 自动同步失败`, error);
        if (!offline) {
          const message = (error as { message?: string })?.message ?? "";
          toast.error(
            message.includes("data_revision")
              ? `请先在 Supabase 执行 ${migration}`
              : "同步失败，本机草稿已保留"
          );
        }
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = task;
    return task;
  }, [autosaveDelay, cache, migration, preserveConflict, serialize, type, userId]);

  flushRef.current = flush;

  // Only explicit calls to update mark data as dirty. Loading/parsing a record
  // can therefore never cause a write of defaults or a normalized legacy blob.
  useEffect(() => {
    if (!editRequestedRef.current) return;
    editRequestedRef.current = false;
    const current = itemRef.current;
    if (!current || !userId) return;
    const token = ++editTokenRef.current;
    const baseRevision = pendingRef.current?.baseRevision ?? revisionOf(current);
    pendingRef.current = { item: current, data, baseRevision, token };
    void cache(current, data, baseRevision, true);
    setSyncState("local-draft");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void flushRef.current(), autosaveDelay);
  }, [autosaveDelay, cache, data, userId]);

  const select = useCallback(
    (candidate: LnpSavedItem) => {
      if (!userId) return;
      const requestToken = ++selectTokenRef.current;
      setSyncState("pulling");
      void (async () => {
        // The previous record is already durable in IndexedDB even if offline.
        if (pendingRef.current) await flushRef.current();
        let cloud: LnpSavedItem | null = null;
        try {
          cloud = await getItem(candidate.id);
        } catch {
          const cached = await getWorkbenchCache(userId, type, candidate.id).catch(() => null);
          if (requestToken !== selectTokenRef.current) return;
          if (!cached) {
            setSyncState("error");
            toast.error("无法从云端载入记录，且本机没有可用缓存");
            return;
          }
          const value = parse(cached.data);
          pendingRef.current = cached.dirty
            ? {
                item: cached.item,
                data: value,
                baseRevision: cached.baseRevision,
                token: ++editTokenRef.current,
              }
            : null;
          adopt(cached.item, value, cached.dirty ? "local-draft" : "synced");
          return;
        }

        if (requestToken !== selectTokenRef.current) return;
        if (!cloud) {
          const cached = await getWorkbenchCache(userId, type, candidate.id).catch(() => null);
          if (cached?.dirty) {
            const draft = parse(cached.data);
            const pending: Pending<T> = {
              item: cached.item,
              data: draft,
              baseRevision: cached.baseRevision,
              token: ++editTokenRef.current,
            };
            pendingRef.current = pending;
            adopt(cached.item, draft, "local-draft");
            try {
              await preserveConflict(pending);
            } catch (error) {
              console.warn(`[${type}] 已删除记录的草稿救援失败`, error);
            }
          } else {
            await deleteWorkbenchCache(userId, type, candidate.id).catch(() => undefined);
            setSyncState("error");
            toast.error("该记录已被删除");
          }
          return;
        }

        const cached = await getWorkbenchCache(userId, type, cloud.id).catch(() => null);
        if (requestToken !== selectTokenRef.current) return;
        const decision = decideCloudLoad(cached, revisionOf(cloud));
        if (decision !== "use-cloud" && cached) {
          const draft = parse(cached.data);
          const pending: Pending<T> = {
            item: cloud,
            data: draft,
            baseRevision: cached.baseRevision,
            token: ++editTokenRef.current,
          };
          pendingRef.current = pending;
          if (decision === "resume-draft") {
            adopt(cloud, draft, "local-draft");
            saveTimerRef.current = window.setTimeout(() => void flushRef.current(), 0);
          } else {
            adopt(cloud, draft, "local-draft");
            try {
              await preserveConflict(pending);
            } catch (error) {
              console.warn(`[${type}] 冲突副本创建失败`, error);
              setSyncState("local-draft");
            }
          }
          return;
        }

        pendingRef.current = null;
        const value = parse(cloud.data);
        adopt(cloud, value, "synced");
        setLastSavedAt(new Date(cloud.updated_at));
        await cache(cloud, value, revisionOf(cloud), false);
      })();
    },
    [adopt, cache, parse, preserveConflict, type, userId]
  );

  const update = useCallback((updater: (previous: T) => T) => {
    editRequestedRef.current = true;
    setData((previous) => {
      const next = updater(previous);
      dataRef.current = next;
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    selectTokenRef.current += 1;
    itemRef.current = null;
    pendingRef.current = null;
    dataRef.current = empty();
    setItem(null);
    setData(dataRef.current);
    setSyncState("idle");
    setLastSavedAt(null);
  }, [empty]);

  // Warm the per-user cache from the cloud. A dirty entry is never replaced.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void listAllItems(type)
      .then((rows) => (cancelled ? undefined : cacheCloudItems(userId, type, rows)))
      .catch((error) => console.warn(`[${type}] 云端预取失败`, error));
    return () => {
      cancelled = true;
    };
  }, [type, userId]);

  // Realtime handles remote inserts/updates; focus refresh covers deletes and
  // browsers where the Realtime publication is temporarily unavailable.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`workbench:${type}:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lnp_saved_items", filter: `user_id=eq.${userId}` },
        (payload) => {
          const remote = payload.new as unknown as LnpSavedItem;
          if (!remote || remote.type !== type) return;
          setRefreshToken((value) => value + 1);
          const current = itemRef.current;
          if (!current || current.id !== remote.id) return;
          if (revisionOf(remote) <= revisionOf(current)) return;
          if (pendingRef.current) {
            void flushRef.current();
            return;
          }
          const value = parse(remote.data);
          adopt(remote, value, "synced");
          void cache(remote, value, revisionOf(remote), false);
          toast.info("已载入另一台设备保存的最新版本");
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [adopt, cache, parse, type, userId]);

  useEffect(() => {
    if (!userId) return;
    const refreshActive = async () => {
      if (pendingRef.current) {
        await flushRef.current();
        return;
      }
      const current = itemRef.current;
      if (!current) return;
      try {
        const remote = await getItem(current.id);
        if (!remote || revisionOf(remote) <= revisionOf(current)) return;
        const value = parse(remote.data);
        adopt(remote, value, "synced");
        await cache(remote, value, revisionOf(remote), false);
      } catch (error) {
        console.warn(`[${type}] 前台刷新失败`, error);
      }
    };
    const onOnline = () => void refreshActive();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshActive();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [adopt, cache, parse, type, userId]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (pendingRef.current) void cache(
        pendingRef.current.item,
        pendingRef.current.data,
        pendingRef.current.baseRevision,
        true
      );
    },
    [cache]
  );

  return {
    item,
    data,
    update,
    select,
    clear,
    syncState,
    saving: syncState === "saving" || syncState === "pulling",
    lastSavedAt,
    refreshToken,
  };
}

export function cachedEntryToItem(entry: WorkbenchCacheEntry): LnpSavedItem {
  return { ...entry.item, data: entry.data };
}
