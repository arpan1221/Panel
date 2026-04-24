import Link from "next/link";
import { listExperiments, SERVER_BACKEND } from "@/lib/backend";
import { isAuthConfigured } from "@/lib/supabase";
import { serverClient } from "@/lib/supabase-server";

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

function statusPill(status: string) {
  const color =
    status === "running"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : status === "complete"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "failed"
      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
      : "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${color}`}
    >
      {status}
    </span>
  );
}

const AGENTS: {
  role: "implementer" | "interpreter" | "tagger" | "archivist";
  label: string;
  tagline: string;
  detail: string;
  dot: string;
  border: string;
  tint: string;
}[] = [
  {
    role: "implementer",
    label: "Implementer",
    tagline: "writes the code",
    detail:
      "Plans the next step, records the hypothesis and alternatives considered, emits one or more cells. Sonnet 4.6.",
    dot: "bg-implementer",
    border: "border-implementer/40",
    tint: "bg-implementer/5",
  },
  {
    role: "interpreter",
    label: "Interpreter",
    tagline: "reads the output",
    detail:
      "Translates raw kernel output into plain English, names surprises, flags risks (leakage, collinearity, imbalance). Sonnet 4.6.",
    dot: "bg-interpreter",
    border: "border-interpreter/40",
    tint: "bg-interpreter/5",
  },
  {
    role: "tagger",
    label: "Tagger",
    tagline: "makes it navigable",
    detail:
      "Picks 1–3 tags from a fixed 8-tag vocabulary so the timeline can be scrubbed semantically. Haiku 4.5 — cheap on purpose.",
    dot: "bg-tagger",
    border: "border-tagger/40",
    tint: "bg-tagger/5",
  },
  {
    role: "archivist",
    label: "Archivist",
    tagline: "remembers what matters",
    detail:
      "Commits rare, high-confidence entries to a persistent knowledge base that future experiments consult. Silent by default.",
    dot: "bg-archivist",
    border: "border-archivist/40",
    tint: "bg-archivist/5",
  },
];

