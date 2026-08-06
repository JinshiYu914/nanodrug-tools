import { DoseRoute } from "./dose-route";

/**
 * Research interests.
 *
 * Everything is in the route: the shape carries the argument, the panel carries
 * the frameworks. There is no prose introduction here on purpose — the section
 * is about the shape of the work, not a written account of it.
 */
export function ResearchInterests() {
  return (
    <section id="research" className="scroll-mt-20 pb-16 sm:pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <DoseRoute />
      </div>
    </section>
  );
}
