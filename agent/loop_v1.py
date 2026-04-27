"""Four-agent jury runtime — Friday.

Per step:
    Implementer → execute cells → Interpreter → Tagger → Archivist (maybe)

Every action emits a DeliberationEvent (schema in /shared/schema.py) to
deliberation.jsonl. Knowledge commits (rare) land in knowledge.jsonl.

Run:
    python -m agent.loop_v1 --goal "..." --dataset examples/titanic/data/train.csv \
        --out runs/titanic_jury --max-steps 8
"""
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
from agent.retrieval import RetrievedEntry, format_for_prompt, retrieve
from shared.schema import AgentRole, EventType, KnowledgeEntry

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_DIR = REPO_ROOT / "agent" / "prompts"
CELL_TIMEOUT = 180


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text()


def describe_dataset(dataset_path: Path) -> str:
    if not dataset_path.exists():
        return f"(dataset not found: {dataset_path})"
    df = pd.read_csv(dataset_path, nrows=5000)
    return (
        f"path: {dataset_path}\n"
        f"rows_sampled: {len(df)}\n"
        f"columns ({len(df.columns)}): {list(df.columns)}\n"
        f"dtypes:\n{df.dtypes.to_string()}\n"
        f"head(5):\n{df.head(5).to_string()}\n"
        f"missing_counts:\n{df.isna().sum().to_string()}"
    )


def describe_datasets(paths: list[Path]) -> str:
    if len(paths) == 1:
        return describe_dataset(paths[0])
    blocks = [f"# {len(paths)} datasets provided — agent decides how to combine them.\n"]
    for i, p in enumerate(paths, 1):
        blocks.append(f"## dataset[{i}] — {p.name}\n{describe_dataset(p)}")
    return "\n\n".join(blocks)


_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def cell_output_text(cell) -> str:
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
                chunks.append("[image/png produced — plot omitted from text]")
        elif ot == "error":
            tb = _ANSI_RE.sub("", "\n".join(out.get("traceback", [])))
            chunks.append(f"[error] {out.get('ename')}: {out.get('evalue')}\n{tb}")
    text = "\n\n".join(chunks).strip()
    if len(text) > 4000:
        text = text[:2000] + "\n...[truncated]...\n" + text[-1500:]
    return text or "(no output)"


def summarize_events(events, limit: int = 12) -> str:
    lines = []
    for e in events[-limit:]:
        lines.append(
            f"[{e.event_id} step={e.step_number} {e.agent.value} {e.event_type.value}] "
            f"{e.content.summary}"
        )
    return "\n".join(lines) if lines else "(no prior events)"


# ---------- role callers ----------

def call_implementer(
    system_prompt: str,
    goal: str,
    dataset_desc: str,
    events,
    last_output: str,
    last_error: str | None,
    step: int,
    max_steps: int,
    knowledge_refs: list[KnowledgeEntry],
    retrieved_priors: list[RetrievedEntry] | None = None,
) -> dict:
    own_kb_lines = [
        f"- [{k.kind}] {k.claim} (confidence {k.confidence:.2f})"
        for k in knowledge_refs
    ] or ["(none yet — this experiment hasn't committed knowledge)"]
    priors_block = format_for_prompt(retrieved_priors or [])
    user_msg = "\n\n".join(
        [
            f"# Experiment goal\n{goal}",
            f"# Dataset description\n{dataset_desc}",
            f"# Step {step + 1} of {max_steps}",
            f"# Deliberation so far (recent)\n{summarize_events(events)}",
            f"# Last cell output\n{last_output or '(nothing yet — step 1)'}",
            f"# Last error\n{last_error or '(no error)'}",
            f"# Knowledge committed in THIS experiment\n" + "\n".join(own_kb_lines),
            f"# Knowledge retrieved from PRIOR experiments\n{priors_block}",
            "Return ONE JSON object matching the schema in your system prompt. "
            "No prose before or after. Do not wrap in markdown fences.",
        ]
    )
    call = call_role("implementer", system_prompt, user_msg, max_tokens=3000)
    data = parse_json_object(call.text)
    data["_llm"] = call.__dict__
    return data


def call_interpreter(
    system_prompt: str,
    cell_code: str,
    cell_output: str,
    expected: str | None,
    events,
) -> dict:
    user_msg = "\n\n".join(
        [
            f"# cell_code\n```python\n{cell_code}\n```",
            f"# cell_output\n{cell_output}",
            f"# implementer_expectation\n{expected or '(unspecified)'}",
            f"# deliberation_history (recent)\n{summarize_events(events)}",
            "Return ONE JSON object per your schema. No prose, no fences.",
        ]
    )
    call = call_role("interpreter", system_prompt, user_msg, max_tokens=1200)
    data = parse_json_object(call.text)
    data["_llm"] = call.__dict__
    return data


