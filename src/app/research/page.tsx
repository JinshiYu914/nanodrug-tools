import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DIAGRAMS } from "@/components/diagrams";
import { TopicCard } from "@/components/research/topic-card";
import { PILLARS } from "@/content/research";
import { ACCENT_CLASS } from "@/content/research/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Every research topic across lipid nanoparticle delivery, mRNA UTR engineering, and the disease programmes they enable.",
};

export default function ResearchIndexPage() {
  const total = PILLARS.reduce((n, pillar) => n + pillar.topics.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {total} topics · {PILLARS.length} programmes
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          Research
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Delivery decides which organ. Sequence decides which cell. The
          disease programmes are what becomes possible when you control both.
        </p>
      </header>

      <div className="mt-14 flex flex-col gap-16">
        {PILLARS.map((pillar, index) => {
          const Diagram = DIAGRAMS[pillar.diagram];
          const tone = ACCENT_CLASS[pillar.accent];

          return (
            <section key={pillar.id} id={pillar.id} className="scroll-mt-20">
              <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
                <div>
                  <p className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <span className={cn("size-2 rounded-full", tone.dot)} />
                    {String(index + 1).padStart(2, "0")} / {pillar.shortTitle}
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
                    <Link href={`/research/${pillar.id}`} className="hover:text-primary">
                      {pillar.title}
                    </Link>
                  </h2>
                  <p className={cn("mt-3 font-display text-lg font-semibold", tone.text)}>
                    {pillar.question}
                  </p>
                  <p className="mt-3 max-w-prose leading-relaxed text-muted-foreground">
                    {pillar.intro}
                  </p>
                  <Link
                    href={`/research/${pillar.id}`}
                    className="mt-5 inline-flex items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4 hover:text-primary"
                  >
                    Open programme <ArrowRight className="size-4" />
                  </Link>
                </div>
                <div className={cn("sketch-card p-5", tone.bg)}>
                  <Diagram variant="thumb" />
                </div>
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pillar.topics.map((topic) => (
                  <TopicCard
                    key={topic.slug}
                    pillarId={pillar.id}
                    accent={pillar.accent}
                    topic={topic}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
