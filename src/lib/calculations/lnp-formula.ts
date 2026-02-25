// ─── Lipid Database ───────────────────────────────────────

export const LIPID_DATABASE = {
  ionizable: {
    "SM-102": { molarWeight: 710.18, aminesPerMolecule: 1 },
    "MC3 (DLin-MC3-DMA)": { molarWeight: 642.09, aminesPerMolecule: 1 },
    "ALC-0315": { molarWeight: 766.13, aminesPerMolecule: 1 },
  },
  helper: {
    DSPC: { molarWeight: 790.15 },
    DOPE: { molarWeight: 744.03 },
    DOPC: { molarWeight: 786.11 },
  },
  cholesterol: {
    Cholesterol: { molarWeight: 386.65 },
  },
  peg: {
    "DMG-PEG2000": { molarWeight: 2509.2 },
    "DSPE-PEG2000": { molarWeight: 2805.5 },
    "C14-PEG2000": { molarWeight: 2285.0 },
  },
} as const;

export type LipidCategory = keyof typeof LIPID_DATABASE;

// ─── Standard Type Definitions ───────────────────────────

export interface StandardTypeInfo {
  key: string;
  label: string;
  description: string;
  defaultLipid: string;
  defaultMW: string;
  defaultRatio: string;
  defaultStock: string;
}

export const STANDARD_TYPES: StandardTypeInfo[] = [
  {
    key: "ionizable",
    label: "Cationic / Ionizable",
    description: "可电离阳离子脂质，包裹核酸并促进内体逃逸",
    defaultLipid: "SM-102",
    defaultMW: "710.18",
    defaultRatio: "50",
    defaultStock: "75",
  },
  {
    key: "helper",
    label: "Helper (Structural)",
    description: "辅助/结构脂质，提供 LNP 结构稳定性",
    defaultLipid: "DSPC",
    defaultMW: "790.15",
    defaultRatio: "10",
    defaultStock: "10",
  },
  {
    key: "cholesterol",
    label: "Sterol",
    description: "胆固醇，增强膜稳定性",
    defaultLipid: "Cholesterol",
    defaultMW: "386.65",
    defaultRatio: "38.5",
    defaultStock: "10",
  },
  {
    key: "peg",
    label: "PEG-Lipid",
    description: "PEG 化脂质，提供空间位阻，延长循环时间",
    defaultLipid: "DMG-PEG2000",
    defaultMW: "2509.2",
    defaultRatio: "1.5",
    defaultStock: "10",
  },
];

// ─── Dynamic Lipid Entry ─────────────────────────────────

export interface LipidEntry {
  id: string;
  typeKey: string;
  label: string;
  lipidName: string;
  customLipidName: string;
  isCustomLipid: boolean;
  molarWeight: string;
  molarRatio: string;
  stockConc: string;
}

let _nextId = 1;

export function createDefaultEntries(): LipidEntry[] {
  return STANDARD_TYPES.map((t) => ({
    id: String(_nextId++),
    typeKey: t.key,
    label: t.label,
    lipidName: t.defaultLipid,
    customLipidName: "",
    isCustomLipid: false,
    molarWeight: t.defaultMW,
    molarRatio: t.defaultRatio,
    stockConc: t.defaultStock,
  }));
}

export function createStandardEntry(typeKey: string): LipidEntry | null {
  const info = STANDARD_TYPES.find((t) => t.key === typeKey);
  if (!info) return null;
  return {
    id: String(_nextId++),
    typeKey: info.key,
    label: info.label,
    lipidName: info.defaultLipid,
    customLipidName: "",
    isCustomLipid: false,
    molarWeight: info.defaultMW,
    molarRatio: info.defaultRatio,
    stockConc: info.defaultStock,
  };
}

export function createCustomEntry(index: number): LipidEntry {
  return {
    id: String(_nextId++),
    typeKey: `custom_${index}`,
    label: `Custom ${index}`,
    lipidName: "",
    customLipidName: "",
    isCustomLipid: true,
    molarWeight: "",
    molarRatio: "",
    stockConc: "",
  };
}

// ─── Types ────────────────────────────────────────────────

export interface LipidComponent {
  name: string;
  molarWeight: number;
  molarRatio: number;
  stockConc: number;
}

export interface LipidMixConfig {
  components: Record<string, LipidComponent>;
  targetVolume: number;
  volumeUnit: "uL" | "mL";
}

