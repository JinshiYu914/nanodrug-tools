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
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const concUnits = ["nM", "uM", "mM", "M"];
const volUnits = ["uL", "mL", "L"];
const cMul: Record<string, number> = { nM: 1e-6, uM: 1e-3, mM: 1, M: 1e3 };
const vMul: Record<string, number> = { uL: 1e-3, mL: 1, L: 1e3 };

function fmtConc(mM: number): string {
  if (mM >= 1000) return `${(mM / 1000).toPrecision(4)} M`;
  if (mM >= 1) return `${mM.toPrecision(4)} mM`;
  if (mM >= 0.001) return `${(mM * 1000).toPrecision(4)} uM`;
  return `${(mM * 1e6).toPrecision(4)} nM`;
}
function fmtVol(mL: number): string {
  if (mL >= 1000) return `${(mL / 1000).toPrecision(4)} L`;
  if (mL >= 1) return `${mL.toPrecision(4)} mL`;
  return `${(mL * 1000).toPrecision(4)} uL`;
}

export function DilutionCalc() {
  const [c1, setC1] = useState(""); const [c1u, setC1u] = useState("mM");
  const [v1, setV1] = useState(""); const [v1u, setV1u] = useState("uL");
  const [c2, setC2] = useState(""); const [c2u, setC2u] = useState("uM");
  const [v2, setV2] = useState(""); const [v2u, setV2u] = useState("mL");
  const [dilResult, setDilResult] = useState<string | null>(null);
  const [dilError, setDilError] = useState<string | null>(null);

  const [serialC0, setSerialC0] = useState("");
  const [serialFactor, setSerialFactor] = useState("2");
  const [serialSteps, setSerialSteps] = useState("8");
  const [serialResults, setSerialResults] = useState<{ conc: number; log: string }[] | null>(null);

  function calcDilution() {
    setDilError(null); setDilResult(null);
    const C1 = c1 ? parseFloat(c1) * cMul[c1u] : NaN;
    const V1 = v1 ? parseFloat(v1) * vMul[v1u] : NaN;
    const C2 = c2 ? parseFloat(c2) * cMul[c2u] : NaN;
    const V2 = v2 ? parseFloat(v2) * vMul[v2u] : NaN;

    const filled = [!isNaN(C1), !isNaN(V1), !isNaN(C2), !isNaN(V2)];
    const count = filled.filter(Boolean).length;
    if (count < 3) { setDilError("请填写任意三个参数，自动计算第四个"); return; }
    if (count === 4) { setDilError("请留空一个参数让系统计算"); return; }

    // C1*V1 = C2*V2
    if (isNaN(C1)) {
      if (V1 === 0) { setDilError("V1不能为0"); return; }
      setDilResult(`C1 = ${fmtConc((C2 * V2) / V1)}`);
    } else if (isNaN(V1)) {
      if (C1 === 0) { setDilError("C1不能为0"); return; }
      setDilResult(`V1 (取母液) = ${fmtVol((C2 * V2) / C1)}`);
    } else if (isNaN(C2)) {
      if (V2 === 0) { setDilError("V2不能为0"); return; }
      setDilResult(`C2 = ${fmtConc((C1 * V1) / V2)}`);
    } else {
      if (C2 === 0) { setDilError("C2不能为0"); return; }
      setDilResult(`V2 (终体积) = ${fmtVol((C1 * V1) / C2)}`);
    }
  }

  function calcSerial() {
    const c0 = parseFloat(serialC0), factor = parseFloat(serialFactor), steps = parseInt(serialSteps);
    if (isNaN(c0) || isNaN(factor) || isNaN(steps) || factor <= 0 || steps <= 0) return;
    const results: { conc: number; log: string }[] = [];
    let cur = c0;
    for (let i = 0; i < steps; i++) {
      cur = i === 0 ? c0 / factor : results[i - 1].conc / factor;
      results.push({ conc: parseFloat(cur.toPrecision(4)), log: Math.log10(cur).toFixed(3) });
    }
    setSerialResults(results);
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">稀释计算器</h3>
      </div>
      <Tabs defaultValue="simple">
        <TabsList className="mb-4">
          <TabsTrigger value="simple">C1V1 = C2V2</TabsTrigger>
          <TabsTrigger value="serial">连续稀释</TabsTrigger>
        </TabsList>

        <TabsContent value="simple">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>填写任意三个参数，留空一个，系统自动计算</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["C1 (母液浓度)", c1, setC1, c1u, setC1u, concUnits],
                  ["V1 (母液体积)", v1, setV1, v1u, setV1u, volUnits],
                  ["C2 (终浓度)", c2, setC2, c2u, setC2u, concUnits],
                  ["V2 (终体积)", v2, setV2, v2u, setV2u, volUnits],
                ] as const).map(([label, val, setVal, unit, setUnit, units]) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="flex gap-2">
                      <Input type="number" value={val} onChange={(e) => (setVal as (v: string) => void)(e.target.value)} placeholder="留空自动计算" />
                      <select className="flex h-9 w-20 shrink-0 rounded-md border bg-transparent px-2 text-sm" value={unit} onChange={(e) => (setUnit as (v: string) => void)(e.target.value)}>
                        {(units as readonly string[]).map((u) => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={calcDilution} className="w-full">计算</Button>
              {dilError && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{dilError}</div>}
              {dilResult && <div className="rounded-lg bg-muted/50 p-4 text-center"><p className="text-2xl font-bold">{dilResult}</p></div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="serial">
          <Card>
            <CardHeader className="pb-3">
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
                      <tr><th className="px-3 py-2 text-left">步骤</th><th className="px-3 py-2 text-right">浓度</th><th className="px-3 py-2 text-right">LOG</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {serialResults.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">C{i + 1} = {i === 0 ? "C0" : `C${i}`}/X</td>
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
