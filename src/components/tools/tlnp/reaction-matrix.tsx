"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { genId } from "@/lib/calculations/ribogreen";
import {
  createReactionSystem,
  sampleIonizablePercent,
  sampleLinkerPercent,
  systemFromSample,
  type ProteinEntry,
  type ReactionSystem,
  type TlnpPrepSample,
} from "@/lib/calculations/tlnp-experiment";
import { linkerNmolPerUgRna } from "@/lib/calculations/tlnp-conjugation";

interface Props {
  systems: ReactionSystem[];
  onChange: (next: ReactionSystem[]) => void;
  samples: TlnpPrepSample[];
  proteins: ProteinEntry[];
}

const TEMPERATURES = ["4 °C", "室温", "25 °C", "37 °C"];
const DURATIONS = ["30 min", "1 h", "2 h", "4 h", "过夜"];
const SHAKING = ["静置", "300 rpm", "500 rpm", "800 rpm", "翻转混匀"];

/**
 * The reaction matrix: one column per 反应体系, one row per condition.
 *
 * Replaces the drag-to-connect canvas. Conjugation is a factorial in practice —
 * the same LNPs against a couple of ratios — and a grid both reads and edits
 * that faster than a graph, with each column standing on its own as one tube.
 *
 * Columns are seeded from the prepared samples, carrying concentration, volume
 * and linker mol % across, but every field stays editable so an LNP from
 * another batch can be typed in too.
 */
