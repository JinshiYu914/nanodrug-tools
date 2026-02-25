"use client";

import { useState } from "react";
import {
  FlaskConical,
  Pill,
  Syringe,
  Dna,
  Star,
  ChevronDown,
  Target,
  Shield,
  Snowflake,
  Atom,
  Code,
  BoxSelect,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// --- Data ---
const drugTypes = [
  {
    key: "small_molecule",
    label: "小分子药物",
    sub: "化学合成",
    icon: Pill,
    data: {
      type: "化学合成小分子",
      func: "抑制/激活靶点",
      loc: "胞内/胞外",
      target: "< 15% (需有结合袋)",
      prod: "合成路线复杂",
      cycle: "长 (数年筛选)",
      desc: "传统药物的代表（如阿司匹林）。虽然口服方便，但无法靶向缺乏疏水结合袋的蛋白（Undruggable targets）。",
    },
  },
  {
    key: "antibody",
    label: "抗体/重组蛋白",
    sub: "大分子生物药",
    icon: Syringe,
    data: {
      type: "大分子蛋白质",
      func: "阻断/中和/标记",
      loc: "主要是胞外/膜表面",
      target: "膜表面蛋白",
      prod: "细胞株构建与纯化难",
      cycle: "中长",
      desc: "生物药的主流（如PD-1抗体）。特异性强，但难以进入细胞内部处理胞内靶点。",
    },
  },
  {
    key: "gene_therapy",
    label: "基因治疗",
    sub: "AAV/病毒载体",
    icon: Dna,
    data: {
      type: "病毒载体/DNA",
      func: "永久性基因修复",
      loc: "细胞核",
      target: "核内基因组",
      prod: "病毒滴度与质控难",
      cycle: "长",
      desc: "针对遗传病的根治手段。但病毒载体免疫原性强，且存在基因组整合的潜在致癌风险。",
    },
  },
  {
    key: "mrna",
    label: "mRNA 药物",
    sub: "长单链 RNA",
    icon: Star,
    highlight: true,
    data: {
      type: "长单链 RNA",
      func: "蛋白表达 (做加法)",
      loc: "细胞质 (核糖体)",
      target: "任意蛋白 (胞内/胞外)",
      prod: "体外转录 (通用工艺)",
      cycle: "极短 (平台化)",
      desc: "医学的第三次革命。无需进入细胞核，安全性高；序列即药物，开发速度极快（如COVID疫苗）。",
    },
  },
];

const mrnaSegments = [
  { key: "cap", label: "5' Cap", width: "10%", color: "bg-red-500", title: "5' Cap (帽结构)", desc: "Cap1结构类似人体天然mRNA。作用：1. 避免被RIG-I识别为病毒，逃避免疫清除；2. 招募eIF4E启动翻译。", breakthrough: "化学合成Cap类似物实现了高效率加帽。" },
  { key: "utr5", label: "5' UTR", width: "15%", color: "bg-orange-400", title: "5'/3' UTR (非翻译区)", desc: "来源于高表达基因（如α-珠蛋白）的序列。5' UTR影响核糖体结合；3' UTR调控mRNA的半衰期和稳定性。", breakthrough: "通过高通量筛选找到最优UTR组合。" },
  { key: "cds", label: "CDS", width: "50%", color: "bg-blue-500", title: "Coding Region (编码区)", desc: "决定蛋白氨基酸序列的区域。通过密码子优化（Codon Optimization）：提高GC含量，消除二级结构，防止核糖体停滞。", breakthrough: "N1-甲基假尿嘧啶 (m1Ψ) 修饰是核心，能显著降低免疫原性并提高翻译产量。" },
  { key: "utr3", label: "3' UTR", width: "15%", color: "bg-orange-400", title: "5'/3' UTR (非翻译区)", desc: "来源于高表达基因（如α-珠蛋白）的序列。5' UTR影响核糖体结合；3' UTR调控mRNA的半衰期和稳定性。", breakthrough: "通过高通量筛选找到最优UTR组合。" },
  { key: "polya", label: "Poly(A)", width: "10%", color: "bg-purple-500", title: "Poly(A) Tail (多聚腺苷酸尾)", desc: "长度通常在100-150 nt。与PABP蛋白结合形成环状结构，协同促进翻译起始，防止降解。", breakthrough: "精确控制尾部长度以平衡稳定性和生产难度。" },
];

const lnpComponents = [
  { name: "可电离阳离子脂质", ratio: 50, color: "bg-teal-500", textColor: "text-teal-700", desc: "LNP的核心技术。pH敏感开关：血液中(pH 7.4)电中性，减少毒性；内体中(pH < 6.5)带正电，破坏内体膜释放mRNA。" },
  { name: "胆固醇", ratio: 38.5, color: "bg-amber-400", textColor: "text-amber-600", desc: "调节LNP的刚性和流动性，填充脂质间隙，防止血液中颗粒解体，增强稳定性。" },
  { name: "辅助脂质 (DSPC)", ratio: 10, color: "bg-indigo-500", textColor: "text-indigo-700", desc: "维持脂质双分子层结构，辅助与细胞膜的融合 (Fusogenic)，促进内体逃逸。" },
  { name: "PEG-脂质", ratio: 1.5, color: "bg-pink-500", textColor: "text-pink-600", desc: "提供空间位阻效应，防止颗粒聚集，减少蛋白吸附，调控药代动力学（循环时间）。" },
];

const clinicalApps = [
  { type: "vaccine", name: "Comirnaty / Spikevax", dev: "Pfizer / Moderna", ind: "COVID-19", status: "已上市", desc: "验证了平台的快速响应能力，全球数十亿剂接种证明了安全性。" },
  { type: "vaccine", name: "mRESVIA (mRNA-1345)", dev: "Moderna", ind: "RSV (老年人)", status: "已上市 (2024)", desc: "扩展至呼吸道合胞病毒，展示了在老年人群中的效力。" },
  { type: "gene", name: "Onpattro (Patisiran)", dev: "Alnylam", ind: "hATTR 淀粉样变性", status: "已上市 (siRNA)", desc: "全球首款LNP药物，LNP技术的奠基石。" },
  { type: "oncology", name: "mRNA-4157 (V940)", dev: "Moderna/Merck", ind: "黑色素瘤", status: "Phase 3", desc: "个性化新抗原疫苗，联合PD-1抗体显著降低复发风险。" },
  { type: "gene", name: "NTLA-2001", dev: "Intellia", ind: "hATTR 淀粉样变性", status: "Phase 1", desc: "LNP递送CRISPR/Cas9，体内基因编辑，旨在一次给药终身治愈。" },
  { type: "protein", name: "mRNA-3705", dev: "Moderna", ind: "甲基丙二酸血症 (MMA)", status: "Phase 1/2", desc: "蛋白替代疗法，将肝脏变为工厂生产缺失的酶。" },
  { type: "oncology", name: "体内 CAR-T (CPTX-2309)", dev: "Capstan", ind: "自身免疫/肿瘤", status: "Preclinical", desc: "利用LNP在体内直接生成CAR-T，省去体外制备的昂贵流程。" },
];

const challenges = [
  { id: "targeting", icon: Target, iconColor: "text-red-500", title: "靶向递送：突破肝脏限制", problem: "90%以上的LNP因吸附ApoE而天然富集于肝脏。难以跨越血脑屏障 (BBB) 或特异性转染肺、脾、骨髓中的特定免疫细胞。", solutions: ["SORT技术：通过调节脂质电荷，实现对肺、脾的选择性靶向。", "主动靶向：LNP表面偶联抗体/配体（如生成体内CAR-T）。"] },
  { id: "safety", icon: Shield, iconColor: "text-blue-500", title: "安全性与免疫原性", problem: "PEG修饰可能引发'加速血液清除现象'(ABC)，导致重复给药失效。高剂量可电离脂质可能引发全身性炎症。", solutions: ["可生物降解脂质：引入酶切酯键，加快代谢，减少蓄积毒性。", "功能化脂质：开发免疫静默型脂质用于蛋白疗法。"] },
  { id: "stability", icon: Snowflake, iconColor: "text-cyan-500", title: "稳定性与给药方式", problem: "mRNA依赖冷链运输。LNP结构在冻干过程中易坍塌，复溶后粒径变化大。", solutions: ["新型给药：吸入式LNP（治疗囊性纤维化）和口服LNP。", "冻干工艺优化：筛选保护剂，实现常温储存。"] },
];

const filterTypes = [
  { key: "all", label: "全部" },
  { key: "vaccine", label: "疫苗" },
  { key: "oncology", label: "肿瘤" },
  { key: "gene", label: "基因编辑/沉默" },
  { key: "protein", label: "蛋白替代" },
];

export default function ResearchPage() {
  const [activeDrug, setActiveDrug] = useState("mrna");
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [activeLnp, setActiveLnp] = useState(0);
  const [clinicalFilter, setClinicalFilter] = useState("all");
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set());

  const currentDrug = drugTypes.find((d) => d.key === activeDrug)!;
  const currentSegment = activeSegment ? mrnaSegments.find((s) => s.key === activeSegment) : null;

  function toggleAccordion(id: string) {
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredApps = clinicalFilter === "all" ? clinicalApps : clinicalApps.filter((a) => a.type === clinicalFilter);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              <span className="block">突破药物开发的边界</span>
              <span className="block bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-blue-400">
                LNP驱动下的RNA疗法演进
              </span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              从基因沉默 (siRNA) 到蛋白表达 (mRNA)，医学正经历第三次革命。脂质纳米颗粒 (LNP)
              作为递送系统的基石，通过精密设计的载荷与载体，实现了从概念到重磅药物的跨越。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><a href="#engineering">探索核心技术</a></Button>
              <Button size="lg" variant="outline" asChild><a href="#clinical">查看临床进展</a></Button>
            </div>
          </div>
          <div className="flex items-center justify-center rounded-2xl bg-muted/50 p-8">
            <div className="text-center">
              <div className="mb-4 flex items-center justify-center gap-4 text-5xl">
                <FlaskConical className="h-12 w-12 text-teal-500" />
                <span className="text-2xl text-muted-foreground">→</span>
                <Shield className="h-12 w-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold">2020: 爆发点</h3>
              <p className="text-sm text-muted-foreground">COVID-19 疫苗验证了平台的快速响应能力</p>
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
                <span>极短开发周期</span>
                <span>非整合安全性</span>
                <span>通用工艺</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Drug Comparison */}
      <section id="comparison" className="border-b py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold">为什么要开发 mRNA 药物？</h2>
            <p className="mt-3 text-muted-foreground">相比传统小分子和抗体药物，mRNA技术具有独特的平台优势。</p>
          </div>
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex flex-col gap-2 lg:w-1/4">
              {drugTypes.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setActiveDrug(d.key)}
                  className={`rounded-lg border-l-4 p-4 text-left transition-all ${
                    activeDrug === d.key
                      ? "border-l-primary bg-primary/5 shadow"
                      : "border-l-transparent bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className={`font-bold ${d.highlight ? "text-teal-600 dark:text-teal-400" : ""}`}>{d.label}</div>
                  <div className="text-xs text-muted-foreground">{d.sub}</div>
                </button>
              ))}
            </div>
            <Card className="flex-1">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                    <currentDrug.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{currentDrug.data.type}</h3>
                    <p className="text-sm text-muted-foreground">{currentDrug.data.desc}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: "核心功能", value: currentDrug.data.func },
                    { label: "靶点范围", value: currentDrug.data.target },
                    { label: "作用场所", value: currentDrug.data.loc },
                    { label: "开发周期", value: currentDrug.data.cycle },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border bg-muted/30 p-4">
                      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.label}</span>
                      <p className="mt-1 font-semibold">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300">
                  <strong>生产难点:</strong> {currentDrug.data.prod}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Engineering: Payload & Carrier */}
      <section id="engineering" className="border-b py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12">
            <h2 className="text-3xl font-extrabold">核心设计原理：载荷与载体</h2>
            <p className="mt-3 text-muted-foreground">LNP-mRNA 药物的成功依赖于精密设计的"软件"（mRNA序列）与"硬件"（LNP组分）的完美配合。</p>
          </div>
          <div className="grid gap-10 lg:grid-cols-2">
            {/* mRNA Structure */}
            <div>
              <h3 className="mb-4 flex items-center gap-3 text-xl font-bold">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                  <Code className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </span>
                核心载荷：mRNA 序列优化
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">点击下方 mRNA 结构条的不同区段，了解如何通过序列设计优化稳定性和翻译效率。</p>
              <div className="mb-4 flex h-14 w-full overflow-hidden rounded-full font-mono text-xs font-bold text-white shadow-md select-none">
                {mrnaSegments.map((seg) => (
                  <button
                    key={seg.key}
                    onClick={() => setActiveSegment(seg.key)}
                    className={`${seg.color} flex items-center justify-center transition-all hover:brightness-110 ${activeSegment === seg.key ? "ring-2 ring-white ring-offset-1" : ""}`}
                    style={{ width: seg.width }}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
              <Card className="min-h-[180px]">
                <CardContent className="p-5">
                  {currentSegment ? (
                    <>
                      <h4 className="text-lg font-bold text-indigo-700 dark:text-indigo-400">{currentSegment.title}</h4>
                      <p className="mt-2 text-sm text-muted-foreground">{currentSegment.desc}</p>
                      <div className="mt-4 border-t pt-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">关键突破</span>
                        <p className="mt-1 text-sm font-medium">⭐ {currentSegment.breakthrough}</p>
                      </div>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      请点击上方区段，了解 5&apos; Cap, UTR, CDS 及 Poly(A) 尾在 mRNA 药物设计中的关键作用。
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* LNP Components */}
            <div>
              <h3 className="mb-4 flex items-center gap-3 text-xl font-bold">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                  <BoxSelect className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </span>
                递送载体：LNP 四大组分
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">点击下方组分查看各脂质成分的功能。</p>
              {/* CSS-based donut alternative: stacked bar + cards */}
              <div className="mb-4 flex h-10 w-full overflow-hidden rounded-full shadow-md select-none">
                {lnpComponents.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => setActiveLnp(i)}
                    className={`${c.color} flex items-center justify-center text-xs font-bold text-white transition-all hover:brightness-110 ${activeLnp === i ? "ring-2 ring-white ring-offset-1" : ""}`}
                    style={{ width: `${c.ratio}%` }}
                  >
                    {c.ratio >= 10 ? `${c.ratio}%` : ""}
                  </button>
                ))}
              </div>
              <div className="mb-4 flex flex-wrap justify-center gap-3 text-xs">
                {lnpComponents.map((c, i) => (
                  <button key={c.name} onClick={() => setActiveLnp(i)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${activeLnp === i ? "border-primary bg-primary/10 font-medium" : "border-border"}`}>
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.color}`} />
                    {c.name} ({c.ratio}%)
                  </button>
                ))}
              </div>
              <Card className="min-h-[130px]">
                <CardContent className="p-5 text-center">
                  <h4 className={`text-lg font-bold ${lnpComponents[activeLnp].textColor}`}>{lnpComponents[activeLnp].name}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{lnpComponents[activeLnp].desc}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Landscape */}
      <section id="clinical" className="border-b py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold">临床应用全景</h2>
            <p className="mt-3 text-muted-foreground">LNP-RNA 药物已从传染病疫苗拓展至肿瘤免疫、蛋白替代及基因编辑等领域。</p>
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            {filterTypes.map((f) => (
              <Button key={f.key} size="sm" variant={clinicalFilter === f.key ? "default" : "outline"} onClick={() => setClinicalFilter(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredApps.map((app) => (
              <Card key={app.name} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs uppercase">{app.type}</Badge>
                    <span className={`text-xs font-semibold ${app.status.includes("上市") ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>{app.status}</span>
                  </div>
                  <CardTitle className="text-lg">{app.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{app.dev} | {app.ind}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{app.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary Table */}
          <Card className="mt-8 overflow-hidden">
            <CardHeader className="bg-muted/50 pb-3">
              <CardTitle className="text-base">关键 LNP-RNA 药物研发状态汇总</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">药物名称/代号</th>
                    <th className="px-4 py-3 text-left font-medium">领域</th>
                    <th className="px-4 py-3 text-left font-medium">适应症</th>
                    <th className="px-4 py-3 text-left font-medium">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clinicalApps.map((app) => (
                    <tr key={app.name}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{app.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 uppercase text-muted-foreground">{app.type}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{app.ind}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={app.status.includes("上市") ? "default" : "secondary"} className="text-xs">{app.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      {/* Challenges & Frontiers */}
      <section id="challenges" className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold">研究前沿与关键挑战</h2>
            <p className="mt-3 text-muted-foreground">从"肝脏陷阱"走向精准医疗，LNP技术正在攻克最后的壁垒。</p>
          </div>
          <div className="space-y-3">
            {challenges.map((ch) => (
              <div key={ch.id} className="overflow-hidden rounded-lg border">
                <button onClick={() => toggleAccordion(ch.id)} className="flex w-full items-center justify-between bg-muted/30 px-5 py-4 text-left transition-colors hover:bg-muted/50">
                  <span className="flex items-center gap-2 font-bold">
                    <ch.icon className={`h-5 w-5 ${ch.iconColor}`} />
                    {ch.title}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openAccordions.has(ch.id) ? "rotate-180" : ""}`} />
                </button>
                {openAccordions.has(ch.id) && (
                  <div className="grid gap-4 border-t p-5 md:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase text-red-600 dark:text-red-400">困境</h4>
                      <p className="text-sm text-muted-foreground">{ch.problem}</p>
                    </div>
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase text-green-600 dark:text-green-400">前沿突破</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {ch.solutions.map((s) => (<li key={s} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />{s}</li>))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
