import { describe, expect, it } from "vitest";
import {
  parseChromatogramTable,
  parseFractionMarkTable,
  setChromatogramXAxis,
  createChromatogram,
} from "./chromatogram";
import { emptyTlnpExperiment, parseTlnpExperiment } from "./tlnp-experiment";

const AKTA = `UV1-280280(mAu),,,,UV2-260260(mAu),,,,FracMark(mAu),,,
min,mL,CV,,min,mL,CV,,min,mL,CV,
0.01,0.02,0.001,-0.06,0.01,0.02,0.001,0.13,1.00,2.00,0.10,1A01
0.02,0.04,0.002,0.50,0.02,0.04,0.002,0.40,,,,`;

describe("chromatogram import", () => {
  it("parses the 12-column ÄKTA export and preserves all x axes", () => {
    const parsed = parseChromatogramTable(AKTA);
    expect(parsed.channels.map((channel) => channel.label)).toEqual(["A280", "A260"]);
    expect(parsed.availableXAxes).toEqual(["min", "mL", "CV"]);
    expect(parsed.xAxis).toBe("mL");
    expect(parsed.points[1]).toMatchObject({
      x: 0.04,
      xValues: { min: 0.02, mL: 0.04, CV: 0.002 },
      y: [0.5, 0.4],
    });
    expect(parsed.fractionMarks[0]).toMatchObject({
      label: "1A01",
      positions: { min: 1, mL: 2, CV: 0.1 },
    });
  });

  it("parses a separate two-column fraction mark table", () => {
    const parsed = parseChromatogramTable(AKTA);
    const result = parseFractionMarkTable("mL\tmark\n0.04\tF2", parsed.points);
    expect(result.marks[0]).toMatchObject({
      label: "F2",
      positions: { min: 0.02, mL: 0.04, CV: 0.002 },
    });
  });

  it("extracts real marks when a complete SEC file is selected in the mark importer", () => {
    const parsed = parseChromatogramTable(AKTA);
    const result = parseFractionMarkTable(AKTA, parsed.points);
    expect(result.marks).toHaveLength(1);
    expect(result.marks[0].label).toBe("1A01");
  });

  it("switches the active axis without dropping the other coordinates", () => {
    const parsed = parseChromatogramTable(AKTA);
    const chromatogram = createChromatogram(parsed, "SEC", AKTA);
    const switched = setChromatogramXAxis(chromatogram, "CV");
    expect(switched.xAxis).toBe("CV");
    expect(switched.xLabel).toContain("CV");
    expect(switched.points.map((point) => point.x)).toEqual([0.001, 0.002]);
    expect(switched.points[0].xValues.mL).toBe(0.02);
  });

  it("keeps the compact three-column paste compatible", () => {
    const parsed = parseChromatogramTable("体积 (mL)\tA280\tA260\n0\t1\t2");
    expect(parsed.availableXAxes).toEqual(["mL"]);
    expect(parsed.points[0]).toMatchObject({ x: 0, y: [1, 2] });
    expect(parsed.xLabel).toBe("Volume (mL)");
  });

  it("repairs the historical pattern where every UV row became a numeric mark", () => {
    const data = emptyTlnpExperiment();
    const parsed = parseChromatogramTable(AKTA);
    const chromatogram = createChromatogram(parsed, "SEC", AKTA);
    chromatogram.fractionMarks = Array.from({ length: 101 }, (_, index) => ({
      id: `bad-${index}`,
      label: String(index / 10),
      positions: { mL: index / 10 },
    }));
    data.purification.chromatograms = [chromatogram];
    const repaired = parseTlnpExperiment(data as unknown as Record<string, unknown>)
      .purification.chromatograms[0].fractionMarks;
    expect(repaired).toHaveLength(1);
    expect(repaired[0].label).toBe("1A01");
  });

  it("preserves an intentionally emptied fraction mark list", () => {
    const data = emptyTlnpExperiment();
    const chromatogram = createChromatogram(parseChromatogramTable(AKTA), "SEC", AKTA);
    chromatogram.fractionMarks = [];
    data.purification.chromatograms = [chromatogram];
    const reparsed = parseTlnpExperiment(data as unknown as Record<string, unknown>)
      .purification.chromatograms[0];
    expect(reparsed.fractionMarks).toEqual([]);
  });
});
