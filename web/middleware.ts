import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured, middlewareClient } from "@/lib/supabase";

// Paths that never require auth.
const PUBLIC_PREFIXES = [
  "/share",
  "/login",
  "/auth",
  "/_next",
  "/favicon",
  "/api/public",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // If Supabase isn't configured, auth is disabled — let everything through.
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = middlewareClient(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
