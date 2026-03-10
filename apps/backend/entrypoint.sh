#!/bin/bash
set -e

# Write Firebase service account JSON from env var to temp file
if [ -n "$FIREBASE_SERVICE_ACCOUNT_JSON_CONTENT" ]; then
  echo "$FIREBASE_SERVICE_ACCOUNT_JSON_CONTENT" > /tmp/firebase-sa.json
  export FIREBASE_SERVICE_ACCOUNT_JSON=/tmp/firebase-sa.json
  echo "[entrypoint] Firebase service account written to /tmp/firebase-sa.json"
fi

# Wait for Ollama to be ready (supervisord starts it in parallel)
echo "[entrypoint] Waiting for Ollama to be ready..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "[entrypoint] Ollama is ready after ${i}s."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "[entrypoint] WARNING: Ollama did not become ready in 60s, continuing anyway."
  fi
  sleep 1
done

# Run Alembic migrations
echo "[entrypoint] Running database migrations..."
cd /code
alembic upgrade head
echo "[entrypoint] Migrations complete."

# Start FastAPI on port 7860 (required by HuggingFace Spaces)
echo "[entrypoint] Starting uvicorn on port 7860..."
exec uvicorn app.main:app --host 0.0.0.0 --port 7860