export default function ReactionMatrix({
  systems,
  onChange,
  samples,
  proteins,
}: Props) {
  const patch = (id: string, next: Partial<ReactionSystem>) =>
    onChange(systems.map((s) => (s.id === id ? { ...s, ...next } : s)));

  /** Re-point a column at a prepared sample, pulling its numbers over. */
  function pickSample(system: ReactionSystem, sampleId: string) {
    if (!sampleId) {
      patch(system.id, { sampleId: "", lnpName: "" });
      return;
    }
    const sample = samples.find((s) => s.id === sampleId);
    if (!sample) return;
    const seeded = systemFromSample(sample, 0);
    patch(system.id, {
      sampleId,
      lnpName: seeded.lnpName,
      lnpConc: seeded.lnpConc || system.lnpConc,
      lnpVolume: seeded.lnpVolume || system.lnpVolume,
      linkerPercent: sampleLinkerPercent(sample) || system.linkerPercent,
      basis: {
        npRatio: sample.prep.npRatio,
        ionizablePercent:
          sampleIonizablePercent(sample) || system.basis.ionizablePercent,
        aminesPerMolecule: seeded.basis.aminesPerMolecule,
      },
    });
  }

  function addFromSample(sample: TlnpPrepSample) {
    onChange([...systems, systemFromSample(sample, systems.length)]);
  }

  function addBlank() {
    onChange([...systems, createReactionSystem(systems.length)]);
  }

  function duplicate(s: ReactionSystem) {
    const copy = {
      ...s,
      id: genId(),
      name: `${s.name || "体系"} (副本)`,
      basis: { ...s.basis },
    };
    const at = systems.findIndex((x) => x.id === s.id);
    onChange([...systems.slice(0, at + 1), copy, ...systems.slice(at + 1)]);
  }

  function remove(s: ReactionSystem) {
    if (!confirm(`删除反应体系「${s.name || "未命名"}」？`)) return;
    onChange(systems.filter((x) => x.id !== s.id));
  }

  /** Prepared samples that don't have a column yet. */
  const unused = samples.filter(
    (s) => !systems.some((sys) => sys.sampleId === s.id)
  );

  if (systems.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {samples.length > 0
            ? "还没有反应体系。可以直接用上一步制备好的 LNP 建立。"
            : "还没有反应体系。「LNP 制备」里加了样品后可以一键带过来，也可以手动新建。"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {samples.length > 0 && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => onChange(samples.map(systemFromSample))}
            >
              <Plus className="h-3.5 w-3.5" />
              用全部 {samples.length} 个样品建立
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={addBlank}
          >
            <Plus className="h-3.5 w-3.5" />
            手动新建体系
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 w-36 border-r bg-muted px-2 py-2 text-left font-medium">
                反应体系
              </th>
              {systems.map((s, i) => (
                <th key={s.id} className="min-w-44 border-r px-2 py-1.5 last:border-r-0">
                  <div className="flex items-center gap-1">
                    <Input
                      value={s.name}
                      onChange={(e) => patch(s.id, { name: e.target.value })}
                      placeholder={`体系 ${i + 1}`}
                      className="h-7 px-2 text-xs font-medium"
                    />
                    <button
                      type="button"
                      title="复制该体系"
                      onClick={() => duplicate(s)}
                      className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="删除该体系"
                      onClick={() => remove(s)}
                      className="shrink-0 p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="LNP 来源">
              {systems.map((s) => (
                <Cell key={s.id}>
                  <select
                    value={s.sampleId}
                    onChange={(e) => pickSample(s, e.target.value)}
                    className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs"
                  >
                    <option value="">手动输入</option>
                    {samples.map((sample, i) => (
                      <option key={sample.id} value={sample.id}>
                        {sample.name || `样品 ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </Cell>
              ))}
            </Row>

            <Row label="LNP 浓度 (ng/µL)">
              {systems.map((s) => (
                <Cell key={s.id}>
                  <NumInput
                    value={s.lnpConc}
                    onChange={(v) => patch(s.id, { lnpConc: v })}
                  />
                </Cell>
              ))}
            </Row>

            <Row label="LNP 体积 (µL)">
              {systems.map((s) => (
                <Cell key={s.id}>
                  <NumInput
                    value={s.lnpVolume}
                    onChange={(v) => patch(s.id, { lnpVolume: v })}
                  />
                </Cell>
              ))}
            </Row>

            <Row label="Linker 比例 (mol %)">
              {systems.map((s) => {
                const perUg = linkerNmolPerUgRna(s.basis, s.linkerPercent);
                return (
                  <Cell key={s.id}>
                    <NumInput
                      value={s.linkerPercent}
                      onChange={(v) => patch(s.id, { linkerPercent: v })}
                    />
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {perUg === null
                        ? "--"
                        : `${perUg.toFixed(3)} nmol linker/µg RNA`}
                    </p>
                  </Cell>
                );
              })}
            </Row>

            <Row label="蛋白">
              {systems.map((s) => (
                <Cell key={s.id}>
                  <select
                    value={s.proteinId}
                    onChange={(e) => patch(s.id, { proteinId: e.target.value })}
                    className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs"
                  >
                    <option value="">未选择</option>
                    {proteins.map((p, i) => (
                      <option key={p.id} value={p.id}>
                        {p.name || `蛋白 ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </Cell>
              ))}
            </Row>

            <Row label="linker : 蛋白">
              {systems.map((s) => (
                <Cell key={s.id}>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      1 :
                    </span>
                    <NumInput
                      value={s.molarRatio}
                      onChange={(v) => patch(s.id, { molarRatio: v })}
                    />
                  </div>
                </Cell>
              ))}
            </Row>

            <Row label="反应温度">
              {systems.map((s) => (
                <Cell key={s.id}>
                  <PickInput
                    value={s.temperature}
                    options={TEMPERATURES}
                    onChange={(v) => patch(s.id, { temperature: v })}
                  />
                </Cell>
              ))}
            </Row>

            <Row label="反应时间">
              {systems.map((s) => (
                <Cell key={s.id}>
                  <PickInput
                    value={s.duration}
                    options={DURATIONS}
                    onChange={(v) => patch(s.id, { duration: v })}
                  />
                </Cell>
              ))}
            </Row>

            <Row label="摇床条件">
              {systems.map((s) => (
                <Cell key={s.id}>
                  <PickInput
                    value={s.shaking}
                    options={SHAKING}
                    onChange={(v) => patch(s.id, { shaking: v })}
                  />
                </Cell>
              ))}
            </Row>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={addBlank}>
          <Plus className="h-3.5 w-3.5" />
          添加体系
        </Button>
        {unused.map((s, i) => (
          <Button
            key={s.id}
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs"
            onClick={() => addFromSample(s)}
          >
            <Plus className="h-3 w-3" />
            {s.name || `样品 ${i + 1}`}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <th className="sticky left-0 z-10 border-r bg-card px-2 py-1.5 text-left align-top text-xs font-normal text-muted-foreground">
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-r px-2 py-1.5 align-top last:border-r-0">{children}</td>
  );
}

function NumInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode="decimal"
      className="h-7 px-2 font-mono text-xs"
    />
  );
}

/**
 * Free text with a datalist of the usual answers — the common values are one
 * keystroke away, and anything else is still typeable.
 */
function PickInput({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const listId = `pick-${options[0]}`;
  return (
    <>
      <Input
        value={value}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 px-2 text-xs"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
