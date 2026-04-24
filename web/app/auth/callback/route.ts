import { NextRequest, NextResponse } from "next/server";
import { middlewareClient } from "@/lib/supabase-server";

/**
 * Magic-link callback. Supabase redirects here with a `code` query param;
 * we exchange it for a session cookie, then forward to `?next=…`.
 *
 * IMPORTANT: cookies must be written to the *response* object (not via
 * next/headers cookies()), otherwise `NextResponse.redirect()` drops them
 * and the next request looks unauthenticated.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    const back = new URL("/login", req.url);
    back.searchParams.set("error", errorDescription);
    return NextResponse.redirect(back);
  }

  // Build the response up front so the supabase client can attach cookies to it.
  const redirectTo = new URL(next, req.url);
  const response = NextResponse.redirect(redirectTo);

  if (!code) {
    const back = new URL("/login", req.url);
    back.searchParams.set("error", "missing_code");
    return NextResponse.redirect(back);
  }

  const supabase = middlewareClient(req, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const back = new URL("/login", req.url);
    back.searchParams.set("error", error.message);
    return NextResponse.redirect(back);
  }

  return response;
}
