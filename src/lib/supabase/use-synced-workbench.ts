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
import { decideCloudLoad } from "./sync-policy";
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
  select: (candidate: LnpSavedItem) => boolean;
  clear: (discardLocalDraft?: boolean) => void;
  save: () => Promise<void>;
  reloadFromCloud: () => Promise<void>;
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
  const inFlightRef = useRef<Promise<void> | null>(null);
  const reloadingRef = useRef(false);
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
    if (reloadingRef.current) return;
    if (inFlightRef.current) return inFlightRef.current;
    const attempt = pendingRef.current;
    if (!attempt || !userId || !writable) return;

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
        } else {
          latest.item = saved;
          latest.baseRevision = revisionOf(saved);
          await cache(saved, latest.data, latest.baseRevision, true);
          setSyncState("local-draft");
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
        console.warn(`[${type}] 保存到云端失败`, error);
        if (!offline) {
          const message = (error as { message?: string })?.message ?? "";
          toast.error(
            message.includes("data_revision")
              ? `请先在 Supabase 执行 ${migration}`
              : "保存失败，本机草稿已保留"
          );
        }
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = task;
    return task;
  }, [cache, migration, preserveConflict, serialize, type, userId, writable]);

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
    pendingRef.current = { item: current, data: next, baseRevision, token };
    void cache(current, next, baseRevision, true);
    setSyncState("local-draft");
  }, [cache, userId, writable]);

  const select = useCallback(
    (candidate: LnpSavedItem) => {
      if (!userId) return false;
      const previous = pendingRef.current;
      if (
        previous &&
        previous.item.id !== candidate.id &&
        !window.confirm("当前修改尚未保存到云端，但本机草稿会保留。是否仍要切换记录？")
      ) {
        return false;
      }
      const requestToken = ++selectTokenRef.current;
      setSyncState("pulling");
      void (async () => {
        // Switching never writes to Supabase. Make the previous local draft
        // durable first, then load the selected row cloud-first.
        if (previous) {
          await cache(previous.item, previous.data, previous.baseRevision, true);
        }
        let cloud: LnpSavedItem | null = null;
        try {
          cloud = await getItem(candidate.id);
        } catch {
          const cached = await getWorkbenchCache(userId, type, candidate.id, scope).catch(() => null);
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
          const cached = await getWorkbenchCache(userId, type, candidate.id, scope).catch(() => null);
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

        const cached = await getWorkbenchCache(userId, type, cloud.id, scope).catch(() => null);
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
          adopt(cloud, draft, "local-draft");
          if (decision === "preserve-conflict") {
            toast.warning("云端已有新版本；点击保存时会把本机内容保留为冲突副本");
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
    [adopt, cache, parse, scope, type, userId]
  );

  const clear = useCallback((discardLocalDraft = false) => {
    const current = itemRef.current;
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
  }, [empty, scope, type, userId]);

  const saveDraftToPersonal = useCallback(async () => {
    const current = itemRef.current;
    if (!current || !userId || scope.kind !== "project") return null;
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
  }, [scope, serialize, type, userId]);

  const reloadFromCloud = useCallback(async () => {
    const current = itemRef.current;
    if (!current || !userId || inFlightRef.current || reloadingRef.current) return;

    const pendingAtStart = pendingRef.current;
    if (
      pendingAtStart &&
      !window.confirm("从云端重新加载会放弃当前本机草稿。是否继续？")
    ) {
      return;
    }

    const requestToken = ++selectTokenRef.current;
    const editTokenAtStart = editTokenRef.current;
    setSyncState("pulling");
    reloadingRef.current = true;

    try {
      let cloud: LnpSavedItem | null;
      try {
        cloud = await getItem(current.id);
      } catch (error) {
        if (requestToken !== selectTokenRef.current) return;
        setSyncState(pendingRef.current ? "local-draft" : "synced");
        console.warn(`[${type}] 手动重新加载云端失败`, error);
        toast.error("无法从云端重新加载，当前内容未改变");
        return;
      }

      if (
        requestToken !== selectTokenRef.current ||
        itemRef.current?.id !== current.id
      ) {
        return;
      }

      // Editing remains available while the request is in flight. Never let a
      // slow manual reload overwrite a change made after the user clicked it.
      if (editTokenRef.current !== editTokenAtStart) {
        setSyncState("local-draft");
        toast.warning("重新加载期间发生了新修改，本机草稿未被覆盖");
        return;
      }

      if (!cloud) {
        if (pendingRef.current) {
          setSyncState("local-draft");
          toast.warning("云端记录已删除，本机草稿仍然保留");
        } else {
          await deleteWorkbenchCache(userId, type, current.id, scope).catch(() => undefined);
          setSyncState("error");
          toast.error("当前记录已从云端删除");
        }
        return;
      }

      pendingRef.current = null;
      const value = parse(cloud.data);
      adopt(cloud, value, "synced");
      setLastSavedAt(new Date(cloud.updated_at));
      await cache(cloud, value, revisionOf(cloud), false);
      toast.success("已从云端重新加载");
    } catch (error) {
      if (requestToken === selectTokenRef.current) {
        setSyncState(pendingRef.current ? "local-draft" : "synced");
        console.warn(`[${type}] 云端内容解析失败`, error);
        toast.error("云端内容无法载入，当前内容未改变");
      }
    } finally {
      reloadingRef.current = false;
    }
  }, [adopt, cache, parse, scope, type, userId]);

  const save = useCallback(async () => {
    await flushRef.current();
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
      const pending = pendingRef.current;
      if (pending) void cache(pending.item, pending.data, pending.baseRevision, true);
    };
  }, [cache]);

  return {
    item,
    data,
    update,
    select,
    clear,
    save,
    reloadFromCloud,
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
