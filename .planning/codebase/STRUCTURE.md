# Codebase Structure

**Analysis Date:** 2026-04-24

## Directory Layout

```
/Users/arpannookala/Documents/Panel/
├── agent/                  # Python agent runtime; jury loop + prompts
│   ├── Dockerfile          # Docker image for agent subprocess
│   ├── __init__.py         # Empty; makes agent a package
│   ├── events.py           # EventStream class, event/tag/alternative parsers
│   ├── llm.py              # Model routing (Sonnet, Haiku, Opus)
│   ├── loop_v0.py          # Original single-agent loop (kept for reference)
│   ├── loop_v1.py          # Four-agent jury orchestration (ACTIVE)
│   ├── parsing.py          # JSON extraction from LLM text
│   ├── prompts/            # System prompts for each role
│   │   ├── implementer.md
│   │   ├── interpreter.md
│   │   ├── tagger.md
│   │   └── archivist.md
│   └── requirements.txt     # anthropic, nbclient, pandas, fastapi, python-dotenv
├── backend/                # FastAPI server; spawns agents, serves events
│   ├── Dockerfile          # Multi-stage build: Python 3.12 + dependencies
│   ├── __init__.py         # Empty; makes backend a package
│   ├── main.py             # FastAPI app with routes
│   └── requirements.txt     # fastapi, sse-starlette, pydantic
├── shared/                 # Pydantic schema; contract between all layers
│   ├── __init__.py
│   └── schema.py           # DeliberationEvent, KnowledgeEntry, ExperimentState models
├── web/                    # Next.js 14 frontend + auth
│   ├── Dockerfile          # Node 20 + npm build
│   ├── app/                # Next.js App Router
│   │   ├── layout.tsx      # Root layout (metadata, globals.css import)
│   │   ├── page.tsx        # Home: past runs, jury explainer, "Start" button
│   │   ├── NewRunForm.tsx  # Form component for new experiment
│   │   ├── auth/           # Supabase auth routes
│   │   │   ├── logout/route.ts
│   │   │   └── callback/route.ts
│   │   ├── login/          # Magic-link login page
│   │   │   ├── page.tsx
│   │   │   └── LoginForm.tsx
│   │   ├── new/            # New experiment page
│   │   │   └── page.tsx
│   │   ├── experiment/     # Live experiment viewer
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── LiveStream.tsx  # SSE client component
│   │   └── share/          # Read-only share page
│   │       └── [id]/page.tsx
│   ├── components/         # Reusable React components
│   │   └── jury.tsx        # StepCard, KnowledgePanel, bundleEvents
│   ├── lib/                # Utilities
│   │   ├── backend.ts      # Type definitions + fetch helpers for backend API
│   │   └── supabase.ts     # Supabase client setup
│   ├── globals.css         # Tailwind + custom variables (agent color scheme)
│   ├── tailwind.config.ts  # Tailwind config (extends with agent colors)
│   ├── middleware.ts       # Auth middleware
│   ├── next.config.js      # Next.js config
│   ├── tsconfig.json       # TypeScript strict mode
│   ├── package.json        # Next.js 14, React 18, Supabase, Tailwind
│   └── node_modules/       # Dependencies (not committed)
├── extension/              # VS Code extension
│   ├── src/
│   │   └── extension.ts    # Command handlers, backend HTTP calls
│   ├── Dockerfile          # Minimal; not part of main dev stack
│   ├── package.json        # vscode, esbuild
│   └── node_modules/       # Not committed
├── examples/               # Pre-baked datasets for demo
│   ├── titanic/
│   │   └── data/train.csv  # Kaggle dataset
│   ├── house_prices/
│   │   └── data/train.csv  # Kaggle dataset
│   └── discriminator_phd_flex/
│       └── data/...        # Sanitized microsimulation data
├── runs/                   # Experiment artifacts (volume-mounted in Docker)
│   ├── exp_xyz/
│   │   ├── meta.json       # Experiment metadata (goal, dataset, created_at)
│   │   ├── notebook.ipynb  # Jupyter notebook (updated per step)
│   │   ├── deliberation.jsonl  # Event log (append-only)
│   │   ├── knowledge.jsonl # Knowledge base commits (append-only)
│   │   └── run.log         # Subprocess stdout/stderr
│   └── ... (other runs)
├── docs/                   # Project documentation
│   ├── REPO_LAYOUT.md      # Overview of directories
│   ├── DEMO.md             # Demo narrative + talking points
│   └── charter/            # Project charter (git-protected)
├── .planning/              # GSD command outputs
│   └── codebase/           # Architecture + conventions maps (this directory)
├── .claude/                # Claude Code configuration (do not edit)
├── .agents/                # Agent skills (Supabase best practices)
├── CLAUDE.md               # Project constitution (do not edit)
├── README.md               # Vision + quick start (do not edit)
├── docker-compose.yml      # Dev stack: backend, web, agent CLI
├── .env.example            # Template env vars (API keys, Supabase config)
├── .env                    # Actual secrets (gitignored)
├── .dockerignore
└── .git/                   # Version control
```

