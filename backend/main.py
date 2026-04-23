"""Panel backend — FastAPI app.

Day 1 of the backend: just /health + an echo /experiments stub so we can
verify the container is up and reachable. Real endpoints (SSE stream, run
kickoff) arrive in the next commit once the jury runtime is ready.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = Path(os.environ.get("PANEL_RUNS_DIR", REPO_ROOT / "runs"))

app = FastAPI(title="Panel backend", version="0.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "panel-backend",
        "version": "0.0.1",
        "runs_dir": str(RUNS_DIR),
        "runs_dir_exists": RUNS_DIR.exists(),
    }


class ExperimentCreate(BaseModel):
    goal: str
    dataset: str


@app.post("/experiments")
def create_experiment(body: ExperimentCreate) -> dict:
    """Stub — will kick off a jury subprocess once loop_v1 lands."""
    return {
        "experiment_id": "stub-not-yet-implemented",
        "goal": body.goal,
        "dataset": body.dataset,
        "status": "stub",
    }
