"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PILLARS } from "@/content/research";
import { ACCENT_CLASS, type PillarId } from "@/content/research/types";

/**
 * The whole programme as one branch diagram: a core node with three arms.
 *
 * Geometry is shared between the SVG connectors and the HTML nodes by giving
 * the container a fixed aspect ratio that matches the viewBox exactly. The
 * connectors are SVG; the nodes are real buttons positioned by percentage.
 * Doing the labels in SVG text would have cost focus rings, selectable text
 * and sane wrapping, for nothing.
 *
 * The ambient motion is in the connectors and the pulse behind the core, never
 * in the arm nodes. Drifting a hit target forever makes it something you have
 * to chase, and these exist to be hovered — the nodes only move in response to
 * you, by scaling when selected.
 */

/**
 * viewBox 1000 x 900, core at (500, 400), arms 120° apart at radius 330.
 *
 * Node diameters are percentages of the container, not pixels — a fixed px
 * size does not shrink with the viewBox, so the arms climbed on top of the
 * core as soon as the container got narrower than the design width.
 */
const VB = { w: 1000, h: 900 };
const CORE = { x: 500, y: 400 };
const CORE_SIZE = "27%";
const ARM_SIZE = "23%";

const NODES: Record<PillarId, { x: number; y: number }> = {
  lnp: { x: 214, y: 235 },
  mrna: { x: 786, y: 235 },
  disease: { x: 500, y: 730 },
};

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

export function OrbitMap() {
  const [activeId, setActiveId] = useState<PillarId>("lnp");
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const active = PILLARS.find((pillar) => pillar.id === activeId) ?? PILLARS[0];
  const activeTone = ACCENT_CLASS[active.accent];

  function select(id: PillarId) {
    setActiveId(id);
    setOpenTopic(null);
  }

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_minmax(0,1fr)] lg:gap-14">
      {/* ---- Branch diagram (desktop) ---- */}
      <div className="relative mx-auto hidden aspect-[10/9] w-full max-w-xl md:block">
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          className="absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden="true"
        >
          {PILLARS.map((pillar) => {
            const node = NODES[pillar.id];
            const isActive = pillar.id === activeId;
            return (
              <line
                key={pillar.id}
                x1={CORE.x}
                y1={CORE.y}
                x2={node.x}
                y2={node.y}
                stroke={isActive ? `var(--pillar-${pillar.accent})` : "var(--ink)"}
                strokeWidth={isActive ? 5 : 3}
                strokeLinecap="round"
                opacity={isActive ? 1 : 0.42}
                className={isActive ? "orbit-link" : undefined}
              />
            );
          })}
        </svg>

        {/* Core, with a pulse ring behind it carrying the ambient motion */}
        <div
          aria-hidden="true"
          className="orbit-pulse absolute rounded-full border-2 border-ink/40"
          style={{
            left: pct(CORE.x, VB.w),
            top: pct(CORE.y, VB.h),
            width: CORE_SIZE,
            aspectRatio: "1",
          }}
        />
        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-ink bg-card text-center shadow-sticker"
          style={{
            left: pct(CORE.x, VB.w),
            top: pct(CORE.y, VB.h),
            width: CORE_SIZE,
            aspectRatio: "1",
          }}
        >
          <span className="font-display text-base font-extrabold leading-tight tracking-tight lg:text-lg">
            LNP–mRNA
          </span>
          <span className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
            delivery
          </span>
        </div>

        {/* Arms */}
        {PILLARS.map((pillar, index) => {
          const node = NODES[pillar.id];
          const tone = ACCENT_CLASS[pillar.accent];
          const isActive = pillar.id === activeId;

          return (
            <button
              key={pillar.id}
              type="button"
              onMouseEnter={() => select(pillar.id)}
              onFocus={() => select(pillar.id)}
              onClick={() => select(pillar.id)}
              aria-pressed={isActive}
              className={cn(
                "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 bg-card text-center transition-[box-shadow,border-color,color,scale] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none",
                isActive
                  ? cn(tone.ring, "scale-105 shadow-sticker-lg", tone.text)
                  : "border-ink/25 text-muted-foreground shadow-sticker-sm hover:border-ink/60"
              )}
              style={{
                left: pct(node.x, VB.w),
                top: pct(node.y, VB.h),
                width: ARM_SIZE,
                aspectRatio: "1",
              }}
            >
              {/* Number only. "03 · APPLICATION" does not fit inside a circle
                  this size, and the stage is named in the panel anyway. */}
              <span className="font-mono text-[0.6rem] tracking-[0.14em] opacity-60">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-0.5 font-display text-base font-extrabold tracking-tight lg:text-lg">
                {pillar.shortTitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---- Same choice, as a row, on phones ---- */}
      <div className="flex gap-2 md:hidden">
        {PILLARS.map((pillar) => {
          const tone = ACCENT_CLASS[pillar.accent];
          const isActive = pillar.id === activeId;
          return (
            <button
              key={pillar.id}
              type="button"
              onClick={() => select(pillar.id)}
              aria-pressed={isActive}
              className={cn(
                "flex-1 rounded-xl border-2 px-2 py-2.5 font-display text-sm font-bold transition-colors",
                isActive ? cn(tone.ring, tone.text) : "border-ink/20 text-muted-foreground"
              )}
            >
              {pillar.shortTitle}
            </button>
          );
        })}
      </div>

      {/* ---- Framework for the selected arm ---- */}
      <div className={cn("sketch-card p-6", activeTone.panel)}>
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {active.stage}
        </p>
        <h3 className="mt-1.5 font-display text-2xl font-extrabold leading-tight tracking-tight">
          {active.title}
        </h3>
        <p className={cn("mt-1.5 text-sm font-medium", activeTone.text)}>
          {active.question}
        </p>

        <ul className="mt-5 flex flex-col">
          {active.topics.map((topic) => {
            const isOpen = openTopic === topic.slug;
            return (
              <li key={topic.slug} className="border-t border-ink/12 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setOpenTopic(isOpen ? null : topic.slug)}
                  aria-expanded={isOpen}
                  className="flex w-full items-baseline gap-2.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full transition-transform",
                      activeTone.dot,
                      isOpen && "scale-150"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[0.95rem] font-bold leading-snug">
                      {topic.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {topic.tagline}
                    </span>
                  </span>
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <ul className="flex flex-col gap-2 pb-4 pl-6 pr-1">
                      {topic.detail.map((point) => (
                        <li
                          key={point}
                          className="text-[0.82rem] leading-relaxed text-muted-foreground"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
