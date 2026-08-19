import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Public calculators and workbenches enforce data access through Supabase
  // RLS/client auth. Only the server-protected profile route needs Proxy work.
  matcher: ["/profile/:path*"],
};
