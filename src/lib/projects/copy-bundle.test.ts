import { describe, expect, it } from "vitest";
import { buildCopyBundle, previewCopyBundle } from "./copy-bundle";
import type { LnpSavedItem } from "@/lib/supabase/lnp-service";

const item = (id: string, type: LnpSavedItem["type"], data: Record<string, unknown>): LnpSavedItem => ({
  id, user_id: "u1", project_id: null, last_modified_by: "u1", type,
  is_folder: false, parent_id: null, name: id, data, sort_order: 0,
  created_at: "2026-01-01", updated_at: "2026-01-01", data_revision: 1,
});

describe("research project copy bundle", () => {
  it("copies linked RiboGreen rows and rewrites both directions", () => {
    const root = item("batch", "tlnp_experiment", {
      prep: { samples: [{ ee: { link: { itemId: "rg", snapshot: { ee: 91 } } } }] },
    });
    const rg = item("rg", "ribogreen_result", {
      rows: [{ sourceSessionId: "batch", sourceKind: "tlnp_experiment" }],
    });
    const preview = previewCopyBundle(root, [rg]);
    const ids = ["new-batch", "new-rg"];
    const bundle = buildCopyBundle(preview, () => ids.shift()!);
    expect(bundle).toHaveLength(2);
    expect(JSON.stringify(bundle[0].data)).toContain("new-rg");
    expect(JSON.stringify(bundle[1].data)).toContain("new-batch");
  });

  it("keeps snapshots and marks inaccessible sources", () => {
    const root = item("batch", "tlnp_experiment", {
      ee: { link: { itemId: "missing", snapshot: { ee: 88 } } },
    });
    const bundle = buildCopyBundle(previewCopyBundle(root, []), () => "new-batch");
    expect(bundle[0].data).toMatchObject({
      ee: { link: { itemId: "missing", snapshot: { ee: 88 }, sourceUnavailable: true } },
    });
  });

  it("finds RiboGreen rows that point back to a screening session", () => {
    const session = item("screen", "screening_session", { formulations: [{ id: "f1" }] });
    const rg = item("rg", "ribogreen_result", {
      rows: [{ sourceSessionId: "screen", sourceFormulationId: "f1" }],
    });
    const preview = previewCopyBundle(session, [rg]);
    expect(preview.linkedRibogreen.map((row) => row.id)).toEqual(["rg"]);
    const ids = ["new-screen", "new-rg"];
    const bundle = buildCopyBundle(preview, () => ids.shift()!);
    expect(JSON.stringify(bundle[1].data)).toContain("new-screen");
  });
});
