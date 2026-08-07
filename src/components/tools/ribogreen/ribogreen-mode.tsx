"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Boxes, LineChart, Calculator } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurvePanel from "./curve-panel";
import SampleGrid from "./sample-grid";
import RibogreenSavedPanel from "./ribogreen-saved-panel";
import RibogreenRecordsPanel from "./ribogreen-records-panel";
import { describeError } from "./use-ribogreen-saved";
import {
  cloneCurvePair,
  computeBatch,
  createBlankSample,
  createCurvePair,
  createDefaultCorrection,
  createInitialSamples,
  fitCurve,
  parseCurveData,
  parseResultData,
  serializeCurve,
  serializeResult,
  todayISO,
  type CorrectionSetting,
  type CurvePair,
  type SampleRow,
} from "@/lib/calculations/ribogreen";
import { parseTlnpExperiment } from "@/lib/calculations/tlnp-experiment";
import { systemName } from "@/lib/calculations/tlnp-conjugation";
import {
  returnUrl,
  STAGE_LABELS,
  type TlnpHandoff,
} from "@/lib/calculations/tlnp-handoff";
import type { InstrumentKey } from "@/lib/calculations/ribogreen-presets";
import {
  createItem,
  getItem,
  updateItemData,
  type LnpSavedItem,
} from "@/lib/supabase/lnp-service";

// Server renders "", the client renders today's date. Doing this through
// useSyncExternalStore keeps hydration honest without a setState-in-effect.
const noopSubscribe = () => () => {};

interface RibogreenModeProps {
  active: boolean;
  /** Jump to the screening tab and focus the formulation a sample came from. */
  onOpenFormulation?: (sessionId: string, formulationId: string) => void;
  /** Record the screening tab asked us to load, e.g. from a bench card link. */
  pendingRecord?: { itemId: string; token: number } | null;
  onPendingRecordHandled?: () => void;
  /** A tLNP batch sent us over to measure its samples. */
  tlnpHandoff?: TlnpHandoff | null;
}

