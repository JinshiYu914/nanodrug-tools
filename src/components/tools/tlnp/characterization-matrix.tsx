"use client";

import { Link2, Loader2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  resolveEe,
  TEM_LABELS,
  type DlsResult,
  type EeResult,
  type TemFlag,
} from "@/lib/calculations/tlnp-experiment";
import type { LnpSavedItem } from "@/lib/supabase/lnp-service";

/** One measured thing — a prep sample before the column, a reaction system
 *  after it. Both carry the same result shape, so both render here. */
export interface CharacterizationRow {
  id: string;
  name: string;
  ee: EeResult;
  dls: DlsResult;
  tem: TemFlag;
  note: string;
}

export interface CharacterizationPatch {
  ee?: EeResult;
  dls?: DlsResult;
  tem?: TemFlag;
  note?: string;
}

interface Props {
  rows: CharacterizationRow[];
  onChange: (id: string, patch: CharacterizationPatch) => void;
  /** rowId → saved RiboGreen records that measured it. */
  candidates: Map<string, LnpSavedItem[]>;
  onImport: (rowId: string, record: LnpSavedItem) => void;
  recordsLoading: boolean;
  emptyHint: string;
}

const fmt = (v: number | null, digits = 2): string =>
  v === null || !isFinite(v) ? "--" : v.toFixed(digits);

/**
 * 表征结果 as one matrix: a row per sample, a column per measurement.
 *
 * The earlier layout gave each sample its own card, which read fine for one
 * sample and became a page of scrolling for eight — and comparing 包封率 across
 * a screen is the entire point of running a screen. Here the eye goes down a
 * column.
 *
 * RiboGreen cells become read-only once a saved record is linked: those numbers
 * came off a fitted curve, and letting them be typed over would leave no way to
 * tell measured from remembered.
 */
