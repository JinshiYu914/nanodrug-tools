/**
 * The tLNP workbench batch model.
 *
 * One batch = one `lnp_saved_items` row with `type: "tlnp_experiment"` and the
 * whole thing in `data`. Four modules, each carrying its design parameters and
 * its results:
 *
 *   1 LNP 制备 → 2 偶联反应 → 3 LNP 纯化 → 4 体内外实验
 *
 * Two decisions worth knowing before editing:
 *
 * - `TlnpPrepSample extends BenchFormulation`. A sample *is* a formulation, so
 *   computeBenchFormulation, composeLipidSummary, describeMethod and both bench
 *   exporters accept `prep.samples` with no adapter. Do not demote it to a
 *   `formulation:` field — that trades a whole PDF exporter for nothing.
 *
 * - The flow graph uses our own node/edge types, never @xyflow/react's. Stored
 *   data must not be shaped by a rendering library we might replace.
 *
 * `parseTlnpExperiment` never throws: this is a lab notebook, and a batch that
 * refuses to open because one field went weird is worse than a batch that opens
 * with that field blank.
 */

import {
  createDefaultEntries,
  type LipidEntry,
} from "./lnp-formula";
import {
  createDefaultMethod,
  describeMethod,
  parseBenchMethod,
  type BenchFormulation,
  type BenchMethod,
  type BenchPrepParams,
} from "./lnp-bench";
import { genId, todayISO } from "./ribogreen";
import {
  createParamEntries,
  mergeParamEntries,
  paramsFilled,
  paramValue,
  type ParamEntry,
  INVITRO_PARAM_PRESETS,
  INVIVO_PARAM_PRESETS,
  PREP_PARAM_PRESETS,
  PURIFICATION_PARAM_PRESETS,
} from "./tlnp-params";

export const TLNP_SCHEMA_VERSION = 1;

// ─── Shared result shapes ─────────────────────────────────

/**
 * A pointer into a saved RiboGreen record, plus a snapshot of what it said.
 *
 * The snapshot is what makes a batch readable years later: the source record
 * can be edited, renamed or deleted, and the numbers written into the notebook
 * at the time should not silently change underneath. Refreshable on demand.
 */
export interface RibogreenLink {
  itemId: string;
  itemName: string;
  sampleId: string;
  sampleName: string;
  capturedAt: string;
  snapshot: {
    total_ng_uL: number | null;
    lnpRna_ng_uL: number | null;
    ee_percent: number | null;
    yield_percent: number | null;
    lnpVolume_uL: number | null;
  };
}

export interface EeResult {
  link: RibogreenLink | null;
  /** Typed by hand when the assay was run outside the RiboGreen tool. */
  manual: {
    conc_ng_uL: string;
    volume_uL: string;
    ee_percent: string;
    yield_percent: string;
  };
}

export interface DlsResult {
  size_nm: string;
  pdi: string;
  zeta_mV: string;
  instrument: string;
  note: string;
}

export function emptyEeResult(): EeResult {
  return {
    link: null,
    manual: { conc_ng_uL: "", volume_uL: "", ee_percent: "", yield_percent: "" },
  };
}

export function emptyDlsResult(): DlsResult {
  return { size_nm: "", pdi: "", zeta_mV: "", instrument: "", note: "" };
}

