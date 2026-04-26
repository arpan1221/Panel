import React from "react";

export type AgentKey = "implementer" | "interpreter" | "tagger" | "archivist" | "kernel";

export const AGENTS: Record<
  AgentKey,
  {
    name: string;
    color: string;
    bg: string;
    emoji: string;
    tagline: string;
    model: string;
    n: string;
  }
> = {
  implementer: {
    name: "Implementer",
    color: "var(--implementer)",
    bg: "var(--lilac)",
    emoji: "✍️",
    tagline: "plans + writes the code",
    model: "opus 4.7",
    n: "I",
  },
  interpreter: {
    name: "Interpreter",
    color: "var(--interpreter)",
    bg: "var(--sky)",
    emoji: "🔍",
    tagline: "reads the output",
    model: "sonnet 4.6",
    n: "II",
  },
  tagger: {
    name: "Tagger",
    color: "var(--tagger)",
    bg: "var(--peach)",
    emoji: "🏷️",
    tagline: "makes it navigable",
    model: "haiku 4.5",
    n: "III",
  },
  archivist: {
    name: "Archivist",
    color: "var(--archivist)",
    bg: "var(--mint)",
    emoji: "📚",
    tagline: "remembers what matters",
    model: "sonnet 4.6",
    n: "IV",
  },
  kernel: {
    name: "Kernel",
    color: "var(--ink)",
    bg: "var(--cream-2)",
    emoji: "⚙️",
    tagline: "runs your code",
    model: "jupyter",
    n: "K",
  },
};

export const TAG_STYLE: Record<string, { color: string; bg: string }> = {
  hypothesis: { color: "#5a3ec8", bg: "#e0d3ff" },
  "data-check": { color: "#1a8fb5", bg: "#b8e3ff" },
  "method-choice": { color: "#4f5d8c", bg: "#d6dcf0" },
  debug: { color: "#ff7a1a", bg: "#ffd8c2" },
  pivot: { color: "#d23a8a", bg: "#ffd1e8" },
  result: { color: "#2f9e5e", bg: "#c8efd4" },
  "pitfall-detected": { color: "#ff4d6d", bg: "#ffd6dd" },
  decision: { color: "#1a8fb5", bg: "#b8e3ff" },
};

export function FunMark({ size = 32 }: { size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size * 0.55,
          height: size * 0.55,
          background: "var(--implementer)",
          border: "2px solid var(--ink)",
          borderRadius: 4,
          transform: "rotate(-6deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: size * 0.1,
          width: size * 0.55,
          height: size * 0.55,
          background: "var(--tagger)",
          border: "2px solid var(--ink)",
          borderRadius: 4,
          transform: "rotate(8deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: size * 0.2,
          bottom: 0,
          width: size * 0.55,
          height: size * 0.55,
          background: "var(--archivist)",
          border: "2px solid var(--ink)",
          borderRadius: "50%",
        }}
      />
    </div>
  );
}

export function AgentPill({
  agent,
  suffix,
}: {
  agent: AgentKey;
  suffix?: string;
}) {
  const a = AGENTS[agent];
  return (
    <span className="agent-pill">
      <span className="agent-dot" style={{ background: a.color }} />
      <span style={{ color: a.color }}>{a.name}</span>
      {suffix ? (
        <span style={{ color: "var(--ink-3)", fontWeight: 500, marginLeft: 2 }}>
          · {suffix}
        </span>
      ) : null}
    </span>
  );
}

export function FunTag({ name }: { name: string }) {
  const m = TAG_STYLE[name] ?? { color: "var(--ink)", bg: "var(--cream-2)" };
  return (
    <span className="tag-fun" style={{ background: m.bg, color: m.color }}>
      {name}
    </span>
  );
}

export function StatBlock({
  n,
  label,
  color,
  rotate = 0,
}: {
  n: string | number;
  label: string;
  color: string;
  rotate?: number;
}) {
  return (
    <div
      className="card-tight"
      style={{
        padding: "14px 16px",
        background: color,
        transform: `rotate(${rotate}deg)`,
        minWidth: 120,
      }}
    >
      <div
        className="ser"
        style={{ fontSize: 40, lineHeight: 0.95, paddingBottom: 6 }}
      >
        {n}
      </div>
      <div className="eyebrow">{label}</div>
    </div>
  );
}

export function FunHeader({
  signedInEmail,
  health,
}: {
  signedInEmail: string | null;
  health: { ok: boolean; active: number };
}) {
  return (
    <header
      style={{
        padding: "32px 56px 0",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <FunMark size={40} />
      <div className="ser" style={{ fontSize: 38, lineHeight: 1, paddingBottom: 4 }}>
        Panel
      </div>
      <span className="chip" style={{ marginLeft: 8 }}>
        v1 · est. 2026
      </span>
      <span
        className="sticker animate-wiggle"
        style={{
          marginLeft: 16,
          background: health.ok ? "var(--lemon)" : "var(--peach)",
        }}
      >
        ● {health.ok ? `backend online · ${health.active} active` : "backend offline"}
      </span>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          gap: 10,
          alignItems: "center",
          fontSize: 12,
        }}
      >
        {signedInEmail ? (
          <>
            <span className="mono">{signedInEmail}</span>
            <form action="/auth/logout" method="POST">
              <button
                type="submit"
                className="btn-blob ghost"
                style={{ padding: "8px 14px", fontSize: 12 }}
              >
                sign out
              </button>
            </form>
          </>
        ) : null}
      </div>
    </header>
  );
}

export function StatusSticker({
  status,
}: {
  status: "running" | "complete" | "failed" | "unknown";
}) {
  if (status === "running") {
    return (
      <span
        className="sticker"
        style={{ background: "var(--hot)", color: "var(--cream)" }}
      >
        ● live
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span
        className="chip"
        style={{
          background: "var(--archivist)",
          color: "var(--cream)",
          borderColor: "var(--ink)",
        }}
      >
        ✓ done
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="chip"
        style={{
          background: "var(--hot)",
          color: "var(--cream)",
          borderColor: "var(--ink)",
        }}
      >
        ✗ failed
      </span>
    );
  }
  return <span className="chip">{status}</span>;
}
