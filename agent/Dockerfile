# Panel agent runtime — runs the jury loop as a CLI.
# Build from the repo root: `docker build -f agent/Dockerfile -t panel-agent .`
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps: build-essential for some scientific wheels; curl for healthchecks.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY agent/requirements.txt /app/agent/requirements.txt
RUN pip install -r /app/agent/requirements.txt

# Copy the Python source the agent needs. Data + runs mount as volumes.
COPY shared /app/shared
COPY agent /app/agent

# Register the ipykernel so nbclient can find a "python3" kernel.
RUN python -m ipykernel install --sys-prefix --name=python3 --display-name="Python 3"

ENV PYTHONPATH=/app

# Default: run loop_v0 against Titanic. Override in compose or via `docker run`.
CMD ["python", "-m", "agent.loop_v0", \
     "--goal", "Predict survival on Titanic and tell me which features actually matter.", \
     "--dataset", "examples/titanic/data/train.csv", \
     "--out", "runs/titanic_docker"]
