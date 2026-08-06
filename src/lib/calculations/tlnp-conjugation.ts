/**
 * Conjugation dosing for one reaction system.
 *
 * The ratio that matters is **linker : 蛋白** — the maleimide (or DBCO, or NHS)
 * on the functionalised PEG lipid is what the protein actually reacts with, and
 * how much of it is present is set by the formulation, not by the cargo. So the
 * chain runs
 *
 *   RNA mass → (N/P) → ionizable lipid → (ionizable mol %) → total lipid
 *            → (linker mol %) → linker mol → (target ratio) → protein mol
 *
 * and the RNA is only ever a way of counting how much lipid went in. An earlier
 * version took 蛋白 : RNA moles directly, which needed an RNA length and gave a
 * number with no relation to the number of reactive groups on the particle.
 *
 * Pure functions only — the matrix, the dosing boxes and every exporter read
 * through here so a printed protocol and the screen can't disagree.
 */

import type {
  LnpBasis,
  ProteinEntry,
  ReactionSystem,
} from "./tlnp-experiment";

const num = (s: string): number => {
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
};

/**
 * Average MW of one RNA nucleotide (sodium salt), i.e. of one phosphate — the
 * same 330 the LNP calculator uses to turn RNA mass into N/P. Shared constant
 * in spirit; duplicated as a literal because computePreparationVolumes takes
 * volumes, not moles, and there is nothing to import.
 */
const MW_PER_PHOSPHATE = 330;

/** nmol of RNA phosphate in one µg of RNA. */
const P_NMOL_PER_UG = 1e3 / MW_PER_PHOSPHATE;

export interface ConjugationDose {
  rnaMass_ug: number | null;
  /** nmol of reactive linker lipid in the LNP taken. */
  linker_nmol: number | null;
  protein_nmol: number | null;
  lnpVolume_uL: number | null;
  proteinVolume_uL: number | null;
  /** Make-up buffer to reach the pinned total volume. */
  bufferVolume_uL: number | null;
  totalVolume_uL: number | null;
  /** Non-blocking notes — missing inputs, or a physically impossible system. */
  warnings: string[];
}

const EMPTY_DOSE: ConjugationDose = {
  rnaMass_ug: null,
  linker_nmol: null,
  protein_nmol: null,
  lnpVolume_uL: null,
  proteinVolume_uL: null,
  bufferVolume_uL: null,
  totalVolume_uL: null,
  warnings: [],
};

/**
 * How many nmol of linker lipid ride along with one µg of RNA.
 *
 * Independent of how much was made — it is a property of the formulation — so
 * it doubles as a sanity figure to show next to the ratio.
 */
export function linkerNmolPerUgRna(
  basis: LnpBasis,
  linkerPercent: string
): number | null {
  const np = num(basis.npRatio);
  const ionizable = num(basis.ionizablePercent);
  const amines = num(basis.aminesPerMolecule);
  const linker = num(linkerPercent);

  if (!(np > 0) || !(ionizable > 0) || !(linker > 0)) return null;
  const perAmine = amines > 0 ? amines : 1;

  const p_nmol = P_NMOL_PER_UG;
  const n_nmol = p_nmol * np;
  const ionizable_nmol = n_nmol / perAmine;
  const totalLipid_nmol = ionizable_nmol / (ionizable / 100);
  return totalLipid_nmol * (linker / 100);
}

/** nmol of protein per µL of its stock. */
export function proteinNmolPerUL(p: ProteinEntry): number | null {
  const conc = num(p.conc);
  if (!(conc > 0)) return null;
  // µM is µmol/L, which is 1e-3 nmol/µL.
  if (p.concUnit === "uM") return conc / 1000;
  // mg/mL is numerically µg/µL, and (µg/µL) / (MW g/mol) × 1e3 = nmol/µL.
  const mw = num(p.mw);
  if (!(mw > 0)) return null;
  return (conc * 1e3) / mw;
}

/**
 * Work out the 加样体系 for one reaction system.
 *
 * `totalVolume` is what the user is making up to, so buffer is a real solved
 * quantity here rather than the invented number an unpinned system would give.
 */
