"use client";

import { BROWSER_BACKEND } from "@/lib/backend";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PRESETS: { label: string; goal: string; dataset: string }[] = [
  {
    label: "Titanic — quick profile",
    goal: "Load Titanic, compute survival rate, profile missing values.",
    dataset: "examples/titanic/data/train.csv",
  },
  {
    label: "Titanic — full jury",
    goal: "Predict survival on Titanic. Train at least one model with cross-validation and tell me which features actually matter.",
    dataset: "examples/titanic/data/train.csv",
  },
];

export default function NewRunForm() {
  const router = useRouter();
  const [goal, setGoal] = useState(PRESETS[1].goal);
  const [dataset, setDataset] = useState(PRESETS[1].dataset);
  const [maxSteps, setMaxSteps] = useState(8);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setGoal(p.goal);
              setDataset(p.dataset);
            }}
            className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:bg-neutral-900"
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-neutral-500">
          Goal
        </span>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-none rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-sm text-neutral-200 focus:border-neutral-600 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-neutral-500">
            Dataset (container path)
          </span>
          <input
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-sm text-neutral-200 focus:border-neutral-600 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-neutral-500">
            Max steps
          </span>
          <input
            type="number"
            value={maxSteps}
            min={1}
            max={20}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-950 p-2 font-mono text-sm text-neutral-200 focus:border-neutral-600 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !goal.trim() || !dataset.trim()}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
        >
          {submitting ? "Spawning jury…" : "Run experiment"}
        </button>
        {error ? <span className="text-xs text-rose-400">{error}</span> : null}
      </div>
    </form>
  );
}
