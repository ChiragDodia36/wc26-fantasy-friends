# WC26 Fantasy Friends

Friends-only FIFA World Cup 2026 fantasy football monorepo: **Expo Router (TypeScript)** mobile app + **FastAPI** backend + **PostgreSQL**.

> **Implementation status (as of 2026-02-23):** All 22 steps COMPLETE ✅ (51 backend tests passing).
> See `docs/plans/2026-02-22-ai-manager-design.md` for full plan.

---

## Tech stack

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | FastAPI + SQLAlchemy (sync) | Python 3.11+, Pydantic v2 |
| Database | PostgreSQL 15 | Docker Compose OR local Homebrew (`localhost:5432`) |
| Migrations | Alembic | `apps/backend/alembic.ini`; run with PYTHONPATH set (see below) |
| Mobile | Expo Router (TypeScript) | Replacing Flutter; Firebase Auth + Zustand |
| Auth | Firebase → FastAPI JWT | Firebase verifies token, FastAPI issues its own JWT |
| Data source | API-Football v3 (free, 100 req/day) | Seeding + post-match stats only |
| Live scores | football-data.org (free, 10 req/min) | All live polling at 30s intervals |
| AI Coach | Ollama (local, OpenAI-compat) | Qwen3-4B GRPO fine-tuned; stub until trained |
| RL Executor | Stable-Baselines3 PPO | `rl_executor.pth`; trained on Colab A100 |
| Memory | ChromaDB + sentence-transformers | Episodic memory for reflection agent |
| Infra | Docker Compose | Postgres + backend + migrations |

---

## Quick start

```bash
# 1. Env files
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env   # edit with real keys

# 2. Backend (local Homebrew PG already running on :5432)
cd apps/backend
source .venv/bin/activate
PYTHONPATH=$(pwd) DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/wc26 \
  alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Mobile (Expo Router — NOT Flutter)
cd apps/mobile
npx expo start        # scan QR with Expo Go on iPhone, or press 'i' for iOS sim

# OR with Docker (maps to :5432 — stop local PG first to avoid port conflict)
docker compose up --build   # Postgres + backend
```

---

## Dev environment notes

- **Two PostgreSQL instances on port 5432:** local Homebrew PG (`/opt/homebrew`) AND Docker.
  - Default for `alembic` / backend: local Homebrew (`localhost:5432`, user/password, db=wc26).
  - Docker PG is a clean fresh instance — run `docker stop wc26-fantasy-friends-db-1` first if switching.
- **Always set PYTHONPATH** when running alembic locally:
  `PYTHONPATH=/Users/chiragdodia/Desktop/fantasy_app/wc26-fantasy-friends/apps/backend`
- **Python venv:** `apps/backend/.venv` (Python 3.12 via Homebrew)
- **Mobile:** Expo Router app at `apps/mobile/` — Flutter code removed

---

## Project structure

```
wc26-fantasy-friends/
├── docker-compose.yml          # db + backend + migrations services
├── .env.example                # copy to .env, fill real values
├── docs/plans/                 # design docs and implementation plans
├── scripts/
│   ├── seed_worldcup_data.py   # seed teams/players/matches from API-Football
│   └── dev_run_all.sh
│
├── apps/backend/               # FastAPI
│   ├── app/
│   │   ├── main.py             # App entrypoint, CORS, router includes
│   │   ├── core/               # config, db, security, logging
│   │   ├── deps/               # auth_deps (get_current_user), db_deps
│   │   ├── integrations/       # api_football_client, football_data_client, llm_client, planner, memory_client
│   │   ├── models/             # SQLAlchemy ORM models (see below)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic layer
│   │   ├── routers/            # API route handlers
│   │   ├── tasks/              # Background tasks (APScheduler)
│   │   └── rl/                 # RL environment, PPO policy, inference
│   ├── alembic/                # Alembic migrations
│   │   └── versions/
│   │       ├── d602857e663e_initial_schema.py   # all base tables
│   │       └── d906d91fd1c4_add_squad_wildcard_ai_decision.py
│   ├── alembic.ini
│   └── pyproject.toml
│
├── apps/mobile/                # Expo Router (TypeScript)
│   ├── app/                    # File-based routes
│   │   ├── _layout.tsx         # Root layout — token check → auth or tabs
│   │   ├── (auth)/             # login, signup, onboarding
│   │   └── (tabs)/             # squad, leagues, matches, ai, players
│   ├── components/             # Shared: PitchView, FormChart, FDRBadge, etc.
│   ├── services/               # api.ts, storage.ts, firebaseAuth.ts
│   ├── store/                  # Zustand: authStore, squadStore
│   └── types/                  # ai.ts, player.ts, league.ts
│
└── training/                   # Colab A100 training scripts
    ├── synthetic_dataset.py
    ├── grpo_finetune.py
    ├── export_gguf.py
    └── Modelfile
```

