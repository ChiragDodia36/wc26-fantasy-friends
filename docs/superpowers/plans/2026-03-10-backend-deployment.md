# Backend Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy WC26 Fantasy Friends FastAPI + Ollama to HuggingFace Spaces (free), backed by Supabase PostgreSQL, and generate the Qwen3 fine-tuning dataset locally.

**Architecture:** Single HF Space Docker container running supervisord → ollama serve + uvicorn. qwen3:4b baked into the Docker image at build time. Supabase provides managed PostgreSQL. Mobile app switches from localhost to the fixed HF Space URL via app.json extra config.

**Tech Stack:** Docker, supervisord, Ollama (qwen3:4b), FastAPI/uvicorn, Supabase PostgreSQL, HuggingFace Spaces, Expo app.json extra

---

## Chunk 1: Training Dataset Generation

### Task 1: Generate Qwen3 Fine-Tuning Dataset

**Files:**
- Run: `training/synthetic_dataset.py` (already written, no changes needed)
- Output: `training/data/grpo_dataset.jsonl`

- [ ] **Step 1: Run dataset generation**

```bash
cd /Users/chiragdodia/Desktop/fantasy_app/wc26-fantasy-friends
python training/synthetic_dataset.py --samples 5000
```

Expected output:
```
Generating 5000 transfer-swap training samples...
  Generated 500/5000 samples (skipped N)...
  Generated 1000/5000 samples (skipped N)...
  ...
Saved 5000 samples to training/data/grpo_dataset.jsonl
```

- [ ] **Step 2: Verify output**

```bash
wc -l training/data/grpo_dataset.jsonl
head -1 training/data/grpo_dataset.jsonl | python3 -m json.tool | head -20
```

Expected: 5000 lines, first line is valid JSON with keys `prompt`, `chosen`, `rejected`.

- [ ] **Step 3: Commit dataset (with Git LFS)**

The `.jsonl` file is ~50-80 MB. Use Git LFS to avoid bloating repo history.

```bash
# Install LFS if not already (macOS: brew install git-lfs)
git lfs install
git lfs track "*.jsonl"
git add .gitattributes training/data/grpo_dataset.jsonl
git commit -m "feat: generate 5000 transfer-swap DPO training samples"
```

---

> **USER ACTION REQUIRED after Chunk 1:**
> 1. Upload `training/grpo_finetune.py` and `training/data/grpo_dataset.jsonl` to Google Colab
> 2. Runtime → Change runtime type → T4 GPU
> 3. Run:
>    ```
>    !pip install -q transformers trl peft accelerate bitsandbytes datasets
>    !python grpo_finetune.py --dataset grpo_dataset.jsonl --epochs 3
>    ```
> 4. Download `training/output/wc26-qwen3/` from Colab
> 5. Run locally: `python training/export_gguf.py --adapter training/output/wc26-qwen3 --upload <your-hf-username>/wc26-qwen3-gguf`
> 6. Provide the HuggingFace Hub GGUF URL → Claude will update `modelManager.ts`

---

## Chunk 2: Backend Dockerization for HF Spaces

### Task 2: Create supervisord.conf

**Files:**
- Create: `apps/backend/supervisord.conf`

- [ ] **Step 1: Create supervisord.conf**

Create `apps/backend/supervisord.conf`:

```ini
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log
logfile_maxbytes=10MB
loglevel=info

[program:ollama]
command=ollama serve
autostart=true
autorestart=true
priority=10
stdout_logfile=/var/log/ollama.log
stdout_logfile_maxbytes=5MB
stderr_logfile=/var/log/ollama.log
stderr_logfile_maxbytes=5MB
environment=OLLAMA_HOST="0.0.0.0"

[program:uvicorn]
command=/code/entrypoint.sh
autostart=true
autorestart=true
priority=20
stdout_logfile=/var/log/uvicorn.log
stdout_logfile_maxbytes=5MB
stderr_logfile=/var/log/uvicorn.log
stderr_logfile_maxbytes=5MB
```

- [ ] **Step 2: Verify file was created**

```bash
cat apps/backend/supervisord.conf
```

Expected: file contents printed with both `[program:ollama]` and `[program:uvicorn]` sections.

### Task 3: Update entrypoint.sh

**Files:**
- Modify: `apps/backend/entrypoint.sh`

