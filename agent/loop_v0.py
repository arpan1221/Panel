"""Single-agent Implementer loop — Thursday-night spike.

Proves the core idea: one Claude agent writes notebook cells, we execute them,
feed the output back, and loop until done. No jury, no UI, no auth.

Run:
    python -m agent.loop_v0 --goal "predict titanic survival" \
        --dataset examples/titanic/data/train.csv --out runs/titanic_thu

Produces:
    <out>/notebook.ipynb
    <out>/deliberation.jsonl
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import nbformat
import pandas as pd
from anthropic import Anthropic
from dotenv import load_dotenv
from nbclient import NotebookClient

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent
PROMPT_PATH = REPO_ROOT / "agent" / "prompts" / "implementer.md"
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096
CELL_TIMEOUT = 120


def load_system_prompt() -> str:
    return PROMPT_PATH.read_text()


def describe_dataset(dataset_path: str) -> str:
    p = Path(dataset_path)
    if not p.exists():
        return f"(dataset not found at {dataset_path})"
    df = pd.read_csv(p, nrows=5000)
    lines = [
        f"path: {dataset_path}",
        f"rows_sampled: {len(df)} (preview of file)",
        f"columns ({len(df.columns)}): {list(df.columns)}",
        "dtypes:",
        df.dtypes.to_string(),
        "head(5):",
        df.head(5).to_string(),
        "missing_counts:",
        df.isna().sum().to_string(),
    ]
    return "\n".join(str(x) for x in lines)


def cell_output_text(cell) -> str:
    """Serialize a cell's outputs into text a model can read."""
    if cell.get("cell_type") != "code":
        return ""
    chunks: list[str] = []
    for out in cell.get("outputs", []):
        ot = out.get("output_type")
        if ot == "stream":
            chunks.append(f"[{out.get('name', 'stdout')}]\n{out.get('text', '')}")
        elif ot in ("execute_result", "display_data"):
            data = out.get("data", {})
            if "text/plain" in data:
                chunks.append(f"[result]\n{data['text/plain']}")
            if "image/png" in data:
                chunks.append("[image/png omitted — plot produced]")
        elif ot == "error":
            tb = "\n".join(out.get("traceback", []))
            tb = re.sub(r"\x1b\[[0-9;]*m", "", tb)
            chunks.append(
                f"[error] {out.get('ename')}: {out.get('evalue')}\n{tb}"
            )
    text = "\n\n".join(chunks).strip()
    if len(text) > 4000:
        text = text[:2000] + "\n...[truncated]...\n" + text[-1500:]
    return text or "(no output)"


def summarize_prior_cells(notebook) -> str:
    lines = []
    for i, cell in enumerate(notebook.cells):
        kind = cell.cell_type
        src = cell.source.strip()
        if len(src) > 400:
            src = src[:400] + "..."
        lines.append(f"[cell {i} {kind}]\n{src}")
    return "\n\n".join(lines) if lines else "(no cells yet)"


def build_context(
    goal: str,
    dataset_desc: str,
    notebook,
    last_output: str,
    last_error: str | None,
    step: int,
    max_steps: int,
) -> str:
    parts = [
        f"# Experiment goal\n{goal}",
        f"# Dataset description\n{dataset_desc}",
        f"# Step {step + 1} of {max_steps}",
        f"# Notebook so far\n{summarize_prior_cells(notebook)}",
        f"# Last cell output\n{last_output or '(nothing yet — this is step 1)'}",
    ]
    if last_error:
        parts.append(f"# Last error\n{last_error}")
    parts.append(
        "Return ONE JSON object matching the schema in your system prompt. "
        "No prose before or after. Wrap nothing in markdown fences."
    )
    return "\n\n".join(parts)


_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def parse_implementer_response(text: str) -> dict:
    """Be forgiving. Claude sometimes wraps JSON in fences or trailing prose."""
    text = text.strip()
    m = _FENCE_RE.search(text)
    if m:
        text = m.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in response:\n{text[:500]}")
    blob = text[start : end + 1]
    try:
        return json.loads(blob)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON parse failed: {e}\n---\n{blob[:500]}") from e


def write_deliberation(path: Path, entries: list[dict]) -> None:
    with path.open("w") as f:
        for e in entries:
            f.write(json.dumps(e, default=str) + "\n")


