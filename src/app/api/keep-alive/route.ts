import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Must actually execute on every call — never statically optimized/cached.
export const dynamic = "force-dynamic";

/**
 * Keep-alive endpoint for the Supabase Free plan, which pauses a project after
 * 7 consecutive days without activity. A daily Vercel Cron (see vercel.json)
 * calls this route, which runs one lightweight query so the inactivity timer
 * keeps resetting. Under RLS the anon query returns no rows, but the request
 * still reaches Postgres and counts as activity.
 */
export async function GET(request: NextRequest) {
  // When CRON_SECRET is configured, only allow callers holding it (Vercel Cron
  // sends `Authorization: Bearer <CRON_SECRET>` automatically). If the secret
  // is not set, the endpoint stays open so it works with zero extra setup.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "missing Supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  // Any existing table works — this just needs to hit the database. RLS makes
  // the anon result empty, which is fine; the request itself is the activity.
  const { error } = await supabase.from("lnp_saved_items").select("id").limit(1);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, at: new Date().toISOString() },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
