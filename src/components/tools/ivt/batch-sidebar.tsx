"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Dna,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildTree,
  createItem,
  deleteItem,
  duplicateItem,
  moveItem,
  renameItem,
  type LnpSavedItem,
  type TreeNode,
} from "@/lib/supabase/lnp-service";
import { emptyIvtBatch, serializeIvtBatch } from "@/lib/calculations/ivt-experiment";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";
import { listSyncedWorkbenchItems } from "@/lib/supabase/workbench-cache";

const MIGRATION = "006_ivt_mrna.sql";

interface Props {
  userId: string;
  activeBatchId: string | null;
  onSelectBatch: (item: LnpSavedItem) => void;
  onBatchDeleted: (id: string) => void;
  refreshToken?: number;
}

export default function IvtBatchSidebar({
  userId,
  activeBatchId,
  onSelectBatch,
  onBatchDeleted,
  refreshToken,
}: Props) {
  const [items, setItems] = useState<LnpSavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createKind, setCreateKind] = useState<"batch" | "folder" | null>(null);
  const [moveTarget, setMoveTarget] = useState<LnpSavedItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<LnpSavedItem | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listSyncedWorkbenchItems(userId, "ivt_batch"));
    } catch (error) {
      console.warn("[ivt] 批次加载失败", error);
      toast.error(describeError(error, MIGRATION));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => void reload(), [reload, refreshToken]);

  const tree = useMemo(() => buildTree(items), [items]);
  const folders = useMemo(() => items.filter((item) => item.is_folder), [items]);

  async function createBatch(name: string, parentId: string | null) {
    try {
      const row = await createItem({
        type: "ivt_batch",
        is_folder: false,
        parent_id: parentId,
        name,
        data: serializeIvtBatch(emptyIvtBatch()),
        sort_order: 0,
      });
      await reload();
      onSelectBatch(row);
      toast.success(`已创建批次：${name}`);
    } catch (error) {
      toast.error(describeError(error, MIGRATION));
    }
  }

  async function createFolder(name: string, parentId: string | null) {
    try {
      await createItem({
        type: "ivt_batch",
        is_folder: true,
        parent_id: parentId,
        name,
        data: null,
        sort_order: 0,
      });
      await reload();
      toast.success("文件夹已创建");
    } catch (error) {
      toast.error(describeError(error, MIGRATION));
    }
  }

  async function duplicateBatch(item: LnpSavedItem) {
    try {
      const row = await duplicateItem(item.id);
      await reload();
      onSelectBatch(row);
      toast.success(`已复制为「${row.name}」`);
    } catch (error) {
      toast.error(describeError(error, MIGRATION));
    }
  }

  async function remove(item: LnpSavedItem) {
    const ok = window.confirm(
      item.is_folder
        ? `删除文件夹「${item.name}」及其中所有批次？`
        : `删除批次「${item.name}」？该操作无法撤销。`
    );
    if (!ok) return;
    try {
      await deleteItem(item.id);
      await reload();
      if (!item.is_folder) onBatchDeleted(item.id);
      toast.success("已删除");
    } catch (error) {
      toast.error(describeError(error, MIGRATION));
    }
  }

  async function rename(item: LnpSavedItem, name: string) {
    if (!name.trim() || name.trim() === item.name) return;
    try {
      await renameItem(item.id, name.trim());
      await reload();
    } catch (error) {
      toast.error(describeError(error, MIGRATION));
    }
  }

  async function move(item: LnpSavedItem, parentId: string | null) {
    try {
      await moveItem(item.id, parentId);
      await reload();
      toast.success("已移动");
    } catch (error) {
      toast.error(describeError(error, MIGRATION));
    }
  }

  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <Card className="lg:sticky lg:top-20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">IVT 批次</CardTitle>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="新建文件夹"
                onClick={() => setCreateKind("folder")}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="新建 IVT 批次"
                onClick={() => setCreateKind("batch")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-12rem)] space-y-0.5 overflow-y-auto pt-0">
          {loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">加载中...</p>
          ) : tree.length === 0 ? (
            <div className="space-y-2 py-8 text-center">
              <p className="text-xs text-muted-foreground">暂无 IVT 批次</p>
              <Button size="sm" variant="outline" onClick={() => setCreateKind("batch")}>
                <Plus className="mr-1 h-3.5 w-3.5" />新建批次
              </Button>
            </div>
          ) : (
            tree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                activeBatchId={activeBatchId}
                onToggle={toggle}
                onSelect={onSelectBatch}
                onRename={setRenameTarget}
                onMove={setMoveTarget}
                onDuplicate={duplicateBatch}
                onDelete={remove}
              />
            ))
          )}
        </CardContent>
      </Card>

      <CreateDialog
        kind={createKind}
        folders={folders}
        onClose={() => setCreateKind(null)}
        onSubmit={createKind === "folder" ? createFolder : createBatch}
      />
      {renameTarget && (
        <RenameDialog item={renameTarget} onClose={() => setRenameTarget(null)} onSave={rename} />
      )}
      {moveTarget && (
        <MoveDialog item={moveTarget} folders={folders} onClose={() => setMoveTarget(null)} onSave={move} />
      )}
    </>
  );
}

