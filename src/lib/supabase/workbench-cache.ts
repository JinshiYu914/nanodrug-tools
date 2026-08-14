import type { LnpItemType, LnpSavedItem } from "./lnp-service";
import { listAllItems } from "./lnp-service";
import { PERSONAL_SCOPE, scopeKey, type DataScope } from "@/lib/projects/types";

export type SyncedWorkbenchType =
  | "tlnp_experiment"
  | "ivt_batch"
  | "screening_session";

export interface WorkbenchCacheEntry {
  key: string;
  userId: string;
  type: SyncedWorkbenchType;
  itemId: string;
  scopeKey?: string;
  item: LnpSavedItem;
  data: Record<string, unknown>;
  baseRevision: number;
  dirty: boolean;
  localUpdatedAt: string;
}

const DB_NAME = "lnp-partner-workbench-cache";
const DB_VERSION = 2;
const STORE = "records";

const keyOf = (userId: string, type: SyncedWorkbenchType, itemId: string, scope: DataScope) =>
  `${userId}:${scopeKey(scope)}:${type}:${itemId}`;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("userAndType", ["userId", "type"], { unique: false });
      } else if ((event as IDBVersionChangeEvent).oldVersion < 2) {
        // v1 personal drafts used user:type:item keys. Preserve them under the
        // explicit personal scope instead of abandoning a possibly dirty lab note.
        const store = request.transaction!.objectStore(STORE);
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const hit = cursor.result;
          if (!hit) return;
          const entry = hit.value as WorkbenchCacheEntry;
          if (!entry.scopeKey) {
            const migrated = {
              ...entry,
              scopeKey: "personal",
              key: `${entry.userId}:personal:${entry.type}:${entry.itemId}`,
            };
            store.put(migrated);
            store.delete(hit.primaryKey);
          }
          hit.continue();
        };
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
  itemId: string,
  scope: DataScope = PERSONAL_SCOPE
): Promise<WorkbenchCacheEntry | null> {
  const result = await requestResult(
    "readonly",
    (store) => store.get(keyOf(userId, type, itemId, scope)) as IDBRequest<WorkbenchCacheEntry>
  );
  return result ?? null;
}

export async function putWorkbenchCache(
  entry: Omit<WorkbenchCacheEntry, "key">,
  scope: DataScope = PERSONAL_SCOPE
): Promise<void> {
  await requestResult("readwrite", (store) =>
    store.put({ ...entry, scopeKey: scopeKey(scope), key: keyOf(entry.userId, entry.type, entry.itemId, scope) })
  );
}

export async function deleteWorkbenchCache(
  userId: string,
  type: SyncedWorkbenchType,
  itemId: string,
  scope: DataScope = PERSONAL_SCOPE
): Promise<void> {
  await requestResult("readwrite", (store) =>
    store.delete(keyOf(userId, type, itemId, scope))
  );
}

export async function listWorkbenchCache(
  userId: string,
  type: SyncedWorkbenchType,
  scope: DataScope = PERSONAL_SCOPE
): Promise<WorkbenchCacheEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("userAndType");
    const request = index.getAll(IDBKeyRange.only([userId, type]));
    request.onsuccess = () => resolve((request.result as WorkbenchCacheEntry[]).filter(
      (entry) => (entry.scopeKey ?? "personal") === scopeKey(scope)
    ));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

/** Cloud-first list with cached records as an offline-only fallback. */
export async function listSyncedWorkbenchItems(
  userId: string,
  type: SyncedWorkbenchType,
  scope: DataScope = PERSONAL_SCOPE
): Promise<LnpSavedItem[]> {
  try {
    const rows = await listAllItems(type, scope);
    await cacheCloudItems(userId, type, rows, scope);
    const cached = await listWorkbenchCache(userId, type, scope);
    const cloudIds = new Set(rows.map((row) => row.id));
    const missingDirty = cached.filter((entry) => entry.dirty && !cloudIds.has(entry.itemId));
    for (const entry of cached) {
      if (!entry.dirty && !cloudIds.has(entry.itemId)) {
        await deleteWorkbenchCache(userId, type, entry.itemId, scope);
      }
    }
    // A locally edited record deleted on another device stays selectable long
    // enough for the hook to rescue it as a conflict copy.
    return [
      ...rows,
      ...missingDirty.map((entry) => ({ ...entry.item, data: entry.data })),
    ];
  } catch (error) {
    const cached = await listWorkbenchCache(userId, type, scope);
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
  items: LnpSavedItem[],
  scope: DataScope = PERSONAL_SCOPE
): Promise<void> {
  for (const item of items) {
    if (item.is_folder || !item.data) continue;
    const current = await getWorkbenchCache(userId, type, item.id, scope);
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
      scopeKey: scopeKey(scope),
    }, scope);
  }
}

export async function clearWorkbenchCacheForUser(userId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const request = store.index("userId").getAll(IDBKeyRange.only(userId));
    request.onsuccess = () => {
      for (const entry of request.result as WorkbenchCacheEntry[]) store.delete(entry.key);
    };
    request.onerror = () => reject(request.error);
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
