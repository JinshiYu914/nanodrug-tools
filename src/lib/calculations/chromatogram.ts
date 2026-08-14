/**
 * Chromatogram import and geometry.
 *
 * Supports both the compact x/A280/A260 table and the 12-column ÄKTA export:
 * min, mL, CV, A280, min, mL, CV, A260, fraction min, fraction mL,
 * fraction CV, fraction mark.
 */

import { genId, normalizeNumericCell } from "./ribogreen";
import { niceDomain, type Domain } from "./chart-scale";
import type {
  Chromatogram,
  ChromatogramChannel,
  ChromatogramFractionMark,
  ChromatogramPoint,
  ChromatogramXAxis,
} from "./tlnp-experiment";

export const CHROMATOGRAM_AXES = ["min", "mL", "CV"] as const;
export const CHROMATOGRAM_AXIS_LABELS: Record<ChromatogramXAxis, string> = {
  min: "Time (min)",
  mL: "Volume (mL)",
  CV: "Column volume (CV)",
};

export interface ParsedChromatogram {
  channels: ChromatogramChannel[];
  points: ChromatogramPoint[];
  xAxis: ChromatogramXAxis;
  availableXAxes: ChromatogramXAxis[];
  xLabel: string;
  fractionMarks: ChromatogramFractionMark[];
  /** Non-fatal notes: dropped rows, missing cells, or guessed headers. */
  warnings: string[];
}

export interface ParsedFractionMarks {
  marks: ChromatogramFractionMark[];
  warnings: string[];
}

const isNumeric = (s: string): boolean => {
  if (!s || !s.trim()) return false;
  return isFinite(parseFloat(normalizeNumericCell(s)));
};

const toNum = (s: string): number | null => {
  if (!s || !s.trim()) return null;
  const n = parseFloat(normalizeNumericCell(s));
  return isFinite(n) ? n : null;
};

const axisFromLabel = (label: string): ChromatogramXAxis => {
  if (/\bcv\b|柱体积/i.test(label)) return "CV";
  if (/\bmin\b|分钟|时间/i.test(label)) return "min";
  return "mL";
};

function looksLikeHeader(grid: string[][]): boolean {
  const first = grid[0];
  return !!first && first.length > 0 && !isNumeric(first[0]);
}

export const DEFAULT_CHANNEL_LABELS = ["A280", "A260"];

export function detectChannels(
  header: string[] | null,
  columnCount: number
): ChromatogramChannel[] {
  const out: ChromatogramChannel[] = [];
  for (let i = 1; i < columnCount; i++) {
    const label =
      header?.[i]?.trim() || DEFAULT_CHANNEL_LABELS[i - 1] || `通道 ${i}`;
    out.push({
      id: genId(),
      label,
      slot: (((i - 1) % 5) + 1) as 1 | 2 | 3 | 4 | 5,
    });
  }
  return out;
}

function emptyParsed(message: string): ParsedChromatogram {
  return {
    channels: [],
    points: [],
    xAxis: "mL",
    availableXAxes: ["mL"],
    xLabel: CHROMATOGRAM_AXIS_LABELS.mL,
    fractionMarks: [],
    warnings: [message],
  };
}

function parseDelimitedLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      cells.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

/** Split Excel paste, CSV, semicolon CSV, or whitespace-separated text. */
function splitPaste(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return [];

  const sample = lines.slice(0, 5).join("\n");
  if (sample.includes("\t")) return lines.map((line) => line.split("\t").map((c) => c.trim()));
  const commaCount = (sample.match(/,/g) ?? []).length;
  const semicolonCount = (sample.match(/;/g) ?? []).length;
  if (commaCount || semicolonCount) {
    const separator = semicolonCount > commaCount ? ";" : ",";
    return lines.map((line) => parseDelimitedLine(line, separator));
  }
  return lines.map((line) => line.trim().split(/\s+/).map((c) => c.trim()));
}

