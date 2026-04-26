"""Panel backend — FastAPI app.

Endpoints:
  GET  /health                              — liveness
  POST /experiments                         — spawn a jury run (subprocess), return experiment_id
  GET  /experiments                         — list runs from the filesystem
  GET  /experiments/{id}                    — full replay (events + knowledge + status)
  GET  /experiments/{id}/notebook.ipynb     — raw notebook; ?colab=1 for portable variant
  GET  /events/{id}                         — SSE stream tailing deliberation.jsonl live
  GET  /datasets/{name}                     — canonical example datasets (titanic, house_prices)

The run tracker is in-memory (lost on restart); on startup we repopulate it
from the filesystem so replays still work after a reboot.
"""
from __future__ import annotations

import asyncio
import copy
import json
import os
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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


UPLOADS_DIR = RUNS_DIR / "_uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


ALLOWED_DATASET_SUFFIXES = {".csv", ".tsv", ".parquet", ".xlsx", ".xls", ".json"}


async def _save_one_upload(file: UploadFile) -> dict:
    raw = file.filename or "dataset.csv"
    suffix = Path(raw).suffix.lower() or ".csv"
    if suffix not in ALLOWED_DATASET_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"unsupported file type: {suffix}")
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:10]}{suffix}"
    out_path = UPLOADS_DIR / safe_name
    size = 0
    with out_path.open("wb") as fh:
        while True:
            chunk = await file.read(1 << 20)
            if not chunk:
                break
            size += len(chunk)
            if size > 200 * 1024 * 1024:
                fh.close()
                out_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="file too large (>200 MiB)")
            fh.write(chunk)
    return {"path": str(out_path), "filename": raw, "size_bytes": size}


@app.post("/uploads")
async def upload_dataset(files: list[UploadFile] = File(...)) -> dict:
    """Save one or more uploaded datasets under runs/_uploads/.

    Returns `dataset` as a comma-separated list of container paths — the New Run
    form posts that string straight to POST /experiments. Multi-dataset runs let
    the agent decide how to combine them.
    """
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")
    saved = [await _save_one_upload(f) for f in files]
    return {
        "dataset": ",".join(s["path"] for s in saved),
        "filenames": [s["filename"] for s in saved],
        "files": saved,
    }


