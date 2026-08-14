import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sticker } from "@/components/diagrams/primitives";

export const metadata: Metadata = {
  title: "AI Assistant",
  description:
    "A chat assistant for lipid nanoparticle and mRNA delivery questions, grounded in this lab's protocols and calculators.",
};

export default function AssistantPage() {
  return (
    <div className="relative overflow-hidden">
      <Sticker
        shape="blob"
        tone="var(--accent-utility)"
        className="absolute -right-8 top-20 hidden size-32 rotate-12 opacity-60 lg:block"
      />

      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          In development
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          AI Assistant
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          An assistant for LNP formulation, delivery, and experimental planning
          is being built. Please check back soon.
        </p>

        <div className="mt-10 border-y border-dashed border-ink/20 py-7">
          <p className="font-display text-lg font-bold">Coming soon</p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            In the meantime, the calculators and workbenches remain available.
          </p>
          <div className="mt-5">
            <Button asChild className="font-semibold shadow-sticker-sm">
              <Link href="/tools">Open Lab Tools</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
