export interface LnpInput {
  /** Target N/P ratio */
  npRatio: number;
  /** Amount of nucleic acid in micrograms */
  naAmount: number;
  /** Nucleic acid type */
  naType: "mRNA" | "siRNA" | "pDNA";
  /** Ionizable lipid molar ratio (%) */
  ionizableLipidRatio: number;
  /** Helper lipid molar ratio (%) */
  helperLipidRatio: number;
  /** Cholesterol molar ratio (%) */
  cholesterolRatio: number;
  /** PEG-lipid molar ratio (%) */
  pegLipidRatio: number;
  /** Ionizable lipid MW (g/mol) */
  ionizableLipidMW: number;
  /** Helper lipid MW (g/mol), default DSPC = 790.15 */
  helperLipidMW: number;
  /** PEG-lipid MW (g/mol), default DMG-PEG2000 ≈ 2509.2 */
  pegLipidMW: number;
}

export interface LnpResult {
  ionizableLipidMass: number;
  helperLipidMass: number;
  cholesterolMass: number;
  pegLipidMass: number;
  totalLipidMass: number;
  naAmount: number;
  lipidToNARatio: number;
}

const CHOLESTEROL_MW = 386.65;

/** Average MW per nucleotide phosphate for different NA types */
const NA_MW_PER_NT: Record<string, number> = {
  mRNA: 330,
  siRNA: 330,
  pDNA: 330,
};

/**
 * Calculate LNP formulation based on N/P ratio and molar ratios.
 *
 * N = moles of ionizable amine groups (assuming 1 amine per ionizable lipid)
 * P = moles of phosphate groups in nucleic acid
 */
export function calculateLnpFormulation(
  input: LnpInput
): LnpResult | { error: string } {
  const ratioSum =
    input.ionizableLipidRatio +
    input.helperLipidRatio +
    input.cholesterolRatio +
    input.pegLipidRatio;

  if (Math.abs(ratioSum - 100) > 0.1) {
    return { error: `Lipid molar ratios must sum to 100%. Current sum: ${ratioSum.toFixed(1)}%` };
  }

  if (input.npRatio <= 0 || input.naAmount <= 0) {
    return { error: "N/P ratio and nucleic acid amount must be positive." };
  }

  const mwPerNt = NA_MW_PER_NT[input.naType] || 330;

  // moles of phosphate = mass(µg) / MW_per_nt / 1e6 (convert µg to g)
  const molesP = (input.naAmount / 1e6) / mwPerNt;

  // moles of ionizable lipid needed (N = npRatio * P)
  const molesIonizable = input.npRatio * molesP;

  // moles of each lipid from molar ratios
  const molesHelper =
    molesIonizable * (input.helperLipidRatio / input.ionizableLipidRatio);
  const molesCholesterol =
    molesIonizable * (input.cholesterolRatio / input.ionizableLipidRatio);
  const molesPeg =
    molesIonizable * (input.pegLipidRatio / input.ionizableLipidRatio);

  // mass in micrograms
  const ionizableLipidMass = molesIonizable * input.ionizableLipidMW * 1e6;
  const helperLipidMass = molesHelper * input.helperLipidMW * 1e6;
  const cholesterolMass = molesCholesterol * CHOLESTEROL_MW * 1e6;
  const pegLipidMass = molesPeg * input.pegLipidMW * 1e6;

  const totalLipidMass =
    ionizableLipidMass + helperLipidMass + cholesterolMass + pegLipidMass;

  return {
    ionizableLipidMass: round(ionizableLipidMass, 3),
    helperLipidMass: round(helperLipidMass, 3),
    cholesterolMass: round(cholesterolMass, 3),
    pegLipidMass: round(pegLipidMass, 3),
    totalLipidMass: round(totalLipidMass, 3),
    naAmount: input.naAmount,
    lipidToNARatio: round(totalLipidMass / input.naAmount, 2),
  };
}

function round(value: number, decimals: number): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

/** Default LNP formulation (similar to Onpattro/Moderna) */
export const DEFAULT_LNP_INPUT: LnpInput = {
  npRatio: 6,
  naAmount: 10,
  naType: "mRNA",
  ionizableLipidRatio: 50,
  helperLipidRatio: 10,
  cholesterolRatio: 38.5,
  pegLipidRatio: 1.5,
  ionizableLipidMW: 710.18, // SM-102
  helperLipidMW: 790.15, // DSPC
  pegLipidMW: 2509.2, // DMG-PEG2000
};
