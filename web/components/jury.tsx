"use client";

import { KnowledgeEntry } from "@/lib/backend";
import type { StepBundle } from "@/lib/jury-bundle";
import { AgentKey, AgentPill, FunTag, TAG_STYLE } from "@/components/fun";
export { bundleEvents, type StepBundle } from "@/lib/jury-bundle";

export const TAG_COLORS = TAG_STYLE; // back-compat alias

export function TagPill({ tag }: { tag: string }) {
  return <FunTag name={tag} />;
}

function Lane({
  agent,
  stage,
  status,
  children,
}: {
  agent: AgentKey;
  stage: string;
  status?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 20,
        padding: "16px 0",
        borderTop: "1.5px dashed var(--ink)",
      }}
    >
      <div>
        <AgentPill agent={agent} suffix={stage} />
        {status ? (
          <div
            className="mono"
            style={{
              marginTop: 6,
              fontSize: 10,
              color: "var(--hot)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            {status}
          </div>
        ) : null}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function StepCard({
  bundle,
  active,
}: {
  bundle: StepBundle;
  active?: boolean;
}) {
  const {
    step,
    plan,
    code,
    output,
    interpretation,
    tag,
    knowledge,
    knowledge_retrieval,
    error,
  } = bundle;

  let interpParsed: Record<string, unknown> | null = null;
  if (interpretation) {
    try {
      interpParsed = JSON.parse(interpretation.content?.body ?? "{}");
    } catch {
      interpParsed = null;
    }
  }

  let planParsed: Record<string, unknown> | null = null;
  if (plan) {
    try {
      planParsed = JSON.parse(plan.content?.body ?? "{}");
    } catch {
      planParsed = null;
    }
  }

  const hasError =
    !!error ||
    !!(output && (output.content?.summary ?? "").toLowerCase().startsWith("error"));

  const planSummary = plan?.content?.summary ?? "…";

  return (
    <article
      className="card"
      style={{
        padding: 0,
        background: active ? "var(--cream)" : "var(--cream-2)",
        borderWidth: active ? 3 : 2.5,
        marginBottom: 18,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 22px",
          borderBottom: "2px dashed var(--ink)",
          flexWrap: "wrap",
        }}
      >
        <span
          className="ser"
          style={{
            fontSize: 32,
            lineHeight: 1,
            color: active ? "var(--implementer)" : "var(--ink-3)",
          }}
        >
          §{step + 1}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="ser" style={{ fontSize: 19, lineHeight: 1.25 }}>
            {planSummary}
          </div>
          {code?.cell_ref ? (
            <div
              className="mono"
              style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}
            >
              {code.cell_ref}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {bundle.allTags.map((t) => (
            <FunTag key={t} name={t} />
          ))}
          {hasError ? <FunTag name="error" /> : null}
          {active ? (
            <span
              className="sticker animate-bounce2"
              style={{ background: "var(--hot)", color: "var(--cream)" }}
            >
              ● live
            </span>
          ) : null}
        </div>
      </header>

      <div style={{ padding: "0 22px 18px" }}>
        {knowledge_retrieval ? (
          <Lane agent="archivist" stage="kb retrieval" status="prior knowledge">
            <div
              className="card-tight"
              style={{
                background: "var(--mint)",
                padding: 14,
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              <div
                className="ser"
                style={{
                  fontSize: 16,
                  paddingBottom: 6,
                  color: "var(--ink)",
                }}
              >
                🔎 {knowledge_retrieval.content?.summary ?? ""}
              </div>
              <pre
                className="mono"
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: 11.5,
                  color: "var(--ink-2)",
                  lineHeight: 1.55,
                }}
              >
                {knowledge_retrieval.content?.body ?? ""}
              </pre>
            </div>
          </Lane>
        ) : null}

        {plan ? (
          <Lane agent="implementer" stage="plan">
            {planParsed && typeof planParsed.hypothesis === "string" ? (
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--ink-2)",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                  }}
                >
                  hypothesis ·{" "}
                </span>
                {String(planParsed.hypothesis)}
              </div>
            ) : null}
            {plan.chosen_because ? (
              <div
                style={{
                  marginTop: 8,
                  paddingLeft: 12,
                  borderLeft: "2px solid var(--ink)",
                  fontSize: 12,
                  color: "var(--ink-2)",
                  fontStyle: "italic",
                }}
              >
                {plan.chosen_because}
              </div>
            ) : null}
            {plan.alternatives_considered.length > 0 ? (
              <details style={{ marginTop: 10 }}>
                <summary
                  className="mono"
                  style={{
                    cursor: "pointer",
                    fontSize: 11,
                    color: "var(--ink-3)",
                  }}
                >
                  {plan.alternatives_considered.length} alternative
                  {plan.alternatives_considered.length > 1 ? "s" : ""} considered
                </summary>
                <ul
                  style={{
                    marginTop: 6,
                    paddingLeft: 16,
                    listStyle: "disc",
                  }}
                >
                  {plan.alternatives_considered.map((a, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 12,
                        color: "var(--ink-2)",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                        {a.path}
                      </span>{" "}
                      <span style={{ color: "var(--ink-3)" }}>—</span>{" "}
                      <span style={{ fontStyle: "italic" }}>
                        {a.rejected_because}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Lane>
        ) : null}

        {code ? (
          <Lane agent="implementer" stage="code">
            <pre
              className="code-block"
              style={{ overflowX: "auto", whiteSpace: "pre" }}
            >
              {code.content?.body ?? ""}
            </pre>
          </Lane>
        ) : null}

        {output ? (
          <Lane agent="kernel" stage="output">
            <pre
              style={{
                margin: 0,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11.5,
                background: "var(--cream-2)",
                padding: 12,
                borderRadius: 8,
                border: "1.5px solid var(--ink)",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: hasError ? "var(--hot)" : "var(--ink-2)",
                maxHeight: 260,
                overflow: "auto",
              }}
            >
              {(output.content?.body ?? "").slice(0, 2400)}
              {(output.content?.body ?? "").length > 2400 ? "\n…" : ""}
            </pre>
          </Lane>
        ) : null}

        {interpretation ? (
          <Lane
            agent="interpreter"
            stage="reads"
            status={active && !tag ? "● live" : undefined}
          >
            {interpParsed && typeof interpParsed.what_it_means === "string" ? (
              <div
                className="ser"
                style={{ fontSize: 17, lineHeight: 1.4, fontWeight: 600 }}
              >
                {String(interpParsed.what_it_means)}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                {interpretation.content?.summary ?? ""}
              </div>
            )}
            {interpParsed &&
            Array.isArray(interpParsed.risks_or_concerns) &&
            interpParsed.risks_or_concerns.length > 0 ? (
              <div
                className="card-tight"
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: "var(--peach)",
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--hot)",
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  ⚠ risk
                  {(interpParsed.risks_or_concerns as string[]).length > 1
                    ? "s"
                    : ""}{" "}
                  flagged
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
                  {(interpParsed.risks_or_concerns as string[]).map((r, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--ink)",
                      }}
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {interpParsed &&
            Array.isArray(interpParsed.verify_next) &&
            interpParsed.verify_next.length > 0 ? (
              <details style={{ marginTop: 10 }}>
                <summary
                  className="mono"
                  style={{
                    cursor: "pointer",
                    fontSize: 11,
                    color: "var(--ink-3)",
                  }}
                >
                  verify_next ({(interpParsed.verify_next as string[]).length})
                </summary>
                <ul
                  style={{
                    marginTop: 6,
                    paddingLeft: 16,
                    listStyle: "disc",
                  }}
                >
                  {(interpParsed.verify_next as string[]).map((v, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 12,
                        color: "var(--ink-2)",
                        marginBottom: 4,
                      }}
                    >
                      {v}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Lane>
        ) : null}

        {tag ? (
          <Lane agent="tagger" stage="tags">
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {(tag.semantic_tags ?? []).length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  (no tags)
                </span>
              ) : (
                (tag.semantic_tags ?? []).map((t) => (
                  <FunTag key={t} name={t} />
                ))
              )}
            </div>
            {tag.content?.body ? (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--ink-3)",
                  fontStyle: "italic",
                }}
              >
                {tag.content?.body}
              </div>
            ) : null}
          </Lane>
        ) : null}

        {knowledge ? (
          <Lane agent="archivist" stage="commits">
            <div
              className="card-tight"
              style={{ padding: 12, background: "var(--mint)" }}
            >
              <div
                className="ser"
                style={{ fontSize: 16, lineHeight: 1.4, fontWeight: 700 }}
              >
                {knowledge.content?.summary ?? ""}
              </div>
              {knowledge.content?.body ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "var(--ink-2)",
                    lineHeight: 1.5,
                  }}
                >
                  {knowledge.content?.body}
                </div>
              ) : null}
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--ink-3)",
                  marginTop: 6,
                  fontWeight: 700,
                }}
              >
                conf {knowledge.confidence.toFixed(2)}
              </div>
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
    <section
      className="card"
      style={{ padding: 18, background: "var(--mint)", marginBottom: 24 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <AgentPill agent="archivist" suffix={`committed · ${knowledge.length}`} />
        <span
          className="mono"
          style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 700 }}
        >
          knowledge.jsonl
        </span>
      </div>
      {knowledge.map((k, i) => (
        <div
          key={k.knowledge_id}
          style={{
            display: "grid",
            gridTemplateColumns: "90px 1fr auto",
            gap: 14,
            padding: "10px 0",
            borderTop: i ? "1.5px dashed var(--ink)" : "none",
            alignItems: "baseline",
          }}
        >
          <FunTag name={k.kind} />
          <div
            className="ser"
            style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 700 }}
          >
            {k.claim}
          </div>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
            conf {k.confidence.toFixed(2)}
          </span>
        </div>
      ))}
    </section>
  );
}
