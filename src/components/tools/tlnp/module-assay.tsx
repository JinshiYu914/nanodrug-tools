"use client";

import { useMemo } from "react";
import { Microscope, MessageSquare, Mouse } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Chip from "./chip";
import ModuleDate from "./module-date";
import ParamBench from "./param-bench";
import MetricTable from "./metric-table";
import { systemName } from "@/lib/calculations/tlnp-conjugation";
import type {
  TlnpAssayModule,
  TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";

interface Props {
  data: TlnpExperimentData;
  update: (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => void;
}

/**
 * Module 4 — 体外 and 体内, switched rather than tabbed so the choice persists
 * with the batch. Both arms are always stored; switching never discards.
 *
 * The subject list offered to both result tables is the batch's reaction
 * systems when there are any, falling back to the bare samples — what you dose
 * is the tLNP, not the naked LNP, once module 2 has run.
 */
export default function ModuleAssay({ data, update }: Props) {
  const assay = data.assay;

  const setAssay = (patch: (a: TlnpAssayModule) => TlnpAssayModule) =>
    update((prev) => ({ ...prev, assay: patch(prev.assay) }));

  const subjects = useMemo(() => {
    const systems = data.conjugation.systems.map(systemName);
    if (systems.length > 0) return systems;
    return data.prep.samples.map((s, i) => s.name || `样品 ${i + 1}`);
  }, [data.conjugation.systems, data.prep.samples]);

  const isVitro = assay.active === "invitro";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Chip
          active={isVitro}
          onClick={() => setAssay((a) => ({ ...a, active: "invitro" }))}
        >
          体外实验
        </Chip>
        <Chip
          active={!isVitro}
          onClick={() => setAssay((a) => ({ ...a, active: "invivo" }))}
        >
          体内实验
        </Chip>
      </div>

      {isVitro ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Microscope className="h-4 w-4 text-pillar-disease" />
                  <CardTitle className="text-base">体外实验设计</CardTitle>
                </div>
                <ModuleDate
                  value={assay.invitro.design.date}
                  onChange={(date) =>
                    setAssay((a) => ({
                      ...a,
                      invitro: {
                        ...a.invitro,
                        design: { ...a.invitro.design, date },
                      },
                    }))
                  }
                />
              </div>
              <CardDescription>
                细胞系、孔板、转染时的细胞密度与剂量。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="细胞系">
                  <Input
                    value={assay.invitro.design.cellLine}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invitro: {
                          ...a.invitro,
                          design: {
                            ...a.invitro.design,
                            cellLine: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="例如 原代 T 细胞"
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="代数（如 A1P1）">
                  <Input
                    value={assay.invitro.design.passage}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invitro: {
                          ...a.invitro,
                          design: {
                            ...a.invitro.design,
                            passage: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="A1P1"
                    className="h-8 font-mono text-xs"
                  />
                </Field>
                <Field label="孔板">
                  <Input
                    value={assay.invitro.design.plate}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invitro: {
                          ...a.invitro,
                          design: { ...a.invitro.design, plate: e.target.value },
                        },
                      }))
                    }
                    placeholder="96 孔板"
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="转染时细胞密度">
                  <Input
                    value={assay.invitro.design.seedingDensity}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invitro: {
                          ...a.invitro,
                          design: {
                            ...a.invitro.design,
                            seedingDensity: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="例如 1×10⁵ /well"
                    className="h-8 font-mono text-xs"
                  />
                </Field>
                <Field label="剂量">
                  <Input
                    value={assay.invitro.design.dose}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invitro: {
                          ...a.invitro,
                          design: { ...a.invitro.design, dose: e.target.value },
                        },
                      }))
                    }
                    placeholder="例如 100 ng RNA/well"
                    className="h-8 font-mono text-xs"
                  />
                </Field>
                <Field label="检测时间点">
                  <Input
                    value={assay.invitro.design.timepoints}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invitro: {
                          ...a.invitro,
                          design: {
                            ...a.invitro.design,
                            timepoints: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="例如 24 h / 48 h"
                    className="h-8 text-xs"
                  />
                </Field>
              </div>

              <ParamBench
                entries={assay.invitro.design.params}
                onChange={(params) =>
                  setAssay((a) => ({
                    ...a,
                    invitro: {
                      ...a.invitro,
                      design: { ...a.invitro.design, params },
                    },
                  }))
                }
                title="其他体外参数"
              />

              <Field label="设计备注（可选）">
                <Textarea
                  value={assay.invitro.design.note}
                  onChange={(e) =>
                    setAssay((a) => ({
                      ...a,
                      invitro: {
                        ...a.invitro,
                        design: { ...a.invitro.design, note: e.target.value },
                      },
                    }))
                  }
                  className="min-h-16 text-sm"
                />
              </Field>
            </CardContent>
          </Card>

          <ResultsCard
            title="体外结果"
            rows={assay.invitro.results.rows}
            discussion={assay.invitro.results.discussion}
            subjects={subjects}
            onRows={(rows) =>
              setAssay((a) => ({
                ...a,
                invitro: {
                  ...a.invitro,
                  results: { ...a.invitro.results, rows },
                },
              }))
            }
            onDiscussion={(discussion) =>
              setAssay((a) => ({
                ...a,
                invitro: {
                  ...a.invitro,
                  results: { ...a.invitro.results, discussion },
                },
              }))
            }
          />
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Mouse className="h-4 w-4 text-pillar-disease" />
                  <CardTitle className="text-base">体内实验设计</CardTitle>
                </div>
                <ModuleDate
                  value={assay.invivo.design.date}
                  onChange={(date) =>
                    setAssay((a) => ({
                      ...a,
                      invivo: {
                        ...a.invivo,
                        design: { ...a.invivo.design, date },
                      },
                    }))
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="动物">
                  <Input
                    value={assay.invivo.design.species}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invivo: {
                          ...a.invivo,
                          design: {
                            ...a.invivo.design,
                            species: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="例如 BALB/c 小鼠"
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="品系 / 周龄">
                  <Input
                    value={assay.invivo.design.strain}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invivo: {
                          ...a.invivo,
                          design: { ...a.invivo.design, strain: e.target.value },
                        },
                      }))
                    }
                    placeholder="例如 雌性 6–8 周"
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="给药途径">
                  <Input
                    value={assay.invivo.design.route}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invivo: {
                          ...a.invivo,
                          design: { ...a.invivo.design, route: e.target.value },
                        },
                      }))
                    }
                    placeholder="例如 尾静脉"
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="剂量">
                  <Input
                    value={assay.invivo.design.dose}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invivo: {
                          ...a.invivo,
                          design: { ...a.invivo.design, dose: e.target.value },
                        },
                      }))
                    }
                    placeholder="例如 0.5 mg/kg"
                    className="h-8 font-mono text-xs"
                  />
                </Field>
                <Field label="分组">
                  <Input
                    value={assay.invivo.design.groups}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invivo: {
                          ...a.invivo,
                          design: { ...a.invivo.design, groups: e.target.value },
                        },
                      }))
                    }
                    placeholder="例如 5 组 × n=3"
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="检测时间点">
                  <Input
                    value={assay.invivo.design.timepoints}
                    onChange={(e) =>
                      setAssay((a) => ({
                        ...a,
                        invivo: {
                          ...a.invivo,
                          design: {
                            ...a.invivo.design,
                            timepoints: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder="例如 6 h / 24 h"
                    className="h-8 text-xs"
                  />
                </Field>
              </div>

              <ParamBench
                entries={assay.invivo.design.params}
                onChange={(params) =>
                  setAssay((a) => ({
                    ...a,
                    invivo: {
                      ...a.invivo,
                      design: { ...a.invivo.design, params },
                    },
                  }))
                }
                title="其他体内参数"
              />

              <Field label="设计备注（可选）">
                <Textarea
                  value={assay.invivo.design.note}
                  onChange={(e) =>
                    setAssay((a) => ({
                      ...a,
                      invivo: {
                        ...a.invivo,
                        design: { ...a.invivo.design, note: e.target.value },
                      },
                    }))
                  }
                  className="min-h-16 text-sm"
                />
              </Field>
            </CardContent>
          </Card>

          <ResultsCard
            title="体内结果"
            rows={assay.invivo.results.rows}
            discussion={assay.invivo.results.discussion}
            subjects={subjects}
            onRows={(rows) =>
              setAssay((a) => ({
                ...a,
                invivo: { ...a.invivo, results: { ...a.invivo.results, rows } },
              }))
            }
            onDiscussion={(discussion) =>
              setAssay((a) => ({
                ...a,
                invivo: {
                  ...a.invivo,
                  results: { ...a.invivo.results, discussion },
                },
              }))
            }
          />
        </>
      )}
    </div>
  );
}

function ResultsCard({
  title,
  rows,
  discussion,
  subjects,
  onRows,
  onDiscussion,
}: {
  title: string;
  rows: TlnpAssayModule["invitro"]["results"]["rows"];
  discussion: string;
  subjects: string[];
  onRows: (rows: TlnpAssayModule["invitro"]["results"]["rows"]) => void;
  onDiscussion: (v: string) => void;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>
            一行一个测量值。「分组」用来区分时间点、剂量组或重复。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MetricTable rows={rows} onChange={onRows} subjects={subjects} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">结果分析与讨论</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={discussion}
            onChange={(e) => onDiscussion(e.target.value)}
            placeholder="例如：靶向组的表达量比对照高约 4 倍，且随剂量递增"
            className="min-h-32 text-sm"
          />
        </CardContent>
      </Card>
    </>
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
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
