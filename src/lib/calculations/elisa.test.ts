import { describe, expect, it } from "vitest";
import {
  calculateElisaSample,
  elisaResultsToTsv,
  fitElisaCurve,
  parseClipboardMatrix,
  parsePlateClipboard,
  stepElisaDilution,
  type ElisaStandardPoint,
} from "./elisa";

function points(values: Array<[number, number]>): ElisaStandardPoint[] {
  return values.map(([concentration, od], index) => ({
    id: String(index),
    concentration: String(concentration),
    od1: String(od),
    od2: "",
    od3: "",
  }));
}

describe("ELISA calculation", () => {
  it("fits and inverts a linear standard curve", () => {
    const fit = fitElisaCurve(points([[0, 0.1], [1, 0.3], [2, 0.5], [3, 0.7]]), "linear");
    expect(fit.valid).toBe(true);
    expect(fit.r2).toBeCloseTo(1, 8);
    expect(fit.concentrationFromOd(0.4)).toBeCloseTo(1.5, 8);
    const result = calculateElisaSample(
      { id: "s1", group: "", od: "0.4", dilution: "10" },
      fit
    );
    expect(result.finalConcentration).toBeCloseTo(15, 8);
  });

  it("recovers concentrations from a four-parameter curve", () => {
    const bottom = 0.08;
    const top = 2.4;
    const ec50 = 25;
    const hill = 1.35;
    const curve = (x: number) =>
      x <= 0
        ? bottom
        : bottom + (top - bottom) / (1 + (ec50 / x) ** hill);
    const fit = fitElisaCurve(
      points([0, 1, 3, 10, 30, 100, 300, 1000].map((x) => [x, curve(x)])),
      "four-pl"
    );
    expect(fit.valid).toBe(true);
    expect(fit.r2).toBeGreaterThan(0.9999);
    expect(fit.concentrationFromOd(curve(50))).toBeCloseTo(50, 1);
  });

  it("flattens a plate matrix by columns", () => {
    expect(parsePlateClipboard("A1\tA2\tA3\nB1\tB2\tB3")).toEqual([
      "A1",
      "B1",
      "A2",
      "B2",
      "A3",
      "B3",
    ]);
  });

  it("preserves Excel rows and columns for direct table paste", () => {
    expect(parseClipboardMatrix("A\t0.2\t10\nB\t0.4\t20\n")).toEqual([
      ["A", "0.2", "10"],
      ["B", "0.4", "20"],
    ]);
  });

  it("steps through common ELISA dilution factors", () => {
    expect(stepElisaDilution("10", 1)).toBe("20");
    expect(stepElisaDilution("10", -1)).toBe("5");
    expect(stepElisaDilution("17", 1)).toBe("20");
  });

  it("copies completed sample results as an Excel-ready TSV", () => {
    const fit = fitElisaCurve(points([[0, 0.1], [1, 0.3], [2, 0.5], [3, 0.7]]), "linear");
    const tsv = elisaResultsToTsv(
      [
        { id: "s1", group: "Control", od: "0.4", dilution: "10" },
        { id: "s2", group: "Blank", od: "", dilution: "1" },
      ],
      fit,
      "mIU/mL"
    );
    expect(tsv).toBe(
      "序号\t分组\t原始 OD450\t稀释倍数\t标曲反算浓度 (mIU/mL)\t终浓度 (mIU/mL)\t范围状态\n" +
        "1\tControl\t0.4\t10\t1.50\t15.00\t标曲范围内"
    );
  });
});
