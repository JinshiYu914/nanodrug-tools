import { describe, expect, it } from "vitest";
import { normalizeMyProjectMemberships } from "./memberships";
import type { ProjectMembership, ResearchProject } from "./types";

const project: ResearchProject = {
  id: "project-1",
  code: "2718",
  name: "LNP delivery",
  description: "",
  owner_id: "owner",
  status: "active",
  created_at: "2026-08-14T00:00:00Z",
  updated_at: "2026-08-14T00:00:00Z",
};

const membership = (
  userId: string,
  role: ProjectMembership["role"]
): ProjectMembership => ({
  project_id: project.id,
  user_id: userId,
  role,
  joined_at: "2026-08-14T00:00:00Z",
  project,
});

describe("normalizeMyProjectMemberships", () => {
  it("does not turn other team members into duplicate project entries", () => {
    const rows = [
      membership("owner", "owner"),
      membership("member-a", "member"),
      membership("member-b", "admin"),
    ];
    expect(normalizeMyProjectMemberships(rows, "member-a")).toEqual([rows[1]]);
  });

  it("defensively collapses repeated rows for the same project", () => {
    const own = membership("member-a", "member");
    expect(normalizeMyProjectMemberships([own, { ...own }], "member-a")).toEqual([own]);
  });
});
