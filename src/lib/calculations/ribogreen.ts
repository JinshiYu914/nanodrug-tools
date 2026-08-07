// ─── RiboGreen 包封率 / 浓度计算 ───────────────────────────
//
// Pure calculation layer — no React, no Supabase.
//
// Unit contract (get this wrong and every number is wrong):
//   standard curve maps 读数 → 孔内浓度 in **ng/mL**
//   稀释倍数 is applied AFTER the curve, never before
//   every concentration surfaced to the UI is in **ng/µL** (= µg/mL)

import {
  RIBOGREEN_PRESETS,
  type InstrumentKey,
  type PresetKey,
} from "./ribogreen-presets";

// ─── String-state helpers ─────────────────────────────────
// Numeric inputs live in state as strings (repo convention). `num` parses,
// `hasValue` detects presence — never use `num` for presence, since num("")
// returns 0 and a blank reading would silently resolve to the intercept.

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export function hasValue(s: string | undefined | null): boolean {
  if (typeof s !== "string") return false;
  const t = s.trim();
  return t !== "" && !isNaN(parseFloat(t));
}

/** Excel pastes carry thousands separators and non-breaking spaces. */
export function normalizeNumericCell(s: string): string {
  return s.replace(/[,\s %]/g, "");
}

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ─── Standard curve ───────────────────────────────────────

export type CurveKind = "triton" | "te";

export interface CurvePoint {
  id: string;
  /** 读数 */
  reading: string;
  /** 浓度 ng/mL */
  conc: string;
  enabled: boolean;
}

export interface CurveSpec {
  points: CurvePoint[];
  /** Force b = 0. Useful when the intercept drives low readings negative. */
  throughOrigin: boolean;
}

export interface CurvePair {
  triton: CurveSpec;
  te: CurveSpec;
}

export interface LinearFit {
  /** slope: ng/mL per reading unit */
  a: number;
  /** intercept in ng/mL; always 0 when throughOrigin */
  b: number;
  /** centered R² — comparable across throughOrigin, may go negative */
  r2: number;
  /** number of enabled points used */
  n: number;
  /** reading range of the enabled points; ±Infinity when n === 0 */
  minX: number;
  maxX: number;
  throughOrigin: boolean;
  valid: boolean;
}

const EMPTY_FIT = (throughOrigin: boolean): LinearFit => ({
  a: NaN,
  b: NaN,
  r2: NaN,
  n: 0,
  minX: Infinity,
  maxX: -Infinity,
  throughOrigin,
  valid: false,
});

export function linearFit(
  pts: ReadonlyArray<{ x: number; y: number }>,
  opts?: { throughOrigin?: boolean }
): LinearFit {
  const throughOrigin = opts?.throughOrigin ?? false;
  const n = pts.length;
  const minRequired = throughOrigin ? 1 : 2;
  if (n < minRequired) return EMPTY_FIT(throughOrigin);

  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }

  let a: number;
  let b: number;

  if (throughOrigin) {
    const sxx = pts.reduce((s, p) => s + p.x * p.x, 0);
    if (sxx === 0) return EMPTY_FIT(throughOrigin);
    a = pts.reduce((s, p) => s + p.x * p.y, 0) / sxx;
    b = 0;
  } else {
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    if (sxx === 0) return EMPTY_FIT(throughOrigin);
    a = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
    b = my - a * mx;
  }

  // Centered R² for both modes so toggling throughOrigin doesn't make the
  // number mysteriously "improve".
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const ssRes = pts.reduce((s, p) => s + (p.y - (a * p.x + b)) ** 2, 0);
  const ssTot = pts.reduce((s, p) => s + (p.y - my) ** 2, 0);
  const r2 = ssTot === 0 ? NaN : 1 - ssRes / ssTot;

  return { a, b, r2, n, minX, maxX, throughOrigin, valid: true };
}

export function fitCurve(spec: CurveSpec): LinearFit {
  const pts = spec.points
    .filter((p) => p.enabled && hasValue(p.reading) && hasValue(p.conc))
    .map((p) => ({ x: num(p.reading), y: num(p.conc) }));
  return linearFit(pts, { throughOrigin: spec.throughOrigin });
}

