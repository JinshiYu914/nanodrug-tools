export type ProjectRole = "owner" | "admin" | "member";
export type ProjectStatus = "active" | "archived";

export interface ResearchProject {
  id: string;
  code: string;
  name: string;
  description: string;
  owner_id: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectMembership {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
  project: ResearchProject;
}

export type DataScope =
  | { kind: "personal" }
  | {
      kind: "project";
      projectId: string;
      role: ProjectRole;
      status: ProjectStatus;
      name?: string;
    };

export const PERSONAL_SCOPE: DataScope = { kind: "personal" };

export function scopeKey(scope: DataScope): string {
  return scope.kind === "personal" ? "personal" : `project:${scope.projectId}`;
}

export function canEditScope(scope: DataScope): boolean {
  return (
    scope.kind === "personal" ||
    (scope.status === "active" && (scope.role === "owner" || scope.role === "admin"))
  );
}
