/**
 * Axis scaling shared by every hand-rolled SVG chart in the tools.
 *
 * Extracted from ribogreen/scatter-fit-chart.tsx so the chromatogram doesn't
 * grow a second, subtly different tick algorithm — two charts sitting on the
 * same page with different notions of a "round number" reads as a bug.
 */

export interface Domain {
  lo: number;
  hi: number;
  step: number;
}

/** Snap a domain to round numbers with a 1 / 2 / 2.5 / 5 × 10^k step. */
export function niceDomain(lo: number, hi: number, targetTicks = 5): Domain {
  if (!isFinite(lo) || !isFinite(hi)) return { lo: 0, hi: 1, step: 0.25 };
  if (hi === lo) {
    const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.5 : 1;
    lo -= pad;
    hi += pad;
  }
  const rawStep = (hi - lo) / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const mult =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = mult * mag;
  return {
    lo: Math.floor(lo / step) * step,
    hi: Math.ceil(hi / step) * step,
    step,
  };
}

export function ticksOf(d: Domain): number[] {
  const out: number[] = [];
  // Guard against float drift producing an endless loop.
  const n = Math.round((d.hi - d.lo) / d.step);
  for (let i = 0; i <= n; i++) out.push(d.lo + i * d.step);
  return out;
}

export function fmtTick(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 10000 || a < 0.001) return v.toExponential(0);
  return String(Number(v.toPrecision(4)));
}
