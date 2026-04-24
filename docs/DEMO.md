# Panel — 90-second demo script

Target runtime: **90 seconds**. Cut anything that pushes past 100s.

The demo proves three things, in this order:

1. **The jury is real** — four agents actually run and disagree, not a single-agent wrapper.
2. **The Interpreter catches things** — methodological review is visible and valuable.
3. **The artifact is shareable** — one URL hands the whole deliberation to anyone.

## Setup (offstage, before recording)

- [ ] `docker compose up -d` — backend + web healthy
- [ ] `.env` has `ANTHROPIC_API_KEY` (no Supabase keys needed — auth stays off for the demo)
- [ ] Browser on **http://localhost:3100**
- [ ] A pre-baked complete run exists with rich content (e.g. `exp_9b52b12006` — the King County run with 47 events / 7 knowledge entries)
- [ ] Second browser tab open on `/share/<that-id>`
- [ ] Screen recorder running, audio check done
- [ ] Terminal hidden — this demo lives in the browser

## The script

### 0:00–0:15 · Problem statement (15s)

**On screen:** Panel homepage.

> "Every data-science experiment dies in a notebook graveyard. The code survives; the reasoning evaporates. Existing tools track metrics or write cells — none of them capture *why* you pivoted, *what* you almost tried, *what* surprised you. That's Panel."

Scroll down briefly to show "the jury" section.

### 0:15–0:30 · The four agents (15s)

**Action:** hover over the four role cards.

> "Panel runs your experiment as four specialized Claude agents. An Implementer writes the code. An Interpreter reads the output and flags risks. A Tagger classifies every step. An Archivist decides what's worth remembering. They run sequentially — one cell at a time — each reacting to the last."

### 0:30–0:45 · Start a run (15s)

**Action:** click **Start an experiment** → pick the "House prices — regression" preset → click **Run**.

> "Type a goal, pick a dataset. This one: predict house sale price, cross-validate, tell me which features matter. Press Run."

### 0:45–1:15 · Watch the loop fire (30s)

**On screen:** the live dashboard. The orchestration banner shows Implementer → Kernel → Interpreter → Tagger → Archivist with the active stage pulsing. Step 1 card fills in.

> "The orchestration pipeline is alive at the top. Each step card shows one iteration of the loop. Implementer plans — here's the hypothesis, here are the alternatives it considered. Writes the code. Kernel executes. And then — this is the key moment — the Interpreter reads the output and surfaces *risks*."

**Action:** scroll to an Interpreter panel with red-bordered risk callouts.

> "Random split on temporal data. Collinearity by construction. This is senior-DS review captured in real time. Nothing else does this."

### 1:15–1:25 · Knowledge commit (10s)

**Action:** scroll to an Archivist `knowledge committed` panel or the top knowledge aside.

> "When something's worth remembering, the Archivist commits it to a knowledge base that future experiments can consult. KMeans on full data before CV — transductive leakage. That's a pitfall that will never bite this codebase again."

### 1:25–1:30 · Share (5s)

**Action:** click **Copy share link** in the orchestration banner. Switch to the second tab showing `/share/...`.

> "And it's a URL. No login. Open it anywhere. This is what experimental work should look like when the reasoning doesn't have to evaporate."

**Fade.**

## Fallback if things break

| breakage | fallback |
|---|---|
| Backend container down | Record against the pre-baked share URL only; skip the live run section |
| LLM timeout mid-run | Pre-recorded run clip, narrated live |
| Docker not starting | Run `python -m agent.loop_v1` directly, screen-cap the JSONL, show share via static screenshots |

## What NOT to do in the demo

- Don't explain the schema. Show the UI.
- Don't mention "Sonnet vs Haiku." Judges don't care.
- Don't show terminal output. Browser only.
- Don't narrate while the jury is thinking — let the UI speak.
- Don't run more than 4 steps — budget 30s of live runtime, cap `max_steps=4`.

## Post-demo talking points (if Q&A)

- Costs: ~$0.50 per 8-step run on Sonnet + Haiku.
- Privacy: datasets stay on the user's machine; backend only sees deliberation.
- Generalization: same jury works on classification (Titanic) and regression (King County) with zero code changes.
- Extensibility: the deliberation schema is the contract; anything that can read JSONL can consume it.
- Knowledge base: today it's within one user's workspace; shared-org knowledge is the natural next step.
