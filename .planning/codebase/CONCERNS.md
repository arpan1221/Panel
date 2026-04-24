# Codebase Concerns

**Analysis Date:** 2026-04-24

## Tech Debt

**File descriptor leak in backend subprocess spawning:**
- Issue: `log_f` file handle in `backend/main.py:174` is opened but never closed on the exception path. The file is left open if `asyncio.create_subprocess_exec` fails.
- Files: `backend/main.py:174-188`
- Impact: Resource leak accumulates with repeated failed spawn attempts; file descriptors are exhausted over extended use.
- Fix approach: Wrap log file creation in try-except-finally or use context manager at function level. Always close `log_f` before raising.

**Unbounded cell output truncation inconsistency:**
- Issue: Cell outputs are truncated to different lengths in different layers:
  - `agent/loop_v1.py:81` truncates to 2000 chars + middle truncation for agent context
  - `web/components/jury.tsx:208` truncates to 2400 chars client-side
  - No consistent max-length enforced at schema level
- Files: `agent/loop_v1.py:62-82`, `web/components/jury.tsx:196-212`
- Impact: Unpredictable output loss in UI vs. deliberation log; confusion when examining full events.
- Fix approach: Define a single canonical max output size in `shared/schema.py` (e.g., max_body_length) and enforce at event creation time in `agent/events.py:emit()`.

**Subprocess process cleanup missing on backend restart:**
- Issue: `PROCESSES` dict in `backend/main.py:60` is in-memory only. Orphaned subprocesses from a previous backend instance are not tracked or cleaned up if the backend crashes and restarts.
- Files: `backend/main.py:60, 179-190`
- Impact: Zombie processes accumulate; eventual OS-level process limit exceeded; backend unable to spawn new runs.
- Fix approach: On startup, scan `RUNS_DIR` for stale runs with in-progress status and issue SIGTERM to orphaned pids (requires storing pid in meta.json). Alternatively, implement a kill-orphaned-processes-on-startup routine.

**No validation of dataset path in create_experiment:**
- Issue: `backend/main.py:140-171` accepts any dataset path from the user without checking existence or read permissions before passing to the agent subprocess.
- Files: `backend/main.py:100-171`
- Impact: Agent subprocess fails after spawning; uninformative error logs; wasted API budget on failed runs.
- Fix approach: Validate dataset path exists and is readable in the POST handler before spawning. Return 400 with descriptive error if path is invalid.

**Hard-coded pricing dictionary not in config:**
- Issue: `agent/loop_v1.py:544-549` defines pricing as a hardcoded dict. If model prices change, the code must be edited and redeployed.
- Files: `agent/loop_v1.py:544-549`
- Impact: Budget tracking becomes inaccurate after model price changes; no way to dynamically adjust without code change.
- Fix approach: Move PRICING to environment variables or a config file (`pricing.json`). Load at startup.

## Known Bugs

**Interpreter parse failure silently creates fallback response:**
- Symptom: When Interpreter's JSON parse fails, `agent/loop_v1.py:398-412` creates a hardcoded fallback response with zero tokens and fake confidence.
- Files: `agent/loop_v1.py:390-413`
- Trigger: Interpreter outputs non-JSON or malformed JSON (e.g., Haiku sometimes wraps JSON in markdown with extra prose).
- Workaround: The loop continues but the event is marked with confidence 0.0 and risks are lost. Next Interpreter call on a future step may work.
- Impact: Silent data loss; risk assessment is dropped; later steps don't see interpreter's concerns.

**SSE stream position tracking lost on concurrent reads:**
- Symptom: If two clients SSE-stream the same experiment simultaneously, file position `pos` in `backend/main.py:235-284` is not per-client. One client reading ahead causes the other to miss events.
- Files: `backend/main.py:226-286`
- Trigger: Opening the live view in two browser tabs for the same experiment; or reloading mid-run.
- Workaround: Close one tab and reconnect. The stream replays from the beginning.
- Impact: User misses events if they open the dashboard in a second window while a run is active.
- Fix approach: Track `pos` per-client (per SSE connection) using a closure or client-specific state. Each EventSourceResponse generator should have its own position pointer.

