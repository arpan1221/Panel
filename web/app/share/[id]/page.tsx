import { notFound } from "next/navigation";
import { getExperiment } from "@/lib/backend";
import { bundleEvents } from "@/lib/jury-bundle";
import { KnowledgePanel, StepCard } from "@/components/jury";
import { ColabHandoff } from "@/components/colab-handoff";
import {
  FunMark,
  FunTag,
  StatBlock,
  StatusSticker,
  TAG_STYLE,
} from "@/components/fun";

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

const STAT_TINTS = [
  "var(--lilac)",
  "var(--sky)",
  "var(--mint)",
  "var(--peach)",
  "var(--lemon)",
];
const STAT_ROTS = [-2, 1.5, -1, 2, -1.5];

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
  const goal = data.meta?.goal ?? null;
  const dataset = data.meta?.dataset ?? null;
  const createdAt = data.meta?.created_at
    ? new Date(data.meta.created_at).toLocaleString()
    : null;

  const tagCounts: Record<string, number> = {};
  for (const e of data.events) {
    for (const t of e.semantic_tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const topTagCount = sortedTags.length > 0 ? sortedTags[0][1] : 0;
  const pitfallCount = tagCounts["pitfall-detected"] ?? 0;

  const stats: [string | number, string][] = [
    [bundles.length, "steps"],
    [data.event_count, "events"],
    [knowledge.length, "knowledge"],
    [pitfallCount, pitfallCount === 1 ? "pitfall" : "pitfalls"],
  ];

  return (
    <main style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header
          style={{
            padding: "14px 56px",
            borderBottom: "2px dashed var(--ink)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <FunMark size={24} />
          <a
            href="/"
            className="ser"
            style={{ fontSize: 22, color: "var(--ink)", textDecoration: "none" }}
          >
            Panel
          </a>
          <span className="chip" style={{ background: "var(--lemon)" }}>
            shared · public
          </span>
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              marginLeft: "auto",
            }}
          >
            {data.experiment_id}
          </span>
          <StatusSticker status={data.status} />
          <a
            href={`/experiment/${data.experiment_id}`}
            className="btn-blob ghost"
            style={{ padding: "8px 14px", fontSize: 12 }}
          >
            Open in dashboard ↗
          </a>
        </header>

        <section
          style={{
            padding: "60px 56px 36px",
            maxWidth: 1080,
            margin: "0 auto",
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 18 }}>
            ★ {data.experiment_id}
            {createdAt ? ` · ${createdAt}` : ""}
            {` · ${data.event_count} events`}
          </div>
          <h1
            className="ser"
            style={{
              fontSize: 68,
              lineHeight: 1.05,
              margin: 0,
              paddingBottom: 6,
            }}
          >
            {goal ? goal : "Untitled experiment"}
          </h1>
          {dataset ? (
            <p
              className="ser-i"
              style={{
                fontSize: 18,
                lineHeight: 1.4,
                color: "var(--ink-2)",
                marginTop: 16,
                maxWidth: 800,
              }}
            >
              dataset · <span className="mono">{dataset}</span>
            </p>
          ) : null}
        </section>

        <section
          style={{
            padding: "0 56px 40px",
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {stats.map(([n, l], i) => (
            <StatBlock
              key={l}
              n={n}
              label={l}
              color={STAT_TINTS[i % STAT_TINTS.length]}
              rotate={STAT_ROTS[i % STAT_ROTS.length]}
            />
          ))}
        </section>

        {sortedTags.length > 0 || knowledge.length > 0 ? (
          <section
            style={{
              padding: "0 56px 40px",
              display: "grid",
              gridTemplateColumns: sortedTags.length > 0 && knowledge.length > 0
                ? "1fr 1.4fr"
                : "1fr",
              gap: 36,
            }}
          >
            {sortedTags.length > 0 ? (
              <div
                className="card"
                style={{ padding: 22, background: "var(--cream-2)" }}
              >
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  📊 tag distribution
                </div>
                {sortedTags.map(([t, n], i) => {
                  const w = (n / Math.max(topTagCount, 1)) * 100;
                  const m = TAG_STYLE[t] ?? {
                    color: "var(--ink)",
                    bg: "var(--cream-2)",
                  };
                  return (
                    <div
                      key={t}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "130px 1fr 24px",
                        gap: 12,
                        padding: "7px 0",
                        alignItems: "center",
                        borderTop: i ? "1.5px dashed var(--ink)" : "none",
                      }}
                    >
                      <FunTag name={t} />
                      <div
                        style={{
                          height: 10,
                          background: "var(--cream)",
                          border: "1.5px solid var(--ink)",
                          borderRadius: 999,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${w}%`,
                            height: "100%",
                            background: m.color,
                          }}
                        />
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: "right",
                        }}
                      >
                        {n}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {knowledge.length > 0 ? (
              <div>
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  📚 knowledge committed · {knowledge.length}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {knowledge.map((k, i) => {
                    const tint =
                      k.kind === "pitfall"
                        ? "var(--peach)"
                        : k.kind === "pattern"
                        ? "var(--sky)"
                        : k.kind === "heuristic"
                        ? "var(--lilac)"
                        : "var(--mint)";
                    const rot = [-0.5, 0.5, -0.3, 0.4, -0.4][i % 5];
                    return (
                      <div
                        key={k.knowledge_id}
                        className="card-tight"
                        style={{
                          padding: 14,
                          background: tint,
                          transform: `rotate(${rot}deg)`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 12,
                          }}
                        >
                          <span className="chip">{k.kind}</span>
                          <span
                            className="mono"
                            style={{ fontSize: 10, fontWeight: 700 }}
                          >
                            conf {k.confidence.toFixed(2)}
                          </span>
                        </div>
                        <div
                          className="ser"
                          style={{
                            fontSize: 16,
                            lineHeight: 1.35,
                            marginTop: 8,
                            fontWeight: 700,
                          }}
                        >
                          {k.claim}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section style={{ padding: "0 56px 24px" }}>
          <ColabHandoff experimentId={data.experiment_id} />
        </section>

        <section style={{ padding: "0 56px 40px" }}>
          <KnowledgePanel knowledge={[]} />
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
              this experiment has no events yet.
            </div>
          ) : (
            bundles.map((b) => <StepCard key={b.step} bundle={b} />)
          )}
        </section>

        <footer
          style={{
            padding: "32px 56px",
            borderTop: "2px dashed var(--ink)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-3)" }}
          >
            rendered from deliberation.jsonl · no login required
          </div>
          <a
            href="/"
            style={{
              fontSize: 12,
              color: "var(--ink-3)",
              textDecoration: "none",
            }}
            className="mono"
          >
            Panel →
          </a>
        </footer>
      </div>
    </main>
  );
}
