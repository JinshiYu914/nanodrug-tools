/**
 * The two cross-batch libraries: proteins and CL-4B column presets.
 *
 * Both are flat lists of `lnp_saved_items` rows (types `protein` and
 * `cl4b_preset`), so they inherit the same RLS scoping as everything else and
 * needed no new table. Access goes through here rather than from components, in
 * keeping with the service-module pattern.
 *
 * A library row is a *starting point*, never a live reference. Callers copy the
 * values into the batch; renaming or deleting a library entry afterwards must
 * not change what a finished experiment says was used.
 */

import {
  createItem,
  deleteItem,
  listAllItems,
  renameItem,
  updateItemData,
  type LnpSavedItem,
} from "./lnp-service";
import type { Cl4bParams, ProteinConcUnit } from "@/lib/calculations/tlnp-experiment";

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

// ─── Proteins ─────────────────────────────────────────────

export interface ProteinLibraryItem {
  id: string;
  name: string;
  mw: string;
  conc: string;
  concUnit: ProteinConcUnit;
  note: string;
}

function parseProteinRow(row: LnpSavedItem): ProteinLibraryItem {
  const d = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    mw: str(d.mw),
    conc: str(d.conc),
    concUnit: d.concUnit === "uM" ? "uM" : "mg_per_mL",
    note: str(d.note),
  };
}

export async function listProteins(): Promise<ProteinLibraryItem[]> {
  const rows = await listAllItems("protein");
  return rows.filter((r) => !r.is_folder).map(parseProteinRow);
}

export async function saveProtein(
  p: Omit<ProteinLibraryItem, "id">
): Promise<ProteinLibraryItem> {
  const row = await createItem({
    type: "protein",
    is_folder: false,
    parent_id: null,
    name: p.name.trim() || "未命名蛋白",
    data: { mw: p.mw, conc: p.conc, concUnit: p.concUnit, note: p.note },
    sort_order: 0,
  });
  return parseProteinRow(row);
}

export async function updateProtein(p: ProteinLibraryItem): Promise<void> {
  await renameItem(p.id, p.name.trim() || "未命名蛋白");
  await updateItemData(p.id, {
    mw: p.mw,
    conc: p.conc,
    concUnit: p.concUnit,
    note: p.note,
  });
}

export const deleteProtein = (id: string) => deleteItem(id);

// ─── CL-4B column presets ─────────────────────────────────

export interface Cl4bPresetItem extends Cl4bParams {
  id: string;
  name: string;
}

function parseCl4bRow(row: LnpSavedItem): Cl4bPresetItem {
  const d = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    columnLength: str(d.columnLength),
    columnDiameter: str(d.columnDiameter),
    flowRate: str(d.flowRate),
    buffer: str(d.buffer),
  };
}

export async function listCl4bPresets(): Promise<Cl4bPresetItem[]> {
  const rows = await listAllItems("cl4b_preset");
  return rows.filter((r) => !r.is_folder).map(parseCl4bRow);
}

export async function saveCl4bPreset(
  name: string,
  p: Cl4bParams
): Promise<Cl4bPresetItem> {
  const row = await createItem({
    type: "cl4b_preset",
    is_folder: false,
    parent_id: null,
    name: name.trim() || "未命名柱子",
    data: {
      columnLength: p.columnLength,
      columnDiameter: p.columnDiameter,
      flowRate: p.flowRate,
      buffer: p.buffer,
    },
    sort_order: 0,
  });
  return parseCl4bRow(row);
}

export const deleteCl4bPreset = (id: string) => deleteItem(id);
