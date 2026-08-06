"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createChromatogram,
  parseChromatogramCsv,
  parseChromatogramTable,
  type ParsedChromatogram,
} from "@/lib/calculations/chromatogram";
import type { Chromatogram } from "@/lib/calculations/tlnp-experiment";

const EXAMPLE = `体积 (mL)\tA260\tA280
0.0\t0.012\t0.008
0.5\t0.031\t0.019
1.0\t0.874\t0.402`;

interface Props {
  onImport: (c: Chromatogram) => void;
}

/**
 * Two ways in, same shape out: paste a block straight from Excel, or upload the
 * CSV the instrument wrote. The format explanation is on the page rather than
 * in a doc, because this is the one place a user has to match a shape.
 */
export default function ChromatogramImport({ onImport }: Props) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function accept(
    parsed: ParsedChromatogram,
    source: "paste" | "csv",
    sourceName: string
  ) {
    setWarnings(parsed.warnings);
    if (parsed.points.length === 0) {
      toast.error(parsed.warnings[0] ?? "没有解析出数据");
      return;
    }
    onImport(
      createChromatogram(
        parsed,
        name.trim() || sourceName || "层析图",
        source,
        sourceName
      )
    );
    setText("");
    setName("");
    toast.success(
      `已导入 ${parsed.points.length} 个数据点、${parsed.channels.length} 个通道`
    );
  }

  function importPaste() {
    if (!text.trim()) {
      toast.error("请先粘贴数据");
      return;
    }
    accept(parseChromatogramTable(text), "paste", "粘贴导入");
  }

  async function importFile(file: File) {
    try {
      const content = await file.text();
      accept(parseChromatogramCsv(content), "csv", file.name);
    } catch (e) {
      console.error(e);
      toast.error("读取文件失败");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1 rounded-md border border-info/35 bg-info-subtle p-3">
        <p className="text-xs font-medium">数据格式</p>
        <p className="text-xs text-muted-foreground">
          第一列是体积或时间，其余每一列是一个检测通道（例如 A260、A280）。
          第一行可以是表头 —— 会用作坐标轴和通道名称；没有表头也能导入。
        </p>
        <pre className="mt-1 overflow-x-auto rounded bg-card/60 p-2 font-mono text-[11px] leading-relaxed">
          {EXAMPLE}
        </pre>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          层析图名称（可选）
        </Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如 CL4B-tLNP-A"
          className="h-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          从 Excel 复制后粘贴到这里
        </Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="体积&#9;A260&#9;A280&#10;0.0&#9;0.012&#9;0.008"
          className="min-h-28 font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={importPaste}>
          <ClipboardPaste className="h-3.5 w-3.5" />
          导入粘贴的数据
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          上传 CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = "";
          }}
        />
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
