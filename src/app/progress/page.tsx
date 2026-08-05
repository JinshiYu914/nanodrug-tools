import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PILLARS } from "@/content/research";
import { ACCENT_CLASS } from "@/content/research/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Research Progress",
  description:
    "A weekly sweep of new literature across lipid nanoparticle delivery, mRNA UTR engineering, and the disease programmes they enable.",
};

/**
 * Static shell. Phase 3 replaces the empty state with rows from the
 * `research_updates` table, read through a cookieless anon client so this page
 * stays statically rendered.
 */
export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Updated weekly
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          Research Progress
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          New literature across the three programmes, swept weekly and filed
          against the topic it speaks to. Every card says what the paper found
          and why it matters here — not just its abstract.
        </p>
      </header>

      <div className="mt-10 flex flex-wrap gap-2">
        {PILLARS.map((pillar) => {
          const tone = ACCENT_CLASS[pillar.accent];
          return (
            <span
              key={pillar.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border-2 border-ink/20 px-3.5 py-1.5 text-sm font-semibold",
                tone.bg
              )}
            >
              <span className={cn("size-2 rounded-full", tone.dot)} />
              {pillar.shortTitle}
            </span>
          );
        })}
      </div>

      <div className="sketch-card mt-8 border-dashed p-10 text-center">
        <p className="font-display text-xl font-bold">No entries yet</p>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
          The weekly sweep is not switched on yet. Once it is, papers land here
          every Monday, reviewed before they go public.
        </p>
        <Button asChild variant="outline" className="mt-6 font-semibold">
          <Link href="/research">Read the research instead</Link>
        </Button>
      </div>
    </div>
  );
}
