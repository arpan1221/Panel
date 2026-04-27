"use client";

import { browserClient } from "@/lib/supabase-browser";
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
      <div
        className="card-tight"
        style={{
          padding: 16,
          background: "var(--mint)",
          fontSize: 14,
        }}
      >
        <div
          className="ser"
          style={{ fontSize: 18, paddingBottom: 4, fontWeight: 700 }}
        >
          ✉️ magic link sent
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
          check <span className="mono">{email}</span> — click the link to finish
          signing in.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "block" }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          📧 email
        </div>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="input-fun"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="btn-blob animate-bounce2"
        style={{
          background: "var(--implementer)",
          color: "var(--cream)",
          justifyContent: "center",
        }}
      >
        {submitting ? "Sending…" : configured ? "✨ Send magic link" : "Continue"}
      </button>
      {error ? (
        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--hot)" }}
        >
          {error}
        </div>
      ) : null}
    </form>
  );
}
