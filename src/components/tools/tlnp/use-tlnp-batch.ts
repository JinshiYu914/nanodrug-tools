"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  emptyTlnpExperiment,
  parseTlnpExperiment,
  serializeTlnpExperiment,
  type TlnpExperimentData,
} from "@/lib/calculations/tlnp-experiment";
import { updateItemData, type LnpSavedItem } from "@/lib/supabase/lnp-service";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";

/** Long enough that a sentence typed into a textarea is one write. */
const AUTOSAVE_DELAY_MS = 800;

export interface TlnpBatchState {
  batch: LnpSavedItem | null;
  data: TlnpExperimentData;
  /** Every edit goes through here; the blob is written back on a debounce. */
  update: (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => void;
  select: (item: LnpSavedItem) => void;
  clear: () => void;
  saving: boolean;
  lastSavedAt: Date | null;
  /** Bumped after each successful write so the sidebar re-reads updated_at. */
  refreshToken: number;
}

/**
 * Owns the active batch and writes it back to Supabase as it changes.
 *
 * The two refs are the same guards screening-mode.tsx uses: `loadingRef` swallows
 * the write that loading a batch would otherwise trigger, and `batchIdRef`
 * swallows the one caused by switching batches. Without them, opening a batch
 * immediately writes it back — harmless but it churns updated_at and makes the
 * sidebar reorder under the user's cursor.
 *
 * The debounce is the one deliberate difference. Screening mode only mutates on
 * discrete button presses so it saves immediately; this workbench is mostly
 * textareas, and per-keystroke PATCHes would be both slow and rude to the row.
 */
export function useTlnpBatch(): TlnpBatchState {
  const [batch, setBatch] = useState<LnpSavedItem | null>(null);
  const [data, setData] = useState<TlnpExperimentData>(emptyTlnpExperiment);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const batchIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  // Mirrors the latest data so the flush-on-unmount path writes what is on
  // screen rather than whatever the last effect closure captured.
  const pendingRef = useRef<{ id: string; data: TlnpExperimentData } | null>(
    null
  );

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    try {
      await updateItemData(pending.id, serializeTlnpExperiment(pending.data));
      setLastSavedAt(new Date());
      setRefreshToken((t) => t + 1);
    } catch (e) {
      console.error(e);
      toast.error(describeError(e, "004_tlnp_experiment.sql"));
    }
  }, []);

  useEffect(() => {
    if (!batch) return;
    if (loadingRef.current) {
      loadingRef.current = false;
      return;
    }
    if (batchIdRef.current !== batch.id) {
      batchIdRef.current = batch.id;
      return;
    }

    pendingRef.current = { id: batch.id, data };
    setSaving(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      void flush().finally(() => {
        if (!cancelled) setSaving(false);
      });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, batch, flush]);

  // A close/refresh mid-debounce would otherwise drop the last edit. This is
  // best-effort — the browser gives no guarantees — but it costs nothing.
  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      void flush();
    };
  }, [flush]);

  const update = useCallback(
    (updater: (prev: TlnpExperimentData) => TlnpExperimentData) => {
      setData(updater);
    },
    []
  );

  const select = useCallback((item: LnpSavedItem) => {
    loadingRef.current = true;
    batchIdRef.current = item.id;
    pendingRef.current = null;
    setBatch(item);
    setData(parseTlnpExperiment(item.data));
    setLastSavedAt(null);
    setSaving(false);
  }, []);

  const clear = useCallback(() => {
    batchIdRef.current = null;
    pendingRef.current = null;
    setBatch(null);
    setData(emptyTlnpExperiment());
    setLastSavedAt(null);
    setSaving(false);
  }, []);

  return {
    batch,
    data,
    update,
    select,
    clear,
    saving,
    lastSavedAt,
    refreshToken,
  };
}
