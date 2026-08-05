import { DiagramFrame, Label, STROKE, type DiagramProps } from "./primitives";

/**
 * RNA-encoded LYTAC against CD47–SIRPα.
 *
 * The story, left to right: the tumour cell displays CD47, a LYTAC bridges it
 * to a lysosome-targeting receptor and drags it inside, the "don't eat me"
 * handshake with macrophage SIRPα breaks, and the macrophage moves in.
 *
 * The broken handshake is the pivot, so it is the only element in the accent
 * colour and the only one interrupted. Labels are kept in four clear zones —
 * two above the cells, two along the bottom — so no leader line crosses a
 * cell body.
 */
export function LytacDegrader({ variant = "full", className }: DiagramProps) {
  const showLabels = variant === "full";

  return (
    <DiagramFrame
      title="RNA-encoded LYTAC degrading CD47 to restore macrophage phagocytosis"
      desc="A tumour cell displaying CD47 is bound by a LYTAC chimera that routes CD47 to the lysosome. With CD47 cleared, the CD47–SIRP-alpha don't-eat-me signal is broken and a macrophage engulfs the cell."
      viewBox="0 0 400 232"
      className={className}
    >
      {/* Tumour cell */}
      <path
        d="M96 54C130 52 152 78 152 110C152 142 128 164 96 162C64 160 42 138 42 108C42 78 64 56 96 54Z"
        fill="var(--card)"
        stroke="currentColor"
        strokeWidth={STROKE.structure}
      />

      {/* Lysosome — the destination */}
      <path
        d="M74 116l7 8 10-4-1 11 10 5-8 8 3 10-11-1-6 9-6-9-11 2 2-10-9-6 10-6-2-11 12 3Z"
        fill="var(--pillar-disease-subtle)"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
      />

      {/* CD47 on the surface */}
      <g stroke="currentColor" strokeWidth={STROKE.detail}>
        <path d="M144 88l14-9" />
        <path d="M152 74l12 9" />
      </g>

      {/* LYTAC: a two-headed chimera, one head on CD47 */}
      <g stroke="var(--pillar-disease)" strokeWidth={STROKE.detail}>
        <circle cx="176" cy="70" r="6" fill="var(--pillar-disease)" stroke="none" />
        <circle cx="196" cy="58" r="6" fill="var(--pillar-disease)" stroke="none" />
        <path d="M181 67l10-6" />
        <path d="M170 73l-6 4" />
      </g>

      {/* Internalisation route to the lysosome */}
      <g stroke="var(--pillar-disease)" strokeWidth={STROKE.detail}>
        <path d="M146 96C130 108 114 116 100 120" strokeDasharray="5 5" />
        <path d="M108 113l-9 8 1-11" />
      </g>

      {/* Broken don't-eat-me handshake */}
      <path
        d="M156 146h88"
        stroke="var(--pillar-disease)"
        strokeWidth={STROKE.detail}
        strokeDasharray="6 6"
        opacity="0.5"
      />
      <g stroke="var(--pillar-disease)" strokeWidth={STROKE.structure}>
        <path d="M192 138l16 16" />
        <path d="M208 138l-16 16" />
      </g>

      {/* Macrophage */}
      <path
        d="M312 62C342 64 364 88 364 118C364 148 340 168 310 166C280 164 260 142 260 114C260 86 282 60 312 62Z"
        fill="var(--pillar-disease-subtle)"
        stroke="currentColor"
        strokeWidth={STROKE.structure}
      />
      <path
        d="M262 92c-12-5-20-4-27 1M258 122c-14-1-23 2-29 7M264 148c-11 4-18 9-21 16"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
      />
      {/* SIRPα */}
      <g stroke="currentColor" strokeWidth={STROKE.detail}>
        <path d="M262 140l-14 8" />
        <path d="M242 142l12 9" />
      </g>

      {showLabels ? (
        <>
          <Label x={96} y={36} text="Tumour cell" anchor="middle" tone="ink" />
          <Label x={312} y={36} text="Macrophage" anchor="middle" tone="ink" />
          <Label x={140} y={54} from={[152, 76]} text="CD47" anchor="end" tone="ink" />
          <Label x={218} y={44} from={[202, 56]} text="LYTAC" tone="ink" />
          <Label x={44} y={196} from={[72, 146]} text="Lysosome" />
          <Label x={200} y={186} text="signal broken" anchor="middle" tone="ink" />
          <Label x={276} y={196} from={[252, 152]} text="SIRPα" />
        </>
      ) : null}
    </DiagramFrame>
  );
}
