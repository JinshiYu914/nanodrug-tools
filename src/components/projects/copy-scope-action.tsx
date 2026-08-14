"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyItemToPersonal, copyItemToProject, listProjectMemberships } from "@/lib/supabase/project-service";
import type { LnpSavedItem } from "@/lib/supabase/lnp-service";
import type { ProjectMembership } from "@/lib/projects/types";

interface Props { item: LnpSavedItem; compact?: boolean; }

export default function CopyScopeAction({ item, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectMembership[]>([]);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || item.project_id) return;
    void listProjectMemberships().then((rows) => {
      const editable = rows.filter((row) => row.project.status === "active" && row.role !== "member");
      setProjects(editable); setProjectId(editable[0]?.project_id ?? "");
    });
  }, [item.project_id, open]);

  async function copy() {
    setBusy(true);
    try {
      const result = item.project_id
        ? await copyItemToPersonal(item)
        : await copyItemToProject(item, projectId);
      const linked = result.preview.linkedRibogreen.length;
      toast.success(linked ? `已复制，并重新关联 ${linked} 条 RiboGreen 记录` : "已复制记录");
      if (result.preview.missingLinkedIds.length) toast.warning("部分原始 RiboGreen 来源不可访问，已保留数值快照并标记断链");
      setOpen(false);
    } catch (error) {
      console.error(error); toast.error((error as { message?: string })?.message ?? "复制失败");
    } finally { setBusy(false); }
  }

  return <>
    <Button size={compact ? "icon" : "sm"} variant="ghost" title={item.project_id ? "复制到我的数据" : "复制到课题"} onClick={(event) => { event.stopPropagation(); setOpen(true); }}>
      <Copy className="h-3.5 w-3.5" />{!compact && (item.project_id ? "复制到我的数据" : "复制到课题")}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{item.project_id ? "复制到我的数据" : "复制到课题"}</DialogTitle><DialogDescription>原记录不会移动。tLNP或配方筛选关联的RiboGreen结果会一并复制并重新绑定。</DialogDescription></DialogHeader>{!item.project_id && <select className="h-9 rounded-md border bg-background px-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.length === 0 && <option value="">没有可写入的课题</option>}{projects.map((row) => <option key={row.project_id} value={row.project_id}>{row.project.name}</option>)}</select>}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={busy || (!item.project_id && !projectId)} onClick={copy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}确认复制</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
