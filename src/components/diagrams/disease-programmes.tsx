import { DiagramFrame, Label, STROKE, type DiagramProps } from "./primitives";

const BRANCHES = [
  { y: 58, label: "Targeted protein degradation" },
  { y: 106, label: "Tumour immunotherapy" },
  { y: 154, label: "Gene editing" },
  { y: 202, label: "Cell therapy" },
] as const;

/**
 * What the platform is for: one particle reaches one cell, and four programmes
 * branch out of that single delivery event.
 *
 * Drawn as a fan rather than a stack because the four are alternatives sharing
 * an upstream, not a sequence — the shape encodes that.
 */
export function DiseaseProgrammes({ variant = "full", className }: DiagramProps) {
  const showLabels = variant === "full";

  return (
    <DiagramFrame
      title="Four disease programmes branching from one delivery event"
      desc="A lipid nanoparticle enters a cell; from that cell, four branches lead to targeted protein degradation, tumour immunotherapy, gene editing, and cell therapy."
      viewBox="0 0 400 256"
      className={className}
    >
      {/* Incoming particle */}
      <path
        d="M30 128c10 0 17 7 17 15s-7 16-17 15-16-7-16-15 6-15 16-15Z"
        fill="var(--pillar-lnp)"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
      />
      <path
        d="M52 143h18"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
      />
      <path
        d="M64 138l7 5-7 5"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
      />

      {/* Cell — an uneven blob, not a circle */}
      <path
        d="M148 62c40 2 68 33 66 74-2 40-33 66-72 63-38-3-63-33-61-71 2-39 31-68 67-66Z"
        fill="var(--pillar-disease-subtle)"
        stroke="currentColor"
        strokeWidth={STROKE.structure}
      />
      {/* Nucleus */}
      <path
        d="M150 106c19 1 32 15 31 34-1 18-16 30-34 29-18-2-29-16-28-34 1-18 14-30 31-29Z"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
        opacity="0.75"
      />
      {/* Delivered payload inside the nucleus region */}
      <path
        d="M138 136c5-8 10-8 15 0s10 8 15 0"
        stroke="var(--pillar-lnp)"
        strokeWidth={STROKE.detail}
      />

      {/* Fan of outcomes */}
      {BRANCHES.map((branch) => (
        <g key={branch.y}>
          <path
            d={`M214 138C238 138 240 ${branch.y} 262 ${branch.y}`}
            stroke="var(--pillar-disease)"
            strokeWidth={STROKE.detail}
            opacity="0.8"
          />
          <circle
            cx="268"
            cy={branch.y}
            r="5.5"
            fill="var(--pillar-disease)"
            stroke="none"
          />
        </g>
      ))}

      {showLabels
        ? BRANCHES.map((branch) => (
            <Label
              key={branch.y}
              x={282}
              y={branch.y + 4}
              text={branch.label}
              tone="ink"
            />
          ))
        : null}
    </DiagramFrame>
  );
}
