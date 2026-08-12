"use client";

import { Input } from "@/components/ui/input";
import {
  formatReactionAmount,
  linearizationOneXAmount,
  scaledComponentAmount,
  type DigestionComponent,
  type DigestionSystemSnapshot,
  type IvtReactionSystem,
} from "@/lib/calculations/ivt-experiment";

interface LinearizationProps {
  system: DigestionSystemSnapshot;
  dnaConcentrationNgUl: string;
  dnaMassUg: string;
  totalVolumeUl: string;
  onSystemChange: (next: DigestionSystemSnapshot) => void;
  onDnaConcentrationChange: (value: string) => void;
  onDnaMassChange: (value: string) => void;
  onTotalVolumeChange: (value: string) => void;
}

export function LinearizationSystemTable({
  system,
  dnaConcentrationNgUl,
  dnaMassUg,
  totalVolumeUl,
  onSystemChange,
  onDnaConcentrationChange,
  onDnaMassChange,
  onTotalVolumeChange,
}: LinearizationProps) {
  function patch(id: string, next: Partial<DigestionComponent>) {
    onSystemChange({
      ...system,
      components: system.components.map((item) =>
        item.id === id ? { ...item, ...next } : item
      ),
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[44rem] table-fixed text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="w-40 px-2 py-2 text-left">
              {totalVolumeUl || "50"} µL 线性化体系
            </th>
            <th className="w-28 px-2 py-2 text-left font-normal text-muted-foreground">
              储存浓度
            </th>
            <th className="w-36 px-2 py-2 text-left">1× 投入量</th>
            <th className="w-36 px-2 py-2 text-left">1× 加样体积</th>
            <ScaleHeader
              count={system.reactionCount}
              onChange={(reactionCount) =>
                onSystemChange({ ...system, reactionCount })
              }
            />
          </tr>
        </thead>
        <tbody>
          {system.components.map((item) => {
            const oneX = linearizationOneXAmount(
              item,
              system,
              dnaConcentrationNgUl,
              dnaMassUg,
              totalVolumeUl
            );
            const oneXText = formatReactionAmount(oneX);
            const nX = oneXText
              ? scaledComponentAmount(oneXText, system.reactionCount)
              : "";
            const dna = item.name === "质粒 DNA";
            return (
              <tr key={item.id} className="border-b last:border-b-0">
                <td className="px-2 py-2 font-medium">{item.name}</td>
                <td className="p-1.5">
                  {dna ? (
                    <UnitInput
                      value={dnaConcentrationNgUl}
                      onChange={onDnaConcentrationChange}
                      unit="ng/µL"
                      muted
                    />
                  ) : (
                    <StockInput
                      value={item.stockConcentration}
                      onChange={(value) =>
                        patch(item.id, {
                          stockConcentration: value,
                        })
                      }
                    />
                  )}
                </td>
                <td className="p-1.5">
                  {dna ? (
                    <UnitInput
                      value={dnaMassUg}
                      onChange={onDnaMassChange}
                      unit="µg"
                    />
                  ) : item.fillTo ? (
                    <UnitInput
                      value={totalVolumeUl}
                      onChange={onTotalVolumeChange}
                      unit="µL 总体积"
                      prefix="to"
                    />
                  ) : (
                    <UnitInput
                      value={item.amount}
                      onChange={(amount) => patch(item.id, { amount })}
                      unit={item.unit}
                    />
                  )}
                </td>
                <td className="p-1.5">
                  <Calculated value={oneXText} unit="µL" />
                </td>
                <td className="p-1.5">
                  <Calculated value={nX} unit="µL" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface IvtProps {
  system: IvtReactionSystem;
  onChange: (next: IvtReactionSystem) => void;
}

export function IvtSystemTable({ system, onChange }: IvtProps) {
  function patch(id: string, amount: string) {
    onChange({
      ...system,
      components: system.components.map((item) =>
        item.id === id ? { ...item, amount } : item
      ),
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[35rem] table-fixed text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="w-40 px-2 py-2 text-left">20 µL IVT 加样体系</th>
            <th className="w-24 px-2 py-2 text-left font-normal text-muted-foreground">
              储存浓度
            </th>
            <th className="w-36 px-2 py-2 text-left">1× 用量</th>
            <ScaleHeader
              count={system.reactionCount}
              onChange={(reactionCount) => onChange({ ...system, reactionCount })}
            />
          </tr>
        </thead>
        <tbody>
          {system.components.map((item) => {
            const nX = scaledComponentAmount(item.amount, system.reactionCount);
            return (
              <tr key={item.id} className="border-b last:border-b-0">
                <td className="px-2 py-2 font-medium">
                  {item.name}
                  {item.name === "线性化模板 DNA" && (
                    <span className="ml-1 text-[10px] font-normal text-primary">
                      最后加入
                    </span>
                  )}
                </td>
                <td className="p-1.5">
                  <StockInput
                    value={item.stockConcentration}
                    onChange={(value) =>
                      onChange({
                        ...system,
                        components: system.components.map((component) =>
                          component.id === item.id
                            ? {
                                ...component,
                                stockConcentration: value,
                              }
                            : component
                        ),
                      })
                    }
                  />
                </td>
                <td className="p-1.5">
                  <UnitInput
                    value={item.amount}
                    onChange={(amount) => patch(item.id, amount)}
                    unit={item.unit}
                    prefix={item.fillTo ? "to" : undefined}
                  />
                </td>
                <td className="p-1.5">
                  <Calculated
                    value={nX}
                    unit={item.unit}
                    prefix={item.fillTo ? "to" : undefined}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScaleHeader({
  count,
  onChange,
}: {
  count: string;
  onChange: (value: string) => void;
}) {
  return (
    <th className="w-40 px-2 py-1.5 text-left">
      <label className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={count}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-16 px-2 text-xs"
          aria-label="体系数 n"
        />
        <span>× 体系</span>
      </label>
    </th>
  );
}

function UnitInput({
  value,
  onChange,
  unit,
  prefix,
  muted = false,
}: {
  value: string;
  onChange: (value: string) => void;
  unit: string;
  prefix?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex h-8 items-center rounded-md border focus-within:ring-1 focus-within:ring-ring ${
        muted
          ? "border-transparent bg-muted/30 text-muted-foreground shadow-none transition-colors hover:bg-muted/45 focus-within:border-input focus-within:bg-background focus-within:text-foreground"
          : "border-input bg-transparent"
      }`}
    >
      {prefix && <span className="pl-2 text-[10px] text-muted-foreground">{prefix}</span>}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className={`min-w-0 flex-1 bg-transparent px-2 font-mono outline-none ${muted ? "text-[11px]" : "text-xs"}`}
      />
      <span className="shrink-0 pr-2 text-[10px] text-muted-foreground">{unit}</span>
    </div>
  );
}

function StockInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 border-transparent bg-muted/30 px-2 text-[11px] text-muted-foreground shadow-none transition-colors hover:bg-muted/45 focus-visible:border-input focus-visible:bg-background focus-visible:text-foreground"
    />
  );
}

function Calculated({
  value,
  unit,
  prefix,
}: {
  value: string;
  unit: string;
  prefix?: string;
}) {
  return (
    <div className="flex h-8 items-center rounded-md bg-primary/8 px-2 font-mono text-xs font-medium text-primary">
      {value ? `${prefix ? `${prefix} ` : ""}${value} ${unit}` : "--"}
    </div>
  );
}
