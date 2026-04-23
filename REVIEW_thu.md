# REVIEW — Thursday, April 23, 2026

## 1. Did the loop work end-to-end?

Yes. First real run was clean: 8 steps, 16 cells (8 code + 8 markdown), 0 execution errors, agent self-terminated with `done=True`. Produced a Titanic notebook that trains logistic regression + random forest, runs 5-fold CV, and prints a final summary ranking features.

**Final metric:** accuracy 83.3%, ROC-AUC 0.874 (5-fold CV RF on engineered features).

## 2. Token cost of a full Titanic run

- Input: 21,084 tokens
- Output: 11,809 tokens
- **Cost: $0.24** on `claude-sonnet-4-6` ($3/M input, $15/M output)
- Wall time: 164s agent compute (excluding cell execution)

Implications: a 5-experiment demo loop is ~$1.20. The $500 budget is effectively unconstrained for the build — don't optimize prematurely. Friday's jury split will roughly 4× cost per step (separate Implementer + Interpreter + Tagger + Archivist calls), so estimate ~$1/experiment on the jury. Still fine.

## 3. Three things about Claude's response format worth noting

1. **Clean JSON every time.** All 8 responses parsed on the first try. The fenced-JSON strip + trailing-prose fallback in `parse_implementer_response` was never needed on this run, but leave it — Haiku (Tagger) on Friday is less disciplined with structured output and will trip it.
2. **Strong adherence to the example structure.** Every response emitted exactly 1 markdown + 1 code cell, never more, never fewer. The Implementer prompt's example ("Step 1 plan: Profile…") appears to be load-bearing — treat it as schema, not flavor text.
3. **Confidence self-calibrates.** The agent's self-reported `confidence` dropped during exploration (0.95 → 0.72 mid-run, when adding engineered features) and rose again during validation (0.82 → 0.88 at the summary). This is the behavior we want in the jury; it means the Interpreter has real signal to work with when its Implementer looks uncertain.

## 4. One thing the single-agent version did WELL — keep this in the jury version

**Natural sequential progression without being told.** The Implementer walked profile → baseline logreg → RF → feature eng (Title) → feature eng (FamilySize/IsAlone) → CV → summary with no scaffolding from me. The tripwire in PLAN_thu.md anticipated we might have to hardcode the first three steps as a skeleton. We don't. The Implementer's prompt as written produces a coherent research arc.

**Keep:** the Implementer prompt's example block, the "one cell per turn" constraint, and passing `deliberation_history` + `last_output` as the only memory mechanism (no scratchpad, no chain-of-thought preservation across turns).

## 5. One thing it did BADLY — assign to the right jury role

**It didn't catch its own methodological holes.** The run reports a held-out accuracy from a single 80/20 split in step 3, then re-reports a different accuracy from 5-fold CV in step 7 — without ever flagging that the earlier numbers are overconfident. The agent "moves on" rather than interrogating itself.

**Assign to:** the **Interpreter.** Its job includes `risks` and `verify_next` — it should be reading the Implementer's output and explicitly noting "single-split estimate; variance unknown; recommend CV before trusting." Right now the single-agent version has no role that does this, and it shows.

**Secondary bad thing (infrastructure, not a jury role):** agent's code saved plots to `examples/titanic/data/` instead of the run's out-dir, because the kernel's cwd is the repo root. Friday's executor needs to `chdir` into `runs/<experiment_id>/` before starting the kernel.

## 6. Tomorrow's first priority

**Split the single Implementer call into the Implementer → Interpreter → Tagger → Archivist sequence for one cell.** Not for the whole loop — for exactly one cell, end-to-end, producing 4 deliberation events (PLAN, CODE+OUTPUT, INTERPRETATION, TAG, optional KNOWLEDGE). Get that working on Titanic before expanding to the full run. This is the first friction point where model routing (Sonnet vs Haiku vs Opus) becomes real.

Concretely: write `agent/loop_v1.py` that calls all four roles per step, using the already-existing prompts in `agent/prompts/`, emitting proper `DeliberationEvent` records matching `shared/schema.py`. Don't swap `loop_v0.py`; keep it as a working reference.

**Second priority:** fix the executor to `chdir` into the run dir. 10-minute job.

## Closing

Commit: `b627f8b`. `.env` safely gitignored. Two commits ahead of origin (not pushed — origin/main is `[gone]`).

Stopping at midnight per PLAN_thu.md tripwire. The single-agent loop works; pushing further tonight costs Friday.
