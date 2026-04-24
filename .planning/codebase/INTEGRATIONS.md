# External Integrations

**Analysis Date:** 2026-04-24

## APIs & External Services

**LLM (Claude):**
- **Anthropic Claude API** - Primary external integration for agentic jury execution
  - SDK: `anthropic` 0.96.0 (Python)
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Models called:
    - `claude-opus-4-7` - Hard planning steps (not currently used in jury loop)
    - `claude-sonnet-4-6` - Implementer, Interpreter, Archivist agents
    - `claude-haiku-4-5-20251001` - Tagger agent (cheap classification)
  - Invocation: `agent/llm.py` → `call_role()` function routes by agent role to appropriate model
  - Usage tracking: LLMCall dataclass captures input_tokens, output_tokens, latency_s
  - Budget: $500 API credit for hackathon; no caching/optimization yet

## Data Storage

**Databases:**
- **Supabase Postgres** (optional, feature-flagged)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (browser) + `SUPABASE_SERVICE_ROLE_KEY` (server)
  - Client: `@supabase/supabase-js` (browser/Node.js), `@supabase/ssr` (Next.js SSR integration)
  - Auth mechanism: Magic-link email OTP (native Supabase auth)
  - Status: Scaffolding present; used for auth only, not data persistence yet
  - RLS status: Not yet configured (auth feature-flagged as optional)

**File Storage:**
- **Filesystem only** - Local storage for v0.1
  - Run artifacts: `deliberation.jsonl` (stream of DeliberationEvent objects), `knowledge.jsonl` (KnowledgeEntry objects), `.ipynb` notebooks
  - Location: `PANEL_RUNS_DIR` env var (defaults to `./runs` in project root)
  - Persistence: Synchronous JSONL append in `agent/events.py` (EventStream class)
  - Backend reads from filesystem for replay and SSE streaming

**Caching:**
- **None** - No explicit caching layer configured

## Authentication & Identity

**Auth Provider:**
- **Supabase Magic Link** (optional, not required for core functionality)
  - Implementation: Magic-link OTP via email
  - Code location: `web/lib/supabase.ts` (browserClient, serverClient, middlewareClient factories)
  - Auth route: `web/app/auth/callback/route.ts` (exchanges code for session)
  - Login form: `web/login/LoginForm.tsx` (sends OTP request via `sb.auth.signInWithOtp()`)
  - Session management: Cookie-based, handled by `@supabase/ssr` middleware
  - Fallback: If auth not configured, app runs open (no login required)
  - Check: `isAuthConfigured()` function determines if both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are present

## Monitoring & Observability

**Error Tracking:**
- **None** - No external error tracking service integrated (Sentry, Rollbar, etc.)

**Logs:**
- **Console output** - Agent and backend log to stdout/stderr
- **Filesystem** - Run deliberation and knowledge stored as JSONL for audit trail
- **SSE streaming** - Backend streams events live to web UI as they're written to deliberation.jsonl

## CI/CD & Deployment

**Hosting:**
- **Docker Compose** (local dev)
- **Docker** images (production-ready containers for backend, web, agent)
- Deployment target: Any Docker-compatible host (cloud run, EC2, k8s, etc.)

**CI Pipeline:**
- **None** - No automated CI/CD configured yet (runs locally or in container)

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Critical for agent LLM calls
- `BACKEND_URL` - Server-side backend communication (internal routing)
- `NEXT_PUBLIC_SUPABASE_URL` - Optional; if missing, auth skipped
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Optional; if missing, auth skipped
- `SUPABASE_SERVICE_ROLE_KEY` - Optional; required only if auth is enabled

**Optional env vars:**
- `PANEL_RUNS_DIR` - Filesystem path for run artifacts (defaults to `./runs`)
- `PUBLIC_SHARE_BASE_URL` - Base URL for share pages (defaults to `http://localhost:3000/share`)
- `PANEL_BACKEND` - Extension backend URL config

**Secrets location:**
- `.env` file (gitignored, not committed)
- Example template: `.env.example`
- In containers: Passed via `env_file: .env` in docker-compose.yml

## Webhooks & Callbacks

**Incoming:**
- **Supabase auth callback** - `web/app/auth/callback/route.ts` receives `code` query param from magic-link redirect
- **Backend SSE stream** - `GET /events/{id}` on backend streams deliberation.jsonl events to web UI as they're written

**Outgoing:**
- **Agent subprocess output** - Backend spawns agent as subprocess, reads stdout/stderr, tails deliberation.jsonl file in real-time
- **Supabase email OTP** - Auth requests trigger outbound email via Supabase's managed email service (optional)

## Data Flow

**Experiment Execution:**
1. Web UI or VS Code extension sends POST to `backend/experiments`
2. Backend spawns Python subprocess running `agent.loop_v1` CLI
3. Agent writes DeliberationEvent objects to `deliberation.jsonl` (one per line)
4. Agent executes notebook cells via `nbclient`, capturing output
5. Web UI pulls events live via SSE `/events/{id}` stream
6. On completion, Archivist optionally writes to `knowledge.jsonl`
7. Share URL generated; anyone with link can fetch run artifacts via `/experiments/{id}`

**Authentication Flow (if enabled):**
1. User enters email on login page
2. `sb.auth.signInWithOtp()` sends magic-link email via Supabase
3. User clicks link, browser redirected to `/auth/callback?code=...`
4. Callback route exchanges code for session token via `sb.auth.exchangeCodeForSession(code)`
5. Session stored as cookie, automatically refreshed via middleware
6. Subsequent requests include valid session; if auth is enforced, RLS policies would protect data

---

*Integration audit: 2026-04-24*
