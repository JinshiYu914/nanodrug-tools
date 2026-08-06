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
 * - Module 2 is a matrix, not a graph. One `ReactionSystem` is one column: the
 *   LNP going in, the protein, the ratio and the reaction parameters, which
 *   together are one tLNP out. Schema v1 stored a sample × condition graph
 *   instead; `parseTlnpExperiment` folds those legacy products into systems.
 *
 * `parseTlnpExperiment` never throws: this is a lab notebook, and a batch that
 * refuses to open because one field went weird is worse than a batch that opens
 * with that field blank.
 */

import {
  createCustomEntry,
  createDefaultEntries,
  getAminesPerMolecule,
  isKnownLipid,
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
} from "./tlnp-params";

/** v2 replaced module 2's sample × condition graph with the reaction matrix. */
export const TLNP_SCHEMA_VERSION = 2;

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

/**
 * Whether a TEM image exists for this sample.
 *
 * Deliberately a flag, not the image: the characterization matrix answers "did
 * we shoot it?" at a glance, and the picture itself lives wherever the
 * microscope wrote it until there's a storage bucket to upload into.
 */
export type TemFlag = "yes" | "no" | "";

export const TEM_LABELS: Record<Exclude<TemFlag, "">, string> = {
  yes: "有",
  no: "无",
};

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
  tem: TemFlag;
  resultNote: string;
}

