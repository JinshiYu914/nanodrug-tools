const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008,
  He: 4.003,
  Li: 6.941,
  Be: 9.012,
  B: 10.81,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  Ne: 20.18,
  Na: 22.99,
  Mg: 24.305,
  Al: 26.982,
  Si: 28.086,
  P: 30.974,
  S: 32.065,
  Cl: 35.453,
  Ar: 39.948,
  K: 39.098,
  Ca: 40.078,
  Fe: 55.845,
  Cu: 63.546,
  Zn: 65.38,
  Br: 79.904,
  I: 126.904,
};

export interface MolWeightResult {
  formula: string;
  molecularWeight: number;
  composition: { element: string; count: number; weight: number }[];
}

/**
 * Parse a chemical formula string and calculate molecular weight.
 * Supports nested parentheses, e.g. "Ca(OH)2", "Mg3(PO4)2"
 */
export function calculateMolecularWeight(
  formula: string
): MolWeightResult | { error: string } {
  try {
    const composition = parseFormula(formula);
    let totalWeight = 0;
    const breakdown: MolWeightResult["composition"] = [];

    for (const [element, count] of Object.entries(composition)) {
      const atomicWeight = ATOMIC_WEIGHTS[element];
      if (!atomicWeight) {
        return { error: `Unknown element: ${element}` };
      }
      const weight = atomicWeight * count;
      totalWeight += weight;
      breakdown.push({ element, count, weight });
    }

    breakdown.sort((a, b) => b.weight - a.weight);

    return {
      formula,
      molecularWeight: Math.round(totalWeight * 1000) / 1000,
      composition: breakdown,
    };
  } catch {
    return { error: "Invalid formula. Please use standard chemical notation, e.g. H2O, C6H12O6, Ca(OH)2" };
  }
}

function parseFormula(formula: string): Record<string, number> {
  const stack: Record<string, number>[] = [{}];

  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];

    if (ch === "(") {
      stack.push({});
      i++;
    } else if (ch === ")") {
      i++;
      const numStart = i;
      while (i < formula.length && /\d/.test(formula[i])) i++;
      const multiplier = numStart < i ? parseInt(formula.slice(numStart, i)) : 1;

      const top = stack.pop()!;
      const current = stack[stack.length - 1];
      for (const [el, cnt] of Object.entries(top)) {
        current[el] = (current[el] || 0) + cnt * multiplier;
      }
    } else if (/[A-Z]/.test(ch)) {
      let element = ch;
      i++;
      while (i < formula.length && /[a-z]/.test(formula[i])) {
        element += formula[i];
        i++;
      }
      const numStart = i;
      while (i < formula.length && /\d/.test(formula[i])) i++;
      const count = numStart < i ? parseInt(formula.slice(numStart, i)) : 1;

      const current = stack[stack.length - 1];
      current[element] = (current[element] || 0) + count;
    } else {
      i++;
    }
  }

  return stack[0];
}

/** Common compounds in nano drug delivery for quick reference */
export const COMMON_COMPOUNDS: { name: string; formula: string; mw: number }[] = [
  { name: "DSPC", formula: "C44H88NO8P", mw: 790.15 },
  { name: "Cholesterol", formula: "C27H46O", mw: 386.65 },
  { name: "DMG-PEG2000 (approx.)", formula: "C116H232NO49", mw: 2509.2 },
  { name: "SM-102", formula: "C44H87NO5", mw: 710.18 },
  { name: "ALC-0315", formula: "C48H95NO5", mw: 766.27 },
  { name: "DOTAP", formula: "C42H80ClNO4", mw: 698.54 },
  { name: "DOPE", formula: "C41H78NO8P", mw: 744.03 },
  { name: "Water", formula: "H2O", mw: 18.015 },
  { name: "Ethanol", formula: "C2H6O", mw: 46.069 },
];
