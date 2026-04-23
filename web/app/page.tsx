import Link from "next/link";
import { listExperiments, SERVER_BACKEND } from "@/lib/backend";
import NewRunForm from "./NewRunForm";

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

export default async function Home() {
  const [health, runs] = await Promise.all([
    getHealth(),
    listExperiments().catch(() => ({ runs: [], count: 0 })),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Panel</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Four agents run a data-science experiment together. Every decision
            is captured.
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <div className="flex items-center justify-end gap-2">
            <span
              className={
                "inline-block h-2 w-2 rounded-full " +
                (health.ok ? "bg-emerald-400" : "bg-rose-400")
              }
            />
            {health.ok ? `backend online · ${health.active} active` : "backend offline"}
          </div>
        </div>
      </header>

      <section className="mt-8 rounded-lg border border-neutral-800 p-5">
        <h2 className="text-sm font-medium text-neutral-300">
          New experiment
        </h2>
        <div className="mt-4">
          <NewRunForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-300">
          Past runs <span className="text-neutral-600">({runs.count})</span>
        </h2>
        <ul className="mt-3 divide-y divide-neutral-900 rounded-lg border border-neutral-800">
          {runs.runs.length === 0 ? (
            <li className="p-4 text-sm text-neutral-500">
              No runs yet — launch one above.
            </li>
          ) : (
            runs.runs.map((r) => (
              <li key={r.experiment_id} className="p-4 hover:bg-neutral-900/40">
                <Link
                  href={`/experiment/${r.experiment_id}`}
                  className="flex items-center justify-between"
                >
                  <div>
                    <div className="font-mono text-sm">{r.experiment_id}</div>
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
    </main>
  );
}
