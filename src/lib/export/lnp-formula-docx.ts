import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  computeBenchFormulation,
  type BenchPrepParams,
} from "@/lib/calculations/lnp-bench";
import {
  computeStockVolumes,
  entriesToComponents,
  type LipidEntry,
} from "@/lib/calculations/lnp-formula";

// ─── Palette (matches the app's UI colour language) ───────
const INK = "111111"; // near-black primary
const MUTED = "6B7280"; // slate-500 — secondary text
const ACCENT = "111111"; // emphasised data
const AQUEOUS = "2563EB"; // blue-600 — 水相
const ORGANIC = "B45309"; // amber-700 — 脂相
const HEADER_BG = "F1F5F9"; // slate-100 — table header
const EMPH_BG = "F8FAFC"; // slate-50 — emphasised cells
const LINE = "E2E8F0"; // slate-200 — borders

// docx sizes are in half-points (20 = 10pt). Kept small for a compact,
// half-page print-out.
const SZ_TITLE = 26;
const SZ_HEADING = 19;
const SZ_DATA = 18; // emphasised values (lipid names, volumes)
const SZ_BODY = 15;
const SZ_SMALL = 12; // secondary / footnote text

// Letter page (12240 twips) minus 0.5" margins each side.
const USABLE_WIDTH = 10800;

export interface FormulaDocInput {
  lipidEntries: LipidEntry[];
  targetVolume: string;
  volumeUnit: "uL" | "mL";
  prep: BenchPrepParams;
  /** Target Lipid Mix volume derived from the RNA prep amount (Step 2). */
  autoLipidMixFromRna?: boolean;
  /** Prepare an extra 100 µL of organic phase for syringe dead volume. */
  extraLipidPhase?: boolean;
}

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

function fmtVol(uL: number | null | undefined): string {
  if (uL === null || uL === undefined || isNaN(uL)) return "--";
  if (uL >= 1000) return `${(uL / 1000).toFixed(3)} mL`;
  return `${uL.toFixed(2)} µL`;
}

function entryName(e: LipidEntry): string {
  return (e.isCustomLipid ? e.customLipidName : e.lipidName) || "—";
}

// ─── Run / paragraph / cell builders ──────────────────────

function run(
  text: string,
  opts: { size?: number; bold?: boolean; color?: string } = {}
): TextRun {
  return new TextRun({
    text,
    bold: opts.bold ?? false,
    size: opts.size ?? SZ_BODY,
    color: opts.color ?? INK,
    font: "Calibri",
  });
}

function none() {
  return { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
}

function noBorders() {
  return { top: none(), bottom: none(), left: none(), right: none() };
}

function p(
  children: TextRun[],
  align?: (typeof AlignmentType)[keyof typeof AlignmentType]
): Paragraph {
  return new Paragraph({ children, alignment: align, spacing: { after: 0 } });
}

const TIGHT = { top: 22, bottom: 22, left: 90, right: 90 };

function cell(
  children: Paragraph[],
  opts: {
    width?: number;
    shading?: string;
    borders?: ReturnType<typeof noBorders>;
  } = {}
): TableCell {
  return new TableCell({
    children,
    width: opts.width
      ? { size: opts.width, type: WidthType.PERCENTAGE }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.shading
      ? { type: ShadingType.CLEAR, color: "auto", fill: opts.shading }
      : undefined,
    borders: opts.borders,
    margins: TIGHT,
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 50 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INK } },
    children: [run(text, { size: SZ_HEADING, bold: true })],
  });
}

// ─── Section 1: Lipid Mix table ───────────────────────────

