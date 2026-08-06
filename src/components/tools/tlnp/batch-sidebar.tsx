"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Copy,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "sonner";
import {
  buildTree,
  createItem,
  deleteItem,
  duplicateItem,
  listAllItems,
  moveItem,
  renameItem,
  type LnpSavedItem,
  type TreeNode,
} from "@/lib/supabase/lnp-service";
import {
  emptyTlnpExperiment,
  serializeTlnpExperiment,
} from "@/lib/calculations/tlnp-experiment";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";

const MIGRATION = "004_tlnp_experiment.sql";

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `今天 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  activeBatchId: string | null;
  onSelectBatch: (item: LnpSavedItem) => void;
  onBatchDeleted: (id: string) => void;
  /** Bumped by the parent after an autosave so updated_at re-reads. */
  refreshToken?: number;
}

/**
 * The batch tree. Same folder model as the screening sidebar — folders carry
 * the same `type` with `data = null`, so a batch book organizes itself with no
 * extra table.
 */
export default function BatchSidebar({
  activeBatchId,
  onSelectBatch,
  onBatchDeleted,
  refreshToken,
}: Props) {
  const [items, setItems] = useState<LnpSavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<LnpSavedItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<LnpSavedItem | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listAllItems("tlnp_experiment"));
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  const tree = useMemo(() => buildTree(items), [items]);
  const folders = useMemo(() => items.filter((i) => i.is_folder), [items]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function createBatch(name: string, parentId: string | null) {
    try {
      const row = await createItem({
        type: "tlnp_experiment",
        is_folder: false,
        parent_id: parentId,
        name,
        data: serializeTlnpExperiment(emptyTlnpExperiment()),
        sort_order: 0,
      });
      await reload();
      onSelectBatch(row);
      toast.success(`已创建批次：${name}`);
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  async function createFolder(name: string, parentId: string | null) {
    try {
      await createItem({
        type: "tlnp_experiment",
        is_folder: true,
        parent_id: parentId,
        name,
        data: null,
        sort_order: 0,
      });
      await reload();
      toast.success("文件夹已创建");
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  async function handleDuplicate(item: LnpSavedItem) {
    try {
      const row = await duplicateItem(item.id);
      await reload();
      onSelectBatch(row);
      toast.success(`已复制为「${row.name}」`);
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  async function handleDelete(item: LnpSavedItem) {
    const confirmed = item.is_folder
      ? confirm(`删除文件夹「${item.name}」及其中所有批次？`)
      : confirm(`删除批次「${item.name}」？该操作无法撤销。`);
    if (!confirmed) return;
    try {
      await deleteItem(item.id);
      await reload();
      if (!item.is_folder) onBatchDeleted(item.id);
      toast.success("已删除");
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  async function handleRename(item: LnpSavedItem, name: string) {
    if (!name.trim() || name === item.name) return;
    try {
      await renameItem(item.id, name.trim());
      await reload();
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  async function handleMove(item: LnpSavedItem, parentId: string | null) {
    try {
      await moveItem(item.id, parentId);
      await reload();
      toast.success("已移动");
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  return (
    <>
      <Card className="lg:sticky lg:top-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">我的实验批次</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="新建文件夹"
                onClick={() => setNewFolderOpen(true)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="新建批次"
                onClick={() => setNewBatchOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="max-h-[70vh] space-y-0.5 overflow-y-auto pt-0">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              加载中...
            </p>
          ) : tree.length === 0 ? (
            <div className="space-y-2 py-6 text-center">
              <p className="text-xs text-muted-foreground">暂无实验批次</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => setNewBatchOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                新建批次
              </Button>
            </div>
          ) : (
            tree.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpanded}
                activeBatchId={activeBatchId}
                onSelect={onSelectBatch}
                onRename={setRenameTarget}
                onMove={setMoveTarget}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))
          )}
        </CardContent>
      </Card>

      <NewItemDialog
        open={newBatchOpen}
        onOpenChange={setNewBatchOpen}
        title="新建实验批次"
        description="为本批 tLNP 实验命名，可选放入文件夹。"
        placeholder="例如：tLNP-CD3-20260806"
        folders={folders}
        onSubmit={createBatch}
      />

      <NewItemDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        title="新建文件夹"
        description="创建用于归类实验批次的文件夹。"
        placeholder="文件夹名"
        folders={folders}
        onSubmit={createFolder}
      />

      {moveTarget && (
        <MoveDialog
          item={moveTarget}
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onMove={handleMove}
        />
      )}

      {renameTarget && (
        <RenameDialog
          item={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRename={handleRename}
        />
      )}
    </>
  );
}

// ─── Tree row ──────────────────────────────────────────────

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  activeBatchId: string | null;
  onSelect: (item: LnpSavedItem) => void;
  onRename: (item: LnpSavedItem) => void;
  onMove: (item: LnpSavedItem) => void;
  onDuplicate: (item: LnpSavedItem) => void;
  onDelete: (item: LnpSavedItem) => void;
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  activeBatchId,
  onSelect,
  onRename,
  onMove,
  onDuplicate,
  onDelete,
}: TreeRowProps) {
  const isOpen = expanded.has(node.id);
  const isActive = !node.is_folder && node.id === activeBatchId;

  return (
    <>
      <div
        className={`group flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs hover:bg-muted/50 ${
          isActive ? "bg-primary/10 text-primary" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {node.is_folder ? (
          <button
            onClick={() => onToggle(node.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <button
          onClick={() => (node.is_folder ? onToggle(node.id) : onSelect(node))}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {node.is_folder ? (
            isOpen ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-warning" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-warning" />
            )
          ) : (
            <Boxes className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span className="truncate">{node.name}</span>
          {!node.is_folder && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {formatTimestamp(node.updated_at)}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="shrink-0 p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground data-[state=open]:opacity-100"
              title="更多操作"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onSelect={() => onRename(node)}>
              <Pencil className="h-3.5 w-3.5" />
              重命名
            </DropdownMenuItem>
            {!node.is_folder && (
              <DropdownMenuItem onSelect={() => onDuplicate(node)}>
                <Copy className="h-3.5 w-3.5" />
                复制批次
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onMove(node)}>
              <FolderInput className="h-3.5 w-3.5" />
              移动到...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(node)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {node.is_folder &&
        isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            activeBatchId={activeBatchId}
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

// ─── Dialogs ───────────────────────────────────────────────

function NewItemDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  folders,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  placeholder: string;
  folders: LnpSavedItem[];
  onSubmit: (name: string, parentId: string | null) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setParentId("");
    }
  }, [open]);

  async function submit() {
    if (!name.trim()) {
      toast.error("请输入名称");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), parentId || null);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              放入文件夹（可选）
            </Label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">（根目录）</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "创建中..." : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  item,
  folders,
  onClose,
  onMove,
}: {
  item: LnpSavedItem;
  folders: LnpSavedItem[];
  onClose: () => void;
  onMove: (item: LnpSavedItem, parentId: string | null) => Promise<void>;
}) {
  const [parentId, setParentId] = useState<string>(item.parent_id ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await onMove(item, parentId || null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const available = folders.filter((f) => f.id !== item.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移动「{item.name}」</DialogTitle>
          <DialogDescription>选择目标文件夹</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">目标</Label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">（根目录）</option>
            {available.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            确认移动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  item,
  onClose,
  onRename,
}: {
  item: LnpSavedItem;
  onClose: () => void;
  onRename: (item: LnpSavedItem, name: string) => Promise<void>;
}) {
  const [name, setName] = useState(item.name);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onRename(item, name.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重命名</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