@app.post("/experiments")
async def create_experiment(body: ExperimentCreate) -> dict:
    from datetime import datetime, timezone

    experiment_id = f"exp_{uuid.uuid4().hex[:10]}"
    rd = run_dir_for(experiment_id)
    rd.mkdir(parents=True, exist_ok=True)

    dataset_arg = body.dataset.strip()
    original_dataset = dataset_arg
    if dataset_arg.lower().startswith(("http://", "https://")):
        parsed = urllib.parse.urlparse(dataset_arg)
        if "kaggle.com" in (parsed.netloc or "").lower():
            raise HTTPException(
                status_code=400,
                detail=(
                    "Kaggle dataset pages require auth. Download the CSV manually "
                    "and either drop it under ./examples/<name>/data/ or paste a "
                    "direct CSV URL here."
                ),
            )
        suffix = Path(parsed.path).suffix or ".csv"
        local_path = rd / f"dataset{suffix}"
        try:
            req = urllib.request.Request(dataset_arg, headers={"User-Agent": "panel/0.1"})
            with urllib.request.urlopen(req, timeout=30) as resp, local_path.open("wb") as out:
                out.write(resp.read())
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"failed to fetch dataset URL: {exc}")
        dataset_arg = str(local_path)

    meta = {
        "experiment_id": experiment_id,
        "goal": body.goal,
        "dataset": dataset_arg,
        "dataset_source": original_dataset,
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
        dataset_arg,
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
        "dataset": dataset_arg,
        "dataset_source": original_dataset,
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


# ---------- notebook + dataset (Colab / Jupyter handoff) ----------

CANONICAL_DATASETS: dict[str, Path] = {
    "titanic": REPO_ROOT / "examples" / "titanic" / "data" / "train.csv",
    "house_prices": REPO_ROOT / "examples" / "house_prices" / "data" / "train.csv",
}


def canonical_name_for(dataset_path: str | None) -> str | None:
    if not dataset_path:
        return None
    p = dataset_path.replace("\\", "/").lower()
    if "examples/titanic" in p:
        return "titanic"
    if "examples/house_prices" in p or "examples/house-prices" in p:
        return "house_prices"
    return None


COLAB_INTRO_MD = (
    "# 📘 Generated by Panel\n\n"
    "This notebook was produced by a four-agent jury (Implementer · Interpreter · "
    "Tagger · Archivist). The full deliberation — including the alternatives the "
    "jury considered and the methodological risks the Interpreter flagged — lives at:\n\n"
    "**Share URL:** {share_url}\n\n"
    "The cells below are the work product. The cells above install dependencies "
    "and (re-)materialize the dataset so this notebook runs cleanly in Colab."
)

COLAB_PIP_INSTALL = (
    "# Install the data-science stack the jury typically uses.\n"
    "!pip install -q pandas numpy scikit-learn matplotlib seaborn 2>/dev/null"
)

COLAB_FETCH_TEMPLATE = (
    "# Re-create the dataset path the jury used so the cells below run unchanged.\n"
    "import os, urllib.request\n"
    "DATASET_URL = {dataset_url!r}\n"
    "DATASET_PATH = {dataset_path!r}\n"
    "os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)\n"
    "urllib.request.urlretrieve(DATASET_URL, DATASET_PATH)\n"
    "print(f'wrote {{os.path.getsize(DATASET_PATH):,}} bytes to {{DATASET_PATH}}')"
)

COLAB_UPLOAD_TEMPLATE = (
    "# This run used a non-canonical dataset that Panel can't auto-fetch.\n"
    "# Upload the CSV manually so the rest of the notebook resolves.\n"
    "import os\n"
    "DATASET_PATH = {dataset_path!r}\n"
    "os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)\n"
    "try:\n"
    "    from google.colab import files  # type: ignore\n"
    "    print(f'Upload your CSV — Panel expects it at {{DATASET_PATH}}')\n"
    "    uploaded = files.upload()\n"
    "    name = next(iter(uploaded))\n"
    "    with open(DATASET_PATH, 'wb') as f:\n"
    "        f.write(uploaded[name])\n"
    "except ImportError:\n"
    "    print(f'Place your CSV at {{DATASET_PATH}} before running the cells below.')"
)


def make_colab_portable(notebook: dict, *, share_url: str, dataset_path: str | None,
                        dataset_url: str | None) -> dict:
    nb = copy.deepcopy(notebook)
    nb.setdefault("cells", [])
    intro_md = {
        "cell_type": "markdown",
        "metadata": {"panel_inserted": True},
        "source": COLAB_INTRO_MD.format(share_url=share_url),
    }
    install_cell = {
        "cell_type": "code",
        "metadata": {"panel_inserted": True},
        "source": COLAB_PIP_INSTALL,
        "execution_count": None,
        "outputs": [],
    }
    if dataset_url and dataset_path:
        data_cell_src = COLAB_FETCH_TEMPLATE.format(
            dataset_url=dataset_url, dataset_path=dataset_path
        )
    elif dataset_path:
        data_cell_src = COLAB_UPLOAD_TEMPLATE.format(dataset_path=dataset_path)
    else:
        data_cell_src = (
            "# (no dataset path recorded for this run — load whatever you need below.)"
        )
    data_cell = {
        "cell_type": "code",
        "metadata": {"panel_inserted": True},
        "source": data_cell_src,
        "execution_count": None,
        "outputs": [],
    }
    nb["cells"] = [intro_md, install_cell, data_cell, *nb["cells"]]
    return nb


@app.get("/datasets/{name}")
def get_dataset(name: str) -> FileResponse:
    path = CANONICAL_DATASETS.get(name)
    if path is None:
        raise HTTPException(status_code=404, detail=f"unknown dataset: {name}")
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"dataset file missing on disk: {name}")
    return FileResponse(path=path, media_type="text/csv", filename=f"{name}.csv")


@app.get("/experiments/{experiment_id}/notebook.ipynb")
def get_notebook(
    experiment_id: str,
    request: Request,
    colab: int = 0,
    origin: str | None = None,
) -> JSONResponse:
    rd = run_dir_for(experiment_id)
    nb_path = rd / "notebook.ipynb"
    if not nb_path.exists():
        raise HTTPException(status_code=404, detail="notebook not produced yet")
    try:
        nb = json.loads(nb_path.read_text())
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"notebook is corrupt: {e}") from e

    if colab:
        meta_path = rd / "meta.json"
        meta: dict = {}
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
            except json.JSONDecodeError:
                meta = {}
        dataset_path = meta.get("dataset")
        canonical = canonical_name_for(dataset_path)
        # Prefer caller-supplied origin (the web UI knows the user-facing host;
        # request.base_url is the internal backend host when proxied).
        if origin and (origin.startswith("http://") or origin.startswith("https://")):
            web_base = origin.rstrip("/")
            api_base = f"{web_base}/api/backend"
        else:
            api_base = str(request.base_url).rstrip("/")
            web_base = api_base
        share_url = f"{web_base}/share/{experiment_id}"
        dataset_url = f"{api_base}/datasets/{canonical}" if canonical else None
        nb = make_colab_portable(
            nb, share_url=share_url, dataset_path=dataset_path, dataset_url=dataset_url
        )

    filename = f"panel_{experiment_id}{'_colab' if colab else ''}.ipynb"
    return JSONResponse(
        content=nb,
        headers={
            "content-disposition": f'attachment; filename="{filename}"',
            "x-panel-experiment-id": experiment_id,
            "x-panel-colab-portable": "1" if colab else "0",
        },
        media_type="application/x-ipynb+json",
    )


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
