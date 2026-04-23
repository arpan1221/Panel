# Panel

**An agentic workspace for data science experiments. Four specialist agents — an Implementer, an Interpreter, a Tagger, and an Archivist — run your experiment together, argue over it, and leave behind a shareable artifact that explains not just what happened, but why.**

---

## The one-paragraph pitch

Data scientists run hundreds of experiments and every one dies in a notebook graveyard. The code survives; the reasoning evaporates. Existing tools (W&B, MLflow, Copilot, Runcell) track metrics or write cells, but none of them capture the *deliberation* — the why-this-not-that, the hypothesis being tested, the alternatives considered. Panel runs your experiment as a panel of four specialized AI agents: one writes the code, one reads the outputs, one tags every event semantically, and one curates a persistent knowledge base. The artifact they produce is a first-class shareable object — a public URL where anyone can open your experiment and, in 30 seconds, understand what happened and why. Sign in on the web. Connect the VS Code extension. Type a goal. Watch Panel work.

---

## What Panel is (and isn't)

**Panel IS:**
- A web workspace where experiments live as first-class shareable artifacts
- A VS Code extension that authenticates to your workspace and executes experiments locally (so your data stays on your machine)
- A four-agent jury that runs sequentially after each cell: Implementer → Interpreter → Tagger → Archivist
- A semantic-tag timeline that makes experimental reasoning navigable
- A public-URL share target for finished experiments

