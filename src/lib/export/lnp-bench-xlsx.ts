import * as XLSX from "xlsx-js-style";
import {
  computeBenchFormulation,
  type BenchFormulation,
} from "@/lib/calculations/lnp-bench";
import type { LipidEntry } from "@/lib/calculations/lnp-formula";

/**
 * Column layout (0-indexed) — one row per formulation with a two-row header.
 *
 *  0 序号 | 1 配方名称 | 2‑6 Lipid mix配置 | 7‑8 水相 | 9‑10 脂相 |
 *  11 水相总体积 | 12 脂相总体积 | 13 总体积 | 14‑16 制备参数
 *
 * Every data cell is a volume in µL (2 decimals) except 序号, N/P ratio (a
 * ratio), FRR (an "aqueous:organic" string) and 脂相浓度 (mM).
 *
 * The three 制备参数 columns all carry the user's typed input, never a derived
 * value — keep it that way.
 */
const COL = {
  index: 0,
  name: 1,
  ionizable: 2,
  helper: 3,
  cholesterol: 4,
  peg: 5,
  extras: 6,
  rna: 7,
  cb: 8,
  lipidMix: 9,
  ethanol: 10,
  aqTotal: 11,
  orTotal: 12,
  grandTotal: 13,
  np: 14,
  frr: 15,
  mixConc: 16,
} as const;
const N_COLS = 17;

const STANDARD_SLOTS = new Set(["ionizable", "helper", "cholesterol", "peg"]);

// ─── Palette (section-coded headers, matching the worksheet template) ─────
const FILL_LIPID_TOP = "B4C6E7"; // Lipid mix配置 — blue
const FILL_LIPID_SUB = "DDEBF7";
const FILL_AQ_TOP = "FCE4D6"; // 水相 — peach
const FILL_AQ_SUB = "FCEFE6";
const FILL_OR_TOP = "E2EFDA"; // 脂相 — green
const FILL_OR_SUB = "EDF6E6";
const FILL_NEUTRAL = "FFFFFF";

const thin = { style: "thin", color: { rgb: "000000" } } as const;
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

function headerStyle(fill: string) {
  return {
    font: { bold: true, sz: 10, color: { rgb: "000000" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    fill: { patternType: "solid", fgColor: { rgb: fill } },
    border: BORDER,
  };
}

// Numeric µL / mM cells (2-decimal display) and "plain" cells (序号, N/P, FRR)
// must use *separate* style objects: xlsx-js-style folds a cell's number
// format into its shared style, so mixing formatted and unformatted cells on
// one object leaks "0.00" onto the unformatted ones.
const numStyle = {
  font: { sz: 10 },
  alignment: { horizontal: "center", vertical: "center" },
  border: BORDER,
};

const plainStyle = {
  font: { sz: 10 },
  alignment: { horizontal: "center", vertical: "center" },
  border: BORDER,
};

const nameStyle = {
  font: { sz: 10 },
  alignment: { horizontal: "left", vertical: "center", wrapText: true },
  border: BORDER,
};

// Columns whose values are volumes/concentrations shown to 2 decimals.
const DECIMAL_COLS = new Set<number>([
  COL.ionizable,
  COL.helper,
  COL.cholesterol,
  COL.peg,
  COL.extras,
  COL.rna,
  COL.cb,
  COL.lipidMix,
  COL.ethanol,
  COL.aqTotal,
  COL.orTotal,
  COL.grandTotal,
  COL.mixConc,
]);

// ─── Header-label helpers ─────────────────────────────────────────────────

function entryName(e: LipidEntry): string {
  return (e.isCustomLipid ? e.customLipidName : e.lipidName) || "";
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v && v.trim() !== "")));
}

/**
 * Build a sub-header for a standard lipid slot: the concrete lipid name plus
 * its stock concentration in parentheses. The concentration is only shown
 * when every exported formulation agrees on it (otherwise a single value in a
 * shared column header would be misleading); the name alone is shown instead.
 */
function slotHeader(
  forms: BenchFormulation[],
  typeKey: string,
  fallback: string
): string {
  const entries = forms
    .map((f) => f.lipidEntries.find((e) => e.typeKey === typeKey))
    .filter((e): e is LipidEntry => !!e);
  if (entries.length === 0) return fallback;
  const names = uniq(entries.map(entryName));
  const nameLabel = names.length ? names.join(" / ") : fallback;
  const concs = uniq(entries.map((e) => e.stockConc));
  return concs.length === 1
    ? `${nameLabel} (${concs[0]} mg/mL)`
    : nameLabel;
}

