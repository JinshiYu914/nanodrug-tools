import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LnpCrossSection } from "@/components/diagrams";
import { Sticker } from "@/components/diagrams/primitives";
import { ResearchInterests } from "@/components/research/research-interests";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* ---------------------------------------------------------------
       * Hero. The particle is the thesis, so it is drawn at full size and
       * given equal weight to the headline rather than used as garnish.
       * ------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        <Sticker
          shape="arc"
          tone="var(--pillar-utr)"
          className="absolute -left-10 top-24 hidden size-32 -rotate-12 opacity-70 lg:block"
        />
        <Sticker
          shape="coil"
          tone="var(--pillar-disease)"
          className="absolute -right-6 bottom-16 hidden size-28 rotate-6 opacity-70 lg:block"
        />

        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-24 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Lipid nanoparticles · mRNA · targeted delivery
            </p>

            <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Getting the right message into the{" "}
              <span className="text-pillar-lnp">right cell</span>.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Most of an LNP dose goes to the liver whether you want it to or
              not. Three arms of work on that — and on what it makes treatable.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2 font-semibold shadow-sticker-sm">
                <Link href="#research">
                  Research interests <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="font-semibold">
                <Link href="/tools">Open Lab Tools</Link>
              </Button>
            </div>
          </div>

          <div className="sketch-card p-6 [--sketch-border-color:var(--pillar-lnp)] sm:p-8">
            <LnpCrossSection />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <Link
            href="#research"
            className="inline-flex items-center gap-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-ink/25">
              <ArrowDown className="size-4" />
            </span>
            Research interests
          </Link>
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
