# Backend Deployment Design
Date: 2026-03-10

## Overview
Deploy the WC26 Fantasy Friends FastAPI backend + Ollama to HuggingFace Spaces (free tier) with Supabase for managed PostgreSQL. Simultaneously set up the Qwen3 fine-tuning pipeline for improved on-device AI transfer suggestions.

## Architecture

```
HuggingFace Space (free Docker · 2 vCPU · 16GB RAM)
  supervisord
  ├── ollama serve (port 11434) — qwen3:4b baked into image
  └── uvicorn app.main:app (port 7860)

Supabase (free tier)
  └── PostgreSQL 500MB — DATABASE_URL injected as HF Space secret
```

## Key Decisions
- Port 7860: HF Spaces requires apps to listen on 7860
- Model baked in: `RUN ollama pull qwen3:4b` at build time — no cold-start downloads
- supervisord: manages both processes, restarts on crash
- ChromaDB: ephemeral in-memory — resets on restart, acceptable for now
- OLLAMA_BASE_URL: stays `http://localhost:11434/v1` — no config change needed
- Alembic migrations: run at container start via entrypoint.sh

## Files Changed
- `apps/backend/Dockerfile` — add Ollama, supervisord, model pull, port 7860
- `apps/backend/entrypoint.sh` — wait for Ollama ready before uvicorn
- `apps/backend/supervisord.conf` — new, manages ollama + uvicorn
- `apps/mobile/services/api.ts` — update base URL to HF Space URL

## Environment Variables (set in HF Space Secrets)
| Variable | Notes |
|----------|-------|
| DATABASE_URL | Supabase postgres connection string |
| JWT_SECRET | Long random string |
| API_FOOTBALL_KEY | Existing key |
| FIREBASE_SERVICE_ACCOUNT_JSON_CONTENT | Firebase SA JSON |
| NEWS_API_KEY | Optional |
| OLLAMA_BASE_URL | http://localhost:11434/v1 |

## Training Pipeline
| Step | Who | Tool |
|------|-----|------|
| Generate dataset | Claude | `python training/synthetic_dataset.py --samples 5000` |
| Fine-tune | User | Google Colab T4 GPU, `grpo_finetune.py` |
| Export GGUF | User | `export_gguf.py --upload <hf-repo>` |
| Update MODEL_URL | Claude | After user provides HF Hub URL |
| Deploy to HF Space | Claude | Modify Dockerfile + push |

## Success Criteria
- `GET https://<username>-wc26-backend.hf.space/docs` returns FastAPI Swagger UI
- `/auth/signup` and `/auth/login` work against Supabase DB
- `/ai/qa` hits Ollama (qwen3:4b) and returns a response
- Mobile app connects to Space URL successfully
