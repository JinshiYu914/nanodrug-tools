"use client";

import { useCallback, useState } from "react";
import type { LnpSavedItem } from "@/lib/supabase/lnp-service";

interface Options {
  dirty: boolean;
  currentItemId: string | null;
  select: (
    candidate: LnpSavedItem,
    options?: { allowDirtySwitch?: boolean }
  ) => boolean;
  save: () => Promise<boolean>;
  onSelected: (item: LnpSavedItem) => void;
}

export function useWorkbenchItemSwitch({
  dirty,
  currentItemId,
  select,
  save,
  onSelected,
}: Options) {
  const [target, setTarget] = useState<LnpSavedItem | null>(null);
  const [savingBeforeSwitch, setSavingBeforeSwitch] = useState(false);

  const commitSelection = useCallback(
    (item: LnpSavedItem, allowDirtySwitch = false) => {
      if (!select(item, { allowDirtySwitch })) return false;
      onSelected(item);
      return true;
    },
    [onSelected, select]
  );

  const requestSelect = useCallback(
    (item: LnpSavedItem) => {
      if (item.id === currentItemId) return;
      if (dirty) {
        setTarget(item);
        return;
      }
      commitSelection(item);
    },
    [commitSelection, currentItemId, dirty]
  );

  const cancel = useCallback(() => {
    if (!savingBeforeSwitch) setTarget(null);
  }, [savingBeforeSwitch]);

  const keepDraftAndSwitch = useCallback(() => {
    if (!target) return;
    if (commitSelection(target, true)) setTarget(null);
  }, [commitSelection, target]);

  const saveAndSwitch = useCallback(async () => {
    if (!target) return;
    setSavingBeforeSwitch(true);
    try {
      const saved = await save();
      if (saved && commitSelection(target)) setTarget(null);
    } finally {
      setSavingBeforeSwitch(false);
    }
  }, [commitSelection, save, target]);

  return {
    target,
    savingBeforeSwitch,
    requestSelect,
    cancel,
    keepDraftAndSwitch,
    saveAndSwitch,
  };
}
