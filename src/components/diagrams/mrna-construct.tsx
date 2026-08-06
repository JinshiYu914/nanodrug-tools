import { DiagramFrame, Label, STROKE, type DiagramProps } from "./primitives";

/**
 * Crop to the construct itself: cap at x≈27, poly(A) tail ending at x≈370,
 * everything between y 81 and 118. Leaves a long flat band, which is the shape
 * of the thing being drawn.
 */
const CROP = "20 72 358 56";

/**
 * The mRNA construct, drawn to scale-ish: cap, 5′ UTR, coding sequence,
 * 3′ UTR, poly(A).
 *
 * The two UTRs carry the accent because they are the part this programme
 * actually edits — the CDS is held fixed while the untranslated ends are
 * rewritten to move expression between cell types and organs.
 */
export function MrnaConstruct({ variant = "full", className }: DiagramProps) {
  const showLabels = variant === "full";
  const top = 82;
  const bottom = 116;

  return (
    <DiagramFrame
      title="mRNA construct with untranslated regions highlighted"
      desc="From left: 5-prime cap, 5-prime UTR, coding sequence, 3-prime UTR, and poly-A tail. Both UTRs are highlighted as the engineered regions."
      viewBox={showLabels ? "0 0 400 200" : CROP}
      className={className}
    >
      {/* Cap */}
      <path
        d="M42 84c10 0 16 7 16 15s-7 16-16 15-15-7-15-15 6-15 15-15Z"
        fill="var(--pillar-utr)"
        stroke="currentColor"
        strokeWidth={STROKE.detail}
      />

      {/* 5' UTR — engineered */}
      <path
        d="M64 83h72v34H64Z"
        fill="var(--pillar-utr)"
        stroke="currentColor"
        strokeWidth={STROKE.structure}
      />

      {/* Coding sequence — held fixed */}
      <path
        d={`M136 ${top - 1}h130v36H136Z`}
        fill="var(--card)"
        stroke="currentColor"
        strokeWidth={STROKE.structure}
      />
      {/* codon ticks */}
      <path
        d="M150 90v20M166 90v20M182 90v20M198 90v20M214 90v20M230 90v20M246 90v20"
        stroke="currentColor"
        strokeWidth={STROKE.hair}
        opacity="0.4"
      />

      {/* 3' UTR — engineered */}
      <path
        d={`M266 83h56v${bottom - top - 1}h-56Z`}
        fill="var(--pillar-utr)"
        stroke="currentColor"
        strokeWidth={STROKE.structure}
      />

      {/* poly(A) tail */}
      <path
        d="M322 100c8-11 16-11 24 0s16 11 24 0"
        stroke="currentColor"
        strokeWidth={STROKE.structure}
      />

      {showLabels ? (
        <>
          <Label x={42} y={68} text="Cap" anchor="middle" />
          <Label x={100} y={150} text="5′ UTR" anchor="middle" tone="ink" />
          <Label x={201} y={150} text="Coding sequence" anchor="middle" />
          <Label x={294} y={150} text="3′ UTR" anchor="middle" tone="ink" />
          <Label x={346} y={68} text="poly(A)" anchor="middle" />

          {/* Brace calling out what is actually being varied */}
          <path
            d="M64 162h36M136 162h-36M100 162v10M266 162h30M322 162h-26M296 162v10"
            stroke="var(--pillar-utr)"
            strokeWidth={STROKE.hair}
          />
          <Label
            x={198}
            y={182}
            text="engineered for cell- and organ-specific expression"
            anchor="middle"
          />
        </>
      ) : null}
    </DiagramFrame>
  );
}
