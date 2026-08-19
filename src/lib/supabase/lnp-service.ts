import { createClient } from "./client";
import { PERSONAL_SCOPE, type DataScope } from "@/lib/projects/types";

export type LnpItemType =
  | "formula"
  | "preparation"
  | "screening_session"
  | "ribogreen_curve"
  | "ribogreen_result"
  | "tlnp_experiment"
  | "protein"
  | "cl4b_preset"
  | "ivt_batch"
  | "ivt_template";

export interface LnpSavedItem {
  id: string;
  user_id: string;
  project_id: string | null;
  last_modified_by: string | null;
  type: LnpItemType;
  is_folder: boolean;
  parent_id: string | null;
  name: string;
  data: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** Server-maintained revision of `data`; migration 008. */
  data_revision: number;
}

export type LnpSavedItemSummary = Omit<LnpSavedItem, "data">;

const ITEM_SUMMARY_COLUMNS = [
  "id",
  "user_id",
  "project_id",
  "last_modified_by",
  "type",
  "is_folder",
  "parent_id",
  "name",
  "sort_order",
  "created_at",
  "updated_at",
  "data_revision",
].join(",");

const ITEM_COLUMNS = `${ITEM_SUMMARY_COLUMNS},data`;

export interface TreeNode extends LnpSavedItem {
  children: TreeNode[];
}

export async function listAllItems(
  type: LnpItemType,
  scope: DataScope = PERSONAL_SCOPE
): Promise<LnpSavedItem[]> {
  const supabase = createClient();
  let query = supabase
    .from("lnp_saved_items")
    .select(ITEM_COLUMNS)
    .eq("type", type);
  query = scope.kind === "personal"
    ? query.is("project_id", null)
    : query.eq("project_id", scope.projectId);
  const { data, error } = await query
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as LnpSavedItem[];
}

/** Lightweight tree/list rows. Large workbench JSON payloads are loaded by id. */
export async function listItemSummaries(
  type: LnpItemType,
  scope: DataScope = PERSONAL_SCOPE
): Promise<LnpSavedItemSummary[]> {
  const supabase = createClient();
  let query = supabase
    .from("lnp_saved_items")
    .select(ITEM_SUMMARY_COLUMNS)
    .eq("type", type);
  query = scope.kind === "personal"
    ? query.is("project_id", null)
    : query.eq("project_id", scope.projectId);
  const { data, error } = await query
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as LnpSavedItemSummary[];
}

/** Single row by id — used by the cross-tab "open this record" links. */
export async function getItem(id: string): Promise<LnpSavedItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lnp_saved_items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as LnpSavedItem | null) ?? null;
}

export async function createItem(
  item: Pick<
    LnpSavedItem,
    "type" | "is_folder" | "parent_id" | "name" | "data" | "sort_order"
  >,
  scope: DataScope = PERSONAL_SCOPE
): Promise<LnpSavedItem> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("lnp_saved_items")
    .insert({
      ...item,
      user_id: user.id,
      project_id: scope.kind === "project" ? scope.projectId : null,
      last_modified_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as LnpSavedItem;
}

export async function renameItem(id: string, name: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lnp_saved_items")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export class DataSyncConflictError extends Error {
  readonly current: LnpSavedItem | null;

  constructor(current: LnpSavedItem | null) {
    super(current ? "Cloud record has a newer data revision" : "Cloud record was deleted");
    this.name = "DataSyncConflictError";
    this.current = current;
  }
}

/**
 * Replace a row's JSON payload.
 *
 * Workbenches pass `expectedRevision` so Postgres performs an atomic
 * compare-and-swap. Explicit-save legacy callers may omit it; they never
 * autosave a stale in-memory document and are outside the workbench sync scope.
 */
export async function updateItemData(
  id: string,
  data: Record<string, unknown>,
  expectedRevision?: number
): Promise<LnpSavedItem> {
  const supabase = createClient();
  let query = supabase
    .from("lnp_saved_items")
    .update({ data })
    .eq("id", id);
  if (expectedRevision !== undefined) {
    query = query.eq("data_revision", expectedRevision);
  }
  // The caller already owns the payload it just wrote. Returning it again can
  // double the network and JSON cost for large experiment notebooks.
  const { data: row, error } = await query.select(ITEM_SUMMARY_COLUMNS).maybeSingle();
  if (error) throw error;
  if (!row) {
    throw new DataSyncConflictError(await getItem(id));
  }
  return { ...(row as unknown as LnpSavedItemSummary), data };
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lnp_saved_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function deleteItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("lnp_saved_items")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

export async function duplicateItem(id: string): Promise<LnpSavedItem> {
  const supabase = createClient();
  const { data: src, error: readErr } = await supabase
    .from("lnp_saved_items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .single();
  if (readErr) throw readErr;
  const s = src as unknown as LnpSavedItem;

  const scope: DataScope = s.project_id
    ? { kind: "project", projectId: s.project_id, role: "admin", status: "active" }
    : PERSONAL_SCOPE;
  return await createItem({
    type: s.type,
    is_folder: s.is_folder,
    parent_id: s.parent_id,
    name: `${s.name} (副本)`,
    data: s.data,
    sort_order: s.sort_order + 1,
  }, scope);
}

export async function moveItem(
  id: string,
  parentId: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lnp_saved_items")
    .update({ parent_id: parentId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function reorderItems(orderedIds: string[]): Promise<void> {
  const supabase = createClient();
  const promises = orderedIds.map((id, i) =>
    supabase.from("lnp_saved_items").update({ sort_order: i }).eq("id", id)
  );
  const results = await Promise.all(promises);
  for (const r of results) {
    if (r.error) throw r.error;
  }
}

export function buildTree(items: LnpSavedItem[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const item of items) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
