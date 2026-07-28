"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  LogIn,
  GripVertical,
  ArrowUpDown,
  Download,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  listAllItems,
  createItem,
  deleteItem,
  moveItem,
  renameItem,
  reorderItems,
  buildTree,
  type LnpSavedItem,
  type TreeNode,
} from "@/lib/supabase/lnp-service";
import { getCurrentUserId } from "@/lib/supabase/use-user";
import * as XLSX from "xlsx";

type SortMode = "time" | "name" | "custom";

interface SavedPanelProps {
  type: "formula" | "preparation";
  title: string;
  onLoad: (data: Record<string, unknown>) => void;
  getCurrentData: () => Record<string, unknown>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) {
    return `${month}/${day}`;
  }
  return `${d.getFullYear().toString().slice(-2)}/${month}/${day}`;
}

function buildIndexMap(nodes: TreeNode[]): Map<string, number> {
  const map = new Map<string, number>();
  let counter = 0;
  function walk(list: TreeNode[]) {
    for (const n of list) {
      if (n.is_folder) {
        walk(n.children);
      } else {
        counter++;
        map.set(n.id, counter);
      }
    }
  }
  walk(nodes);
  return map;
}

export default function LnpSavedPanel({
  type,
  title,
  onLoad,
  getCurrentData,
}: SavedPanelProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<LnpSavedItem[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveFolder, setSaveFolder] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPos, setDropPos] = useState<
    "before" | "after" | "inside" | null
  >(null);

  const folders = useMemo(() => items.filter((i) => i.is_folder), [items]);

  const sortedTree = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "time")
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return buildTree(sorted);
  }, [items, sortMode]);

  const indexMap = useMemo(() => buildIndexMap(sortedTree), [sortedTree]);

  // Resolves from the tab-wide shared lookup — four of these panels mount on
  // /tools/lnp-formula, and one getUser() each used to serialize on the auth
  // Web Lock until the last ones hit the 10s timeout.
  const checkAuth = useCallback(async () => {
    const uid = await getCurrentUserId();
    setUserId(uid);
    return uid;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await listAllItems(type);
      setItems(all);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist") || msg.includes("42P01")) {
        setError("数据表尚未创建，请运行 SQL 迁移");
      } else {
        setError("加载失败");
      }
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    checkAuth().then((uid) => {
      if (uid) refresh();
    });
  }, [checkAuth, refresh]);

  async function handleSave() {
    if (!saveName.trim()) return;
    const uid = await checkAuth();
    if (!uid) return;
    const maxOrder = items
      .filter((i) => i.parent_id === saveFolder && !i.is_folder)
      .reduce((max, i) => Math.max(max, i.sort_order ?? 0), 0);
    try {
      setLoading(true);
      await createItem({
        type,
        is_folder: false,
        parent_id: saveFolder,
        name: saveName.trim(),
        data: getCurrentData(),
        sort_order: maxOrder + 1,
      });
      setSaveName("");
      await refresh();
    } catch {
      setError("保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const uid = await checkAuth();
    if (!uid) return;
    try {
      await createItem({
        type,
        is_folder: true,
        parent_id: null,
        name: newFolderName.trim(),
        data: null,
        sort_order: 0,
      });
      setNewFolderName("");
      setShowNewFolder(false);
      await refresh();
    } catch {
      setError("创建文件夹失败");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`确定要删除「${name}」吗？此操作不可撤销。`)) return;
    try {
      await deleteItem(id);
      await refresh();
    } catch {
      setError("删除失败");
    }
  }

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  async function confirmRename() {
    if (!renamingId || !renameValue.trim()) { cancelRename(); return; }
    try {
      await renameItem(renamingId, renameValue.trim());
      cancelRename();
      await refresh();
    } catch {
      setError("重命名失败");
    }
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  async function handleDrop(
    draggedId: string,
    targetId: string,
    pos: "before" | "after" | "inside"
  ) {
    try {
      if (pos === "inside") {
        await moveItem(draggedId, targetId);
      } else {
        const target = items.find((i) => i.id === targetId);
        const parentId = target?.parent_id ?? null;

        const dragged = items.find((i) => i.id === draggedId);
        if (dragged?.parent_id !== parentId) {
          await moveItem(draggedId, parentId);
        }

        const siblings = items
          .filter((i) => i.parent_id === parentId && i.id !== draggedId)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        const targetIdx = siblings.findIndex((s) => s.id === targetId);
        const insertIdx = pos === "before" ? targetIdx : targetIdx + 1;
        const ordered = [...siblings];
        ordered.splice(insertIdx, 0, dragged!);

        await reorderItems(ordered.map((s) => s.id));
        setSortMode("custom");
      }
      await refresh();
    } catch {
      setError("操作失败");
    }
  }

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDragId(id);
  }

  function onDragEnd() {
    setDragId(null);
    setDropTargetId(null);
    setDropPos(null);
  }

  function onDragOverItem(
    e: React.DragEvent,
    id: string,
    isFolder: boolean
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (id === dragId) return;

    if (isFolder) {
      setDropTargetId(id);
      setDropPos("inside");
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "before" : "after";
    setDropTargetId(id);
    setDropPos(pos);
  }

  function onDropItem(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const did = e.dataTransfer.getData("text/plain");
    if (did && dropTargetId && dropPos) {
      handleDrop(did, dropTargetId, dropPos);
    }
    setDragId(null);
    setDropTargetId(null);
    setDropPos(null);
  }

  function onRootDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDropTargetId("__root__");
    setDropPos("inside");
  }

  async function onRootDrop(e: React.DragEvent) {
    e.preventDefault();
    const did = e.dataTransfer.getData("text/plain");
    if (did) {
      try {
        await moveItem(did, null);
        await refresh();
      } catch {
        setError("移动失败");
      }
    }
    setDragId(null);
    setDropTargetId(null);
    setDropPos(null);
  }

  function handleExport() {
    const nonFolder = items.filter((i) => !i.is_folder);
    if (nonFolder.length === 0) return;

    const wb = XLSX.utils.book_new();

    if (type === "formula") {
      exportFormulaSheets(wb, nonFolder);
    } else {
      exportPreparationSheets(wb, nonFolder);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `lnp-${type}-${dateStr}.xlsx`);
  }

  if (!userId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 space-y-2">
            <LogIn className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              登录后可保存和管理配方
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExport}
              disabled={items.filter((i) => !i.is_folder).length === 0}
              className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
              title="导出全部数据"
            >
              <Download className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-0.5">
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-5 rounded border-none bg-transparent text-[10px] text-muted-foreground focus:outline-none cursor-pointer pr-3"
              >
                <option value="time">时间</option>
                <option value="name">名称</option>
                <option value="custom">自定义</option>
              </select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Save input */}
        <div className="space-y-1.5">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="输入名称"
            className="h-7 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          {folders.length > 0 && (
            <select
              value={saveFolder ?? ""}
              onChange={(e) => setSaveFolder(e.target.value || null)}
              className="flex h-6 w-full rounded-md border border-input bg-transparent px-2 py-0 text-[10px]"
            >
              <option value="">保存到根目录</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            className="w-full h-6 text-[10px]"
            onClick={handleSave}
            disabled={loading || !saveName.trim()}
          >
            保存当前配置
          </Button>
        </div>

        <Separator />

        {/* New folder */}
        {showNewFolder ? (
          <div className="flex gap-1">
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="文件夹名称"
              className="h-6 text-xs flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleCreateFolder}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-6 text-[10px] justify-start gap-1"
            onClick={() => setShowNewFolder(true)}
          >
            <Plus className="h-3 w-3" />
            新建文件夹
          </Button>
        )}

        {error && (
          <p className="text-[10px] text-destructive">{error}</p>
        )}

        {/* Tree with drag and drop */}
        <div
          className={`space-y-0 max-h-72 overflow-y-auto rounded ${
            dragId && dropTargetId === "__root__"
              ? "ring-1 ring-primary/50 bg-primary/5"
              : ""
          }`}
          onDragOver={onRootDragOver}
          onDrop={onRootDrop}
        >
          {sortedTree.length === 0 && !loading && (
            <p className="text-[10px] text-muted-foreground text-center py-3">
              暂无保存的项目
            </p>
          )}
          {sortedTree.map((node) => (
            <TreeItemRow
              key={node.id}
              node={node}
              indexMap={indexMap}
              onLoad={onLoad}
              onDelete={handleDelete}
              onRename={startRename}
              renamingId={renamingId}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameConfirm={confirmRename}
              onRenameCancel={cancelRename}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOverItem}
              onDrop={onDropItem}
              dragId={dragId}
              dropTargetId={dropTargetId}
              dropPos={dropPos}
              depth={0}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TreeItemRow({
  node,
  indexMap,
  onLoad,
  onDelete,
  onRename,
  renamingId,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragId,
  dropTargetId,
  dropPos,
  depth,
}: {
  node: TreeNode;
  indexMap: Map<string, number>;
  onLoad: (data: Record<string, unknown>) => void;
  onDelete: (id: string, name: string) => void;
  onRename: (id: string, currentName: string) => void;
  renamingId: string | null;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameConfirm: () => void;
  onRenameCancel: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string, isFolder: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  dragId: string | null;
  dropTargetId: string | null;
  dropPos: "before" | "after" | "inside" | null;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDragging = dragId === node.id;
  const isDropTarget = dropTargetId === node.id;

  if (node.is_folder) {
    return (
      <div>
        <div
          className={`flex items-center gap-0.5 rounded px-1 py-0.5 cursor-pointer group transition-colors ${
            isDropTarget && dropPos === "inside"
              ? "ring-1 ring-primary bg-primary/10"
              : "hover:bg-muted"
          } ${isDragging ? "opacity-40" : ""}`}
          style={{ paddingLeft: depth * 12 + 2 }}
          draggable
          onDragStart={(e) => onDragStart(e, node.id)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => onDragOver(e, node.id, true)}
          onDrop={onDrop}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {expanded ? (
            <FolderOpen className="h-3 w-3 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-3 w-3 shrink-0 text-amber-500" />
          )}
          {renamingId === node.id ? (
            <div className="flex items-center gap-0.5 flex-1 ml-0.5" onClick={(e) => e.stopPropagation()}>
              <Input
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
                className="h-5 text-[11px] flex-1 px-1"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") onRenameConfirm(); if (e.key === "Escape") onRenameCancel(); }}
              />
              <button className="p-0.5 text-green-600 hover:text-green-700" onClick={(e) => { e.stopPropagation(); onRenameConfirm(); }}><Check className="h-2.5 w-2.5" /></button>
              <button className="p-0.5 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRenameCancel(); }}><X className="h-2.5 w-2.5" /></button>
            </div>
          ) : (
            <>
              <span className="text-[11px] font-medium truncate flex-1 ml-0.5">
                {node.name}
              </span>
              <span className="text-[9px] text-muted-foreground shrink-0">
                {node.children.length}
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(node.id, node.name);
                }}
              >
                <Pencil className="h-2.5 w-2.5 text-muted-foreground hover:text-primary" />
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id, node.name);
                }}
              >
                <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
              </button>
            </>
          )}
        </div>
        {expanded &&
          node.children.map((child) => (
            <TreeItemRow
              key={child.id}
              node={child}
              indexMap={indexMap}
              onLoad={onLoad}
              onDelete={onDelete}
              onRename={onRename}
              renamingId={renamingId}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
              dragId={dragId}
              dropTargetId={dropTargetId}
              dropPos={dropPos}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  const displayIdx = indexMap.get(node.id) ?? 0;

  return (
    <div className="relative">
      {isDropTarget && dropPos === "before" && (
        <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-full z-10" />
      )}
      <div
        className={`flex items-center gap-0.5 rounded px-1 py-[3px] cursor-pointer group transition-colors ${
          isDragging ? "opacity-40" : "hover:bg-muted"
        }`}
        style={{ paddingLeft: depth * 12 + 14 }}
        draggable
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver(e, node.id, false)}
        onDrop={onDrop}
        onClick={() =>
          node.data && onLoad(node.data as Record<string, unknown>)
        }
      >
        <GripVertical className="h-2.5 w-2.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground cursor-grab" />
        <span className="text-[9px] text-muted-foreground w-3 text-right shrink-0">
          {displayIdx}
        </span>
        <FileText className="h-3 w-3 shrink-0 text-blue-500 ml-0.5" />
        {renamingId === node.id ? (
          <div className="flex items-center gap-0.5 flex-1 ml-0.5" onClick={(e) => e.stopPropagation()}>
            <Input
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              className="h-5 text-[11px] flex-1 px-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") onRenameConfirm(); if (e.key === "Escape") onRenameCancel(); }}
            />
            <button className="p-0.5 text-green-600 hover:text-green-700" onClick={(e) => { e.stopPropagation(); onRenameConfirm(); }}><Check className="h-2.5 w-2.5" /></button>
            <button className="p-0.5 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRenameCancel(); }}><X className="h-2.5 w-2.5" /></button>
          </div>
        ) : (
          <>
            <span className="text-[11px] truncate flex-1 ml-0.5">
              {node.name}
            </span>
            <span className="text-[9px] text-muted-foreground shrink-0">
              {formatDate(node.created_at)}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onRename(node.id, node.name);
              }}
            >
              <Pencil className="h-2.5 w-2.5 text-muted-foreground hover:text-primary" />
            </button>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id, node.name);
              }}
            >
              <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
            </button>
          </>
        )}
      </div>
      {isDropTarget && dropPos === "after" && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full z-10" />
      )}
    </div>
  );
}

