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
  createCustomParam,
  createParamEntries,
  mergeParamEntries,
  paramsFilled,
  paramValue,
  seedParamValue,
  type ParamEntry,
  INVITRO_PARAM_PRESETS,
  INVIVO_PARAM_PRESETS,
  PREP_PARAM_PRESETS,
} from "./tlnp-params";

/**
 * v2 replaced module 2's sample × condition graph with the reaction matrix.
 * v3 dosed the reaction off 投料 RNA mass instead of an LNP volume, and turned
 * module 4 into a parameter bench plus two purpose-built result tables. v4
 * records antibody sourcing and expression provenance.
 */
export const TLNP_SCHEMA_VERSION = 4;

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
 * An antibody (蛋白/抗体) as used in this batch.
 *
 * The type is still called `ProteinEntry` because the DB discriminator and the
 * library table are `protein`, and renaming those would need a migration for a
 * change of wording. Every user-facing string says 抗体.
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
  /** 自表达 / 外包表达 / 商品化 / a user-entered value. */
  source: string;
  /** UI label: 表达载体; 原核 / 293F / a user-entered value. */
  expressionSystem: string;
  /** ISO date when available. */
  expressionDate: string;
  note: string;
  libraryId: string;
}

export function createProteinEntry(index = 0): ProteinEntry {
  return {
    id: genId(),
    name: index === 0 ? "" : `抗体 ${index + 1}`,
    mw: "",
    conc: "",
    concUnit: "mg_per_mL",
    source: "",
    expressionSystem: "",
    expressionDate: "",
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
  /**
   * µg of RNA put into the reaction — the quantity actually decided at the
   * bench. The LNP volume to pipette follows from it and the concentration, so
   * it is computed rather than typed; typing both would let them disagree.
   */
  rnaMass: string;
  /** Linker lipid mol %, e.g. DSPE-PEG2k-mal at 0.5. */
  linkerPercent: string;
  basis: LnpBasis;
  proteinId: string;
  /** linker : 抗体 = 1 : this. Default 1. */
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
    rnaMass: "",
    linkerPercent: "",
    basis: emptyLnpBasis(),
    proteinId: "",
    molarRatio: "1",
    // Reaction conditions start blank on purpose: a temperature nobody chose is
    // a temperature that gets exported as if it had been.
    temperature: "",
    duration: "",
    shaking: "",
    totalVolume: "",
    reactionBuffer: "PBS pH 7.4",
    note: "",
  };
}

/**
 * Everything a reaction system copies out of the prep sample it came from.
 *
 * Split out because it is needed twice: once when a column is created, and
 * again when the user asks for it to be brought up to date after editing the
 * formulation. The copy is deliberate — see `LnpBasis` — so re-syncing is an
 * explicit action, and `sampleDrift` is what tells the user it is worth taking.
 */
export interface SampleSnapshot {
  lnpName: string;
  lnpConc: string;
  rnaMass: string;
  linkerPercent: string;
  basis: LnpBasis;
}

