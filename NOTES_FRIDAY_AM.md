# Friday AM — first thing, before coffee

## Yesterday's state (Thu night)

- Single-agent `loop_v0.py` works end-to-end on Titanic: 8 steps, 0 errors, $0.24, acc 83.3% / AUC 0.874.
- Commit: `b627f8b` on local `main`. Not pushed (origin/main is gone — re-establish Friday if needed).
- Repo scaffolded per REPO_LAYOUT.md. Meta-agents live under `.claude/agents/`. Jury system prompts live under `agent/prompts/`.
- `.venv` at repo root, deps installed, `.env` populated.

## Today's one objective

**Jury split, one cell end-to-end, matching `shared/schema.py`.**

`Implementer → Interpreter → Tagger → Archivist` all called per step, each emitting a proper `DeliberationEvent`. Test on Titanic step 1 (profile the data) first. Only expand to a full Titanic run once the single-step roundtrip is clean.

## Proposed jury split

Per step:

```
  IMPLEMENTER         INTERPRETER          TAGGER           ARCHIVIST
  (sonnet-4-6)        (sonnet-4-6)         (haiku-4.5)      (sonnet-4-6)
  PLAN + CODE  ─→  execute cell  ─→  INTERPRETATION  ─→  TAG  ─→  optional KNOWLEDGE
     │                  │                  │                │           │
     └── emits PLAN     └── emits OUTPUT   └── emits        └── emits   └── emits
         event              event              INTERP event     TAG        KNOWLEDGE
                                                                event      (~20% of steps)
```

Event sequence per step (5 possible events, 4 agents): PLAN → CODE → OUTPUT → INTERPRETATION → TAG → [KNOWLEDGE].

The Implementer loses its "plan/hypothesis/alternatives" bloat → emits only PLAN event (narrative) + CODE cells. Interpreter takes over all the "what happened" and "risks" reasoning.

## Claude JSON formatting habits to anticipate in jury prompts

1. **Claude wraps JSON in markdown fences sometimes even when told not to.** The `parse_implementer_response` parser in loop_v0 strips fences — lift it to a shared `agent/parsing.py`, reuse across all four role parsers.
2. **Haiku is less disciplined with structure than Sonnet.** Tagger prompt should use a very narrow JSON shape (array of 1-3 strings from a closed vocabulary + one rationale sentence) to minimize format drift.
3. **"null" vs missing field.** Claude sometimes emits `"hypothesis": null`, sometimes omits the key entirely. All parsers should `.get(key)` not `obj[key]`.

## Executor fix (10-min job, don't forget)

The kernel's CWD is repo root. Agent code that does `plt.savefig('x.png')` drops files in the repo root. Before `setup_kernel()`, `os.chdir(out_dir)` or pass `resources={'metadata': {'path': str(out_dir)}}` to `NotebookClient`. Then gitignore stops fighting with agent artifacts.

## One thing the single-agent version did badly, assigned

The agent reports a held-out accuracy in step 3 and a CV accuracy in step 7, never flagging that step 3 was overconfident. **Interpreter role owns this** — its `risks` and `verify_next` fields should catch single-split estimates and demand CV before trusting.

Write the Interpreter prompt's examples with exactly this case in mind.

## Tripwires today (from CLAUDE.md)

- **Friday noon:** if jury can't produce a coherent Titanic step, go more scripted — hardcode the first 3 steps of the loop, let agents only fill code details.
- **Friday midnight:** if web ↔ agent streaming isn't working, fallback to "open .ipynb and scrub through a pre-recorded deliberation" demo.

## Order of operations (suggested)

1. ~10 min — fix executor CWD (see above).
2. ~60 min — write `agent/loop_v1.py`: Implementer → execute → Interpreter → Tagger → Archivist for one step. Emit `DeliberationEvent` records per `shared/schema.py`.
3. ~30 min — run it on Titanic step 1, verify the 5 events.
4. ~60 min — run full Titanic run (8 steps × 4 agents). Expect ~$1 in API calls.
5. Midday checkpoint: does it narrate better than loop_v0? If yes, start web + backend. If no, scripting fallback.
6. Afternoon: FastAPI `/events` + SSE endpoint + minimal Next.js page that streams deliberation events.
7. Evening: VS Code extension stub that POSTs a goal to the backend.

## What NOT to do today

- Don't polish the web UI beyond "streams events in order" (Saturday).
- Don't stand up Supabase auth (magic-link is a Saturday afternoon job).
- Don't try Opus 4.7 in the jury. Sonnet everywhere for now; swap to Opus only for Implementer hard-planning steps and only after the jury is stable.
