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
  /** What was recorded. Free text — may or may not be one of `options`.
   *  When `multi`, several answers joined by MULTI_SEP. */
  value: string;
  /** Chips offered: preset options ∪ values the user promoted. */
  options: string[];
  /** true = user-created. Renamable and deletable; presets are neither. */
  custom: boolean;
  /** Chips toggle instead of replacing — 检测指标 is genuinely several answers. */
  multi: boolean;
  placeholder?: string;
}

export interface ParamPreset {
  id: string;
  label: string;
  options: string[];
  multi?: boolean;
  placeholder?: string;
}

/**
 * Separator for a multi-valued entry.
 *
 * A single string rather than an array because every reader — describeParams,
 * the compare table, both exporters — already treats `value` as the thing to
 * print, and none of the preset options contain it.
 */
export const MULTI_SEP = "、";

export function splitMulti(value: string): string[] {
  return value
    .split(MULTI_SEP)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function joinMulti(values: string[]): string {
  return values.filter(Boolean).join(MULTI_SEP);
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

/**
 * The whole 体外实验设计 card — there is no second set of typed fields beside
 * it. Module 4 previously had both, which meant 细胞系 was asked twice and the
 * two answers could disagree; the pickable version won because it is the one
 * that can grow a new cell line without a deploy.
 */
export const INVITRO_PARAM_PRESETS: ParamPreset[] = [
  {
    id: "cellLine",
    label: "细胞系",
    options: ["人 T cell", "小鼠 T cell", "Hep3B", "HEK293T", "RAW264.7", "DC2.4"],
    placeholder: "其他细胞系",
  },
  {
    id: "passage",
    label: "代数",
    options: [],
    placeholder: "例如 A1P1",
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
    options: ["Luciferase", "荧光蛋白流式", "Cell Titer", "CCK-8", "共聚焦"],
    multi: true,
    placeholder: "其他指标",
  },
  {
    id: "dose",
    label: "剂量",
    options: ["20 ng", "50 ng", "100 ng", "200 ng", "500 ng"],
    placeholder: "其他剂量",
  },
  {
    id: "timepoint",
    label: "检测时间",
    options: ["12 h", "16 h", "24 h", "48 h"],
    placeholder: "其他时间",
  },
];

export const INVIVO_PARAM_PRESETS: ParamPreset[] = [
  {
    id: "species",
    label: "动物",
    options: ["小鼠", "大鼠", "兔"],
    placeholder: "其他动物",
  },
  {
    id: "strain",
    label: "品系",
    options: ["BALB/c", "C57BL/6", "NSG", "SD", "ICR", "裸鼠"],
    placeholder: "其他品系",
  },
  {
    id: "age",
    label: "周龄",
    options: ["4 周", "6 周", "8 周", "10 周"],
    placeholder: "其他周龄",
  },
  {
    id: "sex",
    label: "性别",
    options: ["雌", "雄"],
    placeholder: "其他",
  },
  {
    id: "replicates",
    label: "生物学重复",
    options: ["1", "2", "3"],
    placeholder: "其他数量",
  },
  {
    id: "route",
    label: "给药途径",
    options: ["尾静脉 (i.v.)", "腹腔 (i.p.)", "肌肉 (i.m.)", "皮下 (s.c.)", "雾化"],
    placeholder: "其他途径",
  },
  {
    id: "dose",
    label: "剂量",
    options: ["1 µg", "2.5 µg", "5 µg", "10 µg"],
    placeholder: "其他剂量",
  },
  {
    id: "timepoint",
    label: "检测时间点",
    options: ["4 h", "5 h", "6 h", "8 h", "12 h", "24 h"],
    placeholder: "其他时间",
  },
  {
    id: "invivoReadout",
    label: "检测指标",
    options: ["活体成像", "离体成像", "器官荧光分布", "血清 ELISA", "组织 qPCR"],
    multi: true,
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
    multi: p.multi === true,
    ...(p.placeholder ? { placeholder: p.placeholder } : {}),
  }));
}

export function createCustomParam(label: string, value = ""): ParamEntry {
  return {
    id: genId(),
    label: label.trim() || "自定义参数",
    value,
    options: [],
    custom: true,
    multi: false,
    placeholder: "输入取值",
  };
}

/**
 * Write a value into an entry by preset id, creating nothing and overwriting
 * nothing that already has an answer.
 *
 * Used by the v2 → v3 migration, where module 4's typed fields (cellLine,
 * plate, dose, …) fold into the parameter bench that replaced them.
 */
export function seedParamValue(
  entries: ParamEntry[],
  id: string,
  value: string
): ParamEntry[] {
  const v = value.trim();
  if (!v) return entries;
  let seeded = false;
  const out = entries.map((e) => {
    if (e.id !== id || e.value.trim() !== "") return e;
    seeded = true;
    return {
      ...e,
      value: v,
      // Keep it pickable next time, exactly as 存为选项 would have.
      options: e.options.includes(v) ? e.options : [...e.options, v],
    };
  });
  return seeded ? out : entries;
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
      // a snapshot of an older wording, not a user decision. `multi` likewise:
      // it is structural, decided by the preset bank, not by the saved blob.
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
      multi: s.multi === true,
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
