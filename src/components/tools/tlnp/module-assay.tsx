"use client";

import { useMemo, useState } from "react";
import { Microscope, MessageSquare, Mouse, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Chip from "./chip";
import ModuleDate from "./module-date";
import ParamBench from "./param-bench";
import InVitroMatrix from "./invitro-matrix";
import RoiRunCard from "./roi-run-card";
import { SampleBarChart } from "./assay-charts";
import { systemName } from "@/lib/calculations/tlnp-conjugation";
import {
  createRoiRun,
  FLUORESCENCE_METRIC_LABELS,
  INVITRO_READOUT_LABELS,
  invitroUnitLabel,
  summarizeInVitro,
  type AssayDesign,
  type FluorescenceMetric,
  type InVitroReadout,
  type InVitroResults,
  type InVivoResults,
  type TlnpAssayModule,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";

interface Props {
  data: TlnpExperimentData;
  update: (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => void;
}

/**
 * Module 4 — 体外 and 体内, switched rather than tabbed so the choice persists
 * with the batch. Both arms are always stored; switching never discards.
 *
 * Each arm is a parameter bench for the design (see INVITRO_PARAM_PRESETS) and
 * a purpose-built result table: a replicate matrix in vitro, an ROI paste in
 * vivo. Neither result shape is generic, because neither assay is: a luciferase
 * plate has repeats and an imaging run has organs, and a single 样本/数值 list
 * could describe neither well enough to plot.
 *
 * The subject list offered to the in-vitro matrix is the batch's reaction
 * systems when there are any, falling back to the bare samples — what you dose
 * is the tLNP, not the naked LNP, once module 2 has run.
 */
export default function ModuleAssay({ data, update }: Props) {
  const assay = data.assay;

  const setAssay = (patch: (a: TlnpAssayModule) => TlnpAssayModule) =>
    update((prev) => ({ ...prev, assay: patch(prev.assay) }));

  const setVitro = (patch: Partial<TlnpAssayModule["invitro"]>) =>
    setAssay((a) => ({ ...a, invitro: { ...a.invitro, ...patch } }));

  const setVivo = (patch: Partial<TlnpAssayModule["invivo"]>) =>
    setAssay((a) => ({ ...a, invivo: { ...a.invivo, ...patch } }));

  const subjects = useMemo(() => {
    const systems = data.conjugation.systems.map(systemName);
    if (systems.length > 0) return systems;
    return data.prep.samples.map((s, i) => s.name || `样品 ${i + 1}`);
  }, [data.conjugation.systems, data.prep.samples]);

  const isVitro = assay.active === "invitro";

  return (
    <div className="space-y-6">
      {/* A segmented pair rather than two loose chips: this is the one control
          that decides what the whole module is about, so it reads as a switch
          with a visibly selected side. */}
      <div className="inline-flex rounded-lg border p-1">
        <ArmButton
          active={isVitro}
          onClick={() => setAssay((a) => ({ ...a, active: "invitro" }))}
          icon={<Microscope className="h-4 w-4" />}
          label="体外实验"
        />
        <ArmButton
          active={!isVitro}
          onClick={() => setAssay((a) => ({ ...a, active: "invivo" }))}
          icon={<Mouse className="h-4 w-4" />}
          label="体内实验"
        />
      </div>

      {isVitro ? (
        <>
          <DesignCard
            title="体外实验设计"
            icon={<Microscope className="h-4 w-4 text-pillar-disease" />}
            description="细胞系、孔板、检测指标、剂量与检测时间。点选或自行输入，也可以新增参数字段。"
            design={assay.invitro.design}
            onChange={(design) => setVitro({ design })}
          />
          <InVitroResultsCard
            results={assay.invitro.results}
            onChange={(results) => setVitro({ results })}
            subjects={subjects}
          />
        </>
      ) : (
        <>
          <DesignCard
            title="体内实验设计"
            icon={<Mouse className="h-4 w-4 text-pillar-disease" />}
            description="动物、给药与检测安排。点选或自行输入，也可以新增参数字段。"
            design={assay.invivo.design}
            onChange={(design) => setVivo({ design })}
          />
          <InVivoResultsCard
            results={assay.invivo.results}
            onChange={(results) => setVivo({ results })}
          />
        </>
      )}
    </div>
  );
}

function ArmButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors ${
        active
          ? "bg-pillar-disease-subtle font-semibold text-foreground ring-1 ring-pillar-disease"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DesignCard({
  title,
  icon,
  description,
  design,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  design: AssayDesign;
  onChange: (next: AssayDesign) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <ModuleDate
            value={design.date}
            onChange={(date) => onChange({ ...design, date })}
          />
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ParamBench
          entries={design.params}
          onChange={(params) => onChange({ ...design, params })}
          title={title}
        />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            设计备注（可选）
          </Label>
          <Textarea
            value={design.note}
            onChange={(e) => onChange({ ...design, note: e.target.value })}
            className="min-h-16 text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 体外结果 ─────────────────────────────────────────────

const READOUTS: InVitroReadout[] = ["luciferase", "fluorescence"];
const METRICS: FluorescenceMetric[] = ["mfi", "percent"];

function InVitroResultsCard({
  results,
  onChange,
  subjects,
}: {
  results: InVitroResults;
  onChange: (next: InVitroResults) => void;
  subjects: string[];
}) {
  const stats = useMemo(() => summarizeInVitro(results), [results]);
  const unit = invitroUnitLabel(results);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">体外结果</CardTitle>
          <CardDescription>
            每一列是一个样本，每一行是一次重复。填完自动出柱状图（均值 ± SD，点为各重复）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {READOUTS.map((r) => (
              <Chip
                key={r}
                active={results.readout === r}
                onClick={() => onChange({ ...results, readout: r })}
              >
                {INVITRO_READOUT_LABELS[r]}
              </Chip>
            ))}
            {results.readout === "fluorescence" && (
              <>
                <span className="ml-2 text-xs text-muted-foreground">
                  定量方式
                </span>
                {METRICS.map((m) => (
                  <Chip
                    key={m}
                    active={results.fluorMetric === m}
                    onClick={() => onChange({ ...results, fluorMetric: m })}
                  >
                    {FLUORESCENCE_METRIC_LABELS[m]}
                  </Chip>
                ))}
              </>
            )}
          </div>

          <InVitroMatrix
            results={results}
            onChange={onChange}
            subjects={subjects}
            unit={unit}
          />

          {stats.some((s) => s.mean !== null) && (
            <SampleBarChart
              stats={stats}
              unit={unit}
              title={`${INVITRO_READOUT_LABELS[results.readout]}（${unit}）`}
            />
          )}
        </CardContent>
      </Card>

      <DiscussionCard
        value={results.discussion}
        onChange={(discussion) => onChange({ ...results, discussion })}
        placeholder="例如：靶向组的表达量比对照高约 4 倍，且随剂量递增"
      />
    </>
  );
}

// ─── 体内结果 ─────────────────────────────────────────────

function InVivoResultsCard({
  results,
  onChange,
}: {
  results: InVivoResults;
  onChange: (next: InVivoResults) => void;
}) {
  // Which run was just created, so its card opens on the paste box instead of
  // on an empty chart the user would have to find the pencil for.
  const [freshId, setFreshId] = useState<string | null>(null);

  function addRun() {
    const run = createRoiRun(`成像结果 ${results.runs.length + 1}`, "", []);
    setFreshId(run.id);
    onChange({ ...results, runs: [...results.runs, run] });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">体内结果</CardTitle>
          <CardDescription>
            一次成像一组：粘贴 样本名 / 器官 / Total ROI / Avg ROI
            四列，保存后自动出三张图，原始数据收起来，点铅笔可再编辑。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {results.runs.map((run) => (
            <RoiRunCard
              key={run.id}
              run={run}
              startEditing={run.id === freshId}
              onChange={(next) =>
                onChange({
                  ...results,
                  runs: results.runs.map((r) => (r.id === next.id ? next : r)),
                })
              }
              onRemove={() => {
                if (!confirm(`删除成像结果「${run.name || "未命名"}」？`)) return;
                onChange({
                  ...results,
                  runs: results.runs.filter((r) => r.id !== run.id),
                });
              }}
            />
          ))}

          {results.runs.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed py-8 text-center">
              <p className="text-sm text-muted-foreground">
                还没有成像结果。一个时间点、一次在体或离体成像各建一组。
              </p>
              <Button size="sm" className="gap-1.5" onClick={addRun}>
                <Plus className="h-3.5 w-3.5" />
                新建成像结果
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={addRun}
            >
              <Plus className="h-3.5 w-3.5" />
              再加一组成像结果
            </Button>
          )}
        </CardContent>
      </Card>

      <DiscussionCard
        value={results.discussion}
        onChange={(discussion) => onChange({ ...results, discussion })}
        placeholder="例如：靶向组肝脏占比下降、脾脏占比上升，提示器官再分布"
      />
    </>
  );
}

function DiscussionCard({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">结果分析与讨论</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-32 text-sm"
        />
      </CardContent>
    </Card>
  );
}