export interface StockVolumeEntry {
  uL: number;
  mL: number;
}

export interface TotalConcentration {
  M: number;
  mM: number;
  uM: number;
  massConc_mg_per_mL: number;
}

export interface PreparationParams {
  masterConc_mM: number;
  frrAqueous: number;
  frrOrganic: number;
  npRatio: number;
  rnaMass_ug: number;
  rnaConc_ug_per_uL: number;
  aminesPerMolecule: number;
  ionizableRatio: number;
}

export interface PreparationVolumes {
  rnaVolume_uL: number | null;
  cbBuffer_uL: number | null;
  lipidMix_uL: number | null;
  ethanol_uL: number | null;
  aqueousTotal_uL: number | null;
  organicTotal_uL: number | null;
}

// ─── Helpers ──────────────────────────────────────────────

function round(value: number, decimals: number): number {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

export function getDbOptions(typeKey: string): string[] {
  if (typeKey in LIPID_DATABASE) {
    return Object.keys(
      LIPID_DATABASE[typeKey as LipidCategory] as Record<string, unknown>
    );
  }
  return [];
}

export function getLipidMW(typeKey: string, name: string): number | null {
  if (!(typeKey in LIPID_DATABASE)) return null;
  const db = LIPID_DATABASE[typeKey as LipidCategory] as Record<
    string,
    { molarWeight: number }
  >;
  return db[name]?.molarWeight ?? null;
}

export function getAminesPerMolecule(name: string): number {
  const db = LIPID_DATABASE.ionizable as Record<
    string,
    { aminesPerMolecule: number }
  >;
  return db[name]?.aminesPerMolecule ?? 1;
}

export function isKnownLipid(typeKey: string, name: string): boolean {
  if (!(typeKey in LIPID_DATABASE)) return false;
  const db = LIPID_DATABASE[typeKey as LipidCategory] as Record<
    string,
    unknown
  >;
  return name !== "" && name in db;
}

export function entriesToComponents(
  entries: LipidEntry[]
): Record<string, LipidComponent> {
  const num = (s: string) => {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  return Object.fromEntries(
    entries.map((e) => [
      e.id,
      {
        name: e.isCustomLipid ? e.customLipidName : e.lipidName,
        molarWeight: num(e.molarWeight),
        molarRatio: num(e.molarRatio),
        stockConc: num(e.stockConc),
      },
    ])
  );
}

// ─── Core Calculations ───────────────────────────────────

/**
 * Compute stock solution volumes to pipette for each lipid component.
 *
 * For each component k:
 *   C[k] = stockConc[k] / MW[k]           (mol/L)
 *   denom = Σ(ratio[k] / C[k])
 *   vol[k] = totalVolume × (ratio[k] / C[k]) / denom
 */
export function computeStockVolumes(
  config: LipidMixConfig
): Record<string, StockVolumeEntry> | null {
  const entries = Object.entries(config.components);
  if (entries.length === 0) return null;

  const ratioSum = entries.reduce((sum, [, c]) => sum + c.molarRatio, 0);
  if (Math.abs(ratioSum - 100) > 0.01) return null;
  if (config.targetVolume <= 0) return null;

  for (const [, c] of entries) {
    if (c.molarWeight <= 0 || c.stockConc <= 0 || c.molarRatio <= 0)
      return null;
  }

  const C: Record<string, number> = {};
  for (const [key, c] of entries) {
    C[key] = c.stockConc / c.molarWeight;
  }

  const denom = entries.reduce(
    (sum, [key, c]) => sum + c.molarRatio / C[key],
    0
  );
  if (denom <= 0) return null;

  const volL =
    config.volumeUnit === "mL"
      ? config.targetVolume * 1e-3
      : config.targetVolume * 1e-6;

  const result: Record<string, StockVolumeEntry> = {};
  for (const [key, c] of entries) {
    const vL = (volL * (c.molarRatio / C[key])) / denom;
    result[key] = {
      uL: round(vL * 1e6, 2),
      mL: round(vL * 1e3, 6),
    };
  }

  return result;
}

/**
 * Compute total molar concentration of the lipid mix.
 * Independent of target volume — determined solely by
 * molar ratios, molecular weights, and stock concentrations.
 *
 *   M = 100 / Σ(ratio[k] / C[k])
 *   where C[k] = stockConc[k] / MW[k]
 */
export function computeTotalConcentration(
  components: Record<string, LipidComponent>
): TotalConcentration | null {
  const entries = Object.entries(components);
  if (entries.length === 0) return null;

  const ratioSum = entries.reduce((sum, [, c]) => sum + c.molarRatio, 0);
  if (Math.abs(ratioSum - 100) > 0.01) return null;

  for (const [, c] of entries) {
    if (c.molarWeight <= 0 || c.stockConc <= 0 || c.molarRatio <= 0)
      return null;
  }

  const denom = entries.reduce(
    (sum, [, c]) => sum + c.molarRatio / (c.stockConc / c.molarWeight),
    0
  );
  if (denom <= 0) return null;

  const M = 100 / denom;
  const massConc =
    entries.reduce((sum, [, c]) => sum + c.molarRatio * c.molarWeight, 0) /
    denom;

  return {
    M,
    mM: M * 1e3,
    uM: M * 1e6,
    massConc_mg_per_mL: massConc,
  };
}

/**
 * Compute aqueous and organic phase volumes for LNP preparation.
 */
export function computePreparationVolumes(
  totalConc: TotalConcentration | null,
  params: PreparationParams
): PreparationVolumes {
  const result: PreparationVolumes = {
    rnaVolume_uL: null,
    cbBuffer_uL: null,
    lipidMix_uL: null,
    ethanol_uL: null,
    aqueousTotal_uL: null,
    organicTotal_uL: null,
  };

  if (params.rnaConc_ug_per_uL > 0 && params.rnaMass_ug > 0) {
    result.rnaVolume_uL = round(
      params.rnaMass_ug / params.rnaConc_ug_per_uL,
      2
    );
  }

  const { frrAqueous, frrOrganic } = params;
  if (frrAqueous <= 0 || frrOrganic <= 0) return result;

  const mass_g = params.rnaMass_ug / 1e6;
  const mol_P = mass_g > 0 ? mass_g / 330 : 0;
  const mol_N =
    params.npRatio > 0 && mol_P > 0 ? params.npRatio * mol_P : 0;
  const amines =
    params.aminesPerMolecule > 0 ? params.aminesPerMolecule : 1;
  const mol_ionizable = mol_N > 0 ? mol_N / amines : 0;

  const c_total_M = totalConc?.M ?? 0;
  const rIon = Math.max(params.ionizableRatio, 0) / 100;
  const c_ion_M = c_total_M > 0 && rIon > 0 ? c_total_M * rIon : 0;

  const vol_lipidmix_L =
    c_ion_M > 0 && mol_ionizable > 0 ? mol_ionizable / c_ion_M : 0;

  if (vol_lipidmix_L > 0) {
    result.lipidMix_uL = round(vol_lipidmix_L * 1e6, 2);
  }

  const c_target_M =
    params.masterConc_mM > 0 ? params.masterConc_mM * 1e-3 : 0;

  if (c_target_M > 0 && c_total_M > 0 && vol_lipidmix_L > 0) {
    const vol_org_L = (c_total_M / c_target_M) * vol_lipidmix_L;
    result.organicTotal_uL = round(vol_org_L * 1e6, 2);

    if (result.lipidMix_uL !== null && result.organicTotal_uL > 0) {
      result.ethanol_uL = round(
        Math.max(result.organicTotal_uL - result.lipidMix_uL, 0),
        2
      );
    }

    if (result.organicTotal_uL > 0) {
      result.aqueousTotal_uL = round(
        result.organicTotal_uL * (frrAqueous / frrOrganic),
        2
      );
    }
  }

  if (result.aqueousTotal_uL !== null) {
    if (result.rnaVolume_uL !== null) {
      result.cbBuffer_uL = round(
        Math.max(result.aqueousTotal_uL - result.rnaVolume_uL, 0),
        2
      );
    } else {
      result.cbBuffer_uL = result.aqueousTotal_uL;
    }
  }

  return result;
}

// ─── Display Helpers ──────────────────────────────────────

export function formatVolume(uL: number | null): string {
  if (uL === null || isNaN(uL)) return "--";
  if (uL >= 1000) return `${(uL / 1000).toFixed(2)} mL`;
  return `${uL.toFixed(2)} µL`;
}
