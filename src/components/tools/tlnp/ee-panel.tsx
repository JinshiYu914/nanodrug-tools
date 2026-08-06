"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Link2, Loader2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  collectLinkedFormulationIds,
  computeBatch,
  parseResultData,
} from "@/lib/calculations/ribogreen";
import {
  resolveEe,
  type EeResult,
  type RibogreenLink,
} from "@/lib/calculations/tlnp-experiment";
import { listAllItems, type LnpSavedItem } from "@/lib/supabase/lnp-service";

/**
 * Pull the key numbers for one sample out of a saved RiboGreen record.
 *
 * Always refits from the stored curve rather than trusting the record's cached
 * fit — that snapshot is documented as advisory only.
 */
function extractLink(
  row: LnpSavedItem,
  sampleId: string
): RibogreenLink | null {
  const parsed = parseResultData(row.data);
  if (!parsed) return null;
  const source = parsed.rows.find((r) => r.sourceFormulationId === sampleId);
  if (!source) return null;

  const batch = computeBatch({
    rows: parsed.rows,
    curves: parsed.curves,
    correction: parsed.correction,
  });
  // Matched by id rather than by position: computeBatch is index-aligned today,
  // but silently importing another sample's numbers is the worst way to find
  // out that ever changed.
  const computed = batch.samples.find((s) => s.id === source.id);
  if (!computed) return null;

  return {
    itemId: row.id,
    itemName: row.name,
    sampleId,
    sampleName: source.name,
    capturedAt: new Date().toISOString(),
    snapshot: {
      total_ng_uL: computed.total_ng_uL,
      lnpRna_ng_uL: computed.lnpRna_ng_uL,
      ee_percent: computed.ee_percent,
      yield_percent: computed.yield_percent,
      lnpVolume_uL: computed.sampleVolume_uL,
    },
  };
}

/** sampleId → the saved RiboGreen records that measured it. */
export function useRibogreenRecords(enabled: boolean) {
  const [map, setMap] = useState<Map<string, LnpSavedItem[]>>(() => new Map());
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const rows = await listAllItems("ribogreen_result");
      const next = new Map<string, LnpSavedItem[]>();
      for (const row of rows) {
        for (const fid of collectLinkedFormulationIds(row.data)) {
          const list = next.get(fid);
          if (list) list.push(row);
          else next.set(fid, [row]);
        }
      }
      setMap(next);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { records: map, loading, reload };
}

const fmt = (v: number | null, digits = 2): string =>
  v === null || !isFinite(v) ? "--" : v.toFixed(digits);

interface Props {
  sampleId: string;
  value: EeResult;
  onChange: (next: EeResult) => void;
  /** From useRibogreenRecords — records that reference this sample. */
  candidates: LnpSavedItem[];
  onRefreshRecords: () => void;
  recordsLoading: boolean;
}

/**
 * RiboGreen 包封率 for one sample — 浓度 / 体积 / 包封率 / 得率, nothing else.
 *
 * Deliberately not a second RiboGreen calculator. The curve editor and the
 * 96-column grid live in the LNP Calculator; this panel either imports the key
 * results from a saved record or takes four hand-typed numbers. `resolveEe`
 * decides which wins so the display and every export agree.
 */
export default function EePanel({
  sampleId,
  value,
  onChange,
  candidates,
  onRefreshRecords,
  recordsLoading,
}: Props) {
  const [importing, setImporting] = useState(false);
  const resolved = useMemo(() => resolveEe(value), [value]);

  async function importFrom(row: LnpSavedItem) {
    setImporting(true);
    try {
      const link = extractLink(row, sampleId);
      if (!link) {
        toast.error("该记录里找不到这个样品的读数");
        return;
      }
      onChange({ ...value, link });
      toast.success(`已导入「${row.name}」的检测结果`);
    } catch (e) {
      console.error(e);
      toast.error("导入失败");
    } finally {
      setImporting(false);
    }
  }

  const setManual = (patch: Partial<EeResult["manual"]>) =>
    onChange({ ...value, manual: { ...value.manual, ...patch } });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">RiboGreen 包封率</span>
        {value.link ? (
          <span className="flex items-center gap-1 rounded border border-success/35 bg-success-subtle px-1.5 py-0.5 text-[11px] text-success">
            <Link2 className="h-3 w-3" />
            已关联 {value.link.itemName}
          </span>
        ) : candidates.length > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            找到 {candidates.length} 条相关记录
          </span>
        ) : null}
        <button
          type="button"
          onClick={onRefreshRecords}
          title="重新查找关联的 RiboGreen 记录"
          className="ml-auto text-muted-foreground hover:text-foreground"
          disabled={recordsLoading}
        >
          {recordsLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {value.link ? (
        <div className="space-y-2 rounded-md bg-muted/40 p-2.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
            <Metric label="浓度" value={`${fmt(resolved.conc)} ng/µL`} />
            <Metric label="体积" value={`${fmt(resolved.volume, 1)} µL`} />
            <Metric label="包封率" value={`${fmt(resolved.ee, 1)} %`} />
            <Metric label="得率" value={`${fmt(resolved.yield_, 1)} %`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 text-[11px]"
              onClick={() => {
                const row = candidates.find((c) => c.id === value.link?.itemId);
                if (row) void importFrom(row);
                else toast.error("原记录已不存在，请重新导入");
              }}
              disabled={importing}
            >
              <RefreshCw className="h-3 w-3" />
              刷新数值
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 gap-1 text-[11px]"
              onClick={() => onChange({ ...value, link: null })}
            >
              <Unlink className="h-3 w-3" />
              取消关联
            </Button>
            <Link
              href="/tools/lnp-formula"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" />
              打开完整记录
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((row) => (
                <Button
                  key={row.id}
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => void importFrom(row)}
                  disabled={importing}
                >
                  <Link2 className="h-3 w-3" />
                  导入「{row.name}」
                </Button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ManualField
              label="浓度 (ng/µL)"
              value={value.manual.conc_ng_uL}
              onChange={(v) => setManual({ conc_ng_uL: v })}
            />
            <ManualField
              label="体积 (µL)"
              value={value.manual.volume_uL}
              onChange={(v) => setManual({ volume_uL: v })}
            />
            <ManualField
              label="包封率 (%)"
              value={value.manual.ee_percent}
              onChange={(v) => setManual({ ee_percent: v })}
            />
            <ManualField
              label="得率 (%)"
              value={value.manual.yield_percent}
              onChange={(v) => setManual({ yield_percent: v })}
            />
          </div>

          {candidates.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              想自动带入？在{" "}
              <Link href="/tools/lnp-formula" className="text-primary underline">
                RiboGreen 标签页
              </Link>{" "}
              用「从配方载入样本名」选中本批次的样品，测完保存即可。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-xs">{value}</p>
    </div>
  );
}

function ManualField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="h-7 font-mono text-xs"
      />
    </div>
  );
}
