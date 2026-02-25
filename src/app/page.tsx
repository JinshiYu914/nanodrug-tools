import Link from "next/link";
import {
  FlaskConical,
  Wrench,
  TestTubes,
  Dna,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const tools = [
  {
    title: "常用工具",
    description:
      "分子量计算、摩尔浓度、稀释计算、动物体内配方、同源重组连接等实验室常用计算器。",
    icon: Wrench,
    href: "/tools",
    badge: "Free",
  },
  {
    title: "LNP Formulation Calculator",
    description:
      "基于 N/P 比和脂质摩尔比计算 LNP 各组分用量，支持自定义配方参数。",
    icon: TestTubes,
    href: "/tools/lnp-formula",
    badge: "Free",
  },
  {
    title: "Plasmid Manager",
    description:
      "保存和管理质粒序列，支持搜索、编辑和序列可视化查看。",
    icon: Dna,
    href: "/plasmid",
    badge: "Login Required",
  },
  {
    title: "Research",
    description:
      "LNP递送系统驱动下的mRNA疗法演进——从药物对比到核心设计、临床应用和前沿挑战。",
    icon: BookOpen,
    href: "/research",
    badge: "Free",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-24 text-center sm:px-6 sm:py-32">
          <div className="flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <FlaskConical className="h-4 w-4" />
            Open-source tools for nano drug delivery research
          </div>

          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Tools for{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-300">
              Nano Drug Delivery
            </span>{" "}
            Research
          </h1>

          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
            A suite of online calculators and utilities designed for
            researchers working with lipid nanoparticles, mRNA delivery systems,
            and nanomedicine.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/tools">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/research">
              <Button variant="outline" size="lg">
                Browse Research
              </Button>
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/20" />
      </section>

      {/* Tools Grid */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Online Tools</h2>
          <p className="mt-3 text-muted-foreground">
            Free calculators and utilities for your daily research workflow
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className="group">
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <tool.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {tool.badge}
                    </span>
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">
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
      </section>
    </div>
  );
}