## Directory Purposes

**`agent/`:**
- Purpose: Run the four-agent jury loop in a subprocess
- Contains: Orchestration code (`loop_v1.py`), system prompts, event handling, LLM routing
- Key files: `loop_v1.py` (main entry), `prompts/implementer.md|interpreter.md|tagger.md|archivist.md`

**`backend/`:**
- Purpose: FastAPI HTTP server; spawn agents, stream events, serve experiment metadata
- Contains: Single file `main.py` with all routes
- Key files: `main.py` (all endpoints in one file per CLAUDE.md constraint)

**`shared/`:**
- Purpose: Single source of truth for event schema, used by agent + backend + web
- Contains: Pydantic models only
- Key files: `schema.py`

**`web/`:**
- Purpose: Next.js frontend; home page, experiment form, live dashboard, share page
- Contains: App Router pages, React components, Tailwind CSS, Supabase auth
- Key files: `app/page.tsx` (home), `app/new/page.tsx` (launch form), `app/experiment/[id]/LiveStream.tsx` (live view)

**`extension/`:**
- Purpose: VS Code extension; launch experiments from editor
- Contains: TypeScript extension host code
- Key files: `src/extension.ts`

**`examples/`:**
- Purpose: Pre-baked datasets for demo
- Contains: CSV files for Titanic, House Prices, Discriminator experiments
- Key files: `titanic/data/train.csv`, `house_prices/data/train.csv`

**`runs/`:**
- Purpose: Experiment output directory (volume-mounted in Docker)
- Contains: One subdirectory per experiment, with artifacts
- Key files: `{experiment_id}/notebook.ipynb`, `{experiment_id}/deliberation.jsonl`, `{experiment_id}/knowledge.jsonl`

**`docs/`:**
- Purpose: Project documentation and charter
- Contains: README excerpts, demo narrative, charter (protected)
- Key files: `DEMO.md`

## Key File Locations

**Entry Points:**
- `agent/loop_v1.py` (line 552): Agent CLI entry (`python -m agent.loop_v1`)
- `backend/main.py` (line 108): Backend health check (GET /health)
- `web/app/page.tsx`: Web home (/)
- `web/app/new/page.tsx`: New experiment form (/new)
- `web/app/experiment/[id]/page.tsx`: Live dashboard (/experiment/{id})
- `extension/src/extension.ts` (line 63): Extension entry (activate function)

**Configuration:**
- `.env`: Environment variables (ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY)
- `.env.example`: Template with placeholders
- `docker-compose.yml`: Dev stack configuration
- `web/next.config.js`: Next.js settings
- `web/tailwind.config.ts`: Tailwind theme (agent color classes)
- `agent/Dockerfile`, `backend/Dockerfile`, `web/Dockerfile`: Container images

**Core Logic:**
- `agent/loop_v1.py` (line 227): Main jury orchestration (`run_jury()` function)
- `agent/events.py` (line 25): Event stream class (`EventStream`)
- `agent/llm.py` (line 43): LLM routing (`call_role()`)
- `shared/schema.py` (line 58): Event schema (`DeliberationEvent`)
- `backend/main.py` (line 139): Experiment launch endpoint (`create_experiment()`)
- `backend/main.py` (line 226): SSE streaming endpoint (`stream_events()`)
- `web/app/experiment/[id]/LiveStream.tsx` (line 21): Event parsing and rendering

**Styling:**
- `web/globals.css`: Tailwind imports + custom variables
- `web/tailwind.config.ts`: Theme config (agent colors: bg-implementer, bg-interpreter, etc.)

## Naming Conventions

**Files:**
- **Python:** snake_case (e.g., `loop_v1.py`, `events.py`)
- **TypeScript/TSX:** camelCase or PascalCase (e.g., `LiveStream.tsx`, `NewRunForm.tsx`, `backend.ts`)
- **Pydantic models:** PascalCase (e.g., `DeliberationEvent`, `KnowledgeEntry`)
- **CSS classes:** kebab-case (e.g., `bg-implementer`, `border-interpreter/40`)

