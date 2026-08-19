import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims verifies the JWT locally when asymmetric signing keys are in
  // use, avoiding a /auth/v1/user round-trip on every protected navigation.
  const { data: identity } = await supabase.auth.getClaims();

  // Protected routes: redirect to login if not authenticated.
  //
  // This only proves someone is signed in. Anything that needs a stronger
  // claim — /admin needing an app_admins row, for instance — must re-check
  // server-side in its own layout; Proxy cannot make that decision.
  if (
    !identity?.claims &&
    ["/profile"].some((prefix) => request.nextUrl.pathname.startsWith(prefix))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
