import { describe, expect, it } from "vitest";
import { decideCloudLoad } from "./sync-policy";

describe("workbench cloud-first policy", () => {
  it("uses cloud when there is no local cache", () => {
    expect(decideCloudLoad(null, 4)).toBe("use-cloud");
  });

  it("uses cloud instead of a clean stale cache", () => {
    expect(decideCloudLoad({ dirty: false, baseRevision: 1 }, 8)).toBe("use-cloud");
  });

  it("resumes an unsynced draft only while its cloud baseline is unchanged", () => {
    expect(decideCloudLoad({ dirty: true, baseRevision: 8 }, 8)).toBe("resume-draft");
  });

  it("preserves both copies when cloud advanced after the local draft began", () => {
    expect(decideCloudLoad({ dirty: true, baseRevision: 7 }, 8)).toBe("preserve-conflict");
  });
});
