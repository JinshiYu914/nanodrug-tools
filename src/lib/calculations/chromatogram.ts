/**
 * Chromatogram import and geometry.
 *
 * Two entry points — an Excel paste and a CSV upload — that converge on the
 * same `Chromatogram`, and one path builder shared by the on-screen SVG chart
 * and (later) the react-pdf render, so the printed peak is the same shape as
 * the one on screen.
 */

import { genId, normalizeNumericCell, parseClipboardGrid } from "./ribogreen";
import { niceDomain, type Domain } from "./chart-scale";
import type {
  Chromatogram,
  ChromatogramChannel,
  ChromatogramPoint,
} from "./tlnp-experiment";

export interface ParsedChromatogram {
  channels: ChromatogramChannel[];
  points: ChromatogramPoint[];
  xLabel: string;
  /** Non-fatal notes: dropped rows, missing cells, a guessed header. */
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

/**
 * Does row 0 look like a header?
 *
 * A header is a row whose first cell isn't a number. Data rows always start
 * with an x value, so this is reliable and needs no user input.
 */
function looksLikeHeader(grid: string[][]): boolean {
  const first = grid[0];
  return !!first && first.length > 0 && !isNumeric(first[0]);
}

/**
 * Build channels from a header row, or generic names when there isn't one.
 *
 * Columns beyond the first are all channels — A260 and A280 together are the
 * normal case, and slots cycle through chart-1..5.
 */
export function detectChannels(
  header: string[] | null,
  columnCount: number
): ChromatogramChannel[] {
  const out: ChromatogramChannel[] = [];
  for (let i = 1; i < columnCount; i++) {
    const label = header?.[i]?.trim() || `通道 ${i}`;
    out.push({
      id: genId(),
      label,
      slot: (((i - 1) % 5) + 1) as 1 | 2 | 3 | 4 | 5,
    });
  }
  return out;
}

function fromGrid(grid: string[][]): ParsedChromatogram {
  const warnings: string[] = [];
  const rows = grid.filter((r) => r.some((c) => c.trim() !== ""));

  if (rows.length === 0) {
    return { channels: [], points: [], xLabel: "体积 (mL)", warnings: ["没有读到任何数据"] };
  }

  const hasHeader = looksLikeHeader(rows);
  const header = hasHeader ? rows[0] : null;
  const body = hasHeader ? rows.slice(1) : rows;

  const columnCount = Math.max(...rows.map((r) => r.length));
  if (columnCount < 2) {
    return {
      channels: [],
      points: [],
      xLabel: "体积 (mL)",
      warnings: ["至少需要两列：第一列是体积或时间，其余列是检测信号"],
    };
  }

  const channels = detectChannels(header, columnCount);
  const points: ChromatogramPoint[] = [];
  let dropped = 0;

  for (const row of body) {
    const x = toNum(row[0] ?? "");
    if (x === null) {
      dropped++;
      continue;
    }
    const y = channels.map((_, i) => toNum(row[i + 1] ?? ""));
    points.push({ x, y });
  }

  if (dropped > 0) warnings.push(`忽略了 ${dropped} 行无法解析的数据`);
  if (points.length === 0) warnings.push("没有解析出有效数据点");
  if (!hasHeader) warnings.push("没有识别到表头，通道已按顺序命名");

  // Out-of-order exports plot as a scribble, so sort rather than trusting it.
  points.sort((a, b) => a.x - b.x);

  const xLabel = header?.[0]?.trim() || "体积 (mL)";
  return { channels, points, xLabel, warnings };
}

/** Excel paste — tab separated, optional header row. */
export function parseChromatogramTable(text: string): ParsedChromatogram {
  return fromGrid(parseClipboardGrid(text));
}

/**
 * CSV upload. Handles comma and semicolon separators plus quoted fields, since
 * instrument software exports all three shapes.
 */
export function parseChromatogramCsv(text: string): ParsedChromatogram {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const sample = lines.find((l) => l.trim() !== "") ?? "";
  const sep = sample.includes(";") && !sample.includes(",") ? ";" : ",";

  const grid = lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else quoted = false;
        } else cur += ch;
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === sep) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  });

  return fromGrid(grid);
}

export function createChromatogram(
  parsed: ParsedChromatogram,
  name: string,
  source: "paste" | "csv",
  sourceName: string
): Chromatogram {
  return {
    id: genId(),
    name,
    xLabel: parsed.xLabel,
    channels: parsed.channels,
    points: parsed.points,
    fractions: [],
    source,
    sourceName,
    note: "",
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
    // Always include zero — a trace floating off the baseline reads as noise.
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

/**
 * One SVG path per channel.
 *
 * Gaps (null readings) break the path rather than interpolating across them —
 * a straight line through missing data would read as a real measurement.
 */
export function buildChromatogramPaths(
  c: Chromatogram,
  domains: ChromatogramDomains,
  box: PlotBox
): string[] {
  const { x: xd, y: yd } = domains;
  const sx = (v: number) =>
    box.left + ((v - xd.lo) / (xd.hi - xd.lo || 1)) * box.width;
  const sy = (v: number) =>
    box.top + box.height - ((v - yd.lo) / (yd.hi - yd.lo || 1)) * box.height;

  return c.channels.map((_, ci) => {
    let d = "";
    let pen = false;
    for (const p of c.points) {
      const v = p.y[ci];
      if (v === null || v === undefined || !isFinite(v)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"} ${sx(p.x).toFixed(2)} ${sy(v).toFixed(2)} `;
      pen = true;
    }
    return d.trim();
  });
}

/** Highest reading on each channel, for the summary line under the chart. */
export function channelPeaks(
  c: Chromatogram
): { label: string; x: number; y: number }[] {
  return c.channels.map((ch, ci) => {
    let best = { label: ch.label, x: NaN, y: -Infinity };
    for (const p of c.points) {
      const v = p.y[ci];
      if (v !== null && isFinite(v) && v > best.y) {
        best = { label: ch.label, x: p.x, y: v };
      }
    }
    return best;
  });
}
