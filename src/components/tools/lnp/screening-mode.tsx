"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlaskConical,
  Plus,
  Save,
  RotateCcw,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import ScreeningSessionSidebar from "./session-sidebar";
import ScreeningBench from "./screening-bench";
import FormulationWorkspace, {
  createDefaultWorkspaceValue,
  type WorkspaceValue,
} from "./formulation-workspace";
import LnpSavedPanel from "@/components/tools/lnp-saved-panel";
import {
  emptyBenchSession,
  generateFormulationId,
  parseBenchSession,
  type BenchFormulation,
  type BenchPrepParams,
  type BenchSessionData,
} from "@/lib/calculations/lnp-bench";
import type { LipidEntry } from "@/lib/calculations/lnp-formula";

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

function validateForBench(
  workspace: WorkspaceValue,
  name: string
): string | null {
  if (!name.trim()) return "请先填写配方名称";

  const sum = workspace.lipidEntries.reduce(
    (s, e) => s + num(e.molarRatio),
    0
  );
  if (Math.abs(sum - 100) > 0.1) {
    return `摩尔比总和必须为 100%（当前 ${sum.toFixed(1)}%）`;
  }

  for (const e of workspace.lipidEntries) {
    const n = e.isCustomLipid ? e.customLipidName : e.lipidName;
    if (!n?.trim()) return `请填写「${e.label}」的脂质名称`;
    if (!(num(e.molarWeight) > 0))
      return `请填写「${e.label}」的分子量`;
    if (!(num(e.molarRatio) > 0))
      return `请填写「${e.label}」的摩尔比`;
    if (!(num(e.stockConc) > 0))
      return `请填写「${e.label}」的母液浓度`;
  }

  const p = workspace.prep;
  if (!(num(p.masterConc) > 0)) return "请填写 Lipid Master Mix Conc";
  if (!(num(p.frrAqueous) > 0) || !(num(p.frrOrganic) > 0))
    return "请填写 FRR";
  if (!(num(p.npRatio) > 0)) return "请填写 N/P Ratio";
  if (!(num(p.rnaMass) > 0)) return "请填写 RNA 质量 (RNA mass)";
  if (!(num(p.rnaConc) > 0)) return "请填写 RNA 浓度 (RNA conc)";

  return null;
}
import {
  updateItemData,
  type LnpSavedItem,
} from "@/lib/supabase/lnp-service";
import { exportBenchToXlsx } from "@/lib/export/lnp-bench-xlsx";

