import {
  computePreparationVolumes,
  computeStockVolumes,
  computeTotalConcentration,
  entriesToComponents,
  getAminesPerMolecule,
  isKnownLipid,
  type LipidEntry,
  type PreparationVolumes,
  type StockVolumeEntry,
  type TotalConcentration,
} from "./lnp-formula";

export interface BenchPrepParams {
  masterConc: string;
  frrAqueous: string;
  frrOrganic: string;
  npRatio: string;
  rnaMass: string;
  rnaConc: string;
  naType: "mRNA" | "siRNA" | "pDNA";
  aminesPerMolecule: string;
}

// ─── Experiment method ────────────────────────────────────
//
// Recorded per formulation so a screening session can be read back months
// later and still say *how* each batch was made — the numbers alone never
// answer "did I dialyse this one or spin it down?".

export type MixingMethodKey = "microfluidic" | "vortex" | "pipetting";
export type PostProcessKey = "none" | "dialysis" | "ultrafiltration";
export type DialysisDurationKey = "1h" | "2h" | "3h" | "4h" | "custom";
export type UltrafiltrationKey = "1" | "2" | "3" | "concentrate";

export interface BenchMethod {
  /** 制备方法 — empty until the user picks one. */
  mixing: MixingMethodKey | "";
  /** 后处理 — 透析 / 超滤 / 不做 */
  postProcess: PostProcessKey;
  dialysisDuration: DialysisDurationKey | "";
  /** free text, only meaningful when dialysisDuration === "custom" */
  dialysisCustom: string;
  ultrafiltration: UltrafiltrationKey | "";
  note: string;
}

export const MIXING_OPTIONS: { key: MixingMethodKey; label: string }[] = [
  { key: "microfluidic", label: "微流控" },
  { key: "vortex", label: "涡旋" },
  { key: "pipetting", label: "吹打" },
];

export const DIALYSIS_OPTIONS: {
  key: DialysisDurationKey;
  label: string;
}[] = [
  { key: "1h", label: "1 h" },
  { key: "2h", label: "2 h" },
  { key: "3h", label: "3 h" },
  { key: "4h", label: "4 h" },
  { key: "custom", label: "自定义" },
];

export const ULTRAFILTRATION_OPTIONS: {
  key: UltrafiltrationKey;
  label: string;
}[] = [
  { key: "1", label: "1 次" },
  { key: "2", label: "2 次" },
  { key: "3", label: "3 次" },
  { key: "concentrate", label: "仅浓缩" },
];

export function createDefaultMethod(): BenchMethod {
  return {
    mixing: "",
    postProcess: "none",
    dialysisDuration: "",
    dialysisCustom: "",
    ultrafiltration: "",
    note: "",
  };
}

/** Never throws — an unknown / legacy shape degrades to "nothing recorded". */
export function parseBenchMethod(raw: unknown): BenchMethod {
  const d = createDefaultMethod();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | "" =>
    typeof v === "string" && (allowed as readonly string[]).includes(v)
      ? (v as T)
      : "";
  const post = pick(o.postProcess, [
    "none",
    "dialysis",
    "ultrafiltration",
  ] as const);
  return {
    mixing: pick(o.mixing, MIXING_OPTIONS.map((m) => m.key)),
    postProcess: post || "none",
    dialysisDuration: pick(
      o.dialysisDuration,
      DIALYSIS_OPTIONS.map((m) => m.key)
    ),
    dialysisCustom: typeof o.dialysisCustom === "string" ? o.dialysisCustom : "",
    ultrafiltration: pick(
      o.ultrafiltration,
      ULTRAFILTRATION_OPTIONS.map((m) => m.key)
    ),
    note: typeof o.note === "string" ? o.note : "",
  };
}

/** One-line summary for cards, tables and exports. "" when nothing is set. */
export function describeMethod(m: BenchMethod | undefined): string {
  if (!m) return "";
  const parts: string[] = [];
  const mixing = MIXING_OPTIONS.find((o) => o.key === m.mixing);
  if (mixing) parts.push(mixing.label);

  if (m.postProcess === "dialysis") {
    const d =
      m.dialysisDuration === "custom"
        ? m.dialysisCustom.trim() || "自定义"
        : DIALYSIS_OPTIONS.find((o) => o.key === m.dialysisDuration)?.label ?? "";
    parts.push(d ? `透析 ${d}` : "透析");
  } else if (m.postProcess === "ultrafiltration") {
    const u = ULTRAFILTRATION_OPTIONS.find(
      (o) => o.key === m.ultrafiltration
    )?.label;
    parts.push(
      m.ultrafiltration === "concentrate" ? "超滤（仅浓缩）" : u ? `超滤 ${u}` : "超滤"
    );
  }

  return parts.join(" · ");
}

