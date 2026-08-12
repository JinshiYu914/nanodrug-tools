"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  emptyIvtBatch,
  parseIvtBatch,
  serializeIvtBatch,
  type IvtBatchData,
} from "@/lib/calculations/ivt-experiment";
import { updateItemData, type LnpSavedItem } from "@/lib/supabase/lnp-service";
import { describeError } from "@/components/tools/ribogreen/use-ribogreen-saved";

const AUTOSAVE_DELAY_MS = 800;

export function useIvtBatch() {
  const [batch, setBatch] = useState<LnpSavedItem | null>(null);
  const [data, setData] = useState<IvtBatchData>(emptyIvtBatch);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const batchIdRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const pendingRef = useRef<{ id: string; data: IvtBatchData } | null>(null);

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    try {
      await updateItemData(pending.id, serializeIvtBatch(pending.data));
      setLastSavedAt(new Date());
      setRefreshToken((value) => value + 1);
    } catch (error) {
      console.warn("[ivt] 自动保存失败", error);
      toast.error(describeError(error, "006_ivt_mrna.sql"));
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
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSaving(true);
      void flush().finally(() => {
        if (!cancelled) setSaving(false);
      });
    }, AUTOSAVE_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [batch, data, flush]);

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      void flush();
    };
  }, [flush]);

  const update = useCallback(
    (updater: (previous: IvtBatchData) => IvtBatchData) => setData(updater),
    []
  );

  const select = useCallback((item: LnpSavedItem) => {
    loadingRef.current = true;
    batchIdRef.current = item.id;
    pendingRef.current = null;
    setBatch(item);
    setData(parseIvtBatch(item.data));
    setLastSavedAt(null);
    setSaving(false);
  }, []);

  const clear = useCallback(() => {
    batchIdRef.current = null;
    pendingRef.current = null;
    setBatch(null);
    setData(emptyIvtBatch());
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
