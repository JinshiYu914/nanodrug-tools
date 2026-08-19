// ELISA standard-curve fitting and sample calculation.
// Pure calculation layer: no React, browser APIs, or persistence.

export type ElisaFitMethod = "four-pl" | "linear" | "log-linear";

export interface ElisaStandardPoint {
  id: string;
  concentration: string;
  od1: string;
  od2: string;
  od3: string;
}

export interface ElisaSampleRow {
  id: string;
  group: string;
  od: string;
  dilution: string;
}

export interface ElisaObservedPoint {
  concentration: number;
  meanOd: number;
  ods: number[];
}

export interface ElisaFit {
  method: ElisaFitMethod;
  valid: boolean;
  r2: number;
  n: number;
  minConcentration: number;
  maxConcentration: number;
  minOd: number;
  maxOd: number;
  parameters: number[];
  equation: string;
  predictOd: (concentration: number) => number;
  concentrationFromOd: (od: number) => number | null;
}

export type ElisaRangeFlag = "within" | "below" | "above" | "invalid";

export interface ElisaSampleResult {
  measuredConcentration: number | null;
  finalConcentration: number | null;
  range: ElisaRangeFlag;
}

export const ELISA_FIT_METHODS: Array<{
  value: ElisaFitMethod;
  label: string;
  description: string;
}> = [
  {
    value: "four-pl",
    label: "四参数逻辑回归（4PL）",
    description: "适用于常见 S 形 ELISA 标准曲线。",
  },
  {
    value: "linear",
    label: "线性回归",
    description: "适用于确认处于线性响应区间的数据。",
  },
  {
    value: "log-linear",
    label: "半对数线性回归",
    description: "以 log10(浓度) 为横轴；零浓度点不参与拟合。",
  },
];

const finite = (value: string): number | null => {
  const normalized = value.replace(/[，,\s]/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export function createInitialStandardPoints(): ElisaStandardPoint[] {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `std-${index + 1}`,
    concentration: "",
    od1: "",
    od2: "",
    od3: "",
  }));
}

