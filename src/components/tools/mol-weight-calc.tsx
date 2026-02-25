"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  calculateMolecularWeight,
  COMMON_COMPOUNDS,
  type MolWeightResult,
} from "@/lib/calculations/molecular-weight";

export function MolWeightCalc() {
  const [formula, setFormula] = useState("");
  const [result, setResult] = useState<MolWeightResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCalculate() {
    if (!formula.trim()) {
      setError("Please enter a chemical formula");
      setResult(null);
      return;
    }
    const res = calculateMolecularWeight(formula.trim());
    if ("error" in res) {
      setError(res.error);
      setResult(null);
    } else {
      setResult(res);
      setError(null);
    }
  }

  function handleQuickFill(f: string) {
    setFormula(f);
    const res = calculateMolecularWeight(f);
    if (!("error" in res)) {
      setResult(res);
      setError(null);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Input Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>Input</CardTitle>
          </div>
          <CardDescription>
            Enter a chemical formula (e.g., H2O, C6H12O6, Ca(OH)2)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="formula">Chemical Formula</Label>
            <div className="flex gap-2">
              <Input
                id="formula"
                placeholder="e.g. C44H88NO8P"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
              />
              <Button onClick={handleCalculate}>Calculate</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Common compounds in nano drug delivery
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_COMPOUNDS.map((c) => (
                <Badge
                  key={c.name}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => handleQuickFill(c.formula)}
                >
                  {c.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
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
                  Molecular Weight
                </p>
                <p className="text-3xl font-bold tracking-tight">
                  {result.molecularWeight}
                </p>
                <p className="text-sm text-muted-foreground">g/mol</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Element Breakdown</p>
                <div className="space-y-1">
                  {result.composition.map((c) => (
                    <div
                      key={c.element}
                      className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-sm"
                    >
                      <span className="font-mono font-medium">
                        {c.element} &times; {c.count}
                      </span>
                      <span className="text-muted-foreground">
                        {c.weight.toFixed(3)} g/mol (
                        {((c.weight / result.molecularWeight) * 100).toFixed(
                          1
                        )}
                        %)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!result && !error && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Enter a formula and click Calculate to see results.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
