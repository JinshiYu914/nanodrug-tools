"use client";

import { useId } from "react";
import type { LinearFit } from "@/lib/calculations/ribogreen";

export interface ChartPoint {
  x: number;
  y: number;
  enabled: boolean;
}

interface ScatterFitChartProps {
  points: ChartPoint[];
  fit: LinearFit;
  xLabel?: string;
  yLabel?: string;
  className?: string;
}

// Deliberately small viewBox: two curves sit side by side, so each chart
// renders at roughly 300 CSS px. Font sizes are in viewBox units, so a smaller
// box means *larger* effective text at that width.
const W = 280;
const H = 190;
const PAD = { top: 10, right: 12, bottom: 26, left: 40 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;
const TICKS = 4;

/** Snap a domain to round numbers with a 1 / 2 / 2.5 / 5 × 10^k step. */
function niceDomain(lo: number, hi: number, targetTicks = 5) {
  if (!isFinite(lo) || !isFinite(hi)) return { lo: 0, hi: 1, step: 0.25 };
  if (hi === lo) {
    const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.5 : 1;
    lo -= pad;
    hi += pad;
  }
  const rawStep = (hi - lo) / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = mult * mag;
  return {
    lo: Math.floor(lo / step) * step,
    hi: Math.ceil(hi / step) * step,
    step,
  };
}

function ticksOf(d: { lo: number; hi: number; step: number }) {
  const out: number[] = [];
  // Guard against float drift producing an endless loop.
  const n = Math.round((d.hi - d.lo) / d.step);
  for (let i = 0; i <= n; i++) out.push(d.lo + i * d.step);
  return out;
}

function fmtTick(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 10000 || a < 0.001) return v.toExponential(0);
  return String(Number(v.toPrecision(4)));
}

export default function ScatterFitChart({
  points,
  fit,
  xLabel = "读数",
  yLabel = "浓度 (ng/mL)",
  className,
}: ScatterFitChartProps) {
  const clipId = useId().replace(/:/g, "");
  const active = points.filter((p) => p.enabled);
  const empty = active.length === 0 || !fit.valid;

  // Domain from the ENABLED points only, so a rejected outlier doesn't
  // squash the plot. Always include the origin.
  const src = active.length > 0 ? active : points;
  const xd = niceDomain(
    Math.min(0, ...src.map((p) => p.x)),
    Math.max(0, ...src.map((p) => p.x)),
    TICKS
  );
  const yd = niceDomain(
    Math.min(0, ...src.map((p) => p.y)),
    Math.max(0, ...src.map((p) => p.y)),
    TICKS
  );

  const sx = (x: number) => PAD.left + ((x - xd.lo) / (xd.hi - xd.lo)) * INNER_W;
  const sy = (y: number) =>
    PAD.top + INNER_H - ((y - yd.lo) / (yd.hi - yd.lo)) * INNER_H;

  // Fit line clipped to the y-domain so it terminates on the box edge.
  let line: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (fit.valid) {
    const seg: [number, number][] = [
      [xd.lo, fit.a * xd.lo + fit.b],
      [xd.hi, fit.a * xd.hi + fit.b],
    ];
    if (fit.a !== 0) {
      for (const yBound of [yd.lo, yd.hi]) {
        const xAt = (yBound - fit.b) / fit.a;
        if (xAt > xd.lo && xAt < xd.hi) seg.push([xAt, yBound]);
      }
    }
    const inside = seg
      .filter(
        ([x, y]) =>
          x >= xd.lo - 1e-9 &&
          x <= xd.hi + 1e-9 &&
          y >= yd.lo - 1e-9 &&
          y <= yd.hi + 1e-9
      )
      .sort((p, q) => p[0] - q[0]);
    if (inside.length >= 2) {
      const a = inside[0];
      const b = inside[inside.length - 1];
      line = { x1: sx(a[0]), y1: sy(a[1]), x2: sx(b[0]), y2: sy(b[1]) };
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "h-auto w-full"}
      role="img"
      aria-label={`${yLabel} vs ${xLabel} 标准曲线`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={PAD.left}
            y={PAD.top}
            width={INNER_W}
            height={INNER_H}
          />
        </clipPath>
      </defs>

      {/* gridlines */}
      <g stroke="var(--border)" strokeWidth={1}>
        {ticksOf(yd).map((t) => (
          <line key={`gy${t}`} x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} />
        ))}
        {ticksOf(xd).map((t) => (
          <line key={`gx${t}`} y1={PAD.top} y2={H - PAD.bottom} x1={sx(t)} x2={sx(t)} />
        ))}
      </g>

      {/* axes */}
      <g stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.55}>
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} />
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
        />
      </g>

      {/* tick labels + axis titles — fill="currentColor", SVG text ignores `color` */}
      <g className="text-muted-foreground" fill="currentColor" fontSize={9}>
        {ticksOf(yd).map((t) => (
          <text key={`ty${t}`} x={PAD.left - 6} y={sy(t) + 3} textAnchor="end">
            {fmtTick(t)}
          </text>
        ))}
        {ticksOf(xd).map((t) => (
          <text key={`tx${t}`} x={sx(t)} y={H - PAD.bottom + 10} textAnchor="middle">
            {fmtTick(t)}
          </text>
        ))}
        <text x={PAD.left + INNER_W / 2} y={H - 3} textAnchor="middle" fontSize={9}>
          {xLabel}
        </text>
        <text
          x={-(PAD.top + INNER_H / 2)}
          y={9}
          textAnchor="middle"
          fontSize={9}
          transform="rotate(-90)"
        >
          {yLabel}
        </text>
      </g>

      {line && (
        <line
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="var(--chart-2)"
          strokeWidth={1.5}
        />
      )}

      {/* Disabled points can sit outside the enabled-point domain — clip so
          they never escape the plot box. */}
      <g clipPath={`url(#${clipId})`}>
        {points.map((p, i) =>
          p.enabled ? (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill="var(--chart-1)" />
          ) : (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={3.5}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={1.2}
              strokeDasharray="2 2"
            />
          )
        )}
      </g>

      {empty && (
        <text
          x={PAD.left + INNER_W / 2}
          y={PAD.top + INNER_H / 2}
          textAnchor="middle"
          className="text-muted-foreground"
          fill="currentColor"
          fontSize={11}
        >
          数据不足（至少启用 2 个标准点）
        </text>
      )}
    </svg>
  );
}
