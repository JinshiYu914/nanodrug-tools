"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { NODE_TYPES, type FlowNodeData } from "./flow-nodes";
import { genId } from "@/lib/calculations/ribogreen";
import { isValidConnection } from "@/lib/calculations/tlnp-conjugation";
import type {
  TlnpFlowEdge,
  TlnpFlowNode,
} from "@/lib/calculations/tlnp-experiment";

/**
 * The only file in the codebase that imports @xyflow/react.
 *
 * The canvas never owns the truth. It converts our TlnpFlowNode/Edge into the
 * library's shapes on the way in and reports plain arrays back out, so the
 * stored blob is never shaped by a rendering library we might replace.
 */

function toFlowNodes(nodes: TlnpFlowNode[]): Node<FlowNodeData>[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: n.position,
    data: { label: n.label },
    // Products are derived from edges; dragging them is fine, deleting one
    // directly would just resurrect it on the next reconcile.
    deletable: n.kind !== "product",
  }));
}

function toFlowEdges(edges: TlnpFlowEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.label ? { label: e.label } : {}),
  }));
}

interface Props {
  nodes: TlnpFlowNode[];
  edges: TlnpFlowEdge[];
  onChange: (nodes: TlnpFlowNode[], edges: TlnpFlowEdge[]) => void;
}

export default function ConjugationFlow({ nodes, edges, onChange }: Props) {
  const { resolvedTheme } = useTheme();

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(
    toFlowNodes(nodes)
  );
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>(
    toFlowEdges(edges)
  );

  // The parent reconciles after every change (adding a condition, renaming a
  // sample), so mirror its arrays back down. Positions are preserved upstream
  // by layoutNodes, so this doesn't fight an in-progress drag.
  useEffect(() => {
    setRfNodes(toFlowNodes(nodes));
  }, [nodes, setRfNodes]);

  useEffect(() => {
    setRfEdges(toFlowEdges(edges));
  }, [edges, setRfEdges]);

  const commit = useCallback(
    (nextNodes: Node<FlowNodeData>[], nextEdges: Edge[]) => {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const mapped: TlnpFlowNode[] = nextNodes.flatMap((n) => {
        const prev = byId.get(n.id);
        return prev ? [{ ...prev, position: n.position }] : [];
      });
      const mappedEdges: TlnpFlowEdge[] = nextEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...(typeof e.label === "string" ? { label: e.label } : {}),
      }));
      onChange(mapped, mappedEdges);
    },
    [nodes, onChange]
  );

  const onConnect: OnConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const check = isValidConnection(nodes, edges, conn.source, conn.target);
      if (!check.ok) {
        toast.error(check.reason);
        return;
      }
      commit(rfNodes, [
        ...rfEdges,
        { id: genId(), source: conn.source, target: conn.target },
      ]);
    },
    [nodes, edges, rfNodes, rfEdges, commit]
  );

  // Positions are committed once per drag rather than per frame, so a drag is
  // one autosave instead of sixty.
  const onNodeDragStop = useCallback(() => {
    commit(rfNodes, rfEdges);
  }, [commit, rfNodes, rfEdges]);

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      const gone = new Set(deleted.map((e) => e.id));
      commit(
        rfNodes,
        rfEdges.filter((e) => !gone.has(e.id))
      );
    },
    [commit, rfNodes, rfEdges]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const gone = new Set(deleted.map((n) => n.id));
      commit(
        rfNodes.filter((n) => !gone.has(n.id)),
        rfEdges.filter((e) => !gone.has(e.source) && !gone.has(e.target))
      );
    },
    [commit, rfNodes, rfEdges]
  );

  const colorMode = useMemo(
    () => (resolvedTheme === "dark" ? ("dark" as const) : ("light" as const)),
    [resolvedTheme]
  );

  return (
    <div className="tlnp-flow h-[520px] w-full overflow-hidden rounded-lg border">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onConnect={onConnect}
        colorMode={colorMode}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