const MINUS = "−";

export function formatFitEquation(fit: LinearFit, digits = 4): string {
  if (!fit.valid) return "--";
  const a = fit.a.toPrecision(6).replace(/\.?0+$/, "");
  if (fit.b === 0) return `浓度 = ${a} × 读数`;
  const sign = fit.b < 0 ? MINUS : "+";
  return `浓度 = ${a} × 读数 ${sign} ${Math.abs(fit.b).toFixed(digits)}`;
}

export function formatR2(fit: LinearFit, digits = 5): string {
  if (!fit.valid || isNaN(fit.r2)) return "--";
  return fit.r2.toFixed(digits);
}

/** Reading below which the fit returns a negative concentration. */
export function negativeThreshold(fit: LinearFit): number | null {
  if (!fit.valid || fit.a === 0 || fit.b >= 0) return null;
  return -fit.b / fit.a;
}

// ─── Curve construction ───────────────────────────────────

export function createBlankPoint(): CurvePoint {
  return { id: genId(), reading: "", conc: "", enabled: true };
}

export function createBlankCurve(): CurveSpec {
  return {
    points: [0, 1, 2].map((i) => ({
      id: `blank-${i}`,
      reading: "",
      conc: "",
      enabled: true,
    })),
    throughOrigin: false,
  };
}

function presetToCurve(
  pts: readonly (readonly [number, number])[],
  prefix: string
): CurveSpec {
  return {
    points: pts.map(([reading, conc], i) => ({
      id: `${prefix}-${i}`,
      reading: String(reading),
      conc: String(conc),
      enabled: true,
    })),
    throughOrigin: false,
  };
}

/**
 * Build a fresh CurvePair. Always deep-clones — the Tecan presets are value
 * identical, and sharing objects would make unchecking a point in one chart
 * silently affect the other.
 */
export function createCurvePair(instrument: InstrumentKey): CurvePair {
  if (instrument === "custom") {
    return { triton: createBlankCurve(), te: createBlankCurve() };
  }
  const preset = RIBOGREEN_PRESETS[instrument as PresetKey];
  return {
    triton: presetToCurve(preset.triton, `${instrument}-triton`),
    te: presetToCurve(preset.te, `${instrument}-te`),
  };
}

/** True when the point values were edited away from the preset. */
export function isCurvePairModified(
  instrument: InstrumentKey,
  curves: CurvePair
): boolean {
  if (instrument === "custom") return false;
  const preset = RIBOGREEN_PRESETS[instrument as PresetKey];
  const same = (spec: CurveSpec, ref: readonly (readonly [number, number])[]) =>
    spec.points.length === ref.length &&
    spec.points.every(
      (p, i) =>
        num(p.reading) === ref[i][0] && num(p.conc) === ref[i][1]
    );
  return !(same(curves.triton, preset.triton) && same(curves.te, preset.te));
}

// ─── Samples ──────────────────────────────────────────────

export interface SampleRow {
  id: string;
  /** 样本名 (optional) */
  name: string;
  /** 稀释倍数 (required) */
  dilution: string;
  /** 读数 — TE buffer (1% Triton) */
  readTriton: string;
  /** 读数 — TE buffer */
  readTe: string;
  /** LNP 体积 (µL) — optional, for 得率 */
  lnpVolume: string;
  /** 投入 RNA 量 (µg) — optional, for 得率 */
  rnaInput: string;
  /** 需取用 LNP-RNA 量 (µg) — optional, for 取样体积 */
  needMass: string;
  /** Screening session or tLNP batch this sample's formulation came from. */
  sourceSessionId?: string;
  /** Denormalized so the link still reads if the session is renamed/removed. */
  sourceSessionName?: string;
  /** Formulation id inside that session's bench — the jump target. */
  sourceFormulationId?: string;
  /** Which kind of row `sourceSessionId` points at. Absent on rows saved
   *  before tLNP batches existed, which were all screening sessions. */
  sourceKind?: "screening_session" | "tlnp_experiment";
}