---

## Backend models (current state)

All use UUID string PKs. All in `app/models/`.

| Model | Table | Key fields |
|-------|-------|------------|
| `User` | `users` | email, username, password_hash (nullable), firebase_uid (nullable) |
| `League` | `leagues` | name, code (invite), owner_id |
| `Team` | `teams` | external_id, name, country_code, group_name |
| `Player` | `players` | external_id, team_id, name, position, price, is_active |
| `Round` | `rounds` | name, start_utc, **deadline_utc**, end_utc |
| `Match` | `matches` | external_id, home/away_team_id, kickoff_utc, status, scores |
| `Squad` | `squads` | user_id, league_id, budget_remaining, **free_transfers_remaining**, **wildcard_used**, **wildcard_active_round_id** |
| `SquadPlayer` | `squad_players` | squad_id, player_id, is_starting, bench_order, is_captain, is_vice_captain |
| `SquadRoundPoints` | `squad_round_points` | squad_id, round_id, points, rank_in_league |
| `PlayerMatchStats` | `player_match_stats` | match_id, player_id, minutes_played, goals, assists, clean_sheet, saves, fantasy_points |
| `AIDecision` | `ai_decisions` | squad_id, round_id, decision_type, recommended_player_ids (JSONB), tot_branch, confidence_pct |

Association tables: `league_memberships` (league_id, user_id), `round_matches` (round_id, match_id)

---

## Backend architecture

### Pattern: models → schemas → services → routers

- **Schemas** (`app/schemas/`): Pydantic v2, `from_attributes = True`
- **Services** (`app/services/`): All business logic lives here
  - `auth_service` — signup/login + Firebase token verify (`firebase_login`)
  - `league_service` — create, list, join by code, standings
  - `squad_service` — create, get, update lineup
  - `transfers_service` — budget check, deadline check, free transfer decrement, wildcard, -4pt hit applied immediately
  - `scoring_service` — goals=6(FWD/MID)/5(DEF), assists=3, clean_sheet=4(GK/DEF)/1(MID), saves=1/3, bonus from rating
  - `ai_coach_service` — delegates to `llm_client` (stub → real Planner+RL)
  - `worldcup_sync_service` — API-Football seeding
  - `feature_service` — 18-dim player feature vectors
  - `fdr_service` — Fixture Difficulty Rating 1–5
  - `reflection_service` — post-round ChromaDB lessons
- **Routers** (`app/routers/`): Thin handlers
  - `POST /auth/signup`, `POST /auth/login`, `POST /auth/firebase`
  - `GET /users/me`
  - `GET/POST /leagues`, `POST /leagues/{id}/join`, `GET /leagues/{id}/standings`
  - `POST /squads`, `GET /squads/my`, `PUT /squads/{id}/lineup`, `POST /squads/{id}/wildcard`
  - `POST /transfers`
  - `GET /matches`, `GET /matches/{id}`
  - `GET /players`, `GET /players/{id}`, `GET /players/{id}/form`
  - `GET /rounds/current`
  - `POST /ai/squad-builder`, `POST /ai/lineup`, `POST /ai/transfers`, `POST /ai/qa`
  - `GET /ai/agent-status`, `POST /ai/reflect`

