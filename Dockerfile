# Ascertainty backend image — FastAPI + watcher + claim_task + telegram + cctp
# Single Python 3.12 image; SQLite lives on a host-mounted volume so the
# bounty/race state survives container restarts.

FROM python:3.12-slim AS base

# System deps required by python-0g (which spawns a Node runtime for its
# JS bridge — `javascript` package), web3, and websockets.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        gnupg \
        build-essential \
        git \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy only the runtime code (not contracts/dashboard/specs/etc — those are
# build-time artifacts; specs are needed for any future spec-validation calls
# but we ship them too so the operator can run `cli.ascertainty verify`)
COPY backend/ /app/backend/
COPY cli/ /app/cli/
COPY specs/ /app/specs/

# Data dir: SQLite lives here. docker-compose mounts a host volume.
RUN mkdir -p /app/data
ENV ASCERTAINTY_DB_PATH=/app/data/ascertainty.db

EXPOSE 8000

# uvicorn with one worker — the lifespan tasks (watcher, claim_task,
# telegram, cctp) are global state and must not be duplicated.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