const numOrNull = (s: string | null | undefined): number | null => {
  if (typeof s !== "string" || s.trim() === "") return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

export interface ResolvedEe {
  conc: number | null;
  volume: number | null;
  ee: number | null;
  yield_: number | null;
  source: "ribogreen" | "manual" | "none";
}

/**
 * A linked RiboGreen record wins over hand-typed values — it came from actual
 * readings and a fitted curve. Every display and every exporter reads through
 * here so the two never disagree on screen.
 */
export function resolveEe(r: EeResult): ResolvedEe {
  if (r.link) {
    const s = r.link.snapshot;
    return {
      conc: s.lnpRna_ng_uL ?? s.total_ng_uL,
      volume: s.lnpVolume_uL,
      ee: s.ee_percent,
      yield_: s.yield_percent,
      source: "ribogreen",
    };
  }
  const conc = numOrNull(r.manual.conc_ng_uL);
  const volume = numOrNull(r.manual.volume_uL);
  const ee = numOrNull(r.manual.ee_percent);
  const yield_ = numOrNull(r.manual.yield_percent);
  const any = conc !== null || volume !== null || ee !== null || yield_ !== null;
  return { conc, volume, ee, yield_, source: any ? "manual" : "none" };
}

// ─── Module 1: LNP 制备 ───────────────────────────────────

export interface SolventExchange {
  /** Reuses BenchMethod wholesale: 透析 1h/2h/3h/4h/自定义, 超滤 1/2/3/仅浓缩. */
  method: BenchMethod;
  /** PBS pH 7.4 / PBS pH 6.8 with EDTA / 自定义 — a ParamEntry so "custom"
   *  behaves exactly like every other pickable field on the page. */
  buffer: ParamEntry;
}

export interface TlnpPrepSample extends BenchFormulation {
  ee: EeResult;
  dls: DlsResult;
  resultNote: string;
}

export interface TlnpPrepModule {
  design: {
    params: ParamEntry[];
    solvent: SolventExchange;
    note: string;
  };
  samples: TlnpPrepSample[];
  results: { discussion: string };
}

const BUFFER_PRESET = {
  id: "solventBuffer",
  label: "置换 buffer",
  options: ["PBS pH 7.4", "PBS pH 6.8 with EDTA"],
  placeholder: "自定义 buffer",
};

function emptySolvent(): SolventExchange {
  return {
    method: createDefaultMethod(),
    buffer: createParamEntries([BUFFER_PRESET])[0],
  };
}

function defaultPrepParams(): BenchPrepParams {
  return {
    masterConc: "10",
    frrAqueous: "3",
    frrOrganic: "1",
    npRatio: "6",
    rnaMass: "10",
    rnaConc: "1",
    naType: "mRNA",
    aminesPerMolecule: "1",
  };
}

/**
 * A new sample clones the previous one when there is one — across a screen of
 * formulations the lipid identities, MWs, stock concentrations and prep params
 * are constant and only the molar ratios move, so cloning is what the user
 * would otherwise do by hand eight times.
 */
export function createTlnpSample(
  seed?: TlnpPrepSample | null,
  name?: string
): TlnpPrepSample {
  const lipidEntries: LipidEntry[] = seed
    ? seed.lipidEntries.map((e) => ({ ...e }))
    : createDefaultEntries();
  return {
    id: genId(),
    name: name ?? "",
    lipidEntries,
    prep: seed ? { ...seed.prep } : defaultPrepParams(),
    method: seed?.method ? { ...seed.method } : createDefaultMethod(),
    notes: "",
    createdAt: new Date().toISOString(),
    ee: emptyEeResult(),
    dls: emptyDlsResult(),
    resultNote: "",
  };
}

// ─── Module 2: 偶联反应 ───────────────────────────────────

export interface ReactionCondition {
  id: string;
  name: string;
  linker: string;
  /** ng/µL on an RNA basis — the same unit RiboGreen reports, deliberately. */
  lnpConc: string;
  lnpAmount: string;
  lnpAmountUnit: "uL" | "ug";
  proteinName: string;
  /** Da */
  proteinMW: string;
  proteinConc: string;
  proteinConcUnit: "mg_per_mL" | "uM";
  /** 蛋白 : LNP */
  targetMolarRatio: string;
  /** Average RNA length in nt — turns ng of RNA into mol. Blank = use 1000. */
  rnaLength_nt: string;
  temperature: string;
  duration: string;
  shaking: string;
  note: string;
}

export type TlnpNodeKind = "sample" | "condition" | "product";

export interface TlnpFlowNode {
  /** Namespaced: `s:<sampleId>` | `c:<conditionId>` | `p:<productId>` */
  id: string;
  kind: TlnpNodeKind;
  refId: string;
  /** Denormalized so the static SVG and the PDF render without resolving refs. */
  label: string;
  position: { x: number; y: number };
}

export interface TlnpFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ConjugateProduct {
  id: string;
  /** Auto name is `${sampleName}-${conditionName}`; this holds an override. */
  nameOverride: string;
  sampleId: string;
  conditionId: string;
}

export interface ObservationRow {
  id: string;
  productId: string;
  turbidity: "clear" | "slight" | "turbid" | "";
  precipitate: "none" | "slight" | "heavy" | "";
  note: string;
}

export interface TlnpConjugationModule {
  conditions: ReactionCondition[];
  nodes: TlnpFlowNode[];
  edges: TlnpFlowEdge[];
  products: ConjugateProduct[];
  results: { observations: ObservationRow[]; discussion: string };
}

export function createReactionCondition(index: number): ReactionCondition {
  return {
    id: genId(),
    name: `条件 ${index + 1}`,
    linker: "",
    lnpConc: "",
    lnpAmount: "",
    lnpAmountUnit: "uL",
    proteinName: "",
    proteinMW: "",
    proteinConc: "",
    proteinConcUnit: "mg_per_mL",
    targetMolarRatio: "",
    rnaLength_nt: "",
    temperature: "室温",
    duration: "2 h",
    shaking: "",
    note: "",
  };
}

export function createObservationRow(): ObservationRow {
  return { id: genId(), productId: "", turbidity: "", precipitate: "", note: "" };
}

// ─── Module 3: LNP 纯化 ───────────────────────────────────

export interface ChromatogramChannel {
  id: string;
  label: string;
  /** 1–5 → the chart-N token this trace draws in. */
  slot: 1 | 2 | 3 | 4 | 5;
}

export interface ChromatogramPoint {
  x: number;
  /** One entry per channel, index-aligned with `channels`. */
  y: (number | null)[];
}

export interface ChromatogramFraction {
  id: string;
  from: number;
  to: number;
  label: string;
}

export interface Chromatogram {
  id: string;
  name: string;
  xLabel: string;
  channels: ChromatogramChannel[];
  points: ChromatogramPoint[];
  fractions: ChromatogramFraction[];
  source: "paste" | "csv";
  sourceName: string;
  note: string;
}

export interface TemResult {
  /** An external URL for now — base64 images do not belong in a JSONB row. */
  imageUrl: string;
  magnification: string;
  note: string;
}

export type PurificationMethod = "cl4b" | "ultrafiltration" | "dialysis" | "";

export interface TlnpPurificationModule {
  design: {
    method: PurificationMethod;
    cl4b: {
      columnLength: string;
      columnDiameter: string;
      flowRate: string;
      buffer: string;
      note: string;
    };
    ultrafiltration: { mwco: string; cycles: string; note: string };
    dialysis: { mwco: string; duration: string; buffer: string; note: string };
    params: ParamEntry[];
    note: string;
  };
  chromatograms: Chromatogram[];
  results: {
    ee: EeResult;
    dls: DlsResult;
    tem: TemResult;
    discussion: string;
  };
}

export const PURIFICATION_METHOD_LABELS: Record<
  Exclude<PurificationMethod, "">,
  string
> = {
  cl4b: "CL-4B 层析",
  ultrafiltration: "超滤",
  dialysis: "透析",
};

// ─── Module 4: 体内外实验 ─────────────────────────────────

export interface MetricRow {
  id: string;
  /** Which sample / product this measurement belongs to. */
  label: string;
  /** Free-text grouping — 组别, timepoint, replicate, whatever the assay needs. */
  group: string;
  value: string;
  unit: string;
  note: string;
}

export interface InVitroDesign {
  cellLine: string;
  /** 原代代数, e.g. A1P1. */
  passage: string;
  plate: string;
  seedingDensity: string;
  dose: string;
  timepoints: string;
  params: ParamEntry[];
  note: string;
}

export interface InVivoDesign {
  species: string;
  strain: string;
  route: string;
  dose: string;
  groups: string;
  timepoints: string;
  params: ParamEntry[];
  note: string;
}

export interface TlnpAssayModule {
  /** Which arm the user is working in — both are always persisted. */
  active: "invitro" | "invivo";
  invitro: {
    design: InVitroDesign;
    results: { rows: MetricRow[]; discussion: string };
  };
  invivo: {
    design: InVivoDesign;
    results: { rows: MetricRow[]; discussion: string };
  };
}

export function createMetricRow(label = ""): MetricRow {
  return { id: genId(), label, group: "", value: "", unit: "", note: "" };
}

// ─── The batch ────────────────────────────────────────────

export interface TlnpMeta {
  batchCode: string;
  experimentDate: string;
  operator: string;
  objective: string;
}

export interface TlnpExperimentData {
  schemaVersion: number;
  kind: "tlnp_experiment";
  meta: TlnpMeta;
  prep: TlnpPrepModule;
  conjugation: TlnpConjugationModule;
  purification: TlnpPurificationModule;
  assay: TlnpAssayModule;
}

export function emptyTlnpExperiment(): TlnpExperimentData {
  return {
    schemaVersion: TLNP_SCHEMA_VERSION,
    kind: "tlnp_experiment",
    meta: {
      batchCode: "",
      experimentDate: todayISO(),
      operator: "",
      objective: "",
    },
    prep: {
      design: {
        params: createParamEntries(PREP_PARAM_PRESETS),
        solvent: emptySolvent(),
        note: "",
      },
      samples: [],
      results: { discussion: "" },
    },
    conjugation: {
      conditions: [],
      nodes: [],
      edges: [],
      products: [],
      results: { observations: [], discussion: "" },
    },
    purification: {
      design: {
        method: "",
        cl4b: {
          columnLength: "",
          columnDiameter: "",
          flowRate: "",
          buffer: "",
          note: "",
        },
        ultrafiltration: { mwco: "", cycles: "", note: "" },
        dialysis: { mwco: "", duration: "", buffer: "", note: "" },
        params: createParamEntries(PURIFICATION_PARAM_PRESETS),
        note: "",
      },
      chromatograms: [],
      results: {
        ee: emptyEeResult(),
        dls: emptyDlsResult(),
        tem: { imageUrl: "", magnification: "", note: "" },
        discussion: "",
      },
    },
    assay: {
      active: "invitro",
      invitro: {
        design: {
          cellLine: "",
          passage: "",
          plate: "",
          seedingDensity: "",
          dose: "",
          timepoints: "",
          params: createParamEntries(INVITRO_PARAM_PRESETS),
          note: "",
        },
        results: { rows: [], discussion: "" },
      },
      invivo: {
        design: {
          species: "",
          strain: "",
          route: "",
          dose: "",
          groups: "",
          timepoints: "",
          params: createParamEntries(INVIVO_PARAM_PRESETS),
          note: "",
        },
        results: { rows: [], discussion: "" },
      },
    },
  };
}

// ─── Parsing ──────────────────────────────────────────────
//
// Field-by-field, defensive, never throwing. Every helper takes `unknown` and
// an already-valid default.

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const num = (v: unknown): number | null => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (isFinite(n)) return n;
  }
  return null;
};

