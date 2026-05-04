#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Deploy ML service with Cloud Build + Dockerfile (no manual docker build).
#
# Prerequisites:
#   gcloud auth login
#   gcloud config set project prioritai-ml   # your GCP project ID
#   Enable APIs (first time only; gcloud may prompt):
#     gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
#
# What happens:
#   1) Source in this directory is uploaded to a Cloud Storage staging bucket.
#   2) Cloud Build runs `docker build` using ./Dockerfile (not buildpacks).
#   3) The image is pushed to Artifact Registry (auto-created per project/region).
#   4) Cloud Run creates/updates the service with your memory/CPU settings.
#
# Risks / notes:
#   - TensorFlow + model (~108 MB on disk) often needs >=1Gi RAM at runtime; 512Mi
#     usually OOM-kills during model load. Start with --memory=2Gi or test 1Gi.
#   - Cold start: first request after idle may take several seconds (model load).
#   - ML_SERVICE_API_KEY: if unset, /predict is open; set in Cloud Run for optional auth.
# -----------------------------------------------------------------------------
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-prioritai-ml}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE_NAME="${SERVICE_NAME:-prioritai-ml}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gcloud run deploy "${SERVICE_NAME}" \
  --source="${SCRIPT_DIR}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=1 \
  --timeout=120 \
  --concurrency=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="PYTHONUNBUFFERED=1"

echo ""
echo "Done. Set the service URL on your backend (e.g. ML_SERVICE_URL)."
echo "Optional: gcloud run services update ${SERVICE_NAME} --region=${REGION} --set-env-vars=ML_SERVICE_API_KEY=your-secret"
