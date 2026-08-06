"use client";

import { useState } from "react";
import {
  Columns3,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  TestTube2,
  Trash2,
} from "lucide-react";
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
import ParamBench from "./param-bench";
import DlsFields from "./dls-fields";
import ChromatogramImport from "./chromatogram-import";
import ChromatogramChart from "./chromatogram-chart";
import { genId } from "@/lib/calculations/ribogreen";
import {
  PURIFICATION_METHOD_LABELS,
  resolveEe,
  type Chromatogram,
  type PurificationMethod,
  type TlnpExperimentData,
  type TlnpPurificationModule,
} from "@/lib/calculations/tlnp-experiment";

const METHODS: PurificationMethod[] = ["cl4b", "ultrafiltration", "dialysis"];

interface Props {
  data: TlnpExperimentData;
  update: (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => void;
}

export default function ModulePurification({ data, update }: Props) {
  const [adding, setAdding] = useState(false);
  const pur = data.purification;

  const setPur = (patch: (p: TlnpPurificationModule) => TlnpPurificationModule) =>
    update((prev) => ({ ...prev, purification: patch(prev.purification) }));

  const setDesign = (patch: Partial<TlnpPurificationModule["design"]>) =>
    setPur((p) => ({ ...p, design: { ...p.design, ...patch } }));

  const ee = resolveEe(pur.results.ee);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Columns3 className="h-4 w-4 text-pillar-utr" />
            <CardTitle className="text-base">纯化方法</CardTitle>
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
                {PURIFICATION_METHOD_LABELS[m as Exclude<PurificationMethod, "">]}
              </Chip>
            ))}
          </div>

          {pur.design.method === "cl4b" && (
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  className="h-8 text-xs"
                />
              </Field>
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
                  className="h-8 text-xs"
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
                    setDesign({
                      dialysis: { ...pur.design.dialysis, mwco: v },
                    })
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
                  className="h-8 text-xs"
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
                  className="h-8 text-xs"
                />
              </Field>
            </div>
          )}

          <ParamBench
            entries={pur.design.params}
            onChange={(params) => setDesign({ params })}
            title="其他纯化参数"
          />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              设计备注（可选）
            </Label>
            <Textarea
              value={pur.design.note}
              onChange={(e) => setDesign({ note: e.target.value })}
              className="min-h-16 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">层析结果</CardTitle>
          <CardDescription>
            导入纯化数据自动生成峰图。收集峰段可以标出来，会画在图上。
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
              onImport={(c) => {
                setPur((p) => ({ ...p, chromatograms: [...p.chromatograms, c] }));
                setAdding(false);
              }}
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
          <div className="flex items-center gap-2">
            <TestTube2 className="h-4 w-4 text-pillar-utr" />
            <CardTitle className="text-base">纯化后表征</CardTitle>
          </div>
          <CardDescription>
            纯化后的整体检测结果。逐样品的数据记录在「LNP 制备」的表征结果里。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium">RiboGreen（纯化后）</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="浓度 (ng/µL)">
                <NumInput
                  value={pur.results.ee.manual.conc_ng_uL}
                  onChange={(v) =>
                    setPur((p) => ({
                      ...p,
                      results: {
                        ...p.results,
                        ee: {
                          ...p.results.ee,
                          manual: { ...p.results.ee.manual, conc_ng_uL: v },
                        },
                      },
                    }))
                  }
                />
              </Field>
              <Field label="体积 (µL)">
                <NumInput
                  value={pur.results.ee.manual.volume_uL}
                  onChange={(v) =>
                    setPur((p) => ({
                      ...p,
                      results: {
                        ...p.results,
                        ee: {
                          ...p.results.ee,
                          manual: { ...p.results.ee.manual, volume_uL: v },
                        },
                      },
                    }))
                  }
                />
              </Field>
              <Field label="包封率 (%)">
                <NumInput
                  value={pur.results.ee.manual.ee_percent}
                  onChange={(v) =>
                    setPur((p) => ({
                      ...p,
                      results: {
                        ...p.results,
                        ee: {
                          ...p.results.ee,
                          manual: { ...p.results.ee.manual, ee_percent: v },
                        },
                      },
                    }))
                  }
                />
              </Field>
              <Field label="回收率 (%)">
                <NumInput
                  value={pur.results.ee.manual.yield_percent}
                  onChange={(v) =>
                    setPur((p) => ({
                      ...p,
                      results: {
                        ...p.results,
                        ee: {
                          ...p.results.ee,
                          manual: { ...p.results.ee.manual, yield_percent: v },
                        },
                      },
                    }))
                  }
                />
              </Field>
            </div>
            {ee.source !== "none" && (
              <p className="font-mono text-[11px] text-muted-foreground">
                回收 {ee.yield_ === null ? "--" : `${ee.yield_.toFixed(1)}%`} ·
                包封 {ee.ee === null ? "--" : `${ee.ee.toFixed(1)}%`}
              </p>
            )}
          </div>

          <div className="rounded-lg border p-3">
            <DlsFields
              value={pur.results.dls}
              onChange={(dls) =>
                setPur((p) => ({ ...p, results: { ...p.results, dls } }))
              }
            />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              TEM
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="图片链接">
                <Input
                  value={pur.results.tem.imageUrl}
                  onChange={(e) =>
                    setPur((p) => ({
                      ...p,
                      results: {
                        ...p.results,
                        tem: { ...p.results.tem, imageUrl: e.target.value },
                      },
                    }))
                  }
                  placeholder="https://..."
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="放大倍数">
                <Input
                  value={pur.results.tem.magnification}
                  onChange={(e) =>
                    setPur((p) => ({
                      ...p,
                      results: {
                        ...p.results,
                        tem: {
                          ...p.results.tem,
                          magnification: e.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="例如 50,000×"
                  className="h-8 text-xs"
                />
              </Field>
            </div>
            <Input
              value={pur.results.tem.note}
              onChange={(e) =>
                setPur((p) => ({
                  ...p,
                  results: {
                    ...p.results,
                    tem: { ...p.results.tem, note: e.target.value },
                  },
                }))
              }
              placeholder="形貌描述，例如 球形均一，未见明显聚集"
              className="h-8 text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              暂时只支持外部图片链接，直接上传会在后续版本加上。
            </p>
          </div>
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
            placeholder="例如：CL4B 第一个峰是 tLNP，第二个峰是游离蛋白，分离度良好"
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
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          value={chromatogram.name}
          onChange={(e) => onChange({ ...chromatogram, name: e.target.value })}
          className="h-8 max-w-64 text-xs font-medium"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {chromatogram.points.length} 点 · {chromatogram.channels.length} 通道
            {chromatogram.sourceName ? ` · ${chromatogram.sourceName}` : ""}
          </span>
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

      <ChromatogramChart chromatogram={chromatogram} />

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
              className="h-7 w-28 text-xs"
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
              className="h-7 w-20 font-mono text-xs"
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
              className="h-7 w-20 font-mono text-xs"
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
        className="h-7 text-xs"
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
      className="h-8 font-mono text-xs"
    />
  );
}