function isAktaUnitRow(row: string[]): boolean {
  return (
    row.length >= 8 &&
    axisFromLabel(row[0] ?? "") === "min" &&
    axisFromLabel(row[1] ?? "") === "mL" &&
    axisFromLabel(row[2] ?? "") === "CV" &&
    axisFromLabel(row[4] ?? "") === "min" &&
    axisFromLabel(row[5] ?? "") === "mL" &&
    axisFromLabel(row[6] ?? "") === "CV"
  );
}

function fillMarkCoordinates(
  positions: Partial<Record<ChromatogramXAxis, number>>,
  points: ChromatogramPoint[]
): Partial<Record<ChromatogramXAxis, number>> {
  const anchor = CHROMATOGRAM_AXES.find((axis) => positions[axis] !== undefined);
  if (!anchor) return positions;
  const target = positions[anchor]!;
  let nearest: ChromatogramPoint | null = null;
  let distance = Infinity;
  for (const point of points) {
    const candidate = point.xValues[anchor];
    if (candidate === undefined) continue;
    const nextDistance = Math.abs(candidate - target);
    if (nextDistance < distance) {
      distance = nextDistance;
      nearest = point;
    }
  }
  return nearest ? { ...nearest.xValues, ...positions } : positions;
}

function parseAktaGrid(rows: string[][], unitRowIndex: number): ParsedChromatogram {
  const warnings: string[] = [];
  const points: ChromatogramPoint[] = [];
  const rawMarks: ChromatogramFractionMark[] = [];
  let dropped = 0;

  for (const row of rows.slice(unitRowIndex + 1)) {
    const xValues: Partial<Record<ChromatogramXAxis, number>> = {};
    const min = toNum(row[0] ?? "");
    const mL = toNum(row[1] ?? "");
    const cv = toNum(row[2] ?? "");
    if (min !== null) xValues.min = min;
    if (mL !== null) xValues.mL = mL;
    if (cv !== null) xValues.CV = cv;
    const a280 = toNum(row[3] ?? "");
    const a260 = toNum(row[7] ?? "");
    if (Object.keys(xValues).length > 0 && (a280 !== null || a260 !== null)) {
      points.push({ x: mL ?? min ?? cv!, xValues, y: [a280, a260] });
    } else if (row.some((cell) => cell.trim() !== "")) {
      dropped++;
    }

    const label = (row[11] ?? "").trim();
    if (label) {
      const positions: Partial<Record<ChromatogramXAxis, number>> = {};
      const markMin = toNum(row[8] ?? "");
      const markMl = toNum(row[9] ?? "");
      const markCv = toNum(row[10] ?? "");
      if (markMin !== null) positions.min = markMin;
      if (markMl !== null) positions.mL = markMl;
      if (markCv !== null) positions.CV = markCv;
      if (Object.keys(positions).length > 0) {
        rawMarks.push({ id: genId(), label, positions });
      }
    }
  }

  const availableXAxes = CHROMATOGRAM_AXES.filter((axis) =>
    points.some((point) => point.xValues[axis] !== undefined)
  );
  const xAxis: ChromatogramXAxis = availableXAxes.includes("mL")
    ? "mL"
    : availableXAxes[0] ?? "mL";
  for (const point of points) point.x = point.xValues[xAxis] ?? point.x;
  points.sort((a, b) => a.x - b.x);

  if (dropped > 0) warnings.push(`忽略了 ${dropped} 行无法解析的数据`);
  if (points.length === 0) warnings.push("没有解析出有效的 A280/A260 数据点");

  return {
    channels: [
      { id: genId(), label: "A280", slot: 1 },
      { id: genId(), label: "A260", slot: 2 },
    ],
    points,
    xAxis,
    availableXAxes: availableXAxes.length > 0 ? availableXAxes : ["mL"],
    xLabel: CHROMATOGRAM_AXIS_LABELS[xAxis],
    fractionMarks: rawMarks.map((mark) => ({
      ...mark,
      positions: fillMarkCoordinates(mark.positions, points),
    })),
    warnings,
  };
}

