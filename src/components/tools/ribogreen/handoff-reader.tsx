"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { parseHandoff, type TlnpHandoff } from "@/lib/calculations/tlnp-handoff";

interface Props {
  onTab: (tab: string) => void;
  onHandoff: (h: TlnpHandoff) => void;
}

/**
 * Reads `?tab=` and the tLNP handoff off the URL and reports them up, once.
 *
 * Split into its own component purely so `useSearchParams` sits behind a
 * Suspense boundary — a client page that calls it directly opts the whole route
 * out of static prerendering and fails the build. Renders nothing.
 */
export default function HandoffReader({ onTab, onHandoff }: Props) {
  const params = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const tab = params.get("tab");
    if (tab) onTab(tab);

    const handoff = parseHandoff((k) => params.get(k));
    if (handoff) onHandoff(handoff);
  }, [params, onTab, onHandoff]);

  return null;
}
