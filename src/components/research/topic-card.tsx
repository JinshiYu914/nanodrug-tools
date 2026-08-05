"use client";

import { Plus } from "lucide-react";
import { DIAGRAMS } from "@/components/diagrams";
import { cn } from "@/lib/utils";
import {
  ACCENT_CLASS,
  type PillarAccent,
  type TopicMeta,
} from "@/content/research/types";

/**
 * A topic, expanding in place.
 *
 * There is no detail route behind this — a drill-down page that repeats the
 * card costs a navigation and changes nothing, so the detail lives here and
 * the card is deep-linkable by hash instead.
 *
 * The open/close animation is a 0fr -> 1fr grid row rather than max-height,
 * which means it animates to the content's real height without anyone having
 * to guess a pixel value that will be wrong for the longest card.
 */
export function TopicCard({
  accent,
  topic,
  isOpen,
  onToggle,
  className,
}: {
  accent: PillarAccent;
  topic: TopicMeta;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const tone = ACCENT_CLASS[accent];
  const Diagram = topic.diagram ? DIAGRAMS[topic.diagram] : null;
  const panelId = `${topic.slug}-detail`;

  return (
    <article
      id={topic.slug}
      className={cn(
        "sketch-card scroll-mt-24 transition-shadow",
        isOpen && tone.panel,
        className
      )}
    >
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full items-start gap-3 rounded-[inherit] p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold leading-tight tracking-tight">
              {topic.title}
            </span>
            <span className={cn("mt-1 block text-sm font-medium", tone.text)}>
              {topic.tagline}
            </span>
            <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
              {topic.summary}
            </span>
          </span>

          <span
            aria-hidden="true"
            className={cn(
              "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-ink/20 transition-transform duration-200",
              isOpen && "rotate-45"
            )}
          >
            <Plus className="size-4" />
          </span>
        </button>
      </h3>

      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-ink/12 px-5 pb-5 pt-4">
            <ul className="flex flex-col gap-2.5">
              {topic.detail.map((point) => (
                <li key={point} className="flex gap-2.5 text-sm leading-relaxed">
                  <span
                    aria-hidden="true"
                    className={cn("mt-2 size-1.5 shrink-0 rounded-full", tone.dot)}
                  />
                  {point}
                </li>
              ))}
            </ul>

            {Diagram ? (
              <div className="mt-5 rounded-lg bg-secondary/50 p-4">
                <Diagram className="mx-auto max-w-md" />
              </div>
            ) : null}

            <ul className="mt-5 flex flex-wrap gap-1.5">
              {topic.keywords.map((keyword) => (
                <li
                  key={keyword}
                  className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[0.68rem] text-muted-foreground"
                >
                  {keyword}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}
