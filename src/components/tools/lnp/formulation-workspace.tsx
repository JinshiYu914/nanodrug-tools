"use client";

import { useMemo, useRef } from "react";
import { Info, Check, AlertTriangle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  STANDARD_TYPES,
  getDbOptions,
  getLipidMW,
  isKnownLipid,
  entriesToComponents,
  createDefaultEntries,
  createStandardEntry,
  createCustomEntry,
  computeStockVolumes,
  computeTotalConcentration,
  computePreparationVolumes,
  formatVolume,
  getAminesPerMolecule,
  type LipidEntry,
} from "@/lib/calculations/lnp-formula";
import type { BenchPrepParams } from "@/lib/calculations/lnp-bench";

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export interface WorkspaceValue {
  lipidEntries: LipidEntry[];
  targetVolume: string;
  volumeUnit: "uL" | "mL";
  prep: BenchPrepParams;
}

export function createDefaultWorkspaceValue(): WorkspaceValue {
  return {
    lipidEntries: createDefaultEntries(),
    targetVolume: "",
    volumeUnit: "uL",
    prep: {
      masterConc: "8",
      frrAqueous: "3",
      frrOrganic: "1",
      npRatio: "6",
      rnaMass: "",
      rnaConc: "",
      naType: "mRNA",
      aminesPerMolecule: "1",
    },
  };
}

interface Props {
  mode: "normal" | "screening";
  value: WorkspaceValue;
  onChange: (updater: (prev: WorkspaceValue) => WorkspaceValue) => void;
  /** Slot for action buttons below Step 2 (Copy/Reset in normal, Add-to-Bench in screening). */
  footerSlot?: React.ReactNode;
  /** Optional slot placed to the right of Step 1 card (e.g. saved-formula panel). */
  step1Aside?: React.ReactNode;
  /** Optional slot placed to the right of Step 2 card (e.g. saved-preparation panel). */
  step2Aside?: React.ReactNode;
  /** Formulation name input (screening mode only). */
  formulationName?: string;
  onFormulationNameChange?: (name: string) => void;
}

