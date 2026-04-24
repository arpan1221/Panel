import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase-server";

/**
 * Magic-link callback. Supabase redirects here with a `code` query param;
 * we exchange it for a session cookie, then forward to `?next=…`.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const sb = serverClient();
    await sb.auth.exchangeCodeForSession(code);
  }

  const to = req.nextUrl.clone();
  to.pathname = next;
  to.search = "";
  return NextResponse.redirect(to);
}
