"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collectLinkedFormulationIds,
  computeBatch,
  parseResultData,
} from "@/lib/calculations/ribogreen";
import type { RibogreenLink } from "@/lib/calculations/tlnp-experiment";
import { listAllItems, type LnpSavedItem } from "@/lib/supabase/lnp-service";
import { PERSONAL_SCOPE, type DataScope } from "@/lib/projects/types";

/**
 * Pull the key numbers for one row out of a saved RiboGreen record.
 *
 * `refId` is whatever the RiboGreen sample column was linked to — a prep sample
 * id before purification, a reaction system id after it. The two stages use the
 * same mechanism because they measure the same thing at different times.
 *
 * Always refits from the stored curve rather than trusting the record's cached
 * fit — that snapshot is documented as advisory only.
 */
export function extractLink(
  row: LnpSavedItem,
  refId: string
): RibogreenLink | null {
  const parsed = parseResultData(row.data);
  if (!parsed) return null;
  const source = parsed.rows.find((r) => r.sourceFormulationId === refId);
  if (!source) return null;

  const batch = computeBatch({
    rows: parsed.rows,
    curves: parsed.curves,
    correction: parsed.correction,
  });
  // Matched by id rather than by position: computeBatch is index-aligned today,
  // but silently importing another sample's numbers is the worst way to find
  // out that ever changed.
  const computed = batch.samples.find((s) => s.id === source.id);
  if (!computed) return null;

  return {
    itemId: row.id,
    itemName: row.name,
    sampleId: refId,
    sampleName: source.name,
    capturedAt: new Date().toISOString(),
    snapshot: {
      total_ng_uL: computed.total_ng_uL,
      lnpRna_ng_uL: computed.lnpRna_ng_uL,
      ee_percent: computed.ee_percent,
      yield_percent: computed.yield_percent,
      lnpVolume_uL: computed.sampleVolume_uL,
    },
  };
}

/**
 * refId → the saved RiboGreen records that measured it.
 *
 * One query for the whole module: every row filters the same map rather than
 * each firing its own request.
 */
export function useRibogreenRecords(enabled: boolean, scope: DataScope = PERSONAL_SCOPE) {
  const [map, setMap] = useState<Map<string, LnpSavedItem[]>>(() => new Map());
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const rows = await listAllItems("ribogreen_result", scope);
      const next = new Map<string, LnpSavedItem[]>();
      for (const row of rows) {
        for (const fid of collectLinkedFormulationIds(row.data)) {
          const list = next.get(fid);
          if (list) list.push(row);
          else next.set(fid, [row]);
        }
      }
      setMap(next);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [enabled, scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { records: map, loading, reload };
}
