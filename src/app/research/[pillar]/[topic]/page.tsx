import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DIAGRAMS } from "@/components/diagrams";
import { allTopicParams, getTopic } from "@/content/research";
import { ACCENT_CLASS } from "@/content/research/types";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ pillar: string; topic: string }> };

export function generateStaticParams() {
  return allTopicParams();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { pillar, topic } = await params;
  const entry = getTopic(pillar, topic);
  if (!entry) return {};
  return { title: entry.topic.title, description: entry.topic.summary };
}

export default async function TopicPage({ params }: Params) {
  const { pillar: pillarId, topic: topicSlug } = await params;
  const entry = getTopic(pillarId, topicSlug);
  if (!entry) notFound();

  const { pillar, topic } = entry;
  const Diagram = DIAGRAMS[pillar.diagram];
  const tone = ACCENT_CLASS[pillar.accent];

  return (
    <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href={`/research/${pillar.id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {pillar.title}
      </Link>

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider",
              topic.status === "active" ? tone.bg : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                topic.status === "active" ? tone.dot : "bg-muted-foreground"
              )}
            />
            {topic.status === "active" ? "Active" : "Planned"}
          </span>
          <time
            dateTime={topic.updatedAt}
            className="font-mono text-xs text-muted-foreground"
          >
            Updated {topic.updatedAt}
          </time>
        </div>

        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
          {topic.title}
        </h1>
        <p className={cn("mt-3 font-display text-xl font-semibold", tone.text)}>
          {topic.tagline}
        </p>
      </header>

      {/* Capped, because the label type inside the SVG scales with the frame —
          unbounded it ends up larger than the body copy below it. */}
      <div className={cn("sketch-card mt-10 p-6 sm:p-8", tone.panel)}>
        <Diagram className="mx-auto max-w-xl" />
      </div>

      <p className="mt-10 text-lg leading-relaxed">{topic.summary}</p>

      <div className="sketch-card mt-10 border-dashed p-6">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Full write-up in progress
        </p>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Methods, results and figures for this topic are being written up. The
          background above is the short version.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Keywords
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {topic.keywords.map((keyword) => (
            <li
              key={keyword}
              className="rounded-md bg-secondary px-2.5 py-1 font-mono text-xs text-muted-foreground"
            >
              {keyword}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
