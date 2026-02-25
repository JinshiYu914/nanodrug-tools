"use client";

import { useState } from "react";
import { TestTubes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

interface FormulationResult {
  workingConc: number;
  drugMass: number;
  dmsoVolume: number;
  dmsoStockConc: number;
  steps: { solvent: string; volume: number }[];
  totalVolume: number;
}

export default function FormulationPage() {
  const [dose, setDose] = useState("50");
  const [weight, setWeight] = useState("20");
  const [doseVolume, setDoseVolume] = useState("200");
  const [animalCount, setAnimalCount] = useState("6");
  const [dmsoPercent, setDmsoPercent] = useState("5");
  const [peg300Percent, setPeg300Percent] = useState("40");
  const [tween80Percent, setTween80Percent] = useState("5");
  const [waterPercent, setWaterPercent] = useState("50");
  const [result, setResult] = useState<FormulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate() {
    setError(null);
    setResult(null);

    const d = parseFloat(dose);
    const w = parseFloat(weight);
    const vol = parseFloat(doseVolume);
    const n = parseInt(animalCount);
    const dmso = parseFloat(dmsoPercent);
    const peg = parseFloat(peg300Percent);
    const tween = parseFloat(tween80Percent);
    const water = parseFloat(waterPercent);

    if ([d, w, vol, n, dmso, peg, tween, water].some(isNaN)) {
      setError("请填写所有参数");
      return;
    }

    const sum = dmso + peg + tween + water;
    if (Math.abs(sum - 100) > 0.1) {
      setError(`溶剂比例之和必须为100%，当前为 ${sum.toFixed(1)}%`);
      return;
    }

    // Working concentration: mg/mL
    // dose (mg/kg) * weight (g) / 1000 = dose per animal (mg)
    // dose per animal (mg) / volume (uL) * 1000 = concentration (mg/mL)
    const dosePerAnimal = d * w / 1000;
    const workingConc = dosePerAnimal / vol * 1000;

    // Total volume needed (uL) = dose_volume * animal_count (+ 1 for spare)
    const totalVolumeUl = vol * (n + 1);
    const drugMass = workingConc * totalVolumeUl / 1000;

    // DMSO stock volume
    const dmsoVol = totalVolumeUl * dmso / 100;
    const dmsoStockConc = drugMass / (dmsoVol / 1000);

    const steps = [
      { solvent: "DMSO (母液)", volume: dmsoVol },
      { solvent: "PEG300", volume: totalVolumeUl * peg / 100 },
      { solvent: "Tween 80", volume: totalVolumeUl * tween / 100 },
      { solvent: "ddH₂O", volume: totalVolumeUl * water / 100 },
    ].filter((s) => s.volume > 0);

    setResult({
      workingConc,
      drugMass,
      dmsoVolume: dmsoVol,
      dmsoStockConc,
      steps,
      totalVolume: totalVolumeUl,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="mb-2"><Link href="/tools" className="text-sm text-muted-foreground hover:text-primary">← 返回常用工具</Link></div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><TestTubes className="h-5 w-5 text-primary" /></div>
          <h1 className="text-3xl font-bold tracking-tight">动物体内配方计算器</h1>
        </div>
        <p className="text-muted-foreground">计算动物体内给药所需的药物质量和助溶剂配方（适用于不溶于水的药物）</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>实验参数</CardTitle>
            <CardDescription>建议多配一只动物的量（已自动计算 n+1）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">给药剂量 (mg/kg)</Label>
                <Input type="number" value={dose} onChange={(e) => setDose(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">动物平均体重 (g)</Label>
                <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">每只给药体积 (µL)</Label>
                <Input type="number" value={doseVolume} onChange={(e) => setDoseVolume(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">动物数量</Label>
                <Input type="number" value={animalCount} onChange={(e) => setAnimalCount(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium">助溶剂比例 (%)</Label>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">DMSO</Label>
                  <Input type="number" value={dmsoPercent} onChange={(e) => setDmsoPercent(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">PEG300</Label>
                  <Input type="number" value={peg300Percent} onChange={(e) => setPeg300Percent(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tween 80</Label>
                  <Input type="number" value={tween80Percent} onChange={(e) => setTween80Percent(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">ddH₂O</Label>
                  <Input type="number" value={waterPercent} onChange={(e) => setWaterPercent(e.target.value)} />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                合计: <span className={Math.abs(parseFloat(dmsoPercent || "0") + parseFloat(peg300Percent || "0") + parseFloat(tween80Percent || "0") + parseFloat(waterPercent || "0") - 100) > 0.1 ? "text-destructive font-medium" : "text-green-600 dark:text-green-400 font-medium"}>
                  {(parseFloat(dmsoPercent || "0") + parseFloat(peg300Percent || "0") + parseFloat(tween80Percent || "0") + parseFloat(waterPercent || "0")).toFixed(1)}%
                </span>
              </p>
            </div>

            <Button onClick={calculate} className="w-full">计算配方</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>配方结果</CardTitle></CardHeader>
          <CardContent>
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            {result && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">工作液浓度</p>
                  <p className="text-2xl font-bold">{result.workingConc.toPrecision(4)} mg/mL</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>总配制体积</span>
                    <span className="font-mono font-medium">{result.totalVolume.toFixed(1)} µL</span>
                  </div>
                  <div className="flex justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>称取药物</span>
                    <span className="font-mono font-medium">{result.drugMass.toPrecision(4)} mg</span>
                  </div>
                  <div className="flex justify-between rounded-md bg-muted/30 px-3 py-2">
                    <span>DMSO母液浓度</span>
                    <span className="font-mono font-medium">{result.dmsoStockConc.toPrecision(4)} mg/mL</span>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">配制步骤</p>
                  <ol className="space-y-2 text-sm">
                    {result.steps.map((step, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                        {i === 0 ? (
                          <span>将 <strong>{result.drugMass.toPrecision(3)} mg</strong> 药物溶于 <strong>{step.volume.toFixed(1)} µL</strong> {step.solvent}</span>
                        ) : (
                          <span>加入 <strong>{step.volume.toFixed(1)} µL</strong> {step.solvent}，混匀澄清</span>
                        )}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs text-muted-foreground">注意：按顺序依次添加，每步需确保溶液澄清后再进行下一步。</p>
                </div>
              </div>
            )}
            {!result && !error && <p className="py-8 text-center text-sm text-muted-foreground">输入参数后点击计算</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
