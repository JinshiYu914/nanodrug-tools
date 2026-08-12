import { Suspense } from "react";
import type { Metadata } from "next";
import IvtWorkbench from "@/components/tools/ivt/ivt-workbench";

export const metadata: Metadata = {
  title: "IVT mRNA 工作台 | LNP Partner",
  description: "按批次记录质粒线性化、IVT、RNA 纯化、得量和表达验证，并维护个人 RNA 库。",
};

export default function IvtPage() {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground sm:px-6">加载中...</div>}><IvtWorkbench /></Suspense>;
}