export interface TlnpPrepModule {
  design: {
    /** When this module was actually carried out — modules run on different
     *  days, so each records its own rather than inheriting the batch date. */
    date: string;
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
 * Nominal average MW of DSPE-PEG(2000)-maleimide. PEG lipids are polydisperse,
 * so this is a catalogue figure to start from, not a constant — check the
 * vendor CoA and edit it in the sample editor.
 */
const LINKER_DEFAULT_MW = "2941.6";

/**
 * The five-component tLNP formulation.
 *
 * A plain LNP is four lipids; a *targeted* one carries a fifth — the
 * functionalised PEG lipid the protein is conjugated to. It is a real
 * component with its own molar ratio, so it belongs in the formulation rather
 * than being implied by the 反应 linker parameter.
 *
 * The 0.5% comes out of the plain PEG lipid's share (1.5 → 1.0 + 0.5) so the
 * default set still sums to 100.
 */
export function createTlnpLipidEntries(linkerName?: string): LipidEntry[] {
  const base = createDefaultEntries();
  const peg = base.find((e) => e.typeKey === "peg");
  if (peg) peg.molarRatio = "1";

  const linker = createCustomEntry(1);
  linker.typeKey = "linker";
  linker.label = "Linker (Targeting)";
  linker.customLipidName = linkerName?.trim() || "DSPE-PEG2k-mal";
  linker.molarWeight = LINKER_DEFAULT_MW;
  linker.molarRatio = "0.5";
  linker.stockConc = "10";

  return [...base, linker];
}

/**
 * A new sample clones the previous one when there is one — across a screen of
 * formulations the lipid identities, MWs, stock concentrations and prep params
 * are constant and only the molar ratios move, so cloning is what the user
 * would otherwise do by hand eight times.
 */
export function createTlnpSample(
  seed?: TlnpPrepSample | null,
  name?: string,
  linkerName?: string
): TlnpPrepSample {
  const lipidEntries: LipidEntry[] = seed
    ? seed.lipidEntries.map((e) => ({ ...e }))
    : createTlnpLipidEntries(linkerName);
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
    tem: "",
    resultNote: "",
  };
}

/** The linker lipid's molar ratio (mol %), or "" when the sample has none. */
export function sampleLinkerPercent(s: BenchFormulation): string {
  return s.lipidEntries.find((e) => e.typeKey === "linker")?.molarRatio ?? "";
}

/** The ionizable lipid's molar ratio (mol %) — the denominator that turns
 *  N/P into total lipid, and from there into linker. */
export function sampleIonizablePercent(s: BenchFormulation): string {
  return s.lipidEntries.find((e) => e.typeKey === "ionizable")?.molarRatio ?? "";
}

// ─── Module 2: 偶联反应 ───────────────────────────────────

export type ProteinConcUnit = "mg_per_mL" | "uM";

/**
 * A protein as used in this batch.
 *
 * Copied into the batch rather than referenced by id: the library row is a
 * convenience for not retyping a molecular weight, but a notebook has to still
 * say what was actually added after the library entry is edited or deleted.
 * `libraryId` is a breadcrumb, never a dependency.
 */
export interface ProteinEntry {
  id: string;
  name: string;
  /** Da */
  mw: string;
  conc: string;
  concUnit: ProteinConcUnit;
  note: string;
  libraryId: string;
}

export function createProteinEntry(index = 0): ProteinEntry {
  return {
    id: genId(),
    name: index === 0 ? "" : `蛋白 ${index + 1}`,
    mw: "",
    conc: "",
    concUnit: "mg_per_mL",
    note: "",
    libraryId: "",
  };
}

/**
 * What the linker moles are computed from.
 *
 * Snapshotted onto the system rather than read live off the sample, because a
 * system can also describe an LNP that was never in this batch's 制备 module,
 * and because editing a sample months later must not silently restate what was
 * pipetted at the bench.
 */
export interface LnpBasis {
  npRatio: string;
  /** Ionizable lipid mol % — turns N/P into total lipid. */
  ionizablePercent: string;
  aminesPerMolecule: string;
}

/**
 * One column of the reaction matrix: an LNP, a protein, a ratio and the
 * conditions it reacted under. One system in, one tLNP out.
 */
export interface ReactionSystem {
  id: string;
  name: string;
  /** The prep sample this LNP came from; "" when typed in by hand. */
  sampleId: string;
  /** Denormalized so a deleted sample doesn't erase what was reacted. */
  lnpName: string;
  /** ng/µL on an RNA basis — the same unit RiboGreen reports, deliberately. */
  lnpConc: string;
  lnpVolume: string;
  /** Linker lipid mol %, e.g. DSPE-PEG2k-mal at 0.5. */
  linkerPercent: string;
  basis: LnpBasis;
  proteinId: string;
  /** linker : 蛋白 = 1 : this. Default 1. */
  molarRatio: string;
  temperature: string;
  duration: string;
  shaking: string;
  /** µL — the volume the reaction is made up to, which is what pins buffer. */
  totalVolume: string;
  reactionBuffer: string;
  note: string;
}

export interface ObservationRow {
  id: string;
  systemId: string;
  turbidity: "clear" | "slight" | "turbid" | "";
  precipitate: "none" | "slight" | "heavy" | "";
  note: string;
}

export interface TlnpConjugationModule {
  design: { date: string };
  proteins: ProteinEntry[];
  systems: ReactionSystem[];
  results: { observations: ObservationRow[]; discussion: string };
}

export function emptyLnpBasis(): LnpBasis {
  return { npRatio: "6", ionizablePercent: "50", aminesPerMolecule: "1" };
}

export function createReactionSystem(index: number): ReactionSystem {
  return {
    id: genId(),
    name: `体系 ${index + 1}`,
    sampleId: "",
    lnpName: "",
    lnpConc: "",
    lnpVolume: "",
    linkerPercent: "",
    basis: emptyLnpBasis(),
    proteinId: "",
    molarRatio: "1",
    temperature: "室温",
    duration: "2 h",
    shaking: "",
    totalVolume: "",
    reactionBuffer: "PBS pH 7.4",
    note: "",
  };
}

/**
 * Seed a reaction system from a prepared sample.
 *
 * Concentration and volume come from whatever the sample's RiboGreen result
 * says, so the common path — make LNP, measure it, react it — needs no retyping.
 * Everything stays editable afterwards.
 */
export function systemFromSample(
  sample: TlnpPrepSample,
  index: number
): ReactionSystem {
  const base = createReactionSystem(index);
  const ee = resolveEe(sample.ee);
  const ionizable = sample.lipidEntries.find((e) => e.typeKey === "ionizable");
  const custom = ionizable
    ? ionizable.isCustomLipid || !isKnownLipid("ionizable", ionizable.lipidName)
    : true;
  return {
    ...base,
    name: sample.name || `体系 ${index + 1}`,
    sampleId: sample.id,
    lnpName: sample.name || `样品 ${index + 1}`,
    lnpConc: ee.conc === null ? "" : String(round2(ee.conc)),
    lnpVolume: ee.volume === null ? "" : String(round2(ee.volume)),
    linkerPercent: sampleLinkerPercent(sample),
    basis: {
      npRatio: sample.prep.npRatio,
      ionizablePercent: sampleIonizablePercent(sample) || "50",
      aminesPerMolecule: custom
        ? sample.prep.aminesPerMolecule
        : String(getAminesPerMolecule(ionizable?.lipidName ?? "")),
    },
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function createObservationRow(systemId = ""): ObservationRow {
  return { id: genId(), systemId, turbidity: "", precipitate: "", note: "" };
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
  /** The text that was pasted, kept so the run can be corrected and re-parsed
   *  instead of re-pasted from scratch when one row was wrong. */
  rawText: string;
  note: string;
}

export interface TemResult {
  /** An external URL for now — base64 images do not belong in a JSONB row. */
  imageUrl: string;
  magnification: string;
  note: string;
}

export type PurificationMethod = "cl4b" | "ultrafiltration" | "dialysis" | "";

/** The four column facts worth saving as a reusable preset. */
export interface Cl4bParams {
  columnLength: string;
  columnDiameter: string;
  flowRate: string;
  buffer: string;
}

export interface Cl4bDesign extends Cl4bParams {
  /** CL-4B is often followed by a spin concentration; recording it here keeps
   *  the two halves of one purification in one place. */
  ultrafiltrationConcentrate: boolean;
  note: string;
}

export function emptyCl4bDesign(): Cl4bDesign {
  return {
    columnLength: "",
    columnDiameter: "",
    flowRate: "",
    buffer: "",
    ultrafiltrationConcentrate: false,
    note: "",
  };
}

/**
 * Post-purification characterization for one reaction system.
 *
 * Same shape as a prep sample's results so one matrix component renders both,
 * and so a number means the same thing before and after the column.
 */
export interface SystemCharacterization {
  id: string;
  systemId: string;
  ee: EeResult;
  dls: DlsResult;
  tem: TemFlag;
  note: string;
}

export function createSystemCharacterization(
  systemId: string
): SystemCharacterization {
  return {
    id: genId(),
    systemId,
    ee: emptyEeResult(),
    dls: emptyDlsResult(),
    tem: "",
    note: "",
  };
}

export interface TlnpPurificationModule {
  design: {
    date: string;
    method: PurificationMethod;
    cl4b: Cl4bDesign;
    ultrafiltration: { mwco: string; cycles: string; note: string };
    dialysis: { mwco: string; duration: string; buffer: string; note: string };
    operator: string;
    note: string;
  };
  chromatograms: Chromatogram[];
  results: {
    /** One row per reaction system. */
    systems: SystemCharacterization[];
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
  date: string;
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
  date: string;
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
        date: todayISO(),
        params: createParamEntries(PREP_PARAM_PRESETS),
        solvent: emptySolvent(),
        note: "",
      },
      samples: [],
      results: { discussion: "" },
    },
    conjugation: {
      design: { date: "" },
      proteins: [],
      systems: [],
      results: { observations: [], discussion: "" },
    },
    purification: {
      design: {
        date: "",
        method: "",
        cl4b: emptyCl4bDesign(),
        ultrafiltration: { mwco: "", cycles: "", note: "" },
        dialysis: { mwco: "", duration: "", buffer: "", note: "" },
        operator: "",
        note: "",
      },
      chromatograms: [],
      results: {
        systems: [],
        tem: { imageUrl: "", magnification: "", note: "" },
        discussion: "",
      },
    },
    assay: {
      active: "invitro",
      invitro: {
        design: {
          date: "",
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
          date: "",
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
    tem: pick(o.tem, ["yes", "no", ""] as const, ""),
    resultNote: str(o.resultNote),
  };
}

function parseProtein(raw: unknown, index: number): ProteinEntry {
  const o = obj(raw);
  const base = createProteinEntry(index);
  return {
    id: str(o.id) || base.id,
    name: str(o.name, base.name),
    mw: str(o.mw),
    conc: str(o.conc),
    concUnit: pick(o.concUnit, ["mg_per_mL", "uM"] as const, "mg_per_mL"),
    note: str(o.note),
    libraryId: str(o.libraryId),
  };
}

function parseSystem(raw: unknown, index: number): ReactionSystem {
  const o = obj(raw);
  const base = createReactionSystem(index);
  const b = obj(o.basis);
  return {
    id: str(o.id) || base.id,
    name: str(o.name, base.name),
    sampleId: str(o.sampleId),
    lnpName: str(o.lnpName),
    lnpConc: str(o.lnpConc),
    lnpVolume: str(o.lnpVolume),
    linkerPercent: str(o.linkerPercent),
    basis: {
      npRatio: str(b.npRatio, base.basis.npRatio),
      ionizablePercent: str(b.ionizablePercent, base.basis.ionizablePercent),
      aminesPerMolecule: str(b.aminesPerMolecule, base.basis.aminesPerMolecule),
    },
    proteinId: str(o.proteinId),
    molarRatio: str(o.molarRatio, base.molarRatio),
    temperature: str(o.temperature, base.temperature),
    duration: str(o.duration, base.duration),
    shaking: str(o.shaking),
    totalVolume: str(o.totalVolume),
    reactionBuffer: str(o.reactionBuffer, base.reactionBuffer),
    note: str(o.note),
  };
}

/**
 * Fold a schema-v1 graph into reaction systems.
 *
 * v1 stored reaction conditions and a sample × condition edge list, where each
 * edge was one tLNP. Each of those pairs is exactly one system, so the notebook
 * survives the model change instead of opening blank.
 */
function systemsFromLegacyGraph(
  conj: Record<string, unknown>,
  samples: TlnpPrepSample[]
): { proteins: ProteinEntry[]; systems: ReactionSystem[] } {
  const conditions = arr(conj.conditions).map(obj);
  const products = arr(conj.products).map(obj);
  if (conditions.length === 0) return { proteins: [], systems: [] };

  // One protein per distinct (name, MW, conc) the old conditions carried.
  const proteins: ProteinEntry[] = [];
  const proteinFor = (c: Record<string, unknown>): string => {
    const name = str(c.proteinName);
    const mw = str(c.proteinMW);
    const conc = str(c.proteinConc);
    if (!name && !mw && !conc) return "";
    const hit = proteins.find(
      (p) => p.name === name && p.mw === mw && p.conc === conc
    );
    if (hit) return hit.id;
    const next: ProteinEntry = {
      ...createProteinEntry(proteins.length),
      name: name || `蛋白 ${proteins.length + 1}`,
      mw,
      conc,
      concUnit: pick(c.proteinConcUnit, ["mg_per_mL", "uM"] as const, "mg_per_mL"),
    };
    proteins.push(next);
    return next.id;
  };

  const pairs =
    products.length > 0
      ? products.map((p) => ({
          sampleId: str(p.sampleId),
          conditionId: str(p.conditionId),
          nameOverride: str(p.nameOverride),
        }))
      : // No edges were ever drawn — keep the conditions themselves so their
        // numbers aren't lost, unattached to any sample.
        conditions.map((c) => ({
          sampleId: "",
          conditionId: str(c.id),
          nameOverride: "",
        }));

  const systems = pairs.map((pair, i) => {
    const c = conditions.find((x) => str(x.id) === pair.conditionId) ?? {};
    const sample = samples.find((s) => s.id === pair.sampleId) ?? null;
    const seeded = sample
      ? systemFromSample(sample, i)
      : createReactionSystem(i);
    const conditionName = str(c.name);
    return {
      ...seeded,
      name:
        pair.nameOverride ||
        [sample?.name, conditionName].filter(Boolean).join("-") ||
        seeded.name,
      lnpConc: str(c.lnpConc) || seeded.lnpConc,
      lnpVolume:
        str(c.lnpAmountUnit) === "ug" ? seeded.lnpVolume : str(c.lnpAmount) || seeded.lnpVolume,
      linkerPercent: seeded.linkerPercent,
      proteinId: proteinFor(c),
      // The v1 ratio was 蛋白:RNA and has no meaning under linker:蛋白 — a
      // wrong number here would be pipetted, so it starts at the 1:1 default.
      molarRatio: seeded.molarRatio,
      temperature: str(c.temperature, seeded.temperature),
      duration: str(c.duration, seeded.duration),
      shaking: str(c.shaking),
      note: str(c.note),
    };
  });

  return { proteins, systems };
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
    rawText: str(o.rawText),
    note: str(o.note),
  };
}

function parseSystemCharacterization(raw: unknown): SystemCharacterization {
  const o = obj(raw);
  return {
    id: str(o.id) || genId(),
    systemId: str(o.systemId),
    ee: parseEe(o.ee),
    dls: parseDls(o.dls),
    tem: pick(o.tem, ["yes", "no", ""] as const, ""),
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
      date: str(prepDesign.date, d.prep.design.date),
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
  const legacy =
    !Array.isArray(conj.systems) && Array.isArray(conj.conditions)
      ? systemsFromLegacyGraph(conj, d.prep.samples)
      : null;
  d.conjugation = {
    design: { date: str(obj(conj.design).date) },
    proteins: legacy
      ? legacy.proteins
      : arr(conj.proteins).map(parseProtein),
    systems: legacy ? legacy.systems : arr(conj.systems).map(parseSystem),
    results: {
      observations: arr(conjResults.observations).map((r) => {
        const ro = obj(r);
        return {
          id: str(ro.id) || genId(),
          // v1 keyed observations by product id; those ids became system ids
          // only when the graph is re-derived, so an unmatched one just shows
          // as unassigned rather than being dropped.
          systemId: str(ro.systemId) || str(ro.productId),
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
      date: str(purDesign.date),
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
        ultrafiltrationConcentrate: cl4b.ultrafiltrationConcentrate === true,
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
      // v1 kept the operator in a ParamBench alongside a buffer field the
      // method sections already ask for; only the operator survives.
      operator:
        str(purDesign.operator) ||
        str(
          arr(purDesign.params)
            .map(obj)
            .find((p) => p.id === "purifyOperator")?.value
        ),
      note: str(purDesign.note),
    },
    chromatograms: arr(pur.chromatograms).map(parseChromatogram),
    results: {
      systems: arr(purResults.systems).map(parseSystemCharacterization),
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
        date: str(vitroDesign.date),
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
        date: str(vivoDesign.date),
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
        d.conjugation.systems.length > 0 ||
        d.conjugation.proteins.length > 0 ||
        d.conjugation.results.observations.length > 0 ||
        d.conjugation.results.discussion.trim() !== ""
      );
    case 3:
      return (
        d.purification.design.method !== "" ||
        d.purification.chromatograms.length > 0 ||
        d.purification.results.systems.length > 0 ||
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
  proteinCount: number;
  systemCount: number;
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
    proteinCount: d.conjugation.proteins.length,
    systemCount: d.conjugation.systems.length,
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