### Auth flow
1. Firebase Auth on mobile → get Firebase ID token
2. `POST /auth/firebase {id_token}` → backend verifies via firebase-admin → create/find User → return JWT
3. All protected routes: `Authorization: Bearer <JWT>` → `Depends(get_current_user)`

### Key files
- `app/core/config.py` — Settings (DATABASE_URL, JWT_SECRET, API_FOOTBALL_KEY, OLLAMA_BASE_URL, etc.)
- `app/core/db.py` — SQLAlchemy sync engine, SessionLocal, Base
- `app/core/security.py` — bcrypt hash/verify, JWT encode/decode
- `app/integrations/llm_client.py` — **STUB** until Step 17
- `app/integrations/api_football_client.py` — HTTP client for API-Football v3
- `app/integrations/football_data_client.py` — **TODO Step 3** live score polling
- `app/integrations/planner.py` — **TODO Step 16** ToT planner via Ollama
- `app/integrations/memory_client.py` — **TODO Step 15** ChromaDB episodic memory
- `app/rl/environment.py` — **TODO Step 11** Gym env
- `app/rl/executor_policy.py` — **TODO Step 12** PPO network
- `app/rl/inference.py` — **TODO Step 13** RLExecutor inference

### Running tests
```bash
cd apps/backend
PYTHONPATH=$(pwd) pytest tests/ -v
```

---

## Squad & transfer rules

- **15-player squad:** 2 GK / 5 DEF / 5 MID / 3 FWD
- **Max 2 players from the same national team**
- **Starting XI (11):** 1 GK + min 3 DEF, 2 MID, 1 FWD (FPL-style flexible)
- **1 free transfer per round** (`Squad.free_transfers_remaining`, resets each round)
- **Transfer penalty: -4 pts per extra transfer**, applied immediately at transfer time
- **Wildcard chip:** unlimited free transfers for one round, once per season (`Squad.wildcard_used`)
- **Deadline:** `Round.deadline_utc` blocks all transfers after cutoff

---

## Scoring rules

| Event | GK | DEF | MID | FWD |
|-------|-----|-----|-----|-----|
| Goal | 6 | 6 | 5 | 4 |
| Assist | 3 | 3 | 3 | 3 |
| Clean sheet (90 min) | 4 | 4 | 1 | — |
| Every 3 saves | 1 | — | — | — |
| Yellow card | -1 | -1 | -1 | -1 |
| Red card | -3 | -3 | -3 | -3 |
| Own goal | -2 | -2 | -2 | -2 |
| Bonus (rating ≥ 8.0) | +3 | +3 | +3 | +3 |
| Bonus (rating ≥ 7.0) | +2 | +2 | +2 | +2 |
| Bonus (rating ≥ 6.5) | +1 | +1 | +1 | +1 |
| Captain | ×2 | ×2 | ×2 | ×2 |
| Vice-captain | ×1.5 | ×1.5 | ×1.5 | ×1.5 |

---

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | `postgresql+psycopg2://user:password@localhost:5432/wc26` |
| `JWT_SECRET` | Yes | JWT signing secret (any long random string) |
| `JWT_ALGORITHM` | No | Default `HS256` |
| `API_FOOTBALL_KEY` | For sync | Free API-Football key (100 req/day) |
| `WORLD_CUP_LEAGUE_ID` | For sync | `1` (FIFA WC in API-Football) |
| `WORLD_CUP_SEASON` | For sync | `2022` (dev) → `2026` (April 2026) |
| `FOOTBALL_DATA_TOKEN` | For live | football-data.org free token |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | For auth | Path to `apps/backend/firebase-service-account.json` |
| `OLLAMA_BASE_URL` | For AI | `http://localhost:11434/v1` |
| `OLLAMA_MODEL` | For AI | `wc26-planner` (or `qwen3:4b` base) |
| `CHROMADB_PATH` | For memory | `./data/chromadb` |
| `RL_MODEL_PATH` | For RL | `./models/rl_executor.pth` |

---

## Implementation progress

