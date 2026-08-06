"use client";

import type {
  TlnpFlowEdge,
  TlnpFlowNode,
} from "@/lib/calculations/tlnp-experiment";

const NODE_W = 176;
const NODE_H = 44;
const PAD = 16;

const FILL: Record<TlnpFlowNode["kind"], string> = {
  sample: "var(--pillar-lnp-subtle)",
  condition: "var(--accent-utility-subtle)",
  product: "var(--pillar-disease-subtle)",
};

const STROKE: Record<TlnpFlowNode["kind"], string> = {
  sample: "var(--pillar-lnp)",
  condition: "var(--accent-utility)",
  product: "var(--pillar-disease)",
};

interface Props {
  nodes: TlnpFlowNode[];
  edges: TlnpFlowEdge[];
  className?: string;
}

/**
 * A read-only render of the same graph, using the positions the user dragged.
 *
 * No library and no interactivity — this is what the overview report and the
 * print view show, where mounting a full canvas would be both heavy and
 * pointless. The geometry is deliberately simple so it can be ported to
 * @react-pdf's Svg primitives later.
 */
export default function ConjugationMapStatic({
  nodes,
  edges,
  className,
}: Props) {
  if (nodes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        还没有连线关系。
      </p>
    );
  }

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n) => n.position.x)) + NODE_W;
  const maxY = Math.max(...nodes.map((n) => n.position.y)) + NODE_H;

  const w = maxX - minX + PAD * 2;
  const h = maxY - minY + PAD * 2;
  const at = (n: TlnpFlowNode) => ({
    x: n.position.x - minX + PAD,
    y: n.position.y - minY + PAD,
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "h-auto w-full"}
      role="img"
      aria-label="样品与反应条件的连线关系图"
    >
      <title>样品 × 反应条件连线</title>

      <g fill="none" stroke="var(--border)" strokeWidth={1.5}>
        {edges.map((e) => {
          const s = byId.get(e.source);
          const t = byId.get(e.target);
          if (!s || !t) return null;
          const a = at(s);
          const b = at(t);
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          const dx = Math.max(30, (x2 - x1) / 2);
          return (
            <path
              key={e.id}
              d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
            />
          );
        })}
      </g>

      {nodes.map((n) => {
        const p = at(n);
        return (
          <g key={n.id}>
            <rect
              x={p.x}
              y={p.y}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              fill={FILL[n.kind]}
              stroke={STROKE[n.kind]}
              strokeWidth={1.5}
            />
            <text
              x={p.x + 10}
              y={p.y + NODE_H / 2 + 4}
              className="text-foreground"
              fill="currentColor"
              fontSize={11}
            >
              {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