/** Fields the batch-fill dialog can write across many samples at once. */
export type BatchField = "dilution" | "lnpVolume" | "rnaInput" | "needMass";

export const BATCH_FIELDS: { field: BatchField; label: string }[] = [
  { field: "dilution", label: "稀释倍数" },
  { field: "lnpVolume", label: "LNP 体积 (µL)" },
  { field: "rnaInput", label: "投入 RNA 量 (µg)" },
  { field: "needMass", label: "需取用 LNP-RNA (µg)" },
];

/**
 * Write one or more values across the chosen sample columns.
 *
 * `onlyEmpty` keeps per-sample edits that are already there — the point of
 * batch fill is the common case, never overwriting the exceptions.
 */
export function applyBatchValues(
  rows: readonly SampleRow[],
  values: Partial<Record<BatchField, string>>,
  opts: { targetIds?: ReadonlySet<string>; onlyEmpty?: boolean } = {}
): SampleRow[] {
  const fields = Object.keys(values) as BatchField[];
  if (fields.length === 0) return rows.map((r) => ({ ...r }));

  return rows.map((r) => {
    if (opts.targetIds && !opts.targetIds.has(r.id)) return { ...r };
    const next = { ...r };
    for (const f of fields) {
      const v = values[f];
      if (v === undefined) continue;
      if (opts.onlyEmpty && hasValue(next[f])) continue;
      next[f] = v;
    }
    return next;
  });
}

/** Fill a whole input row from the first sample that has a value. */
export function fillRowFromFirst(
  rows: readonly SampleRow[],
  field: BatchField
): SampleRow[] {
  const seed = rows.find((r) => hasValue(r[field]));
  if (!seed) return rows.map((r) => ({ ...r }));
  return rows.map((r) => ({ ...r, [field]: seed[field] }));
}

export const DEFAULT_DILUTION = "100";

/** Values the dilution stepper walks through, low → high. */
export const DILUTION_LADDER = [25, 50, 100, 200, 300, 400, 500] as const;

/** Next / previous rung. Off-ladder values snap to the nearest rung first. */
export function stepDilution(current: string, dir: 1 | -1): string {
  const L = DILUTION_LADDER;
  if (!hasValue(current)) return String(dir === 1 ? L[0] : L[L.length - 1]);
  const v = num(current);
  if (dir === 1) {
    const next = L.find((x) => x > v);
    return String(next ?? L[L.length - 1]);
  }
  const prev = [...L].reverse().find((x) => x < v);
  return String(prev ?? L[0]);
}

export function createBlankSample(seedId?: string): SampleRow {
  return {
    id: seedId ?? genId(),
    name: "",
    dilution: DEFAULT_DILUTION,
    readTriton: "",
    readTe: "",
    lnpVolume: "",
    rnaInput: "",
    needMass: "",
  };
}

/** Deterministic ids so SSR and client hydrate identically. */
export function createInitialSamples(n = 8): SampleRow[] {
  return Array.from({ length: n }, (_, i) => createBlankSample(`s${i + 1}`));
}

/**
 * Auto sample name: month (unpadded) + day + 2-digit sequence.
 * 2026-07-27, sample 1 → "72701". Empty while the date is unknown (SSR).
 */
export function defaultSampleName(experimentDate: string, index: number): string {
  if (typeof experimentDate !== "string") return "";
  const m = experimentDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const month = Number(m[2]);
  return `${month}${m[3]}${String(index + 1).padStart(2, "0")}`;
}

/** What the user typed, else the auto-generated name. */
export function effectiveSampleName(
  row: SampleRow,
  index: number,
  experimentDate: string
): string {
  return row.name.trim() || defaultSampleName(experimentDate, index) || `样本 ${index + 1}`;
}

// ─── Correction ───────────────────────────────────────────

export interface CorrectionSetting {
  enabled: boolean;
  standardSampleId: string | null;
  /** 已知浓度 ng/µL */
  knownConc: string;
}

export type CorrectionReason =
  | "disabled"
  | "no-sample"
  | "no-known"
  | "no-reading"
  | "non-positive-base"
  | "invalid-fit";

