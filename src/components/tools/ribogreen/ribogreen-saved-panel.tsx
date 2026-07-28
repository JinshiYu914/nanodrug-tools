"use client";

import { useState } from "react";
import {
  LogIn,
  Save,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createItem, type LnpSavedItem } from "@/lib/supabase/lnp-service";
import { describeError, useRibogreenSaved } from "./use-ribogreen-saved";

interface Props {
  getCurrentData: () => Record<string, unknown>;
  onLoad: (data: Record<string, unknown>, item: LnpSavedItem) => void;
}

/** Compact saved-standard-curve list, rendered inside the 标准曲线 card. */
export default function RibogreenSavedPanel({ getCurrentData, onLoad }: Props) {
  const { userId, authLoading, items, loading, reload, rename, remove } =
    useRibogreenSaved("ribogreen_curve");

  const [busy, setBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [renameTarget, setRenameTarget] = useState<LnpSavedItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function handleSave() {
    const name = saveName.trim();
    if (!name) {
      toast.error("请填写名称");
      return;
    }
    setBusy(true);
    try {
      await createItem({
        type: "ribogreen_curve",
        is_folder: false,
        parent_id: null,
        name,
        data: getCurrentData(),
        sort_order: 0,
      });
      setSaveOpen(false);
      setSaveName("");
      await reload();
      toast.success("标准曲线已保存");
    } catch (e) {
      console.error(e);
      toast.error(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return null;

  if (!userId) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <LogIn className="h-3.5 w-3.5" />
        登录后可保存和复用自定义标准曲线
        <Link href="/login" className="text-primary hover:underline">
          前往登录
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold">我的标准曲线</h4>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => {
            setSaveName("");
            setSaveOpen(true);
          }}
        >
          <Save className="h-3.5 w-3.5" />
          保存当前曲线
        </Button>
      </div>

      {loading ? (
        <p className="py-3 text-center text-xs text-muted-foreground">加载中...</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
          还没有保存的标准曲线
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    title="更多操作"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      if (!it.data) {
                        toast.error("该记录没有可载入的数据");
                        return;
                      }
                      if (!window.confirm(`载入「${it.name}」会覆盖当前标准曲线，确定继续？`))
                        return;
                      onLoad(it.data, it);
                      toast.success(`已载入「${it.name}」`);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    载入
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setRenameTarget(it);
                      setRenameValue(it.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    重命名
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => void remove(it)}
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存标准曲线</DialogTitle>
            <DialogDescription>
              保存当前两条曲线的标准点、启用状态和拟合选项。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ribogreen-curve-name">名称</Label>
            <Input
              id="ribogreen-curve-name"
              value={saveName}
              autoFocus
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
              placeholder="例如 2026-07 Tecan 新配试剂"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameTarget) {
                void rename(renameTarget.id, renameValue.trim());
                setRenameTarget(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (renameTarget && renameValue.trim()) {
                  void rename(renameTarget.id, renameValue.trim());
                }
                setRenameTarget(null);
              }}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
