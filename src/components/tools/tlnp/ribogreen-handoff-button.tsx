"use client";

import Link from "next/link";
import { Calculator, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { handoffUrl, type HandoffStage } from "@/lib/calculations/tlnp-handoff";

interface Props {
  batchId: string;
  stage: HandoffStage;
  disabled?: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}

/**
 * The trip out to the real RiboGreen calculator.
 *
 * A plain link, because the destination reads everything it needs off the URL.
 * Next to it, a refresh for the case where the record was saved in another tab
 * and this page hasn't looked for it since.
 *
 * Rendered as the primary action of its card: it is the step that fills the
 * whole characterization matrix, and as an outline button it read like one
 * option among several rather than the thing to do next.
 */
export default function RibogreenHandoffButton({
  batchId,
  stage,
  disabled,
  onRefresh,
  refreshing,
}: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        title="重新查找已保存的 RiboGreen 记录"
        className="p-1 text-muted-foreground hover:text-foreground"
      >
        {refreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
      </button>
      {disabled ? (
        <Button size="sm" className="h-8 gap-1.5 text-xs" disabled>
          <Calculator className="h-3.5 w-3.5" />
          输入酶标仪检测结果开始计算
        </Button>
      ) : (
        <Link href={handoffUrl(batchId, stage)}>
          <Button size="sm" className="h-8 gap-1.5 text-xs">
            <Calculator className="h-3.5 w-3.5" />
            输入酶标仪检测结果开始计算
          </Button>
        </Link>
      )}
    </div>
  );
}
