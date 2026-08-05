import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DIAGRAMS } from "@/components/diagrams";
import { ACCENT_CLASS, type Pillar } from "@/content/research/types";
import { cn } from "@/lib/utils";
import { TopicCard } from "./topic-card";

/**
 * One research pillar on the homepage: the open question, the framing, the
 * diagram, and its topic cards.
 *
 * The index (01/02/03) is not decoration here — the three pillars are read in
 * order, because each one only makes sense given the one before it: get to the
 * cell, then control the message, then say what that unlocks.
 */
export function PillarSection({ pillar, index }: { pillar: Pillar; index: number }) {
  const Diagram = DIAGRAMS[pillar.diagram];
  const tone = ACCENT_CLASS[pillar.accent];

  return (
    <section
      id={pillar.id}
      className="scroll-mt-20 border-t border-ink/12 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-16">
          <div>
            <p className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span className={cn("size-2 rounded-full", tone.dot)} />
              {String(index + 1).padStart(2, "0")} / {pillar.shortTitle}
            </p>

            <h2 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
              {pillar.title}
            </h2>

            <p className={cn("mt-4 font-display text-xl font-semibold leading-snug", tone.text)}>
              {pillar.question}
            </p>

            <p className="mt-4 max-w-prose leading-relaxed text-muted-foreground">
              {pillar.intro}
            </p>

            <Link
              href={`/research/${pillar.id}`}
              className="mt-6 inline-flex items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4 hover:text-primary"
            >
              All {pillar.topics.length} topics
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div
            className={cn(
              "sketch-card flex items-center justify-center overflow-hidden p-5",
              tone.bg
            )}
          >
            <Diagram />
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillar.topics.map((topic) => (
            <TopicCard
              key={topic.slug}
              pillarId={pillar.id}
              accent={pillar.accent}
              topic={topic}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