export function computeConjugationDose(
  s: ReactionSystem,
  protein: ProteinEntry | null
): ConjugationDose {
  const warnings: string[] = [];

  const conc = num(s.lnpConc);
  const volume = num(s.lnpVolume);
  const ratio = num(s.molarRatio);
  const total = num(s.totalVolume);

  if (!(conc > 0)) warnings.push("缺 LNP 浓度");
  if (!(volume > 0)) warnings.push("缺 LNP 体积");
  if (!(num(s.linkerPercent) > 0)) warnings.push("缺 linker 摩尔比例");
  if (!(ratio > 0)) warnings.push("缺 linker : 蛋白 摩尔比");
  if (!protein) warnings.push("未选择蛋白");

  if (!(conc > 0) || !(volume > 0)) return { ...EMPTY_DOSE, warnings };

  // ng/µL × µL = ng, and 1000 ng = 1 µg.
  const rnaMass_ug = (conc * volume) / 1000;
  const perUg = linkerNmolPerUgRna(s.basis, s.linkerPercent);
  const linker_nmol = perUg === null ? null : perUg * rnaMass_ug;

  const partial: ConjugationDose = {
    ...EMPTY_DOSE,
    rnaMass_ug,
    linker_nmol,
    lnpVolume_uL: volume,
    warnings,
  };

  if (linker_nmol === null || !(ratio > 0) || !protein) return partial;

  const protein_nmol = linker_nmol * ratio;
  const perUL = proteinNmolPerUL(protein);
  if (perUL === null || !(perUL > 0)) {
    warnings.push("蛋白浓度或分子量不完整，无法算取用体积");
    return { ...partial, protein_nmol };
  }

  const proteinVolume_uL = protein_nmol / perUL;

  // Buffer only exists once there's a target volume to make up to.
  let bufferVolume_uL: number | null = null;
  let totalVolume_uL: number | null = null;
  if (total > 0) {
    totalVolume_uL = total;
    bufferVolume_uL = total - volume - proteinVolume_uL;
    if (bufferVolume_uL < 0) {
      warnings.push(
        `LNP + 蛋白已达 ${(volume + proteinVolume_uL).toFixed(1)} µL，超过设定的总体积`
      );
      bufferVolume_uL = 0;
    }
  } else {
    // Without a pinned volume the reaction is just the two stocks combined.
    totalVolume_uL = volume + proteinVolume_uL;
  }

  // Not an error — it still reacts — but past ~2× the LNP volume the particles
  // are being meaningfully diluted, which changes the kinetics.
  if (proteinVolume_uL > volume * 2) {
    warnings.push("蛋白取用体积远大于 LNP 体积，反应体系被明显稀释");
  }

  return {
    rnaMass_ug,
    linker_nmol,
    protein_nmol,
    lnpVolume_uL: volume,
    proteinVolume_uL,
    bufferVolume_uL,
    totalVolume_uL,
    warnings,
  };
}

/** One-line summary for the matrix header and the exports. */
export function describeSystemDose(
  s: ReactionSystem,
  protein: ProteinEntry | null
): string {
  const d = computeConjugationDose(s, protein);
  const parts: string[] = [];
  if (s.molarRatio) parts.push(`linker:蛋白 1:${s.molarRatio}`);
  if (d.proteinVolume_uL !== null) {
    parts.push(`蛋白 ${d.proteinVolume_uL.toFixed(1)} µL`);
  }
  const cond = [s.temperature, s.duration, s.shaking].filter(Boolean).join(" · ");
  if (cond) parts.push(cond);
  return parts.join(" / ");
}

/** Display name for a system, falling back to its position in the matrix. */
export function systemName(s: ReactionSystem, index: number): string {
  return s.name.trim() || `体系 ${index + 1}`;
}

export function proteinName(p: ProteinEntry | null, index = 0): string {
  if (!p) return "";
  return p.name.trim() || `蛋白 ${index + 1}`;
}

export function findProtein(
  proteins: ProteinEntry[],
  id: string
): ProteinEntry | null {
  return proteins.find((p) => p.id === id) ?? null;
}