function pick<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

function parseEe(raw: unknown): EeResult {
  const o = obj(raw);
  const out = emptyEeResult();
  const m = obj(o.manual);
  out.manual = {
    conc_ng_uL: str(m.conc_ng_uL),
    volume_uL: str(m.volume_uL),
    ee_percent: str(m.ee_percent),
    yield_percent: str(m.yield_percent),
  };
  const l = obj(o.link);
  if (typeof l.itemId === "string" && typeof l.sampleId === "string") {
    const s = obj(l.snapshot);
    out.link = {
      itemId: l.itemId,
      itemName: str(l.itemName),
      sampleId: l.sampleId,
      sampleName: str(l.sampleName),
      capturedAt: str(l.capturedAt),
      snapshot: {
        total_ng_uL: num(s.total_ng_uL),
        lnpRna_ng_uL: num(s.lnpRna_ng_uL),
        ee_percent: num(s.ee_percent),
        yield_percent: num(s.yield_percent),
        lnpVolume_uL: num(s.lnpVolume_uL),
      },
    };
  }
  return out;
}

function parseDls(raw: unknown): DlsResult {
  const o = obj(raw);
  return {
    size_nm: str(o.size_nm),
    pdi: str(o.pdi),
    zeta_mV: str(o.zeta_mV),
    instrument: str(o.instrument),
    note: str(o.note),
  };
}

