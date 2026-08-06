import type { DiagramId } from "@/components/diagrams";

export type PillarId = "lnp" | "mrna" | "disease";

export type PillarAccent = "lnp" | "utr" | "disease";

export type TopicMeta = {
  /** Also the DOM id — topics are deep-linked by hash, not by route. */
  slug: string;
  title: string;
  /** One clause, sentence case. The compressed form of `summary`. */
  tagline: string;
  /** One or two sentences. This is the card body on the homepage. */
  summary: string;
  /**
   * Two to four sentences, each its own point. Not on the homepage — four
   * topics times four sentences is the wall of text the route replaced. Kept
   * for the per-topic writeups the owner is adding later.
   */
  detail: string[];
  /** Optional — drawn inside the card when a topic earns its own picture. */
  diagram?: DiagramId;
  keywords: string[];
  status: "active" | "planned";
};

export type Pillar = {
  id: PillarId;
  title: string;
  /** Used in the rail and the skeleton map, where the full title is too long. */
  shortTitle: string;
  /** The pillar's role in the pipeline: Delivery, Message, Application. */
  stage: string;
  /** Two or three sentences framing why the pillar exists. */
  intro: string;
  /** The single sentence that states the open problem. */
  question: string;
  diagram: DiagramId;
  accent: PillarAccent;
  topics: TopicMeta[];
};

/**
 * Maps a pillar accent onto CSS tokens, so components never branch on id.
 *
 * `panel` re-points the .sketch-card border variable at the pillar colour and
 * leaves the fill as --card. A large tinted fill was tried first and fails in
 * dark mode: a warm panel at any usable chroma reads as brown mud against the
 * cool near-black ground. Colour belongs on the outline, which is also where
 * the reference art puts it.
 *
 * `bg` keeps the tint, but only for pills and chips, where the area is too
 * small for the mud to register.
 */
export const ACCENT_CLASS: Record<
  PillarAccent,
  { text: string; bg: string; panel: string; dot: string; ring: string; ringSoft: string }
> = {
  lnp: {
    text: "text-pillar-lnp",
    bg: "bg-pillar-lnp-subtle",
    panel: "[--sketch-border-color:var(--pillar-lnp)]",
    dot: "bg-pillar-lnp",
    ring: "border-pillar-lnp",
    ringSoft: "border-pillar-lnp/45",
  },
  utr: {
    text: "text-pillar-utr",
    bg: "bg-pillar-utr-subtle",
    panel: "[--sketch-border-color:var(--pillar-utr)]",
    dot: "bg-pillar-utr",
    ring: "border-pillar-utr",
    ringSoft: "border-pillar-utr/45",
  },
  disease: {
    text: "text-pillar-disease",
    bg: "bg-pillar-disease-subtle",
    panel: "[--sketch-border-color:var(--pillar-disease)]",
    dot: "bg-pillar-disease",
    ring: "border-pillar-disease",
    ringSoft: "border-pillar-disease/45",
  },
};
