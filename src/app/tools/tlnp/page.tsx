import { Suspense } from "react";
import type { Metadata } from "next";
import TlnpWorkbench from "@/components/tools/tlnp/tlnp-workbench";

/**
 * Unlike the other tool pages this one is a Server Component: the workbench
 * reads `?batch=&m=` with useSearchParams, which Next requires be wrapped in a
 * Suspense boundary or the build fails on the prerender pass.
 *
 * Renders inside src/app/tools/layout.tsx's `.quiet`, which is what keeps the
 * dense grids here readable — see the note in globals.css.
 */
export const metadata: Metadata = {
  title: "tLNP 制备工作台 | LNP Partner",
  description:
    "按批次记录靶向 LNP 的完整实验链路：LNP 制备、偶联反应、纯化与体内外实验。",
};

export default function TlnpPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground sm:px-6">
          加载中...
        </div>
      }
    >
      <TlnpWorkbench />
    </Suspense>
  );
}