export interface CorrectionResult {
  applied: boolean;
  factor: number;
  /** which curve the standard's concentration was read off */
  basis: CurveKind | null;
  /** the standard's uncorrected concentration, ng/µL */
  baseConc: number | null;
  reason: CorrectionReason | null;
}

export const NO_CORRECTION: CorrectionResult = {
  applied: false,
  factor: 1,
  basis: null,
  baseConc: null,
  reason: "disabled",
};

export function createDefaultCorrection(): CorrectionSetting {
  return { enabled: false, standardSampleId: null, knownConc: "" };
}

// ─── Range check ──────────────────────────────────────────

export type RangeFlag = "ok" | "below" | "above" | "empty" | "unknown";

export function checkRange(reading: string, fit: LinearFit): RangeFlag {
  if (!hasValue(reading)) return "empty";
  if (!fit.valid) return "unknown";
  const x = num(reading);
  if (x < fit.minX) return "below";
  if (x > fit.maxX) return "above";
  return "ok";
}

// ─── Batch computation ────────────────────────────────────

export interface SampleFlags {
  tritonRange: RangeFlag;
  teRange: RangeFlag;
  missingDilution: boolean;
  negativeTotal: boolean;
  negativeFree: boolean;
  negativeLnpRna: boolean;
}

export interface SampleComputed {
  id: string;
  dilution: number | null;
  /** before correction, ng/µL */
  totalRaw_ng_uL: number | null;
  freeRaw_ng_uL: number | null;
  /** after correction, ng/µL */
  total_ng_uL: number | null;
  free_ng_uL: number | null;
  lnpRna_ng_uL: number | null;
  ee_percent: number | null;
  yield_percent: number | null;
  sampleVolume_uL: number | null;
  flags: SampleFlags;
}

export interface BatchComputed {
  fits: { triton: LinearFit; te: LinearFit };
  correction: CorrectionResult;
  samples: SampleComputed[];
}

/**
 * 读数 → 浓度 ng/µL, dilution applied AFTER the curve.
 *   a·(d·x) + b ≠ d·(a·x + b) whenever b ≠ 0 — the curve maps a *well*
 *   reading to a *well* concentration; the dilution undoes the assay dilution.
 */
function readingToConc(
  reading: string,
  dilution: number | null,
  fit: LinearFit
): number | null {
  if (!hasValue(reading) || dilution === null || !fit.valid) return null;
  const ng_mL = fit.a * num(reading) + fit.b;
  return (ng_mL / 1000) * dilution;
}

export function computeCorrectionFactor(
  rows: readonly SampleRow[],
  fits: { triton: LinearFit; te: LinearFit },
  correction: CorrectionSetting
): CorrectionResult {
  if (!correction.enabled) return NO_CORRECTION;

  const std = rows.find((r) => r.id === correction.standardSampleId);
  if (!std) return { ...NO_CORRECTION, reason: "no-sample" };

  if (!hasValue(correction.knownConc) || num(correction.knownConc) <= 0) {
    return { ...NO_CORRECTION, reason: "no-known" };
  }

  const dilution =
    hasValue(std.dilution) && num(std.dilution) > 0 ? num(std.dilution) : null;
  if (dilution === null) {
    return { ...NO_CORRECTION, reason: "no-reading" };
  }

  // 基于总浓度：prefer the Triton reading; fall back to whichever the user
  // actually filled in.
  let basis: CurveKind | null = null;
  if (hasValue(std.readTriton)) basis = "triton";
  else if (hasValue(std.readTe)) basis = "te";
  if (!basis) return { ...NO_CORRECTION, reason: "no-reading" };

  const fit = basis === "triton" ? fits.triton : fits.te;
  if (!fit.valid) return { ...NO_CORRECTION, reason: "invalid-fit" };

  const base = readingToConc(
    basis === "triton" ? std.readTriton : std.readTe,
    dilution,
    fit
  );
  if (base === null || !(base > 0)) {
    return { ...NO_CORRECTION, basis, baseConc: base, reason: "non-positive-base" };
  }

  return {
    applied: true,
    factor: num(correction.knownConc) / base,
    basis,
    baseConc: base,
    reason: null,
  };
}