**Cell execution exception swallowed with generic "allow_errors=True":**
- Symptom: `agent/loop_v1.py:277` uses `allow_errors=True` which means NotebookClient doesn't raise on cell errors. Execution exceptions are only caught if they appear in the outputs.
- Files: `agent/loop_v1.py:354-371`
- Trigger: Kernel crashes (e.g., out-of-memory, segfault); cell raises an exception that doesn't serialize to output (rare but possible).
- Impact: Execution failure goes undetected; the next step proceeds with stale output from the previous step.
- Fix approach: Wrap `nbc.execute_cell()` in try-except *and* inspect `nc.get("outputs")` for error entries. Treat missing outputs as suspicious.

## Security Considerations

**CORS is unrestricted:**
- Risk: `backend/main.py:33-38` allows all origins (`allow_origins=["*"]`). Any website can make requests to the backend.
- Files: `backend/main.py:33-38`
- Current mitigation: Backend does not expose sensitive data (experiments are filesystem-based, no multi-tenant secrets). No authentication on backend endpoints.
- Recommendations: 
  - If auth is later added, restrict CORS to `http://localhost:3100` (dev) and documented production origins.
  - For now, document this as "dev-only, not for production without hardening."

**Agent spawning inherits full environment including secrets:**
- Risk: `backend/main.py:175-176` copies the entire `os.environ` to the subprocess. If any secret (ANTHROPIC_API_KEY, database credentials) is in the environment, it's accessible to the agent process.
- Files: `backend/main.py:175-176`
- Current mitigation: Agent process is trusted (runs in-house code, not user-supplied). But the pattern is fragile.
- Recommendations:
  - Explicitly whitelist environment variables to pass: `ANTHROPIC_API_KEY`, `PYTHONUNBUFFERED` only.
  - Remove other secrets before subprocess creation: `env = {"ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY"), "PYTHONUNBUFFERED": "1"}`.

**No rate limiting on experiment creation:**
- Risk: `backend/main.py:140-200` POST endpoint has no rate limit. A malicious client can spawn unlimited experiments, exhausting disk space and compute.
- Files: `backend/main.py:140-200`
- Current mitigation: This is a demo; authentication is not yet enforced. Assumes a single trusted user.
- Recommendations:
  - Document as "not suitable for multi-user without rate limiting."
  - When auth is added, implement per-user rate limits (e.g., 1 experiment every 10 seconds).

**Experiment metadata written unsanitized to disk:**
- Risk: `backend/main.py:147-154` writes user input (goal, dataset) directly to `meta.json` without escaping or validation.
- Files: `backend/main.py:147-154`
- Current mitigation: The data is JSON-serialized, which escapes quotes. But a malicious goal string with newlines or very long content could cause issues later.
- Recommendations:
  - Validate goal length (e.g., max 500 chars) before writing.
  - Validate dataset path to reject path traversal (e.g., `../../../etc/passwd`).

## Performance Bottlenecks

**Sequential polling in SSE stream every 0.3 seconds:**
- Problem: `backend/main.py:284` sleeps 0.3s between polls. Over a 2-minute run, that's ~400 wake-ups and file seeks. Inefficient but tolerable for single-user.
- Files: `backend/main.py:250-284`
- Cause: Naive polling approach instead of file-watcher (e.g., `watchdog` library) or OS-level inotify.
- Improvement path: For production, use a proper file-watch library. For now, acceptable for single experiment at a time.

**Full deliberation.jsonl re-read on every list request:**
- Problem: `backend/main.py:119-136` counts events by reading and iterating every line of every experiment's `deliberation.jsonl`. With many experiments or large files, this is O(n).
- Files: `backend/main.py:119-136`
- Cause: No caching; no index.
- Improvement path: Cache event counts in `meta.json` and update on each emit. Or use a lightweight database (SQLite) for metadata.

