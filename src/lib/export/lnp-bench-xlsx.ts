import * as XLSX from "xlsx";
import {
  composeLipidSummary,
  composeRatioSummary,
  computeBenchFormulation,
  type BenchFormulation,
} from "@/lib/calculations/lnp-bench";

type Cell = string | number | null;
type Row = Cell[];

const HEADER: string[] = [
  "#",
  "配方名称",
  "行类型",
  "Ionizable",
  "Helper",
  "Cholesterol",
  "PEG",
  "其他",
  "N/P",
  "脂相浓度 (mM)",
  "FRR",
  "RNA (µg)",
  "RNA 浓度 (µg/µL)",
  "Lipid Mix 总浓度 (mM)",
  "Lipid Mix 总体积 (µL)",
  "水相 Total (µL)",
  "脂相 Total (µL)",
  "摘要",
];

function cellCompositionText(e: {
  isCustomLipid: boolean;
  lipidName: string;
  customLipidName: string;
  molarRatio: string;
  molarWeight: string;
  stockConc: string;
}): string {
  const name = e.isCustomLipid ? e.customLipidName : e.lipidName;
  return `${name || "?"}, ${e.molarRatio || "0"}%, MW ${e.molarWeight || "?"}, Stock ${e.stockConc || "?"} mg/mL`;
}

function cellVolumeText(uL: number | undefined): string {
  if (uL === undefined || uL === null || isNaN(uL)) return "--";
  if (uL >= 1000) return `${(uL / 1000).toFixed(3)} mL`;
  return `${uL.toFixed(2)} µL`;
}

/**
 * Produce two sheet rows per formulation:
 *   Row A — composition (name/ratio/MW/stock per lipid slot)
 *   Row B — aspirate volumes (per-lipid stock volume + aqueous/organic totals)
 * The name column (col B) is merged across the two rows.
 */
function buildRows(formulations: BenchFormulation[]): {
  rows: Row[];
  merges: XLSX.Range[];
} {
  const rows: Row[] = [HEADER];
  const merges: XLSX.Range[] = [];

  formulations.forEach((f, i) => {
    const { stockVolumes, prepVolumes, totalConc } =
      computeBenchFormulation(f);

    const byType: Record<string, (typeof f.lipidEntries)[number] | undefined> = {
      ionizable: undefined,
      helper: undefined,
      cholesterol: undefined,
      peg: undefined,
    };
    const extras: typeof f.lipidEntries = [];
    for (const e of f.lipidEntries) {
      if (e.typeKey in byType) byType[e.typeKey] = e;
      else extras.push(e);
    }

    const topRow: Row = [
      i + 1,
      f.name || "(未命名)",
      "组成",
      byType.ionizable ? cellCompositionText(byType.ionizable) : "",
      byType.helper ? cellCompositionText(byType.helper) : "",
      byType.cholesterol ? cellCompositionText(byType.cholesterol) : "",
      byType.peg ? cellCompositionText(byType.peg) : "",
      extras.map(cellCompositionText).join(" | "),
      f.prep.npRatio || "",
      f.prep.masterConc || "",
      `${f.prep.frrAqueous}:${f.prep.frrOrganic}`,
      f.prep.rnaMass || "",
      f.prep.rnaConc || "",
      totalConc ? Number(totalConc.mM.toFixed(3)) : "",
      "",
      "",
      "",
      `${composeLipidSummary(f)} (${composeRatioSummary(f)})`,
    ];

    const vol = (typeKey: string): string => {
      const entry = byType[typeKey];
      if (!entry) return "";
      return cellVolumeText(stockVolumes?.[entry.id]?.uL);
    };
    const extrasVol = extras
      .map((e) => `${e.customLipidName || e.lipidName || "?"}: ${cellVolumeText(stockVolumes?.[e.id]?.uL)}`)
      .join(" | ");

    const bottomRow: Row = [
      "",
      "",
      "吸取体积",
      vol("ionizable"),
      vol("helper"),
      vol("cholesterol"),
      vol("peg"),
      extrasVol,
      "",
      "",
      "",
      "",
      "",
      "",
      prepVolumes.lipidMix_uL !== null
        ? Number(prepVolumes.lipidMix_uL.toFixed(2))
        : "",
      prepVolumes.aqueousTotal_uL !== null
        ? Number(prepVolumes.aqueousTotal_uL.toFixed(2))
        : "",
      prepVolumes.organicTotal_uL !== null
        ? Number(prepVolumes.organicTotal_uL.toFixed(2))
        : "",
      "",
    ];

    rows.push(topRow, bottomRow);

    // Merge cells for # and 配方名称 columns (cols 0, 1) across both rows.
    const topRowIdx = rows.length - 2;
    const bottomRowIdx = rows.length - 1;
    merges.push(
      { s: { r: topRowIdx, c: 0 }, e: { r: bottomRowIdx, c: 0 } },
      { s: { r: topRowIdx, c: 1 }, e: { r: bottomRowIdx, c: 1 } }
    );
  });

  return { rows, merges };
}

export function exportBenchToXlsx(
  sessionName: string,
  createdAt: string,
  updatedAt: string,
  formulations: BenchFormulation[]
): void {
  if (formulations.length === 0) return;

  const { rows, merges } = buildRows(formulations);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;

  // Column widths.
  ws["!cols"] = [
    { wch: 4 }, // #
    { wch: 22 }, // 配方名称
    { wch: 10 }, // 行类型
    { wch: 32 }, // Ionizable
    { wch: 28 }, // Helper
    { wch: 28 }, // Cholesterol
    { wch: 30 }, // PEG
    { wch: 24 }, // 其他
    { wch: 6 }, // N/P
    { wch: 14 }, // 脂相浓度
    { wch: 8 }, // FRR
    { wch: 10 }, // RNA
    { wch: 16 }, // RNA 浓度
    { wch: 18 }, // Lipid Mix 总浓度
    { wch: 18 }, // Lipid Mix 总体积
    { wch: 16 }, // 水相
    { wch: 16 }, // 脂相
    { wch: 40 }, // 摘要
  ];

  // Prepend a metadata row via second sheet for context.
  const meta = XLSX.utils.aoa_to_sheet([
    ["筛选会话", sessionName],
    ["创建时间", formatIso(createdAt)],
    ["最近更新", formatIso(updatedAt)],
    ["导出时间", formatNow()],
    ["配方数量", formulations.length],
    [],
    ["说明", "Lipid Mix 体积为刚好覆盖所需 RNA 用量的理论值（零余量）"],
  ]);
  meta["!cols"] = [{ wch: 18 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Formulations");
  XLSX.utils.book_append_sheet(wb, meta, "Session");

  const filename = `${sanitizeFilename(sessionName)}-${datestamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── Helpers ──────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatIso(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "lnp-screening";
}
