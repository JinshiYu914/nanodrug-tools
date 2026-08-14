import { createClient } from "./client";
import { listAllItems, type LnpSavedItem } from "./lnp-service";
import { buildCopyBundle, previewCopyBundle } from "@/lib/projects/copy-bundle";
import { normalizeMyProjectMemberships } from "@/lib/projects/memberships";
import type {
  ProjectMembership,
  ProjectRole,
  ResearchProject,
} from "@/lib/projects/types";

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
  email: string;
  display_name: string;
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  invitee_email: string;
  inviter_id: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  created_at: string;
  responded_at: string | null;
  project?: ResearchProject;
}

export interface ProjectJoinRequest {
  id: string;
  project_id: string;
  requester_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_at: string;
  email?: string;
  display_name?: string;
}

export interface ProjectActivity {
  id: number;
  project_id: string;
  category: "data" | "member";
  action: string;
  actor_email: string;
  actor_display_name: string;
  entity_name: string;
  summary: string;
  occurrence_count: number;
  revision_from: number | null;
  revision_to: number | null;
  first_at: string;
  last_at: string;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) throw error;
  return data as T;
}

export async function listProjectMemberships(): Promise<ProjectMembership[]> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return [];
  const { data, error } = await supabase
    .from("research_project_members")
    .select("project_id,user_id,role,joined_at,project:research_projects(*)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    ...row,
    project: Array.isArray(row.project) ? row.project[0] : row.project,
  })) as ProjectMembership[];
  return normalizeMyProjectMemberships(rows, user.id);
}

export async function createProject(name: string, description: string) {
  return rpc<ResearchProject>("create_research_project", {
    p_name: name,
    p_description: description,
  });
}

export async function lookupProject(code: string) {
  const rows = await rpc<Array<{ project_id: string; code: string; name: string; owner_name: string }>>(
    "lookup_research_project",
    { p_code: code }
  );
  return rows[0] ?? null;
}

export const requestJoin = (code: string) =>
  rpc<ProjectJoinRequest>("request_research_project_join", { p_code: code });
export const inviteMember = (projectId: string, email: string) =>
  rpc<ProjectInvitation>("invite_research_project_member", { p_project_id: projectId, p_email: email });
export const respondInvitation = (id: string, accept: boolean) =>
  rpc<void>("respond_research_project_invitation", { p_invitation_id: id, p_accept: accept });
export const reviewJoinRequest = (id: string, approve: boolean) =>
  rpc<void>("review_research_project_join_request", { p_request_id: id, p_approve: approve });
export const setMemberRole = (projectId: string, userId: string, role: "admin" | "member") =>
  rpc<void>("set_research_project_member_role", { p_project_id: projectId, p_user_id: userId, p_role: role });
export const removeMember = (projectId: string, userId: string) =>
  rpc<void>("remove_research_project_member", { p_project_id: projectId, p_user_id: userId });
export const leaveProject = (projectId: string) =>
  rpc<void>("leave_research_project", { p_project_id: projectId });
export const setProjectArchived = (projectId: string, archived: boolean) =>
  rpc<void>("set_research_project_archived", { p_project_id: projectId, p_archived: archived });

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = createClient();
  const { data: members, error } = await supabase
    .from("research_project_members")
    .select("project_id,user_id,role,joined_at")
    .eq("project_id", projectId)
    .order("joined_at");
  if (error) throw error;
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles, error: profileError } = ids.length
    ? await supabase.from("user_profiles").select("id,email,display_name").in("id", ids)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (members ?? []).map((m) => ({
    ...m,
    email: byId.get(m.user_id)?.email ?? "",
    display_name: byId.get(m.user_id)?.display_name ?? "",
  })) as ProjectMember[];
}

export async function listPendingInvitations(projectId?: string): Promise<ProjectInvitation[]> {
  const supabase = createClient();
  let query = supabase.from("research_project_invitations").select("*").eq("status", "pending");
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  const projectIds = [...new Set((data ?? []).map((row) => row.project_id))];
  const { data: projects } = projectIds.length
    ? await supabase.from("research_projects").select("*").in("id", projectIds)
    : { data: [] };
  const byId = new Map((projects ?? []).map((project) => [project.id, project]));
  return (data ?? []).map((row) => ({ ...row, project: byId.get(row.project_id) })) as ProjectInvitation[];
}

export async function listPendingJoinRequests(projectId: string): Promise<ProjectJoinRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("research_project_join_requests")
    .select("*").eq("project_id", projectId).eq("status", "pending")
    .order("requested_at");
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.requester_id);
  const { data: profiles } = ids.length
    ? await supabase.from("user_profiles").select("id,email,display_name").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (data ?? []).map((r) => ({
    ...r,
    email: byId.get(r.requester_id)?.email ?? "",
    display_name: byId.get(r.requester_id)?.display_name ?? "",
  })) as ProjectJoinRequest[];
}

export async function listProjectActivity(
  projectId: string,
  category?: "data" | "member",
  offset = 0,
  limit = 30
): Promise<ProjectActivity[]> {
  let query = createClient().from("project_activity").select("*")
    .eq("project_id", projectId).order("last_at", { ascending: false }).range(offset, offset + limit - 1);
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjectActivity[];
}

export async function copyItemToProject(item: LnpSavedItem, projectId: string) {
  const linked = item.type === "tlnp_experiment" || item.type === "screening_session"
    ? await listAllItems("ribogreen_result")
    : [];
  const preview = previewCopyBundle(item, linked);
  const bundle = buildCopyBundle(preview);
  const rows = await rpc<LnpSavedItem[]>("copy_saved_item_bundle_to_project", {
    p_project_id: projectId,
    p_items: bundle,
  });
  return { rows, preview };
}

export async function copyItemToPersonal(item: LnpSavedItem) {
  if (!item.project_id) throw new Error("该记录已经在个人空间");
  const sourceScope = {
    kind: "project" as const,
    projectId: item.project_id,
    role: "member" as const,
    status: "active" as const,
  };
  const linked = item.type === "tlnp_experiment" || item.type === "screening_session"
    ? await listAllItems("ribogreen_result", sourceScope)
    : [];
  const preview = previewCopyBundle(item, linked);
  const bundle = buildCopyBundle(preview).map((entry, index) => ({
    ...entry,
    name: index === 0 ? `${item.name}（个人副本）` : entry.name,
  }));
  const rows = await rpc<LnpSavedItem[]>("copy_saved_item_bundle_to_personal", { p_items: bundle });
  return { rows, preview };
}
