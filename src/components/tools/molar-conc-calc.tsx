"use client";

import { useState, useMemo } from "react";
import { Beaker, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { COMPOUNDS } from "@/lib/data/compounds";

const massUnits = ["pg", "ng", "ug", "mg", "g"];
const concUnits = ["nM", "uM", "mM", "M"];
const volUnits = ["uL", "mL", "L"];

const massToMg: Record<string, number> = { pg: 1e-9, ng: 1e-6, ug: 1e-3, mg: 1, g: 1e3 };
const concToMM: Record<string, number> = { nM: 1e-6, uM: 1e-3, mM: 1, M: 1e3 };
const volToML: Record<string, number> = { uL: 1e-3, mL: 1, L: 1e3 };

const categories = [...new Set(COMPOUNDS.map((c) => c.category))].sort();

export function MolarConcCalc() {
  const [mass, setMass] = useState("");
  const [massUnit, setMassUnit] = useState("mg");
  const [conc, setConc] = useState("");
  const [concUnit, setConcUnit] = useState("mM");
  const [vol, setVol] = useState("");
  const [volUnit, setVolUnit] = useState("mL");
  const [mw, setMw] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [compSearch, setCompSearch] = useState("");
  const [compCategory, setCompCategory] = useState("All");

  const filteredCompounds = useMemo(() => {
    let filtered = COMPOUNDS;
    if (compCategory !== "All") filtered = filtered.filter((c) => c.category === compCategory);
    if (compSearch) {
      const q = compSearch.toLowerCase();
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(q) || c.formula?.toLowerCase().includes(q));
    }
    return filtered;
  }, [compSearch, compCategory]);

  function calculate() {
    setError(null);
    setResult(null);

    const m = mass ? parseFloat(mass) * massToMg[massUnit] : NaN;
    const c = conc ? parseFloat(conc) * concToMM[concUnit] : NaN;
    const v = vol ? parseFloat(vol) * volToML[volUnit] : NaN;
    const w = mw ? parseFloat(mw) : NaN;

    const filled = [!isNaN(m), !isNaN(c), !isNaN(v), !isNaN(w)];
    const filledCount = filled.filter(Boolean).length;

    if (filledCount < 3) {
      setError("请填写任意三个参数，系统将自动计算第四个");
      return;
    }
    if (filledCount === 4) {
      setError("请留空一个参数让系统计算");
      return;
    }

    // mass(mg) = conc(mM) × vol(mL) × MW(g/mol)
    if (isNaN(m)) {
      const res = c * v * w;
      setResult(`质量 = ${autoFormat(res, massToMg, massUnits)}`);
    } else if (isNaN(c)) {
      if (v * w === 0) { setError("体积和分子量不能为0"); return; }
      const res = m / (v * w);
      setResult(`浓度 = ${autoFormat(res, concToMM, concUnits)}`);
    } else if (isNaN(v)) {
      if (c * w === 0) { setError("浓度和分子量不能为0"); return; }
      const res = m / (c * w);
      setResult(`体积 = ${autoFormat(res, volToML, volUnits)}`);
    } else {
      if (c * v === 0) { setError("浓度和体积不能为0"); return; }
      const res = m / (c * v);
      setResult(`分子量 = ${res.toPrecision(6)} g/mol`);
    }
  }

  function autoFormat(baseVal: number, multipliers: Record<string, number>, units: string[]): string {
    for (let i = units.length - 1; i >= 0; i--) {
      const converted = baseVal / multipliers[units[i]];
      if (converted >= 0.01 && converted < 10000) return `${converted.toPrecision(4)} ${units[i]}`;
    }
    return `${baseVal.toPrecision(4)} ${units[Math.floor(units.length / 2)]}`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Calculator */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            <CardTitle>摩尔浓度计算器</CardTitle>
          </div>
          <CardDescription>质量 (mg) = 浓度 (mM) × 体积 (mL) × 分子量 (g/mol)。填写任意三项，自动计算第四项。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">质量</Label>
              <div className="flex gap-2">
                <Input type="number" value={mass} onChange={(e) => setMass(e.target.value)} placeholder="留空自动计算" />
                <select className="flex h-9 w-20 shrink-0 rounded-md border bg-transparent px-2 text-sm" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
                  {massUnits.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">浓度</Label>
              <div className="flex gap-2">
                <Input type="number" value={conc} onChange={(e) => setConc(e.target.value)} placeholder="留空自动计算" />
                <select className="flex h-9 w-20 shrink-0 rounded-md border bg-transparent px-2 text-sm" value={concUnit} onChange={(e) => setConcUnit(e.target.value)}>
                  {concUnits.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">体积</Label>
              <div className="flex gap-2">
                <Input type="number" value={vol} onChange={(e) => setVol(e.target.value)} placeholder="留空自动计算" />
                <select className="flex h-9 w-20 shrink-0 rounded-md border bg-transparent px-2 text-sm" value={volUnit} onChange={(e) => setVolUnit(e.target.value)}>
                  {volUnits.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">分子量 (g/mol)</Label>
              <Input type="number" value={mw} onChange={(e) => setMw(e.target.value)} placeholder="留空自动计算 或从右侧选取" />
            </div>
          </div>

          <Button onClick={calculate} className="w-full">计算</Button>

          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          {result && (
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold tracking-tight">{result}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compound Library */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">化合物库</CardTitle>
          <CardDescription className="text-xs">搜索并点击一键填入分子量</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-8 text-sm" placeholder="搜索化合物..." value={compSearch} onChange={(e) => setCompSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant={compCategory === "All" ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setCompCategory("All")}>All</Badge>
            {categories.map((cat) => (
              <Badge key={cat} variant={compCategory === cat ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setCompCategory(cat)}>{cat}</Badge>
            ))}
          </div>
          <div className="max-h-72 overflow-y-auto space-y-0.5">
            {filteredCompounds.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">无匹配结果</p>
            ) : (
              filteredCompounds.map((c) => (
                <button
                  key={c.name}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                  onClick={() => setMw(String(c.mw))}
                >
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-muted-foreground">{c.mw}</span>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