function parseSample(raw: unknown, index: number): TlnpPrepSample {
  const o = obj(raw);
  const base = createTlnpSample(null, `样品 ${index + 1}`);
  const lipids = arr(o.lipidEntries);
  const prep = obj(o.prep);
  return {
    id: str(o.id) || base.id,
    name: str(o.name, base.name),
    // LipidEntry is all-strings by construction; anything else is unusable, so
    // fall back to a fresh default set rather than half-parsing it.
    lipidEntries:
      lipids.length > 0
        ? (lipids.map((e) => ({ ...obj(e) })) as unknown as LipidEntry[])
        : base.lipidEntries,
    prep: {
      masterConc: str(prep.masterConc, base.prep.masterConc),
      frrAqueous: str(prep.frrAqueous, base.prep.frrAqueous),
      frrOrganic: str(prep.frrOrganic, base.prep.frrOrganic),
      npRatio: str(prep.npRatio, base.prep.npRatio),
      rnaMass: str(prep.rnaMass, base.prep.rnaMass),
      rnaConc: str(prep.rnaConc, base.prep.rnaConc),
      naType: pick(prep.naType, ["mRNA", "siRNA", "pDNA"] as const, "mRNA"),
      aminesPerMolecule: str(
        prep.aminesPerMolecule,
        base.prep.aminesPerMolecule
      ),
    },
    method: parseBenchMethod(o.method),
    notes: str(o.notes),
    createdAt: str(o.createdAt, base.createdAt),
    ee: parseEe(o.ee),
    dls: parseDls(o.dls),
    resultNote: str(o.resultNote),
  };
}

