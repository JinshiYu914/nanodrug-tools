import * as XLSX from "xlsx-js-style";
import {
  buildResultTable,
  formatFitEquation,
  formatR2,
  type BatchComputed,
  type CurvePair,
  type SampleRow,
} from "@/lib/calculations/ribogreen";
import {
  INSTRUMENT_OPTIONS,
  type InstrumentKey,
} from "@/lib/calculations/ribogreen-presets";

const thin = { style: "thin", color: { rgb: "000000" } } as const;
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

const HEADER_FILL = "D9E2F3";
const KEY_FILL = "E2EFDA"; // highlighted result columns — green

type Cell = XLSX.CellObject;

function txt(v: string, opts?: { bold?: boolean; fill?: string }): Cell {
  return {
    t: "s",
    v,
    s: {
      font: { bold: opts?.bold ?? false, sz: 10 },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: BORDER,
      ...(opts?.fill ? { fill: { fgColor: { rgb: opts.fill } } } : {}),
    },
  };
}

/** Emit a real number when the string parses, so Excel can chart/sort it. */
function cell(v: string, fill?: string): Cell {
  const n = parseFloat(v);
  const numeric = v.trim() !== "" && v !== "--" && !isNaN(n);
  return {
    t: numeric ? "n" : "s",
    v: numeric ? n : v,
    s: {
      font: { sz: 10 },
      alignment: { vertical: "center", horizontal: numeric ? "right" : "left" },
      border: BORDER,
      ...(fill ? { fill: { fgColor: { rgb: fill } } } : {}),
    },
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function datestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "ribogreen";
}

export function exportRibogreenToXlsx(args: {
  rows: SampleRow[];
  batch: BatchComputed;
  curves: CurvePair;
  instrument: InstrumentKey;
  experimentDate: string;
  recordName?: string;
}) {
  const { rows, batch, curves, instrument, experimentDate, recordName } = args;

  // ── Sheet 1: 计算结果 ──────────────────────────────────
  const { header, body } = buildResultTable(rows, batch, experimentDate, "all");
  // Highlight the four columns users actually read off.
  const KEY_COLS = new Set([6, 7, 8, 10]);

  const aoa: Cell[][] = [
    header.map((h, i) => txt(h, { bold: true, fill: KEY_COLS.has(i) ? KEY_FILL : HEADER_FILL })),
    ...body.map((r) => r.map((v, i) => cell(v, KEY_COLS.has(i) ? KEY_FILL : undefined))),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = header.map((h, i) =>
    i === 0 ? { wch: 14 } : { wch: Math.max(11, Math.min(20, h.length + 2)) }
  );
  ws["!freeze"] = { xSplit: 1, ySplit: 1 };

  // ── Sheet 2: 标准曲线 ──────────────────────────────────
  const label =
    INSTRUMENT_OPTIONS.find((o) => o.key === instrument)?.label ?? "自定义曲线";

  const curveAoa: Cell[][] = [
    [txt("仪器", { bold: true, fill: HEADER_FILL }), cell(label)],
    [txt("实验日期", { bold: true, fill: HEADER_FILL }), cell(experimentDate)],
    [],
  ];

  ([
    ["TE buffer (1% Triton) → 总浓度", curves.triton, batch.fits.triton],
    ["TE buffer → 游离浓度", curves.te, batch.fits.te],
  ] as const).forEach(([title, spec, fit]) => {
    curveAoa.push([txt(title, { bold: true, fill: HEADER_FILL })]);
    curveAoa.push([txt("拟合公式", { bold: true }), cell(formatFitEquation(fit))]);
    curveAoa.push([txt("R²", { bold: true }), cell(formatR2(fit))]);
    curveAoa.push([
      txt("有效读数范围", { bold: true }),
      cell(fit.valid ? `${fit.minX} ~ ${fit.maxX}` : "--"),
    ]);
    curveAoa.push([
      txt("读数", { bold: true, fill: HEADER_FILL }),
      txt("浓度 (ng/mL)", { bold: true, fill: HEADER_FILL }),
      txt("是否参与拟合", { bold: true, fill: HEADER_FILL }),
    ]);
    for (const p of spec.points) {
      curveAoa.push([cell(p.reading), cell(p.conc), cell(p.enabled ? "是" : "否")]);
    }
    curveAoa.push([]);
  });

  if (batch.correction.applied) {
    curveAoa.push([txt("标准品校正", { bold: true, fill: HEADER_FILL })]);
    curveAoa.push([
      txt("校正系数", { bold: true }),
      cell(batch.correction.factor.toFixed(4)),
    ]);
    curveAoa.push([
      txt("取值曲线", { bold: true }),
      cell(batch.correction.basis === "triton" ? "TE (1% Triton)" : "TE buffer"),
    ]);
  }

  const curveWs = XLSX.utils.aoa_to_sheet(curveAoa);
  curveWs["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "计算结果");
  XLSX.utils.book_append_sheet(wb, curveWs, "标准曲线");

  const base = recordName?.trim() || `RiboGreen-${experimentDate || datestamp()}`;
  XLSX.writeFile(wb, `${sanitizeFilename(base)}.xlsx`);
}
