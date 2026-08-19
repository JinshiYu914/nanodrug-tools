export type CachedSelectionDecision =
  | "fetch-cloud"
  | "use-clean-cache"
  | "resume-draft"
  | "preserve-conflict";

/**
 * Decide whether selecting a lightweight sidebar row needs its full JSON body.
 *
 * The sidebar revision is refreshed when the page loads. A clean cache at the
 * same (or a newer locally-saved) revision is therefore safe to open without a
 * second Supabase request. Dirty drafts always win locally; CAS protects the
 * later save when the sidebar reports a newer cloud revision.
 */
export function decideCachedSelection(
  cache: { dirty: boolean; baseRevision: number } | null,
  summaryRevision: number
): CachedSelectionDecision {
  if (!cache) return "fetch-cloud";
  if (cache.dirty) {
    return cache.baseRevision >= summaryRevision
      ? "resume-draft"
      : "preserve-conflict";
  }
  return cache.baseRevision >= summaryRevision
    ? "use-clean-cache"
    : "fetch-cloud";
}
