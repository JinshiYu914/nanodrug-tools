import { describe, expect, it } from "vitest";
import { decideCachedSelection } from "./sync-policy";

describe("decideCachedSelection", () => {
  it("fetches the cloud body when no local cache exists", () => {
    expect(decideCachedSelection(null, 3)).toBe("fetch-cloud");
  });

  it("uses a clean cache when its revision matches the sidebar", () => {
    expect(decideCachedSelection({ dirty: false, baseRevision: 3 }, 3)).toBe(
      "use-clean-cache"
    );
  });

  it("trusts a newer clean cache produced by a save in the current session", () => {
    expect(decideCachedSelection({ dirty: false, baseRevision: 4 }, 3)).toBe(
      "use-clean-cache"
    );
  });

  it("fetches the cloud body when a clean cache is stale", () => {
    expect(decideCachedSelection({ dirty: false, baseRevision: 2 }, 3)).toBe(
      "fetch-cloud"
    );
  });

  it("resumes a matching local draft without reading the cloud body", () => {
    expect(decideCachedSelection({ dirty: true, baseRevision: 3 }, 3)).toBe(
      "resume-draft"
    );
  });

  it("resumes a draft newer than a stale in-memory sidebar summary", () => {
    expect(decideCachedSelection({ dirty: true, baseRevision: 4 }, 3)).toBe(
      "resume-draft"
    );
  });

  it("preserves a stale draft for CAS conflict handling", () => {
    expect(decideCachedSelection({ dirty: true, baseRevision: 2 }, 3)).toBe(
      "preserve-conflict"
    );
  });
});
