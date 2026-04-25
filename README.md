# Panel

**A panel of four specialist agents reviewing your data-science experiment in real time.** An Implementer writes the cells. An Interpreter reads the output and flags what's wrong with it. A Tagger classifies every step. An Archivist decides what's worth remembering. The reasoning is the artifact — exported as a URL anyone can open.

Built for the everyday tabular / classical-ML experiments that don't justify a fine-tune: profile a CSV, test a hypothesis, train a model, share what you found.

<p align="center">
  <em>Type a goal. Watch the jury work. Get a URL you can share.</em>
</p>

---

## The problem

Data scientists run hundreds of experiments. Each one dies in a notebook graveyard — the code survives but the *reasoning* evaporates. Copilot writes cells; W&B and MLflow track metrics; autonomous coding agents write working code. None of them capture the deliberation: the hypothesis being tested, the alternatives considered, the pitfall that was spotted and avoided, the methodological hole that should have been called out before the result was trusted.

When you open an old notebook three weeks later, you've forgotten why you pivoted from logistic regression to random forest. When you try to share your work, you paste a gist and hope.

## What Panel does differently

Panel runs your experiment as a **panel of four specialized Claude agents**, one call per agent, each with its own narrow job. They run **sequentially**, each reacting to the last one's output:

1. **Implementer** writes the next notebook cell(s), records its plan, its hypothesis, and the alternatives it considered.
2. **Interpreter** reads the kernel output and explains what actually happened — flagging surprises, collinearities, leakage smells, and verification checks to try next.
3. **Tagger** assigns one or more semantic tags from a fixed 8-tag vocabulary so the timeline is navigable.
4. **Archivist** decides whether anything from this experiment is worth committing to a persistent knowledge base that future experiments can consult. Default is silence.

Every action is appended to `deliberation.jsonl` as a structured `DeliberationEvent`. The web UI renders the events live as they stream. The finished run becomes a shareable artifact — a URL where anyone can open your experiment and, in under a minute, understand what you did and why.

## Panel IS

- A four-agent jury that captures expert-level methodological review as part of the run
- A web workspace where experiments live as first-class shareable artifacts
- A live dashboard showing the agentic loop: plan → code → execute → interpret → tag → commit
- A semantic-tag timeline that makes experimental reasoning navigable after the fact
- A public-URL share target for finished experiments — **with one-click "Open in Colab"** so anyone can fork the notebook and continue from where the jury left off

## Panel is NOT

- A Copilot competitor — Copilot writes cells; Panel captures the reasoning *around* cells
- An LLM post-training agent — Panel runs on your CSVs, not on the Hugging Face Hub. If you need SFT/DPO on a base model, use a tool built for that
- An autonomous "do my whole project" agent — Panel runs one experiment at a time, with the reasoning explicit, so a human can audit it
- A metrics tracker — use W&B/MLflow for that (integration possible later)
- A custom notebook format — standard `.ipynb` plus a `deliberation.jsonl` sidecar
- A team-collaboration tool — solo-researcher workspace for now

---

## How it works

```
┌─────────────────────────────────────────────────────────┐
│  Web (Next.js 14 + Tailwind)                            │
│  Experiment dashboard · Live jury view · Share pages    │
│                      ↕ (SSE)                            │
├─────────────────────────────────────────────────────────┤
│  Backend (FastAPI + sse-starlette)                      │
│  /experiments · /events · /share                        │
│                      ↕                                  │
├─────────────────────────────────────────────────────────┤
│  Agent runtime (Python, Claude SDK)                     │
│  Implementer → kernel → Interpreter → Tagger → Archivist│
│  Persistent Jupyter kernel · nbclient · JSONL log       │
└─────────────────────────────────────────────────────────┘
         ↑
         │  launch via web form OR
         │  VS Code command palette
         │
  User's goal + dataset
```

**Model routing.** Implementer, Interpreter, and Archivist run on **Claude Sonnet 4.6**. Tagger runs on **Claude Haiku 4.5** because tagging is classification, not reasoning — it's cheap on purpose. Hard planning steps can opt into **Opus 4.7**.

**Privacy.** The dev stack runs entirely on localhost via Docker Compose. Datasets stay on your machine. The agent runtime executes notebook cells in a sandboxed Jupyter kernel and writes artifacts to a volume-mounted run directory.

---

## The deliberation schema

Every action the jury takes is appended to `deliberation.jsonl` as a `DeliberationEvent`. One line per event. This is the single source of truth consumed by the web UI, the share page, and the knowledge-base extractor.

