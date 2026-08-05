import { DiagramFrame, Label, STROKE, type DiagramProps } from "./primitives";

const CX = 122;
const CY = 128;
const R_INNER = 62;
const R_OUTER = 78;

/** Fixed wobble per element. Deterministic, so SSR and client agree. */
const JITTER = [0.9, -1.4, 0.5, 1.8, -0.7, 1.2, -1.9, 0.3, 1.5, -1.1, 0.8, -0.4];

function polar(angle: number, radius: number) {
  return [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius] as const;
}

/**
 * An LNP in cross-section: PEG bristles, the lipid shell, an aqueous core
 * holding the mRNA, and one conjugated antibody.
 *
 * The antibody is the point of the drawing — it is what separates passive
 * hepatic uptake from active targeting, so it carries the accent colour while
 * everything structural stays ink. Shell arcs are hand-perturbed circles
 * rather than <circle>, which is what gives the drawn feel.
 */
export function LnpCrossSection({ variant = "full", className }: DiagramProps) {
  const showLabels = variant === "full";

  const tails = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2 + 0.11;
    const wobble = JITTER[i % JITTER.length];
    const [x1, y1] = polar(angle, R_INNER + wobble * 0.4);
    const [x2, y2] = polar(angle, R_OUTER + wobble);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }).join("");

  const pegs = Array.from({ length: 9 }, (_, i) => {
    const angle = (i / 9) * Math.PI * 2 + 0.42;
    const wobble = JITTER[i % JITTER.length];
    const [x1, y1] = polar(angle, R_OUTER + 2);
    const [xm, ym] = polar(angle + 0.1, R_OUTER + 11 + wobble);
    const [x2, y2] = polar(angle - 0.07, R_OUTER + 19 + wobble);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${xm.toFixed(1)} ${ym.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }).join("");

  return (
    <DiagramFrame
      title="Lipid nanoparticle in cross-section"
      desc="A PEGylated lipid shell around an aqueous core containing coiled mRNA, with a targeting antibody conjugated to the surface."
      viewBox="0 0 400 256"
      className={className}
    >
      <path d={pegs} stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.6" />
      <path d={tails} stroke="currentColor" strokeWidth={STROKE.hair} opacity="0.45" />

      {/* Outer shell */}
      <path
        d="M122 50C166 51 201 86 200 129C199 172 165 207 121 206C78 205 44 170 45 127C46 85 79 49 122 50Z"
        stroke="currentColor"
        strokeWidth={STROKE.structure}
      />
      {/* Inner leaflet */}
      <path
        d="M122 66C157 67 185 95 184 129C183 163 156 191 122 190C88 189 60 162 61 128C62 94 88 65 122 66Z"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
        opacity="0.7"
      />
      {/* Aqueous core */}
      <path
        d="M122 78C150 79 173 102 172 129C171 156 149 179 122 178C95 177 72 155 73 128C74 101 95 77 122 78Z"
        fill="var(--pillar-lnp-subtle)"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
      />

      {/* mRNA payload */}
      <path
        d="M92 132c8-15 17-15 25 0s17 15 25 0"
        stroke="var(--pillar-lnp)"
        strokeWidth={STROKE.structure}
      />
      <path
        d="M97 150c7-11 14-11 21 0s14 11 21 0"
        stroke="var(--pillar-lnp)"
        strokeWidth={STROKE.detail}
        opacity="0.55"
      />

      {/* Conjugated antibody */}
      <g stroke="var(--pillar-lnp)" strokeWidth={STROKE.structure}>
        <path d="M177 73l11-15" />
        <path d="M188 58l-9-13" />
        <path d="M188 58l14-8" />
        <circle cx="177" cy="43" r="4.5" fill="var(--pillar-lnp)" stroke="none" />
        <circle cx="204" cy="48" r="4.5" fill="var(--pillar-lnp)" stroke="none" />
      </g>

      {showLabels ? (
        <>
          <Label x={232} y={50} from={[206, 48]} text="Targeting antibody" tone="ink" />
          <Label x={232} y={100} from={[214, 102]} text="PEG–lipid brush" />
          <Label x={232} y={144} from={[194, 140]} text="Ionizable + helper lipid" />
          <Label x={232} y={192} from={[140, 154]} text="mRNA payload" />
        </>
      ) : null}
    </DiagramFrame>
  );
}
