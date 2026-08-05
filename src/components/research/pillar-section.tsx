"use client";

import { DIAGRAMS } from "@/components/diagrams";
import { ACCENT_CLASS, type Pillar } from "@/content/research/types";
import { cn } from "@/lib/utils";
import { TopicCard } from "./topic-card";

/**
 * One pillar: the open question, the framing, the diagram, its topics.
 *
 * No "all topics" link and no programme page — the topics are all right here,
 * and a route that shows the same three cards one level down is a navigation
 * the reader pays for and gets nothing back from.
 */
export function PillarSection({
  pillar,
  index,
  openSlugs,
  onToggle,
}: {
  pillar: Pillar;
  index: number;
  openSlugs: Set<string>;
  onToggle: (slug: string) => void;
}) {
  const Diagram = DIAGRAMS[pillar.diagram];
  const tone = ACCENT_CLASS[pillar.accent];

  return (
    <section id={pillar.id} className="scroll-mt-24">
      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-start">
        <div>
          <p className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className={cn("size-2 rounded-full", tone.dot)} />
            {String(index + 1).padStart(2, "0")} · {pillar.stage}
          </p>

          <h3 className="mt-3 font-display text-3xl font-extrabold leading-[1.1] tracking-tight">
            {pillar.title}
          </h3>

          <p className={cn("mt-3 font-display text-lg font-semibold leading-snug", tone.text)}>
            {pillar.question}
          </p>

          <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
            {pillar.intro}
          </p>
        </div>

        <div className={cn("sketch-card p-5", tone.panel)}>
          <Diagram className="mx-auto max-w-md" />
        </div>
      </div>

      {/* items-start, so expanding one card does not stretch its neighbour to
          match and leave a column of dead space. */}
      <div className="mt-8 grid items-start gap-4 md:grid-cols-2">
        {pillar.topics.map((topic) => (
          <TopicCard
            key={topic.slug}
            accent={pillar.accent}
            topic={topic}
            isOpen={openSlugs.has(topic.slug)}
            onToggle={() => onToggle(topic.slug)}
          />
        ))}
      </div>
    </section>
  );
}