export default function FormulationWorkspace({
  mode,
  value,
  onChange,
  footerSlot,
  step1Aside,
  step2Aside,
  formulationName,
  onFormulationNameChange,
}: Props) {
  const nextCustomIdx = useRef(1);
  const isScreening = mode === "screening";

  // ── Entry management helpers ────────────────────────────

  function updateEntry(
    id: string,
    field: keyof LipidEntry,
    v: string | boolean
  ) {
    onChange((prev) => ({
      ...prev,
      lipidEntries: prev.lipidEntries.map((e) =>
        e.id === id ? { ...e, [field]: v } : e
      ),
    }));
  }

  function handleLipidSelect(entry: LipidEntry, next: string) {
    if (next === "__custom__") {
      onChange((prev) => ({
        ...prev,
        lipidEntries: prev.lipidEntries.map((e) =>
          e.id === entry.id
            ? { ...e, isCustomLipid: true, lipidName: "", molarWeight: "" }
            : e
        ),
      }));
    } else {
      const mw = getLipidMW(entry.typeKey, next);
      onChange((prev) => ({
        ...prev,
        lipidEntries: prev.lipidEntries.map((e) =>
          e.id === entry.id
            ? {
                ...e,
                isCustomLipid: false,
                lipidName: next,
                customLipidName: "",
                molarWeight: mw !== null ? String(mw) : e.molarWeight,
              }
            : e
        ),
      }));
    }
  }

  function addLipidEntry() {
    const existing = new Set(value.lipidEntries.map((e) => e.typeKey));
    const stdKeys = STANDARD_TYPES.map((t) => t.key);
    const missing = stdKeys.find((k) => !existing.has(k));
    if (missing) {
      const entry = createStandardEntry(missing);
      if (entry) {
        onChange((prev) => ({
          ...prev,
          lipidEntries: [...prev.lipidEntries, entry],
        }));
      }
    } else {
      const idx = nextCustomIdx.current++;
      const entry = createCustomEntry(idx);
      onChange((prev) => ({
        ...prev,
        lipidEntries: [...prev.lipidEntries, entry],
      }));
    }
  }

  function removeLipidEntry(id: string) {
    if (value.lipidEntries.length <= 2) return;
    onChange((prev) => ({
      ...prev,
      lipidEntries: prev.lipidEntries.filter((e) => e.id !== id),
    }));
  }

  const setPrep = (patch: Partial<BenchPrepParams>) =>
    onChange((prev) => ({ ...prev, prep: { ...prev.prep, ...patch } }));

  // ── Derived values ──────────────────────────────────────

  const ratioSum = useMemo(
    () => value.lipidEntries.reduce((s, e) => s + num(e.molarRatio), 0),
    [value.lipidEntries]
  );

  const components = useMemo(
    () => entriesToComponents(value.lipidEntries),
    [value.lipidEntries]
  );

  const totalConc = useMemo(
    () => computeTotalConcentration(components),
    [components]
  );

  const ionizableEntry = value.lipidEntries.find(
    (e) => e.typeKey === "ionizable"
  );
  const isIonizableCustom = ionizableEntry
    ? ionizableEntry.isCustomLipid ||
      !isKnownLipid("ionizable", ionizableEntry.lipidName)
    : true;
  const ionizableRatio = ionizableEntry ? num(ionizableEntry.molarRatio) : 0;

  const amines = isIonizableCustom
    ? num(value.prep.aminesPerMolecule)
    : ionizableEntry
    ? getAminesPerMolecule(ionizableEntry.lipidName)
    : 1;

  const prepVolumes = useMemo(
    () =>
      computePreparationVolumes(totalConc, {
        masterConc_mM: num(value.prep.masterConc),
        frrAqueous: num(value.prep.frrAqueous),
        frrOrganic: num(value.prep.frrOrganic),
        npRatio: num(value.prep.npRatio),
        rnaMass_ug: num(value.prep.rnaMass),
        rnaConc_ug_per_uL: num(value.prep.rnaConc),
        aminesPerMolecule: amines > 0 ? amines : 1,
        ionizableRatio,
      }),
    [totalConc, value.prep, amines, ionizableRatio]
  );

  // In screening mode, Step 1 target volume is auto-derived from Step 2.
  const effectiveTargetVolume_uL = isScreening
    ? prepVolumes.lipidMix_uL ?? 0
    : value.volumeUnit === "mL"
    ? num(value.targetVolume) * 1000
    : num(value.targetVolume);

  const stockVolumes = useMemo(
    () =>
      effectiveTargetVolume_uL > 0
        ? computeStockVolumes({
            components,
            targetVolume: effectiveTargetVolume_uL,
            volumeUnit: "uL",
          })
        : null,
    [components, effectiveTargetVolume_uL]
  );

  const masterConcExceedsSource =
    totalConc !== null &&
    num(value.prep.masterConc) > 0 &&
    num(value.prep.masterConc) > totalConc.mM;

  // ── Render ──────────────────────────────────────────────

  return (
    <>
      {/* ═══ Step 1 ═══════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-[1fr_260px] mb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>
                第一步：选择 LNP 配方，配置脂质混合物
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={addLipidEntry}
                className="gap-1.5 h-7 text-xs shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                添加组分
              </Button>
            </div>
            <CardDescription>
              {isScreening
                ? "选择各脂质组分（支持 2–5+ 种），设置摩尔比和母液浓度；Lipid Mix 体积由下方 RNA 用量自动推导，刚好够用。"
                : "选择各脂质组分（支持 2–5+ 种），设置摩尔比和母液浓度，输入目标 Lipid Mix 体积后自动计算吸取量。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isScreening && onFormulationNameChange && (
              <div className="space-y-1 max-w-md">
                <Label className="text-sm font-medium">
                  配方名称
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formulationName ?? ""}
                  onChange={(e) => onFormulationNameChange(e.target.value)}
                  placeholder="例如：SM-102 / 50:10:38.5:1.5"
                />
              </div>
            )}

            {/* Lipid grid */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {value.lipidEntries.map((entry) => (
                <LipidCard
                  key={entry.id}
                  entry={entry}
                  stockVolume={stockVolumes?.[entry.id]?.uL ?? null}
                  canRemove={value.lipidEntries.length > 2}
                  onSelect={(v) => handleLipidSelect(entry, v)}
                  onChange={(field, v) => updateEntry(entry.id, field, v)}
                  onRemove={() => removeLipidEntry(entry.id)}
                />
              ))}
            </div>

            {/* Ratio sum validation */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                摩尔比总和（{value.lipidEntries.length} 种组分）：
              </span>
              <span
                className={
                  Math.abs(ratioSum - 100) > 0.1
                    ? "text-destructive font-medium"
                    : "text-green-600 dark:text-green-400 font-medium"
                }
              >
                {ratioSum.toFixed(1)}%
              </span>
              {Math.abs(ratioSum - 100) > 0.1 && (
                <span className="flex items-center gap-1 text-destructive text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  摩尔比总和必须为 100%
                </span>
              )}
            </div>

            {/* Target volume (normal: editable · screening: derived) */}
            <div className="space-y-1 max-w-sm">
              <Label className="text-sm font-medium">
                {isScreening
                  ? "所需 Lipid Mix 体积（自动计算）"
                  : "目标 Lipid Mix 体积"}
                <span
                  className="ml-1 text-muted-foreground cursor-help"
                  title={
                    isScreening
                      ? "由下方 RNA 用量、N/P 比和可电离脂质比反推得到"
                      : "配置好的 lipid mix 可低温保存数天，根据需要配置合适体积"
                  }
                >
                  <Info className="inline h-3.5 w-3.5" />
                </span>
              </Label>

              {isScreening ? (
                <div className="flex h-9 items-center rounded-md bg-muted/50 px-3 text-sm font-mono">
                  {prepVolumes.lipidMix_uL !== null
                    ? formatVolume(prepVolumes.lipidMix_uL)
                    : "-- (先输入 RNA 用量)"}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={value.targetVolume}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        targetVolume: e.target.value,
                      }))
                    }
                    placeholder="输入体积"
                    className="flex-1"
                    onFocus={(e) => e.target.select()}
                  />
                  <select
                    value={value.volumeUnit}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        volumeUnit: e.target.value as "uL" | "mL",
                      }))
                    }
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="uL">µL</option>
                    <option value="mL">mL</option>
                  </select>
                </div>
              )}
            </div>

            {/* Total concentration & success */}
            {totalConc && (
              <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span>Lipid Mix 总浓度：</span>
                  <span className="font-mono font-semibold">
                    {totalConc.mM >= 1
                      ? `${totalConc.mM.toFixed(2)} mM`
                      : `${totalConc.uM.toFixed(0)} µM`}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    ({totalConc.massConc_mg_per_mL.toFixed(2)} mg/mL)
                  </span>
                </div>
                {stockVolumes && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    请按上方组分彻底恢复室温溶解，吸取对应体积配置脂质混合物，混合均匀后可立即使用或 -20℃短期保存。
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {step1Aside && <div className="hidden lg:block">{step1Aside}</div>}
      </div>

      {/* ═══ Step 2 ═══════════════════════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-[1fr_260px] mb-8">
        <Card>
          <CardHeader>
            <CardTitle>第二步：定义 LNP 制备参数</CardTitle>
            <CardDescription>
              设置脂相浓度、流速比 (FRR)、N/P 比和 RNA
              用量，自动计算水相和脂相各组分体积。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 lg:grid-cols-5">
              {/* ── Left: Parameters ── */}
              <div className="lg:col-span-2 space-y-5">
                <h3 className="text-sm font-semibold border-b pb-2">
                  制备参数
                </h3>

                <div className="space-y-1.5">
                  <Label
                    className="text-xs text-muted-foreground cursor-help"
                    title="手包或微流控制备时脂相终浓度，一般为 4–20 mM"
                  >
                    Lipid Master Mix Conc (mM)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={value.prep.masterConc}
                    onChange={(e) => setPrep({ masterConc: e.target.value })}
                    className={
                      masterConcExceedsSource ? "border-destructive" : ""
                    }
                    onFocus={(e) => e.target.select()}
                  />
                  {masterConcExceedsSource && (
                    <p className="text-xs text-destructive">
                      浓度不能超过 Lipid Mix 源浓度 (
                      {totalConc!.mM.toFixed(2)} mM)
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label
                    className="text-xs text-muted-foreground cursor-help"
                    title="经典 LNP 配方水相：脂相一般为 3:1"
                  >
                    FRR (aqueous : organic)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={value.prep.frrAqueous}
                      onChange={(e) =>
                        setPrep({ frrAqueous: e.target.value })
                      }
                      className="flex-1"
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="text-sm font-medium text-muted-foreground">
                      :
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={value.prep.frrOrganic}
                      onChange={(e) =>
                        setPrep({ frrOrganic: e.target.value })
                      }
                      className="flex-1"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    className="text-xs text-muted-foreground cursor-help"
                    title="N/P 比一般在 6–8，高 N/P 比包封率更好但毒性更大"
                  >
                    N/P Ratio
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={value.prep.npRatio}
                    onChange={(e) => setPrep({ npRatio: e.target.value })}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {isIonizableCustom && ionizableEntry && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      每分子可电离胺基数
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={value.prep.aminesPerMolecule}
                      onChange={(e) =>
                        setPrep({ aminesPerMolecule: e.target.value })
                      }
                      placeholder="默认 1"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                )}

                {!ionizableEntry && (
                  <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    未添加可电离脂质，N/P 计算不可用
                  </div>
                )}
              </div>

              {/* ── Right: RNA inputs + volume results ── */}
              <div className="lg:col-span-3 space-y-5">
                <h3 className="text-sm font-semibold border-b pb-2">
                  RNA 用量与体系体积
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      className="text-xs text-muted-foreground cursor-help"
                      title="投入制备 LNP 的 RNA 总量"
                    >
                      RNA mass (µg)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={value.prep.rnaMass}
                      onChange={(e) => setPrep({ rnaMass: e.target.value })}
                      placeholder="输入 RNA 质量"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      className="text-xs text-muted-foreground cursor-help"
                      title="RNA 储存浓度（建议 1 µg/µL）"
                    >
                      RNA conc (µg/µL)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={value.prep.rnaConc}
                      onChange={(e) => setPrep({ rnaConc: e.target.value })}
                      placeholder="输入 RNA 浓度"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>

                {hasAnyPrepResult(prepVolumes) && (
                  <div className="rounded-md border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0" />
                    请按照以下体积配置水相和脂相。
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Aqueous */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <h4 className="text-sm font-semibold">水相 Aqueous</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          RNA volume
                        </span>
                        <span className="font-mono">
                          {formatVolume(prepVolumes.rnaVolume_uL)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Citrate buffer
                        </span>
                        <span className="font-mono">
                          {formatVolume(prepVolumes.cbBuffer_uL)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span className="font-mono">
                          {formatVolume(prepVolumes.aqueousTotal_uL)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Organic */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <h4 className="text-sm font-semibold">脂相 Organic</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Lipid mix
                        </span>
                        <span className="font-mono">
                          {formatVolume(prepVolumes.lipidMix_uL)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ethanol</span>
                        <span className="font-mono">
                          {formatVolume(prepVolumes.ethanol_uL)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span className="font-mono">
                          {formatVolume(prepVolumes.organicTotal_uL)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {prepVolumes.aqueousTotal_uL !== null &&
                  prepVolumes.organicTotal_uL !== null && (
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            水相总量
                          </p>
                          <p className="text-lg font-bold font-mono">
                            {formatVolume(prepVolumes.aqueousTotal_uL)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            脂相总量
                          </p>
                          <p className="text-lg font-bold font-mono">
                            {formatVolume(prepVolumes.organicTotal_uL)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            两相总体积
                          </p>
                          <p className="text-lg font-bold font-mono">
                            {formatVolume(
                              prepVolumes.aqueousTotal_uL +
                                prepVolumes.organicTotal_uL
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {footerSlot && (
              <>
                <Separator className="my-6" />
                {footerSlot}
              </>
            )}
          </CardContent>
        </Card>

        {step2Aside && <div className="hidden lg:block">{step2Aside}</div>}
      </div>
    </>
  );
}

// ─── Lipid Card Sub-component ─────────────────────────────

function LipidCard({
  entry,
  stockVolume,
  canRemove,
  onSelect,
  onChange,
  onRemove,
}: {
  entry: LipidEntry;
  stockVolume: number | null;
  canRemove: boolean;
  onSelect: (value: string) => void;
  onChange: (field: keyof LipidEntry, value: string) => void;
  onRemove: () => void;
}) {
  const dbOptions = getDbOptions(entry.typeKey);
  const hasDb = dbOptions.length > 0;
  const known =
    !entry.isCustomLipid && isKnownLipid(entry.typeKey, entry.lipidName);

  return (
    <div className="space-y-3 rounded-lg border p-4 relative group">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-semibold truncate">{entry.label}</h3>
          {STANDARD_TYPES.find((t) => t.key === entry.typeKey)?.description && (
            <span
              className="text-muted-foreground cursor-help shrink-0"
              title={
                STANDARD_TYPES.find((t) => t.key === entry.typeKey)
                  ?.description ?? ""
              }
            >
              <Info className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
            title="移除此组分"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Lipid</Label>
        {hasDb && !entry.isCustomLipid ? (
          <select
            value={entry.lipidName}
            onChange={(e) => onSelect(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {dbOptions.map((name) => {
              const mw = getLipidMW(entry.typeKey, name);
              return (
                <option key={name} value={name}>
                  {name}
                  {mw ? ` (${mw})` : ""}
                </option>
              );
            })}
            <option value="__custom__">自定义...</option>
          </select>
        ) : (
          <div className="relative">
            <Input
              value={entry.customLipidName}
              onChange={(e) => onChange("customLipidName", e.target.value)}
              placeholder="输入脂质名称"
              className="pr-12"
              autoFocus={hasDb}
            />
            {hasDb && (
              <button
                type="button"
                onClick={() => onSelect(dbOptions[0])}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-primary"
              >
                选择 ▾
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">MW (g/mol)</Label>
        <Input
          type="number"
          step="0.01"
          value={entry.molarWeight}
          onChange={(e) => onChange("molarWeight", e.target.value)}
          disabled={known}
          placeholder={known ? "自动填充" : "输入分子量"}
          onFocus={(e) => e.target.select()}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Molar ratio (%)
        </Label>
        <Input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={entry.molarRatio}
          onChange={(e) => onChange("molarRatio", e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Stock conc (mg/mL)
        </Label>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={entry.stockConc}
          onChange={(e) => onChange("stockConc", e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          吸取 stock 体积
        </Label>
        <div className="flex h-9 items-center rounded-md bg-muted/50 px-3 text-sm font-mono">
          {stockVolume !== null ? formatVolume(stockVolume) : "--"}
        </div>
      </div>
    </div>
  );
}

function hasAnyPrepResult(v: {
  rnaVolume_uL: number | null;
  lipidMix_uL: number | null;
}): boolean {
  return v.rnaVolume_uL !== null || v.lipidMix_uL !== null;
}