**Cell output truncation happens after kernel execution, not before:**
- Problem: `agent/loop_v1.py:62-82` extracts and truncates output text *after* the cell has already run and produced potentially gigabytes of output in memory.
- Files: `agent/loop_v1.py:62-82, 361-371`
- Cause: No limit on kernel output capture; truncation is only on display.
- Improvement path: Configure the Jupyter kernel to limit output per cell (e.g., via `max_output_length` in NotebookClient config).

## Fragile Areas

**Hardcoded prompt file paths:**
- Files: `agent/loop_v1.py:37, 238-241`
- Why fragile: If prompt files are missing, the agent fails immediately with FileNotFoundError. No graceful degradation.
- Safe modification: 
  1. Check prompt files exist at startup (in `main()`). 
  2. Provide a fallback inline prompt or a default set if files are missing.
  3. Document the required prompt files in a README under `/agent/prompts/`.
- Test coverage: Currently untested. Add unit test that validates all required prompts exist.

**EventStream counter is process-local, not idempotent:**
- Files: `agent/events.py:32, 39-41`
- Why fragile: The `_counter` is incremented in memory only. If the agent process restarts mid-experiment, event IDs will collide with prior events on disk.
- Safe modification:
  1. On EventStream init, read the highest event_id from `deliberation.jsonl`.
  2. Start the counter from that value + 1.
  3. This ensures idempotency across restarts.
- Test coverage: Not tested. Add a test that simulates a restart.

