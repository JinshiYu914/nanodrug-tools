"use client";

import { useState } from "react";
import { Scissors, Plus, Trash2 } from "lucide-react";
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

interface Fragment {
  id: string;
  name: string;
  size: string;
  concentration: string;
}

interface LigationResult {
  vectorVolume: number;
  fragments: { name: string; volume: number; moles: string }[];
  waterVolume: number;
  totalVolume: number;
}

let nextId = 1;

export default function LigationPage() {
  const [vectorSize, setVectorSize] = useState("5000");
  const [vectorConc, setVectorConc] = useState("100");
  const [vectorAmount, setVectorAmount] = useState("100");
  const [molarRatio, setMolarRatio] = useState("3");
  const [totalVolume, setTotalVolume] = useState("20");
  const [fragments, setFragments] = useState<Fragment[]>([
    { id: "f1", name: "Insert 1", size: "1000", concentration: "50" },
  ]);
  const [result, setResult] = useState<LigationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addFragment() {
    nextId++;
    setFragments((prev) => [
      ...prev,
      { id: `f${nextId}`, name: `Insert ${prev.length + 1}`, size: "", concentration: "" },
    ]);
  }

  function removeFragment(id: string) {
    setFragments((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFragment(id: string, field: keyof Fragment, value: string) {
    setFragments((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  }

  function calculate() {
    setError(null);
    setResult(null);

    const vSize = parseFloat(vectorSize);
    const vConc = parseFloat(vectorConc);
    const vAmount = parseFloat(vectorAmount);
    const ratio = parseFloat(molarRatio);
    const total = parseFloat(totalVolume);

    if ([vSize, vConc, vAmount, ratio, total].some(isNaN)) {
      setError("请填写所有载体参数");
      return;
    }

    // Vector volume (µL) = vector amount (ng) / concentration (ng/µL)
    const vectorVol = vAmount / vConc;

    // Vector moles (fmol) = amount(ng) / (size(bp) * 660(g/mol per bp)) * 1e6
    const vectorMoles = (vAmount / (vSize * 660)) * 1e6;

    const fragResults: LigationResult["fragments"] = [];
    let totalFragVol = 0;

    for (const frag of fragments) {
      const fSize = parseFloat(frag.size);
      const fConc = parseFloat(frag.concentration);

      if (isNaN(fSize) || isNaN(fConc) || fConc === 0) {
        setError(`请填写 ${frag.name} 的完整参数`);
        return;
      }

      // Required moles = vector_moles * molar_ratio
      const requiredMoles = vectorMoles * ratio;

      // Required mass (ng) = moles(fmol) * size(bp) * 660(g/mol) / 1e6
      const requiredMass = (requiredMoles * fSize * 660) / 1e6;

      // Volume (µL) = mass (ng) / concentration (ng/µL)
      const fragVol = requiredMass / fConc;
      totalFragVol += fragVol;

      fragResults.push({
        name: frag.name,
        volume: parseFloat(fragVol.toFixed(2)),
        moles: requiredMoles.toFixed(2) + " fmol",
      });
    }

    const usedVol = vectorVol + totalFragVol;
    const waterVol = Math.max(0, total - usedVol);

    if (usedVol > total) {
      setError(`DNA体积 (${usedVol.toFixed(1)} µL) 超过总反应体积 (${total} µL)。请增大总体积或降低DNA用量。`);
      return;
    }

    setResult({
      vectorVolume: parseFloat(vectorVol.toFixed(2)),
      fragments: fragResults,
      waterVolume: parseFloat(waterVol.toFixed(2)),
      totalVolume: total,
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="mb-2"><Link href="/tools" className="text-sm text-muted-foreground hover:text-primary">← 返回常用工具</Link></div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Scissors className="h-5 w-5 text-primary" /></div>
          <h1 className="text-3xl font-bold tracking-tight">同源重组连接计算器</h1>
        </div>
        <p className="text-muted-foreground">
          用于分子克隆实验，根据载体和目的DNA片段的浓度、大小和摩尔比，自动计算各组分吸取量。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>反应参数</CardTitle>
            <CardDescription>
              公式: 质量(ng) = 摩尔数(fmol) × 片段大小(bp) × 660(Da/bp) / 10⁶
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Vector params */}
            <div>
              <Label className="mb-2 block text-sm font-medium">载体 (Vector)</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">大小 (bp)</Label>
                  <Input type="number" value={vectorSize} onChange={(e) => setVectorSize(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">浓度 (ng/µL)</Label>
                  <Input type="number" value={vectorConc} onChange={(e) => setVectorConc(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">用量 (ng)</Label>
                  <Input type="number" value={vectorAmount} onChange={(e) => setVectorAmount(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Fragment params */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-medium">目的片段 (Inserts)</Label>
                <Button size="sm" variant="outline" onClick={addFragment} className="gap-1"><Plus className="h-3.5 w-3.5" /> 添加片段</Button>
              </div>
              <div className="space-y-3">
                {fragments.map((frag) => (
                  <div key={frag.id} className="flex items-end gap-2 rounded-lg border bg-muted/20 p-3">
                    <div className="flex-1 grid gap-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">名称</Label>
                        <Input value={frag.name} onChange={(e) => updateFragment(frag.id, "name", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">大小 (bp)</Label>
                        <Input type="number" value={frag.size} onChange={(e) => updateFragment(frag.id, "size", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">浓度 (ng/µL)</Label>
                        <Input type="number" value={frag.concentration} onChange={(e) => updateFragment(frag.id, "concentration", e.target.value)} />
                      </div>
                    </div>
                    {fragments.length > 1 && (
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-destructive" onClick={() => removeFragment(frag.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ratio & Volume */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">摩尔比 (Insert : Vector)</Label>
                <Input type="number" step="0.5" value={molarRatio} onChange={(e) => setMolarRatio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">总反应体积 (µL)</Label>
                <Input type="number" value={totalVolume} onChange={(e) => setTotalVolume(e.target.value)} />
              </div>
            </div>

            <Button onClick={calculate} className="w-full">计算吸取量</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>吸取方案</CardTitle></CardHeader>
          <CardContent>
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            {result && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md bg-chart-1/12 px-3 py-2 text-sm">
                    <span className="font-medium">Vector</span>
                    <span className="font-mono font-bold">{result.vectorVolume} µL</span>
                  </div>
                  {result.fragments.map((f) => (
                    <div key={f.name} className="flex items-center justify-between rounded-md bg-chart-2/12 px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{f.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({f.moles})</span>
                      </div>
                      <span className="font-mono font-bold">{f.volume} µL</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span>ddH₂O (补至总体积)</span>
                    <span className="font-mono font-medium">{result.waterVolume} µL</span>
                  </div>
                </div>

                <div className="rounded-md border p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">总反应体积</span>
                    <span className="font-bold">{result.totalVolume} µL</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  注：以上计算基于 Insert:Vector = {molarRatio}:1 的摩尔比。
                  实际实验中还需加入连接酶和缓冲液，请相应调整 ddH₂O 用量。
                </p>
              </div>
            )}
            {!result && !error && <p className="py-8 text-center text-sm text-muted-foreground">输入参数后点击计算</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
