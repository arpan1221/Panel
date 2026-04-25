"use client";

import { useState } from "react";
import { BROWSER_BACKEND } from "@/lib/backend";

type Variant = "primary" | "compact";

export function ColabHandoff({
  experimentId,
  variant = "primary",
}: {
  experimentId: string;
  variant?: Variant;
}) {
  const [showHelp, setShowHelp] = useState(false);

  const notebookUrl = `${BROWSER_BACKEND}/experiments/${experimentId}/notebook.ipynb?colab=1`;
  const colabUrl = `https://colab.research.google.com/?url=${encodeURIComponent(
    notebookUrl
  )}`;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <a
          href={colabUrl}
          target="_blank"
          rel="noreferrer"
          title="Open this notebook in Google Colab"
          className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200 hover:border-amber-400 hover:bg-amber-500/20"
        >
          ▶ Open in Colab
        </a>
        <a
          href={notebookUrl}
          download
          className="rounded border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:bg-neutral-800"
        >
          Download .ipynb
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-500/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber-300/80">
            <span>↗</span>
            continue from where the jury left off
          </div>
          <h2 className="mt-1 text-base font-medium text-neutral-100">
            Open this run in Colab
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-neutral-400">
            The portable notebook installs the data-science stack and
            re-materializes the dataset on cell 1, so you can pick up at the
            next cell without setup.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row">
          <a
            href={colabUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 hover:border-amber-400 hover:bg-amber-500/25"
          >
            ▶ Open in Colab
          </a>
          <a
            href={notebookUrl}
            download
            className="rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800"
          >
            Download .ipynb
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="mt-3 text-[11px] text-neutral-500 hover:text-neutral-300"
      >
        {showHelp ? "hide" : "Colab can't reach localhost?"}
      </button>
      {showHelp ? (
        <div className="mt-2 rounded border border-neutral-800 bg-black/40 p-3 text-[11px] leading-relaxed text-neutral-400">
          Google Colab fetches notebooks from its own servers, so it can't read
          a backend running on <code className="text-neutral-300">localhost</code>.
          For local demos, use{" "}
          <span className="text-neutral-200">Download .ipynb</span> and drag the
          file onto{" "}
          <a
            href="https://colab.research.google.com/"
            target="_blank"
            rel="noreferrer"
            className="text-amber-300 underline"
          >
            colab.research.google.com
          </a>
          . When Panel's backend is on a public URL, the{" "}
          <span className="text-neutral-200">Open in Colab</span> button works
          end-to-end.
        </div>
      ) : null}
    </div>
  );
}
