import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/supabase";
import { serverClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  if (isAuthConfigured()) {
    const sb = serverClient();
    await sb.auth.signOut();
  }
  const to = req.nextUrl.clone();
  to.pathname = "/login";
  to.search = "";
  return NextResponse.redirect(to, { status: 303 });
}

export async function GET(req: NextRequest) {
  // Convenience — lets users hit /auth/logout in a browser.
  return POST(req);
}
