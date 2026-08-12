"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteIvtTemplate,
  listIvtTemplates,
  saveIvtTemplate,
  type IvtTemplateItem,
} from "@/lib/supabase/ivt-service";
import {
  type IvtTemplateKind,
  type IvtTemplatePayload,
} from "@/lib/calculations/ivt-experiment";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";

interface Props {
  kind: IvtTemplateKind;
  buildPayload: () => IvtTemplatePayload;
  onApply: (template: IvtTemplateItem) => void;
}

export default function TemplateBar({ kind, buildPayload, onApply }: Props) {
  const [templates, setTemplates] = useState<IvtTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const saveLabel =
    kind === "purification" ? "保存当前纯化方法为模板" : "保存当前体系为模板";

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await listIvtTemplates(kind));
    } catch (error) {
      toast.error(describeError(error, "006_ivt_mrna.sql"));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => void reload(), [reload]);

  async function saveCurrent() {
    const label = name.trim();
    if (!label) {
      toast.error("请填写模板名称");
      return;
    }
    try {
      await saveIvtTemplate(label, buildPayload());
      setName("");
      setNaming(false);
      await reload();
      toast.success(`已保存模板「${label}」`);
    } catch (error) {
      toast.error(describeError(error, "006_ivt_mrna.sql"));
    }
  }

  async function remove(template: IvtTemplateItem) {
    if (!window.confirm(`删除模板「${template.name}」？`)) return;
    try {
      await deleteIvtTemplate(template.id);
      await reload();
      toast.success("模板已删除");
    } catch (error) {
      toast.error(describeError(error, "006_ivt_mrna.sql"));
    }
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/35 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">我的模板</span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : templates.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">暂无已保存模板</span>
        ) : (
          templates.map((template) => (
            <span key={template.id} className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-0.5">
              <button
                type="button"
                onClick={() => {
                  onApply(template);
                  toast.success(`已套用「${template.name}」`);
                }}
                className="text-xs hover:text-primary"
              >
                {template.name}
              </button>
              <button
                type="button"
                title="删除模板"
                onClick={() => void remove(template)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {naming ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveCurrent();
              if (event.key === "Escape") {
                setName("");
                setNaming(false);
              }
            }}
            placeholder="输入模板名称"
            autoFocus
            className="h-7 max-w-56 px-2 text-xs"
          />
          <Button size="sm" className="h-7 text-xs" onClick={() => void saveCurrent()}>
            保存
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              setName("");
              setNaming(false);
            }}
          >
            取消
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-[11px]"
          onClick={() => setNaming(true)}
        >
          <Save className="h-3 w-3" />
          {saveLabel}
        </Button>
      )}
    </div>
  );
}
