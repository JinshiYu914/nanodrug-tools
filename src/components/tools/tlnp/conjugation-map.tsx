"use client";

import dynamic from "next/dynamic";
import type {
  TlnpFlowEdge,
  TlnpFlowNode,
} from "@/lib/calculations/tlnp-experiment";

/**
 * The boundary around @xyflow/react.
 *
 * ssr:false is legal here because this file is itself a Client Component, and
 * necessary because the canvas measures its container on mount. The fixed
 * height matters for the same reason — xyflow renders nothing in a container
 * with no measured size.
 */
const ConjugationFlow = dynamic(() => import("./conjugation-flow"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] w-full items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
      画布加载中...
    </div>
  ),
});

interface Props {
  nodes: TlnpFlowNode[];
  edges: TlnpFlowEdge[];
  onChange: (nodes: TlnpFlowNode[], edges: TlnpFlowEdge[]) => void;
  hasSamples: boolean;
  hasConditions: boolean;
}

export default function ConjugationMap({
  nodes,
  edges,
  onChange,
  hasSamples,
  hasConditions,
}: Props) {
  if (!hasSamples || !hasConditions) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        {!hasSamples
          ? "先在「LNP 制备」里添加样品，才能在这里配对。"
          : "先新建一个反应条件，才能把样品连过去。"}
      </div>
    );
  }

  return <ConjugationFlow nodes={nodes} edges={edges} onChange={onChange} />;
}
