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
          A chat assistant for formulation and delivery questions — the kind you
          would otherwise work out on paper next to the calculators. It will run
          against this lab&rsquo;s protocols and the same maths the tools use,
          so an answer and a calculation agree with each other.
        </p>

        <div className="sketch-card mt-10 border-dashed p-6">
          <p className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Not open yet
          </p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Until it is, the calculators do the arithmetic and the research
            pages cover the background.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild className="font-semibold shadow-sticker-sm">
              <Link href="/tools">Open Lab Tools</Link>
            </Button>
            <Button asChild variant="outline" className="font-semibold">
              <Link href="/#research">Read the research</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
