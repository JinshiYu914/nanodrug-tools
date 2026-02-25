"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default function DilutionPage() {
  // C1V1 = C2V2
  const [c1, setC1] = useState("");
  const [c1Unit, setC1Unit] = useState("mM");
  const [v1, setV1] = useState("");
  const [v1Unit, setV1Unit] = useState("uL");
  const [c2, setC2] = useState("");
  const [c2Unit, setC2Unit] = useState("mM");
  const [v2, setV2] = useState("");
  const [v2Unit, setV2Unit] = useState("mL");
  const [solveFor, setSolveFor] = useState<"v1" | "v2" | "c2">("v2");
  const [dilResult, setDilResult] = useState<string | null>(null);
  const [dilError, setDilError] = useState<string | null>(null);

  // Serial dilution
  const [serialC0, setSerialC0] = useState("");
  const [serialFactor, setSerialFactor] = useState("2");
  const [serialSteps, setSerialSteps] = useState("8");
  const [serialResults, setSerialResults] = useState<{ conc: number; log: string }[] | null>(null);

  const concMultipliers: Record<string, number> = { fM: 1e-12, pM: 1e-9, nM: 1e-6, uM: 1e-3, mM: 1, M: 1e3 };
  const volMultipliers: Record<string, number> = { nL: 1e-6, uL: 1e-3, mL: 1, L: 1e3 };
  const concUnits = ["fM", "pM", "nM", "uM", "mM", "M"];
  const volUnits = ["nL", "uL", "mL", "L"];

  function calcDilution() {
    setDilError(null);
    setDilResult(null);
    const C1 = parseFloat(c1) * concMultipliers[c1Unit];
    const V1 = parseFloat(v1) * volMultipliers[v1Unit];
    const C2 = parseFloat(c2) * concMultipliers[c2Unit];
    const V2 = parseFloat(v2) * volMultipliers[v2Unit];

    if (solveFor === "v2") {
      if (isNaN(C1) || isNaN(V1) || isNaN(C2)) { setDilError("请填写C1, V1, C2"); return; }
      if (C2 === 0) { setDilError("C2 不能为 0"); return; }
      const result_mL = (C1 * V1) / C2;
      setDilResult(`V2 = ${formatVol(result_mL)}`);
    } else if (solveFor === "v1") {
      if (isNaN(C1) || isNaN(C2) || isNaN(V2)) { setDilError("请填写C1, C2, V2"); return; }
      if (C1 === 0) { setDilError("C1 不能为 0"); return; }
      const result_mL = (C2 * V2) / C1;
      setDilResult(`V1 = ${formatVol(result_mL)}`);
    } else {
      if (isNaN(C1) || isNaN(V1) || isNaN(V2)) { setDilError("请填写C1, V1, V2"); return; }
      if (V2 === 0) { setDilError("V2 不能为 0"); return; }
      const result_mM = (C1 * V1) / V2;
      setDilResult(`C2 = ${formatConc(result_mM)}`);
    }
  }

  function formatVol(mL: number): string {
    if (mL >= 1000) return `${(mL / 1000).toPrecision(4)} L`;
    if (mL >= 1) return `${mL.toPrecision(4)} mL`;
    if (mL >= 0.001) return `${(mL * 1000).toPrecision(4)} uL`;
    return `${(mL * 1e6).toPrecision(4)} nL`;
  }

  function formatConc(mM: number): string {
    if (mM >= 1000) return `${(mM / 1000).toPrecision(4)} M`;
    if (mM >= 1) return `${mM.toPrecision(4)} mM`;
    if (mM >= 0.001) return `${(mM * 1000).toPrecision(4)} uM`;
    if (mM >= 1e-6) return `${(mM * 1e6).toPrecision(4)} nM`;
    return `${(mM * 1e9).toPrecision(4)} pM`;
  }

  function calcSerial() {
    const c0 = parseFloat(serialC0);
    const factor = parseFloat(serialFactor);
    const steps = parseInt(serialSteps);
    if (isNaN(c0) || isNaN(factor) || isNaN(steps) || factor <= 0 || steps <= 0) return;
    const results: { conc: number; log: string }[] = [];
    let current = c0;
    for (let i = 0; i < steps; i++) {
      current = i === 0 ? c0 / factor : results[i - 1].conc / factor;
      results.push({ conc: parseFloat(current.toPrecision(4)), log: Math.log10(current).toFixed(3) });
    }
    setSerialResults(results);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-2"><Link href="/tools" className="text-sm text-muted-foreground hover:text-primary">← 返回常用工具</Link></div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><FlaskConical className="h-5 w-5 text-primary" /></div>
          <h1 className="text-3xl font-bold tracking-tight">稀释计算器</h1>
        </div>
      </div>

      <Tabs defaultValue="simple">
        <TabsList className="mb-4">
          <TabsTrigger value="simple">C1V1 = C2V2</TabsTrigger>
          <TabsTrigger value="serial">连续稀释</TabsTrigger>
        </TabsList>

        <TabsContent value="simple">
          <Card>
            <CardHeader>
              <CardTitle>稀释计算 (C1V1 = C2V2)</CardTitle>
              <CardDescription>选择要求解的变量，填写其余三项</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {([["v1", "求V1 (取多少母液)"], ["v2", "求V2 (终体积)"], ["c2", "求C2 (终浓度)"]] as const).map(([k, l]) => (
                  <Button key={k} size="sm" variant={solveFor === k ? "default" : "outline"} onClick={() => setSolveFor(k)}>{l}</Button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">C1 (母液浓度)</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={c1} onChange={(e) => setC1(e.target.value)} />
                    <select className="flex h-9 w-20 rounded-md border bg-transparent px-2 text-sm" value={c1Unit} onChange={(e) => setC1Unit(e.target.value)}>{concUnits.map((u) => <option key={u}>{u}</option>)}</select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">V1 (母液体积){solveFor === "v1" && " - 待求解"}</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={v1} onChange={(e) => setV1(e.target.value)} disabled={solveFor === "v1"} placeholder={solveFor === "v1" ? "自动计算" : ""} />
                    <select className="flex h-9 w-20 rounded-md border bg-transparent px-2 text-sm" value={v1Unit} onChange={(e) => setV1Unit(e.target.value)}>{volUnits.map((u) => <option key={u}>{u}</option>)}</select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">C2 (终浓度){solveFor === "c2" && " - 待求解"}</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={c2} onChange={(e) => setC2(e.target.value)} disabled={solveFor === "c2"} placeholder={solveFor === "c2" ? "自动计算" : ""} />
                    <select className="flex h-9 w-20 rounded-md border bg-transparent px-2 text-sm" value={c2Unit} onChange={(e) => setC2Unit(e.target.value)}>{concUnits.map((u) => <option key={u}>{u}</option>)}</select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">V2 (终体积){solveFor === "v2" && " - 待求解"}</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={v2} onChange={(e) => setV2(e.target.value)} disabled={solveFor === "v2"} placeholder={solveFor === "v2" ? "自动计算" : ""} />
                    <select className="flex h-9 w-20 rounded-md border bg-transparent px-2 text-sm" value={v2Unit} onChange={(e) => setV2Unit(e.target.value)}>{volUnits.map((u) => <option key={u}>{u}</option>)}</select>
                  </div>
                </div>
              </div>

              <Button onClick={calcDilution} className="w-full">计算</Button>
              {dilError && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{dilError}</div>}
              {dilResult && <div className="rounded-lg bg-muted/50 p-4 text-center"><p className="text-2xl font-bold">{dilResult}</p></div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="serial">
          <Card>
            <CardHeader>
              <CardTitle>连续稀释计算</CardTitle>
              <CardDescription>输入初始浓度和稀释倍数，自动生成稀释梯度</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">初始浓度</Label>
                  <Input type="number" value={serialC0} onChange={(e) => setSerialC0(e.target.value)} placeholder="e.g. 10000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">稀释倍数 (X)</Label>
                  <Input type="number" value={serialFactor} onChange={(e) => setSerialFactor(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">步数</Label>
                  <Input type="number" value={serialSteps} onChange={(e) => setSerialSteps(e.target.value)} />
                </div>
              </div>
              <Button onClick={calcSerial} className="w-full">生成梯度</Button>

              {serialResults && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">步骤</th>
                        <th className="px-3 py-2 text-left font-medium">公式</th>
                        <th className="px-3 py-2 text-right font-medium">浓度</th>
                        <th className="px-3 py-2 text-right font-medium">LOG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {serialResults.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">C{i + 1}</td>
                          <td className="px-3 py-2 text-muted-foreground">{i === 0 ? "C0" : `C${i}`}/X</td>
                          <td className="px-3 py-2 text-right font-mono">{r.conc}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.log}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
