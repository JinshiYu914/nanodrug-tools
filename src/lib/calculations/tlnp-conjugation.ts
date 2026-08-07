/**
 * Conjugation dosing for one reaction system.
 *
 * The ratio that matters is **linker : 抗体** — the maleimide (or DBCO, or NHS)
 * on the functionalised PEG lipid is what the antibody actually reacts with,
 * and how much of it is present is set by the formulation, not by the cargo. So
 * the chain runs
 *
 *   RNA mass → (N/P) → ionizable lipid → (ionizable mol %) → total lipid
 *            → (linker mol %) → linker mol → (target ratio) → antibody mol
 *
 * and the RNA is only ever a way of counting how much lipid went in. An earlier
 * version took 抗体 : RNA moles directly, which needed an RNA length and gave a
 * number with no relation to the number of reactive groups on the particle.
 *
 * The user picks the RNA mass, not the LNP volume: the volume is whatever
 * delivers that mass at the measured concentration, so it is derived here
 * rather than typed. Letting both be typed would let them disagree.
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
  const rnaMass_ug = num(s.rnaMass);
  const ratio = num(s.molarRatio);
  const total = num(s.totalVolume);

  if (!(conc > 0)) warnings.push("缺 LNP 浓度");
  if (!(rnaMass_ug > 0)) warnings.push("缺投料 LNP-RNA 量");
  if (!(num(s.linkerPercent) > 0)) warnings.push("缺 linker 摩尔比例");
  if (!(ratio > 0)) warnings.push("缺 linker : 抗体 摩尔比");
  if (!protein) warnings.push("未选择抗体");

  if (!(rnaMass_ug > 0)) return { ...EMPTY_DOSE, warnings };

  // µg × 1000 = ng, and ng ÷ (ng/µL) = µL.
  const lnpVolume_uL = conc > 0 ? (rnaMass_ug * 1000) / conc : null;
  const perUg = linkerNmolPerUgRna(s.basis, s.linkerPercent);
  const linker_nmol = perUg === null ? null : perUg * rnaMass_ug;

  const partial: ConjugationDose = {
    ...EMPTY_DOSE,
    rnaMass_ug,
    linker_nmol,
    lnpVolume_uL,
    warnings,
  };

  if (linker_nmol === null || !(ratio > 0) || !protein) return partial;

  const protein_nmol = linker_nmol * ratio;
  const perUL = proteinNmolPerUL(protein);
  if (perUL === null || !(perUL > 0)) {
    warnings.push("抗体浓度或分子量不完整，无法算取用体积");
    return { ...partial, protein_nmol };
  }

  const proteinVolume_uL = protein_nmol / perUL;

  // Buffer only exists once there's a target volume to make up to, and only
  // once the LNP volume itself is known.
  let bufferVolume_uL: number | null = null;
  let totalVolume_uL: number | null = null;
  const lnp = lnpVolume_uL ?? 0;
  if (total > 0) {
    totalVolume_uL = total;
    if (lnpVolume_uL !== null) {
      bufferVolume_uL = total - lnp - proteinVolume_uL;
      if (bufferVolume_uL < 0) {
        warnings.push(
          `LNP + 抗体已达 ${(lnp + proteinVolume_uL).toFixed(1)} µL，超过设定的总体积`
        );
        bufferVolume_uL = 0;
      }
    }
  } else if (lnpVolume_uL !== null) {
    // Without a pinned volume the reaction is just the two stocks combined.
    totalVolume_uL = lnp + proteinVolume_uL;
  }

  // Not an error — it still reacts — but past ~2× the LNP volume the particles
  // are being meaningfully diluted, which changes the kinetics.
  if (lnpVolume_uL !== null && proteinVolume_uL > lnp * 2) {
    warnings.push("抗体取用体积远大于 LNP 体积，反应体系被明显稀释");
  }

  return {
    rnaMass_ug,
    linker_nmol,
    protein_nmol,
    lnpVolume_uL,
    proteinVolume_uL,
    bufferVolume_uL,
    totalVolume_uL,
    warnings,
  };
}

export interface DoseStep {
  label: string;
  /** The arithmetic with the actual numbers substituted in. */
  expr: string;
  result: string;
}