function lipidTable(
  entries: LipidEntry[],
  stockVolumes: Record<string, { uL: number }> | null
): Table {
  const head = (
    t: string,
    align?: (typeof AlignmentType)[keyof typeof AlignmentType],
    width?: number
  ) =>
    cell([p([run(t, { size: SZ_SMALL, bold: true, color: MUTED })], align)], {
      width,
      shading: HEADER_BG,
    });

  const header = new TableRow({
    tableHeader: true,
    children: [
      head("组分", undefined, 16),
      head("脂质名称", undefined, 40),
      head("摩尔比", AlignmentType.CENTER, 16),
      head("吸取体积", AlignmentType.RIGHT, 28),
    ],
  });

  const rows = entries.map((e) => {
    const vol = stockVolumes?.[e.id]?.uL;
    const meta: string[] = [];
    if (e.molarWeight) meta.push(`MW ${e.molarWeight}`);
    if (e.stockConc) meta.push(`Stock ${e.stockConc} mg/mL`);

    return new TableRow({
      children: [
        cell([p([run(e.label, { size: SZ_SMALL, color: MUTED })])], {
          width: 16,
        }),
        cell(
          [
            new Paragraph({
              spacing: { after: 0 },
              children: [
                run(entryName(e), { size: SZ_DATA, bold: true }),
                ...(meta.length
                  ? [run(`   ${meta.join(" · ")}`, { size: SZ_SMALL, color: MUTED })]
                  : []),
              ],
            }),
          ],
          { width: 40 }
        ),
        cell([p([run(`${e.molarRatio || "0"}%`, { size: SZ_BODY })], AlignmentType.CENTER)], {
          width: 16,
        }),
        cell(
          [p([run(fmtVol(vol), { size: SZ_DATA, bold: true, color: ACCENT })], AlignmentType.RIGHT)],
          { width: 28 }
        ),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      left: none(),
      right: none(),
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      insideVertical: none(),
    },
    rows: [header, ...rows],
  });
}

// ─── Section 2: prep params (chips) + phases side-by-side ──

function paramChips(rows: Array<[string, string]>): Table {
  // Fixed layout + explicit column widths so the chips stay evenly spaced
  // and never collapse / wrap (auto-layout missizes short-text columns).
  const colW = Math.floor(USABLE_WIDTH / rows.length);
  return new Table({
    layout: TableLayoutType.FIXED,
    columnWidths: rows.map(() => colW),
    width: { size: colW * rows.length, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      left: none(),
      right: none(),
      insideHorizontal: none(),
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: LINE },
    },
    rows: [
      new TableRow({
        children: rows.map(
          ([k, v]) =>
            new TableCell({
              children: [
                p([run(k, { size: SZ_SMALL, color: MUTED })], AlignmentType.CENTER),
                p([run(v, { size: SZ_DATA, bold: true })], AlignmentType.CENTER),
              ],
              width: { size: colW, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              shading: { type: ShadingType.CLEAR, color: "auto", fill: EMPH_BG },
              margins: TIGHT,
            })
        ),
      }),
    ],
  });
}

/**
 * Both phases (水相 / 脂相) as a SINGLE fixed-layout 4-column table:
 *   [水相 label | 水相 value | 脂相 label | 脂相 value]
 * Avoids nested / auto-layout tables, which Word collapses to one CJK
 * character per line when placed after another table.
 */
function phaseTable(prepVolumes: {
  rnaVolume_uL: number | null;
  cbBuffer_uL: number | null;
  aqueousTotal_uL: number | null;
  lipidMix_uL: number | null;
  ethanol_uL: number | null;
  organicTotal_uL: number | null;
}): Table {
  // 28 / 22 / 28 / 22 of the usable width.
  const COLS = [3024, 2376, 3024, 2376];
  const GAP = 260; // visual gutter before the 脂相 column

  const labelCell = (
    text: string,
    w: number,
    opts: { bold?: boolean; accent?: string; top?: boolean; leftPad?: number } = {}
  ) =>
    new TableCell({
      children: [
        p([
          run(text, {
            size: SZ_BODY,
            color: opts.bold ? INK : MUTED,
            bold: opts.bold,
          }),
        ]),
      ],
      width: { size: w, type: WidthType.DXA },
      borders: opts.top
        ? { ...noBorders(), top: { style: BorderStyle.SINGLE, size: 4, color: opts.accent ?? INK } }
        : noBorders(),
      margins: { top: 16, bottom: 16, left: opts.leftPad ?? 0, right: 0 },
    });

  const valueCell = (
    uL: number | null,
    w: number,
    opts: { bold?: boolean; accent?: string; top?: boolean } = {}
  ) =>
    new TableCell({
      children: [
        p(
          [
            run(fmtVol(uL), {
              size: opts.bold ? SZ_DATA : SZ_BODY,
              bold: opts.bold,
              color: opts.bold ? opts.accent ?? INK : INK,
            }),
          ],
          AlignmentType.RIGHT
        ),
      ],
      width: { size: w, type: WidthType.DXA },
      borders: opts.top
        ? { ...noBorders(), top: { style: BorderStyle.SINGLE, size: 4, color: opts.accent ?? INK } }
        : noBorders(),
      margins: { top: 16, bottom: 16, left: 0, right: 0 },
    });

  const titleCell = (text: string, accent: string, leftPad = 0) =>
    new TableCell({
      columnSpan: 2,
      children: [
        new Paragraph({
          spacing: { after: 0 },
          children: [run(text, { size: SZ_BODY, bold: true, color: accent })],
        }),
      ],
      borders: noBorders(),
      margins: { top: 20, bottom: 30, left: leftPad, right: 0 },
    });

  return new Table({
    layout: TableLayoutType.FIXED,
    columnWidths: COLS,
    width: { size: USABLE_WIDTH, type: WidthType.DXA },
    borders: noBorders(),
    rows: [
      // Phase titles.
      new TableRow({
        children: [
          titleCell("水相 Aqueous", AQUEOUS),
          titleCell("脂相 Organic", ORGANIC, GAP),
        ],
      }),
      // Line 1: RNA / Lipid mix.
      new TableRow({
        children: [
          labelCell("RNA", COLS[0]),
          valueCell(prepVolumes.rnaVolume_uL, COLS[1]),
          labelCell("Lipid mix", COLS[2], { leftPad: GAP }),
          valueCell(prepVolumes.lipidMix_uL, COLS[3]),
        ],
      }),
      // Line 2: Citrate buffer / Ethanol.
      new TableRow({
        children: [
          labelCell("Citrate buffer", COLS[0]),
          valueCell(prepVolumes.cbBuffer_uL, COLS[1]),
          labelCell("Ethanol", COLS[2], { leftPad: GAP }),
          valueCell(prepVolumes.ethanol_uL, COLS[3]),
        ],
      }),
      // Totals.
      new TableRow({
        children: [
          labelCell("Total", COLS[0], { bold: true, accent: AQUEOUS, top: true }),
          valueCell(prepVolumes.aqueousTotal_uL, COLS[1], { bold: true, accent: AQUEOUS, top: true }),
          labelCell("Total", COLS[2], { bold: true, accent: ORGANIC, top: true, leftPad: GAP }),
          valueCell(prepVolumes.organicTotal_uL, COLS[3], { bold: true, accent: ORGANIC, top: true }),
        ],
      }),
    ],
  });
}

// ─── Document assembly ────────────────────────────────────

function buildDocument(input: FormulaDocInput): Document {
  const { lipidEntries, targetVolume, volumeUnit, prep } = input;

  // Step 2 results (totalConc + prep volumes) — independent of Step 1 volume.
  const { totalConc, prepVolumes } = computeBenchFormulation(
    {
      id: "local",
      name: "local",
      lipidEntries,
      prep,
      createdAt: new Date().toISOString(),
    },
    { extraLipidPhase_uL: input.extraLipidPhase ? 100 : 0 }
  );

  // Step 1 stock volumes use the target Lipid Mix volume shown in Step 1:
  // the RNA-derived volume when that option is on, else the manual entry.
  const targetVolume_uL = input.autoLipidMixFromRna
    ? prepVolumes.lipidMix_uL ?? 0
    : volumeUnit === "mL"
    ? num(targetVolume) * 1000
    : num(targetVolume);
  const stockVolumes =
    targetVolume_uL > 0
      ? computeStockVolumes({
          components: entriesToComponents(lipidEntries),
          targetVolume: targetVolume_uL,
          volumeUnit: "uL",
        })
      : null;

  const summary = lipidEntries.map(entryName).join(" / ");
  const ratios = lipidEntries.map((e) => e.molarRatio || "0").join(":");
  const concText = totalConc
    ? totalConc.mM >= 1
      ? `${totalConc.mM.toFixed(2)} mM`
      : `${totalConc.uM.toFixed(0)} µM`
    : "--";

  const children: (Paragraph | Table)[] = [
    // ── Title block (compact) ──
    new Paragraph({
      spacing: { after: 20 },
      children: [run("LNP 配方制备单", { size: SZ_TITLE, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
      children: [
        run(`${summary}  (${ratios})`, { size: SZ_BODY }),
        run(`     生成时间 ${formatNow()}`, { size: SZ_SMALL, color: MUTED }),
      ],
    }),

    // ── Step 1 ──
    sectionHeading("第一步 · Lipid Mix 配方（脂相母液）"),
    lipidTable(lipidEntries, stockVolumes),
    new Paragraph({
      spacing: { before: 60, after: 0 },
      children: [
        run("总浓度 ", { size: SZ_BODY, color: MUTED }),
        run(concText, { size: SZ_DATA, bold: true }),
        run(
          totalConc ? `（${totalConc.massConc_mg_per_mL.toFixed(2)} mg/mL）` : "",
          { size: SZ_SMALL, color: MUTED }
        ),
        run("      目标体积 ", { size: SZ_BODY, color: MUTED }),
        run(
          targetVolume_uL > 0 ? fmtVol(targetVolume_uL) : "（未填写）",
          {
            size: SZ_DATA,
            bold: true,
            color: targetVolume_uL > 0 ? ACCENT : MUTED,
          }
        ),
      ],
    }),

    // ── Step 2 ──
    sectionHeading("第二步 · 制备参数与配液体积"),
    paramChips([
      ["Master Mix", `${prep.masterConc || "--"} mM`],
      ["FRR (水:脂)", `${prep.frrAqueous}:${prep.frrOrganic}`],
      ["N/P 比", `${prep.npRatio || "--"}`],
      ["RNA", `${prep.rnaMass || "--"} µg @ ${prep.rnaConc || "--"}`],
    ]),
    // Empty paragraph keeps Word from merging the two adjacent tables.
    new Paragraph({ spacing: { after: 40 }, children: [] }),
    phaseTable(prepVolumes),
  ];

  // ── Combined total (compact, right-aligned) ──
  // Uses the nominal reaction organic volume so the dead-volume surplus does
  // not inflate the reported system total (it only affects the prep amounts).
  if (
    prepVolumes.aqueousTotal_uL !== null &&
    prepVolumes.organicReactionTotal_uL !== null
  ) {
    children.push(
      new Paragraph({
        spacing: { before: 40 },
        alignment: AlignmentType.RIGHT,
        children: [
          run("两相总体积  ", { size: SZ_BODY, color: MUTED }),
          run(
            fmtVol(
              prepVolumes.aqueousTotal_uL +
                prepVolumes.organicReactionTotal_uL
            ),
            { size: SZ_HEADING, bold: true }
          ),
        ],
      })
    );
  }

  if (input.extraLipidPhase) {
    children.push(
      new Paragraph({
        spacing: { before: 20 },
        children: [
          run(
            "* 脂相 Lipid mix / Ethanol 已多配 100 µL 用于填充微流控注射器死体积；脂相总量、两相总体积为反应体系体积，不含该余量。",
            {
              size: SZ_SMALL,
              color: MUTED,
            }
          ),
        ],
      })
    );
  }

  return new Document({
    creator: "nanodrug-tools",
    title: "LNP 配方制备单",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: SZ_BODY, color: INK } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children,
      },
    ],
  });
}

// ─── Public API ───────────────────────────────────────────

export async function exportFormulationToDocx(
  input: FormulaDocInput
): Promise<void> {
  const doc = buildDocument(input);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `LNP配方制备单-${datestamp()}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