export function computeBatch(input: {
  rows: readonly SampleRow[];
  curves: CurvePair;
  correction: CorrectionSetting;
}): BatchComputed {
  const { rows, curves, correction } = input;
  const fits = {
    triton: fitCurve(curves.triton),
    te: fitCurve(curves.te),
  };

  // Pass 1 — raw only. The correction factor's denominator must be the
  // standard's *uncorrected* concentration, or it collapses to factor = 1.
  const correctionResult = computeCorrectionFactor(rows, fits, correction);
  const k = correctionResult.applied ? correctionResult.factor : 1;

  // Pass 2 — apply the factor.
  const samples = rows.map<SampleComputed>((r) => {
    const dilution =
      hasValue(r.dilution) && num(r.dilution) > 0 ? num(r.dilution) : null;

    const totalRaw = readingToConc(r.readTriton, dilution, fits.triton);
    const freeRaw = readingToConc(r.readTe, dilution, fits.te);

    const total = totalRaw === null ? null : totalRaw * k;
    const free = freeRaw === null ? null : freeRaw * k;

    const lnpRna = total !== null && free !== null ? total - free : null;

    const ee =
      total !== null && free !== null && total > 0
        ? ((total - free) / total) * 100
        : null;

    // ng/µL × µL = ng ; µg × 1000 = ng
    const yieldPct =
      lnpRna !== null &&
      hasValue(r.lnpVolume) &&
      num(r.lnpVolume) > 0 &&
      hasValue(r.rnaInput) &&
      num(r.rnaInput) > 0
        ? (lnpRna * num(r.lnpVolume)) / (num(r.rnaInput) * 1000) * 100
        : null;

    // µg × 1000 = ng ; ng ÷ (ng/µL) = µL
    const sampleVolume =
      lnpRna !== null &&
      lnpRna > 0 &&
      hasValue(r.needMass) &&
      num(r.needMass) > 0
        ? (num(r.needMass) * 1000) / lnpRna
        : null;

    return {
      id: r.id,
      dilution,
      totalRaw_ng_uL: totalRaw,
      freeRaw_ng_uL: freeRaw,
      total_ng_uL: total,
      free_ng_uL: free,
      lnpRna_ng_uL: lnpRna,
      ee_percent: ee,
      yield_percent: yieldPct,
      sampleVolume_uL: sampleVolume,
      flags: {
        tritonRange: checkRange(r.readTriton, fits.triton),
        teRange: checkRange(r.readTe, fits.te),
        missingDilution:
          dilution === null &&
          (hasValue(r.readTriton) || hasValue(r.readTe)),
        negativeTotal: total !== null && total < 0,
        negativeFree: free !== null && free < 0,
        negativeLnpRna: lnpRna !== null && lnpRna < 0,
      },
    };
  });

  return { fits, correction: correctionResult, samples };
}

/** True when any sample carries a flag worth surfacing. */
export function hasWarnings(batch: BatchComputed): boolean {
  return batch.samples.some(
    (s) =>
      s.flags.tritonRange === "below" ||
      s.flags.tritonRange === "above" ||
      s.flags.teRange === "below" ||
      s.flags.teRange === "above" ||
      s.flags.missingDilution ||
      s.flags.negativeTotal ||
      s.flags.negativeFree ||
      s.flags.negativeLnpRna
  );
}

// ─── Clipboard ────────────────────────────────────────────

export type PasteField =
  | "name"
  | "dilution"
  | "readTriton"
  | "readTe"
  | "lnpVolume"
  | "rnaInput"
  | "needMass";

export const PASTE_FIELD_ORDER: readonly PasteField[] = [
  "name",
  "dilution",
  "readTriton",
  "readTe",
  "lnpVolume",
  "rnaInput",
  "needMass",
];

/** Lossless TSV split. Numeric normalization happens at the field level. */
export function parseClipboardGrid(text: string): string[][] {
  if (!text || !text.trim()) return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return lines.map((line) => line.split("\t").map((c) => c.trim()));
}

export const MAX_SAMPLE_COLUMNS = 96;

