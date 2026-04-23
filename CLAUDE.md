# CLAUDE.md

This is the project constitution for **Panel**. Every Claude Code session reads this first. Keep it concise and load-bearing.

## What Panel is

An agentic workspace for data science experiments. A four-agent jury — Implementer, Interpreter, Tagger, Archivist — runs an experiment together, leaves behind a shareable artifact containing the notebook, the deliberation, the semantic tags, and a knowledge base entry where applicable.

Read `README.md` for the full vision. This file is for *agents executing on the code*.

## The hackathon context (this is load-bearing)

- Total build time: **3 days**, from April 23 evening to April 26 8 PM EST.
- Solo builder, one person.
- Built for Cerebral Valley × Anthropic "Built with Opus 4.7" hackathon.
- $500 API credit budget. Do not optimize prematurely; do not burn the budget either.
- The demo is the product. Nothing ships that doesn't support the 90-second demo narrative in README.

## The four scope cuts (do not re-expand without explicit approval)

1. **Tracker is merged into Archivist.** There are four agents, not five.
2. **Jury runs sequentially, not concurrently.** Implementer → Interpreter → Tagger → Archivist, per cell.
3. **Cross-experiment knowledge base is pitched, not fully demoed.** Ship the scaffolding (Archivist writes entries, PhD experiment references entries). Do not attempt to prove cumulative learning with experiments over time — there isn't time.
4. **Auth is magic-link, not multi-tenant.** Use Supabase's out-of-the-box email magic-link flow. No OAuth providers, no signup polish, no admin panel.

## What NOT to build (explicit kill list)

- No team/collaboration features. One user.
- No W&B/MLflow integrations.
- No hyperparameter sweeps or AutoML.
- No real-time co-editing between web UI and VS Code. Extension → backend → web is one-way.
- No custom notebook format. Standard .ipynb plus a `deliberation.jsonl` sidecar.
- No payment, no landing page marketing, no email/Slack integrations yet.
- No mobile. Desktop browser only.
- No Windows-specific testing until Sunday reserve block if at all.

## Architecture you must adhere to

```
/web          Next.js 14 + Supabase auth + Tailwind
/backend      FastAPI, single file per route, Pydantic models
/agent        Python agent runtime; claude SDK direct, no LangChain
/extension    VS Code TypeScript extension
/shared       Deliberation schema, shared types, knowledge-base format
/examples     Pre-baked experiments used for demo: titanic, house_prices, discriminator
```

One monorepo. No microservices. No Docker for v0.1 (unless Sunday reserve).

## Model routing (budget-critical)

- **Planning / Implementer's hard steps:** `claude-opus-4-7` at xhigh effort
- **Implementer's easy cells / Interpreter / Archivist:** `claude-sonnet-4-6`
- **Tagger:** `claude-haiku-4-5-20251001` — this is classification, keep it cheap
- **System prompts:** inject from `/agent/prompts/*.md`, do not inline

Do not call Opus in the jury unless specifically for hard planning. An all-Opus jury doubles the budget for marginal quality.

## The three canonical test experiments

Every feature must work end-to-end on these:

1. **Titanic** — Kaggle classic. Binary classification, mixed types. Agent should explore, handle missing data, pick a model, report AUC. Expected run time: ~90 seconds.
2. **House Prices** — Kaggle regression. Agent should handle feature engineering, deal with skewed target, pick regression model. Expected run time: ~120 seconds.
3. **Discriminator Overfitting (PhD flex)** — sanitized sliver of the author's 2024 spatial microsimulation research. Agent should detect survey-ID leakage (specifically: LIVQTRRV, EST_ST, EST_MSA, KINDWORK cause artificial separation when discriminating CPS from HPS). This is the hero demo. Can be partially scripted — judges don't audit whether the agent was live or replayed on a canonical path.

If a feature works on Titanic but not on House Prices, it's not done. If it doesn't run the Discriminator flex by Saturday night, the flex is cut from the demo.

## The deliberation schema is the contract

Every agent writes to `deliberation.jsonl` using the schema in README.md. The web UI reads from this file via the backend. The share page renders from this file. The knowledge base is built from this file. **Do not change the schema without updating all three consumers.**

## Timeline

- **Thursday evening, now:** scaffold + Titanic agent loop running locally (no UI, no web, no extension — just Python → .ipynb)
- **Friday:** jury split + web UI + backend SSE streaming + VS Code extension
- **Saturday:** share page + PhD flex + polish + demo video
- **Sunday:** reserve + submit by 6 PM EST (2-hour buffer before 8 PM deadline)

## Tripwires (re-plan if hit, do not grind past)

- **Friday noon:** if agent loop can't produce coherent Titanic notebook end-to-end → script the demo more, make the agent more deterministic.
- **Friday midnight:** if web ↔ agent streaming isn't working → fallback to "open the .ipynb and scrub through a pre-recorded deliberation" demo.
- **Saturday noon:** if PhD flex isn't coming together → ship with two Kaggle examples only, drop the flex.
- **Saturday evening:** if share/export isn't working → record the demo locally with a screen recorder, submit the video.

## What agents building on this repo NEVER do

- Never modify CLAUDE.md, README.md, or anything in `/docs/charter/` without explicit user instruction.
- Never change the deliberation schema silently.
- Never call Opus 4.7 for cell-writing unless the step is explicitly planning. Default to Sonnet.
- Never try to parallelize the jury. Sequential is a design choice, not a bug.
- Never commit secrets. `.env` is gitignored; `.env.example` has placeholders only.
- Never expand scope. If a feature isn't in README.md's demo narrative, it's out of scope.

## When uncertain

Ask the user. The cost of a clarifying question is seconds. The cost of rebuilding a module is hours.

## Code style

- Python: type hints, black formatting, pytest if testing.
- TypeScript: strict mode, no `any`, prettier default.
- Commits: reference phase and file area. `[agent] implement interpreter prompt loop`.