def run(goal: str, dataset_path: str, out_dir: Path, max_steps: int = 12) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    nb_path = out_dir / "notebook.ipynb"
    delib_path = out_dir / "deliberation.jsonl"

    system_prompt = load_system_prompt()
    dataset_desc = describe_dataset(dataset_path)

    client = Anthropic()
    notebook = nbformat.v4.new_notebook()
    notebook.metadata["kernelspec"] = {
        "name": "python3",
        "display_name": "Python 3",
        "language": "python",
    }

    deliberation: list[dict] = []
    last_output = ""
    last_error: str | None = None
    total_in = 0
    total_out = 0

    nbc = NotebookClient(
        notebook, timeout=CELL_TIMEOUT, kernel_name="python3", allow_errors=True
    )
    with nbc.setup_kernel():
        for step in range(max_steps):
            user_msg = build_context(
                goal, dataset_desc, notebook, last_output, last_error, step, max_steps
            )

            t0 = time.time()
            resp = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            )
            latency = time.time() - t0

            total_in += resp.usage.input_tokens
            total_out += resp.usage.output_tokens
            raw = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")

            try:
                action = parse_implementer_response(raw)
            except ValueError as e:
                print(f"[step {step}] parse failed: {e}", file=sys.stderr)
                deliberation.append(
                    {
                        "step": step,
                        "error": f"parse_failed: {e}",
                        "raw_response": raw[:2000],
                        "plan": None,
                        "cells": [],
                    }
                )
                write_deliberation(delib_path, deliberation)
                break

            cells = action.get("cells", []) or []
            new_cell_objs = []
            for c in cells:
                src = c.get("source", "")
                if c.get("cell_type") == "markdown":
                    nc = nbformat.v4.new_markdown_cell(src)
                else:
                    nc = nbformat.v4.new_code_cell(src)
                notebook.cells.append(nc)
                new_cell_objs.append(nc)

            step_error: str | None = None
            step_output_parts: list[str] = []
            for nc in new_cell_objs:
                if nc.cell_type != "code":
                    continue
                try:
                    nbc.execute_cell(nc, len(notebook.cells) - 1)
                except Exception as exc:  # cell exec or kernel issue
                    step_error = f"{type(exc).__name__}: {exc}"
                txt = cell_output_text(nc)
                step_output_parts.append(txt)
                if any(o.get("output_type") == "error" for o in nc.get("outputs", [])):
                    err = next(o for o in nc["outputs"] if o.get("output_type") == "error")
                    step_error = f"{err.get('ename')}: {err.get('evalue')}"

            last_output = "\n\n".join(step_output_parts).strip() or "(no code cells this step)"
            last_error = step_error

            entry = {
                "step": step,
                "plan": action.get("plan"),
                "hypothesis": action.get("hypothesis"),
                "alternatives_considered": action.get("alternatives_considered", []),
                "chosen_because": action.get("chosen_because"),
                "cells": cells,
                "expected_result": action.get("expected_result"),
                "confidence": action.get("confidence"),
                "done": bool(action.get("done")),
                "error": step_error,
                "observed_output": last_output[:2000],
                "usage": {
                    "input_tokens": resp.usage.input_tokens,
                    "output_tokens": resp.usage.output_tokens,
                    "latency_s": round(latency, 2),
                },
            }
            deliberation.append(entry)

            # Save after every step (crash safety).
            with nb_path.open("w") as f:
                nbformat.write(notebook, f)
            write_deliberation(delib_path, deliberation)

            done_flag = bool(action.get("done"))
            plan_preview = (action.get("plan") or "")[:100]
            print(
                f"[step {step + 1}/{max_steps}] done={done_flag} "
                f"err={bool(step_error)} in={resp.usage.input_tokens} "
                f"out={resp.usage.output_tokens} — {plan_preview}"
            )

            if done_flag:
                break

    print(
        f"\nrun complete. tokens: in={total_in} out={total_out}. "
        f"notebook: {nb_path}. deliberation: {delib_path}."
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--goal", required=True)
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--out", default="runs/titanic_thu")
    ap.add_argument("--max-steps", type=int, default=12)
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("error: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 2

    return run(
        goal=args.goal,
        dataset_path=args.dataset,
        out_dir=Path(args.out),
        max_steps=args.max_steps,
    )


if __name__ == "__main__":
    raise SystemExit(main())
