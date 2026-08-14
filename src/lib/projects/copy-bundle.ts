import type { LnpSavedItem } from "@/lib/supabase/lnp-service";

export interface CopyBundleEntry {
  source_id: string;
  id: string;
  type: LnpSavedItem["type"];
  name: string;
  data: Record<string, unknown> | null;
  sort_order: number;
}

export interface CopyBundlePreview {
  root: LnpSavedItem;
  linkedRibogreen: LnpSavedItem[];
  missingLinkedIds: string[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function visit(value: unknown, fn: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry) => visit(entry, fn));
    return;
  }
  const node = value as Record<string, unknown>;
  fn(node);
  Object.values(node).forEach((entry) => visit(entry, fn));
}

export function linkedRibogreenIds(root: LnpSavedItem): string[] {
  const ids = new Set<string>();
  visit(root.data, (node) => {
    const link = node.link;
    if (link && typeof link === "object") {
      const itemId = (link as Record<string, unknown>).itemId;
      if (typeof itemId === "string") ids.add(itemId);
    }
  });
  return [...ids];
}

export function previewCopyBundle(
  root: LnpSavedItem,
  accessibleRibogreen: LnpSavedItem[]
): CopyBundlePreview {
  const wanted = linkedRibogreenIds(root);
  const byId = new Map(accessibleRibogreen.map((item) => [item.id, item]));
  const reverseLinked = accessibleRibogreen.filter((item) => {
    let linked = false;
    visit(item.data, (node) => {
      if (node.sourceSessionId === root.id) linked = true;
    });
    return linked;
  });
  const linkedIds = new Set(wanted);
  reverseLinked.forEach((item) => linkedIds.add(item.id));
  return {
    root,
    linkedRibogreen: [...linkedIds].map((id) => byId.get(id)).filter(Boolean) as LnpSavedItem[],
    missingLinkedIds: wanted.filter((id) => !byId.has(id)),
  };
}

export function buildCopyBundle(
  preview: CopyBundlePreview,
  uuid: () => string = () => crypto.randomUUID()
): CopyBundleEntry[] {
  const all = [preview.root, ...preview.linkedRibogreen];
  const idMap = new Map(all.map((item) => [item.id, uuid()]));

  return all.map((item, index) => {
    const data = clone(item.data);
    visit(data, (node) => {
      if (typeof node.itemId === "string" && idMap.has(node.itemId)) {
        node.itemId = idMap.get(node.itemId)!;
      }
      if (typeof node.sourceSessionId === "string" && idMap.has(node.sourceSessionId)) {
        node.sourceSessionId = idMap.get(node.sourceSessionId)!;
      }
      const link = node.link;
      if (link && typeof link === "object") {
        const target = link as Record<string, unknown>;
        if (typeof target.itemId === "string" && idMap.has(target.itemId)) {
          target.itemId = idMap.get(target.itemId)!;
        } else if (
          typeof target.itemId === "string" &&
          preview.missingLinkedIds.includes(target.itemId)
        ) {
          target.sourceUnavailable = true;
        }
      }
    });
    return {
      source_id: item.id,
      id: idMap.get(item.id)!,
      type: item.type,
      name: index === 0 ? `${item.name}（课题副本）` : item.name,
      data,
      sort_order: item.sort_order,
    };
  });
}
