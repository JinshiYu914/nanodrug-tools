"use client";

import { useMemo } from "react";
import { fmtTick, niceDomain, ticksOf } from "@/lib/calculations/chart-scale";
import type { InVitroColumnStat } from "@/lib/calculations/tlnp-experiment";
import type { LiverSpleenBar, RoiSeries } from "@/lib/calculations/tlnp-roi";

/**
 * Hand-rolled SVG charts for module 4.
 *
 * Same approach as the chromatogram: no charting library, `chart-scale.ts` for
 * ticks so every axis on the page agrees on what a round number is, and
 * chart-1..5 for series colour so a series keeps its identity across themes.
 *
 * All three are drawn at a fixed viewBox and scaled by the browser, so three of
 * them sit in one row on a wide screen and stack on a narrow one without any
 * measurement code.
 */

const W = 400;
const H = 280;
const PAD = { top: 12, right: 14, bottom: 62, left: 58 };
const BOX = {
  left: PAD.left,
  top: PAD.top,
  width: W - PAD.left - PAD.right,
  height: H - PAD.top - PAD.bottom,
};

const seriesColor = (i: number) => `var(--chart-${(i % 5) + 1})`;

function Axes({
  ticks,
  toY,
  yLabel,
}: {
  ticks: number[];
  toY: (v: number) => number;
  yLabel: string;
}) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={BOX.left}
            x2={BOX.left + BOX.width}
            y1={toY(t)}
            y2={toY(t)}
            stroke="var(--border)"
            strokeWidth={t === 0 ? 1 : 0.5}
          />
          <text
            x={BOX.left - 6}
            y={toY(t) + 3}
            textAnchor="end"
            className="fill-muted-foreground"
            style={{ fontSize: 9 }}
          >
            {fmtTick(t)}
          </text>
        </g>
      ))}
      <text
        x={12}
        y={BOX.top + BOX.height / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${BOX.top + BOX.height / 2})`}
        className="fill-muted-foreground"
        style={{ fontSize: 9 }}
      >
        {yLabel}
      </text>
    </>
  );
}

/** Category labels, tilted because sample names are routinely 10+ characters. */
function XLabels({ names, at }: { names: string[]; at: (i: number) => number }) {
  return (
    <>
      {names.map((name, i) => (
        <text
          key={`${name}-${i}`}
          x={at(i)}
          y={BOX.top + BOX.height + 10}
          textAnchor="end"
          transform={`rotate(-35 ${at(i)} ${BOX.top + BOX.height + 10})`}
          className="fill-foreground"
          style={{ fontSize: 9 }}
        >
          {name.length > 14 ? `${name.slice(0, 13)}…` : name}
        </text>
      ))}
    </>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {items.map((it) => (
        <span
          key={it.label}
          className="flex items-center gap-1 text-[10px] text-muted-foreground"
        >
          <span
            className="h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Frame({
  title,
  children,
  legend,
}: {
  title: string;
  children: React.ReactNode;
  legend?: { label: string; color: string }[];
}) {
  return (
    <figure className="space-y-1 rounded-lg border p-2">
      <figcaption className="text-center text-xs font-medium">{title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
        role="img"
        aria-label={title}
      >
        {children}
      </svg>
      {legend && legend.length > 0 && <Legend items={legend} />}
    </figure>
  );
}

// ─── 体外: mean ± SD, one bar per sample ──────────────────

export function SampleBarChart({
  stats,
  unit,
  title,
}: {
  stats: InVitroColumnStat[];
  unit: string;
  title: string;
}) {
  const shown = stats.filter((s) => s.mean !== null);
  const domain = useMemo(() => {
    const hi = Math.max(
      0,
      ...shown.map((s) => (s.mean ?? 0) + (s.sd ?? 0)),
      ...shown.flatMap((s) => s.values)
    );
    return niceDomain(0, hi || 1, 5);
  }, [shown]);

  if (shown.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground">
        填入数值后自动出图。
      </p>
    );
  }

  const toY = (v: number) =>
    BOX.top +
    BOX.height -
    ((v - domain.lo) / (domain.hi - domain.lo || 1)) * BOX.height;
  const slot = BOX.width / shown.length;
  const barW = Math.min(46, slot * 0.6);
  const center = (i: number) => BOX.left + slot * (i + 0.5);

  return (
    <Frame title={title}>
      <Axes ticks={ticksOf(domain)} toY={toY} yLabel={unit} />
      {shown.map((s, i) => {
        const mean = s.mean ?? 0;
        const top = toY(mean);
        const base = toY(Math.max(domain.lo, 0));
        return (
          <g key={s.id}>
            <rect
              x={center(i) - barW / 2}
              y={Math.min(top, base)}
              width={barW}
              height={Math.abs(base - top)}
              fill={seriesColor(0)}
              opacity={0.85}
            />
            {/* Error bar plus the individual replicates — with three points a
                dot plot says more than a whisker, and both fit. */}
            {s.sd !== null && (
              <g stroke="var(--foreground)" strokeWidth={0.8}>
                <line
                  x1={center(i)}
                  x2={center(i)}
                  y1={toY(mean - s.sd)}
                  y2={toY(mean + s.sd)}
                />
                <line
                  x1={center(i) - 5}
                  x2={center(i) + 5}
                  y1={toY(mean + s.sd)}
                  y2={toY(mean + s.sd)}
                />
                <line
                  x1={center(i) - 5}
                  x2={center(i) + 5}
                  y1={toY(mean - s.sd)}
                  y2={toY(mean - s.sd)}
                />
              </g>
            )}
            {s.values.map((v, k) => (
              <circle
                key={k}
                cx={center(i) + (k - (s.values.length - 1) / 2) * 4}
                cy={toY(v)}
                r={1.6}
                fill="var(--foreground)"
                opacity={0.55}
              />
            ))}
          </g>
        );
      })}
      <XLabels names={shown.map((s) => s.name)} at={center} />
    </Frame>
  );
}

// ─── 体内: grouped columns, one group per sample ──────────

export function GroupedBarChart({
  samples,
  series,
  unit,
  title,
}: {
  samples: string[];
  series: RoiSeries[];
  unit: string;
  title: string;
}) {
  const domain = useMemo(() => {
    let hi = 0;
    for (const s of series) {
      for (const v of s.values) if (v !== null && v > hi) hi = v;
    }
    return niceDomain(0, hi || 1, 5);
  }, [series]);

  if (samples.length === 0 || series.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground">
        粘贴数据后自动出图。
      </p>
    );
  }

  const toY = (v: number) =>
    BOX.top + BOX.height - (v / (domain.hi || 1)) * BOX.height;
  const slot = BOX.width / samples.length;
  const groupW = slot * 0.74;
  const barW = groupW / series.length;
  const center = (i: number) => BOX.left + slot * (i + 0.5);

  return (
    <Frame
      title={title}
      legend={series.map((s, i) => ({ label: s.organ, color: seriesColor(i) }))}
    >
      <Axes ticks={ticksOf(domain)} toY={toY} yLabel={unit} />
      {samples.map((_, si) =>
        series.map((s, oi) => {
          const v = s.values[si];
          if (v === null || !isFinite(v)) return null;
          const x = center(si) - groupW / 2 + oi * barW;
          const y = toY(v);
          return (
            <rect
              key={`${si}-${oi}`}
              x={x}
              y={y}
              width={Math.max(1, barW - 1)}
              height={Math.max(0, BOX.top + BOX.height - y)}
              fill={seriesColor(oi)}
              opacity={0.9}
            >
              <title>{`${samples[si]} · ${s.organ}: ${v.toExponential(2)}`}</title>
            </rect>
          );
        })
      )}
      <XLabels names={samples} at={center} />
    </Frame>
  );
}

// ─── 体内: liver / spleen share, stacked to 1 ─────────────

export function LiverSpleenChart({ bars }: { bars: LiverSpleenBar[] }) {
  if (bars.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground">
        需要同一样本的 liver 与 spleen 两行 Avg ROI 才能算比例。
      </p>
    );
  }

  // The axis is a share, so it is pinned to 0–1 rather than fitted. A fitted
  // axis would make an 80/20 split look like a 100/0 one.
  const toY = (v: number) => BOX.top + BOX.height - v * BOX.height;
  const slot = BOX.width / bars.length;
  const barW = Math.min(46, slot * 0.6);
  const center = (i: number) => BOX.left + slot * (i + 0.5);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <Frame
      title="肝/脾 Avg ROI 占比"
      legend={[
        { label: "肝 liver", color: seriesColor(0) },
        { label: "脾 spleen", color: seriesColor(1) },
      ]}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={BOX.left}
            x2={BOX.left + BOX.width}
            y1={toY(t)}
            y2={toY(t)}
            stroke="var(--border)"
            strokeWidth={t === 0 ? 1 : 0.5}
          />
          <text
            x={BOX.left - 6}
            y={toY(t) + 3}
            textAnchor="end"
            className="fill-muted-foreground"
            style={{ fontSize: 9 }}
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      <text
        x={12}
        y={BOX.top + BOX.height / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${BOX.top + BOX.height / 2})`}
        className="fill-muted-foreground"
        style={{ fontSize: 9 }}
      >
        占比
      </text>

      {bars.map((b, i) => (
        <g key={b.sample}>
          <rect
            x={center(i) - barW / 2}
            y={toY(b.liver)}
            width={barW}
            height={b.liver * BOX.height}
            fill={seriesColor(0)}
            opacity={0.9}
          >
            <title>{`${b.sample} 肝 ${(b.liver * 100).toFixed(1)}%`}</title>
          </rect>
          <rect
            x={center(i) - barW / 2}
            y={toY(1)}
            width={barW}
            height={b.spleen * BOX.height}
            fill={seriesColor(1)}
            opacity={0.9}
          >
            <title>{`${b.sample} 脾 ${(b.spleen * 100).toFixed(1)}%`}</title>
          </rect>
        </g>
      ))}
      <XLabels names={bars.map((b) => b.sample)} at={center} />
    </Frame>
  );
}
