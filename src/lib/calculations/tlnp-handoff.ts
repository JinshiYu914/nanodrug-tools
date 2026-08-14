/**
 * The tLNP ⇄ RiboGreen round trip.
 *
 * The workbench does not carry its own copy of the RiboGreen calculator. The
 * standard-curve editor, the plate grid, the batch fill and the correction
 * setting all live in the LNP Calculator's RiboGreen tab, and a second
 * implementation would drift from it the first time either changed. So the
 * workbench hands off: it sends the sample names over, the real calculator does
 * the work, and the result comes back as a link.
 *
 * The URL is the whole protocol, which keeps it refreshable and linkable:
 *
 *   out   /tools/lnp-formula?tab=ribogreen&tlnp=<batchId>&stage=prep|purify
 *   back  /tools/tlnp?batch=<batchId>&m=1|3&import=<recordId>
 *
 * Pure string builders and one parser — no React, no Supabase.
 */

/** Which set of names is being measured, and which module gets the results. */
export type HandoffStage = "prep" | "purify";

export interface TlnpHandoff {
  batchId: string;
  stage: HandoffStage;
  projectId?: string;
}

const STAGE_MODULE: Record<HandoffStage, "1" | "3"> = {
  prep: "1",
  purify: "3",
};

export const STAGE_LABELS: Record<HandoffStage, string> = {
  prep: "LNP 制备",
  purify: "LNP 纯化",
};

/** tLNP → the RiboGreen tab, carrying which batch and which stage to prefill. */
export function handoffUrl(batchId: string, stage: HandoffStage, projectId?: string): string {
  const p = new URLSearchParams({ tab: "ribogreen", tlnp: batchId, stage });
  if (projectId) p.set("project", projectId);
  return `/tools/lnp-formula?${p.toString()}`;
}

/** The RiboGreen tab → back to the module that asked, with a record to import. */
export function returnUrl(
  batchId: string,
  stage: HandoffStage,
  recordId: string,
  projectId?: string
): string {
  const p = new URLSearchParams({
    batch: batchId,
    m: STAGE_MODULE[stage],
    import: recordId,
  });
  if (projectId) p.set("project", projectId);
  return `/tools/tlnp?${p.toString()}`;
}

/** Read a handoff off the RiboGreen page's query string. Null when absent. */
export function parseHandoff(
  get: (key: string) => string | null
): TlnpHandoff | null {
  const batchId = get("tlnp");
  if (!batchId) return null;
  const raw = get("stage");
  const projectId = get("project") ?? undefined;
  return { batchId, stage: raw === "purify" ? "purify" : "prep", projectId };
}
