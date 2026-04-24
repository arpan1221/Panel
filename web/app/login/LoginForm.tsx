"use client";

import { browserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm({
  configured,
  next,
}: {
  configured: boolean;
  next: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;

    // Auth not configured → bypass, go where they wanted.
    if (!configured) {
      router.push(next || "/");
      return;
    }

    setSubmitting(true);
    try {
      const sb = browserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        next
      )}`;
      const { error: err } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-200">
        Magic link sent to <span className="font-mono">{email}</span>. Click it
        to finish signing in.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-xs uppercase tracking-wider text-neutral-500">
          email
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-sm text-neutral-200 focus:border-neutral-600 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
      >
        {submitting ? "Sending…" : configured ? "Send magic link" : "Continue"}
      </button>
      {error ? <div className="text-xs text-rose-400">{error}</div> : null}
    </form>
  );
}
