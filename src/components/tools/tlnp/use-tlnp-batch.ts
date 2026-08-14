"use client";

import {
  emptyTlnpExperiment,
  parseTlnpExperiment,
  serializeTlnpExperiment,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";
import { useSyncedWorkbench } from "@/lib/supabase/use-synced-workbench";
import { PERSONAL_SCOPE, type DataScope } from "@/lib/projects/types";

const parseTlnp = (raw: unknown) =>
  parseTlnpExperiment(raw as Record<string, unknown> | null | undefined);

export function useTlnpBatch(userId: string | null, scope: DataScope = PERSONAL_SCOPE) {
  const state = useSyncedWorkbench<TlnpExperimentData>({
    userId,
    type: "tlnp_experiment",
    empty: emptyTlnpExperiment,
    parse: parseTlnp,
    serialize: serializeTlnpExperiment,
    autosaveDelay: 800,
    migration: "008_workbench_sync_safety.sql",
    scope,
  });
  return { ...state, batch: state.item };
}

export type TlnpBatchState = ReturnType<typeof useTlnpBatch>;
