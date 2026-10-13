import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/tools/tlnp?batch=1")).toBe("/tools/tlnp?batch=1");
  });

  it("rejects anything that could leave the origin", () => {
    for (const bad of [null, undefined, "", "@evil.com", "//evil.com", "/\\evil.com", "https://evil.com", "evil.com"]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
