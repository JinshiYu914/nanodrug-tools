"use client";

import { useCallback, useEffect, useState } from "react";
import { BookMarked, Library, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteProtein,
  listProteins,
  saveProtein,
  type ProteinLibraryItem,
} from "@/lib/supabase/tlnp-library";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";
import {
  createProteinEntry,
  type ProteinEntry,
} from "@/lib/calculations/tlnp-experiment";
import { proteinNmolPerUL } from "@/lib/calculations/tlnp-conjugation";

const MIGRATION = "005_tlnp_libraries.sql";

interface Props {
  proteins: ProteinEntry[];
  onChange: (next: ProteinEntry[]) => void;
}

/**
 * The proteins used in this batch, and the library they can come from.
 *
 * Values are copied into the batch on pick, never referenced: the library is
 * there so a molecular weight is typed once, not so that editing it later
 * rewrites what a finished experiment says was added.
 */
export default function ProteinBench({ proteins, onChange }: Props) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<ProteinLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setLibrary(await listProteins());
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (libraryOpen) void reload();
  }, [libraryOpen, reload]);

  const patch = (id: string, next: Partial<ProteinEntry>) =>
    onChange(proteins.map((p) => (p.id === id ? { ...p, ...next } : p)));

  function add() {
    onChange([...proteins, createProteinEntry(proteins.length)]);
  }

  function remove(p: ProteinEntry) {
    if (!confirm(`从本批次移除蛋白「${p.name || "未命名"}」？`)) return;
    onChange(proteins.filter((x) => x.id !== p.id));
  }

  function use(item: ProteinLibraryItem) {
    onChange([
      ...proteins,
      {
        ...createProteinEntry(proteins.length),
        name: item.name,
        mw: item.mw,
        conc: item.conc,
        concUnit: item.concUnit,
        note: item.note,
        libraryId: item.id,
      },
    ]);
    setLibraryOpen(false);
    toast.success(`已加入「${item.name}」`);
  }

  async function saveToLibrary(p: ProteinEntry) {
    if (!p.name.trim()) {
      toast.error("请先填写蛋白名称");
      return;
    }
    try {
      const saved = await saveProtein({
        name: p.name,
        mw: p.mw,
        conc: p.conc,
        concUnit: p.concUnit,
        note: p.note,
      });
      patch(p.id, { libraryId: saved.id });
      toast.success(`已保存到蛋白库：${saved.name}`);
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  async function removeFromLibrary(item: ProteinLibraryItem) {
    if (!confirm(`从蛋白库删除「${item.name}」？已经用过它的批次不受影响。`))
      return;
    try {
      await deleteProtein(item.id);
      await reload();
      toast.success("已删除");
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, MIGRATION));
    }
  }

  return (
    <div className="space-y-3">
      {proteins.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground">
            还没有蛋白。先填一个，下面的反应体系才能算出加样体积。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={add}>
              <Plus className="h-3.5 w-3.5" />
              添加蛋白
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setLibraryOpen(true)}
            >
              <Library className="h-3.5 w-3.5" />
              从蛋白库选择
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {proteins.map((p, i) => {
              const perUL = proteinNmolPerUL(p);
              return (
                <div
                  key={p.id}
                  className="space-y-2 rounded-lg border border-accent-utility/35 bg-accent-utility-subtle p-3"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        蛋白名称
                      </Label>
                      <Input
                        value={p.name}
                        onChange={(e) => patch(p.id, { name: e.target.value })}
                        placeholder={`蛋白 ${i + 1}，例如 anti-CD3 scFv`}
                        className="h-7 px-2 text-xs"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 pt-5">
                      <button
                        type="button"
                        title={
                          p.libraryId
                            ? "再次保存为蛋白库中的新条目"
                            : "保存到蛋白库，其他批次可直接选用"
                        }
                        onClick={() => void saveToLibrary(p)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {p.libraryId ? (
                          <BookMarked className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        title="从本批次移除"
                        onClick={() => remove(p)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        分子量 (Da)
                      </Label>
                      <Input
                        value={p.mw}
                        onChange={(e) => patch(p.id, { mw: e.target.value })}
                        inputMode="decimal"
                        placeholder="50000"
                        className="h-7 px-2 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        浓度
                      </Label>
                      <Input
                        value={p.conc}
                        onChange={(e) => patch(p.id, { conc: e.target.value })}
                        inputMode="decimal"
                        placeholder="1"
                        className="h-7 px-2 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        单位
                      </Label>
                      <select
                        value={p.concUnit}
                        onChange={(e) =>
                          patch(p.id, {
                            concUnit: e.target.value as ProteinEntry["concUnit"],
                          })
                        }
                        className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs"
                      >
                        <option value="mg_per_mL">mg/mL</option>
                        <option value="uM">µM</option>
                      </select>
                    </div>
                  </div>

                  <p className="font-mono text-[11px] text-muted-foreground">
                    {perUL === null
                      ? "填入分子量与浓度后显示 nmol/µL"
                      : `${perUL.toFixed(4)} nmol/µL`}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={add}
            >
              <Plus className="h-3.5 w-3.5" />
              添加蛋白
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setLibraryOpen(true)}
            >
              <Library className="h-3.5 w-3.5" />
              从蛋白库选择
            </Button>
          </div>
        </>
      )}

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>我的蛋白库</DialogTitle>
            <DialogDescription>
              所有实验批次共用。选用后数值会复制进本批次，之后修改库里的条目不会改动已记录的实验。
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-1.5 overflow-y-auto rounded-md border p-2">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中...
              </p>
            ) : library.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                蛋白库还是空的 —— 在上面填好一个蛋白，点保存图标即可存入。
              </p>
            ) : (
              library.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {item.mw || "--"} Da · {item.conc || "--"}{" "}
                      {item.concUnit === "uM" ? "µM" : "mg/mL"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-xs"
                    onClick={() => use(item)}
                  >
                    选用
                  </Button>
                  <button
                    type="button"
                    title="从蛋白库删除"
                    onClick={() => void removeFromLibrary(item)}
                    className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLibraryOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