export default function RibogreenMode({
  active,
  onOpenFormulation,
  pendingRecord,
  onPendingRecordHandled,
  tlnpHandoff,
}: RibogreenModeProps) {
  const router = useRouter();
  // This component is force-mounted so the sample grid survives tab switches,
  // which would otherwise make the records panel hit Supabase on every page
  // load. Latch on first activation instead: mount it once the tab has been
  // opened, then keep it (so its loaded list isn't thrown away on tab-out).
  const everActiveRef = useRef(false);
  if (active) everActiveRef.current = true;
  const showRecords = everActiveRef.current;

  const [instrument, setInstrument] = useState<InstrumentKey>("thermo");
  const [curveExpanded, setCurveExpanded] = useState(false);
  const [curves, setCurves] = useState<CurvePair>(() =>
    createCurvePair("thermo")
  );
  const [rows, setRows] = useState<SampleRow[]>(() => createInitialSamples(8));
  const [correction, setCorrection] = useState<CorrectionSetting>(
    createDefaultCorrection
  );
  const [showCorrected, setShowCorrected] = useState(true);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [activeResultName, setActiveResultName] = useState("");
  const [recordsRefresh, setRecordsRefresh] = useState(0);

  /** Set once the handoff has been resolved to a real batch — drives the
   *  return banner. Kept separate from the incoming prop so a failed lookup
   *  doesn't leave a banner pointing at nothing. */
  const [handoff, setHandoff] = useState<{
    batchId: string;
    batchName: string;
    stage: TlnpHandoff["stage"];
    count: number;
  } | null>(null);
  const [returning, setReturning] = useState(false);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDate, setSaveDate] = useState("");
  const [saving, setSaving] = useState(false);

  const onClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const experimentDate = dateOverride ?? (onClient ? todayISO() : "");

  const fits = useMemo(
    () => ({ triton: fitCurve(curves.triton), te: fitCurve(curves.te) }),
    [curves]
  );

  const batch = useMemo(
    () => computeBatch({ rows, curves, correction }),
    [rows, curves, correction]
  );

  const rawBatch = useMemo(
    () =>
      computeBatch({
        rows,
        curves,
        correction: { ...correction, enabled: false },
      }),
    [rows, curves, correction]
  );

  const display = showCorrected ? batch : rawBatch;

  /** Shared by the records panel and the "open from screening bench" link. */
  const applyRecord = useCallback(
    (data: Record<string, unknown>, item: LnpSavedItem): boolean => {
      const parsed = parseResultData(data);
      if (!parsed) {
        toast.error("实验记录数据格式不正确");
        return false;
      }
      setInstrument(parsed.instrument);
      setCurves(cloneCurvePair(parsed.curves));
      setRows(parsed.rows.map((r) => ({ ...r })));
      setCorrection({ ...parsed.correction });
      setDateOverride(parsed.experimentDate || todayISO());
      setShowCorrected(true);
      setActiveResultId(item.id);
      setActiveResultName(item.name);
      return true;
    },
    []
  );

  // The screening tab can hand us a record id to open — fetch and load it.
  useEffect(() => {
    if (!pendingRecord) return;
    let cancelled = false;
    void (async () => {
      try {
        const item = await getItem(pendingRecord.itemId);
        if (cancelled) return;
        if (!item?.data) {
          toast.error("找不到这条实验记录");
          return;
        }
        if (applyRecord(item.data, item)) {
          toast.success(`已载入「${item.name}」`);
        }
      } catch (e) {
        console.error(e);
        toast.error(describeError(e));
      } finally {
        if (!cancelled) onPendingRecordHandled?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingRecord, applyRecord, onPendingRecordHandled]);

  // A tLNP batch sent us its sample names. Seed one column per sample, already
  // linked back, so the user only has to paste readings.
  useEffect(() => {
    if (!tlnpHandoff) return;
    let cancelled = false;
    void (async () => {
      try {
        const item = await getItem(tlnpHandoff.batchId);
        if (cancelled) return;
        if (!item) {
          toast.error("找不到该 tLNP 批次");
          return;
        }
        const parsed = parseTlnpExperiment(item.data);
        const targets =
          tlnpHandoff.stage === "purify"
            ? parsed.conjugation.systems.map((s, i) => ({
                id: s.id,
                name: systemName(s, i),
              }))
            : parsed.prep.samples.map((s, i) => ({
                id: s.id,
                name: s.name || `样品 ${i + 1}`,
              }));

        if (targets.length === 0) {
          toast.error(
            tlnpHandoff.stage === "purify"
              ? "该批次还没有反应体系"
              : "该批次还没有样品"
          );
          return;
        }

        setRows(
          targets.map((t) => ({
            ...createBlankSample(),
            name: t.name,
            sourceSessionId: item.id,
            sourceSessionName: item.name,
            sourceFormulationId: t.id,
            sourceKind: "tlnp_experiment" as const,
          }))
        );
        setActiveResultId(null);
        setActiveResultName("");
        setHandoff({
          batchId: item.id,
          batchName: item.name,
          stage: tlnpHandoff.stage,
          count: targets.length,
        });
        toast.success(`已载入「${item.name}」的 ${targets.length} 个样品名`);
      } catch (e) {
        console.error(e);
        toast.error(describeError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tlnpHandoff]);

  /**
   * Save what's on screen and go back to the batch that sent us.
   *
   * Saving first is what makes the return meaningful: the workbench imports by
   * record id, and refits from the stored curve rather than trusting anything
   * carried across in the URL.
   */
  async function handleReturnToTlnp() {
    if (!handoff) return;
    setReturning(true);
    try {
      const payload = serializeResult({
        experimentDate: experimentDate || todayISO(),
        instrument,
        curves,
        rows,
        correction,
      }) as unknown as Record<string, unknown>;

      let recordId = activeResultId;
      if (recordId) {
        await updateItemData(recordId, payload);
      } else {
        const name = `RiboGreen · ${handoff.batchName} · ${experimentDate || todayISO()}`;
        const row = await createItem({
          type: "ribogreen_result",
          is_folder: false,
          parent_id: null,
          name,
          data: payload,
          sort_order: 0,
        });
        recordId = row.id;
        setActiveResultId(row.id);
        setActiveResultName(name);
      }
      setRecordsRefresh((n) => n + 1);
      router.push(returnUrl(handoff.batchId, handoff.stage, recordId));
    } catch (e) {
      console.error(e);
      toast.error(describeError(e));
    } finally {
      setReturning(false);
    }
  }

  function handleInstrumentChange(key: InstrumentKey) {
    if (key === instrument) return;
    setInstrument(key);
    setCurves(createCurvePair(key));
  }

  function handleReset() {
    if (!window.confirm("确定要清空所有样本数据吗？标准曲线不受影响。")) return;
    setRows(createInitialSamples(8));
    setCorrection(createDefaultCorrection());
    setShowCorrected(true);
    setActiveResultId(null);
    setActiveResultName("");
  }

  async function handleExportXlsx() {
    const toastId = toast.loading("Excel 生成中...");
    try {
      const mod = await import("@/lib/export/ribogreen-xlsx");
      mod.exportRibogreenToXlsx({
        rows,
        batch: display,
        curves,
        instrument,
        experimentDate,
        recordName: activeResultName,
      });
      toast.success("Excel 已导出", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("导出 Excel 失败", { id: toastId });
    }
  }

  function openSaveDialog() {
    setSaveName(activeResultName || `RiboGreen ${experimentDate}`);
    setSaveDate(experimentDate);
    setSaveOpen(true);
  }

  async function handleSaveRecord(mode: "new" | "update") {
    const name = saveName.trim();
    if (!name) {
      toast.error("请填写记录名称");
      return;
    }
    setSaving(true);
    try {
      const data = serializeResult({
        experimentDate: saveDate || todayISO(),
        instrument,
        curves,
        rows,
        correction,
      }) as unknown as Record<string, unknown>;

      if (mode === "update" && activeResultId) {
        await updateItemData(activeResultId, data);
        toast.success("记录已更新");
      } else {
        const row = await createItem({
          type: "ribogreen_result",
          is_folder: false,
          parent_id: null,
          name,
          data,
          sort_order: 0,
        });
        setActiveResultId(row.id);
        toast.success("实验记录已保存");
      }
      setActiveResultName(name);
      setDateOverride(saveDate || todayISO());
      setSaveOpen(false);
      setRecordsRefresh((n) => n + 1);
    } catch (e) {
      console.error(e);
      toast.error(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ═══ 0. tLNP 工作台往返 ═════════════════════════ */}
      {handoff && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <Boxes className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                来自 tLNP 批次「{handoff.batchName}」·{" "}
                {STAGE_LABELS[handoff.stage]}
              </p>
              <p className="text-xs text-muted-foreground">
                已填入 {handoff.count} 个样品名。填好标准曲线和读数后，点右侧按钮保存并带着结果回到工作台。
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={() => void handleReturnToTlnp()}
              disabled={returning}
            >
              <ArrowLeftRight className="h-4 w-4" />
              {returning ? "保存中..." : "导入结果并返回 tLNP 工作台"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ═══ 1. 标准曲线 ═══════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            <CardTitle>标准曲线</CardTitle>
          </div>
          <CardDescription>
            选择酶标仪预设或自定义曲线，点击已选中的按钮可展开 / 折叠标准点与曲线图。取消勾选某个标准点会将其从拟合中剔除，R² 与有效范围实时更新。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CurvePanel
            instrument={instrument}
            curves={curves}
            fits={fits}
            expanded={curveExpanded}
            onExpandedChange={setCurveExpanded}
            onInstrumentChange={handleInstrumentChange}
            onCurvesChange={setCurves}
            savedSlot={
              <RibogreenSavedPanel
                getCurrentData={() =>
                  serializeCurve(instrument, curves) as unknown as Record<
                    string,
                    unknown
                  >
                }
                onLoad={(data) => {
                  const parsed = parseCurveData(data);
                  if (!parsed) {
                    toast.error("标准曲线数据格式不正确");
                    return;
                  }
                  // A saved curve is always the user's own — surface it under
                  // 自定义曲线 so the point rows stay editable.
                  setInstrument("custom");
                  setCurves(cloneCurvePair(parsed.curves));
                }}
              />
            }
          />
        </CardContent>
      </Card>

      {/* ═══ 2. 样本计算 ═══════════════════════════════ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>样本计算</CardTitle>
          </div>
          <CardDescription>
            每列为一个样本。读数会先经标准曲线换算为孔内浓度，再乘稀释倍数还原为样品浓度（ng/µL）。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SampleGrid
            rows={rows}
            display={display}
            batch={batch}
            correction={correction}
            showCorrected={showCorrected}
            experimentDate={experimentDate}
            onRowsChange={setRows}
            onCorrectionChange={setCorrection}
            onShowCorrectedChange={setShowCorrected}
            onReset={handleReset}
            onSave={openSaveDialog}
            onExportXlsx={handleExportXlsx}
            onOpenFormulation={onOpenFormulation}
          />
        </CardContent>
      </Card>

      {/* ═══ 3. 我的实验记录 ═══════════════════════════ */}
      {showRecords && (
      <RibogreenRecordsPanel
        refreshToken={recordsRefresh}
        activeItemId={activeResultId}
        onLoad={applyRecord}
      />
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存实验记录</DialogTitle>
            <DialogDescription>
              保存当前的标准曲线快照、全部样本数据与校正设置。实验日期用于记录的年 / 月归档，可与录入日期不同。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ribogreen-record-name">记录名称</Label>
              <Input
                id="ribogreen-record-name"
                value={saveName}
                autoFocus
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveRecord("new");
                }}
                placeholder="例如 SM-102 批次包封率"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ribogreen-record-date">实验日期</Label>
              <Input
                id="ribogreen-record-date"
                type="date"
                value={saveDate}
                onChange={(e) => setSaveDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              取消
            </Button>
            {activeResultId && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => void handleSaveRecord("update")}
              >
                更新当前记录
              </Button>
            )}
            <Button
              disabled={saving}
              onClick={() => void handleSaveRecord("new")}
            >
              {activeResultId ? "另存为新记录" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
