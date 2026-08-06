"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DIAGRAMS } from "@/components/diagrams";
import { PILLARS } from "@/content/research";
import { ACCENT_CLASS, type PillarId } from "@/content/research/types";

/**
 * The programme as the route one dose takes: injected, delivered, translated,
 * and finally branching into what it treats.
 *
 * The shape is the argument. Delivery → Message → Application is a sequence —
 * `stage` in the content says so — which is why this is a route with numbered
 * stations and not a hub with arms. The three stations are deliberately three
 * different shapes, each taken from the thing it draws: the particle is round,
 * the mRNA construct is a linear bar, and the cell is an uneven blob from which
 * the four disease programmes fan out. Three identical circles would have been
 * an org chart with biology written on it.
 *
 * Motion is one orchestrated arrival and then nothing. The route draws itself,
 * each station lands as the line reaches it, and after that the page only moves
 * in response to the pointer. Keyframes live in globals.css.
 */

/* -------------------------------------------------------------------------
 * Geometry. Everything is in viewBox units and converted to percentages, so
 * the SVG and the HTML station buttons stay locked together at any width.
 * Fixed pixel sizes were what put the old orbit nodes on top of its core.
 * ---------------------------------------------------------------------- */
const VB = { w: 1200, h: 276 };

/**
 * The route, one leg per stage. Split rather than a single path so the stroke
 * can thin out along the way — a bolus of particles at the needle, one
 * transcript by the end — and so a single leg can be lit on its own.
 *
 * `len` is the path length in user units, used for the dash reveal. Measured
 * with getTotalLength() and rounded up; over-estimating only means the draw
 * starts a hair late, under-estimating leaves the tail permanently hidden.
 * Re-measure if any `d` changes.
 */
const LEGS = [
  { d: "M78 146C160 146 214 124 330 124", len: 254, width: 5, dur: 280, delay: 0 },
  { d: "M330 124C470 124 548 152 700 152", len: 372, width: 3.6, dur: 360, delay: 280 },
  { d: "M700 152C856 152 902 116 1006 116", len: 310, width: 2.8, dur: 300, delay: 640 },
] as const;

type StationShape = "circle" | "bar" | "blob";

const STATIONS: {
  cx: number;
  cy: number;
  w: number;
  h: number;
  shape: StationShape;
  delay: number;
}[] = [
  { cx: 330, cy: 124, w: 150, h: 150, shape: "circle", delay: 260 },
  { cx: 700, cy: 152, w: 210, h: 68, shape: "bar", delay: 620 },
  { cx: 1006, cy: 116, w: 140, h: 140, shape: "blob", delay: 920 },
];

/** Where the last leg splits into the four disease programmes. */
const FAN = { x: 1078, y: 116 };
const BRANCH_Y = [62, 98, 134, 170];

/** A hand-drawn cell outline, so station 03 is not just another circle. */
const BLOB_RADIUS = "58% 42% 54% 46% / 46% 58% 42% 54%";

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

