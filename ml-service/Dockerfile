# PrioritAI ML inference — Cloud Run (CPU). Cloud Run sets PORT (default 8080).
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    OMP_NUM_THREADS=1 \
    TF_NUM_INTRAOP_PARALLELISM_THREADS=1 \
    TF_NUM_INTEROP_PARALLELISM_THREADS=1

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY model ./model
COPY app ./app

EXPOSE 8080
CMD ["/bin/sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
