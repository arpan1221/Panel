# Tonight's Checklist — Thursday, April 23, ~9 PM onward

You have roughly 4 hours. The single goal tonight is: **prove the core agent loop works on the Titanic dataset before you sleep.**

Everything else on the Sunday checklist depends on this being true. Web UI, VS Code extension, sharing — none of it matters if the four agents cannot produce a coherent notebook together. De-risk the loop tonight.

## The four-hour plan

### Hour 1 (9:00 PM – 10:00 PM): scaffold the repo

- [ ] `git init` in `~/code/panel` or wherever.
- [ ] Copy the provided `README.md`, `CLAUDE.md`, `REPO_LAYOUT.md` into place.
- [ ] Create the directory structure per `REPO_LAYOUT.md` with `.keep` files.
- [ ] Copy `shared/schema.py` into place.
- [ ] Copy the four prompts into `agent/prompts/`.
- [ ] Create `.env` with `ANTHROPIC_API_KEY=sk-ant-...`. Create `.env.example` as a template.
- [ ] Create `.gitignore` with `node_modules/`, `.env`, `__pycache__/`, `.next/`, `.ipynb_checkpoints/`, `*.log`.
- [ ] `python -m venv .venv && source .venv/bin/activate`
- [ ] `pip install anthropic pydantic nbclient jupyter jupyter_client`
- [ ] Download Kaggle Titanic: `train.csv` into `examples/titanic/data/`. If you have the Kaggle CLI, `kaggle competitions download -c titanic`. Otherwise just grab it off the web.
- [ ] First commit: `git add . && git commit -m "[scaffold] initial repo structure"`

### Hour 2 (10:00 PM – 11:00 PM): single-agent loop first

Build the single-agent version before the jury. One agent, one prompt, produces cells and runs them. This is the load-bearing spike.

Create `agent/loop_v0.py` — a single file that:

```python
# Minimal spike — one agent writing a Titanic notebook end-to-end
import json
from anthropic import Anthropic
from nbclient import NotebookClient
import nbformat

client = Anthropic()

SYSTEM_PROMPT = open("agent/prompts/implementer.md").read()

def run(goal: str, dataset_path: str, max_steps: int = 12):
    deliberation = []
    notebook = nbformat.v4.new_notebook()

    for step in range(max_steps):
        # Build the context for the implementer
        user_msg = build_context(goal, dataset_path, notebook, deliberation)

        # Call Claude (Sonnet for speed tonight; switch to Opus for hard planning on Friday)
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        # Parse the JSON response
        action = parse_implementer_response(resp.content[0].text)

        # Append cells to notebook
        for c in action["cells"]:
            notebook.cells.append(
                nbformat.v4.new_code_cell(c["source"]) if c["cell_type"] == "code"
                else nbformat.v4.new_markdown_cell(c["source"])
            )

        # Execute the notebook (only the new cells, or re-execute all for simplicity tonight)
        nb_client = NotebookClient(notebook, timeout=120)
        try:
            nb_client.execute()
        except Exception as e:
            # Error becomes the next turn's "last_output" — this is how debug loops work
            deliberation.append({"step": step, "error": str(e)})

        deliberation.append({"step": step, "plan": action["plan"], "cells": action["cells"]})

        # Save after every step for crash safety
        with open("notebook.ipynb", "w") as f:
            nbformat.write(notebook, f)
        with open("deliberation.jsonl", "w") as f:
            for d in deliberation:
                f.write(json.dumps(d) + "\n")

        if action.get("done"):
            break

if __name__ == "__main__":
    run(
        goal="Predict survival on Titanic and tell me what features actually matter",
        dataset_path="examples/titanic/data/train.csv",
    )
```

That's the target. Fill in `build_context`, `parse_implementer_response`. 60 minutes of focused work.

- [ ] Write `build_context(goal, dataset_path, notebook, deliberation)` — returns a string the Implementer can reason from. Include: goal, dataset path + head(), list of cells written so far (just source), last cell's output, last error if any.
- [ ] Write `parse_implementer_response(text)` — strip markdown fences, parse JSON, handle the common failure mode of Claude wrapping JSON in prose.
- [ ] Run it. Debug. Commit when Titanic produces at least a data-load + head cell that executes without error.

### Hour 3 (11:00 PM – 12:00 AM): iterate until Titanic is coherent

The agent will behave imperfectly on the first runs. Budget ~$5-10 in API calls for this iteration hour.

What "coherent" means tonight:
- Notebook has 5-12 cells.
- Cells interleave markdown explanations with code.
- A model gets trained and a score gets printed.
- No unhandled errors in the final notebook.

If after an hour of iteration the notebook still flames out, **that is the tripwire.** Simplify the prompt. Add more specific scaffolding. Drop the "you decide everything" framing and add a rough skeleton like "first profile the data, then baseline a model, then improve."

- [ ] First successful end-to-end Titanic run. Commit: `[thu-night][agent] single-agent loop producing Titanic notebook`

### Hour 4 (12:00 AM – 1:00 AM): write the jury-split plan for tomorrow

Don't build the four-agent jury tonight. You're tired and the single-agent loop is still fresh. Write tomorrow-morning-you a note instead.

Create `NOTES_FRIDAY_AM.md`:

- [ ] Document what the single-agent spike did well and badly.
- [ ] Note the token cost of a full Titanic run (from the API response `usage` field).
- [ ] Sketch how to split the single loop into Implementer → Interpreter → Tagger → Archivist.
- [ ] List three things you learned about Claude's JSON formatting habits that the jury prompts should anticipate.
- [ ] Go to sleep.

## Stop-at-midnight rules

- If at midnight the single-agent loop is not producing executable Titanic notebooks: stop, sleep, start Friday with a simpler approach (more scripted, fewer agent decisions).
- If at midnight it IS working: stop anyway, sleep, start Friday fresh. Pushing past midnight tonight costs you Friday, and Friday is the biggest build day.

## What NOT to do tonight

- Don't start on the web UI.
- Don't start on the VS Code extension.
- Don't split into the four agents.
- Don't set up Supabase.
- Don't write tests (seriously, tomorrow).
- Don't name things perfectly.
- Don't commit `.env`.

## Cost check at end of night

Expected total tonight: $5-15 in API calls. If you're over $30, you're iterating too loosely — slow down the edit-run cycle.