function extrasHeader(forms: BenchFormulation[]): string {
  const extras = forms.flatMap((f) =>
    f.lipidEntries.filter((e) => !STANDARD_SLOTS.has(e.typeKey))
  );
  if (extras.length === 0) return "其他组分";
  const names = uniq(extras.map(entryName));
  const nameLabel = names.length ? names.join(" / ") : "其他组分";
  const concs = uniq(extras.map((e) => e.stockConc));
  return concs.length === 1 ? `${nameLabel} (${concs[0]} mg/mL)` : nameLabel;
}

function rnaHeader(forms: BenchFormulation[]): string {
  const concs = uniq(forms.map((f) => f.prep.rnaConc));
  return concs.length === 1 ? `RNA (${concs[0]} µg/µL)` : "RNA";
}

// ─── Row assembly ─────────────────────────────────────────────────────────

type Cell = string | number;

/** Round to 2 decimals; blank for missing/non-finite values. */
function v2(value: number | null | undefined): Cell {
  return value === null || value === undefined || !isFinite(value)
    ? ""
    : Number(value.toFixed(2));
}

function buildAoa(forms: BenchFormulation[]): {
  aoa: Cell[][];
  merges: XLSX.Range[];
} {
  const h0: Cell[] = new Array(N_COLS).fill("");
  h0[COL.index] = "序号";
  h0[COL.name] = "配方名称";
  h0[COL.ionizable] = "Lipid mix配置";
  h0[COL.rna] = "水相";
  h0[COL.lipidMix] = "脂相";
  h0[COL.aqTotal] = "水相总体积";
  h0[COL.orTotal] = "脂相总体积";
  h0[COL.grandTotal] = "总体积";
  h0[COL.np] = "制备参数";

  const h1: Cell[] = new Array(N_COLS).fill("");
  h1[COL.ionizable] = slotHeader(forms, "ionizable", "SM102");
  h1[COL.helper] = slotHeader(forms, "helper", "DSPC");
  h1[COL.cholesterol] = slotHeader(forms, "cholesterol", "Cho");
  h1[COL.peg] = slotHeader(forms, "peg", "PEG");
  h1[COL.extras] = extrasHeader(forms);
  h1[COL.rna] = rnaHeader(forms);
  h1[COL.cb] = "CB (10mM)";
  h1[COL.lipidMix] = "Lipid mix";
  h1[COL.ethanol] = "乙醇";
  h1[COL.np] = "N/P ratio";
  h1[COL.frr] = "FRR";
  h1[COL.mixConc] = "脂相浓度(mM)";

  const aoa: Cell[][] = [h0, h1];

  forms.forEach((f, i) => {
    const { stockVolumes, prepVolumes } = computeBenchFormulation(f);

    const byType: Record<string, LipidEntry | undefined> = {};
    const extras: LipidEntry[] = [];
    for (const e of f.lipidEntries) {
      if (STANDARD_SLOTS.has(e.typeKey)) byType[e.typeKey] = e;
      else extras.push(e);
    }

    const volOf = (e: LipidEntry | undefined): number | null | undefined =>
      e ? stockVolumes?.[e.id]?.uL : undefined;

    const extrasVol = extras.reduce((sum, e) => {
      const uL = stockVolumes?.[e.id]?.uL;
      return uL != null && isFinite(uL) ? sum + uL : sum;
    }, 0);

    const aq = prepVolumes.aqueousTotal_uL;
    const org = prepVolumes.organicTotal_uL;
    const grand = aq != null && org != null ? aq + org : null;

    const np = parseFloat(f.prep.npRatio);
    // 制备参数 = what the user typed. This column used to write the *computed*
    // totalConc.mM (the assembled stock's concentration), which is a different
    // quantity — the PDF export keeps them apart as 脂相浓度 vs Lipid Mix 总浓度.
    const masterConc = parseFloat(f.prep.masterConc);

    const row: Cell[] = new Array(N_COLS).fill("");
    row[COL.index] = i + 1;
    row[COL.name] = f.name || "(未命名)";
    row[COL.ionizable] = v2(volOf(byType.ionizable));
    row[COL.helper] = v2(volOf(byType.helper));
    row[COL.cholesterol] = v2(volOf(byType.cholesterol));
    row[COL.peg] = v2(volOf(byType.peg));
    row[COL.extras] = extras.length ? v2(extrasVol) : "";
    row[COL.rna] = v2(prepVolumes.rnaVolume_uL);
    row[COL.cb] = v2(prepVolumes.cbBuffer_uL);
    row[COL.lipidMix] = v2(prepVolumes.lipidMix_uL);
    row[COL.ethanol] = v2(prepVolumes.ethanol_uL);
    row[COL.aqTotal] = v2(aq);
    row[COL.orTotal] = v2(org);
    row[COL.grandTotal] = v2(grand);
    row[COL.np] = isFinite(np) ? np : "";
    row[COL.frr] = `${f.prep.frrAqueous}:${f.prep.frrOrganic}`;
    row[COL.mixConc] = isFinite(masterConc) ? masterConc : "";

    aoa.push(row);
  });

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: COL.index }, e: { r: 1, c: COL.index } },
    { s: { r: 0, c: COL.name }, e: { r: 1, c: COL.name } },
    { s: { r: 0, c: COL.ionizable }, e: { r: 0, c: COL.extras } },
    { s: { r: 0, c: COL.rna }, e: { r: 0, c: COL.cb } },
    { s: { r: 0, c: COL.lipidMix }, e: { r: 0, c: COL.ethanol } },
    { s: { r: 0, c: COL.aqTotal }, e: { r: 1, c: COL.aqTotal } },
    { s: { r: 0, c: COL.orTotal }, e: { r: 1, c: COL.orTotal } },
    { s: { r: 0, c: COL.grandTotal }, e: { r: 1, c: COL.grandTotal } },
    { s: { r: 0, c: COL.np }, e: { r: 0, c: COL.mixConc } },
  ];

  return { aoa, merges };
}

