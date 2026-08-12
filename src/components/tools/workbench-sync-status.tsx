"use client";

import { CloudDownload, CloudOff, Copy, Loader2, Save } from "lucide-react";
import type { WorkbenchSyncState } from "@/lib/supabase/use-synced-workbench";

export default function WorkbenchSyncStatus({
  state,
  lastSavedAt,
}: {
  state: WorkbenchSyncState;
  lastSavedAt: Date | null;
}) {
  if (state === "pulling") return <span className="flex items-center gap-1 text-primary"><CloudDownload className="h-3 w-3" />正在从云端同步</span>;
  if (state === "saving") return <span className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" />正在同步</span>;
  if (state === "local-draft") return <span className="flex items-center gap-1 text-warning"><CloudOff className="h-3 w-3" />本机草稿待同步</span>;
  if (state === "conflict-copy") return <span className="flex items-center gap-1 text-warning"><Copy className="h-3 w-3" />已生成冲突副本</span>;
  if (state === "error") return <span className="flex items-center gap-1 text-destructive"><CloudOff className="h-3 w-3" />同步失败，草稿已保留</span>;
  if (state === "synced") {
    return <span className="flex items-center gap-1 text-success"><Save className="h-3 w-3" />已同步{lastSavedAt ? ` ${lastSavedAt.toLocaleTimeString()}` : ""}</span>;
  }
  return null;
}