function parseCondition(raw: unknown, index: number): ReactionCondition {
  const o = obj(raw);
  const base = createReactionCondition(index);
  return {
    id: str(o.id) || base.id,
    name: str(o.name, base.name),
    linker: str(o.linker),
    lnpConc: str(o.lnpConc),
    lnpAmount: str(o.lnpAmount),
    lnpAmountUnit: pick(o.lnpAmountUnit, ["uL", "ug"] as const, "uL"),
    proteinName: str(o.proteinName),
    proteinMW: str(o.proteinMW),
    proteinConc: str(o.proteinConc),
    proteinConcUnit: pick(
      o.proteinConcUnit,
      ["mg_per_mL", "uM"] as const,
      "mg_per_mL"
    ),
    targetMolarRatio: str(o.targetMolarRatio),
    rnaLength_nt: str(o.rnaLength_nt),
    temperature: str(o.temperature, base.temperature),
    duration: str(o.duration, base.duration),
    shaking: str(o.shaking),
    note: str(o.note),
  };
}

function parseFlowNode(raw: unknown): TlnpFlowNode | null {
  const o = obj(raw);
  const id = str(o.id);
  const refId = str(o.refId);
  if (!id || !refId) return null;
  const p = obj(o.position);
  return {
    id,
    kind: pick(o.kind, ["sample", "condition", "product"] as const, "sample"),
    refId,
    label: str(o.label),
    position: { x: num(p.x) ?? 0, y: num(p.y) ?? 0 },
  };
}

