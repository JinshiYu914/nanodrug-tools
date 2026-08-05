"use client";

import { useCallback, useEffect, useState } from "react";
import { PILLARS } from "@/content/research";
import { PillarSection } from "./pillar-section";
import { ResearchRail } from "./research-rail";
import { SkeletonMap } from "./skeleton-map";

/**
 * Research interests: the framework map, a sticky rail, and the three pillars
 * with their topics expanding in place.
 *
 * Expansion state lives here because the skeleton map at the top and the cards
 * further down have to agree — clicking a node in the map opens that card and
 * scrolls to it.
 *
 * Topics are addressable by hash (`/#lytac-degrader`), which is what replaces
 * the per-topic routes: still shareable, without the extra level.
 */
export function ResearchInterests() {
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());

  const toggle = useCallback((slug: string) => {
    setOpenSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const openAndScroll = useCallback((slug: string) => {
    setOpenSlugs((prev) => new Set(prev).add(slug));
    // replaceState rather than assigning location.hash, which would fire
    // hashchange and make the browser jump before our own smooth scroll runs.
    window.history.replaceState(null, "", `#${slug}`);
    // Wait a frame so the card has begun expanding before we scroll to it,
    // otherwise the browser scrolls to where it used to be.
    requestAnimationFrame(() => {
      document.getElementById(slug)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    });
  }, []);

  // Deep link: /#lytac-degrader opens that card.
  //
  // hashchange matters as much as load — a hash-only navigation does not
  // remount this component, so a link clicked from the footer or from another
  // section would otherwise scroll to a card that stays shut.
  //
  // Opening is deferred a frame rather than done in the effect body. The hash
  // is never sent to the server, so seeding it into initial state would render
  // closed on the server and open on the client, which is a hydration
  // mismatch.
  useEffect(() => {
    let frame = 0;

    const openFromHash = () => {
      const slug = window.location.hash.slice(1);
      if (!slug) return;
      const known = PILLARS.some((p) => p.topics.some((t) => t.slug === slug));
      if (!known) return;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => openAndScroll(slug));
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [openAndScroll]);

  return (
    <section id="research" className="scroll-mt-20 border-t border-ink/12 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Research interests
          </p>
          <h2 className="mt-4 text-balance font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
            Delivery, message, and what they make treatable
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Three lines of work that only make sense together. Pick anything in
            the map to open it.
          </p>
        </header>

        <div className="mt-8">
          <SkeletonMap onSelect={(_pillarId, slug) => openAndScroll(slug)} />
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-14">
          <ResearchRail />

          <div className="flex flex-col gap-16">
            {PILLARS.map((pillar, index) => (
              <PillarSection
                key={pillar.id}
                pillar={pillar}
                index={index}
                openSlugs={openSlugs}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
