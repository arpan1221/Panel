"""Panel backend — FastAPI app.

Endpoints:
  GET  /health                    — liveness
  POST /experiments               — spawn a jury run (subprocess), return experiment_id
  GET  /experiments               — list runs from the filesystem
  GET  /experiments/{id}          — full replay (events + knowledge + status)
  GET  /events/{id}               — SSE stream tailing deliberation.jsonl live

The run tracker is in-memory (lost on restart); on startup we repopulate it
from the filesystem so replays still work after a reboot.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

REPO_ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = Path(os.environ.get("PANEL_RUNS_DIR", REPO_ROOT / "runs"))
RUNS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Panel backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- run tracker ----------

class RunHandle:
    def __init__(self, experiment_id: str, proc: Optional[asyncio.subprocess.Process]):
        self.experiment_id = experiment_id
        self.proc = proc
        # Task that awaits proc.wait() so returncode updates promptly.
        self.wait_task = asyncio.create_task(proc.wait()) if proc else None

    @property
    def status(self) -> str:
        if self.proc is None:
            return "unknown"
        rc = self.proc.returncode
        if rc is None:
            return "running"
        return "complete" if rc == 0 else "failed"


PROCESSES: dict[str, RunHandle] = {}


# ---------- helpers ----------

def run_dir_for(experiment_id: str) -> Path:
    return RUNS_DIR / experiment_id


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out: list[dict] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def run_status_from_disk(experiment_id: str) -> str:
    """Best-effort status when the subprocess isn't in memory."""
    rd = run_dir_for(experiment_id)
    if not rd.exists():
        return "unknown"
    handle = PROCESSES.get(experiment_id)
    if handle is not None:
        return handle.status
    # No live handle — treat as complete if the run dir exists and has events.
    if (rd / "deliberation.jsonl").exists():
        return "complete"
    return "unknown"


# ---------- schemas ----------

class ExperimentCreate(BaseModel):
    goal: str
    dataset: str = Field(..., description="Path to dataset (container-visible).")
    max_steps: int = Field(8, ge=1, le=20)


# ---------- routes ----------

@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "panel-backend",
        "version": "0.1.0",
        "runs_dir": str(RUNS_DIR),
        "active_runs": sum(1 for h in PROCESSES.values() if h.status == "running"),
    }


@app.get("/experiments")
def list_experiments() -> dict:
    runs = []
    for entry in sorted(RUNS_DIR.iterdir()) if RUNS_DIR.exists() else []:
        if not entry.is_dir():
            continue
        delib = entry / "deliberation.jsonl"
        event_count = 0
        if delib.exists():
            # count non-empty lines
            with delib.open() as f:
                event_count = sum(1 for l in f if l.strip())
        runs.append({
            "experiment_id": entry.name,
            "event_count": event_count,
            "status": run_status_from_disk(entry.name),
        })
    return {"runs": runs, "count": len(runs)}


@app.post("/experiments")
async def create_experiment(body: ExperimentCreate) -> dict:
    from datetime import datetime, timezone

    experiment_id = f"exp_{uuid.uuid4().hex[:10]}"
    rd = run_dir_for(experiment_id)
    rd.mkdir(parents=True, exist_ok=True)

    meta = {
        "experiment_id": experiment_id,
        "goal": body.goal,
        "dataset": body.dataset,
        "max_steps": body.max_steps,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    (rd / "meta.json").write_text(json.dumps(meta, indent=2))

    # Must be visible inside the container (volume-mounted).
    cmd = [
        "python",
        "-m",
        "agent.loop_v1",
        "--goal",
        body.goal,
        "--dataset",
        body.dataset,
        "--out",
        str(rd),
        "--experiment-id",
        experiment_id,
        "--max-steps",
        str(body.max_steps),
    ]

    log_path = rd / "run.log"
    log_f = log_path.open("wb")
    env = os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=log_f,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(REPO_ROOT),
            env=env,
        )
    except Exception as e:
        log_f.close()
        raise HTTPException(status_code=500, detail=f"spawn failed: {e}") from e

    PROCESSES[experiment_id] = RunHandle(experiment_id, proc)

    return {
        "experiment_id": experiment_id,
        "pid": proc.pid,
        "status": "running",
        "run_dir": str(rd),
        "goal": body.goal,
        "dataset": body.dataset,
    }


@app.get("/experiments/{experiment_id}")
def get_experiment(experiment_id: str) -> dict:
    rd = run_dir_for(experiment_id)
    if not rd.exists():
        raise HTTPException(status_code=404, detail="experiment not found")
    events = read_jsonl(rd / "deliberation.jsonl")
    knowledge = read_jsonl(rd / "knowledge.jsonl")
    meta_path = rd / "meta.json"
    meta: dict = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text())
        except json.JSONDecodeError:
            meta = {}
    return {
        "experiment_id": experiment_id,
        "status": run_status_from_disk(experiment_id),
        "event_count": len(events),
        "events": events,
        "knowledge": knowledge,
        "meta": meta,
    }


@app.get("/events/{experiment_id}")
async def stream_events(experiment_id: str):
    """SSE stream. Replays everything on disk, then tails until the subprocess exits."""
    rd = run_dir_for(experiment_id)
    if not rd.exists():
        raise HTTPException(status_code=404, detail="experiment not found")
    delib_path = rd / "deliberation.jsonl"

    async def gen():
        pos = 0
        # replay existing events first
        sent_any = False
        if delib_path.exists():
            with delib_path.open() as f:
                for line in f:
                    if line.strip():
                        yield {"event": "deliberation", "data": line.strip()}
                        sent_any = True
                pos = f.tell()
        if not sent_any:
            yield {"event": "status", "data": json.dumps({"status": "waiting-for-events"})}

        handle = PROCESSES.get(experiment_id)
        # Poll for new lines + subprocess status.
        idle_ticks = 0
        while True:
            new_lines = 0
            if delib_path.exists():
                with delib_path.open() as f:
                    f.seek(pos)
                    for line in f:
                        if line.strip():
                            yield {"event": "deliberation", "data": line.strip()}
                            new_lines += 1
                    pos = f.tell()
            if new_lines == 0:
                idle_ticks += 1
            else:
                idle_ticks = 0

            proc_done = handle is None or (handle.proc is not None and handle.proc.returncode is not None)
            if proc_done:
                # one last sweep to catch late writes
                if delib_path.exists():
                    with delib_path.open() as f:
                        f.seek(pos)
                        for line in f:
                            if line.strip():
                                yield {"event": "deliberation", "data": line.strip()}
                        pos = f.tell()
                status = run_status_from_disk(experiment_id)
                yield {"event": "done", "data": json.dumps({"status": status})}
                return

            # keep-alive every ~15s
            if idle_ticks % 50 == 0 and idle_ticks > 0:
                yield {"event": "ping", "data": json.dumps({"t": idle_ticks})}

            await asyncio.sleep(0.3)

    return EventSourceResponse(gen())
