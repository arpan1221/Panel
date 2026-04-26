import Link from "next/link";
import NewRunForm from "../NewRunForm";
import { FunMark } from "@/components/fun";

export default function NewRun() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header
          style={{
            padding: "24px 56px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderBottom: "2px dashed var(--ink)",
            flexWrap: "wrap",
          }}
        >
          <FunMark size={28} />
          <span className="ser" style={{ fontSize: 26 }}>
            Panel
          </span>
          <span style={{ color: "var(--ink-3)" }}>/</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
            new experiment
          </span>
          <Link
            href="/"
            className="btn-blob ghost"
            style={{ marginLeft: "auto", padding: "8px 14px", fontSize: 12 }}
          >
            ← back
          </Link>
        </header>

        <section
          style={{
            padding: "60px 56px 24px",
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 56,
          }}
        >
          <div>
            <div className="eyebrow">★ empanel a new jury</div>
            <h1
              className="ser"
              style={{
                fontSize: 86,
                lineHeight: 1.02,
                margin: "12px 0 0",
                paddingBottom: 6,
              }}
            >
              What should
              <br />
              they{" "}
              <span
                style={{
                  background: "var(--lemon)",
                  padding: "0 10px",
                  border: "2.5px solid var(--ink)",
                  boxShadow: "4px 4px 0 var(--ink)",
                  display: "inline-block",
                  transform: "rotate(-1deg)",
                  borderRadius: 6,
                }}
              >
                run?
              </span>
            </h1>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.55,
                color: "var(--ink-2)",
                maxWidth: 480,
                marginTop: 22,
              }}
            >
              Pick a preset and watch the jury work, or describe your own goal
              and point at a CSV. The agents take it from there.
            </p>
          </div>

          <aside
            className="card"
            style={{ padding: 22, background: "var(--peach)" }}
          >
            <div className="eyebrow">💸 how it bills</div>
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "10px 14px",
                fontSize: 12,
              }}
            >
              <span>Implementer · <strong>opus 4.7</strong></span>
              <span className="mono" style={{ fontWeight: 700 }}>
                ~$0.25/step
              </span>
              <span>Interpreter · sonnet</span>
              <span className="mono" style={{ fontWeight: 700 }}>
                ~$0.03/step
              </span>
              <span>Tagger · haiku</span>
              <span className="mono" style={{ fontWeight: 700 }}>
                &lt;$0.001/step
              </span>
              <span>Archivist · sonnet</span>
              <span className="mono" style={{ fontWeight: 700 }}>
                ~$0.01/step
              </span>
            </div>
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1.5px dashed var(--ink)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span className="ser" style={{ fontSize: 16 }}>
                per step, all-in
              </span>
              <span className="ser" style={{ fontSize: 28 }}>
                ~$0.09
              </span>
            </div>
          </aside>
        </section>

        <section
          style={{
            padding: "20px 56px 60px",
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 36,
          }}
        >
          <NewRunForm />

          <aside
            className="card"
            style={{
              padding: 22,
              background: "var(--lilac)",
              alignSelf: "start",
            }}
          >
            <div className="eyebrow">🪄 what happens next</div>
            <ol style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
              {(
                [
                  ["Spawn", "Backend boots a Jupyter kernel."],
                  ["Plan", "Implementer writes the first cell."],
                  ["Loop", "Plan → run → read → tag → curate."],
                  ["Halt", "Goal met or you click Stop."],
                  ["Artifact", "Notebook + share URL."],
                ] as const
              ).map(([k, v], i) => (
                <li
                  key={k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr",
                    gap: 10,
                    padding: "10px 0",
                    borderTop: i ? "1.5px dashed var(--ink)" : "none",
                  }}
                >
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                    0{i + 1}
                  </span>
                  <div>
                    <div
                      className="ser"
                      style={{ fontSize: 17, lineHeight: 1.1, paddingBottom: 2 }}
                    >
                      {k}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{v}</div>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </div>
    </main>
  );
}
