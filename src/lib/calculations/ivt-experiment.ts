import { genId, todayISO } from "./ribogreen";

export const IVT_SCHEMA_VERSION = 3;

export const RNA_TYPE_OPTIONS = [
  "luciferase",
  "GFP",
  "mBaojin",
  "mCherry",
  "mScarlet",
  "Cre",
];

export const RNA_VECTOR_OPTIONS = [
  "V1 (α珠蛋白)",
  "V2 (BNT-162b2)",
  "V3 (mRNA-1273)",
];

export const RESTRICTION_SITE_OPTIONS = ["HindIII", "SapI (BsmBI)"];
export const ENZYME_BRAND_OPTIONS = ["NEB", "翌圣"];
export const IVT_VOLUME_OPTIONS = ["20", "40", "60", "80", "100"];
export const IVT_KIT_BRAND_OPTIONS = ["诺唯赞", "翌圣", "近岸蛋白"];
export const RNA_MODIFICATION_OPTIONS = [
  "未修饰",
  "N1-甲基假尿苷 (m1Ψ)",
  "假尿苷 (Ψ)",
];
export const CAP_METHOD_OPTIONS = ["共转录加帽", "酶促加帽"];
export const PURIFICATION_METHOD_OPTIONS = [
  "clean beads",
  "LiCl沉淀",
  "乙醇沉淀",
  "HPLC法",
];
export const RNA_CONCENTRATION_OPTIONS = ["0.5", "1", "2"];

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export type IvtTemplateKind = "linearization" | "ivt" | "purification";

export interface DigestionComponent {
  id: string;
  name: string;
  stockConcentration: string;
  amount: string;
  unit: string;
  fillTo: boolean;
  note: string;
}

export interface DigestionSystemSnapshot {
  templateId: string;
  templateName: string;
  reactionCount: string;
  components: DigestionComponent[];
  capturedAt: string;
}

export interface IvtReactionSystem {
  reactionCount: string;
  components: DigestionComponent[];
}

export interface LinearizationMethod {
  restrictionSite: string;
  enzymeBrand: string;
  temperatureC: string;
  durationH: string;
  totalVolumeUl: string;
  digestionSystem: DigestionSystemSnapshot | null;
  recoveryKitBrand: string;
  note: string;
}

export interface IvtMethod {
  reactionVolumeUl: string;
  reactionSystem: IvtReactionSystem;
  kitBrand: string;
  modification: string;
  cap: string;
  note: string;
}

export interface PurificationMethod {
  method: string;
  kitBrand: string;
  note: string;
}

export type IvtTemplatePayload =
  | { kind: "linearization"; method: LinearizationMethod }
  | { kind: "ivt"; method: IvtMethod }
  | { kind: "purification"; method: PurificationMethod };

export interface IvtRnaRecord {
  id: string;
  /** Date + two-digit sequence, for example 81201. */
  name: string;
  rnaType: string;
  vector: string;
  linearization: LinearizationMethod & {
    dnaConcentrationNgUl: string;
    dnaMassUg: string;
    recoveryYieldPercent: string;
  };
  ivt: IvtMethod;
  purification: PurificationMethod & {
    concentrationUgUl: string;
    finalVolumeUl: string;
  };
  expressionValidation: string;
  createdAt: string;
}

export interface IvtBatchData {
  schemaVersion: 3;
  meta: {
    batchCode: string;
    date: string;
    operator: string;
    objective: string;
    note: string;
  };
  rnas: IvtRnaRecord[];
}

