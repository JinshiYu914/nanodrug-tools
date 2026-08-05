import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LnpCrossSection } from "@/components/diagrams";
import { Sticker } from "@/components/diagrams/primitives";
import { PillarSection } from "@/components/research/pillar-section";
import { PILLARS } from "@/content/research";

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

        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Lipid nanoparticles · mRNA · targeted delivery
            </p>

            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Getting the right message
              <br className="hidden sm:block" /> into the{" "}
              <span className="text-pillar-lnp">right cell</span>.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Most of an LNP dose goes to the liver whether you want it to or
              not. Three programmes work on that: putting a ligand on the
              particle so it chooses its own address, rewriting the
              untranslated ends of the transcript so the sequence decides which
              cell translates it, and the diseases that open up once both work.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2 font-semibold shadow-sticker-sm">
                <Link href="#lipid-nanoparticle">
                  Read the research <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="font-semibold">
                <Link href="/tools">Open Lab Tools</Link>
              </Button>
            </div>
          </div>

          <div className="sketch-card bg-pillar-lnp-subtle p-6 sm:p-8">
            <LnpCrossSection />
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <Link
            href="#lipid-nanoparticle"
            className="inline-flex items-center gap-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-ink/25">
              <ArrowDown className="size-4" />
            </span>
            Three programmes
          </Link>
        </div>
      </section>

      {PILLARS.map((pillar, index) => (
        <PillarSection key={pillar.id} pillar={pillar} index={index} />
      ))}

      {/* Bench tools — deliberately last. They support the research; they are
          not what the site is about. */}
      <section className="border-t border-ink/12 bg-secondary/40 py-16 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Calculators from the bench
            </h2>
            <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">
              The LNP formulation calculator, batch screening and RiboGreen
              encapsulation workup used in this lab, plus the everyday molarity
              and dilution maths. Free, no account needed for most of it.
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
