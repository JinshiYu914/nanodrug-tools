import type { DiagramId } from "@/components/diagrams";

export type PillarId = "lipid-nanoparticle" | "mrna-utr" | "disease";

export type PillarAccent = "lnp" | "utr" | "disease";

export type TopicMeta = {
  slug: string;
  title: string;
  /** One clause, sentence case. Sits under the title on the card. */
  tagline: string;
  /** One or two sentences. This is the whole card body — keep it tight. */
  summary: string;
  keywords: string[];
  status: "active" | "planned";
  /** ISO date. Shown on the topic page, and used to sort "recently updated". */
  updatedAt: string;
};

export type Pillar = {
  id: PillarId;
  title: string;
  /** Used in nav and breadcrumbs where the full title is too long. */
  shortTitle: string;
  /** Two or three sentences framing why the pillar exists. */
  intro: string;
  /** The single sentence that states the open problem. */
  question: string;
  diagram: DiagramId;
  accent: PillarAccent;
  topics: TopicMeta[];
};

/** Maps a pillar accent onto the CSS tokens, so components never branch on id. */
export const ACCENT_CLASS: Record<
  PillarAccent,
  { text: string; bg: string; border: string; dot: string }
> = {
  lnp: {
    text: "text-pillar-lnp",
    bg: "bg-pillar-lnp-subtle",
    border: "border-pillar-lnp",
    dot: "bg-pillar-lnp",
  },
  utr: {
    text: "text-pillar-utr",
    bg: "bg-pillar-utr-subtle",
    border: "border-pillar-utr",
    dot: "bg-pillar-utr",
  },
  disease: {
    text: "text-pillar-disease",
    bg: "bg-pillar-disease-subtle",
    border: "border-pillar-disease",
    dot: "bg-pillar-disease",
  },
};