export default function CharacterizationMatrix({
  rows,
  onChange,
  candidates,
  onImport,
  recordsLoading,
  emptyHint,
}: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[62rem] border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            <th
              rowSpan={2}
              className="min-w-44 border-r px-2 py-1.5 text-left align-bottom font-medium"
            >
              样品
            </th>
            <th
              colSpan={4}
              className="border-r px-2 py-1 text-center font-medium text-pillar-utr"
            >
              RiboGreen
            </th>
            <th
              colSpan={3}
              className="border-r px-2 py-1 text-center font-medium text-pillar-lnp"
            >
              DLS
            </th>
            <th
              rowSpan={2}
              className="w-20 border-r px-2 py-1.5 text-center align-bottom font-medium"
            >
              TEM
            </th>
            <th
              rowSpan={2}
              className="min-w-40 px-2 py-1.5 text-left align-bottom font-medium"
            >
              备注
            </th>
          </tr>
          <tr className="border-b bg-muted/40 text-muted-foreground">
            <th className="w-24 px-2 py-1 text-left font-normal">浓度 ng/µL</th>
            <th className="w-20 px-2 py-1 text-left font-normal">体积 µL</th>
            <th className="w-20 px-2 py-1 text-left font-normal">包封率 %</th>
            <th className="w-20 border-r px-2 py-1 text-left font-normal">
              得率 %
            </th>
            <th className="w-20 px-2 py-1 text-left font-normal">粒径 nm</th>
            <th className="w-20 px-2 py-1 text-left font-normal">PDI</th>
            <th className="w-20 border-r px-2 py-1 text-left font-normal">
              Zeta mV
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Row
              key={row.id}
              row={row}
              index={i}
              onChange={onChange}
              candidates={candidates.get(row.id) ?? []}
              onImport={onImport}
              recordsLoading={recordsLoading}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  row,
  index,
  onChange,
  candidates,
  onImport,
  recordsLoading,
}: {
  row: CharacterizationRow;
  index: number;
  onChange: (id: string, patch: CharacterizationPatch) => void;
  candidates: LnpSavedItem[];
  onImport: (rowId: string, record: LnpSavedItem) => void;
  recordsLoading: boolean;
}) {
  const linked = row.ee.link;
  const resolved = resolveEe(row.ee);

  const setManual = (patch: Partial<EeResult["manual"]>) =>
    onChange(row.id, {
      ee: { ...row.ee, manual: { ...row.ee.manual, ...patch } },
    });

  const setDls = (patch: Partial<DlsResult>) =>
    onChange(row.id, { dls: { ...row.dls, ...patch } });

  return (
    <tr className="border-b last:border-b-0 align-top">
      <td className="border-r px-2 py-1.5">
        <p className="truncate font-medium" title={row.name}>
          {row.name || `样品 ${index + 1}`}
        </p>
        {linked ? (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-success">
            <Link2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate" title={linked.itemName}>
              {linked.itemName}
            </span>
            <button
              type="button"
              title="取消关联，改回手动填写"
              onClick={() => onChange(row.id, { ee: { ...row.ee, link: null } })}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Unlink className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              title="从原记录重新读取数值"
              onClick={() => {
                const rec = candidates.find((c) => c.id === linked.itemId);
                if (rec) onImport(row.id, rec);
                else toast.error("原记录已不存在，请重新导入");
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-2.5 w-2.5" />
            </button>
          </span>
        ) : recordsLoading ? (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            查找记录中
          </span>
        ) : candidates.length > 0 ? (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {candidates.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => onImport(row.id, rec)}
                title={`导入「${rec.name}」的检测结果`}
                className="flex max-w-full items-center gap-0.5 rounded border border-primary/40 px-1 py-0.5 text-[10px] text-primary hover:bg-primary/10"
              >
                <Link2 className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">导入 {rec.name}</span>
              </button>
            ))}
          </span>
        ) : null}
      </td>

      {linked ? (
        <>
          <Linked value={`${fmt(resolved.conc)}`} />
          <Linked value={`${fmt(resolved.volume, 1)}`} />
          <Linked value={`${fmt(resolved.ee, 1)}`} />
          <Linked value={`${fmt(resolved.yield_, 1)}`} border />
        </>
      ) : (
        <>
          <Cell
            value={row.ee.manual.conc_ng_uL}
            onChange={(v) => setManual({ conc_ng_uL: v })}
          />
          <Cell
            value={row.ee.manual.volume_uL}
            onChange={(v) => setManual({ volume_uL: v })}
          />
          <Cell
            value={row.ee.manual.ee_percent}
            onChange={(v) => setManual({ ee_percent: v })}
          />
          <Cell
            value={row.ee.manual.yield_percent}
            onChange={(v) => setManual({ yield_percent: v })}
            border
          />
        </>
      )}

      <Cell value={row.dls.size_nm} onChange={(v) => setDls({ size_nm: v })} />
      <Cell value={row.dls.pdi} onChange={(v) => setDls({ pdi: v })} />
      <Cell
        value={row.dls.zeta_mV}
        onChange={(v) => setDls({ zeta_mV: v })}
        border
      />

      <td className="border-r px-2 py-1.5 text-center">
        <select
          value={row.tem}
          onChange={(e) =>
            onChange(row.id, { tem: e.target.value as TemFlag })
          }
          className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs"
        >
          <option value="">--</option>
          <option value="yes">{TEM_LABELS.yes}</option>
          <option value="no">{TEM_LABELS.no}</option>
        </select>
      </td>

      <td className="px-2 py-1.5">
        <Input
          value={row.note}
          onChange={(e) => onChange(row.id, { note: e.target.value })}
          placeholder="例如：偏浑浊，复测一次"
          className="h-7 px-2 text-xs"
        />
      </td>
    </tr>
  );
}

function Cell({
  value,
  onChange,
  border,
}: {
  value: string;
  onChange: (v: string) => void;
  border?: boolean;
}) {
  return (
    <td className={`px-2 py-1.5 ${border ? "border-r" : ""}`}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="h-7 px-2 font-mono text-xs"
      />
    </td>
  );
}

/** A value that came off a fitted curve — shown, not editable. */
function Linked({ value, border }: { value: string; border?: boolean }) {
  return (
    <td className={`px-2 py-2.5 ${border ? "border-r" : ""}`}>
      <span className="font-mono text-xs">{value}</span>
    </td>
  );
}
