import { cn } from "@/lib/utils";

/**
 * Shared chassis for the Bench Sketch diagram language.
 *
 * See ./README.md for the rules. The short version:
 *   - no hex literals, only currentColor and var(--token)
 *   - SVG <text> ignores CSS `color`, so put the class on the <g> and set
 *     fill="currentColor" on the text itself
 *   - the hand-drawn feel comes from irregular path geometry, not a filter
 */

/** One stroke weight for structure, one for detail. Resist adding a third. */
export const STROKE = {
  structure: 2.6,
  detail: 1.7,
  hair: 1.2,
} as const;

export type DiagramVariant = "thumb" | "full";

export type DiagramProps = {
  /** `thumb` drops labels and leader lines so the drawing survives at card size. */
  variant?: DiagramVariant;
  className?: string;
};

export function DiagramFrame({
  title,
  desc,
  viewBox,
  className,
  children,
}: {
  title: string;
  desc: string;
  viewBox: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={title}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-auto w-full text-ink", className)}
    >
      <title>{title}</title>
      <desc>{desc}</desc>
      {children}
    </svg>
  );
}

/**
 * A callout label with its leader line. Hidden in `thumb`, because 10px type
 * inside a 280px-wide card is noise.
 */
export function Label({
  x,
  y,
  from,
  text,
  anchor = "start",
  tone = "muted",
}: {
  x: number;
  y: number;
  /** Leader line origin, i.e. the thing being pointed at. */
  from?: [number, number];
  text: string;
  anchor?: "start" | "end" | "middle";
  tone?: "muted" | "ink";
}) {
  return (
    <g className={tone === "muted" ? "text-muted-foreground" : "text-ink"}>
      {from ? (
        <path
          d={`M${from[0]} ${from[1]} L${x + (anchor === "end" ? 6 : -6)} ${y - 4}`}
          stroke="currentColor"
          strokeWidth={STROKE.hair}
          opacity="0.55"
        />
      ) : null}
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fill="currentColor"
        fontSize="11.5"
        fontWeight="600"
        className="font-sans"
      >
        {text}
      </text>
    </g>
  );
}

/** A short arrow. `d` is any path; the head is drawn from the last direction. */
export function Arrow({
  d,
  head,
  angle,
  tone = "var(--ink)",
  width = STROKE.detail,
}: {
  d: string;
  /** Tip of the arrowhead. */
  head: [number, number];
  /** Direction the head points, in degrees. 0 = right. */
  angle: number;
  tone?: string;
  width?: number;
}) {
  return (
    <g stroke={tone} strokeWidth={width}>
      <path d={d} />
      <path
        d="M-7 -4.2 L0 0 L-7 4.2"
        transform={`translate(${head[0]} ${head[1]}) rotate(${angle})`}
        fill="none"
      />
    </g>
  );
}

/**
 * Decorative floating shape for section edges. Never carries meaning, so it is
 * aria-hidden and pointer-events-none by construction.
 */
export function Sticker({
  shape,
  className,
  tone = "var(--pillar-lnp)",
}: {
  shape: "arc" | "wedge" | "blob" | "coil";
  className?: string;
  tone?: string;
}) {
  const paths: Record<typeof shape, string> = {
    arc: "M4 44C4 21.9 21.9 4 44 4c22.1 0 40 17.9 40 40",
    wedge: "M44 44V4C21.9 4 4 21.9 4 44Z",
    blob: "M44 6c19 0 34 16.4 34 36.5S63 79 44 79 10 62.6 10 42.5 25 6 44 6Z",
    coil: "M6 44c6-14 14-14 20 0s14 14 20 0 14-14 20 0",
  };

  return (
    <svg
      viewBox="0 0 88 88"
      fill={shape === "wedge" || shape === "blob" ? tone : "none"}
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("pointer-events-none select-none", className)}
    >
      <path d={paths[shape]} />
    </svg>
  );
}
