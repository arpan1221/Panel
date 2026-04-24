"use client";

import { DeliberationEvent, KnowledgeEntry } from "@/lib/backend";

export const TAG_COLORS: Record<string, string> = {
  hypothesis: "bg-violet-500/20 text-violet-200 border-violet-500/40",
  "data-check": "bg-sky-500/20 text-sky-200 border-sky-500/40",
  "method-choice": "bg-indigo-500/20 text-indigo-200 border-indigo-500/40",
  debug: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  pivot: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40",
  result: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  "pitfall-detected": "bg-rose-500/25 text-rose-200 border-rose-500/50",
  decision: "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
};

export function TagPill({ tag }: { tag: string }) {
  const cls =
    TAG_COLORS[tag] ?? "bg-neutral-700/30 text-neutral-300 border-neutral-600";
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {tag}
    </span>
  );
}

export type StepBundle = {
  step: number;
  plan: DeliberationEvent | null;
  code: DeliberationEvent | null;
  output: DeliberationEvent | null;
  interpretation: DeliberationEvent | null;
  tag: DeliberationEvent | null;
  knowledge: DeliberationEvent | null;
  error: DeliberationEvent | null;
  allTags: string[];
};

export function bundleEvents(events: DeliberationEvent[]): StepBundle[] {
  const byStep = new Map<number, StepBundle>();
  for (const e of events) {
    let b = byStep.get(e.step_number);
    if (!b) {
      b = {
        step: e.step_number,
        plan: null,
        code: null,
        output: null,
        interpretation: null,
        tag: null,
        knowledge: null,
        error: null,
        allTags: [],
      };
      byStep.set(e.step_number, b);
    }
    const slot = e.event_type as keyof StepBundle;
    if (slot in b && !b[slot]) {
      (b as unknown as Record<string, DeliberationEvent>)[slot] = e;
    }
    for (const t of e.semantic_tags) {
      if (!b.allTags.includes(t)) b.allTags.push(t);
    }
  }
  return [...byStep.values()].sort((a, b) => a.step - b.step);
}

