"use client";

import { ArrowRight } from "lucide-react";

export default function LnpWorkflow() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">新手入门: LNP 制备流程</h3>
      <p className="text-sm text-muted-foreground">
        LNP 的制备通常采用手动制备（涡旋或吹打）或微流控混合法，
        将溶解在乙醇中的脂质混合物与含 RNA 的水相快速混合，
        自组装形成包裹核酸的纳米颗粒。
      </p>

      {/* Horizontal flow diagram */}
      <div className="flex flex-col lg:flex-row items-stretch gap-4 lg:gap-2">
        {/* Step 1: Lipid Mix */}
        <div className="flex-1 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
              1
            </div>
            <h4 className="text-sm font-semibold">配制 Lipid Mix（脂相）</h4>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-8">
            <li>按摩尔比混合各脂质 stock solution</li>
            <li>
              典型配方：阳离子脂质 + 辅助脂质 + 胆固醇 + PEG 脂质
            </li>
            <li>溶剂：无水乙醇</li>
          </ul>
        </div>

        <div className="hidden lg:flex items-center text-muted-foreground">
          <ArrowRight className="h-5 w-5" />
        </div>

        {/* Step 2: Aqueous Phase */}
        <div className="flex-1 rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold">
              2
            </div>
            <h4 className="text-sm font-semibold">配制水相 (Aqueous)</h4>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-8">
            <li>RNA 溶于 pH 4.0 柠檬酸缓冲液</li>
            <li>N/P 比决定 RNA 与阳离子脂质的摩尔比</li>
            <li>FRR（流速比）决定水相 : 脂相体积比</li>
          </ul>
        </div>

        <div className="hidden lg:flex items-center text-muted-foreground">
          <ArrowRight className="h-5 w-5" />
        </div>

        {/* Step 3: Rapid Mixing */}
        <div className="flex-1 rounded-lg border-2 border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white text-xs font-bold">
              3
            </div>
            <h4 className="text-sm font-semibold">快速混合</h4>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-8">
            <li>微流控混合、手工移液混合或涡旋混合</li>
            <li>乙醇稀释使脂质自组装为纳米颗粒</li>
            <li>RNA 被包裹进 LNP 核心</li>
          </ul>
        </div>

        <div className="hidden lg:flex items-center text-muted-foreground">
          <ArrowRight className="h-5 w-5" />
        </div>

        {/* Step 4: LNP */}
        <div className="flex-1 rounded-lg border-2 border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">
              4
            </div>
            <h4 className="text-sm font-semibold">后处理与表征</h4>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-8">
            <li>透析或超滤除去乙醇，换为 PBS</li>
            <li>测量粒径 (DLS)、Zeta 电位</li>
            <li>测定包封率 (EE%) 、总RNA浓度和 RNA 完整性等</li>
          </ul>
        </div>
      </div>

      {/* Key formulas explanation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <p className="text-xs font-semibold">N/P 比</p>
          <p className="text-xs text-muted-foreground">
            阳离子脂质的可电离胺基 (N) 与核酸磷酸基 (P)
            的摩尔比。典型范围 4–10，常用 6。建议配置高浓度的lipid mix混合液, 可短期 -20°C 储存。
          </p>
        </div>
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <p className="text-xs font-semibold">FRR (Flow Rate Ratio)</p>
          <p className="text-xs text-muted-foreground">
            水相与脂相的体积/流速比。经典 LNP 配方一般为 3:1（水相:脂相）。小试微流控的流速一般为10-20 ml/min, 需要根据芯片类型进行优化。
          </p>
        </div>
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <p className="text-xs font-semibold">脂相浓度</p>
          <p className="text-xs text-muted-foreground">
            脂质在有机相中的总摩尔浓度 (mM)，由 Lipid Mix 浓度稀释至目标浓度。
            一般 4–20 mM。浓度会影响包封效率和粒径，一般高浓度具备高效率、大粒径，低浓度具有低效率、小粒径，浓度对手包的影响大于微流控。粒径显著影响 LNP 体内靶向性，需要慎重考量。
          </p>
        </div>
      </div>
    </div>
  );
}
