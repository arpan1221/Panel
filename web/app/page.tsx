async function getBackendHealth(): Promise<{
  ok: boolean;
  payload: unknown;
  error?: string;
}> {
  const backend = process.env.PANEL_BACKEND ?? "http://backend:8000";
  try {
    const res = await fetch(`${backend}/health`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, payload: null, error: `status ${res.status}` };
    }
    return { ok: true, payload: await res.json() };
  } catch (e) {
    return { ok: false, payload: null, error: String(e) };
  }
}

export default async function Home() {
  const health = await getBackendHealth();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Panel</h1>
      <p className="mt-2 text-neutral-400">
        An agentic workspace for data science experiments. Four agents,
        one deliberation, a shareable artifact at the end.
      </p>

      <section className="mt-10 rounded-lg border border-neutral-800 p-5">
        <h2 className="text-sm font-medium text-neutral-300">
          Backend connectivity
        </h2>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span
            className={
              "inline-block h-2 w-2 rounded-full " +
              (health.ok ? "bg-emerald-400" : "bg-rose-400")
            }
          />
          <span className="font-mono">
            {health.ok ? "online" : `offline: ${health.error ?? "unknown"}`}
          </span>
        </div>
        {health.payload ? (
          <pre className="mt-4 overflow-x-auto rounded bg-neutral-950 p-3 text-xs text-neutral-400">
            {JSON.stringify(health.payload, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="mt-8 grid grid-cols-4 gap-3 text-xs uppercase tracking-wider">
        <div className="rounded border border-implementer/40 bg-implementer/5 p-3 text-implementer">
          Implementer
        </div>
        <div className="rounded border border-interpreter/40 bg-interpreter/5 p-3 text-interpreter">
          Interpreter
        </div>
        <div className="rounded border border-tagger/40 bg-tagger/5 p-3 text-tagger">
          Tagger
        </div>
        <div className="rounded border border-archivist/40 bg-archivist/5 p-3 text-archivist">
          Archivist
        </div>
      </section>

      <p className="mt-12 text-xs text-neutral-600">
        v0.0.1 · dockerized scaffold · jury runtime lands next.
      </p>
    </main>
  );
}
