"use client";

import { Wrench, Calculator, Beaker, FlaskConical, TestTubes, Scissors } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MolWeightCalc } from "@/components/tools/mol-weight-calc";
import { MolarConcCalc } from "@/components/tools/molar-conc-calc";
import { DilutionCalc } from "@/components/tools/dilution-calc";
import { FormulationCalc } from "@/components/tools/formulation-calc";
import { LigationCalc } from "@/components/tools/ligation-calc";

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Lab Toolbox</h1>
        </div>
        <p className="text-muted-foreground">Online calculation tools for nano drug delivery and molecular biology research</p>
      </div>

      <Tabs defaultValue="mol-weight" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger value="mol-weight" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-none">
            <Calculator className="h-3.5 w-3.5" /> 分子量
          </TabsTrigger>
          <TabsTrigger value="molar-conc" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-none">
            <Beaker className="h-3.5 w-3.5" /> 摩尔浓度
          </TabsTrigger>
          <TabsTrigger value="dilution" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-none">
            <FlaskConical className="h-3.5 w-3.5" /> 稀释
          </TabsTrigger>
          <TabsTrigger value="formulation" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-none">
            <TestTubes className="h-3.5 w-3.5" /> 动物体内配方
          </TabsTrigger>
          <TabsTrigger value="ligation" className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-none">
            <Scissors className="h-3.5 w-3.5" /> 同源重组连接
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mol-weight"><MolWeightCalc /></TabsContent>
        <TabsContent value="molar-conc"><MolarConcCalc /></TabsContent>
        <TabsContent value="dilution"><DilutionCalc /></TabsContent>
        <TabsContent value="formulation"><FormulationCalc /></TabsContent>
        <TabsContent value="ligation"><LigationCalc /></TabsContent>
      </Tabs>
    </div>
  );
}