export interface IvtBatchRow {
  id: string;
  name: string;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RnaLibraryEntry {
  id: string;
  batchId: string;
  batchName: string;
  batchCode: string;
  batchDate: string;
  rna: IvtRnaRecord;
  totalMassUg: number | null;
  status: "recording" | "ready" | "validated";
  updatedAt: string;
}

export function createSampleNumber(index = 0, date = new Date()): string {
  return `${date.getMonth() + 1}${String(date.getDate()).padStart(2, "0")}${String(index + 1).padStart(2, "0")}`;
}

export function createDigestionComponent(index = 0): DigestionComponent {
  return {
    id: genId(),
    name: index === 0 ? "质粒 DNA" : "",
    stockConcentration: "",
    amount: "",
    unit: "µL",
    fillTo: false,
    note: "",
  };
}

function component(
  name: string,
  stockConcentration = "",
  amount = "",
  unit = "µL",
  fillTo = false,
  note = ""
): DigestionComponent {
  return { id: genId(), name, stockConcentration, amount, unit, fillTo, note };
}

export function createLinearizationComponents(): DigestionComponent[] {
  return [
    component("质粒 DNA"),
    component("10× 酶切 buffer", "10×", "5"),
    component("酶", "", "1"),
    component("水", "", "50", "µL", true),
  ];
}

export function createIvtReactionSystem(
  reactionVolumeUl = "20"
): IvtReactionSystem {
  const scale = (Number.parseFloat(reactionVolumeUl) || 20) / 20;
  const amount = (value: number) => formatScaled(value * scale);
  return {
    reactionCount: "1",
    components: [
      component("A", "", amount(2)),
      component("U", "", amount(2)),
      component("G", "", amount(2)),
      component("C", "", amount(2)),
      component("Cap", "", amount(2)),
      component("Buffer", "", amount(2)),
      component("T7 Enzyme", "", amount(2)),
      component("线性化模板 DNA", "", amount(1), "µg", false, "最后加入"),
      component("水", "", reactionVolumeUl || "20", "µL", true),
    ],
  };
}

function copyComponents(components: DigestionComponent[]): DigestionComponent[] {
  return components.map((component) => ({ ...component, id: genId() }));
}

export function emptyDigestionSystem(): DigestionSystemSnapshot {
  return {
    templateId: "",
    templateName: "",
    reactionCount: "1",
    components: createLinearizationComponents(),
    capturedAt: "",
  };
}

function formatScaled(value: number): string {
  return String(Math.round(value * 10_000) / 10_000);
}

export function scaledComponentAmount(
  amount: string,
  reactionCount: string
): string {
  const one = Number.parseFloat(amount);
  const count = Number.parseFloat(reactionCount);
  if (!Number.isFinite(one) || !Number.isFinite(count) || count <= 0) return "";
  return formatScaled(one * count);
}

export function linearizationDnaVolumeUl(
  concentrationNgUl: string,
  massUg: string
): number | null {
  const concentration = Number.parseFloat(concentrationNgUl);
  const mass = Number.parseFloat(massUg);
  if (!(concentration > 0) || !(mass > 0)) return null;
  return (mass * 1000) / concentration;
}

export function linearizationOneXAmount(
  component: DigestionComponent,
  system: DigestionSystemSnapshot,
  concentrationNgUl: string,
  massUg: string,
  totalVolumeUl: string
): number | null {
  const dnaVolume = linearizationDnaVolumeUl(concentrationNgUl, massUg);
  if (component.name === "质粒 DNA") return dnaVolume;
  if (component.fillTo) {
    const total = Number.parseFloat(totalVolumeUl);
    if (!(total > 0) || dnaVolume === null) return null;
    const otherVolume = system.components
      .filter(
        (item) =>
          item.id !== component.id && item.name !== "质粒 DNA" && !item.fillTo
      )
      .reduce((sum, item) => {
        if (item.unit !== "µL") return sum;
        const amount = Number.parseFloat(item.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    return Math.max(0, total - dnaVolume - otherVolume);
  }
  const amount = Number.parseFloat(component.amount);
  return Number.isFinite(amount) ? amount : null;
}

export function formatReactionAmount(value: number | null): string {
  return value === null ? "" : formatScaled(value);
}

export function resizeIvtReactionSystem(
  system: IvtReactionSystem,
  fromVolumeUl: string,
  toVolumeUl: string
): IvtReactionSystem {
  const from = Number.parseFloat(fromVolumeUl);
  const to = Number.parseFloat(toVolumeUl);
  if (!(from > 0) || !(to > 0)) return createIvtReactionSystem(toVolumeUl);
  const ratio = to / from;
  return {
    ...system,
    components: system.components.map((item) => {
      const value = Number.parseFloat(item.amount);
      return {
        ...item,
        amount: Number.isFinite(value) ? formatScaled(value * ratio) : item.amount,
      };
    }),
  };
}

export function emptyIvtRna(
  seed?: IvtRnaRecord | null,
  sampleIndex = 0
): IvtRnaRecord {
  return {
    id: genId(),
    name: createSampleNumber(sampleIndex),
    rnaType: "",
    vector: "",
    linearization: {
      restrictionSite: seed?.linearization.restrictionSite ?? "HindIII",
      enzymeBrand: seed?.linearization.enzymeBrand ?? "NEB",
      dnaConcentrationNgUl: "",
      dnaMassUg: "",
      temperatureC: seed?.linearization.temperatureC ?? "37",
      durationH: seed?.linearization.durationH ?? "2",
      totalVolumeUl: seed?.linearization.totalVolumeUl ?? "50",
      digestionSystem: seed?.linearization.digestionSystem
        ? {
            ...seed.linearization.digestionSystem,
            components: copyComponents(seed.linearization.digestionSystem.components),
            capturedAt: new Date().toISOString(),
          }
        : emptyDigestionSystem(),
      recoveryKitBrand: seed?.linearization.recoveryKitBrand ?? "",
      recoveryYieldPercent: "",
      note: seed?.linearization.note ?? "",
    },
    ivt: seed
      ? {
          ...seed.ivt,
          reactionSystem: {
            ...seed.ivt.reactionSystem,
            components: copyComponents(seed.ivt.reactionSystem.components),
          },
        }
      : {
          reactionVolumeUl: "20",
          reactionSystem: createIvtReactionSystem("20"),
          kitBrand: "",
          modification: "",
          cap: "共转录加帽",
          note: "",
        },
    purification: {
      method: seed?.purification.method ?? "",
      kitBrand: seed?.purification.kitBrand ?? "",
      concentrationUgUl: "1",
      finalVolumeUl: "",
      note: seed?.purification.note ?? "",
    },
    expressionValidation: "",
    createdAt: new Date().toISOString(),
  };
}

export function emptyIvtBatch(): IvtBatchData {
  return {
    schemaVersion: IVT_SCHEMA_VERSION,
    meta: {
      batchCode: "",
      date: todayISO(),
      operator: "",
      objective: "",
      note: "",
    },
    rnas: [emptyIvtRna(null, 0)],
  };
}

function parseComponent(raw: unknown): DigestionComponent {
  const value = objectValue(raw);
  return {
    id: stringValue(value.id) || genId(),
    name: stringValue(value.name),
    stockConcentration: stringValue(value.stockConcentration),
    amount: stringValue(value.amount) || stringValue(value.volumeUl),
    unit: stringValue(value.unit, "µL"),
    fillTo:
      typeof value.fillTo === "boolean"
        ? value.fillTo
        : stringValue(value.name).trim() === "水" &&
          stringValue(value.note).toLowerCase().includes("to"),
    note: stringValue(value.note),
  };
}

function parseDigestionSystem(raw: unknown): DigestionSystemSnapshot {
  const value = objectValue(raw);
  const components = Array.isArray(value.components)
    ? value.components.map(parseComponent)
    : [];
  return {
    templateId: stringValue(value.templateId) || stringValue(value.presetId),
    templateName:
      stringValue(value.templateName) || stringValue(value.presetName),
    reactionCount: stringValue(value.reactionCount, "1"),
    components:
      components.length > 0 ? components : createLinearizationComponents(),
    capturedAt: stringValue(value.capturedAt),
  };
}

function parseIvtReactionSystem(
  raw: unknown,
  reactionVolumeUl: string
): IvtReactionSystem {
  const value = objectValue(raw);
  const components = Array.isArray(value.components)
    ? value.components.map(parseComponent)
    : [];
  return {
    reactionCount: stringValue(value.reactionCount, "1"),
    components:
      components.length > 0
        ? components
        : createIvtReactionSystem(reactionVolumeUl).components,
  };
}

export function parseIvtTemplatePayload(
  raw: unknown
): IvtTemplatePayload | null {
  const value = objectValue(raw);
  const methodRaw = value.method;
  if (!methodRaw || typeof methodRaw !== "object" || Array.isArray(methodRaw)) {
    return null;
  }
  const method = objectValue(methodRaw);
  if (value.kind === "linearization") {
    return {
      kind: "linearization",
      method: {
        restrictionSite: stringValue(method.restrictionSite, "HindIII"),
        enzymeBrand: stringValue(method.enzymeBrand, "NEB"),
        temperatureC: stringValue(method.temperatureC, "37"),
        durationH: stringValue(method.durationH, "2"),
        totalVolumeUl: stringValue(method.totalVolumeUl, "50"),
        digestionSystem:
          method.digestionSystem == null
            ? null
            : parseDigestionSystem(method.digestionSystem),
        recoveryKitBrand: stringValue(method.recoveryKitBrand),
        note: stringValue(method.note),
      },
    };
  }
  if (value.kind === "ivt") {
    const reactionVolumeUl = stringValue(method.reactionVolumeUl, "20");
    return {
      kind: "ivt",
      method: {
        reactionVolumeUl,
        reactionSystem: parseIvtReactionSystem(
          method.reactionSystem,
          reactionVolumeUl
        ),
        kitBrand: stringValue(method.kitBrand),
        modification: stringValue(method.modification),
        cap: stringValue(method.cap, "共转录加帽"),
        note: stringValue(method.note),
      },
    };
  }
  if (value.kind === "purification") {
    return {
      kind: "purification",
      method: {
        method: stringValue(method.method),
        kitBrand: stringValue(method.kitBrand),
        note: stringValue(method.note),
      },
    };
  }
  return null;
}

function legacyValidationText(value: Record<string, unknown>): string {
  if (typeof value.expressionValidation === "string") {
    return value.expressionValidation;
  }
  if (!Array.isArray(value.validations)) return "";
  return value.validations
    .map((raw) => {
      const row = objectValue(raw);
      return [
        stringValue(row.date),
        stringValue(row.model),
        stringValue(row.method),
        stringValue(row.metric),
        [stringValue(row.value), stringValue(row.unit)].filter(Boolean).join(" "),
        stringValue(row.conclusion),
        stringValue(row.note),
      ]
        .filter(Boolean)
        .join(" · ");
    })
    .filter(Boolean)
    .join("\n");
}

function parseRna(raw: unknown, index: number): IvtRnaRecord {
  const value = objectValue(raw);
  const linearization = objectValue(value.linearization);
  const ivt = objectValue(value.ivt);
  const purification = objectValue(value.purification);
  return {
    id: stringValue(value.id) || genId(),
    name: stringValue(value.name, createSampleNumber(index)),
    rnaType: stringValue(value.rnaType),
    vector: stringValue(value.vector),
    linearization: {
      restrictionSite: stringValue(linearization.restrictionSite, "HindIII"),
      enzymeBrand: stringValue(linearization.enzymeBrand, "NEB"),
      dnaConcentrationNgUl: stringValue(linearization.dnaConcentrationNgUl),
      dnaMassUg: stringValue(linearization.dnaMassUg),
      temperatureC: stringValue(linearization.temperatureC, "37"),
      durationH: stringValue(linearization.durationH, "2"),
      totalVolumeUl: stringValue(linearization.totalVolumeUl, "50"),
      digestionSystem: parseDigestionSystem(linearization.digestionSystem),
      recoveryKitBrand: stringValue(linearization.recoveryKitBrand),
      recoveryYieldPercent: stringValue(linearization.recoveryYieldPercent),
      note: stringValue(linearization.note),
    },
    ivt: {
      reactionVolumeUl: stringValue(ivt.reactionVolumeUl, "20"),
      reactionSystem: parseIvtReactionSystem(
        ivt.reactionSystem,
        stringValue(ivt.reactionVolumeUl, "20")
      ),
      kitBrand: stringValue(ivt.kitBrand),
      modification: stringValue(ivt.modification),
      cap: stringValue(ivt.cap, "共转录加帽"),
      note: stringValue(ivt.note),
    },
    purification: {
      method: stringValue(purification.method),
      kitBrand: stringValue(purification.kitBrand),
      concentrationUgUl: stringValue(purification.concentrationUgUl, "1"),
      finalVolumeUl: stringValue(purification.finalVolumeUl),
      note: stringValue(purification.note),
    },
    expressionValidation: legacyValidationText(value),
    createdAt: stringValue(value.createdAt, new Date().toISOString()),
  };
}

export function parseIvtBatch(raw: unknown): IvtBatchData {
  const value = objectValue(raw);
  const meta = objectValue(value.meta);
  return {
    schemaVersion: IVT_SCHEMA_VERSION,
    meta: {
      batchCode: stringValue(meta.batchCode),
      date: stringValue(meta.date, todayISO()),
      operator: stringValue(meta.operator),
      objective: stringValue(meta.objective),
      note: stringValue(meta.note),
    },
    rnas: Array.isArray(value.rnas)
      ? value.rnas.map((rna, index) => parseRna(rna, index))
      : [],
  };
}

export function serializeIvtBatch(data: IvtBatchData): Record<string, unknown> {
  return data as unknown as Record<string, unknown>;
}

export function rnaTotalMassUg(rna: IvtRnaRecord): number | null {
  const concentration = Number.parseFloat(rna.purification.concentrationUgUl);
  const volume = Number.parseFloat(rna.purification.finalVolumeUl);
  if (!(concentration > 0) || !(volume > 0)) return null;
  return concentration * volume;
}

export function rnaLibraryStatus(
  rna: IvtRnaRecord
): RnaLibraryEntry["status"] {
  if (rnaTotalMassUg(rna) === null) return "recording";
  return rna.expressionValidation.trim() ? "validated" : "ready";
}

export function flattenRnaLibrary(rows: IvtBatchRow[]): RnaLibraryEntry[] {
  return rows
    .flatMap((row) => {
      const batch = parseIvtBatch(row.data);
      return batch.rnas.map((rna) => ({
        id: `${row.id}:${rna.id}`,
        batchId: row.id,
        batchName: row.name,
        batchCode: batch.meta.batchCode,
        batchDate: batch.meta.date || row.created_at.slice(0, 10),
        rna,
        totalMassUg: rnaTotalMassUg(rna),
        status: rnaLibraryStatus(rna),
        updatedAt: row.updated_at,
      }));
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function copyRnaMethod(
  source: IvtRnaRecord,
  target: IvtRnaRecord
): IvtRnaRecord {
  return {
    ...target,
    linearization: {
      ...target.linearization,
      restrictionSite: source.linearization.restrictionSite,
      enzymeBrand: source.linearization.enzymeBrand,
      temperatureC: source.linearization.temperatureC,
      durationH: source.linearization.durationH,
      totalVolumeUl: source.linearization.totalVolumeUl,
      digestionSystem: source.linearization.digestionSystem
        ? {
            ...source.linearization.digestionSystem,
            components: copyComponents(source.linearization.digestionSystem.components),
            capturedAt: new Date().toISOString(),
          }
        : null,
      recoveryKitBrand: source.linearization.recoveryKitBrand,
      note: source.linearization.note,
    },
    ivt: {
      ...source.ivt,
      reactionSystem: {
        ...source.ivt.reactionSystem,
        components: copyComponents(source.ivt.reactionSystem.components),
      },
    },
    purification: {
      ...target.purification,
      method: source.purification.method,
      kitBrand: source.purification.kitBrand,
      note: source.purification.note,
    },
  };
}

export function linearizationTemplateFromRna(
  rna: IvtRnaRecord
): IvtTemplatePayload {
  return {
    kind: "linearization",
    method: {
      restrictionSite: rna.linearization.restrictionSite,
      enzymeBrand: rna.linearization.enzymeBrand,
      temperatureC: rna.linearization.temperatureC,
      durationH: rna.linearization.durationH,
      totalVolumeUl: rna.linearization.totalVolumeUl,
      digestionSystem: rna.linearization.digestionSystem
        ? {
            ...rna.linearization.digestionSystem,
            components: copyComponents(rna.linearization.digestionSystem.components),
          }
        : null,
      recoveryKitBrand: rna.linearization.recoveryKitBrand,
      note: rna.linearization.note,
    },
  };
}

export function ivtTemplateFromRna(rna: IvtRnaRecord): IvtTemplatePayload {
  return {
    kind: "ivt",
    method: {
      ...rna.ivt,
      reactionSystem: {
        ...rna.ivt.reactionSystem,
        components: copyComponents(rna.ivt.reactionSystem.components),
      },
    },
  };
}

export function purificationTemplateFromRna(
  rna: IvtRnaRecord
): IvtTemplatePayload {
  return {
    kind: "purification",
    method: {
      method: rna.purification.method,
      kitBrand: rna.purification.kitBrand,
      note: rna.purification.note,
    },
  };
}

export function applyTemplateToRna(
  rna: IvtRnaRecord,
  templateId: string,
  templateName: string,
  payload: IvtTemplatePayload
): IvtRnaRecord {
  if (payload.kind === "linearization") {
    return {
      ...rna,
      linearization: {
        ...rna.linearization,
        ...payload.method,
        digestionSystem: payload.method.digestionSystem
          ? {
              ...payload.method.digestionSystem,
              templateId,
              templateName,
              capturedAt: new Date().toISOString(),
              components: copyComponents(payload.method.digestionSystem.components),
            }
          : null,
      },
    };
  }
  if (payload.kind === "ivt") {
    return {
      ...rna,
      ivt: {
        ...payload.method,
        reactionSystem: {
          ...payload.method.reactionSystem,
          components: copyComponents(payload.method.reactionSystem.components),
        },
      },
    };
  }
  return {
    ...rna,
    purification: { ...rna.purification, ...payload.method },
  };
}