**Variables/Functions:**
- **Python:** snake_case (e.g., `call_implementer()`, `run_jury()`, `describe_dataset()`)
- **TypeScript:** camelCase (e.g., `stageFromEvents()`, `defaultDatasetFromWorkspace()`, `copyShareUrl()`)

**Event IDs:**
- Format: `evt_0001`, `evt_0002`, etc. (monotonic counter, zero-padded)
- Example: `loop_v1.py` line 41 (in `EventStream._next_id()`)

**Experiment IDs:**
- Format: `exp_{10-char hex}` (e.g., `exp_abc123def0`)
- Example: `backend/main.py` line 143

**Knowledge IDs:**
- Format: `kb_{8-char hex}` (e.g., `kb_xyz789ab`)
- Example: `loop_v1.py` line 488

**Agent Roles:**
- Literal: `"implementer" | "interpreter" | "tagger" | "archivist"`
- Enum: `AgentRole.IMPLEMENTER`, `AgentRole.INTERPRETER`, etc. (in Python)
- Example: `schema.py` lines 19–23

## Where to Add New Code

**New Jury Agent (hypothetical, not in current scope):**
- Add enum value to `AgentRole` in `shared/schema.py`
- Add system prompt file `agent/prompts/{role}.md`
- Add model routing entry in `agent/llm.py` line 17–22
- Add role-specific caller in `agent/loop_v1.py` (e.g., `call_my_agent()`)
- Add step in main loop `run_jury()` function, around line 227
- Update web UI orchestration stage in `web/app/experiment/[id]/LiveStream.tsx` line 14 and 57–62

**New Backend Route:**
- Add endpoint in `backend/main.py` (one file, all routes)
- Follow existing pattern: define Pydantic input model, implement async handler, return JSON
- Example: `create_experiment()` at line 139

**New Web Page:**
- Create file in `web/app/{feature}/page.tsx` (App Router convention)
- Server component by default (no `"use client"` unless interactive)
- Use `lib/backend.ts` helpers for API calls
- Import components from `web/components/` and styled elements from `web/lib/`
- Example: `web/app/new/page.tsx`

**New Component:**
- Create file in `web/components/{ComponentName}.tsx`
- Export as default or named function
- Use Tailwind classes for styling
- Example: `web/components/jury.tsx` (contains `StepCard`, `KnowledgePanel`, `bundleEvents`)

**New Agent Prompt:**
- Create file `agent/prompts/{role}.md`
- Loaded by `load_prompt(name)` in `loop_v1.py` line 41–42
- Should define JSON schema for role's output (used by `parse_json_object()` in `parsing.py`)
- Example: `agent/prompts/implementer.md`

**New Semantic Tag:**
- Add to `SemanticTag` enum in `shared/schema.py` line 36–45
- Update README.md tag vocabulary table
- Update Tagger system prompt to include new tag
- UPDATE: This is a breaking change — invalidates all prior event logs

**New Utility/Helper:**
- **Python:** Add to `agent/` or `backend/` module, import as needed
- **TypeScript:** Add to `web/lib/` (e.g., `web/lib/utils.ts`)
- Example: `agent/parsing.py` (JSON extraction utilities)

## Special Directories

**`runs/`:**
- Purpose: Experiment output (volume-mounted in Docker)
- Generated: Yes (created by backend on experiment spawn)
- Committed: No (.gitignored)
- Retention: User-managed (can be deleted manually, recreated per experiment)

**`examples/`:**
- Purpose: Demo datasets
- Generated: No (pre-seeded)
- Committed: Yes (CSV files checked in)
- Retention: Keep for demo reproducibility

**`.next/` (web):**
- Purpose: Next.js build cache
- Generated: Yes (created by `npm run build`)
- Committed: No (in .gitignore)
- Retention: Transient; safe to delete

**`node_modules/` (web, extension):**
- Purpose: npm dependencies
- Generated: Yes (created by `npm install`)
- Committed: No (in .gitignore)
- Retention: Transient; recreated per deployment

**`.planning/codebase/`:**
- Purpose: GSD command outputs (architecture maps, conventions, testing patterns)
- Generated: Yes (by gsd-map-codebase agent)
- Committed: Yes (for orchestrator reference)
- Retention: Updated per major changes

**`docs/charter/`:**
- Purpose: Project charter (project constitution)
- Generated: No (hand-written)
- Committed: Yes (protected; do not edit without approval)
- Retention: Permanent; reference for scope and constraints

---

*Structure analysis: 2026-04-24*