export function DoseRoute() {
  const [activeId, setActiveId] = useState<PillarId>("lnp");
  /** Whichever topic the pointer is on, or the one a hash link named. */
  const [liveTopic, setLiveTopic] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState<number>();
  const contentRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const activeIndex = PILLARS.findIndex((pillar) => pillar.id === activeId);
  const active = PILLARS[activeIndex] ?? PILLARS[0];
  const activeTone = ACCENT_CLASS[active.accent];

  const select = useCallback((id: PillarId) => {
    clearTimeout(hoverTimer.current);
    setActiveId(id);
    setLiveTopic(null);
  }, []);

  /**
   * Hover selects, but not instantly. Sweeping the pointer from station 01 to
   * 03 crosses 02, and without the delay the panel rebuilds itself twice on
   * the way past. 90ms is under the threshold where a deliberate hover feels
   * laggy and over the one where a pass-through registers.
   */
  const hoverSelect = useCallback(
    (id: PillarId) => {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => select(id), 90);
    },
    [select]
  );

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  /**
   * The panel animates between pillars instead of snapping, which means the
   * container needs a real height to transition. The observed element is in
   * normal flow inside an overflow-hidden box, so its height never depends on
   * the height we set — no observer loop.
   */
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setPanelHeight(entry.target.getBoundingClientRect().height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goToTopic = useCallback((slug: string) => {
    const match = PILLARS.find((pillar) =>
      pillar.topics.some((topic) => topic.slug === slug)
    );
    if (!match) return;
    setActiveId(match.id);
    setLiveTopic(slug);
    requestAnimationFrame(() =>
      document.getElementById(slug)?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }, []);

  /**
   * Topics are addressable as `/#utr-models` without having their own routes.
   * Deferred into a frame because setting state during the effect that runs on
   * mount is a lint error, and reading the hash in a lazy initialiser would
   * desync from the server render — the server never sees the fragment.
   *
   * A hash-only navigation does not remount, hence the listener.
   */
  useEffect(() => {
    const apply = () => {
      const slug = window.location.hash.slice(1);
      if (slug) goToTopic(slug);
    };
    const frame = requestAnimationFrame(apply);
    window.addEventListener("hashchange", apply);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", apply);
    };
  }, [goToTopic]);

  return (
    <div className="flex flex-col gap-10">
      {/* ---- The route (lg and up) ------------------------------------- */}
      <div
        className="relative mx-auto hidden w-full lg:block"
        style={{ aspectRatio: `${VB.w} / ${VB.h}` }}
      >
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          className="absolute inset-0 h-full w-full text-ink"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Syringe. The one object that says this is a dose and not a flowchart. */}
          <g stroke="currentColor" opacity="0.55">
            <path d="M12 134v24" strokeWidth={2.4} />
            <path d="M12 146h10" strokeWidth={2.4} />
            <path d="M22 134h34a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H22Z" strokeWidth={2.4} />
            <path d="M34 136v20M44 136v20" strokeWidth={1.2} opacity="0.7" />
            <path d="M60 146h18" strokeWidth={1.8} />
          </g>

          {/* Ink spine, drawn once on load. */}
          {LEGS.map((leg, index) => (
            <path
              key={leg.d}
              d={leg.d}
              className="route-draw"
              stroke="currentColor"
              strokeWidth={leg.width}
              opacity={index === activeIndex ? 0.4 : 0.2}
              style={
                {
                  "--route-len": leg.len,
                  animationDuration: `${leg.dur}ms`,
                  animationDelay: `${leg.delay}ms`,
                  transition: "opacity 200ms ease-out",
                } as React.CSSProperties
              }
            />
          ))}

          {/* The lit leg. Keyed on the pillar so the reveal replays each time. */}
          <path
            key={activeId}
            d={LEGS[activeIndex].d}
            className="route-leg-in"
            stroke={`var(--pillar-${active.accent})`}
            strokeWidth={LEGS[activeIndex].width}
            style={{ "--route-len": LEGS[activeIndex].len } as React.CSSProperties}
          />

          {/* Four programmes out of one arrival. Only the disease arm fans —
              the other two are single lines of work, and giving them matching
              decoration would be symmetry for its own sake. */}
          <g
            className="route-fade-in"
            style={{ animationDelay: "1000ms" }}
            stroke={
              activeId === "disease" ? "var(--pillar-disease)" : "currentColor"
            }
          >
            {BRANCH_Y.map((y, index) => {
              const topic = PILLARS[2].topics[index];
              const isOpen = liveTopic === topic?.slug;
              const dimmed = activeId === "disease" && liveTopic !== null && !isOpen;
              return (
                <g
                  key={y}
                  opacity={dimmed ? 0.22 : activeId === "disease" ? 1 : 0.3}
                  style={{ transition: "opacity 200ms ease-out" }}
                >
                  <path
                    d={`M${FAN.x} ${FAN.y}C${FAN.x + 32} ${FAN.y} ${FAN.x + 40} ${y} ${FAN.x + 72} ${y}`}
                    strokeWidth={isOpen ? 3.2 : 2.2}
                  />
                  <circle
                    cx={FAN.x + 80}
                    cy={y}
                    r={isOpen ? 7 : 5}
                    fill={
                      activeId === "disease" ? "var(--pillar-disease)" : "currentColor"
                    }
                    stroke="none"
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {PILLARS.map((pillar, index) => {
          const station = STATIONS[index];
          const tone = ACCENT_CLASS[pillar.accent];
          const isActive = pillar.id === activeId;
          const Drawing = DIAGRAMS[pillar.diagram];

          return (
            <button
              key={pillar.id}
              type="button"
              onMouseEnter={() => hoverSelect(pillar.id)}
              onMouseLeave={() => clearTimeout(hoverTimer.current)}
              onFocus={() => select(pillar.id)}
              onClick={() => select(pillar.id)}
              aria-pressed={isActive}
              aria-label={`${pillar.stage}: ${pillar.title}`}
              className="station-in absolute focus-visible:outline-none"
              style={{
                left: pct(station.cx - station.w / 2, VB.w),
                top: pct(station.cy - station.h / 2, VB.h),
                width: pct(station.w, VB.w),
                animationDelay: `${station.delay}ms`,
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex w-full items-center justify-center border-2 bg-card transition-[border-color,box-shadow,translate] duration-200 motion-reduce:transition-none",
                  station.shape === "bar" ? "rounded-2xl px-4" : "p-[12%]",
                  isActive
                    ? cn(tone.ring, "-translate-y-[3px] shadow-sticker-lg", tone.text)
                    : "border-ink/30 text-ink shadow-sticker-sm"
                )}
                style={{
                  aspectRatio: `${station.w} / ${station.h}`,
                  borderRadius:
                    station.shape === "circle"
                      ? "9999px"
                      : station.shape === "blob"
                        ? BLOB_RADIUS
                        : undefined,
                }}
              >
                <Drawing variant="thumb" />
              </span>

              <span className="mt-3 block text-center">
                <span
                  className={cn(
                    // nowrap: "03 · APPLICATION" is wider than its own station
                    // at 1024px. Overflowing a centred label is fine; wrapping
                    // it pushes the title out of alignment with its neighbours.
                    "block whitespace-nowrap font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] transition-colors",
                    isActive ? tone.text : "text-muted-foreground"
                  )}
                >
                  {String(index + 1).padStart(2, "0")} · {pillar.stage}
                </span>
                <span className="mt-0.5 block font-display text-lg font-extrabold tracking-tight">
                  {pillar.shortTitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ---- Same three stations, stacked, below lg --------------------
           Between md and lg the container is only ~700px, which shrinks a
           station to under 90px and turns the drawings to mush. So the switch
           is at lg, not md. The panel below is shared by both layouts. */}
      <ol className="relative flex flex-col gap-3 pt-6 lg:hidden">
        <span
          aria-hidden="true"
          className="absolute bottom-8 left-9 top-8 w-0.5 -translate-x-1/2 bg-ink/20"
        />
        {PILLARS.map((pillar, index) => {
          const tone = ACCENT_CLASS[pillar.accent];
          const isActive = pillar.id === activeId;
          const Drawing = DIAGRAMS[pillar.diagram];

          return (
            <li key={pillar.id} className="relative">
              <button
                type="button"
                onClick={() => select(pillar.id)}
                aria-pressed={isActive}
                className="flex w-full items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-card p-2.5",
                    isActive
                      ? cn(tone.ring, "shadow-sticker-sm", tone.text)
                      : "border-ink/30 text-ink"
                  )}
                >
                  <Drawing variant="thumb" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em]",
                      isActive ? tone.text : "text-muted-foreground"
                    )}
                  >
                    {String(index + 1).padStart(2, "0")} · {pillar.stage}
                  </span>
                  <span className="block font-display text-base font-extrabold tracking-tight">
                    {pillar.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ---- Framework for the station you are pointing at --------------
           Nothing here is collapsed. The topics used to expand on click, which
           assumed you knew they were clickable; the summary is short enough to
           just show. `detail` stays in the content model for the per-topic
           writeups, but four topics times four sentences is the wall of text
           this whole section exists to replace.

           The container carries a measured height so switching pillars eases
           between two sizes instead of jumping the page. */}
      <div
        className="panel-in overflow-hidden transition-[height] duration-[420ms] ease-[cubic-bezier(0.2,0.8,0.3,1)] motion-reduce:transition-none"
        style={{ height: panelHeight }}
      >
        <div ref={contentRef} className="pb-1">
          <div key={activeId}>
            <header className="panel-swap">
              <h3 className="font-display text-2xl font-extrabold leading-tight tracking-tight">
                {active.title}
              </h3>
              <p className={cn("mt-1.5 text-sm font-medium", activeTone.text)}>
                {active.question}
              </p>
            </header>

            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {active.topics.map((topic, index) => {
                const isLive = liveTopic === topic.slug;
                const TopicDiagram = topic.diagram ? DIAGRAMS[topic.diagram] : null;

                return (
                  <li
                    key={topic.slug}
                    id={topic.slug}
                    // A topic with a drawing takes the full row and puts the
                    // picture beside its text. Stacked under a half-width card
                    // it triples that card's height for no structural reason;
                    // shrunk to fit one, its labels stop being legible.
                    className={cn("card-in scroll-mt-28", TopicDiagram && "sm:col-span-2")}
                    style={{ animationDelay: `${90 + index * 55}ms` }}
                  >
                    <article
                      onMouseEnter={() => setLiveTopic(topic.slug)}
                      onMouseLeave={() =>
                        setLiveTopic((current) => (current === topic.slug ? null : current))
                      }
                      className={cn(
                        "flex h-full rounded-2xl border-2 bg-card p-5 transition-[border-color,box-shadow,translate] duration-300 ease-out motion-reduce:transition-none",
                        TopicDiagram ? "flex-col gap-4 sm:flex-row sm:items-center sm:gap-8" : "flex-col",
                        isLive
                          ? cn(activeTone.ringSoft, "-translate-y-0.5 shadow-sticker-sm")
                          : "border-ink/12"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="flex items-start gap-2.5 font-display text-[0.95rem] font-bold leading-snug">
                          <span
                            aria-hidden="true"
                            className={cn(
                              "mt-[0.42rem] size-1.5 shrink-0 rounded-full transition-transform duration-300 motion-reduce:transition-none",
                              activeTone.dot,
                              isLive && "scale-150"
                            )}
                          />
                          {topic.title}
                        </h4>
                        <p className="mt-2 pl-4 text-[0.83rem] leading-relaxed text-muted-foreground">
                          {topic.summary}
                        </p>
                      </div>
                      {TopicDiagram ? (
                        <div className="shrink-0 text-ink sm:w-[46%]">
                          <TopicDiagram variant="full" />
                        </div>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
