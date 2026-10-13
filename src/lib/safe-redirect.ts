/**
 * Accept a post-login / post-callback destination only if it is a same-site
 * path. Anything else — `//evil.com`, `/\evil.com`, `@evil.com`, a full URL —
 * falls back to `/`, so a crafted `?next=` can't bounce a freshly signed-in
 * user off to another origin.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}