/**
 * Fill a pasted grid into the sample columns starting at `target`.
 *
 * grid[0] fills `target.field` rightward from `target.colIndex`; grid[1],
 * grid[2]… fill the following fields in PASTE_FIELD_ORDER. An N×1 grid
 * (N > 2) is transposed — users routinely copy a *column* of readings
 * out of Excel.
 */
export function applyClipboardToSamples(
  rows: readonly SampleRow[],
  grid: readonly (readonly string[])[],
  target: { field: PasteField; colIndex: number },
  opts?: { maxColumns?: number }
): { rows: SampleRow[]; appended: number; truncated: number } {
  const maxColumns = opts?.maxColumns ?? MAX_SAMPLE_COLUMNS;
  if (grid.length === 0) {
    return { rows: rows.map((r) => ({ ...r })), appended: 0, truncated: 0 };
  }

  let block = grid.map((r) => [...r]);
  if (block.length > 2 && block.every((r) => r.length === 1)) {
    block = [block.map((r) => r[0])];
  }

  const startField = PASTE_FIELD_ORDER.indexOf(target.field);
  const fieldsLeft = PASTE_FIELD_ORDER.length - startField;
  let truncated = 0;
  if (block.length > fieldsLeft) {
    truncated += block.length - fieldsLeft;
    block = block.slice(0, fieldsLeft);
  }

  const widest = block.reduce((m, r) => Math.max(m, r.length), 0);
  let needed = target.colIndex + widest;
  if (needed > maxColumns) {
    truncated += needed - maxColumns;
    needed = maxColumns;
  }

  const next = rows.map((r) => ({ ...r }));
  let appended = 0;
  while (next.length < needed) {
    next.push(createBlankSample());
    appended++;
  }

  block.forEach((line, rowOffset) => {
    const field = PASTE_FIELD_ORDER[startField + rowOffset];
    line.forEach((cell, colOffset) => {
      const idx = target.colIndex + colOffset;
      if (idx >= next.length) return;
      next[idx][field] = field === "name" ? cell : normalizeNumericCell(cell);
    });
  });

  return { rows: next, appended, truncated };
}

// ─── Persistence ──────────────────────────────────────────

export const RIBOGREEN_SCHEMA_VERSION = 1;

export interface FitSnapshot {
  a: number;
  b: number;
  r2: number;
  n: number;
  minX: number;
  maxX: number;
  throughOrigin: boolean;
}

export interface RibogreenCurveData {
  schemaVersion: number;
  kind: "ribogreen_curve";
  instrument: InstrumentKey;
  curves: CurvePair;
  note: string;
}

export interface RibogreenResultData {
  schemaVersion: number;
  kind: "ribogreen_result";
  /** YYYY-MM-DD */
  experimentDate: string;
  instrument: InstrumentKey;
  curves: CurvePair;
  /** denormalized, advisory only — always refit from `curves` on load */
  fits: { triton: FitSnapshot; te: FitSnapshot };
  rows: SampleRow[];
  correction: CorrectionSetting;
}

function toSnapshot(fit: LinearFit): FitSnapshot {
  return {
    a: fit.a,
    b: fit.b,
    r2: fit.r2,
    n: fit.n,
    minX: fit.minX,
    maxX: fit.maxX,
    throughOrigin: fit.throughOrigin,
  };
}

export function serializeCurve(
  instrument: InstrumentKey,
  curves: CurvePair,
  note = ""
): RibogreenCurveData {
  return {
    schemaVersion: RIBOGREEN_SCHEMA_VERSION,
    kind: "ribogreen_curve",
    instrument,
    curves: cloneCurvePair(curves),
    note,
  };
}

export function serializeResult(args: {
  experimentDate: string;
  instrument: InstrumentKey;
  curves: CurvePair;
  rows: readonly SampleRow[];
  correction: CorrectionSetting;
}): RibogreenResultData {
  return {
    schemaVersion: RIBOGREEN_SCHEMA_VERSION,
    kind: "ribogreen_result",
    experimentDate: args.experimentDate,
    instrument: args.instrument,
    curves: cloneCurvePair(args.curves),
    fits: {
      triton: toSnapshot(fitCurve(args.curves.triton)),
      te: toSnapshot(fitCurve(args.curves.te)),
    },
    // Materialize auto-generated names so history stays stable even if the
    // record's date is later edited.
    rows: args.rows.map((r, i) => ({
      ...r,
      name: effectiveSampleName(r, i, args.experimentDate),
    })),
    correction: { ...args.correction },
  };
}