- [ ] **Step 1: Update entrypoint.sh to wait for Ollama and use port 7860**

Replace the full contents of `apps/backend/entrypoint.sh` with:

```bash
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
```

- [ ] **Step 2: Verify the file**

```bash
cat apps/backend/entrypoint.sh
```

Expected: file contains `port 7860` and `Waiting for Ollama` loop.

### Task 4: Update Dockerfile

**Files:**
- Modify: `apps/backend/Dockerfile`

- [ ] **Step 1: Replace Dockerfile with HF Spaces version**

Replace full contents of `apps/backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /code

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Install Python dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY entrypoint.sh .
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN chmod +x entrypoint.sh

# Pull Ollama model at build time so cold starts don't re-download it
# Start ollama in background, wait, pull, then stop
RUN /bin/bash -c '\
    ollama serve & \
    OLLAMA_PID=$! && \
    echo "Waiting for Ollama to start..." && \
    for i in $(seq 1 30); do \
        curl -sf http://localhost:11434/api/tags > /dev/null 2>&1 && break; \
        sleep 1; \
    done && \
    echo "Pulling qwen3:4b..." && \
    ollama pull qwen3:4b || { echo "ERROR: ollama pull qwen3:4b failed"; exit 1; } && \
    echo "Model pulled successfully." && \
    kill $OLLAMA_PID && \
    wait $OLLAMA_PID 2>/dev/null || true'

# HuggingFace Spaces requires port 7860
EXPOSE 7860

# supervisord manages: ollama serve + entrypoint.sh (uvicorn)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

- [ ] **Step 2: Verify the Dockerfile**

```bash
cat apps/backend/Dockerfile
```

Expected: contains `ollama pull qwen3:4b`, `EXPOSE 7860`, `supervisord` CMD.

- [ ] **Step 3: Commit all backend deployment files**

```bash
git add apps/backend/Dockerfile apps/backend/entrypoint.sh apps/backend/supervisord.conf
git commit -m "feat: dockerize backend for HuggingFace Spaces (Ollama + supervisord, port 7860)"
```

---

## Chunk 3: Supabase Setup (User Steps) + HF Space Creation

> **USER ACTION REQUIRED — Supabase:**
> 1. Go to https://supabase.com → New project
> 2. Choose a region close to your users
> 3. Settings → Database → Connection string → copy the **URI** (starts with `postgresql://...`)
>    - Replace `[YOUR-PASSWORD]` with the DB password you set
>    - This is your `DATABASE_URL`

> **USER ACTION REQUIRED — HuggingFace Space:**
> 1. Go to https://huggingface.co/new-space
> 2. Space name: `wc26-backend` (your URL will be `https://<username>-wc26-backend.hf.space`)
> 3. SDK: **Docker**
> 4. Visibility: Public (required for free tier persistent containers)
> 5. Hardware: CPU basic (free)
> 6. After creating: Settings → Repository secrets → add all env vars:
>    - `DATABASE_URL` — Supabase URI from above
>    - `JWT_SECRET` — run `python3 -c "import secrets; print(secrets.token_hex(32))"` to generate
>    - `API_FOOTBALL_KEY` — your existing key
>    - `FIREBASE_SERVICE_ACCOUNT_JSON_CONTENT` — paste your Firebase SA JSON (single line)
>    - `OLLAMA_BASE_URL` — `http://localhost:11434/v1`
>    - `NEWS_API_KEY` — your key (optional)

### Task 5: Add HuggingFace Space remote and push

**Files:**
- No file changes — git operations only

- [ ] **Step 1: Add HF Space as a git remote**

HF username is `cpdodia`, Space name is `wc26-backend`:

```bash
cd /Users/chiragdodia/Desktop/fantasy_app/wc26-fantasy-friends
git remote add hf-space https://huggingface.co/spaces/cpdodia/wc26-backend
```

- [ ] **Step 2: Push to the Space**

HF Spaces deploy from the `main` branch. Push only `apps/backend/` as a subtree since this is a monorepo:

```bash
git subtree push --prefix apps/backend hf-space main
```

Expected: git pushes successfully. Watch build logs at:
`https://huggingface.co/spaces/cpdodia/wc26-backend` → Logs tab.

