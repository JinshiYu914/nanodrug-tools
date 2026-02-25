"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Dna,
  Info,
  Check,
  AlertTriangle,
  RotateCcw,
  Plus,
  X,
  Copy,
  CheckCheck,
} from "lucide-react";
import Link from "next/link";
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
  type LipidEntry,
  type LipidMixConfig,
} from "@/lib/calculations/lnp-formula";
import LnpSavedPanel from "@/components/tools/lnp-saved-panel";
import LnpWorkflow from "@/components/tools/lnp-workflow";

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export default function LnpFormulaPage() {
  const nextCustomIdx = useRef(1);

  // ── Lipid entries (dynamic) ─────────────────────────────
  const [lipidEntries, setLipidEntries] = useState<LipidEntry[]>(
    createDefaultEntries
  );

  // ── Step 1 state ────────────────────────────────────────
  const [targetVolume, setTargetVolume] = useState("");
  const [volumeUnit, setVolumeUnit] = useState<"uL" | "mL">("uL");

  // ── Step 2 state ────────────────────────────────────────
  const [masterConc, setMasterConc] = useState("8");
  const [frrAqueous, setFrrAqueous] = useState("3");
  const [frrOrganic, setFrrOrganic] = useState("1");
  const [npRatio, setNpRatio] = useState("6");
  const [rnaMass, setRnaMass] = useState("");
  const [rnaConc, setRnaConc] = useState("");
  const [naType, setNaType] = useState<"mRNA" | "siRNA" | "pDNA">("mRNA");
  const [aminesPerMolecule, setAminesPerMolecule] = useState("1");
  const [copied, setCopied] = useState(false);

  // ── Entry management ────────────────────────────────────

  function updateEntry(
    id: string,
    field: keyof LipidEntry,
    value: string | boolean
  ) {
    setLipidEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  function handleLipidSelect(entry: LipidEntry, value: string) {
    if (value === "__custom__") {
      setLipidEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, isCustomLipid: true, lipidName: "", molarWeight: "" }
            : e
        )
      );
    } else {
      const mw = getLipidMW(entry.typeKey, value);
      setLipidEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? {
                ...e,
                isCustomLipid: false,
                lipidName: value,
                customLipidName: "",
                molarWeight: mw !== null ? String(mw) : e.molarWeight,
              }
            : e
        )
      );
    }
  }

  function addLipidEntry() {
    const existing = new Set(lipidEntries.map((e) => e.typeKey));
    const stdKeys = STANDARD_TYPES.map((t) => t.key);
    const missing = stdKeys.find((k) => !existing.has(k));

    if (missing) {
      const entry = createStandardEntry(missing);
      if (entry) setLipidEntries((prev) => [...prev, entry]);
    } else {
      const idx = nextCustomIdx.current++;
      setLipidEntries((prev) => [...prev, createCustomEntry(idx)]);
    }
  }

  function removeLipidEntry(id: string) {
    if (lipidEntries.length <= 2) return;
    setLipidEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // ── Derived values ──────────────────────────────────────

  const ratioSum = useMemo(
    () => lipidEntries.reduce((s, e) => s + num(e.molarRatio), 0),
    [lipidEntries]
  );

  const components = useMemo(
    () => entriesToComponents(lipidEntries),
    [lipidEntries]
  );

  const lipidMixConfig = useMemo(
    (): LipidMixConfig => ({
      components,
      targetVolume: num(targetVolume),
      volumeUnit,
    }),
    [components, targetVolume, volumeUnit]
  );

  const totalConc = useMemo(
    () => computeTotalConcentration(components),
    [components]
  );

  const stockVolumes = useMemo(
    () => computeStockVolumes(lipidMixConfig),
    [lipidMixConfig]
  );

  const step1Ready = stockVolumes !== null && totalConc !== null;

  const ionizableEntry = lipidEntries.find((e) => e.typeKey === "ionizable");
  const isIonizableCustom = ionizableEntry
    ? ionizableEntry.isCustomLipid ||
      !isKnownLipid("ionizable", ionizableEntry.lipidName)
    : true;
  const ionizableRatio = ionizableEntry ? num(ionizableEntry.molarRatio) : 0;

  const prepVolumes = useMemo(
    () =>
      computePreparationVolumes(totalConc, {
        masterConc_mM: num(masterConc),
        frrAqueous: num(frrAqueous),
        frrOrganic: num(frrOrganic),
        npRatio: num(npRatio),
        rnaMass_ug: num(rnaMass),
        rnaConc_ug_per_uL: num(rnaConc),
        aminesPerMolecule: isIonizableCustom ? num(aminesPerMolecule) : 1,
        ionizableRatio,
      }),
    [
      totalConc,
      masterConc,
      frrAqueous,
      frrOrganic,
      npRatio,
      rnaMass,
      rnaConc,
      aminesPerMolecule,
      ionizableRatio,
      isIonizableCustom,
    ]
  );

  const masterConcExceedsSource =
    totalConc !== null && num(masterConc) > 0 && num(masterConc) > totalConc.mM;

  // ── Save / Load ─────────────────────────────────────────

  const getFormulaData = useCallback(
    () => ({
      lipidEntries: lipidEntries.map((e) => ({ ...e })),
      targetVolume,
      volumeUnit,
    }),
    [lipidEntries, targetVolume, volumeUnit]
  );

  const loadFormulaData = useCallback((data: Record<string, unknown>) => {
    const d = data as {
      lipidEntries: LipidEntry[];
      targetVolume: string;
      volumeUnit: "uL" | "mL";
    };
    if (d.lipidEntries) setLipidEntries(d.lipidEntries);
    if (d.targetVolume !== undefined) setTargetVolume(d.targetVolume);
    if (d.volumeUnit) setVolumeUnit(d.volumeUnit);
  }, []);

  const getPrepData = useCallback(
    () => ({
      masterConc,
      frrAqueous,
      frrOrganic,
      npRatio,
      rnaMass,
      rnaConc,
      naType,
      aminesPerMolecule,
    }),
    [
      masterConc,
      frrAqueous,
      frrOrganic,
      npRatio,
      rnaMass,
      rnaConc,
      naType,
      aminesPerMolecule,
    ]
  );

  const loadPrepData = useCallback((data: Record<string, unknown>) => {
    const d = data as Record<string, string>;
    if (d.masterConc) setMasterConc(d.masterConc);
    if (d.frrAqueous) setFrrAqueous(d.frrAqueous);
    if (d.frrOrganic) setFrrOrganic(d.frrOrganic);
    if (d.npRatio) setNpRatio(d.npRatio);
    if (d.rnaMass !== undefined) setRnaMass(d.rnaMass);
    if (d.rnaConc !== undefined) setRnaConc(d.rnaConc);
    if (d.naType) setNaType(d.naType as "mRNA" | "siRNA" | "pDNA");
    if (d.aminesPerMolecule) setAminesPerMolecule(d.aminesPerMolecule);
  }, []);

  // ── Copy results ────────────────────────────────────────

  function copyResults() {
    const lines: string[] = ["=== LNP 配方计算结果 ===", ""];

    lines.push("【Lipid Mix 配方】");
    for (const entry of lipidEntries) {
      const name = entry.isCustomLipid
        ? entry.customLipidName || "Custom"
        : entry.lipidName;
      const vol = stockVolumes?.[entry.id];
      lines.push(
        `- ${entry.label}: ${name} (${entry.molarRatio}%) MW=${entry.molarWeight} g/mol, Stock=${entry.stockConc} mg/mL → ${vol ? formatVolume(vol.uL) : "--"}`
      );
    }

    lines.push(`\nLipid Mix 目标体积: ${targetVolume} ${volumeUnit === "uL" ? "µL" : "mL"}`);
    if (totalConc) {
      lines.push(
        `总浓度: ${totalConc.mM >= 1 ? `${totalConc.mM.toFixed(2)} mM` : `${totalConc.uM.toFixed(0)} µM`} (${totalConc.massConc_mg_per_mL.toFixed(2)} mg/mL)`
      );
    }

    lines.push("\n【制备参数】");
    lines.push(`Master Mix Conc: ${masterConc} mM`);
    lines.push(`FRR: ${frrAqueous}:${frrOrganic}`);
    lines.push(`N/P Ratio: ${npRatio}`);
    lines.push(`RNA: ${rnaMass} µg @ ${rnaConc} µg/µL (${naType})`);

    lines.push("\n【水相 Aqueous】");
    lines.push(`RNA: ${formatVolume(prepVolumes.rnaVolume_uL)}`);
    lines.push(`Citrate buffer: ${formatVolume(prepVolumes.cbBuffer_uL)}`);
    lines.push(`Total: ${formatVolume(prepVolumes.aqueousTotal_uL)}`);

    lines.push("\n【脂相 Organic】");
    lines.push(`Lipid mix: ${formatVolume(prepVolumes.lipidMix_uL)}`);
    lines.push(`Ethanol: ${formatVolume(prepVolumes.ethanol_uL)}`);
    lines.push(`Total: ${formatVolume(prepVolumes.organicTotal_uL)}`);

    if (
      prepVolumes.aqueousTotal_uL !== null &&
      prepVolumes.organicTotal_uL !== null
    ) {
      lines.push(
        `\n两相总体积: ${formatVolume(prepVolumes.aqueousTotal_uL + prepVolumes.organicTotal_uL)}`
      );
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Reset ───────────────────────────────────────────────

  function handleReset() {
    nextCustomIdx.current = 1;
    setLipidEntries(createDefaultEntries());
    setTargetVolume("");
    setVolumeUnit("uL");
    setMasterConc("8");
    setFrrAqueous("3");
    setFrrOrganic("1");
    setNpRatio("6");
    setRnaMass("");
    setRnaConc("");
    setNaType("mRNA");
    setAminesPerMolecule("1");
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      {/* Header */}
      <div className="mb-2">
        <Link
          href="/tools"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          &larr; 返回常用工具
        </Link>
      </div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Dna className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            LNP Calculator
          </h1>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          根据脂质配方快速计算实验体系。第一步：选择脂质配方并配置 Lipid
          Mix；第二步：输入制备参数（脂相浓度、FRR、N/P 比、RNA
          用量），自动计算水相和脂相各组分体积。
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className={`flex items-center gap-2 ${step1Ready ? "text-green-600 dark:text-green-400" : "text-primary"}`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step1Ready ? "bg-green-100 dark:bg-green-900/40" : "bg-primary/10"}`}
          >
            {step1Ready ? <Check className="h-4 w-4" /> : "1"}
          </div>
          <span className="text-sm font-medium">配置脂质混合物</span>
        </div>
        <div className="h-px flex-1 bg-border" />
        <div
          className={`flex items-center gap-2 ${step1Ready ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step1Ready ? "bg-primary/10" : "bg-muted"}`}
          >
            2
          </div>
          <span className="text-sm font-medium">定义制备参数</span>
        </div>
      </div>

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
              选择各脂质组分（支持 2–5+ 种），设置摩尔比和母液浓度，输入目标
              Lipid Mix 体积后自动计算吸取量。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Lipid grid */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {lipidEntries.map((entry) => (
                <LipidCard
                  key={entry.id}
                  entry={entry}
                  stockVolume={stockVolumes?.[entry.id]?.uL ?? null}
                  canRemove={lipidEntries.length > 2}
                  onSelect={(v) => handleLipidSelect(entry, v)}
                  onChange={(field, value) =>
                    updateEntry(entry.id, field, value)
                  }
                  onRemove={() => removeLipidEntry(entry.id)}
                />
              ))}

            </div>

            {/* Ratio sum validation */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                摩尔比总和（{lipidEntries.length} 种组分）：
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

            {/* Target volume */}
            <div className="space-y-1 max-w-sm">
              <Label className="text-sm font-medium">
                目标 Lipid Mix 体积
                <span
                  className="ml-1 text-muted-foreground cursor-help"
                  title="配置好的 lipid mix 可低温保存数天，根据需要配置合适体积"
                >
                  <Info className="inline h-3.5 w-3.5" />
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  value={targetVolume}
                  onChange={(e) => setTargetVolume(e.target.value)}
                  placeholder="输入体积"
                  className="flex-1"
                  onFocus={(e) => e.target.select()}
                />
                <select
                  value={volumeUnit}
                  onChange={(e) =>
                    setVolumeUnit(e.target.value as "uL" | "mL")
                  }
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="uL">µL</option>
                  <option value="mL">mL</option>
                </select>
              </div>
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

        {/* Saved formulas panel */}
        <div className="hidden lg:block">
          <LnpSavedPanel
            type="formula"
            title="我的配方"
            onLoad={loadFormulaData}
            getCurrentData={getFormulaData}
          />
        </div>
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
                    value={masterConc}
                    onChange={(e) => setMasterConc(e.target.value)}
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
                      value={frrAqueous}
                      onChange={(e) => setFrrAqueous(e.target.value)}
                      className="flex-1"
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="text-sm font-medium text-muted-foreground">
                      :
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={frrOrganic}
                      onChange={(e) => setFrrOrganic(e.target.value)}
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
                    value={npRatio}
                    onChange={(e) => setNpRatio(e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Nucleic Acid Type
                  </Label>
                  <select
                    value={naType}
                    onChange={(e) =>
                      setNaType(e.target.value as "mRNA" | "siRNA" | "pDNA")
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="mRNA">mRNA</option>
                    <option value="siRNA">siRNA</option>
                    <option value="pDNA">pDNA</option>
                  </select>
                </div>

                {isIonizableCustom && ionizableEntry && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      每分子可电离胺基数
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={aminesPerMolecule}
                      onChange={(e) => setAminesPerMolecule(e.target.value)}
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
                      value={rnaMass}
                      onChange={(e) => setRnaMass(e.target.value)}
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
                      value={rnaConc}
                      onChange={(e) => setRnaConc(e.target.value)}
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
                  {/* Aqueous phase card */}
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

                  {/* Organic phase card */}
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

                {/* Grand total + copy */}
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

            <Separator className="my-6" />
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                重置所有参数
              </Button>
              <Button
                variant="outline"
                onClick={copyResults}
                className="gap-2"
              >
                {copied ? (
                  <CheckCheck className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "已复制" : "复制计算结果"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Saved preparations panel */}
        <div className="hidden lg:block">
          <LnpSavedPanel
            type="preparation"
            title="我的实验参数"
            onLoad={loadPrepData}
            getCurrentData={getPrepData}
          />
        </div>
      </div>

      {/* Mobile save panels */}
      <div className="lg:hidden grid gap-4 sm:grid-cols-2 mb-8">
        <LnpSavedPanel
          type="formula"
          title="我的配方"
          onLoad={loadFormulaData}
          getCurrentData={getFormulaData}
        />
        <LnpSavedPanel
          type="preparation"
          title="我的实验参数"
          onLoad={loadPrepData}
          getCurrentData={getPrepData}
        />
      </div>

      {/* ═══ Workflow Diagram ══════════════════════════════ */}
      <Card>
        <CardContent className="pt-6">
          <LnpWorkflow />
        </CardContent>
      </Card>
    </div>
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
  const known = !entry.isCustomLipid && isKnownLipid(entry.typeKey, entry.lipidName);

  return (
    <div className="space-y-3 rounded-lg border p-4 relative group">
      {/* Header + remove */}
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

      {/* Lipid selector */}
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

      {/* Molar weight */}
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

      {/* Molar ratio */}
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

      {/* Stock concentration */}
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

      {/* Stock volume (result) */}
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

// ─── Utility ──────────────────────────────────────────────

function hasAnyPrepResult(v: {
  rnaVolume_uL: number | null;
  lipidMix_uL: number | null;
}): boolean {
  return v.rnaVolume_uL !== null || v.lipidMix_uL !== null;
}