def call_tagger(
    system_prompt: str,
    impl_action: dict,
    interp: dict,
    cell_code: str,
) -> dict:
    user_msg = "\n\n".join(
        [
            f"# implementer plan\n{impl_action.get('plan')}",
            f"# alternatives_considered\n"
            + json.dumps(impl_action.get("alternatives_considered", []), indent=2),
            f"# chosen_because\n{impl_action.get('chosen_because')}",
            f"# cell_code (truncated)\n{cell_code[:800]}",
            f"# interpreter.what_it_means\n{interp.get('what_it_means')}",
            f"# interpreter.risks_or_concerns\n"
            + json.dumps(interp.get("risks_or_concerns", []), indent=2),
            "Return ONE JSON object per your schema. No prose, no fences.",
        ]
    )
    call = call_role("tagger", system_prompt, user_msg, max_tokens=400)
    data = parse_json_object(call.text)
    data["_llm"] = call.__dict__
    return data


def call_archivist(
    system_prompt: str,
    goal: str,
    impl_action: dict,
    interp: dict,
    tags: list[str],
    recent_event_ids: list[str],
    existing_knowledge: list[KnowledgeEntry],
) -> dict:
    existing = "\n".join(
        f"- {k.knowledge_id} [{k.kind}] {k.claim}" for k in existing_knowledge
    ) or "(knowledge base is empty)"
    user_msg = "\n\n".join(
        [
            f"# experiment_goal\n{goal}",
            f"# implementer (plan+hypothesis)\n"
            + json.dumps(
                {k: impl_action.get(k) for k in ("plan", "hypothesis", "chosen_because")},
                indent=2,
            ),
            f"# interpreter\n"
            + json.dumps(
                {
                    k: interp.get(k)
                    for k in (
                        "what_it_means",
                        "surprise",
                        "risks_or_concerns",
                        "matched_expectation",
                    )
                },
                indent=2,
            ),
            f"# tagger_tags\n{tags}",
            f"# recent_event_ids (for evidence)\n{recent_event_ids}",
            f"# existing_knowledge\n{existing}",
            "Return ONE JSON object per your schema. Default to commit=false. "
            "No prose, no fences.",
        ]
    )
    call = call_role("archivist", system_prompt, user_msg, max_tokens=600)
    data = parse_json_object(call.text)
    data["_llm"] = call.__dict__
    return data


# ---------- main loop ----------


