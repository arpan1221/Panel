# Panel — Repository Layout

Monorepo. Single git repo. No submodules. All development happens here.

```
panel/
├── CLAUDE.md                    # Project constitution for Claude Code sessions
├── README.md                    # Project pitch + demo narrative
├── LICENSE                      # MIT
├── .gitignore                   # node_modules, .env, __pycache__, .next, *.ipynb_checkpoints
├── .env.example                 # Template — ANTHROPIC_API_KEY, SUPABASE_URL, etc.
│
├── shared/                      # Language-agnostic contracts
│   ├── schema.py               # Pydantic models (primary source of truth)
│   └── schema.ts               # TypeScript mirror (hand-kept in sync, or codegen later)
│
├── agent/                       # Python agent runtime
│   ├── __init__.py
│   ├── loop.py                 # The main per-step loop calling the four agents
│   ├── implementer.py          # Implementer wrapper around Anthropic SDK
│   ├── interpreter.py
│   ├── tagger.py
│   ├── archivist.py
│   ├── executor.py             # Wraps nbclient / jupyter_client to run cells
│   ├── deliberation_log.py     # Appends JSONL, reads history
│   ├── knowledge_store.py      # Local SQLite of KnowledgeEntry rows
│   ├── prompts/
│   │   ├── implementer.md
│   │   ├── interpreter.md
│   │   ├── tagger.md
│   │   └── archivist.md
│   ├── run_experiment.py       # CLI entry: python -m agent.run_experiment --goal ... --dataset ...
│   └── requirements.txt
│
├── backend/                     # FastAPI
│   ├── main.py                 # Routes: /experiments, /events, /share/:id, /sse/:id
│   ├── auth.py                 # Supabase JWT verification
│   ├── storage.py              # Reads deliberation.jsonl, writes to DB for share URLs
│   ├── share_render.py         # Bakes a finished experiment into a static HTML bundle
│   └── requirements.txt
│
├── web/                         # Next.js 14 app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Dashboard: experiment list
│   │   ├── login/page.tsx      # Supabase magic-link login
│   │   ├── experiment/
│   │   │   ├── new/page.tsx    # Start a new experiment
│   │   │   └── [id]/page.tsx   # Live experiment view
│   │   └── share/[token]/page.tsx  # Public share page (no auth)
│   ├── components/
│   │   ├── NotebookView.tsx
│   │   ├── JuryPanel.tsx       # The four-agent live transcript
│   │   ├── TagTimeline.tsx
│   │   └── BranchExplorer.tsx  # Alternatives considered, collapsible
│   ├── lib/
│   │   ├── sse.ts              # Event source client
│   │   └── schema.ts           # Mirror of shared/schema.py
│   ├── package.json
│   └── tsconfig.json
│
├── extension/                   # VS Code extension (TypeScript)
│   ├── src/
│   │   ├── extension.ts        # Activation, command registration
│   │   ├── auth.ts             # Magic-link flow, stores token in secrets
│   │   ├── poller.ts           # Polls backend for new experiment intents
│   │   └── runner.ts           # Spawns agent runtime, streams its JSONL to backend
│   ├── package.json
│   └── tsconfig.json
│
└── examples/                    # Pre-baked demo experiments
    ├── titanic/
    │   ├── data/train.csv
    │   ├── goal.txt
    │   └── expected_deliberation.jsonl   # Reference for QA
    ├── house_prices/
    │   ├── data/train.csv
    │   ├── goal.txt
    │   └── expected_deliberation.jsonl
    └── discriminator_phd_flex/
        ├── data/                         # Sanitized slice, git-lfs or local-only
        ├── goal.txt                      # "Detect population shift between CPS and HPS"
        ├── scripted_path.md              # If agent goes off-script, use this to narrate
        └── expected_deliberation.jsonl
```

## What goes in `/examples` vs what stays local

- `/examples/titanic/` and `/examples/house_prices/` — public Kaggle data, commit directly.
- `/examples/discriminator_phd_flex/data/` — sanitized sliver of PhD data. Depending on what's shareable, either (a) commit a tiny anonymized version, or (b) gitignore and point the README at a download script.

## Which directories are "hot" on which day

- **Thursday night:** `/agent/` only. Get the Python loop running end-to-end. No UI, no backend, just `python -m agent.run_experiment --goal "predict titanic survival" --dataset examples/titanic/data/train.csv` producing `notebook.ipynb` and `deliberation.jsonl` locally.

- **Friday:** `/backend/` + `/web/`. Backend tails JSONL, exposes SSE. Web UI subscribes and renders. In parallel, split the single-prompt loop in `/agent/` into the four-agent jury using the prompts in `/agent/prompts/`.

- **Friday evening:** `/extension/`. Minimum viable — authenticates to backend, receives "start experiment X" commands, spawns `agent.run_experiment` as a subprocess.

- **Saturday:** `/backend/share_render.py` + `/examples/discriminator_phd_flex/`. Static share page, PhD flex.

- **Sunday:** reserve. Only touch whatever is broken.

## Commit hygiene

- First commit tonight: the scaffold. Just README, CLAUDE.md, and the empty directory tree with .keep files.
- Second commit: the schema in `/shared/schema.py`.
- Third commit: the four prompts in `/agent/prompts/`.
- After that: commits reference the day and area. `[thu-night][agent] loop scaffolding`, `[fri-am][agent] split into four-agent jury`, etc.