function parseChromatogram(raw: unknown, index: number): Chromatogram {
  const o = obj(raw);
  const channels: ChromatogramChannel[] = arr(o.channels).map((c, i) => {
    const co = obj(c);
    const slot = num(co.slot);
    return {
      id: str(co.id) || genId(),
      label: str(co.label, `通道 ${i + 1}`),
      slot: (slot && slot >= 1 && slot <= 5 ? slot : ((i % 5) + 1)) as 1 | 2 | 3 | 4 | 5,
    };
  });
  const points: ChromatogramPoint[] = arr(o.points)
    .map((p) => {
      const po = obj(p);
      const x = num(po.x);
      if (x === null) return null;
      return { x, y: arr(po.y).map((v) => num(v)) };
    })
    .filter((p): p is ChromatogramPoint => p !== null);
  return {
    id: str(o.id) || genId(),
    name: str(o.name, `层析图 ${index + 1}`),
    xLabel: str(o.xLabel, "体积 (mL)"),
    channels,
    points,
    fractions: arr(o.fractions)
      .map((f) => {
        const fo = obj(f);
        const from = num(fo.from);
        const to = num(fo.to);
        if (from === null || to === null) return null;
        return { id: str(fo.id) || genId(), from, to, label: str(fo.label) };
      })
      .filter((f): f is ChromatogramFraction => f !== null),
    source: pick(o.source, ["paste", "csv"] as const, "paste"),
    sourceName: str(o.sourceName),
    note: str(o.note),
  };
}

function parseMetricRow(raw: unknown): MetricRow {
  const o = obj(raw);
  return {
    id: str(o.id) || genId(),
    label: str(o.label),
    group: str(o.group),
    value: str(o.value),
    unit: str(o.unit),
    note: str(o.note),
  };
}

