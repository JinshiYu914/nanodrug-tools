"use client";

import {
  emptyTlnpExperiment,
  parseTlnpExperiment,
  serializeTlnpExperiment,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";
import { useSyncedWorkbench } from "@/lib/supabase/use-synced-workbench";

const parseTlnp = (raw: unknown) =>
  parseTlnpExperiment(raw as Record<string, unknown> | null | undefined);

export function useTlnpBatch(userId: string | null) {
  const state = useSyncedWorkbench<TlnpExperimentData>({
    userId,
    type: "tlnp_experiment",
    empty: emptyTlnpExperiment,
    parse: parseTlnp,
    serialize: serializeTlnpExperiment,
    autosaveDelay: 800,
    migration: "008_workbench_sync_safety.sql",
  });
  return { ...state, batch: state.item };
}

export type TlnpBatchState = ReturnType<typeof useTlnpBatch>;
