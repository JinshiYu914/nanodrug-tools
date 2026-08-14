"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, ArchiveRestore, Check, FolderKanban, MailPlus,
  Plus, Search, UserMinus, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/lib/supabase/use-user";
import {
  createProject, inviteMember, leaveProject, listPendingInvitations,
  listPendingJoinRequests, listProjectActivity, listProjectMembers,
  listProjectMemberships, lookupProject, removeMember, requestJoin,
  respondInvitation, reviewJoinRequest, setMemberRole, setProjectArchived,
  type ProjectActivity, type ProjectInvitation, type ProjectJoinRequest, type ProjectMember,
} from "@/lib/supabase/project-service";
import type { ProjectMembership } from "@/lib/projects/types";

const ROLE_LABEL = { owner: "负责人", admin: "管理员", member: "成员" } as const;

export default function ProjectsPage() {
  const { user } = useUser();
  const [memberships, setMemberships] = useState<ProjectMembership[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [requests, setRequests] = useState<ProjectJoinRequest[]>([]);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "data" | "member">("all");
  const [activityOffset, setActivityOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [lookup, setLookup] = useState<Awaited<ReturnType<typeof lookupProject>> | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = memberships.find((row) => row.project_id === selectedId) ?? null;
  const canManage = selected?.role === "owner" || selected?.role === "admin";

  const refreshMemberships = useCallback(async () => {
    const rows = await listProjectMemberships();
    setMemberships(rows);
    setSelectedId((current) => current && rows.some((row) => row.project_id === current)
      ? current : rows[0]?.project_id ?? null);
  }, []);

  const refreshInvitations = useCallback(async () => {
    setInvitations(await listPendingInvitations());
  }, []);

  useEffect(() => {
    if (!user) return;
    void Promise.all([refreshMemberships(), refreshInvitations()]).catch((error) => {
      console.error(error); toast.error("课题数据加载失败，请确认已执行 009_research_projects.sql");
    });
  }, [refreshInvitations, refreshMemberships, user]);

  const refreshProject = useCallback(async () => {
    if (!selectedId) { setMembers([]); setRequests([]); setActivity([]); return; }
    const [nextMembers, nextRequests, nextActivity] = await Promise.all([
      listProjectMembers(selectedId),
      listPendingJoinRequests(selectedId).catch(() => []),
      listProjectActivity(selectedId, activityFilter === "all" ? undefined : activityFilter, 0, 30),
    ]);
    setMembers(nextMembers); setRequests(nextRequests); setActivity(nextActivity); setActivityOffset(nextActivity.length);
  }, [activityFilter, selectedId]);

  useEffect(() => { void refreshProject().catch(console.error); }, [refreshProject]);

  const incomingInvitations = useMemo(() => invitations.filter((invite) =>
    invite.invitee_email.toLowerCase() === user?.email?.toLowerCase()), [invitations, user?.email]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action(); toast.success(success);
      await Promise.all([refreshMemberships(), refreshInvitations()]);
      await refreshProject();
    } catch (error) {
      console.error(error);
      const message = (error as { message?: string })?.message ?? "操作失败";
      toast.error(message);
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2"><FolderKanban className="h-5 w-5 text-primary" /><h1 className="text-2xl font-semibold">My Projects</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">管理共享实验数据、团队权限与协作记录。</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />新建课题</Button>
          <Button variant="outline" onClick={() => setJoinOpen(true)}><Search className="h-4 w-4" />加入课题</Button>
        </div>
      </header>

      {incomingInvitations.length > 0 && (
        <section className="border-b py-5">
          <h2 className="mb-3 text-sm font-semibold">待处理邀请</h2>
          <div className="space-y-2">
            {incomingInvitations.map((invite) => <div key={invite.id} className="flex flex-wrap items-center gap-3 text-sm">
              <MailPlus className="h-4 w-4 text-primary" /><span className="font-medium">{invite.project?.name ?? "课题邀请"}</span>
              <span className="text-muted-foreground">邀请你以成员身份加入</span>
              <div className="ml-auto flex gap-2"><Button size="sm" onClick={() => run(() => respondInvitation(invite.id, true), "已加入课题")}><Check className="h-3.5 w-3.5" />接受</Button><Button size="sm" variant="outline" onClick={() => run(() => respondInvitation(invite.id, false), "已拒绝邀请")}><X className="h-3.5 w-3.5" />拒绝</Button></div>
            </div>)}
          </div>
        </section>
      )}

      <div className="grid gap-8 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside>
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">课题列表</h2>
            <div className="divide-y border-y">
              {memberships.length === 0 ? <p className="py-5 text-sm text-muted-foreground">还没有加入课题</p> : memberships.map((row) => (
                <button key={row.project_id} onClick={() => { setSelectedId(row.project_id); setInviteOpen(false); setInviteEmail(""); }} className={`w-full py-3 text-left transition-colors ${selectedId === row.project_id ? "text-primary" : "hover:text-primary"}`}>
                  <span className="block truncate text-sm font-medium">{row.project.name}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span>课题编号 {row.project.code}</span><span>·</span><span>{ROLE_LABEL[row.role]}</span>{row.project.status === "archived" && <Badge variant="secondary">已归档</Badge>}</span>
                </button>
              ))}
            </div>
          </div>

        </aside>

        {!selected ? <section className="flex min-h-80 items-center justify-center border-y text-sm text-muted-foreground">新建课题或按编号申请加入后，即可开始协作。</section> : (
          <section className="min-w-0 space-y-8">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">{selected.project.name}</h2><Badge variant="outline">{ROLE_LABEL[selected.role]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">课题编号：<span className="font-mono">{selected.project.code}</span></p><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{selected.project.description || "暂无课题简介"}</p></div>
              {selected.role === "owner" ? <Button variant="outline" onClick={() => run(() => setProjectArchived(selected.project_id, selected.project.status !== "archived"), selected.project.status === "archived" ? "课题已恢复" : "课题已归档")}>{selected.project.status === "archived" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}{selected.project.status === "archived" ? "恢复" : "归档"}</Button> : <Button variant="outline" onClick={() => { if (confirm("确定离开这个课题？")) void run(() => leaveProject(selected.project_id), "已离开课题"); }}>离开课题</Button>}
            </div>

            <Separator />
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3"><Users className="h-4 w-4 text-primary" /><h3 className="font-semibold">团队成员</h3><span className="text-xs text-muted-foreground">{members.length} 人</span>{canManage && selected.project.status === "active" && <Button className="ml-auto" size="sm" variant="outline" onClick={() => setInviteOpen((open) => !open)}><MailPlus className="h-4 w-4" />邀请成员</Button>}</div>
              {canManage && selected.project.status === "active" && inviteOpen && <div className="mb-4 flex max-w-xl gap-2"><Input autoFocus type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="输入邮箱发送站内邀请" /><Button disabled={!inviteEmail.trim() || busy} onClick={() => run(async () => { await inviteMember(selected.project_id, inviteEmail); setInviteEmail(""); setInviteOpen(false); }, "邀请已发送")}>发送邀请</Button></div>}
              <div className="divide-y border-y">
                {members.map((member) => {
                  const canChangeRole = canManage
                    && selected.project.status === "active"
                    && member.role !== "owner"
                    && member.user_id !== user?.id;
                  return (
                    <div key={member.user_id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{member.display_name || member.email.split("@")[0]}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      {canChangeRole ? (
                        <select
                          aria-label={`设置 ${member.email || member.display_name} 的课题权限`}
                          value={member.role}
                          disabled={busy}
                          onChange={(event) => void run(
                            () => setMemberRole(selected.project_id, member.user_id, event.target.value as "admin" | "member"),
                            "权限已更新"
                          )}
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          <option value="admin">管理员</option>
                          <option value="member">成员</option>
                        </select>
                      ) : (
                        <Badge variant={member.role === "owner" ? "default" : "outline"}>{ROLE_LABEL[member.role]}</Badge>
                      )}
                      {canManage && member.role === "member" && member.user_id !== user?.id && (
                        <Button size="icon" variant="ghost" title="移除成员" onClick={() => {
                          if (confirm(`确定移除 ${member.email}？`)) void run(() => removeMember(selected.project_id, member.user_id), "成员已移除");
                        }}>
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {canManage && requests.length > 0 && <div><h3 className="mb-3 font-semibold">加入申请</h3><div className="divide-y border-y">{requests.map((request) => <div key={request.id} className="flex items-center gap-3 py-3 text-sm"><span className="min-w-0 flex-1 truncate">{request.display_name || request.email || "申请人"}</span><Button size="sm" onClick={() => run(() => reviewJoinRequest(request.id, true), "已批准申请")}>批准</Button><Button size="sm" variant="outline" onClick={() => run(() => reviewJoinRequest(request.id, false), "已拒绝申请")}>拒绝</Button></div>)}</div></div>}

            <Separator />
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3"><h3 className="font-semibold">操作记录</h3>{(["all", "data", "member"] as const).map((key) => <Button key={key} size="sm" variant={activityFilter === key ? "secondary" : "ghost"} onClick={() => setActivityFilter(key)}>{key === "all" ? "全部" : key === "data" ? "数据" : "成员"}</Button>)}</div>
              <div className="divide-y border-y">{activity.length === 0 ? <p className="py-6 text-sm text-muted-foreground">暂无操作记录</p> : activity.map((entry) => <div key={entry.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[150px_1fr_auto]"><span className="truncate font-medium">{entry.actor_display_name || entry.actor_email || "系统"}</span><span>{entry.summary}{entry.occurrence_count > 1 && <span className="ml-2 text-xs text-muted-foreground">连续保存 {entry.occurrence_count} 次</span>}</span><time className="text-xs text-muted-foreground">{new Date(entry.last_at).toLocaleString("zh-CN")}</time></div>)}</div>
              {activity.length >= 30 && <Button className="mt-3" variant="outline" onClick={async () => { const more = await listProjectActivity(selected.project_id, activityFilter === "all" ? undefined : activityFilter, activityOffset, 30); setActivity((old) => [...old, ...more]); setActivityOffset((old) => old + more.length); }}>加载更多</Button>}
            </div>
          </section>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>新建课题</DialogTitle><DialogDescription>课题编号将自动生成。负责人可邀请成员并管理权限。</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label htmlFor="project-name">课题名称</Label><Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="project-description">简介（可选）</Label><Textarea id="project-description" rows={4} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button><Button disabled={!name.trim() || busy} onClick={() => run(async () => { const project = await createProject(name, description); setName(""); setDescription(""); setCreateOpen(false); setSelectedId(project.id); }, "课题已创建")}>创建</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={joinOpen} onOpenChange={(open) => { setJoinOpen(open); if (!open) { setJoinCode(""); setLookup(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>加入课题</DialogTitle>
            <DialogDescription>输入四位课题编号，确认课题与负责人后提交申请。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(event) => { setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 4)); setLookup(null); }}
                placeholder="0000"
                inputMode="numeric"
                maxLength={4}
                className="font-mono"
              />
              <Button
                variant="outline"
                disabled={joinCode.length !== 4 || busy}
                onClick={() => run(async () => { const hit = await lookupProject(joinCode); setLookup(hit); if (!hit) throw new Error("没有找到该课题"); }, "已找到课题")}
              >
                <Search className="h-4 w-4" />查询
              </Button>
            </div>
            {lookup && <div className="border-l-2 border-primary pl-3 text-sm"><p className="font-medium">{lookup.name}</p><p className="text-xs text-muted-foreground">负责人：{lookup.owner_name}</p></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinOpen(false)}>取消</Button>
            <Button disabled={!lookup || busy} onClick={() => lookup && run(async () => { await requestJoin(lookup.code); setJoinOpen(false); }, "申请已提交")}>申请加入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
