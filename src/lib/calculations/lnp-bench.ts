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

export interface BenchFormulation {
  id: string;
  name: string;
  lipidEntries: LipidEntry[];
  prep: BenchPrepParams;
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
  return { schemaVersion: 1, formulations: forms as BenchFormulation[] };
}

/**
 * Compute stock volumes, total concentration, prep volumes, and the
 * "just enough" lipid mix volume required for screening mode.
 *
 * In screening mode the Step 1 target volume is derived from Step 2's
 * RNA mass + N/P + ionizable ratio — i.e. `prepVolumes.lipidMix_uL`.
 */
export function computeBenchFormulation(
  f: BenchFormulation
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