export default async function Home() {
  const [health, runs, signedInEmail] = await Promise.all([
    getHealth(),
    listExperiments().catch(() => ({ runs: [], count: 0 })),
    getSignedInEmail(),
  ]);

  const latestComplete = runs.runs.find((r) => r.status === "complete");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
            an agentic workspace for data-science experiments
          </div>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-neutral-50">
            Panel
          </h1>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <div className="flex items-center justify-end gap-2">
            <span
              className={
                "inline-block h-2 w-2 rounded-full " +
                (health.ok ? "bg-emerald-400" : "bg-rose-400")
              }
            />
            {health.ok
              ? `backend online · ${health.active} active`
              : "backend offline"}
          </div>
          {signedInEmail ? (
            <div className="mt-1 flex items-center justify-end gap-2">
              <span className="font-mono">{signedInEmail}</span>
              <form action="/auth/logout" method="POST">
                <button
                  type="submit"
                  className="rounded border border-neutral-800 px-2 py-0.5 text-[10px] uppercase tracking-wider hover:border-neutral-600 hover:text-neutral-300"
                >
                  sign out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </header>

      <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-100">
            Type a goal. Watch four agents run your experiment.{" "}
            <span className="text-neutral-400">
              Get a URL you can share.
            </span>
          </h2>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-neutral-400">
            Most data-science work dies in a notebook graveyard. The code
            survives; the reasoning evaporates. Panel runs your experiment as
            a panel of four specialized Claude agents who plan, execute,
            critique, tag, and curate — so the{" "}
            <em className="text-neutral-200">why</em> of the work is captured
            alongside the <em className="text-neutral-200">what</em>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/new"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              Start an experiment →
            </Link>
            {latestComplete ? (
              <Link
                href={`/experiment/${latestComplete.experiment_id}`}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:bg-neutral-900"
              >
                See a finished run
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-xs text-neutral-500">
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
            the artifact
          </div>
          <ul className="mt-3 space-y-2">
            <li>
              <span className="text-neutral-300">notebook.ipynb</span> — the
              actual code + outputs, ready for Jupyter or VS Code
            </li>
            <li>
              <span className="text-neutral-300">deliberation.jsonl</span> —
              every action the jury took, with evidence links
            </li>
            <li>
              <span className="text-neutral-300">knowledge.jsonl</span> — the
              Archivist&apos;s rare, high-confidence commits
            </li>
            <li>
              <span className="text-neutral-300">share URL</span> — open
              anywhere, no login required
            </li>
          </ul>
        </aside>
      </section>

      <section className="mt-12">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-neutral-600">
          the jury
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((a) => (
            <div
              key={a.role}
              className={`rounded-xl border p-4 ${a.border} ${a.tint}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${a.dot}`} />
                <span className="text-sm font-medium text-neutral-100">
                  {a.label}
                </span>
              </div>
              <div className="mt-1 text-xs italic text-neutral-400">
                {a.tagline}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-neutral-400">
                {a.detail}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          They run <em>sequentially</em>, one cell at a time. Each reacts to
          the previous one&apos;s output. This is the agentic loop — and the
          live dashboard shows you which stage is active as it unfolds.
        </p>
      </section>

      <section className="mt-12 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
          how it feels
        </div>
        <ol className="mt-4 space-y-4 text-sm text-neutral-300">
          <li className="flex gap-3">
            <span className="mt-0.5 rounded-full bg-neutral-800 px-2 text-xs text-neutral-400">
              1
            </span>
            <div>
              <span className="text-neutral-100">Type a goal</span> like{" "}
              <em>&ldquo;predict survival on Titanic and tell me which features
              actually matter.&rdquo;</em>{" "}
              Pick a dataset (presets ready, or drop your own path in).
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 rounded-full bg-neutral-800 px-2 text-xs text-neutral-400">
              2
            </span>
            <div>
              <span className="text-neutral-100">Press Run.</span> The backend
              spawns the jury as a subprocess and the dashboard starts
              streaming. You&apos;ll see the Implementer plan, the kernel
              execute, the Interpreter read, the Tagger classify, the
              Archivist decide.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 rounded-full bg-neutral-800 px-2 text-xs text-neutral-400">
              3
            </span>
            <div>
              <span className="text-neutral-100">Watch the pitfalls.</span>{" "}
              When the Interpreter catches data leakage, collinearity, or a
              wrong metric, it flags the step with{" "}
              <code className="rounded bg-black/50 px-1 text-rose-300">
                pitfall-detected
              </code>{" "}
              in red. The Implementer often pivots on the next turn.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 rounded-full bg-neutral-800 px-2 text-xs text-neutral-400">
              4
            </span>
            <div>
              <span className="text-neutral-100">Share the URL.</span> The
              finished run is a first-class artifact — a link you can send
              someone who will, in under a minute, see what happened and why.
            </div>
          </li>
        </ol>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
            past runs ({runs.count})
          </div>
          <Link
            href="/new"
            className="text-xs text-neutral-400 hover:text-neutral-200"
          >
            + new
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-neutral-900 rounded-xl border border-neutral-800">
          {runs.runs.length === 0 ? (
            <li className="p-4 text-sm text-neutral-500">
              No runs yet — launch one to see the jury in action.
            </li>
          ) : (
            runs.runs.slice().reverse().map((r) => (
              <li key={r.experiment_id} className="hover:bg-neutral-900/40">
                <Link
                  href={`/experiment/${r.experiment_id}`}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <div className="font-mono text-sm text-neutral-200">
                      {r.experiment_id}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {r.event_count} events
                    </div>
                  </div>
                  {statusPill(r.status)}
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <footer className="mt-16 flex items-center justify-between border-t border-neutral-900 pt-6 text-xs text-neutral-600">
        <span>
          Built with Claude Sonnet 4.6 · Haiku 4.5 · FastAPI · Next.js
        </span>
        <a
          href="https://github.com/arpan1221/Panel"
          className="hover:text-neutral-400"
        >
          github ↗
        </a>
      </footer>
    </main>
  );
}