Build takes ~5-10 minutes (first time, ~2.3GB qwen3:4b layer). If `git subtree push` fails due to history conflicts, use the split fallback:
```bash
git subtree split --prefix apps/backend -b hf-deploy
git push hf-space hf-deploy:main --force
```

- [ ] **Step 3: Verify the Space is running**

```bash
curl -s https://cpdodia-wc26-backend.hf.space/docs | grep -o "WC26 Fantasy Friends"
```

Expected: `WC26 Fantasy Friends` printed (confirms FastAPI is up and serving docs).

- [ ] **Step 4: Verify Ollama is responding via health check**

```bash
# Sign up for a test account first
curl -s -X POST https://cpdodia-wc26-backend.hf.space/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"tester","password":"testpass123"}' | python3 -m json.tool

# Login to get a token
TOKEN=$(curl -s -X POST https://cpdodia-wc26-backend.hf.space/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Hit the AI endpoint
curl -s -X POST https://cpdodia-wc26-backend.hf.space/ai/qa \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "Who should I captain?"}' | python3 -m json.tool
```

Expected: JSON response with an `answer` field — confirms Ollama (qwen3:4b) is running inside the container.

---

## Chunk 4: Mobile App URL Update

### Task 6: Point mobile app at HF Space URL

**Files:**
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Confirm HF Space URL is already set in app.json**

The URL is already present. Verify it matches the deployed Space:

```bash
grep apiBaseUrl apps/mobile/app.json
```

Expected: `"apiBaseUrl": "https://cpdodia-wc26-fantasy-backend.hf.space"`

If the URL is missing or wrong, set it to the correct value:
```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "https://cpdodia-wc26-fantasy-backend.hf.space"
    }
  }
}
```

The `resolveBaseUrl()` function in [api.ts:15](apps/mobile/services/api.ts#L15) already reads `Constants.expoConfig?.extra?.apiBaseUrl` and uses it when present — no code change needed. Note: this approach correctly uses `app.json` config rather than hardcoding in `api.ts`, keeping the URL out of source code.

- [ ] **Step 2: Verify app.json is valid JSON**

```bash
python3 -m json.tool apps/mobile/app.json > /dev/null && echo "Valid JSON"
```

Expected: `Valid JSON`

- [ ] **Step 3: Test the connection (run Expo dev server)**

```bash
cd apps/mobile && npx expo start
```

Open the app → check Metro bundler console for:
```
[API] Base URL: https://cpdodia-wc26-fantasy-backend.hf.space
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app.json
git commit -m "config: point mobile app at HuggingFace Space backend URL"
```

---

## Chunk 5: (Post-Training) Update On-Device Model URL

> **Complete this chunk only after you have the GGUF uploaded to HuggingFace Hub.**

### Task 7: Update modelManager.ts with fine-tuned model URL

**Files:**
- Modify: `apps/mobile/services/modelManager.ts`

- [ ] **Step 1: Update MODEL_URL**

In `apps/mobile/services/modelManager.ts`, find the `MODEL_URL` constant and replace it with the URL provided after `export_gguf.py --upload` completes:

```typescript
const MODEL_URL = 'https://huggingface.co/<username>/wc26-qwen3-gguf/resolve/main/wc26-qwen3-Q4_K_M.gguf';
```

- [ ] **Step 2: Preflight — verify the new GGUF URL is reachable**

```bash
curl -I https://huggingface.co/<username>/wc26-qwen3-gguf/resolve/main/wc26-qwen3-Q4_K_M.gguf
```

Expected: `HTTP/2 200` response. If 404, the file hasn't been uploaded yet — do not proceed.

- [ ] **Step 3: Clear cached model on device (dev only)**

The old model is cached at `FileSystem.documentDirectory/models/` on the device. Delete and reinstall the app to force a fresh model download.

- [ ] **Step 4: Verify inference still works**

Open the app → AI Transfers tab → wait for inference to complete → check that the response is non-empty JSON containing `swaps` with at least one entry:

```
Expected console output: {"swaps":[{"out_name":"...","in_name":"...","reason":"..."},...], "summary":"...", "confidence":...}
```

If the screen shows an error or empty result, check Metro console for a crash from `llama.rn`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/services/modelManager.ts
git commit -m "feat: update on-device model URL to fine-tuned wc26-qwen3-Q4_K_M GGUF"
```
