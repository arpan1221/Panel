# Architecture

**Analysis Date:** 2026-04-24

## Pattern Overview

**Overall:** Four-agent sequential jury pipeline with persistent Jupyter kernel and append-only event logging.

**Key Characteristics:**
- **Sequential, not concurrent:** Implementer → Kernel Execution → Interpreter → Tagger → Archivist, per step
- **Single source of truth:** Deliberation schema (Pydantic models in `shared/schema.py`) defines all event contracts
- **Append-only audit trail:** All decisions captured as `DeliberationEvent` objects written to `deliberation.jsonl`
- **Persistent kernel:** Single Jupyter kernel lives across entire experiment, accumulating state in a notebook
- **Model routing:** Sonnet 4.6 for reasoning agents; Haiku 4.5 for tagging (cheap classification)

## Layers

**Agent Runtime (`/agent`):**
- Purpose: Execute the four-agent jury loop, manage kernel, emit events, query knowledge base
- Location: `/Users/arpannookala/Documents/Panel/agent/`
- Contains: Jury orchestration (`loop_v1.py`), role-specific system prompts (`prompts/*.md`), event construction (`events.py`), LLM routing (`llm.py`)
- Depends on: Pydantic schema (`shared/schema.py`), Anthropic SDK, nbclient (Jupyter kernel), pandas
- Used by: Backend via subprocess spawning; VS Code extension via CLI

**Backend (`/backend`):**
- Purpose: Orchestrate agent subprocess spawning, stream events via SSE, serve experiment metadata and replay
- Location: `/Users/arpannookala/Documents/Panel/backend/`
- Contains: FastAPI app (`main.py`), routes for `/experiments`, `/events/{id}` (SSE), `/health`
- Depends on: FastAPI, sse-starlette, Pydantic, subprocess
- Used by: Web UI, extension, share page static renderer

**Web UI (`/web`):**
- Purpose: Live dashboard for experiment monitoring, form to spawn runs, share page renderer, authentication
- Location: `/Users/arpannookala/Documents/Panel/web/`
- Contains: Next.js 14 app with React components, Tailwind CSS, Supabase auth integration
- Depends on: Next.js 14, React 18, Supabase (auth only, not data), fetch API for backend
- Used by: Browser clients (localhost:3100 in dev, published domain in production)

**Shared Schema (`/shared`):**
- Purpose: Single contract for all event types, knowledge entries, and experiment state
- Location: `/Users/arpannookala/Documents/Panel/shared/schema.py`
- Contains: Pydantic models for `DeliberationEvent`, `KnowledgeEntry`, `ExperimentState`
- Depends on: Pydantic, Python standard library
- Used by: Agent, backend, web (TypeScript mirror), share renderer

**Extension (`/extension`):**
- Purpose: VS Code integration for launching experiments without leaving editor
- Location: `/Users/arpannookala/Documents/Panel/extension/`
- Contains: TypeScript extension manifest, command handlers
- Depends on: VS Code API, fetch API for backend
- Used by: VS Code users via command palette

## Data Flow

**Experiment Launch:**

1. User submits goal + dataset via web form, extension, or CLI
2. Backend (`POST /experiments`) spawns agent subprocess, creates run directory
3. Agent subprocess loads Jupyter kernel, begins jury loop

**Per-Step Loop (in Agent):**

1. **Implementer** reads goal, dataset desc, prior events, knowledge base → generates plan, hypothesis, cell code
2. **Executor** (not an agent) runs code cells in kernel, captures output + errors
3. **Interpreter** reads code + output + expected_result → flags surprises, leakage, risks
4. **Tagger** reads implementer plan + interpreter reading → assigns 1–3 semantic tags
5. **Archivist** reads entire step → decides whether to commit to knowledge base (rare, high-confidence only)

Each agent emits events via `EventStream.emit()` → written to `deliberation.jsonl` immediately (append-only).

**Event Streaming to Web:**

1. Backend SSE endpoint (`GET /events/{id}`) replays all existing events from `deliberation.jsonl`
2. Then polls for new lines in real-time, yielding each as SSE event
3. Web UI parses events, renders timeline, marks active stage (which agent is now running)

**Knowledge Base Integration:**

- Archivist writes `KnowledgeEntry` objects to `knowledge.jsonl` when high-confidence
- Next Implementer step receives recent knowledge entries as context
- Knowledge is experiment-scoped (each run has its own `knowledge.jsonl`)
- Cross-experiment knowledge base scaffolding present but not fully leveraged in v0.1

**State Management:**

- **Experiment state:** Stored in run directory on disk (`meta.json`, `notebook.ipynb`, `deliberation.jsonl`, `knowledge.jsonl`)
- **In-memory tracking (backend):** `PROCESSES` dict maps experiment_id → `RunHandle` (subprocess + status)
- **In-memory tracking (agent):** `EventStream` instance accumulates events + knowledge entries in memory during run
- No database — all state on filesystem

