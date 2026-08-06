/**
 * Chromatogram import and geometry.
 *
 * One entry point — a paste straight out of the instrument's export or a
 * spreadsheet — and one path builder shared by the on-screen SVG chart and the
 * react-pdf render, so the printed peak is the same shape as the one on screen.
 *
 * Column order is 体积/CV, then the detection channels in the order the
 * instrument writes them (A280 before A260 on an ÄKTA). A header row overrides
 * the defaults; without one, `DEFAULT_CHANNEL_LABELS` names them.
 */

import { genId, normalizeNumericCell } from "./ribogreen";
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
 * What the detection columns are called when the paste has no header row.
 *
 * Naming them 通道 1 / 通道 2 was technically honest and practically useless —
 * nobody reads a chromatogram legend looking for "channel 2". This is the
 * documented paste order, so the labels can just say what they are.
 */
export const DEFAULT_CHANNEL_LABELS = ["A280", "A260"];

/**
 * Build channels from a header row, or the documented defaults when there
 * isn't one. Columns beyond the first are all channels; slots cycle through
 * chart-1..5.
 */
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
  if (!hasHeader) {
    warnings.push(
      `没有识别到表头，检测通道已按粘贴顺序命名为 ${channels
        .map((c) => c.label)
        .join(" / ")}`
    );
  }

  // Out-of-order exports plot as a scribble, so sort rather than trusting it.
  points.sort((a, b) => a.x - b.x);

  const xLabel = header?.[0]?.trim() || "体积 (mL)";
  return { channels, points, xLabel, warnings };
}

/**
 * Split a pasted block into cells.
 *
 * A spreadsheet copy is tab separated, but people also paste the contents of a
 * CSV straight in, so the separator is picked per paste. Semicolon is tried
 * before comma because a semicolon-separated export is exactly the one that
 * uses commas as decimal points, and splitting on those would shred it.
 */
function splitPaste(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0) return [];

  const body = lines.join("\n");
  const sep: string | RegExp = body.includes("\t")
    ? "\t"
    : body.includes(";")
      ? ";"
      : body.includes(",")
        ? ","
        : /\s+/;

  return lines.map((line) => line.trim().split(sep).map((c) => c.trim()));
}

/** The paste. Optional header row; column order is x, then the channels. */
export function parseChromatogramTable(text: string): ParsedChromatogram {
  return fromGrid(splitPaste(text));
}

export function createChromatogram(
  parsed: ParsedChromatogram,
  name: string,
  rawText: string
): Chromatogram {
  return {
    id: genId(),
    name,
    xLabel: parsed.xLabel,
    channels: parsed.channels,
    points: parsed.points,
    fractions: [],
    source: "paste",
    sourceName: "",
    rawText,
    note: "",
  };
}

/**
 * Re-parse an edited paste in place.
 *
 * Keeps the id, name, note and marked fractions — the user is correcting a
 * mistyped row, not starting over, and losing their peak annotations for that
 * would make them re-paste instead.
 */
export function reparseChromatogram(
  previous: Chromatogram,
  parsed: ParsedChromatogram,
  rawText: string
): Chromatogram {
  return {
    ...previous,
    xLabel: parsed.xLabel,
    channels: parsed.channels,
    points: parsed.points,
    source: "paste",
    rawText,
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
