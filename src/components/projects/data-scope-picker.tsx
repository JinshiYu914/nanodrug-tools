"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FolderKanban, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { listProjectMemberships } from "@/lib/supabase/project-service";
import { PERSONAL_SCOPE, canEditScope, type DataScope, type ProjectMembership } from "@/lib/projects/types";

interface Props {
  value: DataScope;
  onChange: (scope: DataScope) => void;
  compact?: boolean;
  resetParams?: string[];
  personalLabel?: string;
}

export default function DataScopePicker({
  value,
  onChange,
  compact = false,
  resetParams = [],
  personalLabel = "我的数据",
}: Props) {
  const [memberships, setMemberships] = useState<ProjectMembership[]>([]);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const select = useCallback((scope: DataScope, writeUrl = true) => {
    onChange(scope);
    if (!writeUrl) return;
    const next = new URLSearchParams(params.toString());
    resetParams.forEach((key) => next.delete(key));
    if (scope.kind === "project") next.set("project", scope.projectId);
    else next.delete("project");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [onChange, params, pathname, resetParams, router]);

  useEffect(() => {
    let cancelled = false;
    void listProjectMemberships().then((rows) => {
      if (cancelled) return;
      setMemberships(rows);
      const requested = params.get("project");
      if (!requested) return;
      const hit = rows.find((row) => row.project_id === requested);
      if (!hit) {
        toast.error("你无权访问该课题，已切换到我的数据");
        select(PERSONAL_SCOPE);
        return;
      }
      select({
        kind: "project",
        projectId: hit.project_id,
        role: hit.role,
        status: hit.project.status,
        name: hit.project.name,
      }, false);
    }).catch((error) => {
      console.warn("[projects] 加载课题失败", error);
    });
    return () => { cancelled = true; };
    // URL project is applied once when memberships arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = value.kind === "personal" ? "personal" : value.projectId;
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 ${compact ? "" : "rounded-lg border bg-muted/20 px-3 py-2.5"}`}>
      {!compact && <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FolderKanban className="h-3.5 w-3.5" />数据归属
      </span>}
      <select
        aria-label="数据归属"
        value={current}
        onChange={(event) => {
          const id = event.target.value;
          if (id === "personal") return select(PERSONAL_SCOPE);
          const hit = memberships.find((row) => row.project_id === id);
          if (!hit) return;
          select({ kind: "project", projectId: id, role: hit.role, status: hit.project.status, name: hit.project.name });
        }}
        className={compact
          ? "h-7 min-w-0 max-w-full rounded-md border bg-background px-2 text-xs font-semibold"
          : "h-8 min-w-48 rounded-md border bg-background px-2 text-sm"}
      >
        <option value="personal">{personalLabel}</option>
        {memberships.map((row) => (
          <option key={row.project_id} value={row.project_id}>
            {row.project.name}{row.project.status === "archived" ? "（已归档）" : ""}
          </option>
        ))}
      </select>
      {!canEditScope(value) && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5" />只读
        </span>
      )}
    </div>
  );
}
