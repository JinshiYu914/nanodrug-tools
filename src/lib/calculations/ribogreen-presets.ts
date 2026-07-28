// ─── RiboGreen Standard Curve Presets ─────────────────────
//
// Each preset holds TWO curves measured on the same instrument:
//   triton → TE buffer (1% Triton), lyses the LNP  → 总浓度
//   te     → TE buffer alone, free RNA only        → 游离浓度
//
// Points are [读数 (fluorescence reading), 浓度 (ng/mL)].
// Source: /Users/yujinshi/Downloads/标曲/*.xlsx

export type InstrumentKey = "thermo" | "tecan" | "custom";
export type PresetKey = Exclude<InstrumentKey, "custom">;

export interface InstrumentPreset {
  key: PresetKey;
  label: string;
  /** Acquisition settings, shown under the label. */
  meta: string;
  triton: readonly (readonly [number, number])[];
  te: readonly (readonly [number, number])[];
}

export const RIBOGREEN_PRESETS: Record<PresetKey, InstrumentPreset> = {
  thermo: {
    key: "thermo",
    label: "Thermo Fisher 酶标仪",
    meta: "ex/em = 480/520",
    triton: [
      [0.164, 1],
      [0.4707, 5],
      [2.2322, 25],
      [4.7582, 50],
      [9.1152, 100],
      [21.8832, 250],
    ],
    te: [
      [0.1022, 1],
      [0.3928, 5],
      [2.4914, 25],
      [5.5064, 50],
      [11.6384, 100],
      [27.8684, 250],
    ],
  },
  tecan: {
    key: "tecan",
    label: "Tecan 酶标仪",
    meta: "ex/em = 480/520, Gain = 80",
    // The two Tecan curves are intentionally identical — confirmed by the
    // user as expected for this instrument. They are written out twice (not
    // aliased) so that editing one never mutates the other.
    triton: [
      [17, 1],
      [99, 5],
      [700, 25],
      [1678, 50],
      [2185, 100],
      [5520, 250],
    ],
    te: [
      [17, 1],
      [99, 5],
      [700, 25],
      [1678, 50],
      [2185, 100],
      [5520, 250],
    ],
  },
};

export const INSTRUMENT_OPTIONS: {
  key: InstrumentKey;
  label: string;
  meta: string;
}[] = [
  {
    key: "thermo",
    label: RIBOGREEN_PRESETS.thermo.label,
    meta: RIBOGREEN_PRESETS.thermo.meta,
  },
  {
    key: "tecan",
    label: RIBOGREEN_PRESETS.tecan.label,
    meta: RIBOGREEN_PRESETS.tecan.meta,
  },
  { key: "custom", label: "自定义曲线", meta: "手动输入标准点" },
];
