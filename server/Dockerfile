# ── Stage: Runtime ────────────────────────────────────────────────────────────
# Python 3.11 slim (Bookworm) — compatible with TensorFlow 2.18 and all GIS wheels.
# pyogrio, shapely, and pyproj ship pre-built wheels with bundled GDAL/GEOS/PROJ,
# so no system-level GDAL installation is required.
FROM python:3.11-slim-bookworm

# libgomp1  — OpenMP runtime required by TensorFlow parallel operations.
# libglib2.0-0 — base GLib library pulled in by some spatial wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Flush Python logs promptly (helps Render / container log aggregation).
ENV PYTHONUNBUFFERED=1

# Install Python dependencies before copying source so this layer is cached
# and only invalidated when requirements.txt changes.
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire server package.  This includes:
#   server/src/         — application source code
#   server/data/        — CBS shapefiles and population Excel data
#   server/src/core/rocket_damage_model.keras — Keras model (must be present locally)
#   server/__init__.py  — makes `server` an importable Python package
COPY . ./server

# Uvicorn is started from /app so that `server.src.main` resolves correctly
# as a Python package (server/__init__.py must exist).
# Render sets PORT dynamically; default 8000 for local Docker.
EXPOSE 8000
CMD ["/bin/sh", "-c", "exec uvicorn server.src.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
