import Link from "next/link";
import { isAuthConfigured } from "@/lib/supabase";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const configured = isAuthConfigured();
  const next = searchParams.next ?? "/";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-8">
        <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
          sign in
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-50">Panel</h1>
        <p className="mt-3 text-sm text-neutral-400">
          {configured
            ? "Enter your email. We'll send you a magic link — no password."
            : "Auth isn't configured yet. The app is running open; any email lets you in."}
        </p>

        <div className="mt-6">
          <LoginForm configured={configured} next={next} />
        </div>

        <p className="mt-6 text-xs text-neutral-600">
          Public share pages (<code className="text-neutral-400">/share/…</code>)
          don&apos;t require a login.{" "}
          <Link href="/" className="text-neutral-400 hover:text-neutral-200">
            Back to home →
          </Link>
        </p>
      </div>
    </main>
  );
}
