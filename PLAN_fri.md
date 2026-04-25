# PLAN — Friday (sprinting through the night with Thursday)

## Scope-cut override (for audit)

CLAUDE.md says "No Docker for v0.1 (unless Sunday reserve)." User overrode
that on Friday morning with "dockerize everything" — spec-keeper flagged
OUT-OF-SCOPE, user selected option 3 (full containerization now). The
dockerized stack is now in place (backend + web + agent images, compose at
repo root). Future spec-keeper runs should treat Docker work as in-scope.

## Today's objective

**End of day: live demo narrative works on Titanic.**

Concretely, by end of Friday, I can:
1. Hit a backend endpoint with `{goal, dataset}`
2. Watch the four-agent jury run, streamed event-by-event to a web page
3. Reload the page and see the full deliberation from `deliberation.jsonl`

No auth. No share page. No extension polish.

## In scope (ordered)

### Phase 0 — Dockerize the stack (DONE)
- `backend/Dockerfile` + `backend/main.py` + `backend/requirements.txt` (FastAPI, /health + /experiments stub on :8000 inside container, :8100 on host)
- `web/Dockerfile` + Next.js 14 App Router scaffold + Tailwind (:3100 host/container, SSR-fetches `http://backend:8000/health`)
- `agent/Dockerfile` — CLI image under `cli` profile, runs loop_v0 via `docker compose run --rm agent ...`
- `docker-compose.yml` — runs dir + examples volume-mounted so artifacts land on host; `.env` passed through
- Smoke verified: backend healthy, web renders "online" pill from SSR, agent container ran 2-step Titanic loop producing notebook.ipynb + deliberation.jsonl on host

### Phase A — Jury on Titanic (~2 hr)
1. Executor fix: kernel cwd = run out-dir, so agent plots don't leak into repo.
2. `shared/schema.py` event-id generator + helper for appending events.
3. `agent/loop_v1.py`: Implementer → execute → Interpreter → Tagger → Archivist per step. Each emits proper `DeliberationEvent` records. Model routing per CLAUDE.md: Implementer sonnet-4-6, Interpreter sonnet-4-6, Tagger haiku-4.5, Archivist sonnet-4-6.
4. Titanic full jury run — smoke acceptance: ≥5 steps × 4-5 events/step = ≥20 events, each parseable against `DeliberationEvent`.

### Phase B — Backend + streaming (~2 hr)
5. `backend/main.py` FastAPI with:
   - `POST /experiments` — kicks off a run (subprocess), returns experiment_id
   - `GET /events/{experiment_id}` — SSE stream tailing `deliberation.jsonl`
   - `GET /experiments/{experiment_id}` — full deliberation replay (for reloads)
6. Smoke: curl the SSE and see events arrive live.

### Phase C — Web UI (~2 hr)
7. `web/` Next.js 14 app (App Router + Tailwind), one page: `/experiment/[id]`.
8. Page shows the four jury lanes, events stream in, timeline with semantic tags on the side. Minimal — readable type, clear roles, event-type color coding. No auth.
9. Smoke: click "run Titanic," watch the four agents fill the page live.

### Phase D — House Prices regression test (~30 min)
10. Same jury, House Prices dataset, regression metric (RMSE/R²). If it works without changes, the jury generalizes. If not, find the prompt hole.

## Out of scope (spec-keeper enforces)

- Share page / public URL — Saturday.
- Supabase magic-link auth — Saturday afternoon.
- VS Code extension — Saturday, unless Friday finishes early.
- Tests beyond smoke runs.
- Opus 4.7 in the jury. Sonnet-default for now; revisit once the jury is stable.
- Refactoring loop_v0 away. Keep it as a reference.

## Tripwires

- **If loop_v1 can't produce a coherent step by 3 hours in:** fall back to scripting the Implementer's plan (3 hardcoded step templates — profile, baseline, improve — let the agent fill code only). Interpreter/Tagger/Archivist still run on top.
- **If SSE isn't working by 5 hours in:** fall back to polling (`GET /experiments/{id}` every 2s). Not as nice but demoable.
- **If the web UI isn't rendering events by 7 hours in:** ship the backend + a CLI that pretty-prints the jury, record the demo from the terminal. Ugly but sufficient.

## Acceptance criteria (today done)

- [ ] `agent/loop_v1.py` produces valid `DeliberationEvent` stream on Titanic with no schema validation errors.
- [ ] `backend/main.py` SSE endpoint emits events in real-time as the jury writes them.
- [ ] `web/` shows a live event timeline for a running Titanic experiment.
- [ ] Same flow works on House Prices without code changes.

## Budget

Jury run ~4× loop_v0 cost → ~$1/experiment. Expect ~$10 in iteration. Hard stop and review if >$50.
