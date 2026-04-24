# Coding Conventions

**Analysis Date:** 2026-04-24

## Naming Patterns

**Files:**
- Python: lowercase with underscores (`loop_v1.py`, `parsing.py`, `events.py`)
- TypeScript/TSX: PascalCase for components (`NewRunForm.tsx`, `LoginForm.tsx`), camelCase for utilities (`backend.ts`, `supabase.ts`)
- Configuration: lowercase with dots (`.env.example`, `tsconfig.json`)

**Functions:**
- Python: snake_case (`run_jury()`, `parse_json_object()`, `call_implementer()`)
- TypeScript: camelCase for functions (`listExperiments()`, `getExperiment()`, `getHealth()`)
- React components: PascalCase (`TagPill`, `StepCard`, `KnowledgePanel`, `NewRunForm`)

**Variables:**
- Python: snake_case throughout (`dataset_path`, `last_output`, `step_error`)
- TypeScript: camelCase (const `submitting`, `goal`, `dataset`)
- Type/Interface names: PascalCase (`RunSummary`, `DeliberationEvent`, `ExperimentMeta`)

**Types/Enums:**
- Python dataclasses and Pydantic: PascalCase (`EventStream`, `DeliberationEvent`, `KnowledgeEntry`, `ExperimentState`)
- Enum members: SCREAMING_SNAKE_CASE for Python, lowercase snake_case for string enums (`AgentRole.IMPLEMENTER`, `EventType.PLAN`)
- TypeScript types: PascalCase (`RunSummary`, `DeliberationEvent`)

## Code Style

**Formatting:**
- **Python:** Imports use `from __future__ import annotations` for forward references; type hints with full precision
- **TypeScript:** No semicolons are used (implied by Prettier defaults in Next.js)
- **Line length:** No strict enforcement detected; Python lines in `backend/main.py` range from 80-120 characters
- **Indentation:** 2 spaces for TypeScript/TSX, 4 spaces for Python

**Linting:**
- **TypeScript:** `next lint` command available (Next.js built-in linter) - file: `web/package.json`
- **Python:** No linter config detected (black, flake8, or pylint) - code follows basic Python conventions
- **No Prettier config detected** - likely using Next.js defaults (2-space indent, no semicolons)

## Import Organization

**Python order:**
1. `from __future__ import annotations` (future imports, required for type hint compatibility)
2. Standard library (e.g., `import json`, `import argparse`, `from pathlib import Path`)
3. Third-party packages (e.g., `from pydantic import BaseModel`, `import nbformat`)
4. Local imports (e.g., `from agent.events import EventStream`)

**Example from `agent/loop_v1.py`:**
```python
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path

import nbformat
import pandas as pd
from dotenv import load_dotenv
from nbclient import NotebookClient

from agent.events import EventStream, parse_alternatives, parse_tags
from agent.llm import call_role
from agent.parsing import parse_json_object
from shared.schema import AgentRole, EventType, KnowledgeEntry
```

**TypeScript order:**
1. External packages first
2. Relative imports using path aliases
3. Organize by concern (types, utilities, components)

**Example from `web/app/NewRunForm.tsx`:**
```typescript
"use client";

import { BROWSER_BACKEND } from "@/lib/backend";
import { useRouter } from "next/navigation";
import { useState } from "react";
```

**Path Aliases:**
- TypeScript: `@/*` maps to web root (e.g., `@/lib/backend`, `@/components/jury`)
- Defined in `web/tsconfig.json`: `"paths": { "@/*": ["./*"] }`

## Error Handling

**Patterns:**
- **Python - Try/except with specific exception types:** Catch specific exceptions (`ValueError`, `json.JSONDecodeError`) rather than bare `except` clauses
- **Stream errors to event log:** `ValueError` exceptions from LLM parsing are caught and emitted as `EventType.ERROR` events to the deliberation stream (see `loop_v1.py` lines 282-303)
- **Cell execution errors preserved:** Notebook execution errors caught separately; both exception type and message preserved in step_error (lines 362-370)
- **TypeScript - Try/catch with null coalescing:** Handle both network errors and parsing errors; fallback to null/empty values
- **Example from `backend/main.py` (lines 206-215):**
```python
try:
    meta = json.loads(meta_path.read_text())
except json.JSONDecodeError:
    meta = {}  # Safe fallback to empty dict
```