function parseCompactGrid(grid: string[][]): ParsedChromatogram {
  const warnings: string[] = [];
  const rows = grid.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length === 0) return emptyParsed("没有读到任何数据");

  const hasHeader = looksLikeHeader(rows);
  const header = hasHeader ? rows[0] : null;
  const body = hasHeader ? rows.slice(1) : rows;
  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount < 2) return emptyParsed("至少需要两列：第一列是横轴，其余列是检测信号");

  const xAxis = axisFromLabel(header?.[0] ?? "mL");
  const channels = detectChannels(header, columnCount);
  const points: ChromatogramPoint[] = [];
  let dropped = 0;
  for (const row of body) {
    const x = toNum(row[0] ?? "");
    if (x === null) {
      dropped++;
      continue;
    }
    points.push({
      x,
      xValues: { [xAxis]: x },
      y: channels.map((_, index) => toNum(row[index + 1] ?? "")),
    });
  }

  if (dropped > 0) warnings.push(`忽略了 ${dropped} 行无法解析的数据`);
  if (points.length === 0) warnings.push("没有解析出有效数据点");
  if (!hasHeader) {
    warnings.push(`没有识别到表头，检测通道已按顺序命名为 ${channels.map((c) => c.label).join(" / ")}`);
  }
  points.sort((a, b) => a.x - b.x);
  return {
    channels,
    points,
    xAxis,
    availableXAxes: [xAxis],
    xLabel: CHROMATOGRAM_AXIS_LABELS[xAxis],
    fractionMarks: [],
    warnings,
  };
}

