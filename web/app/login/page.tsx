import Link from "next/link";
import { isAuthConfigured } from "@/lib/supabase";
import LoginForm from "./LoginForm";
import { FunMark } from "@/components/fun";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const configured = isAuthConfigured();
  const next = searchParams.next ?? "/";
  const error = searchParams.error;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 440,
          width: "100%",
          padding: 32,
          background: "var(--cream)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <FunMark size={32} />
          <span className="ser" style={{ fontSize: 28, lineHeight: 1 }}>
            Panel
          </span>
          <span className="chip" style={{ marginLeft: "auto" }}>
            sign in
          </span>
        </div>

        <h1
          className="ser"
          style={{
            fontSize: 34,
            lineHeight: 1.1,
            margin: 0,
            paddingBottom: 8,
          }}
        >
          Let&apos;s{" "}
          <span
            className="ser-i"
            style={{ color: "var(--implementer)" }}
          >
            get you in.
          </span>
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-2)",
            marginTop: 10,
            lineHeight: 1.5,
          }}
        >
          {configured
            ? "Enter your email. We'll send you a magic link — no password."
            : "Auth isn't configured yet. The app is running open; any email lets you in."}
        </p>

        {error ? (
          <div
            className="card-tight"
            style={{
              marginTop: 18,
              padding: 14,
              background: "var(--peach)",
              fontSize: 12,
              color: "var(--hot)",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 22 }}>
          <LoginForm configured={configured} next={next} />
        </div>

        <p
          style={{
            marginTop: 22,
            fontSize: 12,
            color: "var(--ink-3)",
            lineHeight: 1.5,
          }}
        >
          Public share pages (
          <span className="mono">/share/…</span>) don&apos;t require a login.{" "}
          <Link
            href="/"
            style={{ color: "var(--implementer)", textDecoration: "underline" }}
          >
            back to home →
          </Link>
        </p>
      </div>
    </main>
  );
}