// ─── Styling ──────────────────────────────────────────────────────────────

function topFill(c: number): string {
  if (c >= COL.ionizable && c <= COL.extras) return FILL_LIPID_TOP;
  if (c >= COL.rna && c <= COL.cb) return FILL_AQ_TOP;
  if (c >= COL.lipidMix && c <= COL.ethanol) return FILL_OR_TOP;
  return FILL_NEUTRAL;
}

function subFill(c: number): string {
  if (c >= COL.ionizable && c <= COL.extras) return FILL_LIPID_SUB;
  if (c >= COL.rna && c <= COL.cb) return FILL_AQ_SUB;
  if (c >= COL.lipidMix && c <= COL.ethanol) return FILL_OR_SUB;
  return FILL_NEUTRAL;
}

function applyStyles(ws: XLSX.WorkSheet, rowCount: number): void {
  const ensure = (r: number, c: number): XLSX.CellObject => {
    const ref = XLSX.utils.encode_cell({ r, c });
    let cell = ws[ref] as XLSX.CellObject | undefined;
    if (!cell) {
      cell = { t: "s", v: "" };
      ws[ref] = cell;
    }
    return cell;
  };

  for (let c = 0; c < N_COLS; c++) {
    ensure(0, c).s = headerStyle(topFill(c));
    ensure(1, c).s = headerStyle(subFill(c));
  }

  for (let r = 2; r < rowCount; r++) {
    for (let c = 0; c < N_COLS; c++) {
      const cell = ensure(r, c);
      if (c === COL.name) {
        cell.s = nameStyle;
      } else if (DECIMAL_COLS.has(c)) {
        cell.s = numStyle;
        cell.z = "0.00";
      } else {
        // 序号 (integer), N/P ratio, FRR — no forced decimals.
        cell.s = plainStyle;
      }
    }
  }
}

// ─── Public entry point ───────────────────────────────────────────────────

export function exportBenchToXlsx(
  sessionName: string,
  createdAt: string,
  updatedAt: string,
  formulations: BenchFormulation[]
): void {
  if (formulations.length === 0) return;

  const { aoa, merges } = buildAoa(formulations);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;

  ws["!cols"] = [
    { wch: 6 }, // 序号
    { wch: 18 }, // 配方名称
    { wch: 15 }, // ionizable
    { wch: 15 }, // helper
    { wch: 15 }, // cholesterol
    { wch: 15 }, // PEG
    { wch: 15 }, // 其他组分
    { wch: 13 }, // RNA
    { wch: 13 }, // CB
    { wch: 12 }, // Lipid mix
    { wch: 10 }, // 乙醇
    { wch: 11 }, // 水相总体积
    { wch: 11 }, // 脂相总体积
    { wch: 11 }, // 总体积
    { wch: 9 }, // N/P ratio
    { wch: 8 }, // FRR
    { wch: 18 }, // Lipid mix concs(mM)
  ];
  ws["!rows"] = [{ hpt: 20 }, { hpt: 30 }];

  applyStyles(ws, aoa.length);

  const meta = XLSX.utils.aoa_to_sheet([
    ["筛选会话", sessionName],
    ["创建时间", formatIso(createdAt)],
    ["最近更新", formatIso(updatedAt)],
    ["导出时间", formatNow()],
    ["配方数量", formulations.length],
    [],
    ["单位说明", "所有体积单位为 µL，保留 2 位小数"],
    ["体积说明", "Lipid mix 体积为刚好覆盖所需 RNA 用量的理论值（零余量）"],
  ]);
  meta["!cols"] = [{ wch: 18 }, { wch: 44 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Formulations");
  XLSX.utils.book_append_sheet(wb, meta, "Session");

  const filename = `${sanitizeFilename(sessionName)}-${datestamp()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── Date / filename helpers ──────────────────────────────────────────────

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