## Key Abstractions

**DeliberationEvent:**
- Purpose: Immutable record of any decision, inference, or action by any agent
- Examples: `loop_v1.py` lines 306–324 (plan event), 344–352 (code event), 415–426 (interpretation event)
- Pattern: Constructed via `EventStream.emit()`, written to JSONL immediately, never modified

**KnowledgeEntry:**
- Purpose: Persistent fact/pattern/pitfall/heuristic that survives across experiments
- Examples: `schema.py` lines 90–100
- Pattern: Created by Archivist, committed via `EventStream.commit_knowledge()`, keyed by `knowledge_id`

**EventStream:**
- Purpose: Single producer for all events, maintains monotonic counter, manages JSONL persistence
- Examples: `events.py` lines 25–91
- Pattern: One instance per experiment run, used by all four agent roles, ensures thread-safe ordering

**RunHandle:**
- Purpose: Wrapper around subprocess, tracks status (running/complete/failed)
- Examples: `backend/main.py` lines 43–58
- Pattern: Created when experiment spawns, read for status checks, used to poll subprocess.returncode

## Entry Points

**Web Browser (User):**
- Location: `http://localhost:3100` → `web/app/page.tsx`
- Triggers: User navigates to home
- Responsibilities: List past runs, show jury explainer, link to new run form and experiment viewer

**New Experiment Form:**
- Location: `web/app/new/page.tsx` + `web/app/NewRunForm.tsx`
- Triggers: User clicks "Start an experiment" → fills goal + dataset + max_steps
- Responsibilities: POST to `backend/POST /experiments`, redirect to live experiment view

**Live Experiment View:**
- Location: `web/app/experiment/[id]/page.tsx` + `web/app/experiment/[id]/LiveStream.tsx`
- Triggers: User navigates to `/experiment/{id}` or form redirects after launch
- Responsibilities: Establish SSE connection to `GET /events/{id}`, parse and render events, show orchestration banner

**Share Page (Static Rendering):**
- Location: `web/app/share/[id]/page.tsx`
- Triggers: User opens share URL (no auth required)
- Responsibilities: Fetch experiment from backend, render read-only timeline

**Agent CLI Entry:**
- Location: `agent/loop_v1.py` → `main()` function at line 552
- Triggers: `python -m agent.loop_v1 --goal "..." --dataset ... --out ... --max-steps 8`
- Responsibilities: Initialize jury loop, run max_steps iterations, write final artifacts

**Backend Health:**
- Location: `backend/main.py` → `GET /health` at line 108
- Triggers: Web checks on page load, extension checks before launching
- Responsibilities: Report service status, active run count

## Error Handling

**Strategy:** Emit error events, continue or halt gracefully.

**Patterns:**

- **Agent parse failure** (`loop_v1.py` lines 294–303): Implementer returns invalid JSON → emit ERROR event, break loop
- **Cell execution error** (`loop_v1.py` lines 362–370): Exception during `nbc.execute_cell()` → capture traceback, emit to OUTPUT event with error flag, continue to next step
- **Interpreter/Tagger/Archivist parse failure** (`loop_v1.py` lines 390–412, 436–445, 471–481): Return fallback object with empty/safe defaults, emit ERROR event, continue
- **Knowledge entry validation failure** (`loop_v1.py` lines 509–517): Reject invalid entry, emit ERROR event, do not add to knowledge base
- **Subprocess spawn failure** (`backend/main.py` lines 179–188): Raise HTTPException 500, client sees error
- **Missing experiment directory** (`backend/main.py` lines 204–206): Raise HTTPException 404

## Cross-Cutting Concerns

**Logging:** 
- Agent: stdout captured to `run.log` via subprocess redirect (backend, line 173)
- Backend: Implicit via print statements (e.g., `loop_v1.py` line 520)
- Web: Browser console + network inspector

**Validation:**
- **Pydantic models:** All event/knowledge/experiment state validated at construction (e.g., `schema.py` lines 58–83)
- **JSON parsing:** `agent/parsing.py` extracts JSON from LLM text, raises ValueError if malformed
- **Dataset existence:** `agent/loop_v1.py` line 46 checks if CSV exists, falls back to error description string

**Authentication:**
- **Web UI:** Supabase magic-link auth via `web/lib/supabase.ts`; routes check `isAuthConfigured()` and call `serverClient()`
- **Agent/Backend:** No authentication — runs on localhost in dev, trusted environment
- **Share page:** Public read-only access (no auth required)

**Concurrency:**
- **Sequential jury:** Guaranteed by single-threaded `loop_v1.py` main loop (no parallelism)
- **Multiple concurrent experiments:** Backend uses `asyncio` for SSE streaming but experiment runs are separate subprocesses
- **Event ordering:** `EventStream._counter` ensures monotonic event_ids even if multiple events emitted in quick succession

---

*Architecture analysis: 2026-04-24*