/** Parse the compact table or the complete 12-column instrument export. */
export function parseChromatogramTable(text: string): ParsedChromatogram {
  const rows = splitPaste(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  const unitRowIndex = rows.findIndex((row, index) => index < 3 && isAktaUnitRow(row));
  return unitRowIndex >= 0 ? parseAktaGrid(rows, unitRowIndex) : parseCompactGrid(rows);
}

/** Parse a separate two-column mL / mark block and align it to the UV trace. */
export function parseFractionMarkTable(
  text: string,
  points: ChromatogramPoint[]
): ParsedFractionMarks {
  const rows = splitPaste(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  const unitRowIndex = rows.findIndex((row, index) => index < 3 && isAktaUnitRow(row));
  if (unitRowIndex >= 0) {
    const parsed = parseAktaGrid(rows, unitRowIndex);
    return {
      marks: parsed.fractionMarks,
      warnings: parsed.fractionMarks.length > 0
        ? []
        : ["完整 SEC 文件中没有读取到 Fraction Mark"],
    };
  }
  if (rows.some((row) => row.length > 2)) {
    return {
      marks: [],
      warnings: ["Fraction Mark 需要两列数据，或带两行表头的完整 12 列 SEC 文件"],
    };
  }
  const body = rows[0] && !isNumeric(rows[0][0] ?? "") ? rows.slice(1) : rows;
  const marks: ChromatogramFractionMark[] = [];
  let dropped = 0;
  for (const row of body) {
    const mL = toNum(row[0] ?? "");
    const label = (row[1] ?? "").trim();
    if (mL === null || !label) {
      if (row.some((cell) => cell.trim() !== "")) dropped++;
      continue;
    }
    const positions = fillMarkCoordinates({ mL }, points);
    marks.push({ id: genId(), label, positions });
  }
  const warnings: string[] = [];
  if (dropped > 0) warnings.push(`忽略了 ${dropped} 行无效的 Fraction Mark`);
  if (marks.length === 0) warnings.push("没有解析出 Fraction Mark；需要两列：mL 和 mark 内容");
  return { marks, warnings };
}

export function createChromatogram(
  parsed: ParsedChromatogram,
  name: string,
  rawText: string,
  source: "paste" | "csv" = "paste",
  sourceName = ""
): Chromatogram {
  return {
    id: genId(),
    name,
    xAxis: parsed.xAxis,
    availableXAxes: parsed.availableXAxes,
    xLabel: parsed.xLabel,
    channels: parsed.channels,
    points: parsed.points,
    fractions: [],
    fractionMarks: parsed.fractionMarks,
    showFractionMarks: true,
    source,
    sourceName,
    rawText,
    note: "",
  };
}

export function reparseChromatogram(
  previous: Chromatogram,
  parsed: ParsedChromatogram,
  rawText: string,
  source: "paste" | "csv" = "paste",
  sourceName = ""
): Chromatogram {
  return {
    ...previous,
    xAxis: parsed.xAxis,
    availableXAxes: parsed.availableXAxes,
    xLabel: parsed.xLabel,
    channels: parsed.channels,
    points: parsed.points,
    fractionMarks: parsed.fractionMarks,
    showFractionMarks: true,
    source,
    sourceName,
    rawText,
  };
}

/** Switch among instrument coordinates and keep hand-entered fraction ranges aligned. */
export function setChromatogramXAxis(
  chromatogram: Chromatogram,
  axis: ChromatogramXAxis
): Chromatogram {
  if (axis === chromatogram.xAxis || !chromatogram.availableXAxes.includes(axis)) return chromatogram;
  const previousAxis = chromatogram.xAxis;
  const convert = (value: number): number => {
    let best = value;
    let distance = Infinity;
    for (const point of chromatogram.points) {
      const from = point.xValues[previousAxis];
      const to = point.xValues[axis];
      if (from === undefined || to === undefined) continue;
      const nextDistance = Math.abs(from - value);
      if (nextDistance < distance) {
        distance = nextDistance;
        best = to;
      }
    }
    return best;
  };
  return {
    ...chromatogram,
    xAxis: axis,
    xLabel: CHROMATOGRAM_AXIS_LABELS[axis],
    points: chromatogram.points
      .map((point) => ({ ...point, x: point.xValues[axis] ?? point.x }))
      .sort((a, b) => a.x - b.x),
    fractions: chromatogram.fractions.map((fraction) => ({
      ...fraction,
      from: convert(fraction.from),
      to: convert(fraction.to),
    })),
  };
}

// ─── Geometry ─────────────────────────────────────────────

export interface ChromatogramDomains {
  x: Domain;
  y: Domain;
  empty: boolean;
}

export function chromatogramDomain(c: Chromatogram): ChromatogramDomains {
  const xs = c.points.map((p) => p.x);
  const ys = c.points.flatMap((p) =>
    p.y.filter((v): v is number => v !== null && isFinite(v))
  );
  if (xs.length === 0 || ys.length === 0) {
    return { x: niceDomain(0, 1), y: niceDomain(0, 1), empty: true };
  }
  return {
    x: niceDomain(Math.min(...xs), Math.max(...xs)),
    y: niceDomain(Math.min(0, ...ys), Math.max(...ys)),
    empty: false,
  };
}

export interface PlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function buildChromatogramPaths(
  c: Chromatogram,
  domains: ChromatogramDomains,
  box: PlotBox
): string[] {
  const { x: xd, y: yd } = domains;
  const sx = (v: number) => box.left + ((v - xd.lo) / (xd.hi - xd.lo || 1)) * box.width;
  const sy = (v: number) => box.top + box.height - ((v - yd.lo) / (yd.hi - yd.lo || 1)) * box.height;

  return c.channels.map((_, channelIndex) => {
    let d = "";
    let pen = false;
    for (const point of c.points) {
      const value = point.y[channelIndex];
      if (value === null || value === undefined || !isFinite(value)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"} ${sx(point.x).toFixed(2)} ${sy(value).toFixed(2)} `;
      pen = true;
    }
    return d.trim();
  });
}

export function channelPeaks(
  c: Chromatogram
): { label: string; x: number; y: number }[] {
  return c.channels.map((channel, channelIndex) => {
    let best = { label: channel.label, x: NaN, y: -Infinity };
    for (const point of c.points) {
      const value = point.y[channelIndex];
      if (value !== null && isFinite(value) && value > best.y) {
        best = { label: channel.label, x: point.x, y: value };
      }
    }
    return best;
  });
}
