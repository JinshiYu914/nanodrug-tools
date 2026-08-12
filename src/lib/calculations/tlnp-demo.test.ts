import { describe, expect, it } from "vitest";
import {
  createProteinEntry,
  parseTlnpExperiment,
  serializeTlnpExperiment,
  TLNP_SCHEMA_VERSION,
} from "./tlnp-experiment";
import { createTlnpDemoExperiment } from "./tlnp-demo";

describe("tLNP antibody provenance", () => {
  it("keeps legacy antibodies readable with blank provenance", () => {
    const parsed = parseTlnpExperiment({
      schemaVersion: 3,
      kind: "tlnp_experiment",
      conjugation: {
        proteins: [{ id: "p1", name: "legacy", mw: "50000", conc: "1", concUnit: "mg_per_mL", note: "old" }],
        systems: [],
      },
    });
    expect(parsed.conjugation.proteins[0]).toMatchObject({
      name: "legacy",
      source: "",
      expressionSystem: "",
      expressionDate: "",
      note: "old",
    });
  });

  it("round-trips new source and expression fields", () => {
    const data = createTlnpDemoExperiment();
    const reparsed = parseTlnpExperiment(serializeTlnpExperiment(data));
    expect(reparsed.schemaVersion).toBe(TLNP_SCHEMA_VERSION);
    expect(reparsed.conjugation.proteins[0]).toMatchObject({
      source: "自表达",
      expressionSystem: "293F",
      expressionDate: "2026-07-29",
    });
  });

  it("gives new antibodies explicit empty provenance fields", () => {
    expect(createProteinEntry()).toMatchObject({
      source: "",
      expressionSystem: "",
      expressionDate: "",
      note: "",
    });
  });
});

describe("guest tLNP demo", () => {
  it("contains editable content in all four modules", () => {
    const demo = createTlnpDemoExperiment();
    expect(demo.prep.samples.length).toBeGreaterThan(0);
    expect(demo.conjugation.systems.length).toBeGreaterThan(0);
    expect(demo.purification.chromatograms.length).toBeGreaterThan(0);
    expect(demo.assay.invitro.results.replicates.length).toBeGreaterThan(0);
    expect(demo.assay.invivo.results.runs.length).toBeGreaterThan(0);
  });
});
