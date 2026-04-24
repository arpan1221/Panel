import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/supabase";
import { middlewareClient } from "@/lib/supabase-server";

async function signOutAndRedirect(req: NextRequest) {
  const to = new URL("/login", req.url);
  const response = NextResponse.redirect(to, { status: 303 });

  if (isAuthConfigured()) {
    const supabase = middlewareClient(req, response);
    await supabase.auth.signOut();
  }
  return response;
}

export async function POST(req: NextRequest) {
  return signOutAndRedirect(req);
}

export async function GET(req: NextRequest) {
  return signOutAndRedirect(req);
}
