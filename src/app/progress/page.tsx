import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Research Updates",
  description:
    "Research updates on lipid nanoparticle delivery, mRNA engineering, and related experimental methods.",
};

/**
 * Static holding page while the curated research feed is being developed.
 */
export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          In development
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          Research Updates
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          Curated updates on LNP delivery, mRNA engineering, and experimental
          methods are being prepared. Please check back soon.
        </p>
      </header>

      <div className="mt-10 border-y border-dashed border-ink/20 py-7">
        <p className="font-display text-lg font-bold">Coming soon</p>
        <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">
          This page will bring together concise research notes and selected
          literature relevant to the LNP–RNA workflow.
        </p>
        <Button asChild variant="outline" className="mt-6 font-semibold">
          <Link href="/tools">Explore Lab Tools</Link>
        </Button>
      </div>
    </div>
  );
}
