# ── Stage: Runtime ────────────────────────────────────────────────────────────
# Python 3.11 slim (Bookworm) — GIS wheels (pyogrio, shapely, pyproj) bundle native libs.
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Flush Python logs promptly (helps Render / container log aggregation).
ENV PYTHONUNBUFFERED=1

# Install Python dependencies before copying source so this layer is cached
# and only invalidated when requirements.txt changes.
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire server package (see .dockerignore — Keras model excluded;
# inference runs on ml-service / Cloud Run).
COPY . ./server

# Uvicorn is started from /app so that `server.src.main` resolves correctly
# as a Python package (server/__init__.py must exist).
# Render sets PORT dynamically; default 8000 for local Docker.
EXPOSE 8000
CMD ["/bin/sh", "-c", "exec uvicorn server.src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
