import Link from "next/link";
import {
  Wrench,
  Calculator,
  TestTubes,
  FlaskConical,
  Beaker,
  Scissors,
  Dna,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const tools = [
  {
    title: "分子量计算器",
    description: "输入化学式计算分子量，内置纳米药物递送常用化合物快捷选项。支持括号嵌套。",
    icon: Calculator,
    href: "/tools/mol-weight",
  },
  {
    title: "摩尔浓度计算器",
    description: "质量、浓度、体积、分子量四者互算。快速计算配液所需的溶质质量或溶液体积。",
    icon: Beaker,
    href: "/tools/molar-concentration",
  },
  {
    title: "稀释计算器",
    description: "C1V1 = C2V2 稀释计算，以及连续梯度稀释计算。",
    icon: FlaskConical,
    href: "/tools/dilution",
  },
  {
    title: "动物体内配方计算器",
    description: "根据给药剂量、动物体重和给药体积，计算助溶剂配方（DMSO/PEG300/Tween 80等）。",
    icon: TestTubes,
    href: "/tools/formulation",
  },
  {
    title: "同源重组连接计算器",
    description: "用于分子克隆实验，根据载体和目的DNA的浓度、片段大小、摩尔比计算各组分吸取量。",
    icon: Scissors,
    href: "/tools/ligation",
  },
  {
    title: "LNP 配方计算器",
    description: "基于 N/P 比和脂质摩尔比计算 LNP 各组分用量，默认 Moderna-like 配方。",
    icon: Dna,
    href: "/tools/lnp-formula",
  },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">常用工具</h1>
        </div>
        <p className="text-muted-foreground">
          为纳米药物递送和分子生物学研究设计的在线计算工具集
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="group">
            <Card className="h-full transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <tool.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base group-hover:text-primary transition-colors">
                  {tool.title}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {tool.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
