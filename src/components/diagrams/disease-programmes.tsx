import { DiagramFrame, Label, STROKE, type DiagramProps } from "./primitives";

const BRANCHES = [
  { y: 58, label: "in vivo CAR-T · lupus" },
  { y: 106, label: "PCSK9 editing" },
  { y: 154, label: "Cytokine therapy" },
  { y: 202, label: "LYTAC degrader" },
] as const;

/** Square crop around the cell blob, which spans x 79–215 and y 60–200. */
const CROP = "74 56 148 148";

/**
 * What the platform is for: one particle reaches one cell, and four programmes
 * branch out of that single delivery event.
 *
 * Drawn as a fan rather than a stack because the four are alternatives sharing
 * an upstream, not a sequence — the shape encodes that.
 *
 * `thumb` is the cell alone. Wherever it appears at that size the arrival and
 * the fan are already drawn by the surrounding layout (see `dose-route.tsx`),
 * so keeping them here would draw the particle and the branches twice.
 */
export function DiseaseProgrammes({ variant = "full", className }: DiagramProps) {
  const full = variant === "full";

  return (
    <DiagramFrame
      title={
        full
          ? "Four disease programmes branching from one delivery event"
          : "A cell with the delivered message inside it"
      }
      desc="A lipid nanoparticle enters a cell; from that cell, four branches lead to targeted protein degradation, tumour immunotherapy, gene editing, and cell therapy."
      viewBox={full ? "0 0 400 256" : CROP}
      className={className}
    >
      {/* Incoming particle */}
      {full ? (
        <>
          <path
            d="M30 128c10 0 17 7 17 15s-7 16-17 15-16-7-16-15 6-15 16-15Z"
            fill="var(--pillar-lnp)"
            stroke="currentColor"
            strokeWidth={STROKE.detail}
          />
          <path d="M52 143h18" stroke="currentColor" strokeWidth={STROKE.detail} />
          <path d="M64 138l7 5-7 5" stroke="currentColor" strokeWidth={STROKE.detail} />
        </>
      ) : null}

      {/* Cell — an uneven blob, not a circle. Filled with --card rather than
          the pillar tint: it is a third of the drawing, and a warm fill that
          large goes muddy in dark mode. */}
      <path
        d="M148 62c40 2 68 33 66 74-2 40-33 66-72 63-38-3-63-33-61-71 2-39 31-68 67-66Z"
        fill="var(--card)"
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
      {full
        ? BRANCHES.map((branch) => (
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
              <Label x={282} y={branch.y + 4} text={branch.label} tone="ink" />
            </g>
          ))
        : null}
    </DiagramFrame>
  );
}
