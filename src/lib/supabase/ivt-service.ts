import {
  createItem,
  deleteItem,
  listAllItems,
  type LnpSavedItem,
} from "./lnp-service";
import {
  parseIvtTemplatePayload,
  type IvtTemplateKind,
  type IvtTemplatePayload,
} from "@/lib/calculations/ivt-experiment";

export interface IvtTemplateItem {
  id: string;
  name: string;
  kind: IvtTemplateKind;
  payload: IvtTemplatePayload;
}

function parseTemplateRow(row: LnpSavedItem): IvtTemplateItem | null {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const payload = parseIvtTemplatePayload(data.payload);
  const kind = data.kind;
  if (
    (kind !== "linearization" && kind !== "ivt" && kind !== "purification") ||
    !payload ||
    payload.kind !== kind
  ) {
    return null;
  }
  return { id: row.id, name: row.name, kind, payload };
}

export async function listIvtBatches(): Promise<LnpSavedItem[]> {
  return listAllItems("ivt_batch");
}

export async function listIvtTemplates(
  kind: IvtTemplateKind
): Promise<IvtTemplateItem[]> {
  const rows = await listAllItems("ivt_template");
  return rows
    .filter((row) => !row.is_folder)
    .map(parseTemplateRow)
    .filter((item): item is IvtTemplateItem => item?.kind === kind);
}

export async function saveIvtTemplate(
  name: string,
  payload: IvtTemplatePayload
): Promise<IvtTemplateItem> {
  const row = await createItem({
    type: "ivt_template",
    is_folder: false,
    parent_id: null,
    name: name.trim() || "未命名模板",
    data: { kind: payload.kind, payload } as unknown as Record<string, unknown>,
    sort_order: 0,
  });
  return {
    id: row.id,
    name: row.name,
    kind: payload.kind,
    payload,
  };
}

export const deleteIvtTemplate = (id: string) => deleteItem(id);
