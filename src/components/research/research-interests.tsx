import { OrbitMap } from "./orbit-map";

/**
 * Research interests.
 *
 * One branch diagram, and the framework for whichever arm is under the cursor.
 * The long-form intros, per-pillar diagrams and expanded topic cards that used
 * to live here were cut — the point of this section is the shape of the work,
 * not a written account of it.
 */
export function ResearchInterests() {
  return (
    <section id="research" className="scroll-mt-20 border-t border-ink/12 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="max-w-xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Research interests
          </p>
          <h2 className="mt-3 text-balance font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
            Three arms, one problem
          </h2>
        </header>

        <div className="mt-10">
          <OrbitMap />
        </div>
      </div>
    </section>
  );
}
