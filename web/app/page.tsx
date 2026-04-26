import { Fragment } from "react";
import Link from "next/link";
import { listExperiments, RunSummary, SERVER_BACKEND } from "@/lib/backend";
import { isAuthConfigured } from "@/lib/supabase";
import { serverClient } from "@/lib/supabase-server";
import {
  AGENTS,
  AgentKey,
  AgentPill,
  FunHeader,
  FunTag,
  StatusSticker,
} from "@/components/fun";

async function getSignedInEmail(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  try {
    const sb = serverClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}

async function getHealth(): Promise<{ ok: boolean; active: number }> {
  try {
    const res = await fetch(`${SERVER_BACKEND}/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false, active: 0 };
    const data = (await res.json()) as { active_runs?: number };
    return { ok: true, active: data.active_runs ?? 0 };
  } catch {
    return { ok: false, active: 0 };
  }
}

const ROLE_ORDER: AgentKey[] = ["implementer", "interpreter", "tagger", "archivist"];
const LOOP_ORDER: AgentKey[] = [
  "implementer",
  "kernel",
  "interpreter",
  "tagger",
  "archivist",
];

const ARCHIVE_TINTS = [
  "var(--mint)",
  "var(--lilac)",
  "var(--peach)",
  "var(--cream-2)",
  "var(--sky)",
];

function archiveTint(i: number, status: RunSummary["status"]) {
  if (status === "running") return "var(--peach)";
  if (status === "failed") return "var(--cream-2)";
  return ARCHIVE_TINTS[i % ARCHIVE_TINTS.length];
}

export default async function Home() {
  const [health, runs, signedInEmail] = await Promise.all([
    getHealth(),
    listExperiments().catch(() => ({ runs: [], count: 0 })),
    getSignedInEmail(),
  ]);

  const sortedRuns = runs.runs.slice().reverse();
  const latestComplete = sortedRuns.find((r) => r.status === "complete");

  return (
    <main style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
        <FunHeader signedInEmail={signedInEmail} health={health} />

        {/* Hero */}
        <section
          style={{
            padding: "40px 56px 24px",
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              ★ four agents, one experiment
            </div>
            <h1
              className="ser"
              style={{
                fontSize: 96,
                lineHeight: 1.05,
                margin: 0,
                paddingBottom: 6,
              }}
            >
              Type a goal.
              <br />
              <span
                style={{
                  background: "var(--lemon)",
                  padding: "2px 12px",
                  boxShadow: "4px 4px 0 var(--ink)",
                  display: "inline-block",
                  transform: "rotate(-1.5deg)",
                  border: "2.5px solid var(--ink)",
                  borderRadius: 6,
                  marginTop: 14,
                  marginBottom: 14,
                }}
              >
                Watch the jury
              </span>
              <br />
              <span
                className="ser-i"
                style={{
                  color: "var(--ink-3)",
                  fontSize: 88,
                  display: "inline-block",
                  marginTop: 18,
                }}
              >
                argue it out.
              </span>
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--ink-2)",
                maxWidth: 540,
                marginTop: 26,
              }}
            >
              Most data-science work dies in a notebook graveyard — the code
              survives, the reasoning evaporates. Panel runs your experiment as{" "}
              <strong>four specialised Claude agents</strong> who plan, execute,
              critique, tag, and curate. <strong>Opus 4.7</strong> plans every
              cell as the Implementer; Sonnet 4.6 interprets and archives;
              Haiku 4.5 tags. The{" "}
              <em className="ser-i">why</em> shows up next to the{" "}
              <em className="ser-i">what</em>.
            </p>
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 30,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Link href="/new" className="btn-blob animate-bounce2">
                ▶ Start an experiment
              </Link>
              {latestComplete ? (
                <Link
                  href={`/experiment/${latestComplete.experiment_id}`}
                  className="btn-blob ghost"
                >
                  See a finished run
                </Link>
              ) : null}
            </div>
          </div>

          <aside
            className="card"
            style={{ padding: 24, background: "var(--mint)" }}
          >
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              🎁 the artifact
            </div>
            <div
              className="ser"
              style={{ fontSize: 26, lineHeight: 1.1, paddingBottom: 12 }}
            >
              What you take home.
            </div>
            {(
              [
                ["notebook.ipynb", "the code + outputs, ready for Jupyter"],
                ["deliberation.jsonl", "every action the jury took"],
                ["knowledge.jsonl", "rare, high-confidence commits"],
                ["share URL", "open anywhere, no login"],
              ] as const
            ).map(([k, v], i) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 0",
                  borderTop: i ? "1.5px dashed var(--ink)" : "none",
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 13, fontWeight: 700, minWidth: 22 }}
                >
                  0{i + 1}
                </span>
                <div>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
                    {k}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}
                  >
                    {v}
                  </div>
                </div>
              </div>
            ))}
          </aside>
        </section>

        {/* Meet the jury */}
        <section style={{ padding: "40px 56px 28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 18,
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <h2
              className="ser"
              style={{
                fontSize: 52,
                margin: 0,
                lineHeight: 1.05,
                paddingBottom: 4,
              }}
            >
              Meet{" "}
              <span className="ser-i" style={{ color: "var(--implementer)" }}>
                the jury.
              </span>
            </h2>
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-2)",
                maxWidth: 320,
                textAlign: "right",
                fontStyle: "italic",
              }}
            >
              They run sequentially, one cell at a time. Each reacts to the
              previous one&apos;s output.
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
            }}
          >
            {ROLE_ORDER.map((k, i) => {
              const a = AGENTS[k];
              const rot = [-2, 1.5, -1, 2][i];
              return (
                <div
                  key={k}
                  className="card"
                  style={{
                    padding: 20,
                    background: a.bg,
                    transform: `rotate(${rot}deg)`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      className="ser"
                      style={{ fontSize: 30, color: a.color, lineHeight: 1 }}
                    >
                      {a.n}.
                    </span>
                    <span
                      style={{
                        fontSize: 38,
                        lineHeight: 1,
                        transform: "rotate(8deg)",
                        display: "inline-block",
                      }}
                    >
                      {a.emoji}
                    </span>
                  </div>
                  <div
                    className="ser"
                    style={{
                      fontSize: 28,
                      lineHeight: 1,
                      marginTop: 18,
                      paddingBottom: 4,
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    className="ser-i"
                    style={{ fontSize: 16, color: "var(--ink-2)", marginTop: 2 }}
                  >
                    {a.tagline}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      marginTop: 14,
                      padding: "3px 8px",
                      background: "var(--cream)",
                      border: "1.5px solid var(--ink)",
                      borderRadius: 999,
                      display: "inline-block",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {a.model}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 18px",
              border: "2px dashed var(--ink)",
              borderRadius: 10,
              flexWrap: "wrap",
            }}
          >
            <span className="eyebrow">the loop ↻</span>
            {LOOP_ORDER.map((s, i, arr) => (
              <Fragment key={s}>
                <AgentPill agent={s} />
                {i < arr.length - 1 ? (
                  <span
                    style={{
                      color: "var(--ink-3)",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    →
                  </span>
                ) : null}
              </Fragment>
            ))}
            <span
              style={{
                marginLeft: "auto",
                fontStyle: "italic",
                fontSize: 12,
                color: "var(--ink-3)",
              }}
            >
              per cell, until done.
            </span>
          </div>
        </section>

        {/* Past runs */}
        <section style={{ padding: "32px 56px 64px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 18,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <h2
              className="ser"
              style={{
                fontSize: 40,
                margin: 0,
                lineHeight: 1.1,
                paddingBottom: 2,
              }}
            >
              The archive 📂
            </h2>
            <Link href="/new" className="chip" style={{ cursor: "pointer" }}>
              + new
            </Link>
          </div>

          {sortedRuns.length === 0 ? (
            <div
              className="card-tight"
              style={{
                padding: 28,
                background: "var(--cream-2)",
                fontSize: 14,
                color: "var(--ink-2)",
                textAlign: "center",
              }}
            >
              No runs yet — launch one to see the jury in action.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 14,
              }}
            >
              {sortedRuns.map((r, i) => {
                const rot = [-1, 1, -0.5, 0.5][i % 4];
                return (
                  <Link
                    key={r.experiment_id}
                    href={`/experiment/${r.experiment_id}`}
                    className="card-tight"
                    style={{
                      padding: 18,
                      background: archiveTint(i, r.status),
                      transform: `rotate(${rot}deg)`,
                      textDecoration: "none",
                      color: "var(--ink)",
                      display: "block",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: "var(--ink-3)",
                            fontWeight: 700,
                          }}
                        >
                          {r.experiment_id}
                        </div>
                        <div
                          className="ser"
                          style={{
                            fontSize: 19,
                            lineHeight: 1.25,
                            paddingBottom: 2,
                            marginTop: 4,
                          }}
                        >
                          {r.event_count} events recorded
                        </div>
                      </div>
                      <StatusSticker status={r.status} />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 18,
                        marginTop: 14,
                        fontSize: 11,
                        color: "var(--ink-2)",
                      }}
                    >
                      <span>
                        <strong className="mono">{r.event_count}</strong> events
                      </span>
                      <span style={{ marginLeft: "auto", fontStyle: "italic" }}>
                        open →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <footer
          style={{
            padding: "20px 56px 36px",
            borderTop: "2px dashed var(--ink)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--ink-3)",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span>Built with Claude Opus 4.7 · Sonnet 4.6 · Haiku 4.5 · FastAPI · Next.js</span>
          <a
            href="https://github.com/arpan1221/Panel"
            className="mono"
            style={{ color: "var(--ink-3)", textDecoration: "none" }}
          >
            github.com/arpan1221/Panel ↗
          </a>
        </footer>
      </div>
    </main>
  );
}