export function sampleSnapshot(
  sample: TlnpPrepSample,
  index = 0
): SampleSnapshot {
  const ee = resolveEe(sample.ee);
  const ionizable = sample.lipidEntries.find((e) => e.typeKey === "ionizable");
  const custom = ionizable
    ? ionizable.isCustomLipid || !isKnownLipid("ionizable", ionizable.lipidName)
    : true;
  // The whole measured prep is the default charge — conc × volume, in µg.
  const rnaMass =
    ee.conc === null || ee.volume === null
      ? ""
      : String(round2((ee.conc * ee.volume) / 1000));
  return {
    lnpName: sample.name || `样品 ${index + 1}`,
    lnpConc: ee.conc === null ? "" : String(round2(ee.conc)),
    rnaMass,
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

/**
 * Which snapshot fields no longer match the sample they were taken from.
 *
 * 投料 RNA is excluded: the user routinely reacts less than the whole prep, so
 * a difference there is a decision, not staleness.
 */
export function sampleDrift(
  system: ReactionSystem,
  sample: TlnpPrepSample
): string[] {
  const snap = sampleSnapshot(sample);
  const out: string[] = [];
  if (snap.lnpName !== system.lnpName) out.push("样品名");
  if (snap.lnpConc !== system.lnpConc) out.push("浓度");
  if (snap.linkerPercent !== system.linkerPercent) out.push("linker 比例");
  if (snap.basis.npRatio !== system.basis.npRatio) out.push("N/P");
  if (snap.basis.ionizablePercent !== system.basis.ionizablePercent) {
    out.push("阳离子 mol%");
  }
  if (snap.basis.aminesPerMolecule !== system.basis.aminesPerMolecule) {
    out.push("可电离胺数");
  }
  return out;
}

/**
 * Seed a reaction system from a prepared sample.
 *
 * Concentration and charge come from whatever the sample's RiboGreen result
 * says, so the common path — make LNP, measure it, react it — needs no retyping.
 * Everything stays editable afterwards.
 */
export function systemFromSample(
  sample: TlnpPrepSample,
  index: number
): ReactionSystem {
  return {
    ...createReactionSystem(index),
    ...sampleSnapshot(sample, index),
    name: sample.name || `体系 ${index + 1}`,
    sampleId: sample.id,
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
    /** One row per reaction system. Whether a TEM image exists is the `tem`
     *  flag on each row; there is no batch-level image field, because the
     *  question the notebook has to answer is "did we shoot this one?". */
    systems: SystemCharacterization[];
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

/**
 * Both arms' designs are nothing but a parameter bench.
 *
 * They used to be a fixed grid of Inputs *and* a bench, which asked for the
 * cell line twice and let the two answers disagree. The bench won: it is the
 * half that can grow a new cell line or a new readout without a deploy, and
 * every value in it is still one click away from being a chip next time.
 */
export interface AssayDesign {
  date: string;
  params: ParamEntry[];
  note: string;
}

/** What the plate was read on. */
export type InVitroReadout = "luciferase" | "fluorescence";
/** Flow reports either a brightness or a positive fraction — never both. */
export type FluorescenceMetric = "mfi" | "percent";

export const INVITRO_READOUT_LABELS: Record<InVitroReadout, string> = {
  luciferase: "Luciferase",
  fluorescence: "荧光蛋白",
};

export const FLUORESCENCE_METRIC_LABELS: Record<FluorescenceMetric, string> = {
  mfi: "MFI",
  percent: "阳性率 (%)",
};

export function invitroUnitLabel(r: {
  readout: InVitroReadout;
  fluorMetric: FluorescenceMetric;
}): string {
  if (r.readout === "luciferase") return "RLU";
  return FLUORESCENCE_METRIC_LABELS[r.fluorMetric];
}

export interface InVitroColumn {
  id: string;
  name: string;
}

/** One technical/biological repeat. `values` is index-aligned with `columns`. */
export interface InVitroReplicate {
  id: string;
  values: string[];
}

export interface InVitroResults {
  readout: InVitroReadout;
  fluorMetric: FluorescenceMetric;
  columns: InVitroColumn[];
  replicates: InVitroReplicate[];
  discussion: string;
}

/**
 * One organ ROI off the imager.
 *
 * Kept as strings, like every other typed field in the model, so a half-typed
 * cell is representable; the charts parse on read.
 */
export interface RoiRow {
  id: string;
  sample: string;
  organ: string;
  totalRoi: string;
  avgRoi: string;
}

/**
 * One imaging session, named and managed like a chromatogram.
 *
 * A batch is imaged more than once — 6 h and 24 h, or in vivo then ex vivo —
 * and those are different figures, not more rows of one. Each run keeps the
 * text that was pasted so it can be corrected and re-parsed rather than
 * re-pasted from scratch.
 */
export interface RoiRun {
  id: string;
  name: string;
  rawText: string;
  rows: RoiRow[];
  note: string;
}

export interface InVivoResults {
  runs: RoiRun[];
  discussion: string;
}

export function createRoiRun(
  name: string,
  rawText: string,
  rows: RoiRow[]
): RoiRun {
  return { id: genId(), name, rawText, rows, note: "" };
}

export interface TlnpAssayModule {
  /** Which arm the user is working in — both are always persisted. */
  active: "invitro" | "invivo";
  invitro: { design: AssayDesign; results: InVitroResults };
  invivo: { design: AssayDesign; results: InVivoResults };
}

export function createInVitroColumn(name = ""): InVitroColumn {
  return { id: genId(), name };
}

export function createInVitroReplicate(width: number): InVitroReplicate {
  return { id: genId(), values: Array.from({ length: width }, () => "") };
}

export function emptyInVitroResults(): InVitroResults {
  return {
    readout: "luciferase",
    fluorMetric: "mfi",
    columns: [],
    replicates: [],
    discussion: "",
  };
}

export function emptyInVivoResults(): InVivoResults {
  return { runs: [], discussion: "" };
}

// ─── 体外 clipboard ───────────────────────────────────────

/**
 * Does this grid start with a row of sample names?
 *
 * A header is a first row with no numbers in it. Value rows are all numbers by
 * definition, so this needs no user input and can't misfire on a plate read.
 */
function gridHasHeader(grid: string[][]): boolean {
  const first = grid[0];
  if (!first || first.length === 0) return false;
  return first.every((c) => c.trim() === "" || numOrNull(c) === null);
}

/**
 * Build a whole result table out of one paste.
 *
 * Used by 「粘贴数据」, where the user copies the block straight out of the
 * plate reader's sheet — sample names across the top, one row per well.
 */
export function inVitroFromGrid(
  grid: string[][]
): Pick<InVitroResults, "columns" | "replicates"> {
  const rows = grid.filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return { columns: [], replicates: [] };

  const header = gridHasHeader(rows) ? rows[0] : null;
  const body = header ? rows.slice(1) : rows;
  const width = Math.max(header?.length ?? 0, ...body.map((r) => r.length));

  return {
    columns: Array.from({ length: width }, (_, i) =>
      createInVitroColumn(header?.[i]?.trim() || "")
    ),
    replicates: body.map((r) => ({
      id: genId(),
      values: Array.from({ length: width }, (_, i) => r[i]?.trim() ?? ""),
    })),
  };
}

/**
 * Drop a pasted grid into an existing table at one cell, growing it to fit.
 *
 * Growing rather than clipping is the point: pasting three wells into a table
 * that has one row should give three rows, not silently discard two thirds of
 * the data.
 */
export function applyGridToInVitro(
  r: InVitroResults,
  grid: string[][],
  atRow: number,
  atCol: number
): InVitroResults {
  const rows = grid.filter((g) => g.some((c) => c.trim() !== ""));
  if (rows.length === 0) return r;

  const width = Math.max(atCol + Math.max(...rows.map((g) => g.length)), r.columns.length);
  const height = Math.max(atRow + rows.length, r.replicates.length);

  const columns = Array.from(
    { length: width },
    (_, i) => r.columns[i] ?? createInVitroColumn("")
  );
  const replicates = Array.from({ length: height }, (_, i) => {
    const existing = r.replicates[i];
    const base = Array.from(
      { length: width },
      (_, k) => existing?.values[k] ?? ""
    );
    const from = rows[i - atRow];
    if (from) {
      from.forEach((cell, k) => {
        if (atCol + k < width) base[atCol + k] = cell.trim();
      });
    }
    return { id: existing?.id ?? genId(), values: base };
  });

  return { ...r, columns, replicates };
}

/** The table as Excel expects it back: names across the top, wells below. */
export function inVitroToTsv(r: InVitroResults): string {
  const head = r.columns.map((c, i) => c.name || `样本 ${i + 1}`);
  const body = r.replicates.map((rep) =>
    r.columns.map((_, i) => rep.values[i] ?? "")
  );
  return [head, ...body].map((row) => row.join("\t")).join("\n");
}

export interface InVitroColumnStat {
  id: string;
  name: string;
  values: number[];
  mean: number | null;
  /** Sample SD (n−1). Null below two replicates, where it has no meaning. */
  sd: number | null;
}

/** Per-sample mean ± SD down the replicate rows — what the bar chart draws. */
export function summarizeInVitro(r: InVitroResults): InVitroColumnStat[] {
  return r.columns.map((c, i) => {
    const values = r.replicates
      .map((rep) => numOrNull(rep.values[i] ?? ""))
      .filter((v): v is number => v !== null);
    const n = values.length;
    const avg = n > 0 ? values.reduce((s, v) => s + v, 0) / n : null;
    const sd =
      n > 1 && avg !== null
        ? Math.sqrt(
            values.reduce((s, v) => s + (v - avg) ** 2, 0) / (n - 1)
          )
        : null;
    return { id: c.id, name: c.name || `样本 ${i + 1}`, values, mean: avg, sd };
  });
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
      results: { systems: [], discussion: "" },
    },
    assay: {
      active: "invitro",
      invitro: {
        design: {
          date: "",
          params: createParamEntries(INVITRO_PARAM_PRESETS),
          note: "",
        },
        results: emptyInVitroResults(),
      },
      invivo: {
        design: {
          date: "",
          params: createParamEntries(INVIVO_PARAM_PRESETS),
          note: "",
        },
        results: emptyInVivoResults(),
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
    source: str(o.source),
    expressionSystem: str(o.expressionSystem),
    expressionDate: str(o.expressionDate),
    note: str(o.note),
    libraryId: str(o.libraryId),
  };
}

/**
 * v2 stored an LNP volume; v3 stores the RNA mass that volume delivered.
 *
 * Converting rather than dropping keeps every already-recorded reaction
 * dosing to the same numbers it did before the change.
 */
function rnaMassFromLegacy(o: Record<string, unknown>): string {
  const conc = num(o.lnpConc);
  const volume = num(o.lnpVolume);
  if (conc === null || volume === null || !(conc > 0) || !(volume > 0)) return "";
  return String(round2((conc * volume) / 1000));
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
    rnaMass: str(o.rnaMass) || rnaMassFromLegacy(o),
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
      name: name || `抗体 ${proteins.length + 1}`,
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
    const lnpConc = str(c.lnpConc) || seeded.lnpConc;
    // v1 already offered µg as an alternative to µL, and µg is now the only
    // unit — so half of these carry across with no conversion at all.
    const amount = str(c.lnpAmount);
    const rnaMass = !amount
      ? seeded.rnaMass
      : str(c.lnpAmountUnit) === "ug"
        ? amount
        : rnaMassFromLegacy({ lnpConc, lnpVolume: amount }) || seeded.rnaMass;
    return {
      ...seeded,
      name:
        pair.nameOverride ||
        [sample?.name, conditionName].filter(Boolean).join("-") ||
        seeded.name,
      lnpConc,
      rnaMass,
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

/** Append whatever a v2 batch recorded in its TEM box to the discussion. */
function withLegacyTem(discussion: string, tem: Record<string, unknown>): string {
  const detail = [str(tem.imageUrl), str(tem.magnification), str(tem.note)]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
  if (!detail) return discussion;
  const line = `TEM：${detail}`;
  if (discussion.includes(line)) return discussion;
  return discussion.trim() ? `${discussion}\n\n${line}` : line;
}

function parseInVitroResults(raw: unknown): InVitroResults {
  const o = obj(raw);
  const out = emptyInVitroResults();
  out.readout = pick(o.readout, ["luciferase", "fluorescence"] as const, "luciferase");
  out.fluorMetric = pick(o.fluorMetric, ["mfi", "percent"] as const, "mfi");
  out.columns = arr(o.columns).map((c) => {
    const co = obj(c);
    return { id: str(co.id) || genId(), name: str(co.name) };
  });
  const width = out.columns.length;
  out.replicates = arr(o.replicates).map((r) => {
    const ro = obj(r);
    const values = arr(ro.values).map((v) => str(v));
    // Pad or trim to the column count so an index is always addressable —
    // a column added in another tab must not make every row read undefined.
    return {
      id: str(ro.id) || genId(),
      values: Array.from({ length: width }, (_, i) => values[i] ?? ""),
    };
  });
  out.discussion = str(o.discussion);

  // v2 kept a flat 样本/分组/数值/单位 list. Each distinct 样本 becomes a
  // column and each of its values a replicate, so the numbers survive the
  // change of shape even though 分组 has nowhere to go.
  if (out.columns.length === 0 && Array.isArray(o.rows)) {
    const byName = new Map<string, string[]>();
    for (const r of arr(o.rows).map(obj)) {
      const label = str(r.label).trim() || "未命名";
      const list = byName.get(label) ?? [];
      list.push(str(r.value));
      byName.set(label, list);
    }
    out.columns = [...byName.keys()].map((name) => createInVitroColumn(name));
    const depth = Math.max(0, ...[...byName.values()].map((v) => v.length));
    out.replicates = Array.from({ length: depth }, (_, row) => ({
      id: genId(),
      values: [...byName.values()].map((v) => v[row] ?? ""),
    }));
  }
  return out;
}

function parseRoiRows(raw: unknown): RoiRow[] {
  return arr(raw).map((r) => {
    const ro = obj(r);
    return {
      id: str(ro.id) || genId(),
      // v2's flat metric rows had 样本 in `label` and no organ column; keeping
      // the name means the paste box opens with the samples already listed.
      sample: str(ro.sample) || str(ro.label),
      organ: str(ro.organ),
      totalRoi: str(ro.totalRoi) || str(ro.value),
      avgRoi: str(ro.avgRoi),
    };
  });
}

function parseInVivoResults(raw: unknown): InVivoResults {
  const o = obj(raw);
  const runs: RoiRun[] = arr(o.runs).map((r, i) => {
    const ro = obj(r);
    return {
      id: str(ro.id) || genId(),
      name: str(ro.name, `成像结果 ${i + 1}`),
      rawText: str(ro.rawText),
      rows: parseRoiRows(ro.rows),
      note: str(ro.note),
    };
  });

  // Before runs existed there was exactly one unnamed paste. Fold it into the
  // first run rather than dropping it.
  if (runs.length === 0 && (str(o.rawText) || arr(o.rows).length > 0)) {
    runs.push({
      id: genId(),
      name: "成像结果 1",
      rawText: str(o.rawText),
      rows: parseRoiRows(o.rows),
      note: "",
    });
  }

  return { runs, discussion: str(o.discussion) };
}

/**
 * Fold v2's typed design fields into the parameter bench that replaced them.
 *
 * Only fills blanks, so a value already recorded in the bench wins over the
 * duplicate that used to sit beside it.
 */
function seedAssayParams(
  params: ParamEntry[],
  design: Record<string, unknown>,
  map: [string, string][],
  extras: [string, string][]
): ParamEntry[] {
  let out = params;
  for (const [field, id] of map) out = seedParamValue(out, id, str(design[field]));
  // Fields with no home in the new bank become custom entries rather than
  // being dropped — a notebook may not quietly forget a recorded number.
  for (const [field, label] of extras) {
    const v = str(design[field]).trim();
    if (v && !out.some((e) => e.label === label)) {
      out = [...out, createCustomParam(label, v)];
    }
  }
  return out;
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
      // v2's batch-level TEM link/magnification/描述 is folded into the
      // discussion rather than dropped, since the box that edited it is gone.
      discussion: withLegacyTem(
        str(purResults.discussion),
        obj(purResults.tem)
      ),
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
        params: seedAssayParams(
          mergeParamEntries(INVITRO_PARAM_PRESETS, vitroDesign.params),
          vitroDesign,
          [
            ["cellLine", "cellLine"],
            ["passage", "passage"],
            ["plate", "plate"],
            ["dose", "dose"],
            ["timepoints", "timepoint"],
          ],
          [["seedingDensity", "转染时细胞密度"]]
        ),
        note: str(vitroDesign.note),
      },
      results: parseInVitroResults(vitroResults),
    },
    invivo: {
      design: {
        date: str(vivoDesign.date),
        params: seedAssayParams(
          mergeParamEntries(INVIVO_PARAM_PRESETS, vivoDesign.params),
          vivoDesign,
          // v2's 动物 held things like "BALB/c 小鼠", which is a 品系; its
          // 品系 field was labelled 品系 / 周龄 and held "雌性 6–8 周". Each
          // lands in the new field that actually asks for it, and
          // seedParamValue only fills blanks, so neither can clobber the other.
          [
            ["species", "strain"],
            ["strain", "age"],
            ["route", "route"],
            ["dose", "dose"],
            ["groups", "replicates"],
            ["timepoints", "timepoint"],
          ],
          []
        ),
        note: str(vivoDesign.note),
      },
      results: parseInVivoResults(vivoResults),
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
        d.purification.results.discussion.trim() !== ""
      );
    case 4: {
      const a = d.assay;
      return (
        a.invitro.results.columns.length > 0 ||
        a.invivo.results.runs.length > 0 ||
        paramsFilled(a.invitro.design.params) ||
        paramsFilled(a.invivo.design.params) ||
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
