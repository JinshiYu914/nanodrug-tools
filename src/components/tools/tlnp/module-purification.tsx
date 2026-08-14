"use client";

import { useMemo, useState } from "react";
import {
  Columns3,
  MessageSquare,
  Pencil,
  Plus,
  TestTube2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Chip from "./chip";
import ModuleDate from "./module-date";
import Cl4bPresets from "./cl4b-presets";
import ChromatogramImport from "./chromatogram-import";
import ChromatogramChart from "./chromatogram-chart";
import CharacterizationMatrix, {
  type CharacterizationPatch,
} from "./characterization-matrix";
import RibogreenHandoffButton from "./ribogreen-handoff-button";
import { extractLink, useRibogreenRecords } from "./use-ribogreen-link";
import { genId } from "@/lib/calculations/ribogreen";
import { systemName } from "@/lib/calculations/tlnp-conjugation";
import {
  createChromatogram,
  reparseChromatogram,
  setChromatogramXAxis,
  type ParsedChromatogram,
} from "@/lib/calculations/chromatogram";
import {
  createSystemCharacterization,
  PURIFICATION_METHOD_LABELS,
  type Chromatogram,
  type PurificationMethod,
  type SystemCharacterization,
  type TlnpExperimentData,
  type TlnpPurificationModule,
} from "@/lib/calculations/tlnp-experiment";
import { PERSONAL_SCOPE, type DataScope } from "@/lib/projects/types";

const METHODS: Exclude<PurificationMethod, "">[] = [
  "cl4b",
  "ultrafiltration",
  "dialysis",
];

interface Props {
  data: TlnpExperimentData;
  update: (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => void;
  batchId: string;
  cloudEnabled: boolean;
  scope?: DataScope;
}

export default function ModulePurification({ data, update, batchId, cloudEnabled, scope = PERSONAL_SCOPE }: Props) {
  const [adding, setAdding] = useState(false);
  const pur = data.purification;
  const systems = data.conjugation.systems;

  const { records, loading, reload } = useRibogreenRecords(cloudEnabled && systems.length > 0, scope);

  const setPur = (patch: (p: TlnpPurificationModule) => TlnpPurificationModule) =>
    update((prev) => ({ ...prev, purification: patch(prev.purification) }));

  const setDesign = (patch: Partial<TlnpPurificationModule["design"]>) =>
    setPur((p) => ({ ...p, design: { ...p.design, ...patch } }));

  /**
   * One characterization row per reaction system, created on demand.
   *
   * Derived rather than stored eagerly so adding a system in module 2 shows up
   * here without a migration step, and so a deleted system's row stops being
   * rendered without being destroyed the moment it goes.
   */
  const rows = useMemo(
    () =>
      systems.map((s, i) => {
        const stored = pur.results.systems.find((r) => r.systemId === s.id);
        return {
          id: s.id,
          name: systemName(s, i),
          ee: stored?.ee ?? createSystemCharacterization(s.id).ee,
          dls: stored?.dls ?? createSystemCharacterization(s.id).dls,
          tem: stored?.tem ?? "",
          note: stored?.note ?? "",
        };
      }),
    [systems, pur.results.systems]
  );

  const patchSystemResult = (systemId: string, patch: CharacterizationPatch) =>
    setPur((p) => {
      const exists = p.results.systems.some((r) => r.systemId === systemId);
      const apply = (r: SystemCharacterization): SystemCharacterization => ({
        ...r,
        ...(patch.ee ? { ee: patch.ee } : {}),
        ...(patch.dls ? { dls: patch.dls } : {}),
        ...(patch.tem !== undefined ? { tem: patch.tem } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
      });
      return {
        ...p,
        results: {
          ...p.results,
          systems: exists
            ? p.results.systems.map((r) =>
                r.systemId === systemId ? apply(r) : r
              )
            : [...p.results.systems, apply(createSystemCharacterization(systemId))],
        },
      };
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Columns3 className="h-4 w-4 text-pillar-utr" />
              <CardTitle className="text-base">纯化方法</CardTitle>
            </div>
            <ModuleDate
              value={pur.design.date}
              onChange={(date) => setDesign({ date })}
            />
          </div>
          <CardDescription>
            选择方法后填写对应参数。未选中的方法参数会保留，换回来时还在。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <Chip
                key={m}
                active={pur.design.method === m}
                onClick={() =>
                  setDesign({ method: pur.design.method === m ? "" : m })
                }
              >
                {PURIFICATION_METHOD_LABELS[m]}
              </Chip>
            ))}
          </div>

          {pur.design.method === "cl4b" && (
            <div className="space-y-3 rounded-lg border p-3">
              {cloudEnabled ? <Cl4bPresets
                current={{
                  columnLength: pur.design.cl4b.columnLength,
                  columnDiameter: pur.design.cl4b.columnDiameter,
                  flowRate: pur.design.cl4b.flowRate,
                  buffer: pur.design.cl4b.buffer,
                }}
                onApply={(p) =>
                  setDesign({ cl4b: { ...pur.design.cl4b, ...p } })
                }
              /> : <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">登录后可读取和保存“我的柱子”预设。</p>}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="柱长 (cm)">
                  <NumInput
                    value={pur.design.cl4b.columnLength}
                    onChange={(v) =>
                      setDesign({ cl4b: { ...pur.design.cl4b, columnLength: v } })
                    }
                  />
                </Field>
                <Field label="柱径 (cm)">
                  <NumInput
                    value={pur.design.cl4b.columnDiameter}
                    onChange={(v) =>
                      setDesign({
                        cl4b: { ...pur.design.cl4b, columnDiameter: v },
                      })
                    }
                  />
                </Field>
                <Field label="流速 (mL/min)">
                  <NumInput
                    value={pur.design.cl4b.flowRate}
                    onChange={(v) =>
                      setDesign({ cl4b: { ...pur.design.cl4b, flowRate: v } })
                    }
                  />
                </Field>
                <Field label="洗脱 buffer">
                  <Input
                    value={pur.design.cl4b.buffer}
                    onChange={(e) =>
                      setDesign({
                        cl4b: { ...pur.design.cl4b, buffer: e.target.value },
                      })
                    }
                    placeholder="例如 PBS pH 7.4"
                    className="h-8 px-2 text-xs"
                  />
                </Field>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-primary"
                  checked={pur.design.cl4b.ultrafiltrationConcentrate}
                  onChange={(e) =>
                    setDesign({
                      cl4b: {
                        ...pur.design.cl4b,
                        ultrafiltrationConcentrate: e.target.checked,
                      },
                    })
                  }
                />
                过柱后做超滤浓缩
              </label>
            </div>
          )}

          {pur.design.method === "ultrafiltration" && (
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
              <Field label="截留分子量 (kDa)">
                <NumInput
                  value={pur.design.ultrafiltration.mwco}
                  onChange={(v) =>
                    setDesign({
                      ultrafiltration: { ...pur.design.ultrafiltration, mwco: v },
                    })
                  }
                />
              </Field>
              <Field label="次数">
                <NumInput
                  value={pur.design.ultrafiltration.cycles}
                  onChange={(v) =>
                    setDesign({
                      ultrafiltration: {
                        ...pur.design.ultrafiltration,
                        cycles: v,
                      },
                    })
                  }
                />
              </Field>
              <Field label="备注">
                <Input
                  value={pur.design.ultrafiltration.note}
                  onChange={(e) =>
                    setDesign({
                      ultrafiltration: {
                        ...pur.design.ultrafiltration,
                        note: e.target.value,
                      },
                    })
                  }
                  className="h-8 px-2 text-xs"
                />
              </Field>
            </div>
          )}

          {pur.design.method === "dialysis" && (
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
              <Field label="截留分子量 (kDa)">
                <NumInput
                  value={pur.design.dialysis.mwco}
                  onChange={(v) =>
                    setDesign({ dialysis: { ...pur.design.dialysis, mwco: v } })
                  }
                />
              </Field>
              <Field label="时长">
                <Input
                  value={pur.design.dialysis.duration}
                  onChange={(e) =>
                    setDesign({
                      dialysis: {
                        ...pur.design.dialysis,
                        duration: e.target.value,
                      },
                    })
                  }
                  className="h-8 px-2 text-xs"
                />
              </Field>
              <Field label="buffer">
                <Input
                  value={pur.design.dialysis.buffer}
                  onChange={(e) =>
                    setDesign({
                      dialysis: {
                        ...pur.design.dialysis,
                        buffer: e.target.value,
                      },
                    })
                  }
                  className="h-8 px-2 text-xs"
                />
              </Field>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[16rem_1fr]">
            <Field label="操作人">
              <Input
                value={pur.design.operator}
                onChange={(e) => setDesign({ operator: e.target.value })}
                placeholder="姓名或缩写"
                className="h-8 px-2 text-xs"
              />
            </Field>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                设计备注（可选）
              </Label>
              <Textarea
                value={pur.design.note}
                onChange={(e) => setDesign({ note: e.target.value })}
                className="min-h-16 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">层析结果</CardTitle>
          <CardDescription>
            导入 Excel / CSV 或直接粘贴 12 列 SEC 数据，自动读取 A280、A260 和 Fraction Mark；
            峰图可在 min、mL、CV 之间切换。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pur.chromatograms.map((c) => (
            <ChromatogramCard
              key={c.id}
              chromatogram={c}
              onChange={(next) =>
                setPur((p) => ({
                  ...p,
                  chromatograms: p.chromatograms.map((x) =>
                    x.id === next.id ? next : x
                  ),
                }))
              }
              onRemove={() => {
                if (!confirm(`删除层析图「${c.name}」？`)) return;
                setPur((p) => ({
                  ...p,
                  chromatograms: p.chromatograms.filter((x) => x.id !== c.id),
                }));
              }}
            />
          ))}

          {adding || pur.chromatograms.length === 0 ? (
            <ChromatogramImport
              onImport={(parsed, name, rawText, source, sourceName) => {
                setPur((p) => ({
                  ...p,
                  chromatograms: [
                    ...p.chromatograms,
                    createChromatogram(parsed, name, rawText, source, sourceName),
                  ],
                }));
                setAdding(false);
              }}
              onCancel={
                pur.chromatograms.length > 0 ? () => setAdding(false) : undefined
              }
            />
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              再导入一张层析图
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4 text-pillar-utr" />
              <CardTitle className="text-base">纯化后表征</CardTitle>
            </div>
          <RibogreenHandoffButton
              batchId={batchId}
              stage="purify"
              disabled={systems.length === 0}
              onRefresh={() => void reload()}
              refreshing={loading}
            loginRequired={!cloudEnabled}
            projectId={scope.kind === "project" ? scope.projectId : undefined}
            />
          </div>
          <CardDescription>
            一行一个反应体系，与「LNP 制备」用同一套 RiboGreen
            计算——点右上角的按钮过去测完带回来，或直接填写。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CharacterizationMatrix
            rows={rows}
            onChange={patchSystemResult}
            candidates={records}
            recordsLoading={loading}
            onImport={(id, record) => {
              const link = extractLink(record, id);
              if (!link) {
                toast.error("该记录里找不到这个体系的读数");
                return;
              }
              const stored = pur.results.systems.find((r) => r.systemId === id);
              patchSystemResult(id, {
                ee: {
                  ...(stored?.ee ?? createSystemCharacterization(id).ee),
                  link,
                },
              });
              toast.success(`已导入「${record.name}」的检测结果`);
            }}
            emptyHint="「偶联反应」里建立反应体系后，这里会逐个记录纯化后的表征结果。"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">实验结果与讨论</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={pur.results.discussion}
            onChange={(e) =>
              setPur((p) => ({
                ...p,
                results: { ...p.results, discussion: e.target.value },
              }))
            }
            placeholder="例如：CL4B 第一个峰是 tLNP，第二个峰是游离抗体，分离度良好"
            className="min-h-32 text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ChromatogramCard({
  chromatogram,
  onChange,
  onRemove,
}: {
  chromatogram: Chromatogram;
  onChange: (next: Chromatogram) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);

  function applyEdit(
    parsed: ParsedChromatogram,
    name: string,
    rawText: string,
    source: "paste" | "csv" = "paste",
    sourceName = ""
  ) {
    onChange({
      ...reparseChromatogram(chromatogram, parsed, rawText, source, sourceName),
      name: name || chromatogram.name,
    });
    setEditing(false);
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={chromatogram.name}
          onChange={(e) => onChange({ ...chromatogram, name: e.target.value })}
          className="h-8 max-w-64 px-2 text-xs font-medium"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {chromatogram.points.length} 点 ·{" "}
            {chromatogram.channels.map((c) => c.label).join(" / ") || "无通道"}
          </span>
          <select
            aria-label="峰图横轴"
            value={chromatogram.xAxis}
            onChange={(event) =>
              onChange(setChromatogramXAxis(chromatogram, event.target.value as Chromatogram["xAxis"]))
            }
            className="h-7 rounded-md border bg-background px-2 text-xs"
          >
            {chromatogram.availableXAxes.map((axis) => (
              <option key={axis} value={axis}>{axis}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            title="重新编辑这组数据"
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="删除该层析图"
            className="p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <ChromatogramImport
          initialText={chromatogram.rawText}
          initialName={chromatogram.name}
          onImport={applyEdit}
          onCancel={() => setEditing(false)}
          submitLabel="用新数据替换"
        />
      ) : (
        <ChromatogramChart
          chromatogram={chromatogram}
          onToggleFractionMarks={() =>
            onChange({
              ...chromatogram,
              showFractionMarks: !chromatogram.showFractionMarks,
            })
          }
          onRemoveFractionMark={(markId) =>
            onChange({
              ...chromatogram,
              fractionMarks: chromatogram.fractionMarks.filter((mark) => mark.id !== markId),
            })
          }
        />
      )}

      {!editing && chromatogram.rawText === "" && (
        <p className="text-[11px] text-muted-foreground">
          这张图导入时还没有保存原始文本，点铅笔可以重新粘贴一份。
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">收集峰段</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-[11px]"
            onClick={() =>
              onChange({
                ...chromatogram,
                fractions: [
                  ...chromatogram.fractions,
                  { id: genId(), from: 0, to: 0, label: "" },
                ],
              })
            }
          >
            <Plus className="h-3 w-3" />
            添加
          </Button>
        </div>
        {chromatogram.fractions.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-1.5">
            <Input
              value={f.label}
              onChange={(e) =>
                onChange({
                  ...chromatogram,
                  fractions: chromatogram.fractions.map((x) =>
                    x.id === f.id ? { ...x, label: e.target.value } : x
                  ),
                })
              }
              placeholder="峰名"
              className="h-7 w-28 px-2 text-xs"
            />
            <Input
              value={String(f.from)}
              onChange={(e) =>
                onChange({
                  ...chromatogram,
                  fractions: chromatogram.fractions.map((x) =>
                    x.id === f.id
                      ? { ...x, from: parseFloat(e.target.value) || 0 }
                      : x
                  ),
                })
              }
              inputMode="decimal"
              className="h-7 w-20 px-2 font-mono text-xs"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              value={String(f.to)}
              onChange={(e) =>
                onChange({
                  ...chromatogram,
                  fractions: chromatogram.fractions.map((x) =>
                    x.id === f.id
                      ? { ...x, to: parseFloat(e.target.value) || 0 }
                      : x
                  ),
                })
              }
              inputMode="decimal"
              className="h-7 w-20 px-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...chromatogram,
                  fractions: chromatogram.fractions.filter((x) => x.id !== f.id),
                })
              }
              className="p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <Input
        value={chromatogram.note}
        onChange={(e) => onChange({ ...chromatogram, note: e.target.value })}
        placeholder="备注"
        className="h-7 px-2 text-xs"
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      className="h-8 px-2 font-mono text-xs"
    />
  );
}
