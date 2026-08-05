"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILLARS } from "@/content/research";
import { ACCENT_CLASS } from "@/content/research/types";

/**
 * The whole programme on one screen: three stages of a pipeline, nine topics
 * hanging off them.
 *
 * Built from real elements with CSS connectors rather than as one SVG, so the
 * labels stay selectable, the nodes stay focusable, and the thing reflows to a
 * single column on a phone instead of shrinking to unreadable.
 *
 * Left to right is a claim, not a layout convenience: delivery decides the
 * organ, sequence decides the cell, and the disease work is what those two
 * together make reachable.
 */
export function SkeletonMap({
  onSelect,
}: {
  onSelect: (pillarId: string, topicSlug: string) => void;
}) {
  return (
    <div className="sketch-card overflow-hidden p-5 sm:p-7">
      <div className="grid gap-x-4 gap-y-8 md:grid-cols-3">
        {PILLARS.map((pillar, index) => {
          const tone = ACCENT_CLASS[pillar.accent];

          return (
            <div key={pillar.id} className="relative flex flex-col">
              <div className="flex items-center gap-2">
                <span className={cn("size-2.5 shrink-0 rounded-full", tone.dot)} />
                <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")} · {pillar.stage}
                </span>
                {index < PILLARS.length - 1 ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-auto hidden size-4 text-muted-foreground/50 md:block"
                  />
                ) : null}
              </div>

              <a
                href={`#${pillar.id}`}
                className={cn(
                  "mt-2 font-display text-lg font-bold leading-tight tracking-tight hover:underline",
                  "decoration-2 underline-offset-4"
                )}
              >
                {pillar.title}
              </a>

              {/* Spine + nodes */}
              <ul
                className={cn(
                  "mt-4 flex flex-col gap-1.5 border-l-2 pl-4",
                  tone.ring
                )}
              >
                {pillar.topics.map((topic) => (
                  <li key={topic.slug} className="relative">
                    {/* connector tick */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute -left-4 top-[0.95rem] h-0.5 w-3 border-t-2",
                        tone.ring
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => onSelect(pillar.id, topic.slug)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm leading-snug transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {topic.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
