"use client";

import { useMemo, useState } from "react";
import { Copy, Dna } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import OptionSelect from "@/components/tools/tlnp/option-select";
import {
  IvtSystemTable,
  LinearizationSystemTable,
} from "./reaction-system-table";
import TemplateBar from "./template-bar";
import {
  applyTemplateToRna,
  CAP_METHOD_OPTIONS,
  emptyDigestionSystem,
  ENZYME_BRAND_OPTIONS,
  IVT_KIT_BRAND_OPTIONS,
  ivtTemplateFromRna,
  linearizationTemplateFromRna,
  PURIFICATION_METHOD_OPTIONS,
  purificationTemplateFromRna,
  RESTRICTION_SITE_OPTIONS,
  RNA_CONCENTRATION_OPTIONS,
  RNA_MODIFICATION_OPTIONS,
  RNA_TYPE_OPTIONS,
  RNA_VECTOR_OPTIONS,
  rnaTotalMassUg,
  type IvtRnaRecord,
} from "@/lib/calculations/ivt-experiment";
import type { IvtTemplateItem } from "@/lib/supabase/ivt-service";

interface Props {
  rna: IvtRnaRecord;
  allRnas: IvtRnaRecord[];
  onChange: (next: IvtRnaRecord) => void;
  onCopyMethod: (targetIds: string[]) => void;
}

