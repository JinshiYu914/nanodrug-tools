"use client";

import {
  emptyIvtBatch,
  parseIvtBatch,
  serializeIvtBatch,
  type IvtBatchData,
} from "@/lib/calculations/ivt-experiment";
import { useSyncedWorkbench } from "@/lib/supabase/use-synced-workbench";

export function useIvtBatch(userId: string | null) {
  const state = useSyncedWorkbench<IvtBatchData>({
    userId,
    type: "ivt_batch",
    empty: emptyIvtBatch,
    parse: parseIvtBatch,
    serialize: serializeIvtBatch,
    migration: "008_workbench_sync_safety.sql",
  });
  return { ...state, batch: state.item };
}