function Lane({
  color,
  icon,
  label,
  subtitle,
  children,
}: {
  color: string;
  icon: string;
  label: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-md border-l-2 pl-4 ${color}`}>
      <header className="flex items-baseline gap-2">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
          {label}
        </span>
        {subtitle ? (
          <span className="text-[10px] text-neutral-600">{subtitle}</span>
        ) : null}
      </header>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

export function StepCard({ bundle }: { bundle: StepBundle }) {
  const { step, plan, code, output, interpretation, tag, knowledge, error } =
    bundle;

  let interpParsed: Record<string, unknown> | null = null;
  if (interpretation) {
    try {
      interpParsed = JSON.parse(interpretation.content.body);
    } catch {
      interpParsed = null;
    }
  }

  let planParsed: Record<string, unknown> | null = null;
  if (plan) {
    try {
      planParsed = JSON.parse(plan.content.body);
    } catch {
      planParsed = null;
    }
  }

  const hasError =
    !!error ||
    !!(output && output.content.summary.toLowerCase().startsWith("error"));

  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 font-mono text-xs text-neutral-400">
            step {step + 1}
          </span>
          <span className="text-sm text-neutral-200">
            {plan?.content.summary ?? "…"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {bundle.allTags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
          {hasError ? <TagPill tag="error" /> : null}
        </div>
      </header>

      <div className="space-y-4">
        {plan ? (
          <Lane
            color="border-implementer/70"
            icon="📘"
            label="Implementer · plan"
            subtitle={plan.event_id}
          >
            {planParsed && typeof planParsed.hypothesis === "string" ? (
              <div className="text-xs text-neutral-400">
                <span className="text-neutral-500">hypothesis · </span>
                {String(planParsed.hypothesis)}
              </div>
            ) : null}
            {plan.chosen_because ? (
              <div className="mt-1 rounded border-l border-neutral-800 pl-3 text-xs italic text-neutral-400">
                {plan.chosen_because}
              </div>
            ) : null}
            {plan.alternatives_considered.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-neutral-500 hover:text-neutral-300">
                  {plan.alternatives_considered.length} alternative
                  {plan.alternatives_considered.length > 1 ? "s" : ""}{" "}
                  considered
                </summary>
                <ul className="mt-1 space-y-1 pl-3">
                  {plan.alternatives_considered.map((a, i) => (
                    <li key={i} className="text-xs text-neutral-400">
                      <span className="text-neutral-300">{a.path}</span>
                      <span className="text-neutral-600"> — </span>
                      <span className="italic">{a.rejected_because}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Lane>
        ) : null}

        {code ? (
          <Lane
            color="border-implementer/70"
            icon="⚙"
            label="Implementer · code"
            subtitle={code.cell_ref ?? undefined}
          >
            <pre className="mt-1 overflow-x-auto rounded bg-black/70 p-3 text-[11px] leading-relaxed text-neutral-300">
              <code>{code.content.body}</code>
            </pre>
          </Lane>
        ) : null}

        {output ? (
          <Lane
            color="border-neutral-600"
            icon="▶"
            label="kernel · output"
            subtitle={output.event_id}
          >
            <pre
              className={`mt-1 overflow-x-auto rounded bg-black/50 p-3 text-[11px] leading-relaxed ${
                hasError ? "text-rose-300" : "text-neutral-400"
              }`}
            >
              {output.content.body.slice(0, 2400)}
              {output.content.body.length > 2400 ? "\n…" : ""}
            </pre>
          </Lane>
        ) : null}

        {interpretation && interpParsed ? (
          <Lane
            color="border-interpreter/70"
            icon="🔍"
            label="Interpreter · reads"
            subtitle={interpretation.event_id}
          >
            {typeof interpParsed.what_it_means === "string" ? (
              <div className="text-sm text-neutral-200">
                {String(interpParsed.what_it_means)}
              </div>
            ) : null}
            {Array.isArray(interpParsed.risks_or_concerns) &&
            interpParsed.risks_or_concerns.length > 0 ? (
              <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/5 p-3">
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-rose-300">
                  <span>⚠</span>
                  risks flagged ({interpParsed.risks_or_concerns.length})
                </div>
                <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-200">
                  {(interpParsed.risks_or_concerns as string[]).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {Array.isArray(interpParsed.verify_next) &&
            interpParsed.verify_next.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-neutral-500 hover:text-neutral-300">
                  verify_next ({interpParsed.verify_next.length})
                </summary>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-neutral-400">
                  {(interpParsed.verify_next as string[]).map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Lane>
        ) : null}

        {tag ? (
          <Lane
            color="border-tagger/70"
            icon="🏷"
            label="Tagger · semantic tags"
            subtitle={tag.event_id}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {tag.semantic_tags.length === 0 ? (
                <span className="text-xs text-neutral-500">(no tags)</span>
              ) : (
                tag.semantic_tags.map((t) => <TagPill key={t} tag={t} />)
              )}
            </div>
            {tag.content.body ? (
              <div className="mt-1 text-[11px] italic text-neutral-500">
                {tag.content.body}
              </div>
            ) : null}
          </Lane>
        ) : null}

        {knowledge ? (
          <Lane
            color="border-archivist/70"
            icon="📚"
            label="Archivist · knowledge committed"
            subtitle={knowledge.event_id}
          >
            <div className="rounded border border-archivist/40 bg-archivist/5 p-3">
              <div className="text-sm text-neutral-100">
                {knowledge.content.summary}
              </div>
              {knowledge.content.body ? (
                <div className="mt-1 text-[11px] text-neutral-500">
                  {knowledge.content.body}
                </div>
              ) : null}
            </div>
          </Lane>
        ) : null}
      </div>
    </article>
  );
}

export function KnowledgePanel({ knowledge }: { knowledge: KnowledgeEntry[] }) {
  if (knowledge.length === 0) return null;
  return (
    <aside className="mb-6 rounded-xl border border-archivist/40 bg-archivist/5 p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-archivist">
        <span>📚</span>
        knowledge base ({knowledge.length})
      </div>
      <ul className="mt-2 space-y-1.5">
        {knowledge.map((k) => (
          <li key={k.knowledge_id} className="text-sm">
            <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-archivist">
              {k.kind}
            </span>
            <span className="ml-2 text-neutral-200">{k.claim}</span>
            <span className="ml-2 text-[10px] text-neutral-500">
              conf {k.confidence.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
