"use client";

import {
  BROWSER_BACKEND,
  DeliberationEvent,
  KnowledgeEntry,
} from "@/lib/backend";
import { useEffect, useMemo, useRef, useState } from "react";

type Status = "running" | "complete" | "failed" | "unknown";

const AGENT_META: Record<
  DeliberationEvent["agent"],
  { label: string; ring: string; tint: string; dot: string }
> = {
  implementer: {
    label: "Implementer",
    ring: "border-implementer/40",
    tint: "bg-implementer/5",
    dot: "bg-implementer",
  },
  interpreter: {
    label: "Interpreter",
    ring: "border-interpreter/40",
    tint: "bg-interpreter/5",
    dot: "bg-interpreter",
  },
  tagger: {
    label: "Tagger",
    ring: "border-tagger/40",
    tint: "bg-tagger/5",
    dot: "bg-tagger",
  },
  archivist: {
    label: "Archivist",
    ring: "border-archivist/40",
    tint: "bg-archivist/5",
    dot: "bg-archivist",
  },
};

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

function EventCard({ event }: { event: DeliberationEvent }) {
  const meta = AGENT_META[event.agent];
  const isCode = event.event_type === "code";
  const isOutput = event.event_type === "output";
  const isInterp = event.event_type === "interpretation";
  const isKnowledge = event.event_type === "knowledge";
  const isError = event.event_type === "error" || event.content.summary.startsWith("error:");

  let parsedBody: Record<string, unknown> | null = null;
  if (isInterp) {
    try {
      parsedBody = JSON.parse(event.content.body) as Record<string, unknown>;
    } catch {
      parsedBody = null;
    }
  }

  return (
    <article
      className={`rounded-lg border ${meta.ring} ${meta.tint} p-4 transition-colors`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
            step {event.step_number} · {meta.label} · {event.event_type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {event.semantic_tags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
          <span className="font-mono text-[10px] text-neutral-600">
            {event.event_id}
          </span>
        </div>
      </header>

      <div
        className={`mt-2 text-sm ${
          isError ? "text-rose-300" : "text-neutral-200"
        }`}
      >
        {event.content.summary}
      </div>

      {event.chosen_because ? (
        <div className="mt-2 rounded border-l-2 border-neutral-700 pl-3 text-xs italic text-neutral-400">
          {event.chosen_because}
        </div>
      ) : null}

      {event.alternatives_considered.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-neutral-500 hover:text-neutral-300">
            {event.alternatives_considered.length} alternative
            {event.alternatives_considered.length > 1 ? "s" : ""} considered
          </summary>
          <ul className="mt-1 space-y-1 pl-3">
            {event.alternatives_considered.map((a, i) => (
              <li key={i} className="text-xs text-neutral-400">
                <span className="text-neutral-300">{a.path}</span>
                <span className="text-neutral-600"> — </span>
                <span className="italic">{a.rejected_because}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {isCode ? (
        <pre className="mt-3 overflow-x-auto rounded bg-black/60 p-3 text-[11px] leading-relaxed text-neutral-300">
          <code>{event.content.body}</code>
        </pre>
      ) : null}

      {isOutput ? (
        <pre
          className={`mt-3 overflow-x-auto rounded bg-black/50 p-3 text-[11px] leading-relaxed ${
            isError ? "text-rose-300" : "text-neutral-400"
          }`}
        >
          {event.content.body.slice(0, 2000)}
          {event.content.body.length > 2000 ? "\n…" : ""}
        </pre>
      ) : null}

      {isInterp && parsedBody ? (
        <div className="mt-3 space-y-2 text-xs">
          {typeof parsedBody.what_happened === "string" ? (
            <div>
              <span className="text-neutral-500">what happened · </span>
              <span className="text-neutral-300">
                {String(parsedBody.what_happened)}
              </span>
            </div>
          ) : null}
          {typeof parsedBody.what_it_means === "string" ? (
            <div>
              <span className="text-neutral-500">what it means · </span>
              <span className="text-neutral-200">
                {String(parsedBody.what_it_means)}
              </span>
            </div>
          ) : null}
          {Array.isArray(parsedBody.risks_or_concerns) &&
          parsedBody.risks_or_concerns.length > 0 ? (
            <div className="rounded border border-rose-500/30 bg-rose-500/5 p-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-rose-300">
                risks flagged ({parsedBody.risks_or_concerns.length})
              </div>
              <ul className="list-disc space-y-1 pl-5 text-neutral-300">
                {(parsedBody.risks_or_concerns as string[]).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {Array.isArray(parsedBody.verify_next) &&
          parsedBody.verify_next.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-[11px] text-neutral-500 hover:text-neutral-300">
                verify_next ({parsedBody.verify_next.length})
              </summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-neutral-400">
                {(parsedBody.verify_next as string[]).map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {isKnowledge ? (
        <div className="mt-3 rounded border border-emerald-500/40 bg-emerald-500/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300">
            knowledge committed
          </div>
          <div className="mt-1 text-sm text-neutral-200">
            {event.content.body}
          </div>
        </div>
      ) : null}
    </article>
  );
}

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
  const [knowledge] = useState<KnowledgeEntry[]>(initialKnowledge);
  const [status, setStatus] = useState<Status>(initialStatus);
  const seenIds = useRef<Set<string>>(
    new Set(initialEvents.map((e) => e.event_id))
  );

  useEffect(() => {
    // Don't tail if the run is already done — nothing will arrive.
    if (status !== "running" && initialEvents.length > 0) return;

    const es = new EventSource(`${BROWSER_BACKEND}/events/${experimentId}`);

    es.addEventListener("deliberation", (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data) as DeliberationEvent;
        if (seenIds.current.has(parsed.event_id)) return;
        seenIds.current.add(parsed.event_id);
        setEvents((prev) => [...prev, parsed]);
      } catch {
        /* ignore malformed */
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

    es.onerror = () => {
      // EventSource auto-reconnects; leave it.
    };

    return () => es.close();
  }, [experimentId, status, initialEvents.length]);

  const stats = useMemo(() => {
    const byAgent: Record<string, number> = {};
    for (const e of events) byAgent[e.agent] = (byAgent[e.agent] ?? 0) + 1;
    const maxStep = events.reduce((m, e) => Math.max(m, e.step_number), 0);
    return { byAgent, maxStep };
  }, [events]);

  const statusCls =
    status === "running"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : status === "complete"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : status === "failed"
      ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
      : "border-neutral-700 bg-neutral-800 text-neutral-400";

  return (
    <>
      <div className="sticky top-0 z-10 mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-3 backdrop-blur">
        <span
          className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusCls}`}
        >
          {status === "running" ? "● live" : status}
        </span>
        <span className="text-sm text-neutral-400">
          {events.length} events · step {stats.maxStep + 1} ·{" "}
          {knowledge.length} knowledge
        </span>
        <div className="ml-auto flex gap-3 text-xs text-neutral-500">
          {(["implementer", "interpreter", "tagger", "archivist"] as const).map(
            (a) => (
              <span key={a} className="flex items-center gap-1">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${AGENT_META[a].dot}`}
                />
                {AGENT_META[a].label} {stats.byAgent[a] ?? 0}
              </span>
            )
          )}
        </div>
      </div>

      {knowledge.length > 0 ? (
        <aside className="mb-6 rounded-lg border border-archivist/40 bg-archivist/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-archivist">
            knowledge base ({knowledge.length})
          </div>
          <ul className="mt-2 space-y-2">
            {knowledge.map((k) => (
              <li key={k.knowledge_id} className="text-sm">
                <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-archivist">
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

      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-500">
            waiting for the jury to start…
          </div>
        ) : (
          events.map((e) => <EventCard key={e.event_id} event={e} />)
        )}
      </div>
    </>
  );
}
