# Testing Patterns

**Analysis Date:** 2026-04-24

## Test Framework

**Runner:**
- No test framework configured in codebase (pytest, unittest, vitest, or jest not found)
- Manual testing via canonical experiments: Titanic, House Prices, Discriminator Overfitting (see CLAUDE.md)

**Test Configuration:**
- No `pytest.ini`, `conftest.py`, or test runner config files detected
- No Jest/Vitest config in `web/package.json` or `extension/package.json`

**Run Commands:**
```bash
# Web (linting only, no unit tests)
npm run lint              # Run Next.js linter

# Agent (manual/manual CLI testing)
python -m agent.loop_v1 --goal "..." --dataset examples/titanic/data/train.csv \
    --out runs/titanic_jury --max-steps 8

# Backend (no test runner, only health check via curl)
curl http://localhost:8100/health
```

## Test File Organization

**Location:**
- No dedicated test directory structure (`__tests__/`, `tests/`, `.test.` or `.spec.` files not found in source)
- Testing performed via **canonical experiments** in `/examples/` directory
- Run artifacts stored in `/runs/` directory with `.ipynb` and `deliberation.jsonl` output

**Canonical Test Experiments:**
- `examples/titanic/` - Binary classification baseline
- `examples/house_prices/` - Regression baseline
- `examples/discriminator/` - PhD flex (leakage detection)

See CLAUDE.md for expected run times and acceptance criteria:
- Titanic: ~90 seconds, should report AUC
- House Prices: ~120 seconds, should report RMSE/R² and feature importance
- Discriminator: Detect survey-ID leakage (LIVQTRRV, EST_ST, EST_MSA, KINDWORK)

**Naming:**
- Run directories: `exp_{uuid_hex_10_chars}` (e.g., `exp_a1b2c3d4e5`)
- Output files per run: `deliberation.jsonl`, `notebook.ipynb`, `knowledge.jsonl`, `meta.json`, `run.log`

## Test Structure

**Suite Organization:**
- No test suite framework detected
- Testing structured around **end-to-end experiment runs** via CLI

**Canonical experiment invocation example (from CLAUDE.md):**
```bash
python -m agent.loop_v1 \
  --goal "Load Titanic, compute survival rate, profile missing values." \
  --dataset examples/titanic/data/train.csv \
  --out runs/titanic_jury \
  --max-steps 8
```

**Patterns:**
- No explicit setup/teardown - each run creates a fresh experiment directory with isolated state
- State preserved in `deliberation.jsonl` append-only log and `notebook.ipynb`
- No fixtures in traditional test sense; pre-baked example datasets in `examples/*/data/` serve as test data

## Mocking

**Framework:**
- No mocking library detected (unittest.mock, jest, vitest not in dependencies)

**Patterns:**
- **LLM mocking:** Not done - real Anthropic Claude API calls made on every jury run
- **File system:** Uses real filesystem; tests isolated by experiment_id directory
- **Backend SSE streaming:** Uses real asyncio subprocess (see `backend/main.py` lines 179-185)

**What to Mock (if testing were added):**
- Anthropic API calls (high cost, slow; use cached responses for iterative dev)
- File I/O (use temporary directories via `tempfile`)
- Notebook kernel execution (currently live; could mock nbclient for unit tests)

**What NOT to Mock:**
- Event stream persistence to `deliberation.jsonl` (contract between agents)
- Pydantic model validation (schema is the contract)
- Notebook cell execution order (critical to jury correctness)

## Fixtures and Factories

**Test Data:**
- **Location:** `examples/titanic/data/train.csv`, `examples/house_prices/data/train.csv`
- **Format:** Standard CSV with headers; referenced by path in experiment runs
- **Size:** Titanic uses full ~900 rows; sampled in memory for descriptions (first 5000 rows)

**Example dataset description generation (from `loop_v1.py` lines 45-56):**
```python
def describe_dataset(dataset_path: Path) -> str:
    if not dataset_path.exists():
        return f"(dataset not found: {dataset_path})"
    df = pd.read_csv(dataset_path, nrows=5000)
    return (
        f"path: {dataset_path}\n"
        f"rows_sampled: {len(df)}\n"
        f"columns ({len(df.columns)}): {list(df.columns)}\n"
        f"dtypes:\n{df.dtypes.to_string()}\n"
        f"head(5):\n{df.head(5).to_string()}\n"
        f"missing_counts:\n{df.isna().sum().to_string()}"
    )
```

