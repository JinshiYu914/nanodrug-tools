"use client";

import { useId, useMemo } from "react";
import { fmtTick, ticksOf } from "@/lib/calculations/chart-scale";
import {
  buildChromatogramPaths,
  channelPeaks,
  chromatogramDomain,
  type PlotBox,
} from "@/lib/calculations/chromatogram";
import type { Chromatogram } from "@/lib/calculations/tlnp-experiment";

const W = 620;
const H = 260;
const PAD = { top: 12, right: 14, bottom: 30, left: 48 };
const BOX: PlotBox = {
  left: PAD.left,
  top: PAD.top,
  width: W - PAD.left - PAD.right,
  height: H - PAD.top - PAD.bottom,
};

/** chart-1..5 keep a constant hue across themes, so a trace never changes identity. */
const channelColor = (slot: number) => `var(--chart-${slot})`;

interface Props {
  chromatogram: Chromatogram;
  className?: string;
}

export default function ChromatogramChart({ chromatogram, className }: Props) {
  const clipId = useId().replace(/:/g, "");
  const domains = useMemo(
    () => chromatogramDomain(chromatogram),
    [chromatogram]
  );
  const paths = useMemo(
    () => buildChromatogramPaths(chromatogram, domains, BOX),
    [chromatogram, domains]
  );
  const peaks = useMemo(() => channelPeaks(chromatogram), [chromatogram]);

  const sx = (v: number) =>
    BOX.left +
    ((v - domains.x.lo) / (domains.x.hi - domains.x.lo || 1)) * BOX.width;
  const sy = (v: number) =>
    BOX.top +
    BOX.height -
    ((v - domains.y.lo) / (domains.y.hi - domains.y.lo || 1)) * BOX.height;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className={className ?? "h-auto w-full"}
        role="img"
        aria-label={`${chromatogram.name} 层析峰图`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={BOX.left}
              y={BOX.top}
              width={BOX.width}
              height={BOX.height}
            />
          </clipPath>
        </defs>

        {/* Collected fractions sit behind the traces. */}
        <g clipPath={`url(#${clipId})`}>
          {chromatogram.fractions.map((f) => {
            const x1 = sx(Math.min(f.from, f.to));
            const x2 = sx(Math.max(f.from, f.to));
            return (
              <rect
                key={f.id}
                x={x1}
                y={BOX.top}
                width={Math.max(x2 - x1, 1)}
                height={BOX.height}
                fill="var(--primary)"
                opacity={0.08}
              />
            );
          })}
        </g>

        <g stroke="var(--border)" strokeWidth={1}>
          {ticksOf(domains.y).map((t) => (
            <line
              key={`gy${t}`}
              x1={BOX.left}
              x2={W - PAD.right}
              y1={sy(t)}
              y2={sy(t)}
            />
          ))}
          {ticksOf(domains.x).map((t) => (
            <line
              key={`gx${t}`}
              y1={BOX.top}
              y2={H - PAD.bottom}
              x1={sx(t)}
              x2={sx(t)}
            />
          ))}
        </g>

        <g stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.55}>
          <line
            x1={BOX.left}
            x2={BOX.left}
            y1={BOX.top}
            y2={H - PAD.bottom}
          />
          <line
            x1={BOX.left}
            x2={W - PAD.right}
            y1={H - PAD.bottom}
            y2={H - PAD.bottom}
          />
        </g>

        {/* fill="currentColor" — SVG text ignores `color` */}
        <g className="text-muted-foreground" fill="currentColor" fontSize={9}>
          {ticksOf(domains.y).map((t) => (
            <text key={`ty${t}`} x={BOX.left - 6} y={sy(t) + 3} textAnchor="end">
              {fmtTick(t)}
            </text>
          ))}
          {ticksOf(domains.x).map((t) => (
            <text
              key={`tx${t}`}
              x={sx(t)}
              y={H - PAD.bottom + 12}
              textAnchor="middle"
            >
              {fmtTick(t)}
            </text>
          ))}
          <text
            x={BOX.left + BOX.width / 2}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
          >
            {chromatogram.xLabel}
          </text>
          <text
            x={-(BOX.top + BOX.height / 2)}
            y={11}
            textAnchor="middle"
            fontSize={9}
            transform="rotate(-90)"
          >
            吸光度
          </text>
        </g>

        <g clipPath={`url(#${clipId})`} fill="none" strokeWidth={1.5}>
          {paths.map((d, i) =>
            d ? (
              <path
                key={chromatogram.channels[i].id}
                d={d}
                stroke={channelColor(chromatogram.channels[i].slot)}
              />
            ) : null
          )}
        </g>

        {domains.empty && (
          <text
            x={BOX.left + BOX.width / 2}
            y={BOX.top + BOX.height / 2}
            textAnchor="middle"
            className="text-muted-foreground"
            fill="currentColor"
            fontSize={11}
          >
            没有可绘制的数据
          </text>
        )}
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {chromatogram.channels.map((ch, i) => (
          <span key={ch.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: channelColor(ch.slot) }}
            />
            {ch.label}
            {isFinite(peaks[i]?.x) && (
              <span className="font-mono text-muted-foreground">
                峰值 {peaks[i].y.toPrecision(3)} @ {peaks[i].x.toPrecision(3)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
