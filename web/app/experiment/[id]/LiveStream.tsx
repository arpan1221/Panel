"use client";

import {
  BROWSER_BACKEND,
  DeliberationEvent,
  KnowledgeEntry,
} from "@/lib/backend";
import { useEffect, useMemo, useRef, useState } from "react";

type Status = "running" | "complete" | "failed" | "unknown";

const TAG_COLORS: Record<string, string> = {
  hypothesis: "bg-violet-500/20 text-violet-200 border-violet-500/40",
  "data-check": "bg-sky-500/20 text-sky-200 border-sky-500/40",
  "method-choice": "bg-indigo-500/20 text-indigo-200 border-indigo-500/40",
  debug: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  pivot: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40",
  result: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  "pitfall-detected": "bg-rose-500/25 text-rose-200 border-rose-500/50",
  decision: "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
};

function TagPill({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag] ?? "bg-neutral-700/30 text-neutral-300 border-neutral-600";
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {tag}
    </span>
  );
}

// ---------- orchestration banner ----------

type Stage = "implementer" | "kernel" | "interpreter" | "tagger" | "archivist" | "idle";

function stageFromEvents(events: DeliberationEvent[], status: Status): Stage {
  if (status !== "running" && events.length > 0) return "idle";
  if (events.length === 0) return "implementer";
  const last = events[events.length - 1];
  switch (last.event_type) {
    case "plan":
    case "code":
      return "kernel"; // about to execute
    case "output":
      return "interpreter";
    case "interpretation":
      return "tagger";
    case "tag":
      return "archivist";
    case "knowledge":
      return "implementer"; // next loop iteration
    case "error":
      return "idle";
    default:
      return "idle";
  }
}

function OrchestrationBanner({
  stage,
  status,
  events,
  knowledge,
}: {
  stage: Stage;
  status: Status;
  events: DeliberationEvent[];
  knowledge: KnowledgeEntry[];
}) {
  const stages: { key: Stage; label: string; dot: string }[] = [
    { key: "implementer", label: "Implementer", dot: "bg-implementer" },
    { key: "kernel", label: "Kernel", dot: "bg-neutral-400" },
    { key: "interpreter", label: "Interpreter", dot: "bg-interpreter" },
    { key: "tagger", label: "Tagger", dot: "bg-tagger" },
    { key: "archivist", label: "Archivist", dot: "bg-archivist" },
  ];

  const currentStep = events.reduce((m, e) => Math.max(m, e.step_number), 0);
  const lastPlan = [...events]
    .reverse()
    .find((e) => e.event_type === "plan")?.content.summary;

  const statusCls =
    status === "running"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : status === "complete"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : status === "failed"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
      : "border-neutral-700 bg-neutral-800 text-neutral-400";

  return (
    <div className="sticky top-0 z-20 mb-6 rounded-lg border border-neutral-800 bg-neutral-950/90 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusCls}`}
        >
          {status === "running" ? "● live" : status}
        </span>
        <span className="text-sm text-neutral-400">
          step <span className="text-neutral-200">{currentStep + 1}</span> ·{" "}
          <span className="text-neutral-200">{events.length}</span> events ·{" "}
          <span className="text-neutral-200">{knowledge.length}</span> knowledge
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-0.5">
        {stages.map((s, i) => {
          const isActive = s.key === stage;
          const isPast =
            stages.findIndex((x) => x.key === stage) > i && status === "running";
          const isIdle = status !== "running";
          return (
            <div key={s.key} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  isActive && !isIdle
                    ? "border-white/40 bg-white/10 text-neutral-100"
                    : isPast
                    ? "border-neutral-700 bg-neutral-900 text-neutral-500"
                    : "border-neutral-800 bg-neutral-950 text-neutral-500"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isActive && !isIdle ? s.dot + " animate-pulse" : "bg-neutral-700"
                  }`}
                />
                {s.label}
              </div>
              {i < stages.length - 1 ? (
                <span className="px-1 text-neutral-700">→</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {lastPlan ? (
        <div className="mt-3 truncate text-xs text-neutral-500">
          <span className="text-neutral-600">currently:</span>{" "}
          <span className="text-neutral-300">{lastPlan}</span>
        </div>
      ) : null}
    </div>
  );
}

// ---------- step card ----------

type StepBundle = {
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

function bundleEvents(events: DeliberationEvent[]): StepBundle[] {
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

function StepCard({ bundle }: { bundle: StepBundle }) {
  const { step, plan, code, output, interpretation, tag, knowledge, error } = bundle;

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
                  {plan.alternatives_considered.length > 1 ? "s" : ""} considered
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

// ---------- main ----------

export default function LiveStream({
  experimentId,
  initialStatus,
  initialEvents,
  initialKnowledge,
}: {
  experimentId: string;
  initialStatus: Status;
  initialEvents: DeliberationEvent[];
  initialKnowledge: KnowledgeEntry[];
}) {
  const [events, setEvents] = useState<DeliberationEvent[]>(initialEvents);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>(initialKnowledge);
  const [status, setStatus] = useState<Status>(initialStatus);
  const seenIds = useRef<Set<string>>(
    new Set(initialEvents.map((e) => e.event_id))
  );

  useEffect(() => {
    if (status !== "running" && initialEvents.length > 0) return;

    const es = new EventSource(`${BROWSER_BACKEND}/events/${experimentId}`);

    es.addEventListener("deliberation", (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data) as DeliberationEvent;
        if (seenIds.current.has(parsed.event_id)) return;
        seenIds.current.add(parsed.event_id);
        setEvents((prev) => [...prev, parsed]);
        if (parsed.event_type === "knowledge") {
          // minimal synthetic KnowledgeEntry projection for the side panel
          setKnowledge((prev) => [
            ...prev,
            {
              knowledge_id: parsed.event_id,
              experiment_id: parsed.experiment_id,
              created_at: parsed.timestamp,
              claim: parsed.content.summary.replace(/^\[[^\]]+\]\s*/, ""),
              kind:
                (parsed.content.summary.match(/^\[([^\]]+)\]/)?.[1] as
                  | "pattern"
                  | "pitfall"
                  | "heuristic"
                  | "fact") ?? "heuristic",
              evidence_event_ids: parsed.evidence,
              confidence: parsed.confidence,
            },
          ]);
        }
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("done", (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data) as { status: Status };
        setStatus(parsed.status);
      } catch {
        setStatus("complete");
      }
      es.close();
    });

    return () => es.close();
  }, [experimentId, status, initialEvents.length]);

  const bundles = useMemo(() => bundleEvents(events), [events]);
  const stage = useMemo(
    () => stageFromEvents(events, status),
    [events, status]
  );

  return (
    <>
      <OrchestrationBanner
        stage={stage}
        status={status}
        events={events}
        knowledge={knowledge}
      />

      {knowledge.length > 0 ? (
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
      ) : null}

      <div className="space-y-4">
        {bundles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500">
            waiting for the jury to start…
          </div>
        ) : (
          bundles.map((b) => <StepCard key={b.step} bundle={b} />)
        )}
      </div>
    </>
  );
}