/** Split summary for the two-column Excel export. */
export function describeMethodParts(m: BenchMethod | undefined): {
  mixing: string;
  postProcess: string;
} {
  if (!m) return { mixing: "", postProcess: "" };
  const full = describeMethod(m);
  const mixing = MIXING_OPTIONS.find((o) => o.key === m.mixing)?.label ?? "";
  const postProcess = mixing ? full.replace(mixing, "").replace(/^ · /, "") : full;
  return { mixing, postProcess };
}

export interface BenchFormulation {
  id: string;
  name: string;
  lipidEntries: LipidEntry[];
  prep: BenchPrepParams;
  /** How the batch was actually made. Absent on formulations saved before
   *  method recording existed — read through `parseBenchMethod`. */
  method?: BenchMethod;
  notes?: string;
  createdAt: string;
}

export interface BenchSessionData {
  formulations: BenchFormulation[];
  schemaVersion: 1;
}

export interface BenchComputed {
  totalConc: TotalConcentration | null;
  stockVolumes: Record<string, StockVolumeEntry> | null;
  prepVolumes: PreparationVolumes;
  requiredLipidMix_uL: number | null;
}

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export function emptyBenchSession(): BenchSessionData {
  return { formulations: [], schemaVersion: 1 };
}

export function parseBenchSession(
  raw: Record<string, unknown> | null | undefined
): BenchSessionData {
  if (!raw || typeof raw !== "object") return emptyBenchSession();
  const forms = (raw as { formulations?: unknown }).formulations;
  if (!Array.isArray(forms)) return emptyBenchSession();
  return {
    schemaVersion: 1,
    formulations: (forms as BenchFormulation[]).map((f) => ({
      ...f,
      method: parseBenchMethod((f as { method?: unknown }).method),
    })),
  };
}

/**
 * Compute stock volumes, total concentration, prep volumes, and the
 * "just enough" lipid mix volume required for screening mode.
 *
 * In screening mode the Step 1 target volume is derived from Step 2's
 * RNA mass + N/P + ionizable ratio — i.e. `prepVolumes.lipidMix_uL`.
 */
export function computeBenchFormulation(
  f: BenchFormulation,
  opts: { extraLipidPhase_uL?: number } = {}
): BenchComputed {
  const components = entriesToComponents(f.lipidEntries);
  const totalConc = computeTotalConcentration(components);

  const ionizableEntry = f.lipidEntries.find((e) => e.typeKey === "ionizable");
  const ionizableRatio = ionizableEntry ? num(ionizableEntry.molarRatio) : 0;

  const isIonizableCustom = ionizableEntry
    ? ionizableEntry.isCustomLipid ||
      !isKnownLipid("ionizable", ionizableEntry.lipidName)
    : true;

  const amines = isIonizableCustom
    ? num(f.prep.aminesPerMolecule)
    : ionizableEntry
    ? getAminesPerMolecule(ionizableEntry.lipidName)
    : 1;

  const prepVolumes = computePreparationVolumes(totalConc, {
    masterConc_mM: num(f.prep.masterConc),
    frrAqueous: num(f.prep.frrAqueous),
    frrOrganic: num(f.prep.frrOrganic),
    npRatio: num(f.prep.npRatio),
    rnaMass_ug: num(f.prep.rnaMass),
    rnaConc_ug_per_uL: num(f.prep.rnaConc),
    aminesPerMolecule: amines > 0 ? amines : 1,
    ionizableRatio,
    extraLipidPhase_uL: opts.extraLipidPhase_uL ?? 0,
  });

  const requiredLipidMix_uL = prepVolumes.lipidMix_uL;

  // Stock volumes in screening mode use the derived required volume.
  const stockVolumes =
    requiredLipidMix_uL && requiredLipidMix_uL > 0
      ? computeStockVolumes({
          components,
          targetVolume: requiredLipidMix_uL,
          volumeUnit: "uL",
        })
      : null;

  return { totalConc, stockVolumes, prepVolumes, requiredLipidMix_uL };
}

export function generateFormulationId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/**
 * Produce a short summary string of the lipid composition for display
 * in tables / PDF / Excel. e.g. "SM-102 / DSPC / Cholesterol / DMG-PEG2000"
 */
export function composeLipidSummary(f: BenchFormulation): string {
  return f.lipidEntries
    .map((e) => (e.isCustomLipid ? e.customLipidName : e.lipidName) || "?")
    .join(" / ");
}

/**
 * Produce a short molar ratio summary. e.g. "50:10:38.5:1.5"
 */
export function composeRatioSummary(f: BenchFormulation): string {
  return f.lipidEntries.map((e) => e.molarRatio || "0").join(":");
}
