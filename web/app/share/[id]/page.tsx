import { notFound } from "next/navigation";
import { getExperiment } from "@/lib/backend";
import { bundleEvents, KnowledgePanel, StepCard } from "@/components/jury";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  try {
    const data = await getExperiment(params.id);
    const goal = data.meta?.goal ?? "Panel experiment";
    return {
      title: `Panel · ${params.id}`,
      description: goal.slice(0, 160),
    };
  } catch {
    return { title: `Panel · ${params.id}` };
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

export default async function SharePage({
  params,
}: {
  params: { id: string };
}) {
  let data;
  try {
    data = await getExperiment(params.id);
  } catch {
    notFound();
  }

  const bundles = bundleEvents(data.events);
  const knowledge = data.knowledge;
  const goal = data.meta?.goal;
  const dataset = data.meta?.dataset;
  const createdAt = data.meta?.created_at
    ? new Date(data.meta.created_at).toLocaleString()
    : null;

  // Cheap stats — count pitfalls, errors, tags surfaced.
  const tagCounts: Record<string, number> = {};
  for (const e of data.events) {
    for (const t of e.semantic_tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">
              Panel · shared experiment
            </div>
            <div className="mt-1 font-mono text-sm text-neutral-400">
              {data.experiment_id}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusPill(data.status)}
            <a
              href={`/experiment/${data.experiment_id}`}
              className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800"
            >
              Open in dashboard ↗
            </a>
          </div>
        </div>

        {goal ? (
          <h1 className="mt-4 text-xl font-medium text-neutral-100">
            {goal}
          </h1>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500">
          {dataset ? (
            <span>
              <span className="text-neutral-600">dataset · </span>
              <span className="font-mono text-neutral-300">{dataset}</span>
            </span>
          ) : null}
          {createdAt ? (
            <span>
              <span className="text-neutral-600">started · </span>
              <span className="text-neutral-300">{createdAt}</span>
            </span>
          ) : null}
          <span>
            <span className="text-neutral-600">events · </span>
            <span className="text-neutral-300">{data.event_count}</span>
          </span>
          <span>
            <span className="text-neutral-600">steps · </span>
            <span className="text-neutral-300">{bundles.length}</span>
          </span>
          <span>
            <span className="text-neutral-600">knowledge · </span>
            <span className="text-neutral-300">{knowledge.length}</span>
          </span>
        </div>

        {topTags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {topTags.map(([tag, count]) => (
              <span
                key={tag}
                className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400"
              >
                {tag} <span className="text-neutral-600">· {count}</span>
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className="mt-8">
        <KnowledgePanel knowledge={knowledge} />

        <div className="space-y-4">
          {bundles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500">
              this experiment has no events yet.
            </div>
          ) : (
            bundles.map((b) => <StepCard key={b.step} bundle={b} />)
          )}
        </div>
      </div>

      <footer className="mt-12 flex items-center justify-between border-t border-neutral-900 pt-6 text-xs text-neutral-600">
        <span>
          Rendered from <code className="text-neutral-500">deliberation.jsonl</code>.
          No login required.
        </span>
        <a href="/" className="hover:text-neutral-400">
          Panel →
        </a>
      </footer>
    </main>
  );
}
