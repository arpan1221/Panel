"use client";

import {
  BROWSER_BACKEND,
  DeliberationEvent,
  KnowledgeEntry,
} from "@/lib/backend";
import { bundleEvents } from "@/lib/jury-bundle";
import { KnowledgePanel, StepCard } from "@/components/jury";
import { useEffect, useMemo, useRef, useState } from "react";

type Status = "running" | "complete" | "failed" | "unknown";

type Stage =
  | "implementer"
  | "kernel"
  | "interpreter"
  | "tagger"
  | "archivist"
  | "idle";

function stageFromEvents(events: DeliberationEvent[], status: Status): Stage {
  if (status !== "running" && events.length > 0) return "idle";
  if (events.length === 0) return "implementer";
  const last = events[events.length - 1];
  switch (last.event_type) {
    case "plan":
    case "code":
      return "kernel";
    case "output":
      return "interpreter";
    case "interpretation":
      return "tagger";
    case "tag":
      return "archivist";
    case "knowledge":
      return "implementer";
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
  experimentId,
}: {
  stage: Stage;
  status: Status;
  events: DeliberationEvent[];
  knowledge: KnowledgeEntry[];
  experimentId: string;
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

  const [copied, setCopied] = useState(false);
  async function copyShareUrl() {
    const url = `${window.location.origin}/share/${experimentId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fall through
    }
  }

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
          <span className="text-neutral-200">{knowledge.length}</span>{" "}
          knowledge
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={copyShareUrl}
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800"
          >
            {copied ? "✓ copied" : "Copy share link"}
          </button>
          <a
            href={`/share/${experimentId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800"
          >
            Open share view ↗
          </a>
        </div>
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
                    isActive && !isIdle
                      ? s.dot + " animate-pulse"
                      : "bg-neutral-700"
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
        experimentId={experimentId}
      />
      <KnowledgePanel knowledge={knowledge} />
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