// ─── Excel Export Helpers ─────────────────────────────────

interface FormulaLipidEntry {
  label?: string;
  lipidName?: string;
  customLipidName?: string;
  isCustomLipid?: boolean;
  molarWeight?: string;
  molarRatio?: string;
  stockConc?: string;
}

function exportFormulaSheets(
  wb: XLSX.WorkBook,
  items: LnpSavedItem[]
) {
  // Summary sheet
  const summaryRows: Record<string, string | number>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const d = (item.data ?? {}) as Record<string, unknown>;
    const entries = (d.lipidEntries ?? []) as FormulaLipidEntry[];
    const lipids = entries
      .map((e) => {
        const name = e.isCustomLipid
          ? e.customLipidName || "Custom"
          : e.lipidName || "";
        return `${name} (${e.molarRatio ?? ""}%)`;
      })
      .join(", ");
    summaryRows.push({
      "#": i + 1,
      "配方名称": item.name,
      "脂质组分": lipids,
      "组分数量": entries.length,
      "目标体积": `${d.targetVolume ?? ""} ${d.volumeUnit === "mL" ? "mL" : "µL"}`,
      "创建时间": new Date(item.created_at).toLocaleString("zh-CN"),
    });
  }
  const ws1 = XLSX.utils.json_to_sheet(summaryRows);
  ws1["!cols"] = [
    { wch: 4 },
    { wch: 20 },
    { wch: 50 },
    { wch: 8 },
    { wch: 14 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "配方汇总");

  // Detail sheet — one row per lipid component per formula
  const detailRows: Record<string, string | number>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const d = (item.data ?? {}) as Record<string, unknown>;
    const entries = (d.lipidEntries ?? []) as FormulaLipidEntry[];
    for (const e of entries) {
      detailRows.push({
        "配方名称": item.name,
        "组分类型": e.label ?? "",
        "脂质名称": e.isCustomLipid
          ? e.customLipidName || "Custom"
          : e.lipidName || "",
        "MW (g/mol)": e.molarWeight ?? "",
        "摩尔比 (%)": e.molarRatio ?? "",
        "Stock (mg/mL)": e.stockConc ?? "",
      });
    }
    // blank separator row
    if (i < items.length - 1) {
      detailRows.push({
        "配方名称": "",
        "组分类型": "",
        "脂质名称": "",
        "MW (g/mol)": "",
        "摩尔比 (%)": "",
        "Stock (mg/mL)": "",
      });
    }
  }
  const ws2 = XLSX.utils.json_to_sheet(detailRows);
  ws2["!cols"] = [
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "组分明细");
}

function exportPreparationSheets(
  wb: XLSX.WorkBook,
  items: LnpSavedItem[]
) {
  const rows: Record<string, string | number>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const d = (item.data ?? {}) as Record<string, string>;
    rows.push({
      "#": i + 1,
      "参数名称": item.name,
      "Master Mix (mM)": d.masterConc ?? "",
      "FRR (水相)": d.frrAqueous ?? "",
      "FRR (脂相)": d.frrOrganic ?? "",
      "N/P Ratio": d.npRatio ?? "",
      "RNA mass (µg)": d.rnaMass ?? "",
      "RNA conc (µg/µL)": d.rnaConc ?? "",
      "核酸类型": d.naType ?? "",
      "胺基数/分子": d.aminesPerMolecule ?? "",
      "创建时间": new Date(item.created_at).toLocaleString("zh-CN"),
    });
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 4 },
    { wch: 20 },
    { wch: 16 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "实验参数");
}
