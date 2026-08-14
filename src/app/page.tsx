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
                    Research updates <ArrowRight className="size-4" />
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

      {/* Purpose-built LNP–RNA tools — deliberately last, after the research route. */}
      <section className="border-t border-ink/12 bg-secondary/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 border-b border-ink/15 pb-8 md:grid-cols-[1fr_1.25fr] md:items-end">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                LNP–RNA work assistant
              </p>
              <h2 className="mt-3 max-w-lg font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Design, calculate, and document the workflow.
              </h2>
            </div>
            <p className="max-w-xl leading-relaxed text-muted-foreground md:justify-self-end">
              Practical tools for formulation design, experimental planning,
              measurement, and traceable LNP–RNA records.
            </p>
          </div>

          <div className="divide-y divide-ink/15">
            <ToolRow
              index="01"
              href="/tools/lnp-formula"
              title="LNP Calculator"
              scope="Formulation · Screening · RiboGreen"
              description="Design lipid formulations, compare screening batches, and calculate RNA concentration and encapsulation efficiency."
            />
            <ToolRow
              index="02"
              href="/tools/tlnp"
              title="tLNP Workbench"
              scope="Design · Conjugation · Purification · In vitro / in vivo"
              description="Record the complete targeted-LNP workflow, from formulation and conjugation to purification and biological studies."
            />
            <ToolRow
              index="03"
              href="/tools/ivt"
              title="IVT mRNA Workbench"
              scope="IVT batches · RNA library · Experimental records"
              description="Track IVT batches and maintain a searchable mRNA library for downstream LNP studies."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function ToolRow({
  index,
  href,
  title,
  scope,
  description,
}: {
  index: string;
  href: string;
  title: string;
  scope: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group grid gap-3 py-7 transition-colors hover:text-primary sm:grid-cols-[3rem_1fr] md:grid-cols-[3rem_14rem_1fr_auto] md:items-center"
    >
      <span className="font-mono text-xs text-muted-foreground">{index}</span>
      <div>
        <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {scope}
        </p>
      </div>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground group-hover:text-foreground">
        {description}
      </p>
      <ArrowRight className="hidden size-5 transition-transform group-hover:translate-x-1 md:block" />
    </Link>
  );
}
