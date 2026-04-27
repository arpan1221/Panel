"use client";

import {
  BROWSER_BACKEND,
  DeliberationEvent,
  KnowledgeEntry,
} from "@/lib/backend";
import { bundleEvents } from "@/lib/jury-bundle";
import { KnowledgePanel, StepCard } from "@/components/jury";
import { AGENTS, AgentKey, StatBlock, StatusSticker } from "@/components/fun";
import { ColabHandoff } from "@/components/colab-handoff";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

type Status = "running" | "complete" | "failed" | "unknown";

type Stage = AgentKey | "idle";

const PIPELINE: AgentKey[] = [
  "implementer",
  "kernel",
  "interpreter",
  "tagger",
  "archivist",
];

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

function stageLabel(s: Stage, status: Status): string {
  if (status !== "running") return "idle";
  if (s === "implementer") return "planning…";
  if (s === "kernel") return "executing…";
  if (s === "interpreter") return "reading…";
  if (s === "tagger") return "tagging…";
  if (s === "archivist") return "deciding…";
  return "idle";
}

function elapsedString(startMs: number | null): string {
  if (!startMs) return "—";
  const ms = Date.now() - startMs;
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function ExperimentHeader({
  experimentId,
  status,
  goal,
  dataset,
  maxSteps,
  events,
  knowledge,
  startMs,
}: {
  experimentId: string;
  status: Status;
  goal: string | null;
  dataset: string | null;
  maxSteps: number | null;
  events: DeliberationEvent[];
  knowledge: KnowledgeEntry[];
  startMs: number | null;
}) {
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);
  void tick;

  async function copyShareUrl() {
    const url = `${window.location.origin}/share/${experimentId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  }

  const currentStep = events.reduce(
    (m, e) => Math.max(m, typeof e.step_number === "number" ? e.step_number : 0),
    0
  );
  const pitfallCount = events.reduce(
    (m, e) => m + ((e.semantic_tags ?? []).includes("pitfall-detected") ? 1 : 0),
    0
  );

  return (
    <>
      <header
        style={{
          padding: "20px 40px",
          borderBottom: "2px dashed var(--ink)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <a
          href="/"
          className="ser"
          style={{
            fontSize: 24,
            color: "var(--ink)",
            textDecoration: "none",
          }}
        >
          Panel
        </a>
        <span style={{ color: "var(--ink-3)" }}>/</span>
        <span className="mono" style={{ fontSize: 12 }}>
          experiment
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>
          /
        </span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
          {experimentId}
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={copyShareUrl}
            className="btn-blob ghost"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            {copied ? "✓ copied" : "⌘ Copy share link"}
          </button>
          <a
            href={`/share/${experimentId}`}
            target="_blank"
            rel="noreferrer"
            className="btn-blob ghost"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            📓 Open share ↗
          </a>
          {status === "complete" || status === "failed" ? (
            <ColabHandoff experimentId={experimentId} variant="compact" />
          ) : null}
        </div>
      </header>

      <section
        style={{
          padding: "32px 40px 24px",
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 32,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <StatusSticker status={status} />
            {maxSteps ? (
              <span className="chip">
                step {currentStep + (status === "running" ? 1 : 0)} of {maxSteps}
              </span>
            ) : null}
            {startMs && mounted ? (
              <span className="chip">elapsed {elapsedString(startMs)}</span>
            ) : null}
          </div>
          <h1
            className="ser"
            style={{
              fontSize: 40,
              lineHeight: 1.1,
              margin: 0,
              paddingBottom: 4,
            }}
          >
            {goal ? (
              goal
            ) : (
              <span className="ser-i" style={{ color: "var(--ink-3)" }}>
                untitled experiment
              </span>
            )}
          </h1>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 14 }}
          >
            {dataset ? `dataset · ${dataset}` : "dataset · —"}
            {maxSteps ? ` · max steps ${maxSteps}` : ""}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <StatBlock
            n={events.length}
            label="events"
            color="var(--lilac)"
            rotate={-2}
          />
          <StatBlock
            n={knowledge.length}
            label="knowledge"
            color="var(--mint)"
            rotate={1.5}
          />
          <StatBlock
            n={pitfallCount}
            label={pitfallCount === 1 ? "pitfall" : "pitfalls"}
            color="var(--peach)"
            rotate={-1}
          />
        </div>
      </section>
    </>
  );
}

function PipelineStrip({
  stage,
  status,
  lastSummary,
}: {
  stage: Stage;
  status: Status;
  lastSummary: string | null;
}) {
  const activeIndex = PIPELINE.indexOf(stage as AgentKey);
  return (
    <section style={{ padding: "0 40px 24px" }}>
      <div
        className="card-tight"
        style={{
          padding: "14px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 220px",
          gap: 18,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {PIPELINE.map((key, i) => {
            const a = AGENTS[key];
            const isActive = key === stage && status === "running";
            const isPast = activeIndex > i && status === "running";
            const isPending = !isActive && !isPast;
            return (
              <Fragment key={key}>
                <div
                  style={{
                    flex: 1,
                    minWidth: 110,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: isActive ? a.bg : "transparent",
                    border: isActive
                      ? `2.5px solid ${a.color}`
                      : "2px dashed transparent",
                    boxShadow: isActive ? "3px 3px 0 var(--ink)" : "none",
                    opacity: isPending && status === "running" ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      className={`agent-dot ${
                        isActive ? "animate-bounce2" : ""
                      }`}
                      style={{ background: a.color }}
                    />
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: a.color,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {a.name}
                    </span>
                  </div>
                  <div
                    className="ser-i"
                    style={{ fontSize: 13, marginTop: 4 }}
                  >
                    {isActive
                      ? stageLabel(stage, status)
                      : isPast
                      ? "✓ done"
                      : "pending"}
                  </div>
                </div>
                {i < PIPELINE.length - 1 ? (
                  <span
                    style={{
                      fontSize: 16,
                      color: "var(--ink-3)",
                      fontWeight: 700,
                    }}
                  >
                    →
                  </span>
                ) : null}
              </Fragment>
            );
          })}
        </div>
        <div
          style={{
            paddingLeft: 18,
            borderLeft: "2px dashed var(--ink)",
            minWidth: 200,
          }}
        >
          <div className="eyebrow">currently</div>
          <div
            className="ser"
            style={{
              fontSize: 15,
              lineHeight: 1.25,
              marginTop: 4,
              paddingBottom: 2,
            }}
          >
            {lastSummary
              ? lastSummary
              : status === "running"
              ? "Spinning up the jury…"
              : status === "complete"
              ? "Run complete."
              : status === "failed"
              ? "Run failed."
              : "Idle."}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LiveStream({
  experimentId,
  initialStatus,
  initialEvents,
  initialKnowledge,
  goal,
  dataset,
  maxSteps,
  startedAt,
}: {
  experimentId: string;
  initialStatus: Status;
  initialEvents: DeliberationEvent[];
  initialKnowledge: KnowledgeEntry[];
  goal: string | null;
  dataset: string | null;
  maxSteps: number | null;
  startedAt: string | null;
}) {
  const [events, setEvents] = useState<DeliberationEvent[]>(initialEvents);
  const [knowledge, setKnowledge] =
    useState<KnowledgeEntry[]>(initialKnowledge);
  const [status, setStatus] = useState<Status>(initialStatus);
  const seenIds = useRef<Set<string>>(
    new Set(initialEvents.map((e) => e.event_id))
  );

  const startMs = useMemo(() => {
    if (startedAt) {
      const t = Date.parse(startedAt);
      return Number.isFinite(t) ? t : null;
    }
    return initialEvents.length > 0
      ? Date.parse(initialEvents[0].timestamp)
      : Date.now();
  }, [startedAt, initialEvents]);

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
              claim: (parsed.content?.summary ?? "").replace(/^\[[^\]]+\]\s*/, ""),
              kind:
                ((parsed.content?.summary ?? "").match(/^\[([^\]]+)\]/)?.[1] as
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
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  const lastSummary = lastEvent?.content?.summary ?? null;
  const activeStep = bundles.length > 0 ? bundles[bundles.length - 1].step : -1;

  return (
    <>
      <ExperimentHeader
        experimentId={experimentId}
        status={status}
        goal={goal}
        dataset={dataset}
        maxSteps={maxSteps}
        events={events}
        knowledge={knowledge}
        startMs={startMs}
      />
      <PipelineStrip
        stage={stage}
        status={status}
        lastSummary={lastSummary}
      />
      <section style={{ padding: "0 40px 24px" }}>
        <KnowledgePanel knowledge={knowledge} />
      </section>
      <section style={{ padding: "0 40px 60px" }}>
        <h2
          className="ser"
          style={{
            fontSize: 30,
            margin: "8px 0 16px",
            lineHeight: 1.1,
            paddingBottom: 2,
          }}
        >
          What the jury did 🗂️
        </h2>
        {bundles.length === 0 ? (
          <div
            className="card-tight"
            style={{
              padding: 28,
              background: "var(--cream-2)",
              textAlign: "center",
              fontSize: 14,
              color: "var(--ink-2)",
            }}
          >
            waiting for the jury to start…
          </div>
        ) : (
          bundles
            .slice()
            .reverse()
            .map((b) => (
              <StepCard
                key={b.step}
                bundle={b}
                active={status === "running" && b.step === activeStep}
              />
            ))
        )}
      </section>
    </>
  );
}
