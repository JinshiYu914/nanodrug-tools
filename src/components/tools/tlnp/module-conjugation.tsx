"use client";

import { useCallback, useMemo } from "react";
import { Beaker, Eye, Grid3x3, MessageSquare, Syringe } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import ModuleDate from "./module-date";
import ProteinBench from "./protein-bench";
import ReactionMatrix from "./reaction-matrix";
import DosingBoxes from "./dosing-boxes";
import ObservationTable from "./observation-table";
import { systemName } from "@/lib/calculations/tlnp-conjugation";
import type {
  ProteinEntry,
  ReactionSystem,
  TlnpConjugationModule,
  TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";

interface Props {
  data: TlnpExperimentData;
  update: (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => void;
}

/**
 * Module 2 — 抗体 → 反应体系矩阵 → 加样体系, then what the unpurified product
 * looked like.
 *
 * The three design cards are one pipeline read top to bottom: an antibody has
 * to exist before a column can point at it, and a column has to exist before
 * there is a volume to pipette.
 */
export default function ModuleConjugation({ data, update }: Props) {
  const conj = data.conjugation;
  const samples = data.prep.samples;

  const setConj = useCallback(
    (patch: (c: TlnpConjugationModule) => TlnpConjugationModule) =>
      update((prev) => ({ ...prev, conjugation: patch(prev.conjugation) })),
    [update]
  );

  const setSystems = useCallback(
    (systems: ReactionSystem[]) => setConj((c) => ({ ...c, systems })),
    [setConj]
  );

  const patchSystem = useCallback(
    (id: string, patch: Partial<ReactionSystem>) =>
      setConj((c) => ({
        ...c,
        systems: c.systems.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })),
    [setConj]
  );

  const setProteins = useCallback(
    (proteins: ProteinEntry[]) =>
      setConj((c) => ({
        ...c,
        proteins,
        // A removed protein must not leave columns pointing at nothing.
        systems: c.systems.map((s) =>
          s.proteinId && !proteins.some((p) => p.id === s.proteinId)
            ? { ...s, proteinId: "" }
            : s
        ),
      })),
    [setConj]
  );

  const systemOptions = useMemo(
    () => conj.systems.map((s, i) => ({ id: s.id, name: systemName(s, i) })),
    [conj.systems]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-accent-utility" />
              <CardTitle className="text-base">抗体信息</CardTitle>
            </div>
            <ModuleDate
              value={conj.design.date}
              onChange={(date) => setConj((c) => ({ ...c, design: { date } }))}
            />
          </div>
          <CardDescription>
            本批次用到的偶联抗体。填一次即可存进抗体库，之后所有批次都能直接选用。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProteinBench proteins={conj.proteins} onChange={setProteins} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-accent-utility" />
            <CardTitle className="text-base">反应体系</CardTitle>
          </div>
          <CardDescription>
            每一列是一个反应体系，默认取上一步制备好的 LNP（浓度、投料量、linker
            比例都会带过来）；每一行是一项反应条件。摩尔比按 linker : 抗体 计，
            这是真正参与反应的基团数。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReactionMatrix
            systems={conj.systems}
            onChange={setSystems}
            samples={samples}
            proteins={conj.proteins}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Syringe className="h-4 w-4 text-accent-utility" />
            <CardTitle className="text-base">加样体系</CardTitle>
          </div>
          <CardDescription>每个体系单独算，并附上计算过程。</CardDescription>
        </CardHeader>
        <CardContent>
          <DosingBoxes
            systems={conj.systems}
            proteins={conj.proteins}
            onChange={patchSystem}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-pillar-utr" />
            <CardTitle className="text-base">肉眼观测（未纯化）</CardTitle>
          </div>
          <CardDescription>
            偶联后、纯化前的外观。浑浊或大量沉淀会标出来。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ObservationTable
            rows={conj.results.observations}
            onChange={(observations) =>
              setConj((c) => ({
                ...c,
                results: { ...c.results, observations },
              }))
            }
            systems={systemOptions}
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
            value={conj.results.discussion}
            onChange={(e) =>
              setConj((c) => ({
                ...c,
                results: { ...c.results, discussion: e.target.value },
              }))
            }
            placeholder="例如：1:2 组反应后明显浑浊，可能是抗体过量导致聚集；1:1 组外观正常"
            className="min-h-32 text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}
