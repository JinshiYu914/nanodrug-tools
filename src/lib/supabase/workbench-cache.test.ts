import { describe, expect, it } from "vitest";
import type { LnpSavedItem, LnpSavedItemSummary } from "./lnp-service";
import { mergeWorkbenchSummaries, type WorkbenchCacheEntry } from "./workbench-cache";

function summary(id: string): LnpSavedItemSummary {
  return {
    id,
    user_id: "user-1",
    project_id: null,
    last_modified_by: "user-1",
    type: "tlnp_experiment",
    is_folder: false,
    parent_id: null,
    name: id,
    sort_order: 0,
    created_at: "2026-08-19T00:00:00.000Z",
    updated_at: "2026-08-19T00:00:00.000Z",
    data_revision: 2,
  };
}

function cached(id: string, dirty: boolean): WorkbenchCacheEntry {
  const item: LnpSavedItem = { ...summary(id), data: { source: "cached" } };
  return {
    key: `user-1:personal:tlnp_experiment:${id}`,
    userId: "user-1",
    type: "tlnp_experiment",
    itemId: id,
    scopeKey: "personal",
    item,
    data: { source: "cached" },
    baseRevision: 2,
    dirty,
    localUpdatedAt: "2026-08-19T01:00:00.000Z",
  };
}

describe("workbench summary merge", () => {
  it("does not attach clean cached payloads to cloud list rows", () => {
    const rows = mergeWorkbenchSummaries([summary("cloud")], [cached("cloud", false)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toBeNull();
  });

  it("keeps an unsaved local draft attached to its cloud locator", () => {
    const rows = mergeWorkbenchSummaries([summary("draft")], [cached("draft", true)]);
    expect(rows[0].data).toEqual({ source: "cached" });
  });

  it("keeps a dirty draft whose cloud row was deleted, but drops clean stale cache", () => {
    const rows = mergeWorkbenchSummaries(
      [summary("cloud")],
      [cached("deleted-draft", true), cached("deleted-clean", false)]
    );
    expect(rows.map((row) => row.id)).toEqual(["cloud", "deleted-draft"]);
  });
});