export function parseTlnpExperiment(
  raw: Record<string, unknown> | null | undefined
): TlnpExperimentData {
  const d = emptyTlnpExperiment();
  const o = obj(raw);
  if (Object.keys(o).length === 0) return d;

  const meta = obj(o.meta);
  d.meta = {
    batchCode: str(meta.batchCode),
    experimentDate: str(meta.experimentDate, d.meta.experimentDate),
    operator: str(meta.operator),
    objective: str(meta.objective),
  };

  // ── Module 1 ──
  const prep = obj(o.prep);
  const prepDesign = obj(prep.design);
  const solvent = obj(prepDesign.solvent);
  d.prep = {
    design: {
      params: mergeParamEntries(PREP_PARAM_PRESETS, prepDesign.params),
      solvent: {
        method: parseBenchMethod(solvent.method),
        buffer: mergeParamEntries([BUFFER_PRESET], [solvent.buffer])[0],
      },
      note: str(prepDesign.note),
    },
    samples: arr(prep.samples).map(parseSample),
    results: { discussion: str(obj(prep.results).discussion) },
  };

  // ── Module 2 ──
  const conj = obj(o.conjugation);
  const conjResults = obj(conj.results);
  d.conjugation = {
    conditions: arr(conj.conditions).map(parseCondition),
    nodes: arr(conj.nodes)
      .map(parseFlowNode)
      .filter((n): n is TlnpFlowNode => n !== null),
    edges: arr(conj.edges)
      .map((e) => {
        const eo = obj(e);
        const source = str(eo.source);
        const target = str(eo.target);
        if (!source || !target) return null;
        return {
          id: str(eo.id) || genId(),
          source,
          target,
          ...(typeof eo.label === "string" ? { label: eo.label } : {}),
        };
      })
      .filter((e): e is TlnpFlowEdge => e !== null),
    products: arr(conj.products)
      .map((p) => {
        const po = obj(p);
        const sampleId = str(po.sampleId);
        const conditionId = str(po.conditionId);
        if (!sampleId || !conditionId) return null;
        return {
          id: str(po.id) || genId(),
          nameOverride: str(po.nameOverride),
          sampleId,
          conditionId,
        };
      })
      .filter((p): p is ConjugateProduct => p !== null),
    results: {
      observations: arr(conjResults.observations).map((r) => {
        const ro = obj(r);
        return {
          id: str(ro.id) || genId(),
          productId: str(ro.productId),
          turbidity: pick(
            ro.turbidity,
            ["clear", "slight", "turbid", ""] as const,
            ""
          ),
          precipitate: pick(
            ro.precipitate,
            ["none", "slight", "heavy", ""] as const,
            ""
          ),
          note: str(ro.note),
        };
      }),
      discussion: str(conjResults.discussion),
    },
  };

  // ── Module 3 ──
  const pur = obj(o.purification);
  const purDesign = obj(pur.design);
  const cl4b = obj(purDesign.cl4b);
  const uf = obj(purDesign.ultrafiltration);
  const dia = obj(purDesign.dialysis);
  const purResults = obj(pur.results);
  const tem = obj(purResults.tem);
  d.purification = {
    design: {
      method: pick(
        purDesign.method,
        ["cl4b", "ultrafiltration", "dialysis", ""] as const,
        ""
      ),
      cl4b: {
        columnLength: str(cl4b.columnLength),
        columnDiameter: str(cl4b.columnDiameter),
        flowRate: str(cl4b.flowRate),
        buffer: str(cl4b.buffer),
        note: str(cl4b.note),
      },
      ultrafiltration: {
        mwco: str(uf.mwco),
        cycles: str(uf.cycles),
        note: str(uf.note),
      },
      dialysis: {
        mwco: str(dia.mwco),
        duration: str(dia.duration),
        buffer: str(dia.buffer),
        note: str(dia.note),
      },
      params: mergeParamEntries(PURIFICATION_PARAM_PRESETS, purDesign.params),
      note: str(purDesign.note),
    },
    chromatograms: arr(pur.chromatograms).map(parseChromatogram),
    results: {
      ee: parseEe(purResults.ee),
      dls: parseDls(purResults.dls),
      tem: {
        imageUrl: str(tem.imageUrl),
        magnification: str(tem.magnification),
        note: str(tem.note),
      },
      discussion: str(purResults.discussion),
    },
  };

  // ── Module 4 ──
  const assay = obj(o.assay);
  const vitro = obj(assay.invitro);
  const vitroDesign = obj(vitro.design);
  const vitroResults = obj(vitro.results);
  const vivo = obj(assay.invivo);
  const vivoDesign = obj(vivo.design);
  const vivoResults = obj(vivo.results);
  d.assay = {
    active: pick(assay.active, ["invitro", "invivo"] as const, "invitro"),
    invitro: {
      design: {
        cellLine: str(vitroDesign.cellLine),
        passage: str(vitroDesign.passage),
        plate: str(vitroDesign.plate),
        seedingDensity: str(vitroDesign.seedingDensity),
        dose: str(vitroDesign.dose),
        timepoints: str(vitroDesign.timepoints),
        params: mergeParamEntries(INVITRO_PARAM_PRESETS, vitroDesign.params),
        note: str(vitroDesign.note),
      },
      results: {
        rows: arr(vitroResults.rows).map(parseMetricRow),
        discussion: str(vitroResults.discussion),
      },
    },
    invivo: {
      design: {
        species: str(vivoDesign.species),
        strain: str(vivoDesign.strain),
        route: str(vivoDesign.route),
        dose: str(vivoDesign.dose),
        groups: str(vivoDesign.groups),
        timepoints: str(vivoDesign.timepoints),
        params: mergeParamEntries(INVIVO_PARAM_PRESETS, vivoDesign.params),
        note: str(vivoDesign.note),
      },
      results: {
        rows: arr(vivoResults.rows).map(parseMetricRow),
        discussion: str(vivoResults.discussion),
      },
    },
  };

  return d;
}

