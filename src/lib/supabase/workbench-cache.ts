import type { LnpItemType, LnpSavedItem } from "./lnp-service";
import { listAllItems } from "./lnp-service";

export type SyncedWorkbenchType =
  | "tlnp_experiment"
  | "ivt_batch"
  | "screening_session";

export interface WorkbenchCacheEntry {
  key: string;
  userId: string;
  type: SyncedWorkbenchType;
  itemId: string;
  item: LnpSavedItem;
  data: Record<string, unknown>;
  baseRevision: number;
  dirty: boolean;
  localUpdatedAt: string;
}

const DB_NAME = "lnp-partner-workbench-cache";
const DB_VERSION = 1;
const STORE = "records";

const keyOf = (userId: string, type: SyncedWorkbenchType, itemId: string) =>
  `${userId}:${type}:${itemId}`;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("userAndType", ["userId", "type"], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function requestResult<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => reject(tx.error);
  });
}

export function revisionOf(item: Pick<LnpSavedItem, "data_revision">): number {
  const value = Number(item.data_revision);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export async function getWorkbenchCache(
  userId: string,
  type: SyncedWorkbenchType,
  itemId: string
): Promise<WorkbenchCacheEntry | null> {
  const result = await requestResult(
    "readonly",
    (store) => store.get(keyOf(userId, type, itemId)) as IDBRequest<WorkbenchCacheEntry>
  );
  return result ?? null;
}

export async function putWorkbenchCache(
  entry: Omit<WorkbenchCacheEntry, "key">
): Promise<void> {
  await requestResult("readwrite", (store) =>
    store.put({ ...entry, key: keyOf(entry.userId, entry.type, entry.itemId) })
  );
}

export async function deleteWorkbenchCache(
  userId: string,
  type: SyncedWorkbenchType,
  itemId: string
): Promise<void> {
  await requestResult("readwrite", (store) =>
    store.delete(keyOf(userId, type, itemId))
  );
}

export async function listWorkbenchCache(
  userId: string,
  type: SyncedWorkbenchType
): Promise<WorkbenchCacheEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("userAndType");
    const request = index.getAll(IDBKeyRange.only([userId, type]));
    request.onsuccess = () => resolve(request.result as WorkbenchCacheEntry[]);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

/** Cloud-first list with cached records as an offline-only fallback. */
export async function listSyncedWorkbenchItems(
  userId: string,
  type: SyncedWorkbenchType
): Promise<LnpSavedItem[]> {
  try {
    const rows = await listAllItems(type);
    await cacheCloudItems(userId, type, rows);
    const cached = await listWorkbenchCache(userId, type);
    const cloudIds = new Set(rows.map((row) => row.id));
    const missingDirty = cached.filter((entry) => entry.dirty && !cloudIds.has(entry.itemId));
    for (const entry of cached) {
      if (!entry.dirty && !cloudIds.has(entry.itemId)) {
        await deleteWorkbenchCache(userId, type, entry.itemId);
      }
    }
    // A locally edited record deleted on another device stays selectable long
    // enough for the hook to rescue it as a conflict copy.
    return [
      ...rows,
      ...missingDirty.map((entry) => ({ ...entry.item, data: entry.data })),
    ];
  } catch (error) {
    const cached = await listWorkbenchCache(userId, type);
    if (cached.length === 0) throw error;
    return cached
      .map((entry) => ({ ...entry.item, data: entry.data }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

/** Cache cloud rows without ever replacing a local unsynced draft. */
export async function cacheCloudItems(
  userId: string,
  type: SyncedWorkbenchType,
  items: LnpSavedItem[]
): Promise<void> {
  for (const item of items) {
    if (item.is_folder || !item.data) continue;
    const current = await getWorkbenchCache(userId, type, item.id);
    if (current?.dirty) continue;
    await putWorkbenchCache({
      userId,
      type,
      itemId: item.id,
      item,
      data: item.data,
      baseRevision: revisionOf(item),
      dirty: false,
      localUpdatedAt: item.updated_at,
    });
  }
}

export async function clearWorkbenchCacheForUser(userId: string): Promise<void> {
  const entries = await Promise.all(
    (["tlnp_experiment", "ivt_batch", "screening_session"] as const).map((type) =>
      listWorkbenchCache(userId, type)
    )
  );
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const entry of entries.flat()) store.delete(entry.key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export function isSyncedWorkbenchType(type: LnpItemType): type is SyncedWorkbenchType {
  return type === "tlnp_experiment" || type === "ivt_batch" || type === "screening_session";
}
