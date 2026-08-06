import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sticker } from "@/components/diagrams/primitives";
import { ResearchInterests } from "@/components/research/research-interests";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* ---------------------------------------------------------------
       * Hero. The headline states the problem; the route immediately below
       * is the answer, so there is no illustration here — the particle is
       * station 01 and drawing it twice would halve the impact of both.
       * ------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Marginalia. xl only — below that the container reaches the viewport
            edge and these land on top of the copy. */}
        <Sticker
          shape="arc"
          tone="var(--pillar-utr)"
          className="absolute -left-12 top-24 hidden size-32 -rotate-12 opacity-70 xl:block"
        />
        <Sticker
          shape="coil"
          tone="var(--pillar-disease)"
          className="absolute -right-10 top-44 hidden size-28 rotate-6 opacity-70 xl:block"
        />

        <div className="mx-auto max-w-6xl px-4 pb-4 pt-16 sm:px-6 sm:pt-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Research interests
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-end">
            <h1 className="max-w-3xl text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              Getting the right message into the{" "}
              <span className="text-pillar-lnp">right cell</span>.
            </h1>

            <div className="lg:pb-2">
              <p className="max-w-md leading-relaxed text-muted-foreground">
                Most of an intravenous LNP dose goes to the liver whether you
                want it to or not. Three stages of work on that — and on what it
                makes treatable.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button asChild className="gap-2 font-semibold shadow-sticker-sm">
                  <Link href="/progress">
                    Research progress <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="font-semibold">
                  <Link href="/tools">Open Lab Tools</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ResearchInterests />

      {/* Bench tools — deliberately last. They support the research; they are
          not what the site is about. */}
      <section className="border-t border-ink/12 bg-secondary/40 py-16 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Calculators from the bench
            </h2>
            <p className="mt-2 max-w-lg leading-relaxed text-muted-foreground">
              LNP formulation, batch screening, RiboGreen encapsulation — plus
              the everyday molarity and dilution maths.
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0 gap-2 font-semibold shadow-sticker-sm">
            <Link href="/tools">
              Open Lab Tools <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
