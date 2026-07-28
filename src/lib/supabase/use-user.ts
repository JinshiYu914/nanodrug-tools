"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./client";

/**
 * Shared auth state for the whole tab.
 *
 * Every `supabase.auth.getUser()` is a network round-trip AND it holds the
 * exclusive Web Lock "lock:sb-<ref>-auth-token" for the duration of that
 * request. Components that each called getUser() therefore serialized on the
 * lock: with ~2s of latency per call, six auth-aware panels on one page
 * (navbar + tab gate + four saved-item panels) queued past the 10s ceiling and
 * the stragglers died with:
 *
 *   Acquiring an exclusive Navigator LockManager lock ... timed out waiting 10000ms
 *
 * So this module resolves the user ONCE per tab and fans it out — and it does
 * so from `onAuthStateChange`'s INITIAL_SESSION event rather than a getUser()
 * call, which removes the extra round-trip and one whole lock acquisition.
 *
 * INITIAL_SESSION carries the session auth-js already recovered from the
 * cookie store, so `session.user` here is read from the stored JWT rather than
 * re-verified against the server. That is the right trade for *UI gating*:
 * actual authorization is enforced by RLS (`auth.uid() = user_id` on every
 * row) and by the middleware, which still calls getUser() server-side on
 * protected routes. Never treat this value as an authorization decision.
 */

export interface AuthState {
  user: User | null;
  loading: boolean;
}

// Stable references: useSyncExternalStore compares snapshots by identity, so a
// fresh object on every getSnapshot() would loop forever.
const SERVER_STATE: AuthState = { user: null, loading: true };
let state: AuthState = SERVER_STATE;

const listeners = new Set<() => void>();
let started = false;

function setState(next: AuthState) {
  state = next;
  for (const l of listeners) l();
}

function start() {
  if (started) return;
  started = true;

  const supabase = createClient();

  // Fires INITIAL_SESSION as soon as auth-js has recovered the stored session,
  // then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED for the life of the tab.
  // Never unsubscribed — this store lives as long as the tab does.
  supabase.auth.onAuthStateChange((_event, session) => {
    setState({ user: session?.user ?? null, loading: false });
  });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Current user + whether the initial lookup is still in flight. */
export function useUser(): AuthState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  );
}

/**
 * Read the resolved user outside React (event handlers that must not act on a
 * stale render). Resolves from the shared lookup instead of issuing a new one.
 */
export async function getCurrentUserId(): Promise<string | null> {
  start();
  if (!state.loading) return state.user?.id ?? null;
  return new Promise((resolve) => {
    const off = subscribe(() => {
      if (!state.loading) {
        off();
        resolve(state.user?.id ?? null);
      }
    });
  });
}
