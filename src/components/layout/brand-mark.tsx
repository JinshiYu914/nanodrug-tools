import { cn } from "@/lib/utils";

/**
 * The LNP Partner mark: a particle in cross-section — ink shell, amber core,
 * a coiled payload, and four PEG bristles.
 *
 * Drawn on a 24-unit grid with deliberately uneven arcs so it reads as hand
 * drawn rather than as a geometric icon. Strokes are `currentColor` and the
 * core is a token, so it inverts with the theme for free.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-hidden="true"
      className={cn("h-7 w-7", className)}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* PEG bristles — uneven lengths on purpose */}
      <g stroke="currentColor" strokeWidth="1.6" opacity="0.75">
        <path d="M12 1.6v2.1" />
        <path d="M20.4 6.9l-1.8 1.1" />
        <path d="M20.1 17.4l-1.9-1" />
        <path d="M4 6.6l1.9 1.2" />
      </g>

      {/* Particle shell — four arcs, none quite matching */}
      <path
        d="M12 3.6c4.7 0 8.5 3.6 8.5 8.3 0 4.9-3.9 8.5-8.6 8.5-4.6 0-8.4-3.8-8.3-8.6C3.7 7.1 7.4 3.6 12 3.6Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />

      {/* Aqueous core */}
      <path
        d="M12 7.4c2.6 0 4.7 2 4.7 4.6 0 2.7-2.2 4.6-4.8 4.6-2.5 0-4.5-2.1-4.5-4.7 0-2.5 2.1-4.5 4.6-4.5Z"
        fill="var(--pillar-lnp)"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* mRNA coil */}
      <path
        d="M9.9 12.4c.6-1.1 1.4-1.1 2 0 .6 1.1 1.5 1.1 2.1-.1"
        stroke="var(--primary-foreground)"
        strokeWidth="1.35"
      />
    </svg>
  );
}