const f = (v: number, digits = 1): string =>
  Number(v.toFixed(digits)).toString();

/**
 * The dose worked out longhand, one line per step.
 *
 * Shown under every 加样体系 box because the chain from an RNA mass to an
 * antibody volume runs through four conversions the user cannot check by
 * eye — and a pipetting number nobody can check is a number nobody should
 * trust. Returns as far as it can get and stops at the first missing input.
 */
export function explainConjugationDose(
  s: ReactionSystem,
  protein: ProteinEntry | null
): DoseStep[] {
  const steps: DoseStep[] = [];
  const conc = num(s.lnpConc);
  const rnaMass = num(s.rnaMass);
  const ratio = num(s.molarRatio);
  const total = num(s.totalVolume);
  if (!(rnaMass > 0)) return steps;

  if (conc > 0) {
    steps.push({
      label: "LNP 取用体积",
      expr: `${f(rnaMass, 2)} µg × 1000 ÷ ${f(conc, 2)} ng/µL`,
      result: `${f((rnaMass * 1000) / conc)} µL`,
    });
  }

  const perUg = linkerNmolPerUgRna(s.basis, s.linkerPercent);
  if (perUg === null) return steps;

  const np = num(s.basis.npRatio);
  const ionizable = num(s.basis.ionizablePercent);
  const amines = num(s.basis.aminesPerMolecule);
  steps.push({
    label: "每 µg RNA 的 linker",
    expr:
      `(1000 ÷ 330) × N/P ${f(np, 2)} ÷ ${f(amines > 0 ? amines : 1, 0)} 胺` +
      ` ÷ ${f(ionizable, 1)}% × linker ${f(num(s.linkerPercent), 2)}%`,
    result: `${perUg.toFixed(3)} nmol/µg`,
  });

  const linker = perUg * rnaMass;
  steps.push({
    label: "linker 总量",
    expr: `${f(rnaMass, 2)} µg × ${perUg.toFixed(3)} nmol/µg`,
    result: `${linker.toFixed(3)} nmol`,
  });

  if (!(ratio > 0)) return steps;
  const proteinNmol = linker * ratio;
  steps.push({
    label: "抗体投入量",
    expr: `${linker.toFixed(3)} nmol × ${f(ratio, 2)} (linker : 抗体 = 1 : ${f(ratio, 2)})`,
    result: `${proteinNmol.toFixed(3)} nmol`,
  });

  if (!protein) return steps;
  const perUL = proteinNmolPerUL(protein);
  if (perUL === null || !(perUL > 0)) return steps;
  steps.push({
    label: "抗体母液浓度",
    expr:
      protein.concUnit === "uM"
        ? `${protein.conc} µM ÷ 1000`
        : `${protein.conc} mg/mL × 1000 ÷ ${protein.mw} Da`,
    result: `${perUL.toFixed(4)} nmol/µL`,
  });

  const proteinVolume = proteinNmol / perUL;
  steps.push({
    label: "抗体取用体积",
    expr: `${proteinNmol.toFixed(3)} nmol ÷ ${perUL.toFixed(4)} nmol/µL`,
    result: `${f(proteinVolume)} µL`,
  });

  if (total > 0 && conc > 0) {
    const lnpVolume = (rnaMass * 1000) / conc;
    steps.push({
      label: "反应 buffer 补加",
      expr: `${f(total)} µL − ${f(lnpVolume)} µL − ${f(proteinVolume)} µL`,
      result: `${f(Math.max(0, total - lnpVolume - proteinVolume))} µL`,
    });
  }

  return steps;
}

/** One-line summary for the matrix header and the exports. */
export function describeSystemDose(
  s: ReactionSystem,
  protein: ProteinEntry | null
): string {
  const d = computeConjugationDose(s, protein);
  const parts: string[] = [];
  if (s.molarRatio) parts.push(`linker:抗体 1:${s.molarRatio}`);
  if (d.proteinVolume_uL !== null) {
    parts.push(`抗体 ${d.proteinVolume_uL.toFixed(1)} µL`);
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
  return p.name.trim() || `抗体 ${index + 1}`;
}

export function findProtein(
  proteins: ProteinEntry[],
  id: string
): ProteinEntry | null {
  return proteins.find((p) => p.id === id) ?? null;
}
