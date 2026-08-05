"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PILLARS } from "@/content/research";
import { ACCENT_CLASS } from "@/content/research/types";

/**
 * Sticky rail down the side of Research interests.
 *
 * Hover highlights, click scrolls. Scrolling on hover was considered and
 * rejected — a page that moves under the cursor while you are reading is
 * hostile, and the request for interactivity did not extend to that.
 */
export function ResearchRail() {
  const [activeId, setActiveId] = useState<string>(PILLARS[0].id);

  useEffect(() => {
    const sections = PILLARS.map((pillar) =>
      document.getElementById(pillar.id)
    ).filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Whichever tracked section is nearest the top of the viewport wins,
        // so a tall section does not keep the previous one selected.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Research interests" className="sticky top-24 hidden lg:block">
      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Jump to
      </p>
      <ul className="mt-4 flex flex-col gap-1">
        {PILLARS.map((pillar, index) => {
          const tone = ACCENT_CLASS[pillar.accent];
          const isActive = activeId === pillar.id;

          return (
            <li key={pillar.id}>
              <a
                href={`#${pillar.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "group flex items-baseline gap-3 rounded-lg py-2 pl-3 pr-2 text-sm transition-colors",
                  isActive ? "bg-secondary font-semibold" : "hover:bg-secondary/60"
                )}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 translate-y-[-1px] rounded-full transition-transform",
                    isActive ? cn(tone.dot, "scale-125") : "bg-muted-foreground/40"
                  )}
                />
                <span className="flex flex-col">
                  <span className="font-mono text-[0.62rem] uppercase tracking-widest text-muted-foreground">
                    {String(index + 1).padStart(2, "0")} · {pillar.stage}
                  </span>
                  <span className={cn(isActive && tone.text)}>{pillar.shortTitle}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
