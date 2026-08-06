"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
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
import { Textarea } from "@/components/ui/textarea";
import ConditionDialog from "./condition-dialog";
import ObservationTable from "./observation-table";
import ConjugationMap from "./conjugation-map";
import { genId } from "@/lib/calculations/ribogreen";
import {
  deriveProducts,
  describeConditionDose,
  layoutNodes,
  productName,
} from "@/lib/calculations/tlnp-conjugation";
import {
  createReactionCondition,
  type ReactionCondition,
  type TlnpConjugationModule,
  type TlnpExperimentData,
  type TlnpFlowEdge,
  type TlnpFlowNode,
} from "@/lib/calculations/tlnp-experiment";

interface Props {
  data: TlnpExperimentData;
  update: (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => void;
}

/**
 * Module 2 — reaction conditions, the sample × condition graph, and what the
 * unpurified product looked like.
 *
 * The graph is kept in sync from one place: whenever samples, conditions or
 * edges change, `layoutNodes` rebuilds the node list (preserving any position
 * the user has dragged) and `deriveProducts` rebuilds the products. Nothing
 * downstream recomputes either.
 */
export default function ModuleConjugation({ data, update }: Props) {
  const [editing, setEditing] = useState<ReactionCondition | null>(null);

  const conj = data.conjugation;
  const samples = data.prep.samples;

  const setConj = useCallback(
    (patch: (c: TlnpConjugationModule) => TlnpConjugationModule) =>
      update((prev) => ({ ...prev, conjugation: patch(prev.conjugation) })),
    [update]
  );

  /**
   * Re-derive nodes and products from the current samples, conditions and
   * edges. Edges that point at a deleted sample or condition are dropped here,
   * which is what makes deleting a condition cascade.
   */
  const reconcile = useCallback(
    (c: TlnpConjugationModule, edgesOverride?: TlnpFlowEdge[]) => {
      const nodesForValidation = layoutNodes(
        samples.map((s) => ({ id: s.id, name: s.name })),
        c.conditions.map((x) => ({ id: x.id, name: x.name })),
        [],
        c.nodes
      );
      const alive = new Set(nodesForValidation.map((n) => n.id));
      const edges = (edgesOverride ?? c.edges).filter(
        (e) => alive.has(e.source) && alive.has(e.target)
      );

      const products = deriveProducts(nodesForValidation, edges, c.products);
      const nodes = layoutNodes(
        samples.map((s) => ({ id: s.id, name: s.name })),
        c.conditions.map((x) => ({ id: x.id, name: x.name })),
        products.map((p) => ({
          id: p.id,
          label: productName(
            p,
            samples.find((s) => s.id === p.sampleId)?.name ?? "",
            c.conditions.find((x) => x.id === p.conditionId)?.name ?? ""
          ),
        })),
        c.nodes
      );

      return { ...c, nodes, edges, products };
    },
    [samples]
  );

  const productOptions = useMemo(
    () =>
      conj.products.map((p) => ({
        id: p.id,
        name: productName(
          p,
          samples.find((s) => s.id === p.sampleId)?.name ?? "",
          conj.conditions.find((c) => c.id === p.conditionId)?.name ?? ""
        ),
      })),
    [conj.products, conj.conditions, samples]
  );

  function saveCondition(next: ReactionCondition) {
    setConj((c) => {
      const exists = c.conditions.some((x) => x.id === next.id);
      const conditions = exists
        ? c.conditions.map((x) => (x.id === next.id ? next : x))
        : [...c.conditions, next];
      return reconcile({ ...c, conditions });
    });
    setEditing(null);
  }

  function removeCondition(id: string) {
    const target = conj.conditions.find((c) => c.id === id);
    if (!confirm(`删除反应条件「${target?.name ?? ""}」及其所有连线？`)) return;
    setConj((c) =>
      reconcile({ ...c, conditions: c.conditions.filter((x) => x.id !== id) })
    );
  }

  function duplicateCondition(c: ReactionCondition) {
    saveCondition({ ...c, id: genId(), name: `${c.name} (副本)` });
  }

  const handleGraphChange = useCallback(
    (nodes: TlnpFlowNode[], edges: TlnpFlowEdge[]) => {
      setConj((c) => reconcile({ ...c, nodes }, edges));
    },
    [setConj, reconcile]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent-utility" />
            <CardTitle className="text-base">反应条件</CardTitle>
          </div>
          <CardDescription>
            每套条件记录蛋白、摩尔比和反应参数，加样体系自动算好。
            同一个条件可以连给多个样品。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {conj.conditions.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed py-8 text-center">
              <p className="text-sm text-muted-foreground">
                还没有反应条件。新建一个后就能在下面的连线图里配对样品。
              </p>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setEditing(createReactionCondition(0))}
              >
                <Plus className="h-3.5 w-3.5" />
                新建反应条件
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {conj.conditions.map((c) => (
                  <div
                    key={c.id}
                    className="space-y-1 rounded-lg border border-accent-utility/35 bg-accent-utility-subtle p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {c.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.proteinName || "未填蛋白"}
                          {c.linker ? ` · ${c.linker}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <IconButton
                          title="编辑"
                          onClick={() => setEditing(c)}
                          icon={<Pencil className="h-3.5 w-3.5" />}
                        />
                        <IconButton
                          title="复制该条件"
                          onClick={() => duplicateCondition(c)}
                          icon={<Copy className="h-3.5 w-3.5" />}
                        />
                        <IconButton
                          title="删除"
                          danger
                          onClick={() => removeCondition(c.id)}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        />
                      </div>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {describeConditionDose(c) || "尚未填写加样参数"}
                    </p>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  setEditing(createReactionCondition(conj.conditions.length))
                }
              >
                <Plus className="h-3.5 w-3.5" />
                新建反应条件
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">样品 × 条件连线</CardTitle>
          <CardDescription>
            从样品节点右侧的圆点拖到反应条件节点左侧，即可生成一个 tLNP 产物。
            拖动节点可以重新排布，位置会一起保存。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConjugationMap
            nodes={conj.nodes}
            edges={conj.edges}
            onChange={handleGraphChange}
            hasSamples={samples.length > 0}
            hasConditions={conj.conditions.length > 0}
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
            products={productOptions}
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
            placeholder="例如：1:100 组反应后明显浑浊，可能是蛋白过量导致聚集；1:50 组外观正常"
            className="min-h-32 text-sm"
          />
        </CardContent>
      </Card>

      <ConditionDialog
        condition={editing}
        onClose={() => setEditing(null)}
        onSave={saveCondition}
      />
    </div>
  );
}

function IconButton({
  title,
  onClick,
  icon,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1 text-muted-foreground ${
        danger ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );
}