def run_jury(
    goal: str,
    dataset_path: Path | list[Path],
    out_dir: Path,
    max_steps: int = 8,
    experiment_id: str | None = None,
) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    exp_id = experiment_id or f"exp_{uuid.uuid4().hex[:10]}"

    # Prompts + system context
    impl_prompt = load_prompt("implementer")
    interp_prompt = load_prompt("interpreter")
    tagger_prompt = load_prompt("tagger")
    archivist_prompt = load_prompt("archivist")

    paths_list = dataset_path if isinstance(dataset_path, list) else [dataset_path]
    paths_abs = [p.resolve() for p in paths_list]
    dataset_abs = paths_abs[0]
    dataset_desc = describe_datasets(paths_abs)
    out_abs = out_dir.resolve()

    # Run the kernel from inside the run dir so plots land here, not in repo root.
    original_cwd = Path.cwd()
    os.chdir(out_abs)
    try:
        notebook = nbformat.v4.new_notebook()
        notebook.metadata["kernelspec"] = {
            "name": "python3",
            "display_name": "Python 3",
            "language": "python",
        }

        stream = EventStream(experiment_id=exp_id, out_dir=out_abs)
        knowledge: list[KnowledgeEntry] = []
        last_output = ""
        last_error: str | None = None
        nb_path = out_abs / "notebook.ipynb"

        # ===== KNOWLEDGE RETRIEVAL (cross-experiment, one-shot at run start) =====
        runs_root = out_abs.parent
        try:
            retrieved_priors = retrieve(
                query=f"{goal}\n\n{dataset_desc[:2000]}",
                runs_root=runs_root,
                exclude_run_id=exp_id,
                top_k=3,
            )
        except Exception as exc:
            print(f"[retrieval] failed: {exc}", file=sys.stderr)
            retrieved_priors = []
        if retrieved_priors:
            stream.emit(
                agent=AgentRole.ARCHIVIST,
                event_type=EventType.KNOWLEDGE_RETRIEVAL,
                step_number=0,
                summary=(
                    f"Surfaced {len(retrieved_priors)} prior knowledge "
                    f"entr{'y' if len(retrieved_priors) == 1 else 'ies'} from past experiments"
                ),
                body=format_for_prompt(retrieved_priors),
                evidence=[r.entry.knowledge_id for r in retrieved_priors],
                confidence=max(r.score for r in retrieved_priors),
            )
            print(
                f"[retrieval] surfaced {len(retrieved_priors)} entr"
                f"{'y' if len(retrieved_priors) == 1 else 'ies'} "
                f"(top score {retrieved_priors[0].score:.2f})"
            )
        else:
            print("[retrieval] knowledge base empty or no matches above floor")

        totals = {"in": 0, "out": 0, "cost_usd": 0.0, "calls": 0}

        def charge(call_dict):
            price = PRICING.get(call_dict["model"], (3.0, 15.0))
            totals["in"] += call_dict["input_tokens"]
            totals["out"] += call_dict["output_tokens"]
            totals["cost_usd"] += (
                call_dict["input_tokens"] * price[0]
                + call_dict["output_tokens"] * price[1]
            ) / 1_000_000
            totals["calls"] += 1

        nbc = NotebookClient(
            notebook, timeout=CELL_TIMEOUT, kernel_name="python3", allow_errors=True
        )
        with nbc.setup_kernel():
            for step in range(max_steps):
                # ===== IMPLEMENTER =====
                try:
                    impl = call_implementer(
                        impl_prompt,
                        goal,
                        dataset_desc,
                        stream.events,
                        last_output,
                        last_error,
                        step,
                        max_steps,
                        knowledge,
                        retrieved_priors=retrieved_priors,
                    )
                except ValueError as e:
                    stream.emit(
                        agent=AgentRole.IMPLEMENTER,
                        event_type=EventType.ERROR,
                        step_number=step,
                        summary=f"implementer parse failed",
                        body=str(e),
                        confidence=0.0,
                    )
                    break
                charge(impl["_llm"])

                plan_evt = stream.emit(
                    agent=AgentRole.IMPLEMENTER,
                    event_type=EventType.PLAN,
                    step_number=step,
                    summary=(impl.get("plan") or "(no plan)")[:200],
                    body=json.dumps(
                        {
                            "plan": impl.get("plan"),
                            "hypothesis": impl.get("hypothesis"),
                            "expected_result": impl.get("expected_result"),
                        },
                        indent=2,
                    ),
                    alternatives_considered=parse_alternatives(
                        impl.get("alternatives_considered", [])
                    ),
                    chosen_because=impl.get("chosen_because"),
                    confidence=float(impl.get("confidence") or 0.5),
                )

                cells = impl.get("cells") or []
                new_cells = []
                for c in cells:
                    src = c.get("source", "")
                    if c.get("cell_type") == "markdown":
                        nc = nbformat.v4.new_markdown_cell(src)
                    else:
                        nc = nbformat.v4.new_code_cell(src)
                    notebook.cells.append(nc)
                    new_cells.append(nc)

                # CODE event — one per step summarizing the batch.
                code_sources = [
                    c.get("source", "")
                    for c in cells
                    if c.get("cell_type") == "code"
                ]
                code_body = "\n\n# --- next cell ---\n\n".join(code_sources)
                code_evt = stream.emit(
                    agent=AgentRole.IMPLEMENTER,
                    event_type=EventType.CODE,
                    step_number=step,
                    summary=f"wrote {len(cells)} cells ({len(code_sources)} code)",
                    body=code_body,
                    cell_ref=f"cells[{len(notebook.cells) - len(cells)}:{len(notebook.cells)}]",
                    confidence=float(impl.get("confidence") or 0.5),
                )

                # ===== EXECUTE =====
                step_error: str | None = None
                exec_parts: list[str] = []
                for nc in new_cells:
                    if nc.cell_type != "code":
                        continue
                    try:
                        nbc.execute_cell(nc, len(notebook.cells) - 1)
                    except Exception as exc:
                        step_error = f"{type(exc).__name__}: {exc}"
                    txt = cell_output_text(nc)
                    exec_parts.append(txt)
                    if any(o.get("output_type") == "error" for o in nc.get("outputs", [])):
                        err = next(
                            o for o in nc["outputs"] if o.get("output_type") == "error"
                        )
                        step_error = f"{err.get('ename')}: {err.get('evalue')}"

                last_output = "\n\n".join(exec_parts).strip() or "(no code cells)"
                last_error = step_error

                # ===== IN-STEP RETRY =====
                # If the cell errored, give the Implementer up to MAX_RETRIES
                # chances to rewrite it before the rest of the jury reads the
                # output. Keeps the demo narrative clean; the failed cell stays
                # in the notebook for honesty.
                MAX_RETRIES = 2
                retry_attempt = 0
                while step_error and retry_attempt < MAX_RETRIES:
                    retry_attempt += 1
                    try:
                        impl_retry = call_implementer(
                            impl_prompt,
                            goal,
                            dataset_desc,
                            stream.events,
                            last_output,
                            last_error,
                            step,
                            max_steps,
                            knowledge,
                            retrieved_priors=retrieved_priors,
                        )
                    except ValueError:
                        break
                    charge(impl_retry["_llm"])

                    retry_cells = impl_retry.get("cells") or []
                    retry_new = []
                    for c in retry_cells:
                        src = c.get("source", "")
                        if c.get("cell_type") == "markdown":
                            nc = nbformat.v4.new_markdown_cell(src)
                        else:
                            nc = nbformat.v4.new_code_cell(src)
                        notebook.cells.append(nc)
                        retry_new.append(nc)

                    retry_code_sources = [
                        c.get("source", "")
                        for c in retry_cells
                        if c.get("cell_type") == "code"
                    ]
                    retry_code_body = "\n\n# --- next cell ---\n\n".join(retry_code_sources)
                    retry_code_evt = stream.emit(
                        agent=AgentRole.IMPLEMENTER,
                        event_type=EventType.CODE,
                        step_number=step,
                        summary=f"retry {retry_attempt}: rewrote {len(retry_cells)} cell(s) after {last_error.split(':')[0] if last_error else 'error'}"[:200],
                        body=retry_code_body,
                        cell_ref=f"cells[{len(notebook.cells) - len(retry_cells)}:{len(notebook.cells)}]",
                        confidence=float(impl_retry.get("confidence") or 0.5),
                    )

                    step_error = None
                    retry_parts: list[str] = []
                    for nc in retry_new:
                        if nc.cell_type != "code":
                            continue
                        try:
                            nbc.execute_cell(nc, len(notebook.cells) - 1)
                        except Exception as exc:
                            step_error = f"{type(exc).__name__}: {exc}"
                        retry_parts.append(cell_output_text(nc))
                        if any(o.get("output_type") == "error" for o in nc.get("outputs", [])):
                            err = next(
                                o for o in nc["outputs"] if o.get("output_type") == "error"
                            )
                            step_error = f"{err.get('ename')}: {err.get('evalue')}"

                    last_output = "\n\n".join(retry_parts).strip() or "(no code cells)"
                    last_error = step_error
                    # Promote the retry as the canonical code event for downstream jury.
                    code_evt = retry_code_evt
                    code_sources = retry_code_sources
                    impl = impl_retry

                output_evt = stream.emit(
                    agent=AgentRole.IMPLEMENTER,
                    event_type=EventType.OUTPUT,
                    step_number=step,
                    summary=(
                        f"error after {retry_attempt} retries: {step_error}"
                        if step_error
                        else (
                            f"recovered after {retry_attempt} retr{'y' if retry_attempt == 1 else 'ies'}"
                            if retry_attempt > 0
                            else "cell(s) executed"
                        )
                    )[:200],
                    body=last_output,
                    evidence=[code_evt.event_id],
                    confidence=0.0 if step_error else 1.0,
                )

                # persist notebook after every step
                with nb_path.open("w") as f:
                    nbformat.write(notebook, f)

                # ===== INTERPRETER =====
                try:
                    interp = call_interpreter(
                        interp_prompt,
                        "\n\n# --- next cell ---\n\n".join(code_sources),
                        last_output,
                        impl.get("expected_result"),
                        stream.events,
                    )
                except ValueError as e:
                    interp = {
                        "what_happened": "(parse failed)",
                        "what_it_means": str(e),
                        "matched_expectation": False,
                        "surprise": None,
                        "risks_or_concerns": [],
                        "verify_next": [],
                        "confidence": 0.0,
                        "_llm": {
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "model": "claude-sonnet-4-6",
                        },
                    }
                charge(interp["_llm"])

                interp_evt = stream.emit(
                    agent=AgentRole.INTERPRETER,
                    event_type=EventType.INTERPRETATION,
                    step_number=step,
                    summary=(interp.get("what_it_means") or "(no reading)")[:200],
                    body=json.dumps(
                        {k: v for k, v in interp.items() if not k.startswith("_")},
                        indent=2,
                    ),
                    evidence=[code_evt.event_id, output_evt.event_id],
                    confidence=float(interp.get("confidence") or 0.5),
                )

                # ===== TAGGER =====
                try:
                    tagger_out = call_tagger(
                        tagger_prompt,
                        impl,
                        interp,
                        code_body,
                    )
                except ValueError as e:
                    tagger_out = {
                        "tags": [],
                        "rationale": f"parse_failed: {e}",
                        "_llm": {
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "model": "claude-haiku-4-5-20251001",
                        },
                    }
                charge(tagger_out["_llm"])
                tags = parse_tags(tagger_out.get("tags", []))

                stream.emit(
                    agent=AgentRole.TAGGER,
                    event_type=EventType.TAG,
                    step_number=step,
                    summary=", ".join(t.value for t in tags) or "(no tags)",
                    body=tagger_out.get("rationale", ""),
                    semantic_tags=tags,
                    evidence=[plan_evt.event_id, code_evt.event_id, interp_evt.event_id],
                    confidence=0.9 if tags else 0.3,
                )

                # ===== ARCHIVIST =====
                try:
                    arch = call_archivist(
                        archivist_prompt,
                        goal,
                        impl,
                        interp,
                        [t.value for t in tags],
                        [plan_evt.event_id, code_evt.event_id, interp_evt.event_id],
                        knowledge,
                    )
                except ValueError as e:
                    arch = {
                        "commit": False,
                        "entry": None,
                        "reasoning": f"parse_failed: {e}",
                        "_llm": {
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "model": "claude-sonnet-4-6",
                        },
                    }
                charge(arch["_llm"])

                if arch.get("commit") and isinstance(arch.get("entry"), dict):
                    entry_raw = arch["entry"]
                    try:
                        ke = KnowledgeEntry(
                            knowledge_id=f"kb_{uuid.uuid4().hex[:8]}",
                            experiment_id=exp_id,
                            created_at=datetime.utcnow(),
                            claim=str(entry_raw.get("claim", ""))[:500],
                            kind=entry_raw.get("kind", "heuristic"),
                            evidence_event_ids=list(
                                entry_raw.get("evidence_event_ids") or []
                            ),
                            confidence=float(entry_raw.get("confidence", 0.7)),
                        )
                        stream.commit_knowledge(ke)
                        knowledge.append(ke)
                        stream.emit(
                            agent=AgentRole.ARCHIVIST,
                            event_type=EventType.KNOWLEDGE,
                            step_number=step,
                            summary=f"[{ke.kind}] {ke.claim}"[:200],
                            body=arch.get("reasoning", ""),
                            evidence=ke.evidence_event_ids,
                            confidence=ke.confidence,
                        )
                    except Exception as e:
                        stream.emit(
                            agent=AgentRole.ARCHIVIST,
                            event_type=EventType.ERROR,
                            step_number=step,
                            summary="knowledge entry rejected",
                            body=f"{e}\nraw: {entry_raw}",
                            confidence=0.0,
                        )

                done = bool(impl.get("done"))
                print(
                    f"[step {step+1}/{max_steps}] done={done} err={bool(step_error)} "
                    f"tags={[t.value for t in tags]} kb={len(knowledge)} "
                    f"cost=${totals['cost_usd']:.3f}"
                )
                if done:
                    break

    finally:
        os.chdir(original_cwd)

    print(
        f"\nrun {exp_id} complete. "
        f"events={len(stream.events)} kb_entries={len(knowledge)} "
        f"llm_calls={totals['calls']} "
        f"tokens_in={totals['in']} tokens_out={totals['out']} "
        f"cost=${totals['cost_usd']:.3f}\n"
        f"  notebook: {nb_path}\n"
        f"  deliberation: {stream.delib_path}\n"
        f"  knowledge: {stream.knowledge_path}"
    )
    return 0


PRICING: dict[str, tuple[float, float]] = {
    # (input $/M, output $/M)
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "claude-opus-4-7": (15.0, 75.0),
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--goal", required=True)
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--out", default="runs/jury_run")
    ap.add_argument("--max-steps", type=int, default=8)
    ap.add_argument("--experiment-id", default=None)
    args = ap.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("error: ANTHROPIC_API_KEY not set", file=sys.stderr)
        return 2

    # Resolve paths relative to CWD at invocation (before we chdir into out_dir).
    # `--dataset` may be a single path or a comma-separated list.
    dataset_items = [s.strip() for s in args.dataset.split(",") if s.strip()]
    datasets = [Path(s).resolve() for s in dataset_items]
    out_dir = Path(args.out).resolve()
    return run_jury(
        goal=args.goal,
        dataset_path=datasets if len(datasets) > 1 else datasets[0],
        out_dir=out_dir,
        max_steps=args.max_steps,
        experiment_id=args.experiment_id,
    )


if __name__ == "__main__":
    raise SystemExit(main())
