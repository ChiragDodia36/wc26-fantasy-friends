# WC26 Fantasy Friends

Friends-only FIFA World Cup 2026 fantasy football app. Expo Router (React Native/TypeScript) mobile app + FastAPI backend + PostgreSQL. Real World Cup data from API-Football, AI Coach powered by Qwen3-4B + PPO RL executor.

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo Router (TypeScript) + Zustand + Firebase Auth |
| Backend | FastAPI + SQLAlchemy (sync) + Pydantic v2 |
| Database | PostgreSQL 15 |
| Migrations | Alembic |
| Auth | Firebase → FastAPI JWT |
| Data | API-Football v3 (seeding) + football-data.org (live scores) |
| AI Coach | Ollama (Qwen3-4B GRPO fine-tuned) + Stable-Baselines3 PPO |
| Memory | ChromaDB + sentence-transformers |

## Quick Start

### 1. Environment
```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env  # edit with real keys
```

### 2. Backend
```bash
cd apps/backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
source .env && export DATABASE_URL
PYTHONPATH=$(pwd) alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Seed World Cup Data
```bash
cd apps/backend
source .venv/bin/activate && source .env && export DATABASE_URL
PYTHONPATH=$(pwd) python ../../scripts/seed_worldcup_data.py
```

### 4. Mobile App
```bash
cd apps/mobile
npm install
npx expo start  # scan QR with Expo Go on your phone
```

## Features

- **Squad Builder** — pick 15 players (2 GK / 5 DEF / 5 MID / 3 FWD), max 2 per team, £100m budget
- **Real WC Data** — teams, players, and fixtures from API-Football (WC 2022 for dev, WC 2026 when available)
- **Matches Schedule** — grouped by round with real team names, dates, and venues
- **Transfers** — 1 free per round, -4pts per extra, wildcard chip
- **Private Leagues** — join only via invite code
- **AI Coach** — Tree of Thought reasoning (Safe/Differential/Fixture branches) with RL-optimized squad selection
- **Live Scores** — football-data.org polling during matches

## Project Structure

```
wc26-fantasy-friends/
├── apps/backend/          # FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic request/response
│   │   ├── services/      # Business logic
│   │   ├── routers/       # API endpoints
│   │   ├── integrations/  # API-Football, Ollama, ChromaDB
│   │   └── rl/            # PPO environment + policy
│   └── alembic/           # Database migrations
├── apps/mobile/           # Expo Router (TypeScript)
│   ├── app/               # File-based routes
│   │   ├── (auth)/        # Login, signup
│   │   └── (tabs)/        # Squad, leagues, matches, AI coach
│   ├── components/        # Shared UI components
│   ├── services/          # API client, storage, Firebase auth
│   └── store/             # Zustand state management
├── scripts/               # Seeding + data collection
└── training/              # Colab A100 training scripts
```

## Env Vars

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `API_FOOTBALL_KEY` | API-Football free key (100 req/day) |
| `WORLD_CUP_SEASON` | `2022` (dev) or `2026` (production) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Path to Firebase service account |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` |
| `OLLAMA_MODEL` | `wc26-planner` or `qwen3:4b` |

## Notes

- All leagues are private — join only via invite code
- Scoring rules defined in `app/services/scoring_service.py`
- Squad rules: max 2 per national team, budget £100m
- Backend pattern: models → schemas → services → routers (thin routers)
