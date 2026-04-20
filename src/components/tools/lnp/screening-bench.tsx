"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Play,
  FileDown,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  composeLipidSummary,
  composeRatioSummary,
  computeBenchFormulation,
  generateFormulationId,
  type BenchFormulation,
} from "@/lib/calculations/lnp-bench";
import { formatVolume } from "@/lib/calculations/lnp-formula";

interface Props {
  formulations: BenchFormulation[];
  onChange: (next: BenchFormulation[]) => void;
  activeEditingId: string | null;
  onLoad: (f: BenchFormulation) => void;
  onExportPdf?: () => void;
  onExportXlsx?: () => void;
  busy?: boolean;
}

export default function ScreeningBench({
  formulations,
  onChange,
  activeEditingId,
  onLoad,
  onExportPdf,
  onExportXlsx,
  busy,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const ids = useMemo(() => formulations.map((f) => f.id), [formulations]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = formulations.findIndex((f) => f.id === active.id);
    const newIdx = formulations.findIndex((f) => f.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onChange(arrayMove(formulations, oldIdx, newIdx));
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === formulations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(formulations.map((f) => f.id)));
    }
  }

  function deleteOne(id: string) {
    if (!confirm("删除此配方？")) return;
    onChange(formulations.filter((f) => f.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`删除选中的 ${selected.size} 个配方？`)) return;
    onChange(formulations.filter((f) => !selected.has(f.id)));
    setSelected(new Set());
  }

  function duplicateOne(id: string) {
    const src = formulations.find((f) => f.id === id);
    if (!src) return;
    const copy: BenchFormulation = {
      ...src,
      id: generateFormulationId(),
      name: `${src.name} (副本)`,
      createdAt: new Date().toISOString(),
    };
    const idx = formulations.findIndex((f) => f.id === id);
    const next = [...formulations];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  }

  function renameOne(id: string, name: string) {
    if (!name.trim()) return;
    onChange(
      formulations.map((f) =>
        f.id === id ? { ...f, name: name.trim() } : f
      )
    );
    setRenamingId(null);
  }

  const allSelected =
    formulations.length > 0 && selected.size === formulations.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="h-3.5 w-3.5 accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `已选 ${selected.size} / ${formulations.length}`
              : `共 ${formulations.length} 个配方`}
          </span>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={deleteSelected}
              className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              批量删除
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onExportPdf}
            disabled={busy || formulations.length === 0 || !onExportPdf}
            className="h-7 gap-1.5 text-xs"
          >
            <FileDown className="h-3.5 w-3.5" />
            导出 PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onExportXlsx}
            disabled={busy || formulations.length === 0 || !onExportXlsx}
            className="h-7 gap-1.5 text-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            导出 Excel
          </Button>
        </div>
      </div>

      {formulations.length === 0 ? (
        <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          尚未加入配方。编辑上方工作区后点击「加入实验台」。
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ids}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {formulations.map((f, i) => (
                <FormulationCard
                  key={f.id}
                  index={i + 1}
                  f={f}
                  isActive={f.id === activeEditingId}
                  isSelected={selected.has(f.id)}
                  isRenaming={renamingId === f.id}
                  onToggleSelect={() => toggleSelected(f.id)}
                  onLoad={() => onLoad(f)}
                  onStartRename={() => setRenamingId(f.id)}
                  onRename={(name) => renameOne(f.id, name)}
                  onCancelRename={() => setRenamingId(null)}
                  onDuplicate={() => duplicateOne(f.id)}
                  onDelete={() => deleteOne(f.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ─── Formulation card ──────────────────────────────────────

function FormulationCard({
  index,
  f,
  isActive,
  isSelected,
  isRenaming,
  onToggleSelect,
  onLoad,
  onStartRename,
  onRename,
  onCancelRename,
  onDuplicate,
  onDelete,
}: {
  index: number;
  f: BenchFormulation;
  isActive: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  onToggleSelect: () => void;
  onLoad: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: f.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const computed = useMemo(() => computeBenchFormulation(f), [f]);
  const [renameValue, setRenameValue] = useState(f.name);

  const ionizable = f.lipidEntries.find((e) => e.typeKey === "ionizable");
  const isIonizableCustom =
    !ionizable || ionizable.isCustomLipid;
  const amines = isIonizableCustom
    ? parseFloat(f.prep.aminesPerMolecule || "1") || 1
    : 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card transition-colors ${
        isActive
          ? "border-primary ring-1 ring-primary/30"
          : "hover:border-muted-foreground/30"
      }`}
    >
      <div className="flex items-stretch gap-2 px-3 py-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex shrink-0 items-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          title="拖动排序"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Checkbox */}
        <label className="flex shrink-0 items-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-3.5 w-3.5 accent-primary"
          />
        </label>

        {/* Body: 2 rows */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Row 1: name + composition summary + params */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
              {index}
            </span>

            {isRenaming ? (
              <Input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => onRename(renameValue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRename(renameValue);
                  else if (e.key === "Escape") onCancelRename();
                }}
                className="h-6 w-48 text-sm"
              />
            ) : (
              <button
                onClick={onStartRename}
                className="font-semibold truncate hover:text-primary"
                title="点击重命名"
              >
                {f.name || "(未命名)"}
              </button>
            )}

            <span className="text-xs text-muted-foreground truncate">
              {composeLipidSummary(f)}{" "}
              <span className="text-[10px]">
                ({composeRatioSummary(f)})
              </span>
            </span>

            <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
              <span>
                N/P{" "}
                <span className="font-mono text-foreground">
                  {f.prep.npRatio || "-"}
                </span>
              </span>
              <span>
                {f.prep.masterConc || "-"} mM
              </span>
              <span>
                RNA{" "}
                <span className="font-mono text-foreground">
                  {f.prep.rnaMass || "-"} µg
                </span>
              </span>
              {isIonizableCustom && ionizable && (
                <span>胺/mol {amines}</span>
              )}
            </span>
          </div>

          {/* Row 2: aspirate volumes */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="w-5 shrink-0" />
            <span className="font-medium text-foreground">
              Lipid mix {formatVolume(computed.requiredLipidMix_uL)}
            </span>
            <span>→</span>
            {f.lipidEntries.map((e) => {
              const v = computed.stockVolumes?.[e.id];
              const short = e.isCustomLipid ? e.customLipidName : e.lipidName;
              return (
                <span key={e.id} className="font-mono">
                  {short || "?"}{" "}
                  <span className="text-foreground">
                    {v ? formatVolume(v.uL) : "--"}
                  </span>
                </span>
              );
            })}
            <span className="mx-1">·</span>
            <span>
              水相{" "}
              <span className="font-mono text-foreground">
                {formatVolume(computed.prepVolumes.aqueousTotal_uL)}
              </span>
              {computed.prepVolumes.rnaVolume_uL !== null && (
                <span className="text-[10px]">
                  {" "}
                  (RNA {formatVolume(computed.prepVolumes.rnaVolume_uL)} +
                  CB {formatVolume(computed.prepVolumes.cbBuffer_uL)})
                </span>
              )}
            </span>
            <span>
              脂相{" "}
              <span className="font-mono text-foreground">
                {formatVolume(computed.prepVolumes.organicTotal_uL)}
              </span>
              {computed.prepVolumes.ethanol_uL !== null && (
                <span className="text-[10px]">
                  {" "}
                  (EtOH {formatVolume(computed.prepVolumes.ethanol_uL)})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onLoad}
            title="载入到工作区编辑"
          >
            {isActive ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
                title="更多"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onSelect={onStartRename}>
                <Pencil className="h-3.5 w-3.5" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy className="h-3.5 w-3.5" />
                复制
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active editing indicator */}
      {isActive && (
        <>
          <Separator />
          <p className="px-3 py-1.5 text-[10px] text-primary">
            当前正在编辑此配方。修改后点击「更新实验台」保存。
          </p>
        </>
      )}
    </div>
  );
}
