"use client";

import { useState } from "react";
import { AlertTriangle, ClipboardPaste, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_CHANNEL_LABELS,
  parseChromatogramTable,
  type ParsedChromatogram,
} from "@/lib/calculations/chromatogram";

const EXAMPLE = `体积 (mL)\tA280\tA260
0.0\t0.008\t0.012
0.5\t0.019\t0.031
1.0\t0.402\t0.874`;

interface Props {
  /** Prefilled when editing an existing run rather than adding a new one. */
  initialText?: string;
  initialName?: string;
  onImport: (parsed: ParsedChromatogram, name: string, rawText: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

/**
 * The chromatogram paste box.
 *
 * Paste only, deliberately: the data comes out of the instrument's own export,
 * and a file picker was one more step for a shape that copies fine.
 *
 * The textarea is capped and scrolls internally. shadcn's Textarea carries
 * `field-sizing-content`, so without a max height a thousand-row run stretches
 * the box down the page and the whole document has to be scrolled to reach the
 * import button.
 */
export default function ChromatogramImport({
  initialText = "",
  initialName = "",
  onImport,
  onCancel,
  submitLabel = "导入粘贴的数据",
}: Props) {
  const [text, setText] = useState(initialText);
  const [name, setName] = useState(initialName);
  const [warnings, setWarnings] = useState<string[]>([]);

  const lineCount = text.trim() === "" ? 0 : text.trim().split(/\n/).length;

  function submit() {
    if (!text.trim()) {
      toast.error("请先粘贴数据");
      return;
    }
    const parsed = parseChromatogramTable(text);
    setWarnings(parsed.warnings);
    if (parsed.points.length === 0) {
      toast.error(parsed.warnings[0] ?? "没有解析出数据");
      return;
    }
    onImport(parsed, name.trim() || "层析图", text);
    toast.success(
      `已导入 ${parsed.points.length} 个数据点、${parsed.channels.length} 个通道`
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1 rounded-md border border-info/35 bg-info-subtle p-3">
        <p className="text-xs font-medium">粘贴格式</p>
        <p className="text-xs text-muted-foreground">
          按 <span className="font-mono">体积 / CV</span> →{" "}
          <span className="font-mono">A280</span> →{" "}
          <span className="font-mono">A260</span> 的顺序，每行一个数据点。
          第一行可以是表头（会用作坐标轴和通道名称）；没有表头时按上面的顺序命名为{" "}
          {DEFAULT_CHANNEL_LABELS.join(" / ")}。
        </p>
        <pre className="mt-1 overflow-x-auto rounded bg-card/60 p-2 font-mono text-[11px] leading-relaxed">
          {EXAMPLE}
        </pre>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">层析图名称（可选）</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如 CL4B-tLNP-A"
          className="h-8 px-2 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label className="text-xs text-muted-foreground">
            从仪器导出或 Excel 复制后粘贴到这里
          </Label>
          {lineCount > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {lineCount} 行
            </span>
          )}
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="体积&#9;A280&#9;A260&#10;0.0&#9;0.008&#9;0.012"
          className="max-h-64 min-h-28 overflow-y-auto font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={submit}>
          <ClipboardPaste className="h-3.5 w-3.5" />
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
            取消
          </Button>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w) => (
            <p
              key={w}
              className="flex items-start gap-1 rounded border border-warning/35 bg-warning-subtle px-2 py-1 text-[11px] text-warning"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
