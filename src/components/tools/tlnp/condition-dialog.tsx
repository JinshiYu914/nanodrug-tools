"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calculator } from "lucide-react";
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
import Chip from "./chip";
import { formatVolume } from "@/lib/calculations/lnp-formula";
import { computeConjugationDose } from "@/lib/calculations/tlnp-conjugation";
import type { ReactionCondition } from "@/lib/calculations/tlnp-experiment";

const LINKERS = ["DSPE-PEG2k-mal", "DSPE-PEG2k-DBCO", "DSPE-PEG2k-NHS"];
const TEMPERATURES = ["4 °C", "室温", "37 °C"];
const DURATIONS = ["1 h", "2 h", "4 h", "过夜"];
const SHAKING = ["静置", "300 rpm", "500 rpm", "800 rpm"];

interface Props {
  condition: ReactionCondition | null;
  onClose: () => void;
  onSave: (next: ReactionCondition) => void;
}

export default function ConditionDialog({ condition, onClose, onSave }: Props) {
  if (!condition) return null;
  return (
    <Editor
      key={condition.id}
      condition={condition}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

/**
 * 新建/编辑反应条件 — a form over ReactionCondition with the 加样体系 computed
 * live beside it, so the user sees what a ratio actually costs in µL before
 * committing to it.
 */
function Editor({
  condition,
  onClose,
  onSave,
}: {
  condition: ReactionCondition;
  onClose: () => void;
  onSave: (next: ReactionCondition) => void;
}) {
  const [draft, setDraft] = useState<ReactionCondition>(condition);
  const set = (patch: Partial<ReactionCondition>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const dose = useMemo(() => computeConjugationDose(draft), [draft]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>反应条件</DialogTitle>
          <DialogDescription>
            给这套条件起个名字，填入 LNP 与蛋白的量，右侧会算出加样体系。
            之后在连线图里把样品连到它，就得到对应的 tLNP。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="条件名称">
                <Input
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="例如 CD3-1:50"
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="反应 linker">
                <Input
                  value={draft.linker}
                  onChange={(e) => set({ linker: e.target.value })}
                  placeholder="点选或输入"
                  className="h-8 text-xs"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LINKERS.map((l) => (
                <Chip
                  key={l}
                  active={draft.linker === l}
                  onClick={() => set({ linker: draft.linker === l ? "" : l })}
                >
                  {l}
                </Chip>
              ))}
            </div>

            <Section title="LNP">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="浓度 (ng/µL, RNA)">
                  <Input
                    value={draft.lnpConc}
                    onChange={(e) => set({ lnpConc: e.target.value })}
                    inputMode="decimal"
                    className="h-8 font-mono text-xs"
                  />
                </Field>
                <Field label="用量">
                  <Input
                    value={draft.lnpAmount}
                    onChange={(e) => set({ lnpAmount: e.target.value })}
                    inputMode="decimal"
                    className="h-8 font-mono text-xs"
                  />
                </Field>
                <Field label="用量单位">
                  <select
                    value={draft.lnpAmountUnit}
                    onChange={(e) =>
                      set({ lnpAmountUnit: e.target.value as "uL" | "ug" })
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm"
                  >
                    <option value="uL">µL（体积）</option>
                    <option value="ug">µg（RNA 总量）</option>
                  </select>
                </Field>
              </div>
              <Field label="RNA 长度 (nt) — 留空按 1000 nt 估算">
                <Input
                  value={draft.rnaLength_nt}
                  onChange={(e) => set({ rnaLength_nt: e.target.value })}
                  inputMode="decimal"
                  placeholder="1000"
                  className="h-8 font-mono text-xs"
                />
              </Field>
            </Section>

            <Section title="蛋白">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="名称">
                  <Input
                    value={draft.proteinName}
                    onChange={(e) => set({ proteinName: e.target.value })}
                    placeholder="例如 anti-CD3 scFv"
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="分子量 (Da)">
                  <Input
                    value={draft.proteinMW}
                    onChange={(e) => set({ proteinMW: e.target.value })}
                    inputMode="decimal"
                    className="h-8 font-mono text-xs"
                  />
                </Field>
                <Field label="浓度">
                  <Input
                    value={draft.proteinConc}
                    onChange={(e) => set({ proteinConc: e.target.value })}
                    inputMode="decimal"
                    className="h-8 font-mono text-xs"
                  />
                </Field>
                <Field label="浓度单位">
                  <select
                    value={draft.proteinConcUnit}
                    onChange={(e) =>
                      set({
                        proteinConcUnit: e.target.value as "mg_per_mL" | "uM",
                      })
                    }
                    className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm"
                  >
                    <option value="mg_per_mL">mg/mL</option>
                    <option value="uM">µM</option>
                  </select>
                </Field>
              </div>
              <Field label="目标摩尔比（蛋白 : LNP-RNA）">
                <Input
                  value={draft.targetMolarRatio}
                  onChange={(e) => set({ targetMolarRatio: e.target.value })}
                  inputMode="decimal"
                  placeholder="例如 50"
                  className="h-8 font-mono text-xs"
                />
              </Field>
            </Section>

            <Section title="反应条件">
              <ChipRow
                label="温度"
                options={TEMPERATURES}
                value={draft.temperature}
                onChange={(v) => set({ temperature: v })}
              />
              <ChipRow
                label="时间"
                options={DURATIONS}
                value={draft.duration}
                onChange={(v) => set({ duration: v })}
              />
              <ChipRow
                label="摇床"
                options={SHAKING}
                value={draft.shaking}
                onChange={(v) => set({ shaking: v })}
              />
              <Field label="备注（可选）">
                <Input
                  value={draft.note}
                  onChange={(e) => set({ note: e.target.value })}
                  placeholder="例如 避光，反应后 4 °C 保存"
                  className="h-8 text-xs"
                />
              </Field>
            </Section>
          </div>

          <div className="space-y-2 self-start rounded-lg border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Calculator className="h-3.5 w-3.5 text-accent-utility" />
              加样体系
            </p>
            <Row label="LNP" value={formatVolume(dose.lnpVolume_uL)} />
            <Row label="蛋白" value={formatVolume(dose.proteinVolume_uL)} />
            <Row label="反应总体积" value={formatVolume(dose.totalVolume_uL)} />
            <div className="border-t pt-2">
              <Row
                label="LNP-RNA"
                value={
                  dose.lnpRna_nmol === null
                    ? "--"
                    : `${dose.lnpRna_nmol.toPrecision(3)} nmol`
                }
              />
              <Row
                label="蛋白"
                value={
                  dose.protein_nmol === null
                    ? "--"
                    : `${dose.protein_nmol.toPrecision(3)} nmol`
                }
              />
            </div>
            {dose.warnings.length > 0 && (
              <div className="space-y-1 pt-1">
                {dose.warnings.map((w) => (
                  <p
                    key={w}
                    className="flex items-start gap-1 rounded border border-warning/35 bg-warning-subtle px-1.5 py-1 text-[11px] text-warning"
                  >
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => onSave(draft)}>保存条件</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-xs font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((o) => (
          <Chip
            key={o}
            active={value === o}
            onClick={() => onChange(value === o ? "" : o)}
          >
            {o}
          </Chip>
        ))}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-28 text-xs"
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
