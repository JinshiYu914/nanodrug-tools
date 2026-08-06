"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createObservationRow,
  type ObservationRow,
} from "@/lib/calculations/tlnp-experiment";

const TURBIDITY: { key: ObservationRow["turbidity"]; label: string }[] = [
  { key: "", label: "--" },
  { key: "clear", label: "澄清" },
  { key: "slight", label: "微浑" },
  { key: "turbid", label: "浑浊" },
];

const PRECIPITATE: { key: ObservationRow["precipitate"]; label: string }[] = [
  { key: "", label: "--" },
  { key: "none", label: "无沉淀" },
  { key: "slight", label: "少量" },
  { key: "heavy", label: "大量" },
];

/** 浑浊 and 大量沉淀 are the readings that mean something went wrong. */
function isBad(r: ObservationRow): boolean {
  return r.turbidity === "turbid" || r.precipitate === "heavy";
}

interface Props {
  rows: ObservationRow[];
  onChange: (next: ObservationRow[]) => void;
  /** Product id → display name, for the 产物 dropdown. */
  products: { id: string; name: string }[];
}

/** 肉眼观测 for the unpurified tLNP — turbidity and precipitate per product. */
export default function ObservationTable({ rows, onChange, products }: Props) {
  const patch = (id: string, next: Partial<ObservationRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...next } : r)));

  if (rows.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed py-8 text-center">
        <p className="text-sm text-muted-foreground">
          反应结束后，在这里记录每个 tLNP 的肉眼观测。
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onChange([createObservationRow()])}
        >
          <Plus className="h-3.5 w-3.5" />
          添加观测记录
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[40rem] border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="min-w-40 px-2 py-2 text-left font-medium">产物</th>
              <th className="w-28 px-2 py-2 text-left font-medium">浑浊度</th>
              <th className="w-28 px-2 py-2 text-left font-medium">沉淀</th>
              <th className="px-2 py-2 text-left font-medium">备注</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b last:border-b-0 ${
                  isBad(r) ? "bg-warning-subtle" : ""
                }`}
              >
                <td className="px-2 py-1.5">
                  <select
                    value={r.productId}
                    onChange={(e) => patch(r.id, { productId: e.target.value })}
                    className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm"
                  >
                    <option value="">（未关联）</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={r.turbidity}
                    onChange={(e) =>
                      patch(r.id, {
                        turbidity: e.target.value as ObservationRow["turbidity"],
                      })
                    }
                    className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm"
                  >
                    {TURBIDITY.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={r.precipitate}
                    onChange={(e) =>
                      patch(r.id, {
                        precipitate: e.target
                          .value as ObservationRow["precipitate"],
                      })
                    }
                    className="flex h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs shadow-sm"
                  >
                    {PRECIPITATE.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    value={r.note}
                    onChange={(e) => patch(r.id, { note: e.target.value })}
                    placeholder="例如 静置 1 h 后底部有絮状物"
                    className="h-7 text-xs"
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                    title="删除该行"
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => onChange([...rows, createObservationRow()])}
      >
        <Plus className="h-3.5 w-3.5" />
        添加一行
      </Button>
    </div>
  );
}