**Run metadata fixtures (from `backend/main.py` lines 147-154):**
```python
meta = {
    "experiment_id": experiment_id,
    "goal": body.goal,
    "dataset": body.dataset,
    "max_steps": body.max_steps,
    "created_at": datetime.now(timezone.utc).isoformat(),
}
(rd / "meta.json").write_text(json.dumps(meta, indent=2))
```

## Coverage

**Requirements:**
- No coverage tools detected (coverage.py, nyc, etc.)
- No minimum coverage enforced
- Testing requirement: all features must work end-to-end on three canonical experiments

**Quality gates:**
- Features must work on Titanic *and* House Prices (not just one)
- PhD flex (Discriminator) must run by Saturday night for demo inclusion
- See tripwires in CLAUDE.md for go/no-go checkpoints

**View Coverage:**
- Manual: Review deliberation logs in web UI `/experiment/{id}` or raw JSON
- File location: `/runs/{experiment_id}/deliberation.jsonl` and `knowledge.jsonl`

## Test Types

**Unit Tests:**
- None formalized
- Individual functions (`parse_json_object()`, `parse_tags()`, `parse_alternatives()`) could benefit from unit tests for error cases

**Integration Tests:**
- Backend ↔ Agent subprocess: Tested via `backend/main.py` POST `/experiments` endpoint (lines 139-199)
- Web ↔ Backend: Tested via `web/app/NewRunForm.tsx` form submission (lines 33-50)
- Agent ↔ LLM: Tested via canonical experiments; every jury step makes real LLM calls
- Event persistence: Tested implicitly; all four agents write to shared `deliberation.jsonl` file

**E2E Tests:**
- **Framework:** Manual CLI invocation
- **Scope:** Full experiment loop: Implementer → Interpreter → Tagger → Archivist → persist notebook + deliberation + knowledge
- **Coverage:** Titanic, House Prices, Discriminator experiments
- **Assertion method:** Manual review of output files; check for:
  - Valid `deliberation.jsonl` (one event per line, valid JSON)
  - Valid `notebook.ipynb` (nbformat-compatible)
  - Non-empty `events` array in each
  - Correct agent roles and event types emitted

## Common Patterns

**Async Testing:**
- Backend uses `asyncio` for concurrent subprocess management (not tested explicitly)
- FastAPI endpoints return async generators for SSE streaming (see `backend/main.py` lines 226-286)
- Example test would need to: create experiment, stream events, verify notebook written

**Error Testing:**
- Error cases emitted as `EventType.ERROR` events (see `loop_v1.py` lines 294-303)
- LLM parse failures caught; agent aborts step
- Cell execution errors captured in `step_error` variable and persisted (lines 355-373)
- Errors propagated to backend via HTTP exception (see `backend/main.py` lines 186-188)

**Example error flow (from `loop_v1.py` lines 282-303):**
```python
try:
    impl = call_implementer(
        impl_prompt,
        goal,
        dataset_desc,
        stream.events,
        last_output,
        last_error,
        step,
        max_steps,
        knowledge,
    )
except ValueError as e:
    stream.emit(
        agent=AgentRole.IMPLEMENTER,
        event_type=EventType.ERROR,
        step_number=step,
        summary=f"implementer parse failed",
        body=str(e),
        confidence=0.0,
    )
    break  # Exit jury loop on parse failure
```

## Manual Testing Checklist

When testing a new feature, verify end-to-end on all three canonical experiments:

1. **Titanic experiment:**
   - Run: `python -m agent.loop_v1 --goal "Predict survival..." --dataset examples/titanic/data/train.csv --out runs/test_titanic --max-steps 8`
   - Check: `deliberation.jsonl` has 8+ steps, all agents represented, final notebook includes model metrics

2. **House Prices experiment:**
   - Run: `python -m agent.loop_v1 --goal "Predict price..." --dataset examples/house_prices/data/train.csv --out runs/test_prices --max-steps 8`
   - Check: Regression output present, feature importance mentioned, no hard crashes

3. **Discriminator experiment:**
   - Run: `python -m agent.loop_v1 --goal "Detect survey-ID leakage..." --dataset examples/discriminator/data/hps_cps.csv --out runs/test_disc --max-steps 12`
   - Check: Final notebook mentions LIVQTRRV, EST_ST, EST_MSA, or KINDWORK as problematic features

**Browser testing (after backend + web both running):**
```bash
# Terminal 1: Backend
python -m backend.main

# Terminal 2: Web
cd web && npm run dev

# Terminal 3: VS Code Extension (if testing)
# Open extension/src/extension.ts in VS Code, run Extension host debugger
```

---

*Testing analysis: 2026-04-24*
