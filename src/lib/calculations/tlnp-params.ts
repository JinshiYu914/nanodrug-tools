/**
 * Click-to-pick experiment parameters for the tLNP workbench.
 *
 * Every module records a handful of categorical facts — which cationic lipid,
 * which linker, which plate, which buffer — where the useful interaction is
 * "click the one you used, or type something we haven't seen before". This is
 * that primitive.
 *
 * The load-bearing rule: an entry persists its own `label` and `options`, it is
 * NOT a key into a code-side registry. A field the user invented last March has
 * to render correctly today, on a build that has never heard of it, and a
 * one-off value they typed once has to still be offered as a chip next time.
 * Storing only `{id, value}` would break both.
 */

import { LIPID_DATABASE } from "./lnp-formula";
import { MIXING_OPTIONS } from "./lnp-bench";
import { genId } from "./ribogreen";

export interface ParamEntry {
  /** A preset id ("cationicLipid") or a genId() for a user-added field. */
  id: string;
  label: string;
  /** What was recorded. Free text — may or may not be one of `options`. */
  value: string;
  /** Chips offered: preset options ∪ values the user promoted. */
  options: string[];
  /** true = user-created. Renamable and deletable; presets are neither. */
  custom: boolean;
  placeholder?: string;
}

export interface ParamPreset {
  id: string;
  label: string;
  options: string[];
  placeholder?: string;
}

// ─── Preset banks ─────────────────────────────────────────
//
// The cationic-lipid and mixing-method options are derived, not retyped, so the
// chips here can never drift from what the calculator's dropdowns offer.

export const PREP_PARAM_PRESETS: ParamPreset[] = [
  {
    id: "cationicLipid",
    label: "阳离子脂质",
    options: Object.keys(LIPID_DATABASE.ionizable),
    placeholder: "其他阳离子脂质",
  },
  {
    id: "linker",
    label: "反应 linker",
    options: ["DSPE-PEG2k-mal", "DSPE-PEG2k-DBCO", "DSPE-PEG2k-NHS", "无"],
    placeholder: "其他 linker",
  },
  {
    id: "cargo",
    label: "Cargo",
    options: ["mRNA", "siRNA", "pDNA", "Cy5-mRNA", "空载"],
    placeholder: "其他载物",
  },
  {
    id: "mixing",
    label: "制备方法",
    options: MIXING_OPTIONS.map((o) => o.label),
    placeholder: "其他制备方式",
  },
  {
    id: "operator",
    label: "制备人",
    options: [],
    placeholder: "姓名或缩写",
  },
];

export const PURIFICATION_PARAM_PRESETS: ParamPreset[] = [
  {
    id: "purifyBuffer",
    label: "洗脱 buffer",
    options: ["PBS pH 7.4", "PBS pH 6.8 with EDTA", "HEPES pH 7.4", "TBS"],
    placeholder: "自定义 buffer",
  },
  {
    id: "purifyOperator",
    label: "操作人",
    options: [],
    placeholder: "姓名或缩写",
  },
];

export const INVITRO_PARAM_PRESETS: ParamPreset[] = [
  {
    id: "cellLine",
    label: "细胞系",
    options: ["HeLa", "HEK293T", "A549", "RAW264.7", "DC2.4", "原代 T 细胞"],
    placeholder: "其他细胞系",
  },
  {
    id: "plate",
    label: "孔板",
    options: ["96 孔板", "48 孔板", "24 孔板", "12 孔板", "6 孔板"],
    placeholder: "其他规格",
  },
  {
    id: "readout",
    label: "检测指标",
    options: ["Luciferase", "eGFP 流式", "qPCR", "CCK-8", "共聚焦"],
    placeholder: "其他指标",
  },
];

export const INVIVO_PARAM_PRESETS: ParamPreset[] = [
  {
    id: "species",
    label: "动物",
    options: ["BALB/c 小鼠", "C57BL/6 小鼠", "NSG 小鼠", "SD 大鼠"],
    placeholder: "其他品系",
  },
  {
    id: "route",
    label: "给药途径",
    options: ["尾静脉 (i.v.)", "腹腔 (i.p.)", "肌肉 (i.m.)", "皮下 (s.c.)", "雾化"],
    placeholder: "其他途径",
  },
  {
    id: "invivoReadout",
    label: "检测指标",
    options: ["IVIS 活体成像", "器官分布", "血清 ELISA", "组织 qPCR", "体重/存活"],
    placeholder: "其他指标",
  },
];

// ─── Construction ─────────────────────────────────────────

export function createParamEntries(presets: ParamPreset[]): ParamEntry[] {
  return presets.map((p) => ({
    id: p.id,
    label: p.label,
    value: "",
    options: [...p.options],
    custom: false,
    ...(p.placeholder ? { placeholder: p.placeholder } : {}),
  }));
}

export function createCustomParam(label: string): ParamEntry {
  return {
    id: genId(),
    label: label.trim() || "自定义参数",
    value: "",
    options: [],
    custom: true,
    placeholder: "输入取值",
  };
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "" && !out.includes(v)) {
      out.push(v);
    }
  }
  return out;
}

/**
 * The one and only reader for stored parameter arrays.
 *
 * Starts from the presets so a preset added after this batch was saved shows
 * up; overlays the stored entry of the same id and unions its options so a
 * value the user promoted to a chip is never lost; appends every stored entry
 * with an unrecognised id as a custom field. Never throws — a garbage blob
 * degrades to a clean set of preset entries.
 */
export function mergeParamEntries(
  presets: ParamPreset[],
  raw: unknown
): ParamEntry[] {
  const base = createParamEntries(presets);
  if (!Array.isArray(raw)) return base;

  const stored = raw.filter(
    (r): r is Record<string, unknown> => !!r && typeof r === "object"
  );
  const seen = new Set<string>();

  const merged = base.map((entry) => {
    const hit = stored.find((s) => s.id === entry.id);
    if (!hit) return entry;
    seen.add(entry.id);
    return {
      ...entry,
      // A renamed preset in code wins over the stored label — the stored one is
      // a snapshot of an older wording, not a user decision.
      value: typeof hit.value === "string" ? hit.value : "",
      options: uniqueStrings([...entry.options, ...uniqueStrings(hit.options)]),
    };
  });

  for (const s of stored) {
    if (typeof s.id !== "string" || seen.has(s.id)) continue;
    if (presets.some((p) => p.id === s.id)) continue;
    merged.push({
      id: s.id,
      label: typeof s.label === "string" && s.label ? s.label : "自定义参数",
      value: typeof s.value === "string" ? s.value : "",
      options: uniqueStrings(s.options),
      custom: true,
      placeholder: typeof s.placeholder === "string" ? s.placeholder : "输入取值",
    });
  }

  return merged;
}

// ─── Reading ──────────────────────────────────────────────

export function paramValue(entries: ParamEntry[], id: string): string {
  return entries.find((e) => e.id === id)?.value?.trim() ?? "";
}

/** One-line summary for cards, the compare table and exports. */
export function describeParams(entries: ParamEntry[]): string {
  return entries
    .map((e) => e.value.trim())
    .filter(Boolean)
    .join(" · ");
}

/** Has the user actually recorded anything here? */
export function paramsFilled(entries: ParamEntry[]): boolean {
  return entries.some((e) => e.value.trim() !== "");
}
