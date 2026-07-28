import { createBrowserClient } from "@supabase/ssr";
import { navigatorLock } from "@supabase/supabase-js";

/**
 * auth-js serializes every session operation behind the exclusive Web Lock
 * "lock:sb-<ref>-auth-token", and it holds that lock for the whole duration of
 * the network call it wraps. Its built-in ceiling is 10s, which this project's
 * Supabase round-trip (~2-3s, see the middleware timings in `next dev`) can
 * blow through once a couple of operations queue up:
 *
 *   Acquiring an exclusive Navigator LockManager lock ... timed out waiting 10000ms
 *
 * supabase-js does not expose `lockAcquireTimeout`, but it does expose `lock`,
 * so we delegate to the library's own navigatorLock with a longer ceiling.
 * Cross-tab safety is unchanged — only the patience is.
 */
const LOCK_TIMEOUT_MS = 30_000;

// Built through a non-generic factory so the client keeps createBrowserClient's
// *default* type arguments. Annotating with ReturnType<typeof createBrowserClient>
// instantiates the generics at their constraints instead, which silently
// degrades auth callbacks to `any` across the app.
function build() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        lock: (name, _acquireTimeout, fn) =>
          navigatorLock(name, LOCK_TIMEOUT_MS, fn),
      },
    }
  );
}

type BrowserClient = ReturnType<typeof build>;

/**
 * One shared browser client per tab.
 *
 * Every createBrowserClient() call builds its own GoTrueClient, and each of
 * those independently contends for the lock above. This app mounts ~7
 * auth-aware components on /tools/lnp-formula, so a client per component meant
 * seven contenders on every page load.
 *
 * Kept lazy so the module can still be imported during SSR of a Client
 * Component without constructing a browser client on the server.
 */
let browserClient: BrowserClient | undefined;

export function createClient(): BrowserClient {
  return (browserClient ??= build());
}
