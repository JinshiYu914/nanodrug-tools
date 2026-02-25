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
import {
  calculateLnpFormulation,
  DEFAULT_LNP_INPUT,
  type LnpInput,
  type LnpResult,
} from "@/lib/calculations/lnp-formula";

export default function LnpFormulaPage() {
  const [input, setInput] = useState<LnpInput>(DEFAULT_LNP_INPUT);
  const [result, setResult] = useState<LnpResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof LnpInput, value: string) {
    const numValue = parseFloat(value);
    if (field === "naType") {
      setInput((prev) => ({ ...prev, naType: value as LnpInput["naType"] }));
    } else {
      setInput((prev) => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
    }
  }

  function handleCalculate() {
    const res = calculateLnpFormulation(input);
    if ("error" in res) {
      setError(res.error);
      setResult(null);
    } else {
      setResult(res);
      setError(null);
    }
  }

  function handleReset() {
    setInput(DEFAULT_LNP_INPUT);
    setResult(null);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <TestTubes className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            LNP Formulation Calculator
          </h1>
        </div>
        <p className="text-muted-foreground">
          Calculate lipid nanoparticle formulations based on N/P ratio and molar
          ratios. Default values are based on SM-102/DSPC/Chol/DMG-PEG2000
          (Moderna-like formulation).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Input Panel */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Formulation Parameters</CardTitle>
            <CardDescription>
              Adjust parameters below. Molar ratios must sum to 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Parameters */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Nucleic Acid Type</Label>
                <select
                  className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={input.naType}
                  onChange={(e) => update("naType", e.target.value)}
                >
                  <option value="mRNA">mRNA</option>
                  <option value="siRNA">siRNA</option>
                  <option value="pDNA">pDNA</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>N/P Ratio</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={input.npRatio}
                  onChange={(e) => update("npRatio", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nucleic Acid (µg)</Label>
                <Input
                  type="number"
                  step="1"
                  value={input.naAmount}
                  onChange={(e) => update("naAmount", e.target.value)}
                />
              </div>
            </div>

            {/* Molar Ratios */}
            <div>
              <Label className="mb-3 block text-sm font-medium">
                Lipid Molar Ratios (%)
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Ionizable Lipid
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={input.ionizableLipidRatio}
                    onChange={(e) =>
                      update("ionizableLipidRatio", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Helper Lipid
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={input.helperLipidRatio}
                    onChange={(e) => update("helperLipidRatio", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Cholesterol
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={input.cholesterolRatio}
                    onChange={(e) => update("cholesterolRatio", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    PEG-Lipid
                  </Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={input.pegLipidRatio}
                    onChange={(e) => update("pegLipidRatio", e.target.value)}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Sum:{" "}
                <span
                  className={
                    Math.abs(
                      input.ionizableLipidRatio +
                        input.helperLipidRatio +
                        input.cholesterolRatio +
                        input.pegLipidRatio -
                        100
                    ) > 0.1
                      ? "text-destructive font-medium"
                      : "text-green-600 dark:text-green-400 font-medium"
                  }
                >
                  {(
                    input.ionizableLipidRatio +
                    input.helperLipidRatio +
                    input.cholesterolRatio +
                    input.pegLipidRatio
                  ).toFixed(1)}
                  %
                </span>
              </p>
            </div>

            {/* Lipid MWs */}
            <div>
              <Label className="mb-3 block text-sm font-medium">
                Lipid Molecular Weights (g/mol)
              </Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Ionizable Lipid MW
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={input.ionizableLipidMW}
                    onChange={(e) =>
                      update("ionizableLipidMW", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Helper Lipid MW
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={input.helperLipidMW}
                    onChange={(e) => update("helperLipidMW", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    PEG-Lipid MW
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={input.pegLipidMW}
                    onChange={(e) => update("pegLipidMW", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleCalculate} className="flex-1">
                Calculate
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Total Lipid Mass
                  </p>
                  <p className="text-3xl font-bold tracking-tight">
                    {result.totalLipidMass}
                  </p>
                  <p className="text-sm text-muted-foreground">µg</p>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      label: "Ionizable Lipid",
                      value: result.ionizableLipidMass,
                    },
                    { label: "Helper Lipid", value: result.helperLipidMass },
                    { label: "Cholesterol", value: result.cholesterolMass },
                    { label: "PEG-Lipid", value: result.pegLipidMass },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span>{item.label}</span>
                      <span className="font-mono font-medium">
                        {item.value} µg
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NA Amount</span>
                    <span className="font-medium">{result.naAmount} µg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Lipid/NA Ratio (w/w)
                    </span>
                    <span className="font-medium">{result.lipidToNARatio}</span>
                  </div>
                </div>
              </div>
            )}

            {!result && !error && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Adjust parameters and click Calculate.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
