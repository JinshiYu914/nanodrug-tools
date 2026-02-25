import { createClient } from "./client";

export interface LnpSavedItem {
  id: string;
  user_id: string;
  type: "formula" | "preparation";
  is_folder: boolean;
  parent_id: string | null;
  name: string;
  data: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TreeNode extends LnpSavedItem {
  children: TreeNode[];
}

export async function listAllItems(
  type: "formula" | "preparation"
): Promise<LnpSavedItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lnp_saved_items")
    .select("*")
    .eq("type", type)
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LnpSavedItem[];
}

export async function createItem(
  item: Pick<
    LnpSavedItem,
    "type" | "is_folder" | "parent_id" | "name" | "data" | "sort_order"
  >
): Promise<LnpSavedItem> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("lnp_saved_items")
    .insert({ ...item, user_id: user.id })
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

export async function deleteItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lnp_saved_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
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