export default function RnaEditor({ rna, allRnas, onChange, onCopyMethod }: Props) {
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
  const totalMass = useMemo(() => rnaTotalMassUg(rna), [rna]);
  const rnaTypeOptions = useMemo(
    () => [...new Set([...RNA_TYPE_OPTIONS, ...allRnas.map((item) => item.rnaType).filter(Boolean)])],
    [allRnas]
  );
  const vectorOptions = useMemo(
    () => [...new Set([...RNA_VECTOR_OPTIONS, ...allRnas.map((item) => item.vector).filter(Boolean)])],
    [allRnas]
  );

  const setLinearization = (patch: Partial<IvtRnaRecord["linearization"]>) =>
    onChange({ ...rna, linearization: { ...rna.linearization, ...patch } });
  const setIvt = (patch: Partial<IvtRnaRecord["ivt"]>) =>
    onChange({ ...rna, ivt: { ...rna.ivt, ...patch } });
  const setPurification = (patch: Partial<IvtRnaRecord["purification"]>) =>
    onChange({ ...rna, purification: { ...rna.purification, ...patch } });

  function applyTemplate(template: IvtTemplateItem) {
    onChange(applyTemplateToRna(rna, template.id, template.name, template.payload));
  }

  const digestionSystem =
    rna.linearization.digestionSystem ?? emptyDigestionSystem();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Dna className="h-4 w-4 text-primary" />RNA 选择
            </CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={allRnas.length < 2}
              onClick={() => {
                setCopyTargets(new Set());
                setCopyOpen(true);
              }}
            >
              <Copy className="h-3.5 w-3.5" />复制方法到其他 RNA
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="样本序号">
              <Input value={rna.name} onChange={(event) => onChange({ ...rna, name: event.target.value })} />
            </Field>
            <Field label="RNA">
              <OptionSelect value={rna.rnaType} options={rnaTypeOptions} onChange={(value) => onChange({ ...rna, rnaType: value })} placeholder="新建 RNA" />
            </Field>
            <Field label="T7质粒载体">
              <OptionSelect value={rna.vector} options={vectorOptions} onChange={(value) => onChange({ ...rna, vector: value })} placeholder="自定义载体" />
            </Field>
          </div>

          <Separator />

          <section className="space-y-4">
            <SectionHeading number="1" title="质粒线性化与回收" />
            <TemplateBar kind="linearization" buildPayload={() => linearizationTemplateFromRna(rna)} onApply={applyTemplate} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="酶切位点"><OptionSelect value={rna.linearization.restrictionSite} options={RESTRICTION_SITE_OPTIONS} onChange={(value) => setLinearization({ restrictionSite: value })} /></Field>
              <Field label="内切酶品牌"><OptionSelect value={rna.linearization.enzymeBrand} options={ENZYME_BRAND_OPTIONS} onChange={(value) => setLinearization({ enzymeBrand: value })} /></Field>
              <Field label="温度 (℃)"><Input inputMode="decimal" value={rna.linearization.temperatureC} onChange={(event) => setLinearization({ temperatureC: event.target.value })} /></Field>
              <Field label="时间 (h)"><Input inputMode="decimal" value={rna.linearization.durationH} onChange={(event) => setLinearization({ durationH: event.target.value })} /></Field>
            </div>

            <LinearizationSystemTable
              system={digestionSystem}
              dnaConcentrationNgUl={rna.linearization.dnaConcentrationNgUl}
              dnaMassUg={rna.linearization.dnaMassUg}
              totalVolumeUl={rna.linearization.totalVolumeUl}
              onDnaConcentrationChange={(dnaConcentrationNgUl) =>
                setLinearization({ dnaConcentrationNgUl })
              }
              onDnaMassChange={(dnaMassUg) => setLinearization({ dnaMassUg })}
              onTotalVolumeChange={(totalVolumeUl) =>
                setLinearization({ totalVolumeUl })
              }
              onSystemChange={(next) =>
                setLinearization({
                  digestionSystem: next,
                })
              }
            />

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="回收试剂盒品牌"><Input value={rna.linearization.recoveryKitBrand} onChange={(event) => setLinearization({ recoveryKitBrand: event.target.value })} placeholder="品牌 / 型号" /></Field>
              <Field label="回收得率 (%)"><Input inputMode="decimal" value={rna.linearization.recoveryYieldPercent} onChange={(event) => setLinearization({ recoveryYieldPercent: event.target.value })} /></Field>
              <Field label="线性化备注"><Input value={rna.linearization.note} onChange={(event) => setLinearization({ note: event.target.value })} /></Field>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <SectionHeading number="2" title="IVT 反应" />
            <TemplateBar kind="ivt" buildPayload={() => ivtTemplateFromRna(rna)} onApply={applyTemplate} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="IVT 试剂盒品牌"><OptionSelect value={rna.ivt.kitBrand} options={IVT_KIT_BRAND_OPTIONS} onChange={(value) => setIvt({ kitBrand: value })} placeholder="自定义品牌" /></Field>
              <Field label="核苷修饰"><OptionSelect value={rna.ivt.modification} options={RNA_MODIFICATION_OPTIONS} onChange={(value) => setIvt({ modification: value })} placeholder="自定义修饰" /></Field>
              <Field label="Cap 加帽方式">
                <div className="grid grid-cols-2 gap-1.5">
                  {CAP_METHOD_OPTIONS.map((option) => (
                    <button key={option} type="button" onClick={() => setIvt({ cap: option })} className={`h-9 rounded-md border px-2 text-xs transition-colors ${rna.ivt.cap === option ? "border-primary bg-primary/10 font-medium text-primary" : "border-input hover:bg-muted"}`}>{option}</button>
                  ))}
                </div>
              </Field>
            </div>
            <IvtSystemTable
              system={rna.ivt.reactionSystem}
              onChange={(reactionSystem) => setIvt({ reactionSystem })}
            />
            <Field label="IVT 备注"><Textarea rows={2} value={rna.ivt.note} onChange={(event) => setIvt({ note: event.target.value })} /></Field>
          </section>

          <Separator />

          <section className="space-y-4">
            <SectionHeading number="3" title="RNA 纯化与得量" />
            <TemplateBar kind="purification" buildPayload={() => purificationTemplateFromRna(rna)} onApply={applyTemplate} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="RNA 纯化方法"><OptionSelect value={rna.purification.method} options={PURIFICATION_METHOD_OPTIONS} onChange={(value) => setPurification({ method: value })} placeholder="自定义纯化方法" /></Field>
              <Field label="纯化试剂盒"><Input value={rna.purification.kitBrand} onChange={(event) => setPurification({ kitBrand: event.target.value })} placeholder="品牌 / 型号" /></Field>
              <Field label="浓度 (µg/µL)"><OptionSelect value={rna.purification.concentrationUgUl} options={RNA_CONCENTRATION_OPTIONS} onChange={(value) => setPurification({ concentrationUgUl: value })} emptyLabel="未测定" placeholder="自定义浓度" /></Field>
              <Field label="终体积 (µL)"><Input inputMode="decimal" value={rna.purification.finalVolumeUl} onChange={(event) => setPurification({ finalVolumeUl: event.target.value })} /></Field>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">RNA 总得量</Label><div className="flex h-9 items-center rounded-md bg-primary/10 px-3 font-mono text-sm font-semibold text-primary">{totalMass === null ? "--" : `${totalMass.toFixed(2)} µg`}</div></div>
            </div>
            <Field label="纯化备注"><Textarea rows={2} value={rna.purification.note} onChange={(event) => setPurification({ note: event.target.value })} /></Field>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">表达验证</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            rows={5}
            value={rna.expressionValidation}
            onChange={(event) => onChange({ ...rna, expressionValidation: event.target.value })}
            placeholder="自由记录表达验证：日期、细胞或模型、检测方法、结果与结论……"
          />
        </CardContent>
      </Card>

      <CopyMethodDialog
        open={copyOpen}
        source={rna}
        targets={allRnas.filter((item) => item.id !== rna.id)}
        selected={copyTargets}
        onSelected={setCopyTargets}
        onClose={() => setCopyOpen(false)}
        onApply={() => {
          onCopyMethod([...copyTargets]);
          setCopyOpen(false);
        }}
      />
    </div>
  );
}

function CopyMethodDialog({ open, source, targets, selected, onSelected, onClose, onApply }: { open: boolean; source: IvtRnaRecord; targets: IvtRnaRecord[]; selected: Set<string>; onSelected: (next: Set<string>) => void; onClose: () => void; onApply: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>复制实验方法</DialogTitle><DialogDescription>从「{source.name}」复制方法；不会覆盖 RNA 选择、DNA 投入量、得量和表达验证。</DialogDescription></DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {targets.map((target) => (
            <label key={target.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={selected.has(target.id)} onChange={(event) => { const next = new Set(selected); if (event.target.checked) next.add(target.id); else next.delete(target.id); onSelected(next); }} className="h-4 w-4 accent-primary" />
              <span>{target.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button disabled={selected.size === 0} onClick={onApply}>复制到 {selected.size} 条 RNA</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return <div className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">{number}</span><h3 className="text-sm font-semibold">{title}</h3></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
