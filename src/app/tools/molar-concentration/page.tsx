"use client";

import { useState } from "react";
import { Beaker } from "lucide-react";
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

type SolveFor = "mass" | "concentration" | "volume" | "mw";

export default function MolarConcentrationPage() {
  const [mass, setMass] = useState("");
  const [massUnit, setMassUnit] = useState("mg");
  const [concentration, setConcentration] = useState("");
  const [concUnit, setConcUnit] = useState("mM");
  const [volume, setVolume] = useState("");
  const [volUnit, setVolUnit] = useState("mL");
  const [mw, setMw] = useState("");
  const [solveFor, setSolveFor] = useState<SolveFor>("mass");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const massMultipliers: Record<string, number> = { pg: 1e-9, ng: 1e-6, ug: 1e-3, mg: 1, g: 1e3, kg: 1e6 };
  const concMultipliers: Record<string, number> = { fM: 1e-12, pM: 1e-9, nM: 1e-6, uM: 1e-3, mM: 1, M: 1e3 };
  const volMultipliers: Record<string, number> = { nL: 1e-6, uL: 1e-3, mL: 1, L: 1e3 };

  function calculate() {
    const m = parseFloat(mass);
    const c = parseFloat(concentration);
    const v = parseFloat(volume);
    const w = parseFloat(mw);
    setError(null);
    setResult(null);

    // Formula: mass(mg) = concentration(mM) × volume(mL) × MW(g/mol)
    // Convert all to base units: mg, mM, mL
    try {
      if (solveFor === "mass") {
        if (isNaN(c) || isNaN(v) || isNaN(w)) { setError("请填写浓度、体积和分子量"); return; }
        const c_mM = c * concMultipliers[concUnit];
        const v_mL = v * volMultipliers[volUnit];
        const result_mg = c_mM * v_mL * w;
        setResult(`质量 = ${formatResult(result_mg, "mg", massMultipliers)}`);
      } else if (solveFor === "concentration") {
        if (isNaN(m) || isNaN(v) || isNaN(w)) { setError("请填写质量、体积和分子量"); return; }
        const m_mg = m * massMultipliers[massUnit];
        const v_mL = v * volMultipliers[volUnit];
        const result_mM = m_mg / (v_mL * w);
        setResult(`浓度 = ${formatResult(result_mM, "mM", concMultipliers)}`);
      } else if (solveFor === "volume") {
        if (isNaN(m) || isNaN(c) || isNaN(w)) { setError("请填写质量、浓度和分子量"); return; }
        const m_mg = m * massMultipliers[massUnit];
        const c_mM = c * concMultipliers[concUnit];
        const result_mL = m_mg / (c_mM * w);
        setResult(`体积 = ${formatResult(result_mL, "mL", volMultipliers)}`);
      } else if (solveFor === "mw") {
        if (isNaN(m) || isNaN(c) || isNaN(v)) { setError("请填写质量、浓度和体积"); return; }
        const m_mg = m * massMultipliers[massUnit];
        const c_mM = c * concMultipliers[concUnit];
        const v_mL = v * volMultipliers[volUnit];
        const result_mw = m_mg / (c_mM * v_mL);
        setResult(`分子量 = ${result_mw.toPrecision(6)} g/mol`);
      }
    } catch {
      setError("计算出错，请检查输入");
    }
  }

  function formatResult(value_base: number, baseUnit: string, multipliers: Record<string, number>): string {
    const entries = Object.entries(multipliers).sort((a, b) => a[1] - b[1]);
    for (let i = entries.length - 1; i >= 0; i--) {
      const converted = value_base / entries[i][1];
      if (converted >= 0.001 && converted < 10000) {
        return `${converted.toPrecision(4)} ${entries[i][0]}`;
      }
    }
    return `${value_base.toPrecision(4)} ${baseUnit}`;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-2"><Link href="/tools" className="text-sm text-muted-foreground hover:text-primary">← 返回常用工具</Link></div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Beaker className="h-5 w-5 text-primary" /></div>
          <h1 className="text-3xl font-bold tracking-tight">摩尔浓度计算器</h1>
        </div>
        <p className="text-muted-foreground">公式: 质量 (mg) = 浓度 (mM) × 体积 (mL) × 分子量 (g/mol)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>计算参数</CardTitle>
          <CardDescription>选择要求解的变量，填写其余三项</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-2 block text-sm font-medium">求解目标</Label>
            <div className="flex flex-wrap gap-2">
              {([["mass", "质量"], ["concentration", "浓度"], ["volume", "体积"], ["mw", "分子量"]] as const).map(([key, label]) => (
                <Button key={key} size="sm" variant={solveFor === key ? "default" : "outline"} onClick={() => setSolveFor(key)}>{label}</Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">质量{solveFor === "mass" && " (待求解)"}</Label>
              <div className="flex gap-2">
                <Input type="number" value={mass} onChange={(e) => setMass(e.target.value)} disabled={solveFor === "mass"} placeholder={solveFor === "mass" ? "自动计算" : "0"} />
                <select className="flex h-9 w-20 rounded-md border bg-transparent px-2 text-sm" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
                  {["pg", "ng", "ug", "mg", "g", "kg"].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">浓度{solveFor === "concentration" && " (待求解)"}</Label>
              <div className="flex gap-2">
                <Input type="number" value={concentration} onChange={(e) => setConcentration(e.target.value)} disabled={solveFor === "concentration"} placeholder={solveFor === "concentration" ? "自动计算" : "0"} />
                <select className="flex h-9 w-20 rounded-md border bg-transparent px-2 text-sm" value={concUnit} onChange={(e) => setConcUnit(e.target.value)}>
                  {["fM", "pM", "nM", "uM", "mM", "M"].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">体积{solveFor === "volume" && " (待求解)"}</Label>
              <div className="flex gap-2">
                <Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} disabled={solveFor === "volume"} placeholder={solveFor === "volume" ? "自动计算" : "0"} />
                <select className="flex h-9 w-20 rounded-md border bg-transparent px-2 text-sm" value={volUnit} onChange={(e) => setVolUnit(e.target.value)}>
                  {["nL", "uL", "mL", "L"].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">分子量{solveFor === "mw" && " (待求解)"} (g/mol)</Label>
              <Input type="number" value={mw} onChange={(e) => setMw(e.target.value)} disabled={solveFor === "mw"} placeholder={solveFor === "mw" ? "自动计算" : "0"} />
            </div>
          </div>

          <Button onClick={calculate} className="w-full">计算</Button>

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {result && (
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">计算结果</p>
              <p className="text-2xl font-bold tracking-tight">{result}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