/** Number of samples with at least one reading — for the record cards. */
export function countFilledSamples(data: Record<string, unknown> | null): number {
  if (!data || typeof data !== "object" || !Array.isArray(data.rows)) return 0;
  return data.rows.filter((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const t = typeof o.readTriton === "string" ? o.readTriton : "";
    const e = typeof o.readTe === "string" ? o.readTe : "";
    return hasValue(t) || hasValue(e);
  }).length;
}

/**
 * Formulation ids referenced by a saved result — lets the screening bench ask
 * "which RiboGreen records measured this formulation?" without parsing the
 * whole record.
 */
export function collectLinkedFormulationIds(
  data: Record<string, unknown> | null | undefined
): Set<string> {
  const out = new Set<string>();
  if (!data || typeof data !== "object" || !Array.isArray(data.rows)) return out;
  for (const r of data.rows) {
    const o = (r ?? {}) as Record<string, unknown>;
    if (typeof o.sourceFormulationId === "string" && o.sourceFormulationId) {
      out.add(o.sourceFormulationId);
    }
  }
  return out;
}

export function cloneCurvePair(c: CurvePair): CurvePair {
  return {
    triton: {
      throughOrigin: c.triton.throughOrigin,
      points: c.triton.points.map((p) => ({ ...p })),
    },
    te: {
      throughOrigin: c.te.throughOrigin,
      points: c.te.points.map((p) => ({ ...p })),
    },
  };
}

// Defensive parsers — mirror parseBenchSession: never throw, return null on
// any shape mismatch so a corrupt row can't take down the page.

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback;
}

function parseCurveSpec(raw: unknown): CurveSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.points)) return null;
  return {
    throughOrigin: o.throughOrigin === true,
    points: o.points.map((p, i) => {
      const q = (p ?? {}) as Record<string, unknown>;
      return {
        id: str(q.id, `p-${i}`),
        reading: str(q.reading),
        conc: str(q.conc),
        enabled: q.enabled !== false,
      };
    }),
  };
}

function parseCurvePair(raw: unknown): CurvePair | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const triton = parseCurveSpec(o.triton);
  const te = parseCurveSpec(o.te);
  if (!triton || !te) return null;
  return { triton, te };
}

function parseInstrument(raw: unknown): InstrumentKey {
  return raw === "thermo" || raw === "tecan" || raw === "custom"
    ? raw
    : "custom";
}

export function parseCurveData(
  raw: Record<string, unknown> | null | undefined
): RibogreenCurveData | null {
  if (!raw || typeof raw !== "object") return null;
  const curves = parseCurvePair(raw.curves);
  if (!curves) return null;
  return {
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1,
    kind: "ribogreen_curve",
    instrument: parseInstrument(raw.instrument),
    curves,
    note: str(raw.note),
  };
}

export function parseResultData(
  raw: Record<string, unknown> | null | undefined
): RibogreenResultData | null {
  if (!raw || typeof raw !== "object") return null;
  const curves = parseCurvePair(raw.curves);
  if (!curves) return null;
  if (!Array.isArray(raw.rows)) return null;

  const rows: SampleRow[] = raw.rows.map((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      id: str(o.id, `s${i + 1}`),
      name: str(o.name),
      dilution: str(o.dilution, "1"),
      readTriton: str(o.readTriton),
      readTe: str(o.readTe),
      lnpVolume: str(o.lnpVolume),
      rnaInput: str(o.rnaInput),
      needMass: str(o.needMass),
      ...(typeof o.sourceSessionId === "string"
        ? { sourceSessionId: o.sourceSessionId }
        : {}),
      ...(typeof o.sourceSessionName === "string"
        ? { sourceSessionName: o.sourceSessionName }
        : {}),
      ...(typeof o.sourceFormulationId === "string"
        ? { sourceFormulationId: o.sourceFormulationId }
        : {}),
      ...(o.sourceKind === "tlnp_experiment" || o.sourceKind === "screening_session"
        ? { sourceKind: o.sourceKind }
        : {}),
    };
  });

  const c = (raw.correction ?? {}) as Record<string, unknown>;

  return {
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : 1,
    kind: "ribogreen_result",
    experimentDate: str(raw.experimentDate),
    instrument: parseInstrument(raw.instrument),
    curves,
    fits: {
      triton: toSnapshot(fitCurve(curves.triton)),
      te: toSnapshot(fitCurve(curves.te)),
    },
    rows: rows.length > 0 ? rows : createInitialSamples(),
    correction: {
      enabled: c.enabled === true,
      standardSampleId: typeof c.standardSampleId === "string" ? c.standardSampleId : null,
      knownConc: str(c.knownConc),
    },
  };
}