export function serializeTlnpExperiment(
  d: TlnpExperimentData
): Record<string, unknown> {
  return {
    ...d,
    schemaVersion: TLNP_SCHEMA_VERSION,
    kind: "tlnp_experiment",
  } as unknown as Record<string, unknown>;
}

// ─── Summaries ────────────────────────────────────────────

function mean(values: (number | null)[]): number | null {
  const ok = values.filter((v): v is number => v !== null && isFinite(v));
  if (ok.length === 0) return null;
  return ok.reduce((s, v) => s + v, 0) / ok.length;
}

export function moduleFilled(
  d: TlnpExperimentData,
  module: 1 | 2 | 3 | 4
): boolean {
  switch (module) {
    case 1:
      return (
        d.prep.samples.length > 0 ||
        paramsFilled(d.prep.design.params) ||
        d.prep.design.note.trim() !== "" ||
        d.prep.results.discussion.trim() !== ""
      );
    case 2:
      return (
        d.conjugation.conditions.length > 0 ||
        d.conjugation.edges.length > 0 ||
        d.conjugation.results.observations.length > 0 ||
        d.conjugation.results.discussion.trim() !== ""
      );
    case 3:
      return (
        d.purification.design.method !== "" ||
        d.purification.chromatograms.length > 0 ||
        d.purification.results.discussion.trim() !== "" ||
        d.purification.results.tem.imageUrl.trim() !== ""
      );
    case 4: {
      const a = d.assay;
      return (
        a.invitro.results.rows.length > 0 ||
        a.invivo.results.rows.length > 0 ||
        a.invitro.design.cellLine.trim() !== "" ||
        a.invivo.design.species.trim() !== "" ||
        a.invitro.results.discussion.trim() !== "" ||
        a.invivo.results.discussion.trim() !== ""
      );
    }
  }
}

export interface TlnpBatchSummary {
  sampleCount: number;
  conditionCount: number;
  productCount: number;
  meanSize_nm: number | null;
  meanPdi: number | null;
  meanEe_percent: number | null;
  meanYield_percent: number | null;
  purificationLabel: string;
  cationicLipid: string;
  linker: string;
  cargo: string;
  mixing: string;
  solventLabel: string;
  filledModules: boolean[];
}

export function summarizeBatch(d: TlnpExperimentData): TlnpBatchSummary {
  const samples = d.prep.samples;
  const ees = samples.map((s) => resolveEe(s.ee));
  return {
    sampleCount: samples.length,
    conditionCount: d.conjugation.conditions.length,
    productCount: d.conjugation.products.length,
    meanSize_nm: mean(samples.map((s) => numOrNull(s.dls.size_nm))),
    meanPdi: mean(samples.map((s) => numOrNull(s.dls.pdi))),
    meanEe_percent: mean(ees.map((e) => e.ee)),
    meanYield_percent: mean(ees.map((e) => e.yield_)),
    purificationLabel:
      d.purification.design.method === ""
        ? ""
        : PURIFICATION_METHOD_LABELS[d.purification.design.method],
    cationicLipid: paramValue(d.prep.design.params, "cationicLipid"),
    linker: paramValue(d.prep.design.params, "linker"),
    cargo: paramValue(d.prep.design.params, "cargo"),
    mixing: paramValue(d.prep.design.params, "mixing"),
    solventLabel: describeMethod(d.prep.design.solvent.method),
    filledModules: [
      moduleFilled(d, 1),
      moduleFilled(d, 2),
      moduleFilled(d, 3),
      moduleFilled(d, 4),
    ],
  };
}
