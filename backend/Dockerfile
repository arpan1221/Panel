# Panel backend — FastAPI + jury runtime bundled (backend spawns the agent as a subprocess).
# Build from the repo root: `docker build -f backend/Dockerfile -t panel-backend .`
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install agent deps (so backend can import / invoke the agent), then backend deps.
COPY agent/requirements.txt /app/agent/requirements.txt
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/agent/requirements.txt && \
    pip install -r /app/backend/requirements.txt

COPY shared /app/shared
COPY agent /app/agent
COPY backend /app/backend

RUN python -m ipykernel install --sys-prefix --name=python3 --display-name="Python 3"

ENV PYTHONPATH=/app \
    PANEL_RUNS_DIR=/app/runs

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/backend", "--reload-dir", "/app/agent", "--reload-dir", "/app/shared"]