```json
{
  "event_id": "evt_0001",
  "experiment_id": "exp_xyz",
  "timestamp": "2026-04-24T03:14:15Z",
  "agent": "implementer | interpreter | tagger | archivist",
  "step_number": 3,
  "cell_ref": "cells[4:6]",
  "event_type": "plan | code | output | interpretation | tag | knowledge | error",
  "content": { "summary": "one-sentence description", "body": "full content" },
  "semantic_tags": ["method-choice", "pitfall-detected"],
  "alternatives_considered": [
    { "path": "logistic regression", "rejected_because": "class imbalance 62/38" }
  ],
  "chosen_because": "gradient boosting handles imbalance natively",
  "confidence": 0.82,
  "evidence": ["evt_0005", "evt_0007"],
  "supersedes": null
}
```

**Fixed semantic-tag vocabulary (eight tags, exhaustive):**

| tag | meaning |
|---|---|
| `hypothesis` | testing a specific belief |
| `data-check` | validating shape, types, quality, leakage |
| `method-choice` | choosing between competing approaches |
| `debug` | fixing something that broke |
| `pivot` | explicitly abandoning a path for another |
| `result` | an outcome worth recording |
| `pitfall-detected` | a known-bad pattern recognized |
| `decision` | an explicit, justified commitment |

Tags are non-exclusive. An event can carry several.

---

## Quick start

Requirements: Docker Desktop, an `ANTHROPIC_API_KEY`.

```bash
git clone https://github.com/arpan1221/Panel.git
cd Panel
cp .env.example .env       # paste your ANTHROPIC_API_KEY
docker compose build
docker compose up -d
```

Then:
- Open **http://localhost:3100** in a browser
- Pick a preset (Titanic quick profile · Titanic full jury · House-prices regression) or type your own goal
- Click **Run experiment**
- Watch the four agents work live

### Run from the CLI

```bash
docker compose run --rm agent python -m agent.loop_v1 \
  --goal "Predict survival on Titanic and tell me which features actually matter." \
  --dataset examples/titanic/data/train.csv \
  --out runs/titanic_cli \
  --max-steps 8
```

### Continue in Colab

Every share page exposes a portable copy of the run's notebook:

- **Open in Colab** — opens the notebook directly in Google Colab (requires the backend to be on a public URL).
- **Download .ipynb** — always works; drag the file onto [colab.research.google.com](https://colab.research.google.com/) for a local-friendly path.

The portable notebook prepends two setup cells: one installs the data-science stack, the other re-materializes the dataset under the same path the jury used — so the rest of the cells run unchanged. Pick up at the next cell; iterate from there.

### Optional VS Code launcher

There's an experimental VS Code extension under `/extension` that adds a status-bar button to launch a run via the backend. It's a launcher, not a workflow surface — the deliberation still lives in the browser. Install only if a status-bar shortcut is useful to you.

---

## Example output

A real run on the King County housing dataset, launched with the goal *"Predict house sale price, cross-validate, tell me which features matter."*

- **8 steps, 47 events, 7 knowledge commits.** Finished in ~8 minutes for ~$0.50 in API calls.
- The Interpreter caught `house_age = -1` (properties sold before recorded build year), `sqft_living / sqft_above / sqft_basement` collinearity-by-construction, and an RMSE printing as `~$0` because of a wrong `expm1` transform — a bug in the Implementer's own code.
- On step 4 the Implementer built a KMeans geo-cluster feature. The Interpreter flagged **transductive leakage** (KMeans fit on full data before CV splits). On step 5 the Implementer fixed it with a custom sklearn transformer that fits KMeans inside each CV fold. The Archivist committed both the pitfall and the before/after delta as knowledge (+0.0049 R² leak-free vs +0.0087 inflated).
- Final step surfaced a pipeline-permutation gotcha: permuting `lat` also corrupts `geo_cluster` because `geo_cluster` is *derived from* `lat` — a subtle bug that 90% of senior DS would miss in a first pass.

Every one of those findings is captured as a structured event, rendered inline in the timeline, and linked into the knowledge base by event ID. Three weeks from now, you can open the share URL and see all of it.

---

## Repo layout

```
/shared      — DeliberationEvent + KnowledgeEntry Pydantic models (the contract)
/agent       — Python runtime, role prompts (/agent/prompts/*.md), jury loop (loop_v1)
/backend     — FastAPI app: POST /experiments, GET /events/{id} SSE, GET /experiments/{id}
/web         — Next.js 14 App Router + Tailwind, live-streaming dashboard
/extension   — VS Code extension (TypeScript)
/examples    — Datasets: titanic, house_prices
```

## License

MIT.
