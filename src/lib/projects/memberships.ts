import type { ProjectMembership } from "./types";

/**
 * A project member may read the other membership rows in the same project.
 * My-project pickers must therefore keep only the signed-in user's row and
 * defensively collapse repeated project ids before rendering options.
 */
export function normalizeMyProjectMemberships(
  rows: ProjectMembership[],
  userId: string
): ProjectMembership[] {
  const byProject = new Map<string, ProjectMembership>();
  for (const row of rows) {
    if (row.user_id !== userId || !row.project || byProject.has(row.project_id)) continue;
    byProject.set(row.project_id, row);
  }
  return [...byProject.values()];
}
