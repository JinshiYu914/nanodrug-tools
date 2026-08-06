"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FlaskConical, Link2, Sparkles } from "lucide-react";

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  sub?: string;
}

/**
 * Node bodies are our own JSX so the canvas never renders xyflow's default
 * card. Each kind wears its module-appropriate categorical token:
 * samples are LNPs (amber), conditions are a process step (violet), products
 * are what goes on to the biology (magenta).
 */
function NodeCard({
  icon,
  label,
  sub,
  border,
  bg,
  selected,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  border: string;
  bg: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`w-52 rounded-lg border-2 px-3 py-2 ${border} ${bg} ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="truncate text-sm font-semibold">
          {label || "(未命名)"}
        </span>
      </div>
      {sub && (
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  );
}

export function SampleNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <>
      <NodeCard
        icon={<FlaskConical className="h-3.5 w-3.5 shrink-0 text-pillar-lnp" />}
        label={d.label}
        sub={d.sub}
        border="border-pillar-lnp/50"
        bg="bg-pillar-lnp-subtle"
        selected={selected}
      />
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeCard
        icon={<Link2 className="h-3.5 w-3.5 shrink-0 text-accent-utility" />}
        label={d.label}
        sub={d.sub}
        border="border-accent-utility/50"
        bg="bg-accent-utility-subtle"
        selected={selected}
      />
      <Handle type="source" position={Position.Right} />
    </>
  );
}

export function ProductNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NodeCard
        icon={<Sparkles className="h-3.5 w-3.5 shrink-0 text-pillar-disease" />}
        label={d.label}
        sub={d.sub}
        border="border-pillar-disease/50"
        bg="bg-pillar-disease-subtle"
        selected={selected}
      />
    </>
  );
}

export const NODE_TYPES = {
  sample: SampleNode,
  condition: ConditionNode,
  product: ProductNode,
};
