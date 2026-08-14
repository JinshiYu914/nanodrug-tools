"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
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

const EXAMPLE = `UV1-280280(mAu)\t\t\t\tUV2-260260(mAu)\t\t\t\tFracMark(mAu)
min\tmL\tCV\t\tmin\tmL\tCV\t\tmin\tmL\tCV\t
0.01\t0.01\t0.0005\t-0.066\t0.01\t0.01\t0.0005\t0.133\t23.46\t23.46\t1.17\t1E06`;

interface Props {
  /** Prefilled when editing an existing run rather than adding a new one. */
  initialText?: string;
  initialName?: string;
  onImport: (
    parsed: ParsedChromatogram,
    name: string,
    rawText: string,
    source?: "paste" | "csv",
    sourceName?: string
  ) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function importFile(file: File) {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("文件中没有工作表");
      const rawText = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: "\t" });
      const parsed = parseChromatogramTable(rawText);
      setWarnings(parsed.warnings);
      if (parsed.points.length === 0) {
        toast.error(parsed.warnings[0] ?? "没有解析出数据");
        return;
      }
      const fileName = file.name.replace(/\.[^.]+$/, "");
      setText(rawText);
      if (!name.trim()) setName(fileName);
      onImport(parsed, name.trim() || fileName || "层析图", rawText, "csv", file.name);
      toast.success(
        `已导入 ${parsed.points.length} 个数据点${parsed.fractionMarks.length > 0 ? `、${parsed.fractionMarks.length} 个 Fraction Mark` : ""}`
      );
    } catch (error) {
      console.error(error);
      toast.error("文件读取失败，请确认是 Excel、CSV 或 TSV 文件");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1 rounded-md border border-info/35 bg-info-subtle p-3">
        <p className="text-xs font-medium">粘贴格式</p>
        <p className="text-xs text-muted-foreground">
          可直接粘贴 ÄKTA/Excel 的完整 12 列数据：第 2 列 mL、第 4 列 A280、
          第 8 列 A260、第 10 列 fraction mL、第 12 列 mark。完整格式会同时保留
          min / mL / CV 三套横轴。旧的三列格式仍兼容，通道默认命名为{" "}
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
          placeholder="从 Excel 复制完整 12 列 SEC 数据后粘贴到这里"
          className="max-h-64 min-h-28 overflow-y-auto font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={submit}>
          <ClipboardPaste className="h-3.5 w-3.5" />
          {submitLabel}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.txt"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          导入 Excel / CSV
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
