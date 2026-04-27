"use client";

import { useEffect, useState } from "react";
import { BROWSER_BACKEND } from "@/lib/backend";

type Variant = "primary" | "compact";

function buildUrls(experimentId: string, origin: string) {
  const sameOrigin = `${BROWSER_BACKEND}/experiments/${experimentId}/notebook.ipynb`;
  const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : "";
  // Absolute URL Colab will fetch. If BROWSER_BACKEND is already absolute
  // (e.g. an https tunnel) use it directly; otherwise it's a same-origin
  // path like "/api/backend" — prepend window.origin.
  const isAbsolute = /^https?:\/\//i.test(BROWSER_BACKEND);
  const base = isAbsolute ? BROWSER_BACKEND : `${origin}${BROWSER_BACKEND}`;
  const absolute = `${base}/experiments/${experimentId}/notebook.ipynb?colab=1${originParam}`;
  const colabUrl = `https://colab.research.google.com/?url=${encodeURIComponent(absolute)}`;
  return { downloadUrl: sameOrigin, colabUrl };
}

export function ColabHandoff({
  experimentId,
  variant = "primary",
}: {
  experimentId: string;
  variant?: Variant;
}) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const { downloadUrl, colabUrl } = buildUrls(experimentId, origin ?? "");
  // Colab can fetch the .ipynb only if the *backend* is on a public URL.
  // If BROWSER_BACKEND is an https://… string, we trust it. Otherwise it's
  // same-origin and we fall back to the window origin check.
  const backendIsPublic = /^https:\/\//i.test(BROWSER_BACKEND);
  const colabReachable =
    backendIsPublic ||
    (!!origin && !origin.startsWith("http://localhost") && !origin.startsWith("http://127."));

  if (variant === "compact") {
    return (
      <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <a
          href={origin ? colabUrl : "#"}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!colabReachable}
          title={
            colabReachable
              ? "Open this notebook in Google Colab"
              : "Colab can't reach localhost — use Download .ipynb"
          }
          className="chip"
          style={{
            background: "var(--lemon)",
            color: "var(--ink)",
            textDecoration: "none",
            padding: "4px 10px",
            opacity: colabReachable ? 1 : 0.55,
            pointerEvents: colabReachable ? "auto" : "none",
          }}
        >
          ▶ Colab
        </a>
        <a
          href={downloadUrl}
          download
          className="chip"
          style={{
            background: "var(--cream)",
            color: "var(--ink)",
            textDecoration: "none",
            padding: "4px 10px",
          }}
        >
          ⬇ .ipynb
        </a>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        background: "var(--lemon)",
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div className="eyebrow">↗ continue from where the jury left off</div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            className="ser"
            style={{ fontSize: 26, lineHeight: 1.15, margin: 0 }}
          >
            Open this run in <span className="ser-i">Colab</span>
          </h2>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--ink-2)",
              marginTop: 8,
              maxWidth: 560,
            }}
          >
            The portable notebook installs the data-science stack and
            re-materializes the dataset on cell 1, so you can pick up at the
            next cell without setup.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a
            href={origin ? colabUrl : "#"}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!colabReachable}
            className="btn-blob animate-bounce2"
            style={{
              background: "var(--implementer)",
              color: "var(--cream)",
              opacity: colabReachable ? 1 : 0.55,
              pointerEvents: colabReachable ? "auto" : "none",
              justifyContent: "center",
            }}
          >
            ▶ Open in Colab
          </a>
          <a
            href={downloadUrl}
            download
            className="btn-blob"
            style={{
              background: "var(--cream)",
              color: "var(--ink)",
              border: "1px solid var(--ink-3)",
              justifyContent: "center",
            }}
          >
            ⬇ Download .ipynb
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--ink-3)",
          background: "transparent",
          border: 0,
          alignSelf: "flex-start",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {showHelp ? "hide" : "Colab can't reach localhost?"}
      </button>
      {showHelp ? (
        <div
          className="mono"
          style={{
            fontSize: 11,
            lineHeight: 1.55,
            color: "var(--ink-2)",
            padding: 12,
            background: "var(--cream)",
            borderRadius: 8,
          }}
        >
          Google Colab fetches notebooks from its own servers, so it can&apos;t
          read a backend running on <strong>localhost</strong>. For local demos,
          use <strong>Download .ipynb</strong> and drag the file onto{" "}
          <a
            href="https://colab.research.google.com/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--implementer)" }}
          >
            colab.research.google.com
          </a>
          . When Panel is on a public URL, the <strong>Open in Colab</strong>{" "}
          button works end-to-end.
        </div>
      ) : null}
    </div>
  );
}
