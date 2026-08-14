"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useUser } from "@/lib/supabase/use-user";
import {
  deleteItem,
  listAllItems,
  renameItem,
  type LnpSavedItem,
  type LnpItemType,
} from "@/lib/supabase/lnp-service";
import { PERSONAL_SCOPE, type DataScope } from "@/lib/projects/types";

/**
 * Supabase surfaces failures as PostgrestError — a plain object, not an Error
 * instance — so String(e) would only ever yield "[object Object]".
 *
 * `migrationHint` names the migration that widens the type check constraint for
 * whatever kind of row the caller is writing: 23514 means the row's `type` isn't
 * in the constraint yet, and the only fix is running that specific file.
 */
export function describeError(
  e: unknown,
  migrationHint = "003_ribogreen.sql"
): string {
  const o = (e ?? {}) as Record<string, unknown>;
  const msg = [
    e instanceof Error ? e.message : "",
    typeof o.message === "string" ? o.message : "",
    typeof o.code === "string" ? o.code : "",
    typeof o.details === "string" ? o.details : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (msg.includes("42P01") || msg.includes("does not exist")) {
    return "数据表尚未创建，请先运行 SQL 迁移";
  }
  if (msg.includes("23514") || msg.includes("violates check constraint")) {
    return `请先在 Supabase 执行 ${migrationHint} 迁移`;
  }
  return "操作失败";
}

export function useRibogreenSaved(
  type: Extract<LnpItemType, "ribogreen_curve" | "ribogreen_result">,
  refreshToken?: number,
  scope: DataScope = PERSONAL_SCOPE
) {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<LnpSavedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listAllItems(type, scope));
    } catch (e) {
      console.error(e);
      toast.error(describeError(e));
    } finally {
      setLoading(false);
    }
  }, [scope, type]);

  // Load once the user is known, and again whenever the parent bumps
  // refreshToken after saving through the service directly.
  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    void reload();
  }, [userId, refreshToken, reload]);

  const rename = useCallback(
    async (id: string, name: string) => {
      try {
        await renameItem(id, name);
        await reload();
      } catch (e) {
        console.error(e);
        toast.error(describeError(e));
      }
    },
    [reload]
  );

  const remove = useCallback(
    async (item: LnpSavedItem) => {
      if (!window.confirm(`确定要删除「${item.name}」吗？此操作不可撤销。`))
        return false;
      try {
        await deleteItem(item.id);
        await reload();
        toast.success("已删除");
        return true;
      } catch (e) {
        console.error(e);
        toast.error(describeError(e));
        return false;
      }
    },
    [reload]
  );

  return { userId, authLoading, items, loading, reload, rename, remove };
}
