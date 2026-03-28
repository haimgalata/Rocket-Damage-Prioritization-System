#!/bin/bash
# Runs once before uvicorn starts.
# seed_db.py is fully idempotent — it skips any data that already exists,
# so this is safe to execute on every container restart.
set -e

echo "[entrypoint] Seeding database (idempotent)..."
python -m server.src.seed_db

echo "[entrypoint] Starting uvicorn..."
exec uvicorn server.src.main:app --host 0.0.0.0 --port 8000