- **Example from `web/app/NewRunForm.tsx` (lines 37-49):**
```typescript
try {
  const res = await fetch(`${BROWSER_BACKEND}/experiments`, {...});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { experiment_id: string };
  router.push(`/experiment/${data.experiment_id}`);
} catch (err) {
  setError(String(err));
  setSubmitting(false);
}
```

## Logging

**Framework:** Console output (Python `print()`, TypeScript `console.log()`)

**Patterns:**
- **Section markers:** Comments with `# ---------- section name ----------` in Python (see `backend/main.py` lines 41, 63, 98, 106)
- **Event-driven logging:** All meaningful actions logged as `DeliberationEvent` objects in `deliberation.jsonl` via `EventStream.emit()` (see `agent/events.py`)
- **Metadata tracking:** LLM calls tracked via `_llm` dictionary appended to parsed agent outputs (see `loop_v1.py` line 127)
- **Cost tracking:** Token usage and USD cost calculated per LLM call using `PRICING` dict (see `loop_v1.py` lines 266-274)

## Comments

**When to Comment:**
- Function docstrings: Every function has a docstring explaining inputs and outputs (see `backend/main.py` lines 85-95)
- Section markers: Major logical sections demarcated with `# ---------- name ----------` comments
- Complex logic: Inline comments explain intent for non-obvious code (e.g., "one last sweep to catch late writes" at `backend/main.py` line 268)
- Agent roles: Comments indicate which agent is active (e.g., `# ===== IMPLEMENTER =====` at `loop_v1.py` line 281)

**JSDoc/TSDoc:**
- **Python:** Module-level docstrings explain file purpose and key workflows (see top of `backend/main.py`, `agent/events.py`, `agent/parsing.py`)
- **TypeScript:** Minimal docstrings; self-documenting through type annotations
- **Inline explanations:** Configuration and constants documented inline (see `web/app/NewRunForm.tsx` lines 7-23 for PRESETS constant)

## Function Design

**Size:**
- **Python:** Functions range from 5 lines (`client()` in `llm.py`) to 200+ lines (`run_jury()` in `loop_v1.py`)
- **Named helpers encouraged:** Extract complex logic into named functions like `describe_dataset()`, `cell_output_text()`, `summarize_events()` for readability

**Parameters:**
- **Keyword arguments:** Functions use keyword-only arguments extensively (see `EventStream.emit()` in `events.py` lines 43-58)
- **Type hints required:** All function parameters and returns have type hints in Python (e.g., `def run_jury(goal: str, dataset_path: Path, out_dir: Path, max_steps: int = 8, experiment_id: str | None = None) -> int:`)
- **Dataclass parameters:** Use Pydantic `BaseModel` for complex inputs (e.g., `ExperimentCreate` in `backend/main.py` lines 100-103)

**Return Values:**
- **Python:** Explicit return types using `|` union syntax (e.g., `str | None` for optional strings)
- **TypeScript:** Typed returns on async functions (e.g., `Promise<ExperimentFull>`, `Promise<{ ok: boolean; active: number }>`)
- **Dicts for structured data:** Use plain dicts/objects for lightweight structures; use dataclasses for persistence
- **Always return on error path:** Even error handlers emit events and return structured data (see `loop_v1.py` lines 294-303)

## Module Design

**Exports:**
- **Python:** Implicit exports; any top-level class or function is importable
- **TypeScript:** Explicit exports (e.g., `export const SERVER_BACKEND = ...` in `web/lib/backend.ts`, `export function TagPill({...})` in `web/components/jury.tsx`)
- **No default exports:** Prefer named exports for clarity

**Barrel Files:**
- **No barrel files detected** - imports reference specific files directly (e.g., `from agent.events import EventStream`)
- **Shared schema as single source of truth:** `shared/schema.py` defines all deliberation types; TypeScript mirrors them in `web/lib/backend.ts`

**Circular dependencies:**
- **Avoided by design:** Clear dependency direction: agent logic → events → schema (unidirectional)
- **Schema is contract:** All modules depend on shared schema, never the reverse

## Testing Utilities

**Docstring format for complex workflows:**
- Top-of-file docstrings include usage examples (see `agent/loop_v1.py` lines 1-12):
```
Run:
    python -m agent.loop_v1 --goal "..." --dataset examples/titanic/data/train.csv \
        --out runs/titanic_jury --max-steps 8
```

**Constants organization:**
- Global configuration constants at module top with comments (see `backend/main.py` lines 27-29, `loop_v1.py` lines 36-38)
- Role/type enumerations defined as Enum classes for type safety (see `shared/schema.py` lines 19-45)

---

*Convention analysis: 2026-04-24*
