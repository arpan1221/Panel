# Technology Stack

**Analysis Date:** 2026-04-24

## Languages

**Primary:**
- **Python** 3.12.7 - Agent runtime, backend API, data science operations
- **TypeScript** 5.6.3 - Web frontend, VS Code extension
- **JavaScript** - Web configuration and tooling

**Secondary:**
- **SQL** - Postgres queries (via Supabase)

## Runtime

**Environment:**
- **Python 3.12** - Slim Docker base image for agent and backend
- **Node.js** 20.x - Web frontend and extension development
- **Docker** - Containerized deployment (docker-compose for local dev)

**Package Manager:**
- **pip** - Python dependencies
- **npm** - JavaScript dependencies (using package-lock.json for lockfile)

## Frameworks

**Core:**
- **Next.js** 14.2.15 - Web framework (React SSR, App Router)
- **React** 18.3.1 - UI component library
- **FastAPI** 0.115.6 - Backend HTTP API (async Python web server)
- **Uvicorn** 0.32.1 - ASGI application server for FastAPI

**Styling:**
- **Tailwind CSS** 3.4.13 - Utility-first CSS framework
- **Autoprefixer** 10.4.20 - PostCSS plugin for vendor prefixes
- **PostCSS** 8.4.47 - CSS transformation tool

**Notebook Execution:**
- **nbclient** 0.10.4 - Jupyter notebook cell execution engine
- **nbformat** 5.10.4 - Notebook format parsing and generation
- **ipykernel** 7.2.0 - IPython kernel for notebook execution
- **jupyter-client** ≥8.6,<9 - Jupyter protocol client

**Data Science:**
- **pandas** 3.0.2 - Data manipulation and analysis
- **scikit-learn** 1.8.0 - Machine learning models and utilities
- **matplotlib** 3.10.8 - Data visualization

**Build/Dev:**
- **TypeScript** 5.6.3 - Type checking and compilation
- **tsc** (via TypeScript) - TypeScript compiler for extension
- **VS Code** 1.85.0+ - Extension host

## Key Dependencies

**Critical:**
- **anthropic** 0.96.0 - Anthropic Claude API SDK for agent LLM calls
- **@supabase/supabase-js** 2.45.4 - Supabase client for browser/Node.js
- **@supabase/ssr** 0.5.1 - Supabase cookie-based session management for Next.js SSR

**Infrastructure:**
- **pydantic** 2.13.3 - Data validation and settings management (Python)
- **python-dotenv** 1.2.2 - Load .env files for configuration
- **sse-starlette** 2.1.3 - Server-Sent Events (SSE) streaming for FastAPI
- **@types/react** 18.3.11 - TypeScript types for React
- **@types/node** 20.16.11 - TypeScript types for Node.js

## Configuration

**Environment:**
Configuration via `.env` file (not committed; see `.env.example` for required vars):
- `ANTHROPIC_API_KEY` - Anthropic API credentials
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public, sent to browser)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (public, for browser auth)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-only, secret)
- `BACKEND_URL` - Backend API base URL for internal server communication
- `PUBLIC_SHARE_BASE_URL` - Base URL for public share pages
- `PANEL_BACKEND` - Backend URL for extension configuration

**Build:**
- `next.config.js` - Next.js config (`/Users/arpannookala/Documents/Panel/web/next.config.js`) - Enables standalone output for containerization
- `tsconfig.json` (web) - TypeScript strict mode, React 18 JSX, path aliases (`@/*`)
- `tsconfig.json` (extension) - TypeScript config for VS Code extension compilation
- `tailwind.config.ts` - Tailwind color customization for agent role colors
- `postcss.config.js` - PostCSS plugins (tailwind, autoprefixer)

**Container:**
- `docker-compose.yml` - Local dev stack with backend (8100), web (3100), and optional agent CLI
- `backend/Dockerfile` - Python 3.12 image, FastAPI + agent runtime
- `web/Dockerfile` - Node 20 Alpine image, Next.js dev server
- `agent/Dockerfile` - Python 3.12 image for CLI agent execution

## Platform Requirements

**Development:**
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose (for containerized dev)
- Environment variables configured in `.env`
- Anthropic API key
- Optional: Supabase credentials (auth is feature-flagged; app runs open without them)

**Production:**
- Docker containers (Next.js standalone, FastAPI/Uvicorn, Python agent as CLI invoked by backend)
- Filesystem-based run storage in `PANEL_RUNS_DIR` (defaults to `./runs`)
- .ipynb notebooks and deliberation.jsonl files persisted on disk
- Optional: Supabase project for magic-link auth
- Optional: Cloud storage (not yet integrated; local filesystem only for v0.1)

---

*Stack analysis: 2026-04-24*