export function createBlankSample(index: number, dilution = "1"): ElisaSampleRow {
  return {
    id: `sample-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
    group: "",
    od: "",
    dilution,
  };
}

export function createInitialSamples(count = 80, dilution = "1"): ElisaSampleRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `sample-${index + 1}`,
    group: "",
    od: "",
    dilution,
  }));
}

export function standardPointMean(point: ElisaStandardPoint): number | null {
  const values = [point.od1, point.od2, point.od3]
    .map(finite)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function observedStandardPoints(
  points: readonly ElisaStandardPoint[]
): ElisaObservedPoint[] {
  return points.flatMap((point) => {
    const concentration = finite(point.concentration);
    const ods = [point.od1, point.od2, point.od3]
      .map(finite)
      .filter((value): value is number => value !== null);
    if (concentration === null || concentration < 0 || ods.length === 0) return [];
    return [
      {
        concentration,
        meanOd: ods.reduce((sum, value) => sum + value, 0) / ods.length,
        ods,
      },
    ];
  });
}

function invalidFit(method: ElisaFitMethod): ElisaFit {
  return {
    method,
    valid: false,
    r2: NaN,
    n: 0,
    minConcentration: NaN,
    maxConcentration: NaN,
    minOd: NaN,
    maxOd: NaN,
    parameters: [],
    equation: "数据不足",
    predictOd: () => NaN,
    concentrationFromOd: () => null,
  };
}

function rSquared(points: ElisaObservedPoint[], predict: (x: number) => number): number {
  const mean = points.reduce((sum, point) => sum + point.meanOd, 0) / points.length;
  const ssTotal = points.reduce((sum, point) => sum + (point.meanOd - mean) ** 2, 0);
  const ssResidual = points.reduce(
    (sum, point) => sum + (point.meanOd - predict(point.concentration)) ** 2,
    0
  );
  return ssTotal === 0 ? NaN : 1 - ssResidual / ssTotal;
}

function decorateFit(
  method: ElisaFitMethod,
  points: ElisaObservedPoint[],
  parameters: number[],
  equation: string,
  predictOd: (concentration: number) => number,
  concentrationFromOd: (od: number) => number | null
): ElisaFit {
  const ods = points.map((point) => point.meanOd);
  const concentrations = points.map((point) => point.concentration);
  const r2 = rSquared(points, predictOd);
  return {
    method,
    valid: parameters.every(Number.isFinite) && Number.isFinite(r2),
    r2,
    n: points.length,
    minConcentration: Math.min(...concentrations),
    maxConcentration: Math.max(...concentrations),
    minOd: Math.min(...ods),
    maxOd: Math.max(...ods),
    parameters,
    equation,
    predictOd,
    concentrationFromOd,
  };
}

function linearRegression(xs: number[], ys: number[]): [number, number] | null {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const denominator = xs.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  if (denominator === 0) return null;
  const slope =
    xs.reduce((sum, value, index) => sum + (value - meanX) * (ys[index] - meanY), 0) /
    denominator;
  return [slope, meanY - slope * meanX];
}

function fitLinear(points: ElisaObservedPoint[]): ElisaFit {
  const regression = linearRegression(
    points.map((point) => point.concentration),
    points.map((point) => point.meanOd)
  );
  if (!regression) return invalidFit("linear");
  const [slope, intercept] = regression;
  const predictOd = (concentration: number) => slope * concentration + intercept;
  return decorateFit(
    "linear",
    points,
    [slope, intercept],
    `OD = ${formatNumber(slope)} × C ${formatSigned(intercept)}`,
    predictOd,
    (od) => {
      if (slope === 0) return null;
      const value = (od - intercept) / slope;
      return Number.isFinite(value) ? value : null;
    }
  );
}

function fitLogLinear(points: ElisaObservedPoint[]): ElisaFit {
  const usable = points.filter((point) => point.concentration > 0);
  const regression = linearRegression(
    usable.map((point) => Math.log10(point.concentration)),
    usable.map((point) => point.meanOd)
  );
  if (!regression) return invalidFit("log-linear");
  const [slope, intercept] = regression;
  const predictOd = (concentration: number) =>
    concentration > 0 ? slope * Math.log10(concentration) + intercept : NaN;
  return decorateFit(
    "log-linear",
    usable,
    [slope, intercept],
    `OD = ${formatNumber(slope)} × log₁₀(C) ${formatSigned(intercept)}`,
    predictOd,
    (od) => {
      if (slope === 0) return null;
      const value = 10 ** ((od - intercept) / slope);
      return Number.isFinite(value) ? value : null;
    }
  );
}

type Vertex = { p: number[]; score: number };

function nelderMead(
  initial: number[],
  steps: number[],
  objective: (parameters: number[]) => number
): number[] {
  const dimension = initial.length;
  let simplex: Vertex[] = [
    { p: [...initial], score: objective(initial) },
    ...initial.map((_, index) => {
      const p = [...initial];
      p[index] += steps[index];
      return { p, score: objective(p) };
    }),
  ];

  const combine = (a: number[], b: number[], scale: number) =>
    a.map((value, index) => value + scale * (value - b[index]));

  for (let iteration = 0; iteration < 800; iteration++) {
    simplex.sort((a, b) => a.score - b.score);
    const best = simplex[0];
    const worst = simplex[dimension];
    const spread = simplex.reduce((max, vertex) => Math.max(max, Math.abs(vertex.score - best.score)), 0);
    if (spread < 1e-12) break;

    const centroid = Array.from({ length: dimension }, (_, index) =>
      simplex.slice(0, dimension).reduce((sum, vertex) => sum + vertex.p[index], 0) /
      dimension
    );
    const reflectedP = combine(centroid, worst.p, 1);
    const reflected: Vertex = { p: reflectedP, score: objective(reflectedP) };

    if (reflected.score < best.score) {
      const expandedP = combine(centroid, worst.p, 2);
      const expanded = { p: expandedP, score: objective(expandedP) };
      simplex[dimension] = expanded.score < reflected.score ? expanded : reflected;
      continue;
    }

    if (reflected.score < simplex[dimension - 1].score) {
      simplex[dimension] = reflected;
      continue;
    }

    const contractedP = worst.p.map(
      (value, index) => centroid[index] + 0.5 * (value - centroid[index])
    );
    const contracted = { p: contractedP, score: objective(contractedP) };
    if (contracted.score < worst.score) {
      simplex[dimension] = contracted;
      continue;
    }

    simplex = [
      best,
      ...simplex.slice(1).map((vertex) => {
        const p = vertex.p.map((value, index) => best.p[index] + 0.5 * (value - best.p[index]));
        return { p, score: objective(p) };
      }),
    ];
  }

  simplex.sort((a, b) => a.score - b.score);
  return simplex[0].p;
}

function fitFourPl(points: ElisaObservedPoint[]): ElisaFit {
  if (points.length < 4 || points.filter((point) => point.concentration > 0).length < 3) {
    return invalidFit("four-pl");
  }

  const ods = points.map((point) => point.meanOd);
  const positives = points
    .map((point) => point.concentration)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const bottom = Math.min(...ods);
  const top = Math.max(...ods);
  const span = Math.max(top - bottom, 1e-6);
  const ec50 = positives[Math.floor(positives.length / 2)];

  // Transformed parameters guarantee top > bottom, EC50 > 0, and Hill > 0.
  const decode = (p: number[]) => ({
    bottom: p[0],
    top: p[0] + Math.exp(Math.min(30, Math.max(-30, p[1]))),
    ec50: Math.exp(Math.min(50, Math.max(-50, p[2]))),
    hill: Math.exp(Math.min(8, Math.max(-8, p[3]))),
  });
  const predict = (x: number, p: number[]) => {
    const decoded = decode(p);
    if (x <= 0) return decoded.bottom;
    const ratio = (decoded.ec50 / x) ** decoded.hill;
    return decoded.bottom + (decoded.top - decoded.bottom) / (1 + ratio);
  };
  const objective = (p: number[]) => {
    const decoded = decode(p);
    if (![decoded.bottom, decoded.top, decoded.ec50, decoded.hill].every(Number.isFinite)) {
      return Number.MAX_VALUE;
    }
    return points.reduce((sum, point) => {
      const residual = point.meanOd - predict(point.concentration, p);
      return sum + residual * residual;
    }, 0);
  };

  const optimized = nelderMead(
    [bottom, Math.log(span), Math.log(ec50), 0],
    [Math.max(span * 0.1, 0.05), 0.35, 0.45, 0.3],
    objective
  );
  const decoded = decode(optimized);
  const predictOd = (concentration: number) => predict(concentration, optimized);
  return decorateFit(
    "four-pl",
    points,
    [decoded.bottom, decoded.top, decoded.ec50, decoded.hill],
    `OD = Bottom + (Top − Bottom) / [1 + (EC₅₀ / C)^Hill]`,
    predictOd,
    (od) => {
      const fraction = (od - decoded.bottom) / (decoded.top - decoded.bottom);
      if (!(fraction > 0 && fraction < 1)) return null;
      const value = decoded.ec50 * (fraction / (1 - fraction)) ** (1 / decoded.hill);
      return Number.isFinite(value) ? value : null;
    }
  );
}

export function fitElisaCurve(
  points: readonly ElisaStandardPoint[],
  method: ElisaFitMethod
): ElisaFit {
  const observed = observedStandardPoints(points);
  if (method === "linear") return fitLinear(observed);
  if (method === "log-linear") return fitLogLinear(observed);
  return fitFourPl(observed);
}

export function calculateElisaSample(row: ElisaSampleRow, fit: ElisaFit): ElisaSampleResult {
  const od = finite(row.od);
  const dilution = finite(row.dilution);
  if (!fit.valid || od === null || dilution === null || dilution <= 0) {
    return { measuredConcentration: null, finalConcentration: null, range: "invalid" };
  }
  const measured = fit.concentrationFromOd(od);
  if (measured === null || measured < 0) {
    return { measuredConcentration: null, finalConcentration: null, range: "invalid" };
  }
  const range: ElisaRangeFlag = od < fit.minOd ? "below" : od > fit.maxOd ? "above" : "within";
  return {
    measuredConcentration: measured,
    finalConcentration: measured * dilution,
    range,
  };
}

function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

/** Build an Excel-ready result table containing only rows with an OD450 value. */
export function elisaResultsToTsv(
  rows: readonly ElisaSampleRow[],
  fit: ElisaFit,
  concentrationUnit: string
): string {
  const header = [
    "序号",
    "分组",
    "原始 OD450",
    "稀释倍数",
    `标曲反算浓度 (${tsvCell(concentrationUnit)})`,
    `终浓度 (${tsvCell(concentrationUnit)})`,
    "范围状态",
  ];
  const body = rows.flatMap((row, index) => {
    if (row.od.trim() === "") return [];
    const result = calculateElisaSample(row, fit);
    const range =
      result.range === "within"
        ? "标曲范围内"
        : result.range === "below"
          ? "低于标准 OD 范围"
          : result.range === "above"
            ? "高于标准 OD 范围"
            : "无法计算";
    return [
      [
        String(index + 1),
        tsvCell(row.group),
        tsvCell(row.od),
        tsvCell(row.dilution),
        result.measuredConcentration === null ? "" : result.measuredConcentration.toFixed(2),
        result.finalConcentration === null ? "" : result.finalConcentration.toFixed(2),
        range,
      ],
    ];
  });
  return [header, ...body].map((row) => row.join("\t")).join("\n");
}

/** Parse Excel/plate-reader clipboard text and flatten by plate columns. */
export function parsePlateClipboard(text: string): string[] {
  const rows = parseClipboardMatrix(text);
  if (rows.length === 0 || (rows.length === 1 && rows[0][0] === "")) return [];
  const width = Math.max(...rows.map((row) => row.length));
  const values: string[] = [];
  for (let column = 0; column < width; column++) {
    for (let row = 0; row < rows.length; row++) {
      const value = rows[row][column] ?? "";
      if (value !== "") values.push(value);
    }
  }
  return values;
}

/** Preserve Excel's row/column shape so a paste can start at any input cell. */
export function parseClipboardMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0) return [];
  return lines.map((line) => line.split("\t").map((cell) => cell.trim()));
}

export const ELISA_DILUTION_LADDER = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000] as const;

export function stepElisaDilution(current: string, direction: 1 | -1): string {
  const value = finite(current);
  if (value === null) {
    return String(direction === 1 ? ELISA_DILUTION_LADDER[0] : ELISA_DILUTION_LADDER.at(-1));
  }
  if (direction === 1) {
    return String(ELISA_DILUTION_LADDER.find((candidate) => candidate > value) ?? ELISA_DILUTION_LADDER.at(-1));
  }
  return String(
    [...ELISA_DILUTION_LADDER].reverse().find((candidate) => candidate < value) ??
      ELISA_DILUTION_LADDER[0]
  );
}

export function formatNumber(value: number | null, digits = 4): string {
  if (value === null || !Number.isFinite(value)) return "--";
  if (value === 0) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 10000 || absolute < 0.001) return value.toExponential(3);
  return Number(value.toPrecision(digits)).toString();
}

function formatSigned(value: number): string {
  return value < 0 ? `− ${formatNumber(Math.abs(value))}` : `+ ${formatNumber(value)}`;
}

export function fitParameterRows(fit: ElisaFit): Array<[string, string]> {
  if (!fit.valid) return [];
  if (fit.method === "four-pl") {
    return [
      ["Bottom", formatNumber(fit.parameters[0], 6)],
      ["Top", formatNumber(fit.parameters[1], 6)],
      ["EC₅₀", formatNumber(fit.parameters[2], 6)],
      ["Hill slope", formatNumber(fit.parameters[3], 6)],
    ];
  }
  return [
    ["Slope", formatNumber(fit.parameters[0], 6)],
    ["Intercept", formatNumber(fit.parameters[1], 6)],
  ];
}