**Panel is NOT:**
- A Copilot competitor (Copilot writes cells; Panel captures the reasoning *around* cells)
- A metrics tracker (use W&B/MLflow for that; Panel may integrate later)
- A notebook format (uses standard .ipynb + a JSON sidecar)
- A team-collaboration tool in v0.1 (solo researcher workspace first)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Web (Next.js + Supabase magic-link auth)                │
│  Experiment list | Live experiment view | Share page     │
│                      ↕ (SSE)                             │
├──────────────────────────────────────────────────────────┤
│  Backend (FastAPI)                                       │
│  Experiment state | Event stream | Artifact export       │
│                      ↕                                    │
├──────────────────────────────────────────────────────────┤
│  Agent runtime (Python)                                   │
│  Implementer → Interpreter → Tagger → Archivist          │
│  Writes to shared JSONL deliberation log                  │
│                      ↕                                    │
├──────────────────────────────────────────────────────────┤
│  VS Code extension (TypeScript)                           │
│  Signs in | Receives experiment commands | Runs locally   │
└──────────────────────────────────────────────────────────┘
```

**Data flow:** user types goal on web → backend records experiment intent → extension (running on user's machine) polls for new intents → extension spawns agent runtime pointed at local dataset → agent runtime appends deliberation events to local JSONL + streams them to backend → web UI renders live via SSE.

**Privacy:** datasets stay on the user's machine. The backend only sees agent actions and deliberation entries — never the raw data unless the user explicitly exports.

---

## The four agents

Each agent runs in its own Claude call with its own system prompt. They execute **sequentially** after each unit of work, not concurrently. This is deliberate — it lets each agent react to the previous one's output, keeps token costs manageable, and plays to Opus 4.7's preference for doing focused work per turn.

### 1. Implementer (Sonnet 4.6 or Opus 4.7 for hard planning)
**Role:** Writes the next notebook cell(s) to advance the experiment goal.
**Input:** Experiment goal, deliberation history, last cell's output.
**Output:** One or more code cells + a short plan for this step.
**Constraint:** Cannot read raw data directly — only descriptions produced by Interpreter.

### 2. Interpreter (Sonnet 4.6)
**Role:** Reads the cell's execution output and produces a structured interpretation.
**Input:** The cell code + raw output (stdout, errors, data shapes, plot descriptions).
**Output:** What happened, what it means, what surprised, what to verify.
**Constraint:** Does not propose next steps — that's Implementer's job.

### 3. Tagger (Haiku 4.5)
**Role:** Assigns semantic tags to each event so the timeline is navigable.
**Input:** The cell + interpretation.
**Output:** Tags from a fixed vocabulary (see schema below) + one-line rationale.
**Why Haiku:** tagging is mechanical classification, not reasoning. Cheap on purpose.

### 4. Archivist (Sonnet 4.6)
**Role:** Decides what, if anything, to commit to the persistent knowledge base. Writes short knowledge entries linked to the current experiment.
**Input:** Full deliberation history for the experiment so far.
**Output:** Knowledge entries (patterns, pitfalls, heuristics) with confidence and provenance, or silence if nothing new is learned.
**Constraint:** Conservative by default — bad knowledge entries compound across experiments, so the Archivist only writes when confidence is high.

---

## Deliberation schema

Every event in the experiment is written as a JSON object appended to `deliberation.jsonl`. This is the single source of truth for the web UI, the share page, and the knowledge base.

```json
{
  "event_id": "evt_0001",
  "experiment_id": "exp_xyz",
  "timestamp": "2026-04-24T03:14:15Z",
  "agent": "implementer | interpreter | tagger | archivist",
  "step_number": 3,
  "cell_ref": "cell_0003",
  "event_type": "plan | code | output | interpretation | tag | knowledge",
  "content": {
    "summary": "one sentence description",
    "body": "full content"
  },
  "semantic_tags": ["hypothesis", "data-check", "method-choice", "debug", "pivot", "result", "pitfall-detected", "decision"],
  "alternatives_considered": [
    {"path": "short description", "rejected_because": "reason"}
  ],
  "chosen_because": "reason for the chosen path",
  "confidence": 0.0,
  "evidence": ["evt_0001", "evt_0002"],
  "supersedes": null
}
```

**Fixed semantic tag vocabulary (eight tags, exhaustive):**
- `hypothesis` — "I am testing whether X"
- `data-check` — validating data shape, types, quality, leakage
- `method-choice` — choosing between competing approaches
- `debug` — fixing something that broke
- `pivot` — abandoning a path, taking a different one
- `result` — an outcome worth recording
- `pitfall-detected` — recognizing a known-bad pattern
- `decision` — an explicit, justified commitment going forward

Tags are non-exclusive; an event can have multiple.

---

## Demo narrative (for README and submission)

### The hero sequence

1. **Open the Panel web app.** See your experiment dashboard — three cards: "Titanic EDA," "House Prices Regression," "Discriminator Overfitting Investigation (PhD 2024)."

2. **Click "New experiment."** Pick a dataset (upload or select). Type a goal: *"Predict survival on Titanic and tell me what features actually matter."*

3. **Press start.** VS Code (already connected) opens a new notebook. The web UI switches to live view:
   - Left pane: notebook rendering cell-by-cell as Implementer writes and the kernel executes
   - Right pane: the four agents' jury transcript streaming in real time — Implementer plans, Interpreter reads output, Tagger assigns tags, Archivist decides whether to commit anything
   - Bottom: the semantic-tag timeline building horizontally

4. **At a decision point,** Implementer records alternatives considered ("tried logistic regression first, but class imbalance was 62/38 so switched to gradient boosting"). The jury panel shows the debate. The timeline tag reads `method-choice`.

5. **Experiment finishes.** Click "Share." A public URL is generated. Anyone can open it and see the full artifact — notebook, deliberation, jury transcript, tag timeline. Scrub the timeline to any point, read the reasoning.

6. **The closing flex.** Open the discriminator overfitting .replay from the author's 2024 PhD research. Same interface. The jury flagged LIVQTRRV as leakage. Knowledge base entry: "Survey-specific features cause artificial discriminator separation — verified in [this experiment]." That entry is now available to future experiments.

### The 90-second pitch

> "Data scientists run hundreds of experiments. Each one dies in a notebook graveyard because the reasoning evaporates. Sharing your work means 'here's a gist' or 'here's a repo.' Nobody reads those.
>
> Panel is four AI agents that run your experiment together — one writes the code, one reads the outputs, one tags every event, one curates a knowledge base. Type a goal. Watch them work. The artifact they produce is a shareable URL where anyone, in 30 seconds, can see what you did and why.
>
> Here's an experiment I just ran. Here's the link — you're on it right now. Scroll the timeline. That's the hypothesis. Here's the pivot. Here's the pitfall the Tagger flagged.
>
> And here's a .replay from my own 2024 PhD research. Three weeks of work, one link. The knowledge Panel learned from this one experiment is now available to every experiment I run going forward.
>
> This is what experimental work should look like when the reasoning doesn't have to evaporate."

---

## Status

**Phase: Hackathon sprint (April 23–26, 2026)**
**Built for:** Cerebral Valley × Anthropic "Built with Opus 4.7" hackathon
**Primary dogfooder:** [your name] — finishing PhD on spatial microsimulation

## License

MIT
