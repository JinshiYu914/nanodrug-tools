"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createItem,
  DataSyncConflictError,
  getItem,
  updateItemData,
  type LnpSavedItem,
} from "./lnp-service";
import {
  deleteWorkbenchCache,
  getWorkbenchCache,
  putWorkbenchCache,
  revisionOf,
  type SyncedWorkbenchType,
  type WorkbenchCacheEntry,
} from "./workbench-cache";
import { decideCachedSelection } from "./sync-policy";
import { PERSONAL_SCOPE, canEditScope, scopeKey, type DataScope } from "@/lib/projects/types";

export type WorkbenchSyncState =
  | "idle"
  | "pulling"
  | "synced"
  | "saving"
  | "local-draft"
  | "conflict-copy"
  | "personal-copy"
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
  migration: string;
  scope?: DataScope;
}

export interface SyncedWorkbenchState<T> {
  item: LnpSavedItem | null;
  data: T;
  update: (updater: (previous: T) => T) => void;
  select: (
    candidate: LnpSavedItem,
    options?: { allowDirtySwitch?: boolean }
  ) => boolean;
  clear: (discardLocalDraft?: boolean) => void;
  save: () => Promise<boolean>;
  dirty: boolean;
  syncState: WorkbenchSyncState;
  saving: boolean;
  lastSavedAt: Date | null;
  refreshToken: number;
  saveDraftToPersonal: () => Promise<LnpSavedItem | null>;
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
 * Version-aware local-first workbench state with IndexedDB drafts and
 * optimistic locking. Lightweight cloud summaries decide whether a selected
 * record needs a full JSON download.
 */
export function useSyncedWorkbench<T>({
  userId,
  type,
  empty,
  parse,
  serialize,
  migration,
  scope = PERSONAL_SCOPE,
}: Options<T>): SyncedWorkbenchState<T> {
  const [item, setItem] = useState<LnpSavedItem | null>(null);
  const [data, setData] = useState<T>(empty);
  const [syncState, setSyncState] = useState<WorkbenchSyncState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const writable = canEditScope(scope);

  const itemRef = useRef<LnpSavedItem | null>(null);
  const dataRef = useRef<T>(data);
  const pendingRef = useRef<Pending<T> | null>(null);
  const editTokenRef = useRef(0);
  const selectTokenRef = useRef(0);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const draftCacheTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          scopeKey: scopeKey(scope),
        }, scope);
      } catch (error) {
        console.warn(`[${type}] 本机草稿缓存失败`, error);
      }
    },
    [scope, serialize, type, userId]
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

  const cancelScheduledDraftCache = useCallback(() => {
    if (draftCacheTimerRef.current === null) return;
    clearTimeout(draftCacheTimerRef.current);
    draftCacheTimerRef.current = null;
  }, []);

  const scheduleDraftCache = useCallback(
    (pending: Pending<T>) => {
      cancelScheduledDraftCache();
      draftCacheTimerRef.current = setTimeout(() => {
        draftCacheTimerRef.current = null;
        const latest = pendingRef.current;
        if (!latest || latest.item.id !== pending.item.id) return;
        void cache(latest.item, latest.data, latest.baseRevision, true);
      }, 750);
    },
    [cache, cancelScheduledDraftCache]
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
        copy = await createItem({ ...base, parent_id: latest.item.parent_id }, scope);
      } catch (error) {
        // A remotely deleted parent should not prevent rescue of the record.
        const code = (error as { code?: string })?.code;
        if (code !== "23503") throw error;
        copy = await createItem({ ...base, parent_id: null }, scope);
      }

      pendingRef.current = null;
      await deleteWorkbenchCache(userId, type, latest.item.id, scope).catch(() => undefined);
      await cache(copy, latest.data, revisionOf(copy), false);
      adopt(copy, latest.data, "conflict-copy");
      setLastSavedAt(new Date(copy.updated_at));
      setRefreshToken((value) => value + 1);
      toast.warning(`云端已有新版本，本机内容已保留为「${copy.name}」`);
    },
    [adopt, cache, scope, serialize, type, userId]
  );

  const flush = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const attempt = pendingRef.current;
    if (!attempt) return true;
    if (!userId || !writable) return false;
    cancelScheduledDraftCache();

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

        if (!latest || latest.token === attempt.token) {
          pendingRef.current = null;
          await cache(saved, attempt.data, revisionOf(saved), false);
          setSyncState("synced");
          return true;
        } else {
          latest.item = saved;
          latest.baseRevision = revisionOf(saved);
          await cache(saved, latest.data, latest.baseRevision, true);
          setSyncState("local-draft");
          return false;
        }
      } catch (error) {
        if (error instanceof DataSyncConflictError) {
          const rescue = pendingRef.current ?? attempt;
          try {
            await preserveConflict(rescue);
            return true;
          } catch (rescueError) {
            pendingRef.current = rescue;
            await cache(rescue.item, rescue.data, rescue.baseRevision, true);
            setSyncState("local-draft");
            console.warn(`[${type}] 冲突副本创建失败`, rescueError);
            toast.error("云端存在冲突，本机草稿已保留，联网后将重试");
            return false;
          }
        }
        const latest = pendingRef.current ?? attempt;
        pendingRef.current = latest;
        await cache(latest.item, latest.data, latest.baseRevision, true);
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setSyncState(offline ? "local-draft" : "error");
        console.warn(`[${type}] 保存到云端失败`, error);
        if (!offline) {
          const message = (error as { message?: string })?.message ?? "";
          toast.error(
            message.includes("data_revision")
              ? `请先在 Supabase 执行 ${migration}`
              : "保存失败，本机草稿已保留"
          );
        }
        return false;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = task;
    return task;
  }, [cache, cancelScheduledDraftCache, migration, preserveConflict, serialize, type, userId, writable]);

  flushRef.current = flush;

  const update = useCallback((updater: (previous: T) => T) => {
    if (!writable) return;
    const next = updater(dataRef.current);
    dataRef.current = next;
    setData(next);
    const current = itemRef.current;
    if (!current || !userId || !writable) return;
    const token = ++editTokenRef.current;
    const baseRevision = pendingRef.current?.baseRevision ?? revisionOf(current);
    const pending = { item: current, data: next, baseRevision, token };
    pendingRef.current = pending;
    scheduleDraftCache(pending);
    setSyncState("local-draft");
  }, [scheduleDraftCache, userId, writable]);

  const select = useCallback(
    (candidate: LnpSavedItem, options?: { allowDirtySwitch?: boolean }) => {
      if (!userId) return false;
      const previous = pendingRef.current;
      if (
        previous &&
        previous.item.id !== candidate.id &&
        !options?.allowDirtySwitch
      ) {
        return false;
      }
      const requestToken = ++selectTokenRef.current;
      setSyncState("pulling");
      void (async () => {
        // Switching never writes to Supabase. Make the previous local draft
        // durable first, then use a version-matched local body when possible.
        if (previous) {
          cancelScheduledDraftCache();
          await cache(previous.item, previous.data, previous.baseRevision, true);
        }

        const cached = await getWorkbenchCache(userId, type, candidate.id, scope).catch(() => null);
        if (requestToken !== selectTokenRef.current) return;
        const summaryRevision = revisionOf(candidate);
        const cachedDecision = decideCachedSelection(cached, summaryRevision);
        if (cached && cachedDecision !== "fetch-cloud") {
          const cachedIsNewer = cached.baseRevision > summaryRevision;
          const row: LnpSavedItem = {
            ...cached.item,
            ...candidate,
            data: cached.data,
            data_revision: cachedIsNewer ? cached.baseRevision : summaryRevision,
            updated_at: cachedIsNewer ? cached.item.updated_at : candidate.updated_at,
          };
          const value = parse(cached.data);
          pendingRef.current = cached.dirty
            ? {
                item: row,
                data: value,
                baseRevision: cached.baseRevision,
                token: ++editTokenRef.current,
              }
            : null;
          adopt(row, value, cached.dirty ? "local-draft" : "synced");
          setLastSavedAt(new Date(row.updated_at));
          if (cachedDecision === "preserve-conflict") {
            toast.warning("云端已有新版本；点击保存时会把本机内容保留为冲突副本");
          }
          return;
        }

        let cloud: LnpSavedItem | null = null;
        try {
          cloud = await getItem(candidate.id);
        } catch {
          if (requestToken !== selectTokenRef.current) return;
          if (!cached) {
            setSyncState(previous ? "local-draft" : "error");
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
            toast.warning("云端记录已删除，本机草稿仍在；点击保存可创建冲突副本");
          } else {
            await deleteWorkbenchCache(userId, type, candidate.id, scope).catch(() => undefined);
            setSyncState(previous ? "local-draft" : "error");
            toast.error("该记录已被删除");
          }
          return;
        }

        pendingRef.current = null;
        const value = parse(cloud.data);
        adopt(cloud, value, "synced");
        setLastSavedAt(new Date(cloud.updated_at));
        await cache(cloud, value, revisionOf(cloud), false);
      })();
      return true;
    },
    [adopt, cache, cancelScheduledDraftCache, parse, scope, type, userId]
  );

  const clear = useCallback((discardLocalDraft = false) => {
    const current = itemRef.current;
    cancelScheduledDraftCache();
    selectTokenRef.current += 1;
    itemRef.current = null;
    pendingRef.current = null;
    dataRef.current = empty();
    setItem(null);
    setData(dataRef.current);
    setSyncState("idle");
    setLastSavedAt(null);
    if (discardLocalDraft && current && userId) {
      void deleteWorkbenchCache(userId, type, current.id, scope).catch(() => undefined);
    }
  }, [cancelScheduledDraftCache, empty, scope, type, userId]);

  const saveDraftToPersonal = useCallback(async () => {
    const current = itemRef.current;
    if (!current || !userId || scope.kind !== "project") return null;
    cancelScheduledDraftCache();
    const copy = await createItem({
      type,
      is_folder: false,
      parent_id: null,
      name: `${current.name}（个人草稿）`,
      data: serialize(dataRef.current),
      sort_order: current.sort_order + 1,
    }, PERSONAL_SCOPE);
    pendingRef.current = null;
    await deleteWorkbenchCache(userId, type, current.id, scope).catch(() => undefined);
    setSyncState("personal-copy");
    toast.success(`本机内容已保存到「我的数据 / ${copy.name}」`);
    return copy;
  }, [cancelScheduledDraftCache, scope, serialize, type, userId]);

  const save = useCallback(async () => {
    return flushRef.current();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && pendingRef.current) {
        event.preventDefault();
        void flushRef.current();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!pendingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
      cancelScheduledDraftCache();
      const pending = pendingRef.current;
      if (pending) void cache(pending.item, pending.data, pending.baseRevision, true);
    };
  }, [cache, cancelScheduledDraftCache]);

  return {
    item,
    data,
    update,
    select,
    clear,
    save,
    dirty: syncState === "local-draft" || syncState === "error",
    syncState,
    saving: syncState === "saving" || syncState === "pulling",
    lastSavedAt,
    refreshToken,
    saveDraftToPersonal,
  };
}

export function cachedEntryToItem(entry: WorkbenchCacheEntry): LnpSavedItem {
  return { ...entry.item, data: entry.data };
}
