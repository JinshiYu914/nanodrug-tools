export type CloudLoadDecision = "use-cloud" | "resume-draft" | "preserve-conflict";

/** Pure decision used when a cloud record and an optional local cache meet. */
export function decideCloudLoad(
  cache: { dirty: boolean; baseRevision: number } | null,
  cloudRevision: number
): CloudLoadDecision {
  if (!cache?.dirty) return "use-cloud";
  return cache.baseRevision === cloudRevision ? "resume-draft" : "preserve-conflict";
}
