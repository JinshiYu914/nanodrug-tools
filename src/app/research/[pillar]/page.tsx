import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DIAGRAMS } from "@/components/diagrams";
import { TopicCard } from "@/components/research/topic-card";
import { PILLARS, getPillar } from "@/content/research";
import { ACCENT_CLASS } from "@/content/research/types";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ pillar: string }> };

export function generateStaticParams() {
  return PILLARS.map((pillar) => ({ pillar: pillar.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const pillar = getPillar((await params).pillar);
  if (!pillar) return {};
  return { title: pillar.title, description: pillar.question };
}

export default async function PillarPage({ params }: Params) {
  const pillar = getPillar((await params).pillar);
  if (!pillar) notFound();

  const Diagram = DIAGRAMS[pillar.diagram];
  const tone = ACCENT_CLASS[pillar.accent];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/research"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All research
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <header>
          <p className="flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span className={cn("size-2 rounded-full", tone.dot)} />
            {pillar.shortTitle}
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {pillar.title}
          </h1>
          <p className={cn("mt-5 font-display text-xl font-semibold leading-snug", tone.text)}>
            {pillar.question}
          </p>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted-foreground">
            {pillar.intro}
          </p>
        </header>

        <div className={cn("sketch-card p-6", tone.panel)}>
          <Diagram className="mx-auto max-w-lg" />
        </div>
      </div>

      <h2 className="mt-16 font-display text-2xl font-extrabold tracking-tight">
        Topics
      </h2>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}
