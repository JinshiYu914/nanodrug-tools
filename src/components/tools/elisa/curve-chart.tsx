"use client";

import { useId } from "react";
import {
  formatNumber,
  observedStandardPoints,
  type ElisaFit,
  type ElisaStandardPoint,
} from "@/lib/calculations/elisa";

interface ElisaCurveChartProps {
  points: ElisaStandardPoint[];
  fit: ElisaFit;
  unit: string;
}

const WIDTH = 420;
const HEIGHT = 260;
const PAD = { top: 14, right: 16, bottom: 42, left: 50 };
const INNER_WIDTH = WIDTH - PAD.left - PAD.right;
const INNER_HEIGHT = HEIGHT - PAD.top - PAD.bottom;

function linearTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
}

export default function ElisaCurveChart({ points, fit, unit }: ElisaCurveChartProps) {
  const clipId = useId().replace(/:/g, "");
  const observed = observedStandardPoints(points);
  const usesLogX = fit.method !== "linear";
  const positive = observed
    .map((point) => point.concentration)
    .filter((value) => value > 0);
  const minLog = positive.length > 0 ? Math.log10(Math.min(...positive)) : 0;
  const maxLog = positive.length > 0 ? Math.log10(Math.max(...positive)) : 1;
  const zeroX = minLog - Math.max((maxLog - minLog) * 0.16, 0.35);
  const tx = (value: number) => (usesLogX ? (value > 0 ? Math.log10(value) : zeroX) : value);

  const transformedX = observed.map((point) => tx(point.concentration));
  const rawMinX = transformedX.length > 0 ? Math.min(...transformedX) : 0;
  const rawMaxX = transformedX.length > 0 ? Math.max(...transformedX) : 1;
  const xPadding = Math.max((rawMaxX - rawMinX) * 0.04, 0.02);
  const hasZeroConcentration = usesLogX && observed.some((point) => point.concentration === 0);
  // Zero has no mathematical position on a log axis, so it gets a dedicated
  // slot immediately before the positive log range. Do not add more padding
  // to that side: the zero tick, point, and y-axis should share one x position.
  const xMin = hasZeroConcentration ? rawMinX : rawMinX - xPadding;
  const xMax = rawMaxX + xPadding;

  const allOds = observed.flatMap((point) => point.ods);
  const rawMinY = allOds.length > 0 ? Math.min(0, ...allOds) : 0;
  const rawMaxY = allOds.length > 0 ? Math.max(...allOds) : 1;
  const yPadding = Math.max((rawMaxY - rawMinY) * 0.1, 0.05);
  const yMin = rawMinY - yPadding * 0.2;
  const yMax = rawMaxY + yPadding;

  const sx = (value: number) => PAD.left + ((tx(value) - xMin) / (xMax - xMin || 1)) * INNER_WIDTH;
  const sy = (value: number) => PAD.top + INNER_HEIGHT - ((value - yMin) / (yMax - yMin || 1)) * INNER_HEIGHT;

  const xTickValues = usesLogX
    ? [
        ...(hasZeroConcentration ? [0] : []),
        ...linearTicks(minLog, maxLog).map((value) => 10 ** value),
      ]
    : linearTicks(
        observed.length > 0 ? Math.min(...observed.map((point) => point.concentration)) : 0,
        observed.length > 0 ? Math.max(...observed.map((point) => point.concentration)) : 1
      );
  const yTicks = linearTicks(Math.max(0, rawMinY), rawMaxY);

  const curvePath = (() => {
    if (!fit.valid || observed.length === 0) return "";
    const samples = Array.from({ length: 180 }, (_, index) => {
      const transformed = rawMinX + ((rawMaxX - rawMinX) * index) / 179;
      const concentration = usesLogX
        ? transformed <= zeroX + 1e-9
          ? 0
          : 10 ** transformed
        : transformed;
      return { concentration, od: fit.predictOd(concentration) };
    }).filter((point) => Number.isFinite(point.od));
    return samples
      .map((point, index) => `${index === 0 ? "M" : "L"}${sx(point.concentration)},${sy(point.od)}`)
      .join(" ");
  })();

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
      role="img"
      aria-label={`ELISA 标准曲线，浓度单位 ${unit}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={PAD.left} y={PAD.top} width={INNER_WIDTH} height={INNER_HEIGHT} />
        </clipPath>
      </defs>

      <g stroke="var(--border)" strokeWidth="1">
        {xTickValues.map((tick, index) => (
          <line key={`x-${index}`} x1={sx(tick)} x2={sx(tick)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
        ))}
        {yTicks.map((tick, index) => (
          <line key={`y-${index}`} x1={PAD.left} x2={WIDTH - PAD.right} y1={sy(tick)} y2={sy(tick)} />
        ))}
      </g>

      <g stroke="var(--muted-foreground)" strokeWidth="1.2" opacity="0.7">
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} />
      </g>

      <g fill="currentColor" className="text-muted-foreground" fontSize="9">
        {xTickValues.map((tick, index) => (
          <text key={`xt-${index}`} x={sx(tick)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle">
            {formatNumber(tick, 3)}
          </text>
        ))}
        {yTicks.map((tick, index) => (
          <text key={`yt-${index}`} x={PAD.left - 10} y={sy(tick) + 4} textAnchor="end">
            {formatNumber(tick, 3)}
          </text>
        ))}
        <text x={PAD.left + INNER_WIDTH / 2} y={HEIGHT - 7} textAnchor="middle" fontSize="9">
          浓度 ({unit}){usesLogX ? " · 对数坐标" : ""}
        </text>
        <text
          x={-(PAD.top + INNER_HEIGHT / 2)}
          y="11"
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="9"
        >
          OD450
        </text>
      </g>

      <g clipPath={`url(#${clipId})`}>
        {curvePath && (
          <path d={curvePath} fill="none" stroke="var(--chart-2)" strokeWidth="2" strokeLinecap="round" />
        )}
        {observed.flatMap((point, pointIndex) =>
          point.ods.map((od, replicateIndex) => (
            <circle
              key={`${pointIndex}-${replicateIndex}`}
              cx={sx(point.concentration)}
              cy={sy(od)}
              r="3"
              fill="var(--chart-1)"
              opacity="0.35"
            />
          ))
        )}
        {observed.map((point, index) => (
          <circle
            key={`mean-${index}`}
            cx={sx(point.concentration)}
            cy={sy(point.meanOd)}
            r="4"
            fill="var(--chart-1)"
            stroke="var(--background)"
            strokeWidth="2"
          />
        ))}
      </g>

      {!fit.valid && (
        <text
          x={PAD.left + INNER_WIDTH / 2}
          y={PAD.top + INNER_HEIGHT / 2}
          textAnchor="middle"
          fill="currentColor"
          className="text-muted-foreground"
          fontSize="10"
        >
          {fit.method === "four-pl" ? "至少输入 4 个有效标准点" : "至少输入 2 个有效标准点"}
        </text>
      )}
    </svg>
  );
}
