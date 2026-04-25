# PLAN — Thursday, April 23, 2026 (evening, ~9 PM – 1 AM EST)

## Today's one objective

**Prove the agent loop can produce a coherent Titanic notebook end-to-end, single-agent.**

Nothing else ships tonight. No web UI. No VS Code extension. No jury. No auth. Just: `python -m agent.loop_v0 --goal "predict titanic survival" --dataset ...` → `notebook.ipynb` that runs clean + `deliberation.jsonl` with readable entries.

## In scope

1. Repo scaffold: `git init`, directory structure, README/CLAUDE/schema/prompts in place.
2. `.env` with `ANTHROPIC_API_KEY`. `.gitignore` excludes `.env`.
3. Python venv, install `anthropic pydantic nbclient jupyter jupyter_client`.
4. Titanic `train.csv` downloaded into `examples/titanic/data/`.
5. `agent/loop_v0.py` — single-agent implementer loop, ~150 lines.
6. First successful Titanic run — notebook executes end-to-end with no unhandled errors, at least 5 cells, at least one trained model with a score printed.

## Out of scope tonight (spec-keeper: enforce)

- The four-agent jury split — Friday morning.
- Any web code. Any backend code. Any extension code.
- Supabase setup.
- Prompt optimization beyond "it produces something coherent."
- Branching / alternatives-considered wiring.
- Tests.

## Acceptance criterion

A human (you) runs `python -m agent.loop_v0` and the result is a `notebook.ipynb` that:

- Opens in Jupyter/VS Code without error.
- Has interleaved markdown + code cells.
- Loads the Titanic CSV.
- Performs at least one data-profile step.
- Trains at least one model.
- Prints at least one evaluation metric.
- No unhandled stack traces in the final saved notebook.

And a `deliberation.jsonl` that has at least 5 entries, each parseable as JSON, each with a `plan` and `cells` field at minimum.

## Budget tonight

- API spend: $5–15 expected. Stop and investigate if >$30.
- Model: `claude-sonnet-4-6` for everything tonight. Do not use Opus 4.7 until Friday, when prompts are more stable.
- Time: hard stop at 1 AM. Sleep matters more than one more iteration tonight.

## Tripwire

If by midnight the loop still can't produce a clean Titanic notebook end-to-end:

1. Stop iterating on the agent's freedom. The problem is too much decision-making per turn.
2. Make the agent more scripted — hardcode the first 3 steps as a skeleton (profile → baseline → improve), let the agent fill in the code for each.
3. This is not a failure; it's a calibration of how much autonomy the single-agent loop can handle. The jury split on Friday rebalances this.

## Tonight's commit sequence

```
git init
# copy scaffold files
git add .
git commit -m "[scaffold] initial repo structure"

# add schema
git add shared/schema.py
git commit -m "[scaffold] deliberation schema"

# add prompts
git add agent/prompts/
git commit -m "[scaffold] four agent prompts"

# get loop_v0 working
# iterate, iterate, iterate
git add agent/loop_v0.py
git commit -m "[thu-night][agent] loop_v0 producing Titanic notebook"
```

## What to write in REVIEW_thu.md before sleeping

1. Did the loop work end-to-end? If not, what blocked it?
2. Token cost of a full run (from `usage` in the API response).
3. Three things about Claude's response format that surprised you — JSON wrapping, trailing prose, field ordering.
4. One thing the single-agent version did well — keep that in the jury version.
5. One thing the single-agent version did badly — assign it to the right jury role (Implementer's plan too vague? Interpreter role will fix it. Bad tags? Tagger role will fix it.)
6. Tomorrow's first priority — written before you close the laptop so morning-you doesn't have to reconstruct it.

## Closing discipline

- Commit before sleeping even if the state is messy. A crashed-laptop-at-3-AM recovery is worth the 30 seconds.
- Phone in a different room. Not negotiable.
- Write REVIEW_thu.md. Even if it's three sentences.