| Step | Status | Description |
|------|--------|-------------|
| 0 | ✅ Done | .gitignore + git init + first commit |
| 1 | ✅ Done | Dockerfile + Alembic (3 migrations applied: initial_schema, squad_wildcard_ai_decision, firebase_uid) |
| 2 | ✅ Done | Wire real API-Football HTTP client (5 tests) |
| 3 | ✅ Done | Background tasks: football-data.org live polling + sync_stats (6 tests) |
| 4 | ✅ Done | Business logic: transfers (deadline/budget/wildcard/-4pt), scoring, standings, rounds, wildcard endpoint (6 tests) |
| 5 | ✅ Done | Expo Router scaffold + Firebase auth (4 tests): POST /auth/firebase, login/signup screens, Zustand authStore, SecureStore token |
| 6 | ✅ Done | All screens (squad, leagues, matches, AI coach) |
| 7 | ✅ Done | Shared components (PitchView, FormChart, FDRBadge, etc.) |
| 8 | ✅ Done | AI Coach screen (ToT branch cards + Q&A chat) |
| 9 | ✅ Done | Feature service + FDR service + GET /players/{id}/form (10 tests) |
| 10 | ✅ Done | Training data collection scripts (FPL + WC datasets) |
| 11 | ✅ Done | RL Gym environment — FantasyEnv with action masking (9 tests) |
| 12 | ✅ Done | PPO policy network — NumPy MLP + REINFORCE trainer (6 tests) |
| 13 | ✅ Done | RL inference integration (suggest_squad_rl, suggest_lineup_rl) |
| 14 | ✅ Done | GRPO fine-tuning scripts (synthetic dataset + DPO/LoRA + GGUF export) |
| 15 | ✅ Done | ChromaDB episodic memory (store/query lessons) |
| 16 | ✅ Done | Tree of Thought planner via Ollama (3 branches + fallback) |
| 17 | ✅ Done | Replace LLM stub with real Planner+RL in ai_coach_service |
| 18 | ✅ Done | Reflection agent (post-round analysis → episodic memory) |
| 19 | ✅ Done | New endpoints: GET /ai/agent-status, POST /ai/reflect, GET /players/{id}/form |
| 20 | ✅ Done | Updated pyproject.toml (numpy, gymnasium, chromadb, pandas) |
| 21 | ✅ Done | Updated .env.example with all env vars |

---

## Known gaps & next steps

### Mobile
- No onboarding flow yet (create/join league after first login)
- `GoogleService-Info.plist` for iOS not yet added — needed for native iOS Google Sign-In
- Native iOS/Android build requires `npx expo run:ios` (Expo Go supports JS-only modules)
- Dev mode bypass button on login screen (remove before production)

### Backend / AI
- Ollama must be running locally for real ToT planner responses (falls back to mock)
- RL policy is untrained (random init) — run `python -m app.rl.train_ppo` to train
- GRPO fine-tuning requires Colab A100 — scripts ready in `training/`
- `llm_client.py` still exists as legacy stub (superseded by `planner.py`)

---

## Conventions for contributors

### Backend
- Add new features as: model → schema → service → router
- All route handlers should be thin; business logic goes in services
- Protected endpoints use `user=Depends(get_current_user)`
- DB sessions via `db: Session = Depends(get_db)`
- IDs are UUID strings generated with `uuid.uuid4()`
- **TDD:** write failing pytest test first, then implement, then verify pass

### Mobile (Expo Router)
- File-based routing under `app/`
- State: Zustand stores in `store/`
- API calls: Axios singleton in `services/api.ts` with Bearer token interceptor
- Secure token storage: `expo-secure-store` on native, `localStorage` on web

### Domain rules
- All leagues are **private** — join only via invite code
- Scoring rules defined in `app/services/scoring_service.py`
- Squad budget is tracked per squad; transfers check budget + deadline + wildcard
- Player positions: GK, DEF, MID, FWD
- Match statuses: SCHEDULED, LIVE, FINISHED (enum in `app/models/match.py`)
- Player prices: auto-set at seed time by position (GK £4.5m, DEF £5m, MID £5.5m, FWD £6m)