/**
 * Bucket for the 年/月 filter. Prefers the user-editable experimentDate —
 * plate readings are routinely entered days after the bench run, and
 * re-saving an edited batch never moves created_at.
 */
export function getItemYearMonth(
  data: Record<string, unknown> | null | undefined,
  createdAt: string
): { year: number; month: number } {
  const raw = data && typeof data === "object" ? data.experimentDate : null;
  if (typeof raw === "string") {
    const m = raw.match(/^(\d{4})-(\d{2})/);
    if (m) return { year: Number(m[1]), month: Number(m[2]) };
  }
  const d = new Date(createdAt);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return { year: 0, month: 0 };
}

/** Local YYYY-MM-DD (not toISOString — that shifts across the date line). */
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ─── Copy to clipboard ────────────────────────────────────

const fmt = (v: number | null, digits = 2) =>
  v === null || !isFinite(v) ? "" : v.toFixed(digits);

export type CopyMode = "all" | "key";

/** Shared column definition for both TSV copy and the Excel export. */
export function buildResultTable(
  rows: readonly SampleRow[],
  batch: BatchComputed,
  experimentDate: string,
  mode: CopyMode = "all"
): { header: string[]; body: string[][] } {
  const byId = new Map(batch.samples.map((s) => [s.id, s]));

  const keyHeader = [
    "样本名",
    "LNP-RNA 浓度 (ng/µL)",
    "包封率 (%)",
    "得率 (%)",
    "取样体积 (µL)",
  ];
  const allHeader = [
    "样本名",
    "稀释倍数",
    "读数 Triton",
    "读数 TE",
    "总浓度 (ng/µL)",
    "游离浓度 (ng/µL)",
    "LNP-RNA 浓度 (ng/µL)",
    "包封率 (%)",
    "得率 (%)",
    "需取用量 (µg)",
    "取样体积 (µL)",
  ];

  const body = rows.map((r, i) => {
    const c = byId.get(r.id);
    const name = effectiveSampleName(r, i, experimentDate);
    if (mode === "key") {
      return [
        name,
        fmt(c?.lnpRna_ng_uL ?? null),
        fmt(c?.ee_percent ?? null, 1),
        fmt(c?.yield_percent ?? null, 1),
        fmt(c?.sampleVolume_uL ?? null),
      ];
    }
    return [
      name,
      r.dilution,
      r.readTriton,
      r.readTe,
      fmt(c?.total_ng_uL ?? null),
      fmt(c?.free_ng_uL ?? null),
      fmt(c?.lnpRna_ng_uL ?? null),
      fmt(c?.ee_percent ?? null, 1),
      fmt(c?.yield_percent ?? null, 1),
      r.needMass,
      fmt(c?.sampleVolume_uL ?? null),
    ];
  });

  return { header: mode === "key" ? keyHeader : allHeader, body };
}

export function buildResultTsv(
  rows: readonly SampleRow[],
  batch: BatchComputed,
  experimentDate: string,
  mode: CopyMode = "all"
): string {
  const { header, body } = buildResultTable(rows, batch, experimentDate, mode);
  return [header.join("\t"), ...body.map((r) => r.join("\t"))].join("\n");
}