**Schema changes require updates in four locations:**
- Files: `shared/schema.py` (source of truth), `web/lib/backend.ts` (TypeScript mirror), `agent/loop_v1.py` (emits), `backend/main.py` (reads)
- Why fragile: Easy to forget one. A mismatch causes silent type errors or dropped fields.
- Safe modification:
  1. Always update `shared/schema.py` first.
  2. Regenerate TypeScript types from Python schema (consider using a code-generation tool, e.g., `pydantic-core`'s JSON schema exporter).
  3. Run type-checking in the web app (strict mode) to catch mismatches.
- Test coverage: No end-to-end test that verifies schema consistency across all four consumers.

## Scaling Limits

**Single-threaded kernel per experiment:**
- Current capacity: One Jupyter kernel runs per experiment sequentially. The kernel is not reused across experiments.
- Limit: If two experiments run concurrently, two kernels are spawned. With 10 concurrent runs, 10 kernels consume significant memory (~100MB each on typical systems).
- Scaling path: 
  - For now, acceptable (demo is single-user, single-run).
  - For multi-user: Implement a kernel pool or switch to a remote kernel (JupyterHub).

**File-based run storage:**
- Current capacity: Runs are stored as directories on the filesystem. Each run is a folder with `.ipynb`, `deliberation.jsonl`, `meta.json`, and logs.
- Limit: With hundreds of experiments, listing runs (`backend/main.py:119-136`) becomes slow. No pagination; the whole list is loaded into memory.
- Scaling path: Migrate to a lightweight database (SQLite) for metadata; keep .ipynb and .jsonl as files.

**In-memory PROCESSES dict:**
- Current capacity: Tracks up to ~1000 active processes before memory overhead is noticeable.
- Limit: With thousands of historical runs, the in-memory dict doesn't grow (only active processes), but the code assumes all runs can fit in memory for status checks.
- Scaling path: For now, acceptable. For production, use a database to track run history and status.

## Dependencies at Risk

**nbclient version not pinned:**
- Risk: `backend/main.py` and `agent/loop_v1.py` use `nbclient` for notebook execution. If a major version is released with API changes, the code may break silently.
- Impact: New environment installations may pull a broken version; CI/CD fails without a pinned version.
- Migration plan: Pin `nbclient==0.8.x` in `requirements.txt` (or latest stable). Test on a new environment.

**Anthropic SDK is pinned but model names are hardcoded:**
- Risk: `agent/llm.py:17-22` hardcodes model names (e.g., `claude-sonnet-4-6`). If Anthropic deprecates these models, the code will fail at runtime.
- Impact: Requires code changes to migrate to new models; no environment variable fallback.
- Migration plan: Allow model names to be overridden via environment variables. E.g., `PANEL_MODEL_IMPLEMENTER=claude-opus-5-latest`.

**JSONL parsing assumes one line per event:**
- Risk: `backend/main.py:69-81` reads JSONL by splitting on newlines. If a JSON event ever contains a literal newline in the body (unlikely but possible), parsing breaks.
- Impact: One malformed event corrupts the entire log for downstream readers.
- Migration plan: Use a proper streaming JSON parser (e.g., `ijson`) or enforce that newlines in event bodies are escaped.

## Missing Critical Features

**No experiment cancellation:**
- Problem: Once a run is started, there's no way to stop it without killing the backend or the subprocess manually.
- Blocks: Users can't abort long-running experiments; budget is wasted on failed runs that could be stopped early.
- Workaround: Manually send SIGTERM to the subprocess via OS tools.

**No knowledge base cross-referencing between experiments:**
- Problem: The Archivist can write to the knowledge base, but future experiments don't fetch or reference prior knowledge.
- Blocks: The "cumulative learning" feature pitched in README is scaffolded but not functional. Experiments are isolated.
- Current state: `agent/loop_v1.py:259` loads knowledge from disk but it's currently a single experiment's knowledge, not cross-experiment.

**No restart/resume for interrupted runs:**
- Problem: If a run crashes mid-execution, there's no way to resume from the last step. Must start over.
- Blocks: Long-running experiments are risky; a single cell timeout loses all prior work.
- Workaround: Manually re-run with `--max-steps` set to remaining steps (requires manual bookkeeping).

## Test Coverage Gaps

**No tests for EventStream idempotency across restarts:**
- What's not tested: Restarting an experiment after a crash and verifying event IDs don't collide.
- Files: `agent/events.py`
- Risk: Event log corruption is undetected; hard to debug after the fact.
- Priority: Medium (fragile for long-running experiments).

**No tests for SSE stream with concurrent clients:**
- What's not tested: Two clients reading the same experiment's SSE stream; verify both see all events in order.
- Files: `backend/main.py:226-286`
- Risk: Users see incomplete event streams if they open multiple tabs (known bug above).
- Priority: High (affects UX).

**No integration tests for schema consistency:**
- What's not tested: Round-trip serialization of DeliberationEvent through agent → disk → backend → browser. Verify TypeScript types match Python schema.
- Files: All four consumers of the schema
- Risk: Silent field drops or type mismatches that only manifest in production.
- Priority: High (core contract).

**No error-path tests for Interpreter parse failures:**
- What's not tested: Interpreter returns malformed JSON; verify loop continues with fallback and next step proceeds safely.
- Files: `agent/loop_v1.py:390-413`
- Risk: Loop resilience is not validated; unexpected parse failures may crash the run.
- Priority: Medium (relatively rare but impacts run success).

**No tests for large cell outputs:**
- What's not tested: A cell produces 10MB of output; verify truncation works, event is logged, UI renders without freezing.
- Files: `agent/loop_v1.py:62-82`, `web/components/jury.tsx:196-212`
- Risk: Large outputs may cause memory spikes or UI hangs; unknown behavior.
- Priority: Medium (edge case but impacts robustness).

**No tests for dataset path validation:**
- What's not tested: POST /experiments with invalid dataset path; verify error is caught early, not after subprocess spawn.
- Files: `backend/main.py:140-171`
- Risk: Wasted subprocess spawn and API calls on missing datasets.
- Priority: Medium (affects budget efficiency).

---

*Concerns audit: 2026-04-24*
