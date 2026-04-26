"use client";

import { BROWSER_BACKEND } from "@/lib/backend";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PRESETS: {
  label: string;
  goal: string;
  dataset: string;
  tag: string;
  tint: string;
  est: string;
}[] = [
  {
    label: "Titanic — quick profile",
    goal: "Load Titanic, compute survival rate, profile missing values.",
    dataset: "examples/titanic/data/train.csv",
    tag: "fast",
    tint: "var(--sky)",
    est: "~45s · ~$0.08",
  },
  {
    label: "Titanic — full jury",
    goal: "Predict survival on Titanic. Train at least one model with cross-validation and tell me which features actually matter.",
    dataset: "examples/titanic/data/train.csv",
    tag: "recommended ★",
    tint: "var(--lemon)",
    est: "~90s · ~$0.18",
  },
  {
    label: "House prices — regression",
    goal: "Predict house sale price. Train at least one model with cross-validation and report a regression metric (RMSE or R²). Tell me which features matter most.",
    dataset: "examples/house_prices/data/train.csv",
    tag: "rich",
    tint: "var(--mint)",
    est: "~2m · ~$0.35",
  },
  {
    label: "Discriminator overfit",
    goal: "Train a discriminator to separate two survey samples (CPS vs HPS). Find any features that look like they're cheating — survey-ID columns, geography codes, anything that wouldn't generalise. Report which features are leaking.",
    dataset: "examples/discriminator/data/train.csv",
    tag: "phd flex",
    tint: "var(--peach)",
    est: "~3m · ~$0.50",
  },
];

export default function NewRunForm() {
  const router = useRouter();
  const [selected, setSelected] = useState(1);
  const [goal, setGoal] = useState(PRESETS[1].goal);
  const [dataset, setDataset] = useState(PRESETS[1].dataset);
  const [maxSteps, setMaxSteps] = useState(8);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BROWSER_BACKEND}/uploads`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`upload failed: HTTP ${res.status}`);
      const data = (await res.json()) as { dataset: string; filename: string };
      setDataset(data.dataset);
      setUploaded(data.filename);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  }

  function applyPreset(i: number) {
    setSelected(i);
    setGoal(PRESETS[i].goal);
    setDataset(PRESETS[i].dataset);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${BROWSER_BACKEND}/experiments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal, dataset, max_steps: maxSteps }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { experiment_id: string };
      router.push(`/experiment/${data.experiment_id}`);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        📦 presets · pick to prefill
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
          marginBottom: 28,
        }}
      >
        {PRESETS.map((p, i) => {
          const sel = i === selected;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(i)}
              className={sel ? "card" : "card-tight"}
              style={{
                textAlign: "left",
                cursor: "pointer",
                padding: 18,
                background: p.tint,
                transform: sel
                  ? "rotate(-0.5deg) scale(1.01)"
                  : "rotate(0.5deg)",
                color: "var(--ink)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <span
                  className="ser"
                  style={{ fontSize: 22, lineHeight: 1.1, paddingBottom: 4 }}
                >
                  {p.label}
                </span>
                <span className="chip" style={{ background: "var(--cream)" }}>
                  {p.tag}
                </span>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--ink-2)",
                  marginTop: 12,
                  fontWeight: 700,
                }}
              >
                {p.est}
              </div>
            </button>
          );
        })}
      </div>

      <label style={{ display: "block", marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          🎯 goal
        </div>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={4}
          className="input-fun"
          style={{
            minHeight: 110,
            resize: "vertical",
            lineHeight: 1.55,
            fontSize: 13,
          }}
        />
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px",
          gap: 16,
        }}
      >
        <label>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            📁 dataset · path or https URL
          </div>
          <input
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            className="input-fun"
            placeholder="examples/titanic/data/train.csv  or  https://…/train.csv"
          />
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              type="file"
              accept=".csv,.tsv,.parquet,.xlsx,.xls,.json"
              onChange={handleFile}
              disabled={uploading}
              style={{ fontSize: 12 }}
            />
            {uploading ? (
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>uploading…</span>
            ) : uploaded ? (
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>✓ {uploaded}</span>
            ) : (
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                or upload a CSV from your machine
              </span>
            )}
          </div>
        </label>
        <label>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            🔁 max steps
          </div>
          <input
            type="number"
            value={maxSteps}
            min={1}
            max={20}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
            className="input-fun"
          />
        </label>
      </div>

      <div
        style={{
          marginTop: 28,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          type="submit"
          disabled={submitting || !goal.trim() || !dataset.trim()}
          className="btn-blob animate-bounce2"
          style={{ background: "var(--implementer)", color: "var(--cream)" }}
        >
          {submitting ? "Spawning jury…" : "⚡ Spawn jury →"}
        </button>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
          or hit{" "}
          <span className="chip" style={{ padding: "2px 8px" }}>
            ⌘ ↵
          </span>
        </span>
        {error ? (
          <span
            className="mono"
            style={{ fontSize: 12, color: "var(--hot)" }}
          >
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