function TreeRow({
  node,
  depth,
  expanded,
  activeBatchId,
  onToggle,
  onSelect,
  onRename,
  onMove,
  onDuplicate,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  activeBatchId: string | null;
  onToggle: (id: string) => void;
  onSelect: (item: LnpSavedItem) => void;
  onRename: (item: LnpSavedItem) => void;
  onMove: (item: LnpSavedItem) => void;
  onDuplicate: (item: LnpSavedItem) => void;
  onDelete: (item: LnpSavedItem) => void;
}) {
  const open = expanded.has(node.id);
  const active = !node.is_folder && node.id === activeBatchId;
  return (
    <>
      <div
        className={`group flex items-start gap-1 rounded-md px-1.5 py-2 text-xs hover:bg-muted/50 ${active ? "bg-primary/10 text-primary" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {node.is_folder ? (
          <button type="button" onClick={() => onToggle(node.id)} className="h-5 w-5 text-muted-foreground">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <button
          type="button"
          onClick={() => (node.is_folder ? onToggle(node.id) : onSelect(node))}
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
        >
          {node.is_folder ? (
            open ? <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> : <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          ) : (
            <Dna className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span className="line-clamp-2 break-words leading-4" title={node.name}>{node.name}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onRename(node)}><Pencil className="h-3.5 w-3.5" />重命名</DropdownMenuItem>
            {!node.is_folder && <DropdownMenuItem onSelect={() => onDuplicate(node)}><Copy className="h-3.5 w-3.5" />复制批次</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => onMove(node)}><FolderInput className="h-3.5 w-3.5" />移动到...</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(node)}><Trash2 className="h-3.5 w-3.5" />删除</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {node.is_folder && open && node.children.map((child) => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          activeBatchId={activeBatchId}
          onToggle={onToggle}
          onSelect={onSelect}
          onRename={onRename}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function CreateDialog({
  kind,
  folders,
  onClose,
  onSubmit,
}: {
  kind: "batch" | "folder" | null;
  folders: LnpSavedItem[];
  onClose: () => void;
  onSubmit: (name: string, parentId: string | null) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (kind) {
      setName("");
      setParentId("");
    }
  }, [kind]);
  async function submit() {
    if (!name.trim()) return toast.error("请输入名称");
    setBusy(true);
    try {
      await onSubmit(name.trim(), parentId || null);
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "folder" ? "新建文件夹" : "新建 IVT 批次"}</DialogTitle>
          <DialogDescription>{kind === "folder" ? "用于整理 IVT 批次。" : "一个批次可包含多个 RNA。"}</DialogDescription>
        </DialogHeader>
        <Field label="名称"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "folder" ? "文件夹名" : "例如 IVT-20260812-A"} autoFocus /></Field>
        <Field label="放入文件夹（可选）">
          <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="">（根目录）</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </Field>
        <DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={submit} disabled={busy}>{busy ? "创建中..." : "创建"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ item, onClose, onSave }: { item: LnpSavedItem; onClose: () => void; onSave: (item: LnpSavedItem, name: string) => Promise<void> }) {
  const [name, setName] = useState(item.name);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>重命名</DialogTitle></DialogHeader>
        <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        <DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={() => void onSave(item, name).then(onClose)}>保存</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ item, folders, onClose, onSave }: { item: LnpSavedItem; folders: LnpSavedItem[]; onClose: () => void; onSave: (item: LnpSavedItem, parentId: string | null) => Promise<void> }) {
  const [parentId, setParentId] = useState(item.parent_id ?? "");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>移动「{item.name}」</DialogTitle><DialogDescription>选择目标文件夹。</DialogDescription></DialogHeader>
        <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">（根目录）</option>
          {folders.filter((folder) => folder.id !== item.id).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        <DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={() => void onSave(item, parentId || null).then(onClose)}>确认移动</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