export default function ScreeningMode() {
  const [activeSession, setActiveSession] = useState<LnpSavedItem | null>(
    null
  );
  const [sessionData, setSessionData] = useState<BenchSessionData>(
    emptyBenchSession
  );
  const [workspace, setWorkspace] = useState<WorkspaceValue>(
    createDefaultWorkspaceValue
  );
  const [formulationName, setFormulationName] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  // Persist sessionData to Supabase whenever it mutates (after initial load).
  const sessionIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  useEffect(() => {
    if (!activeSession) return;
    if (loadingRef.current) {
      loadingRef.current = false;
      return;
    }
    if (sessionIdRef.current !== activeSession.id) {
      sessionIdRef.current = activeSession.id;
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setSaving(true);
      try {
        await updateItemData(
          activeSession.id,
          sessionData as unknown as Record<string, unknown>
        );
        if (!cancelled) {
          setLastSavedAt(new Date());
          setRefreshToken((t) => t + 1);
        }
      } catch (e) {
        console.error(e);
        toast.error("保存失败");
      } finally {
        if (!cancelled) setSaving(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionData, activeSession]);

  const handleSelectSession = useCallback((item: LnpSavedItem) => {
    loadingRef.current = true;
    sessionIdRef.current = item.id;
    setActiveSession(item);
    setSessionData(parseBenchSession(item.data));
    setWorkspace(createDefaultWorkspaceValue());
    setFormulationName("");
    setLastSavedAt(null);
  }, []);

  const handleSessionDeleted = useCallback(
    (id: string) => {
      if (activeSession?.id === id) {
        sessionIdRef.current = null;
        setActiveSession(null);
        setSessionData(emptyBenchSession());
        setWorkspace(createDefaultWorkspaceValue());
        setFormulationName("");
      }
    },
    [activeSession]
  );

  function resetWorkspace() {
    setWorkspace(createDefaultWorkspaceValue());
    setFormulationName("");
  }

  function snapshotFormulation(id: string): BenchFormulation {
    return {
      id,
      name: formulationName.trim() || "未命名配方",
      lipidEntries: workspace.lipidEntries.map((e) => ({ ...e })),
      prep: { ...workspace.prep },
      createdAt: new Date().toISOString(),
    };
  }

  function addToBench() {
    if (!activeSession) {
      toast.error("请先选择或新建一个筛选会话");
      return;
    }
    const err = validateForBench(workspace, formulationName);
    if (err) {
      toast.error(err);
      return;
    }
    const snap = snapshotFormulation(generateFormulationId());
    setSessionData((prev) => ({
      ...prev,
      formulations: [...prev.formulations, snap],
    }));
    toast.success(`已加入「${snap.name}」`);
    // Keep workspace values as-is so the user can tune and add a variant.
  }

  function loadFormulationToWorkspace(f: BenchFormulation) {
    setWorkspace({
      lipidEntries: f.lipidEntries.map((e) => ({ ...e })),
      targetVolume: "",
      volumeUnit: "uL",
      prep: { ...f.prep },
    });
    setFormulationName(f.name);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBenchChange(next: BenchFormulation[]) {
    setSessionData((prev) => ({ ...prev, formulations: next }));
  }

  async function handleExportPdf(formulations: BenchFormulation[]) {
    if (!activeSession || formulations.length === 0) return;
    setExporting(true);
    const toastId = toast.loading("PDF 生成中，请等待...");
    try {
      const mod = await import("@/lib/export/lnp-bench-pdf");
      await mod.exportBenchToPdf(
        activeSession.name,
        activeSession.created_at,
        activeSession.updated_at,
        formulations
      );
      toast.success("PDF 生成成功", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("导出 PDF 失败", { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  function handleExportXlsx(formulations: BenchFormulation[]) {
    if (!activeSession || formulations.length === 0) return;
    try {
      exportBenchToXlsx(
        activeSession.name,
        activeSession.created_at,
        activeSession.updated_at,
        formulations
      );
      toast.success("Excel 已生成");
    } catch (e) {
      console.error(e);
      toast.error("导出 Excel 失败");
    }
  }

  // ── Formula / preparation library load handlers ──
  const loadFormulaFromLibrary = useCallback(
    (data: Record<string, unknown>) => {
      const d = data as {
        lipidEntries?: LipidEntry[];
        targetVolume?: string;
        volumeUnit?: "uL" | "mL";
      };
      if (!d.lipidEntries) return;
      setWorkspace((prev) => ({
        ...prev,
        lipidEntries: d.lipidEntries!.map((e) => ({ ...e })),
      }));
      toast.success("配方已载入工作区");
    },
    []
  );

  const loadPrepFromLibrary = useCallback(
    (data: Record<string, unknown>) => {
      const d = data as Partial<BenchPrepParams>;
      setWorkspace((prev) => ({
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
      toast.success("制备参数已载入");
    },
    []
  );

  const getFormulaFromWorkspace = useCallback(
    () => ({
      lipidEntries: workspace.lipidEntries.map((e) => ({ ...e })),
      targetVolume: workspace.targetVolume,
      volumeUnit: workspace.volumeUnit,
    }),
    [workspace.lipidEntries, workspace.targetVolume, workspace.volumeUnit]
  );

  const getPrepFromWorkspace = useCallback(
    (): Record<string, unknown> => ({ ...workspace.prep }),
    [workspace.prep]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside>
        <ScreeningSessionSidebar
          activeSessionId={activeSession?.id ?? null}
          onSelectSession={handleSelectSession}
          onSessionDeleted={handleSessionDeleted}
          refreshToken={refreshToken}
        />
      </aside>

      {/* Main */}
      <div className="space-y-6 min-w-0">
        {!activeSession ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                <CardTitle>新建或选择一个配方筛选</CardTitle>
              </div>
              <CardDescription>
                在左侧创建筛选会话，加入多个配方后可一键导出 PDF / Excel。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                左侧点击 <Plus className="inline h-3.5 w-3.5" />
                {" "}新建一个筛选，或选择已有筛选开始工作。
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Session header */}
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary shrink-0" />
                    <h2 className="text-base font-semibold truncate">
                      {activeSession.name}
                    </h2>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      创建 {formatDateTime(activeSession.created_at)}
                    </span>
                    <span>
                      {sessionData.formulations.length} 个配方
                    </span>
                    {saving ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        保存中
                      </span>
                    ) : lastSavedAt ? (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <Save className="h-3 w-3" />
                        已保存 {formatTime(lastSavedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Workspace */}
            <FormulationWorkspace
              mode="screening"
              value={workspace}
              onChange={(updater) => setWorkspace(updater)}
              formulationName={formulationName}
              onFormulationNameChange={setFormulationName}
              step1Aside={
                <LnpSavedPanel
                  type="formula"
                  title="我的配方库"
                  onLoad={loadFormulaFromLibrary}
                  getCurrentData={getFormulaFromWorkspace}
                />
              }
              step2Aside={
                <LnpSavedPanel
                  type="preparation"
                  title="我的制备参数"
                  onLoad={loadPrepFromLibrary}
                  getCurrentData={getPrepFromWorkspace}
                />
              }
              footerSlot={
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={resetWorkspace}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    清空编辑区
                  </Button>
                  <Button onClick={addToBench} className="gap-2">
                    <Plus className="h-4 w-4" />
                    加入实验台
                  </Button>
                </div>
              }
            />

            {/* Mobile panels */}
            <div className="lg:hidden grid gap-4 sm:grid-cols-2">
              <LnpSavedPanel
                type="formula"
                title="我的配方库"
                onLoad={loadFormulaFromLibrary}
                getCurrentData={getFormulaFromWorkspace}
              />
              <LnpSavedPanel
                type="preparation"
                title="我的制备参数"
                onLoad={loadPrepFromLibrary}
                getCurrentData={getPrepFromWorkspace}
              />
            </div>

            {/* Bench */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">实验台</CardTitle>
                <CardDescription>
                  每行一个配方，展示配方摘要与所需吸取体积。可拖动排序、多选删除、重命名、复制、点击
                  ▶ 载回工作区。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScreeningBench
                  formulations={sessionData.formulations}
                  onChange={handleBenchChange}
                  onLoad={loadFormulationToWorkspace}
                  onExportPdf={handleExportPdf}
                  onExportXlsx={handleExportXlsx}
                  busy={exporting}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
