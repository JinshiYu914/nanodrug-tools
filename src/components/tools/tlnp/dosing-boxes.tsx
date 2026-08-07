"use client";

import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  computeConjugationDose,
  explainConjugationDose,
  findProtein,
  linkerNmolPerUgRna,
  proteinName,
  systemName,
} from "@/lib/calculations/tlnp-conjugation";
import type {
  ProteinEntry,
  ReactionSystem,
} from "@/lib/calculations/tlnp-experiment";
import OptionSelect from "./option-select";

const BUFFERS = ["PBS pH 7.4", "PBS pH 6.8 with EDTA", "HEPES pH 7.4", "TBS"];

interface Props {
  systems: ReactionSystem[];
  proteins: ProteinEntry[];
  onChange: (id: string, patch: Partial<ReactionSystem>) => void;
}

const v = (n: number | null, digits = 1): string =>
  n === null || !isFinite(n) ? "--" : n.toFixed(digits);

/**
 * 加样体系 — one box per reaction system.
 *
 * Everything above the divider is read off the matrix; the two fields below it
 * (总体积, 反应 buffer) live here because they are what turns a ratio into a
 * pipetting instruction. Buffer is a solved quantity, not a guess: it is
 * whatever is left after the LNP and the antibody, which is only knowable once
 * a total volume is pinned.
 *
 * Each box carries its own 计算过程 — the antibody volume comes off four
 * chained conversions (RNA → N/P → lipid → linker → antibody), none of which
 * can be checked by eye, and a pipetting number nobody can check is one nobody
 * should trust.
 */
export default function DosingBoxes({ systems, proteins, onChange }: Props) {
  if (systems.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        建立反应体系后，这里会为每个体系单独算出加样体积。
      </p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {systems.map((s, i) => {
        const protein = findProtein(proteins, s.proteinId);
        const dose = computeConjugationDose(s, protein);
        const perUg = linkerNmolPerUgRna(s.basis, s.linkerPercent);
        const steps = explainConjugationDose(s, protein);

        return (
          <div key={s.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold">
                {systemName(s, i)}
              </p>
              <p className="shrink-0 truncate text-[11px] text-muted-foreground">
                {proteinName(protein) || "未选抗体"}
              </p>
            </div>

            <dl className="space-y-1">
              <DoseLine label="LNP" value={`${v(dose.lnpVolume_uL)} µL`} strong />
              <DoseLine
                label="抗体"
                value={`${v(dose.proteinVolume_uL)} µL`}
                strong
              />
              <DoseLine
                label="反应 buffer"
                value={
                  dose.bufferVolume_uL === null
                    ? "填入总体积后计算"
                    : `${v(dose.bufferVolume_uL)} µL`
                }
                strong
              />
              <DoseLine
                label="合计"
                value={`${v(dose.totalVolume_uL)} µL`}
              />
            </dl>

            <div className="space-y-1 border-t pt-2">
              <DoseLine
                label="投料 RNA"
                value={`${v(dose.rnaMass_ug, 2)} µg`}
                muted
              />
              <DoseLine
                label="linker"
                value={`${v(dose.linker_nmol, 3)} nmol`}
                muted
              />
              <DoseLine
                label="抗体"
                value={`${v(dose.protein_nmol, 3)} nmol`}
                muted
              />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t pt-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  总体积 (µL)
                </Label>
                <Input
                  value={s.totalVolume}
                  onChange={(e) =>
                    onChange(s.id, { totalVolume: e.target.value })
                  }
                  inputMode="decimal"
                  placeholder="例如 200"
                  className="h-7 px-2 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  反应 buffer
                </Label>
                <OptionSelect
                  value={s.reactionBuffer}
                  options={BUFFERS}
                  onChange={(reactionBuffer) => onChange(s.id, { reactionBuffer })}
                  placeholder="自定义 buffer"
                />
              </div>
            </div>

            {steps.length > 0 && (
              <details className="border-t pt-2 text-[11px]" open>
                <summary className="cursor-pointer select-none text-muted-foreground">
                  计算过程
                </summary>
                <ol className="mt-1.5 space-y-1">
                  {steps.map((step, at) => (
                    <li key={step.label} className="leading-snug">
                      <span className="text-muted-foreground">
                        {at + 1}. {step.label} ={" "}
                      </span>
                      <span className="font-mono">{step.expr}</span>
                      <span className="text-muted-foreground"> = </span>
                      <span className="font-mono font-medium">{step.result}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            {/* The conversion inputs, shown small because they are usually
                inherited from the formulation and rarely touched — but they
                are what the linker moles depend on, so they must be visible. */}
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer select-none">
                换算依据（N/P {s.basis.npRatio || "--"} · 阳离子{" "}
                {s.basis.ionizablePercent || "--"}% ·{" "}
                {perUg === null ? "--" : perUg.toFixed(3)} nmol/µg）
              </summary>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <BasisField
                  label="N/P"
                  value={s.basis.npRatio}
                  onChange={(npRatio) =>
                    onChange(s.id, { basis: { ...s.basis, npRatio } })
                  }
                />
                <BasisField
                  label="阳离子 mol%"
                  value={s.basis.ionizablePercent}
                  onChange={(ionizablePercent) =>
                    onChange(s.id, { basis: { ...s.basis, ionizablePercent } })
                  }
                />
                <BasisField
                  label="可电离胺数"
                  value={s.basis.aminesPerMolecule}
                  onChange={(aminesPerMolecule) =>
                    onChange(s.id, { basis: { ...s.basis, aminesPerMolecule } })
                  }
                />
              </div>
            </details>

            {dose.warnings.length > 0 && (
              <div className="space-y-1">
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
        );
      })}
    </div>
  );
}

function DoseLine({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt
        className={`text-[11px] ${muted ? "text-muted-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </dt>
      <dd
        className={`font-mono ${strong ? "text-sm" : "text-[11px] text-muted-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function BasisField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="h-6 px-1.5 font-mono text-[11px]"
      />
    </div>
  );
}
