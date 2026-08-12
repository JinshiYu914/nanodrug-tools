"use client";

import { useMemo, useState } from "react";
import {
  Calculator,
  FlaskConical,
  MessageSquare,
  Rows3,
  TestTube2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ParamBench from "./param-bench";
import SolventExchangePicker from "./solvent-exchange";
import SampleTable from "./sample-table";
import SampleEditorDialog from "./sample-editor-dialog";
import FormulationOutput from "./formulation-output";
import ModuleDate from "./module-date";
import CharacterizationMatrix, {
  type CharacterizationPatch,
} from "./characterization-matrix";
import RibogreenHandoffButton from "./ribogreen-handoff-button";
import { extractLink, useRibogreenRecords } from "./use-ribogreen-link";
import { paramValue } from "@/lib/calculations/tlnp-params";
import type {
  TlnpExperimentData,
  TlnpPrepModule,
  TlnpPrepSample,
} from "@/lib/calculations/tlnp-experiment";

interface Props {
  data: TlnpExperimentData;
  update: (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => void;
  batchId: string;
  batchName: string;
  createdAt: string;
  updatedAt: string;
  cloudEnabled: boolean;
}

/** Module 1 — 实验设计 above, 表征结果 below. */
export default function ModulePrep({
  data,
  update,
  batchId,
  batchName,
  createdAt,
  updatedAt,
  cloudEnabled,
}: Props) {
  const prep = data.prep;
  const [editing, setEditing] = useState<TlnpPrepSample | null>(null);
  const { records, loading, reload } = useRibogreenRecords(
    cloudEnabled && prep.samples.length > 0
  );

  const setPrep = (patch: (p: TlnpPrepModule) => TlnpPrepModule) =>
    update((prev) => ({ ...prev, prep: patch(prev.prep) }));

  const setSamples = (samples: TlnpPrepSample[]) =>
    setPrep((p) => ({ ...p, samples }));

  const patchSample = (id: string, patch: CharacterizationPatch) =>
    setPrep((p) => ({
      ...p,
      samples: p.samples.map((s) =>
        s.id === id
          ? {
              ...s,
              ...(patch.ee ? { ee: patch.ee } : {}),
              ...(patch.dls ? { dls: patch.dls } : {}),
              ...(patch.tem !== undefined ? { tem: patch.tem } : {}),
              ...(patch.note !== undefined ? { resultNote: patch.note } : {}),
            }
          : s
      ),
    }));

  const rows = useMemo(
    () =>
      prep.samples.map((s, i) => ({
        id: s.id,
        name: s.name || `样品 ${i + 1}`,
        ee: s.ee,
        dls: s.dls,
        tem: s.tem,
        note: s.resultNote,
      })),
    [prep.samples]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-pillar-lnp" />
              <CardTitle className="text-base">实验设计</CardTitle>
            </div>
            <ModuleDate
              value={prep.design.date}
              onChange={(date) =>
                setPrep((p) => ({ ...p, design: { ...p.design, date } }))
              }
            />
          </div>
          <CardDescription>
            记录这批 LNP 用了什么、怎么做的。每个参数都可以点选，也可以直接输入；
            输入过的值可以存成选项，下次直接点。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ParamBench
            entries={prep.design.params}
            onChange={(params) =>
              setPrep((p) => ({
                ...p,
                design: { ...p.design, params },
              }))
            }
            title="制备参数"
          />

          <SolventExchangePicker
            value={prep.design.solvent}
            onChange={(solvent) =>
              setPrep((p) => ({ ...p, design: { ...p.design, solvent } }))
            }
          />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              设计备注（可选）
            </Label>
            <Textarea
              value={prep.design.note}
              onChange={(e) =>
                setPrep((p) => ({
                  ...p,
                  design: { ...p.design, note: e.target.value },
                }))
              }
              placeholder="这批为什么这么设计、和上一批的差异、需要注意的地方"
              className="min-h-20 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Rows3 className="h-4 w-4 text-pillar-lnp" />
            <CardTitle className="text-base">样品配方设计</CardTitle>
          </div>
          <CardDescription>
            默认五个组分：阳离子脂质 / 辅助脂质 / 胆固醇 / PEG 脂质 / 偶联用
            linker 脂质。每行一个样品，直接改摩尔比即可；脂质种类、分子量、母液浓度
            和其余制备参数点铅笔图标进入完整编辑器。添加样品会复制上一行，通常只需要改比例。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SampleTable
            samples={prep.samples}
            onChange={setSamples}
            onEdit={setEditing}
            linkerName={paramValue(prep.design.params, "linker")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-pillar-lnp" />
            <CardTitle className="text-base">生成配方</CardTitle>
          </div>
          <CardDescription>
            与 LNP Calculator 使用同一套计算，数字逐位一致。可直接下载 PDF /
            Excel 带去实验台。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormulationOutput
            batchName={batchName}
            createdAt={createdAt}
            updatedAt={updatedAt}
            samples={prep.samples}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4 text-pillar-utr" />
              <CardTitle className="text-base">表征结果</CardTitle>
            </div>
            <RibogreenHandoffButton
              batchId={batchId}
              stage="prep"
              disabled={prep.samples.length === 0}
              onRefresh={() => void reload()}
              refreshing={loading}
              loginRequired={!cloudEnabled}
            />
          </div>
          <CardDescription>
            一行一个样品，一列一个指标。包封率可以直接填，也可以点「输入样品数值计算」
            到 RiboGreen 计算器测完带回来 —— 带回来的数值来自拟合曲线，不可手改。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CharacterizationMatrix
            rows={rows}
            onChange={patchSample}
            candidates={records}
            recordsLoading={loading}
            onImport={(id, record) => {
              const sample = prep.samples.find((s) => s.id === id);
              if (!sample) return;
              const link = extractLink(record, id);
              if (!link) {
                toast.error("该记录里找不到这个样品的读数");
                return;
              }
              patchSample(id, { ee: { ...sample.ee, link } });
              toast.success(`已导入「${record.name}」的检测结果`);
            }}
            emptyHint="添加样品后，这里会为每个样品记录包封率、粒径、PDI、Zeta 与 TEM。"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">实验结果与讨论</CardTitle>
          </div>
          <CardDescription>
            这批 LNP 的整体结论 —— 单个样品的包封率和粒径记录在样品表里。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={prep.results.discussion}
            onChange={(e) =>
              setPrep((p) => ({
                ...p,
                results: { ...p.results, discussion: e.target.value },
              }))
            }
            placeholder="例如：N/P 6 组包封率明显高于 N/P 4；PEG 1.5% 的粒径偏大，下批降到 1%"
            className="min-h-32 text-sm"
          />
        </CardContent>
      </Card>

      <SampleEditorDialog
        sample={editing}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          setSamples(prep.samples.map((s) => (s.id === next.id ? next : s)));
          setEditing(null);
        }}
      />
    </div>
  );
}
