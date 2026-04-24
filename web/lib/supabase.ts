/** Shared auth-config check. Safe for browser, server, and middleware runtimes. */
export function isAuthConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && key && !url.startsWith("your-") && !key.startsWith("your-"));
}
