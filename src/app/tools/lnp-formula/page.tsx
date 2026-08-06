"use client";

import { useCallback, useState } from "react";
import {
  Dna,
  RotateCcw,
  Copy,
  CheckCheck,
  FlaskConical,
  LogIn,
  FileText,
  TestTube2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LnpSavedPanel from "@/components/tools/lnp-saved-panel";
import LnpWorkflow from "@/components/tools/lnp-workflow";
import FormulationWorkspace, {
  createDefaultWorkspaceValue,
  type WorkspaceValue,
} from "@/components/tools/lnp/formulation-workspace";
import ScreeningMode from "@/components/tools/lnp/screening-mode";
import RibogreenMode from "@/components/tools/ribogreen/ribogreen-mode";
import {
  computeBenchFormulation,
  type BenchPrepParams,
} from "@/lib/calculations/lnp-bench";
import {
  computeStockVolumes,
  entriesToComponents,
  formatVolume,
  type LipidEntry,
} from "@/lib/calculations/lnp-formula";
import { useUser } from "@/lib/supabase/use-user";

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

type TabKey = "normal" | "screening" | "ribogreen";

export default function LnpFormulaPage() {
  // Controlled so the workflow diagram can be hidden on the RiboGreen tab.
  const [tab, setTab] = useState<TabKey>("normal");

  // ── Normal mode state (mirrors the old single-formulation page) ──
  const [normal, setNormal] = useState<WorkspaceValue>(
    createDefaultWorkspaceValue
  );
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Auth gating for screening mode ──
  const { user, loading: authLoading } = useUser();
  const authed: boolean | null = authLoading ? null : !!user;

  // ── Normal mode: save/load with LnpSavedPanel ──
  const getFormulaData = useCallback(
    () => ({
      lipidEntries: normal.lipidEntries.map((e) => ({ ...e })),
      targetVolume: normal.targetVolume,
      volumeUnit: normal.volumeUnit,
    }),
    [normal.lipidEntries, normal.targetVolume, normal.volumeUnit]
  );

  const loadFormulaData = useCallback((data: Record<string, unknown>) => {
    const d = data as {
      lipidEntries?: LipidEntry[];
      targetVolume?: string;
      volumeUnit?: "uL" | "mL";
    };
    setNormal((prev) => ({
      ...prev,
      lipidEntries: d.lipidEntries ?? prev.lipidEntries,
      targetVolume: d.targetVolume ?? prev.targetVolume,
      volumeUnit: d.volumeUnit ?? prev.volumeUnit,
    }));
  }, []);

  const getPrepData = useCallback(
    (): Record<string, unknown> => ({ ...normal.prep }),
    [normal.prep]
  );

  const loadPrepData = useCallback((data: Record<string, unknown>) => {
    const d = data as Partial<BenchPrepParams>;
    setNormal((prev) => ({
      ...prev,
      prep: {
        masterConc: d.masterConc ?? prev.prep.masterConc,
        frrAqueous: d.frrAqueous ?? prev.prep.frrAqueous,
        frrOrganic: d.frrOrganic ?? prev.prep.frrOrganic,
        npRatio: d.npRatio ?? prev.prep.npRatio,
        rnaMass: d.rnaMass ?? prev.prep.rnaMass,
        rnaConc: d.rnaConc ?? prev.prep.rnaConc,
        naType: d.naType ?? prev.prep.naType,
        aminesPerMolecule:
          d.aminesPerMolecule ?? prev.prep.aminesPerMolecule,
      },
    }));
  }, []);

  // ── Copy (normal mode) ──
  function copyResults() {
    const lines: string[] = ["=== LNP 配方计算结果 ===", ""];
    const { totalConc, prepVolumes } = computeBenchFormulation(
      {
        id: "local",
        name: "local",
        lipidEntries: normal.lipidEntries,
        prep: normal.prep,
        createdAt: new Date().toISOString(),
      },
      { extraLipidPhase_uL: normal.extraLipidPhase ? 100 : 0 }
    );

    // Step 1 stock volumes use the target Lipid Mix volume shown live in
    // Step 1: the derived "just enough" volume when the user opted into
    // RNA-based sizing, otherwise their manual entry.
    const targetVolume_uL = normal.autoLipidMixFromRna
      ? prepVolumes.lipidMix_uL ?? 0
      : normal.volumeUnit === "mL"
      ? num(normal.targetVolume) * 1000
      : num(normal.targetVolume);
    const stockVolumes =
      targetVolume_uL > 0
        ? computeStockVolumes({
            components: entriesToComponents(normal.lipidEntries),
            targetVolume: targetVolume_uL,
            volumeUnit: "uL",
          })
        : null;

    lines.push("【Lipid Mix 配方】");
    for (const entry of normal.lipidEntries) {
      const name = entry.isCustomLipid
        ? entry.customLipidName || "Custom"
        : entry.lipidName;
      const vol = stockVolumes?.[entry.id];
      lines.push(
        `- ${entry.label}: ${name} (${entry.molarRatio}%) MW=${entry.molarWeight} g/mol, Stock=${entry.stockConc} mg/mL → ${vol ? formatVolume(vol.uL) : "--"}`
      );
    }

    lines.push(
      `\nLipid Mix 目标体积: ${
        normal.autoLipidMixFromRna
          ? `${formatVolume(targetVolume_uL)}（按 RNA 制备量自动计算）`
          : `${normal.targetVolume} ${normal.volumeUnit === "uL" ? "µL" : "mL"}`
      }`
    );
    if (totalConc) {
      lines.push(
        `总浓度: ${totalConc.mM >= 1 ? `${totalConc.mM.toFixed(2)} mM` : `${totalConc.uM.toFixed(0)} µM`} (${totalConc.massConc_mg_per_mL.toFixed(2)} mg/mL)`
      );
    }

    lines.push("\n【制备参数】");
    lines.push(`Master Mix Conc: ${normal.prep.masterConc} mM`);
    lines.push(`FRR: ${normal.prep.frrAqueous}:${normal.prep.frrOrganic}`);
    lines.push(`N/P Ratio: ${normal.prep.npRatio}`);
    lines.push(
      `RNA: ${normal.prep.rnaMass} µg @ ${normal.prep.rnaConc} µg/µL (${normal.prep.naType})`
    );
    if (normal.extraLipidPhase) {
      lines.push("多配置脂相: 是（+100 µL，填充微流控死体积）");
    }

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
      prepVolumes.organicReactionTotal_uL !== null
    ) {
      lines.push(
        `\n脂相总量（反应体系）: ${formatVolume(prepVolumes.organicReactionTotal_uL)}`
      );
      lines.push(
        `两相总体积（反应体系）: ${formatVolume(prepVolumes.aqueousTotal_uL + prepVolumes.organicReactionTotal_uL)}`
      );
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Export to Word (normal mode) ──
  async function exportWord() {
    setExporting(true);
    const toastId = toast.loading("Word 生成中...");
    try {
      const mod = await import("@/lib/export/lnp-formula-docx");
      await mod.exportFormulationToDocx({
        lipidEntries: normal.lipidEntries,
        targetVolume: normal.targetVolume,
        volumeUnit: normal.volumeUnit,
        prep: normal.prep,
        autoLipidMixFromRna: normal.autoLipidMixFromRna,
        extraLipidPhase: normal.extraLipidPhase,
      });
      toast.success("Word 已导出", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("导出 Word 失败", { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  function handleReset() {
    setNormal(createDefaultWorkspaceValue());
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
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
          <h1 className="text-3xl font-bold tracking-tight">LNP Calculator</h1>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          根据脂质配方快速计算实验体系。第一步：选择脂质配方并配置 Lipid
          Mix；第二步：输入制备参数（脂相浓度、FRR、N/P 比、RNA
          用量），自动计算水相和脂相各组分体积。
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="space-y-6"
      >
        <TabsList className="flex h-auto w-fit gap-1 bg-transparent p-0">
          <TabsTrigger
            value="normal"
            className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
          >
            <Dna className="h-3.5 w-3.5" />
            单配方计算
          </TabsTrigger>
          <TabsTrigger
            value="screening"
            className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            配方筛选（批量）
          </TabsTrigger>
          <TabsTrigger
            value="ribogreen"
            className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
          >
            <TestTube2 className="h-3.5 w-3.5" />
            RiboGreen 包封率
          </TabsTrigger>
        </TabsList>

        {/* ═══ Normal Mode ═════════════════════════════════ */}
        <TabsContent value="normal" className="space-y-0">
          <FormulationWorkspace
            mode="normal"
            value={normal}
            onChange={(updater) => setNormal(updater)}
            step1Aside={
              <LnpSavedPanel
                type="formula"
                title="我的配方"
                onLoad={loadFormulaData}
                getCurrentData={getFormulaData}
              />
            }
            step2Aside={
              <LnpSavedPanel
                type="preparation"
                title="我的实验参数"
                onLoad={loadPrepData}
                getCurrentData={getPrepData}
              />
            }
            footerSlot={
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
                    <CheckCheck className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "已复制" : "复制计算结果"}
                </Button>
                <Button
                  variant="outline"
                  onClick={exportWord}
                  disabled={exporting}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {exporting ? "导出中..." : "导出 Word"}
                </Button>
              </div>
            }
          />

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
        </TabsContent>

        {/* ═══ Screening Mode ══════════════════════════════ */}
        <TabsContent value="screening" className="space-y-0">
          {authed === null ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                加载中...
              </CardContent>
            </Card>
          ) : !authed ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-primary" />
                  <CardTitle>配方筛选需要登录</CardTitle>
                </div>
                <CardDescription>
                  登录后可新建筛选实验台、保存配方组合，并导出 PDF / Excel。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/login">
                  <Button className="gap-2">
                    <LogIn className="h-4 w-4" />
                    前往登录
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <ScreeningMode />
          )}
        </TabsContent>

        {/* ═══ RiboGreen Mode ══════════════════════════════ */}
        {/* forceMount keeps the sample grid alive while the user bounces
            between tabs — Radix unmounts inactive TabsContent by default. */}
        <TabsContent value="ribogreen" className="space-y-0" forceMount>
          <div className={tab === "ribogreen" ? "" : "hidden"}>
            <RibogreenMode active={tab === "ribogreen"} />
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ Workflow Diagram (formulation tabs only) ═════ */}
      {tab !== "ribogreen" && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <LnpWorkflow />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
