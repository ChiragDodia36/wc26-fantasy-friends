# WC26 Fantasy Friends

Friends-only FIFA World Cup 2026 fantasy football monorepo: **Flutter** mobile app + **FastAPI** backend + **PostgreSQL**.

---

## Tech stack

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | FastAPI + SQLAlchemy (sync) | Python 3.11+, Pydantic v2 |
| Database | PostgreSQL 15 | via Docker Compose or local |
| Migrations | Alembic | `apps/backend/alembic.ini` |
| Mobile | Flutter + Riverpod | Dart, Dio HTTP client |
| Auth | JWT (HS256) | `passlib` bcrypt hashing |
| Data source | API-Football | World Cup fixtures, players, stats |
| AI Coach | OpenAI-compatible LLM | Currently stub — wire in `llm_client.py` |
| Infra | Docker Compose | Postgres + backend + migrations |

---

## Quick start

```bash
# 1. Env files
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env

# 2. Backend (local)
cd apps/backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Mobile
cd apps/mobile
flutter pub get
flutter run   # Android emulator: API_BASE_URL=http://10.0.2.2:8000

# OR with Docker
docker compose up --build   # Postgres + backend
```

---

## Project structure

```
wc26-fantasy-friends/
├── docker-compose.yml          # db + backend + migrations services
├── .env.example
├── scripts/
│   ├── init_db.sh              # alembic upgrade head
│   ├── seed_worldcup_data.py   # seed teams/players/matches from API-Football
│   └── dev_run_all.sh          # docker compose up --build
│
├── apps/backend/               # FastAPI
│   ├── app/
│   │   ├── main.py             # App entrypoint, CORS, router includes
│   │   ├── core/               # config, db, security, logging
│   │   ├── deps/               # auth_deps (get_current_user), db_deps
│   │   ├── integrations/       # api_football_client, llm_client (stub)
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic layer
│   │   ├── routers/            # API route handlers
│   │   └── tasks/              # Background tasks (scheduler, sync)
│   ├── tests/                  # pytest tests
│   ├── alembic.ini
│   └── pyproject.toml
│
└── apps/mobile/                # Flutter
    └── lib/
        ├── main.dart           # ProviderScope → WC26App → MainShell (bottom nav)
        ├── core/               # config, theme, routing, utils
        ├── features/           # Feature modules (auth, squad, leagues, etc.)
        ├── models/             # Dart data models with fromJson
        ├── services/           # api_client, auth_service, storage_service
        └── widgets/            # Shared widgets (LeagueCard, PlayerTile, etc.)
```

---

## Backend architecture

### Pattern: models → schemas → services → routers

- **Models** (`app/models/`): SQLAlchemy ORM. All use UUID string PKs.
  - `User` — email, username, hashed_password
  - `League` — name, code (invite), owner_id; M2M users via `league_memberships` table
  - `Squad` — user_id, league_id, budget_remaining
  - `SquadPlayer` — squad_id, player_id, is_starting, bench_order, is_captain, is_vice_captain
  - `SquadRoundPoints` — squad_id, round_id, total_points
  - `Team` — name, api_football_id, group_letter, flag_url
  - `Player` — name, position (GK/DEF/MID/FWD), price, team_id
  - `Match` — home/away team_id, round_id, kickoff_utc, status enum (scheduled/live/finished/postponed), scores
  - `Round` — name, start_date, end_date, is_current
  - `PlayerMatchStats` — player_id, match_id, minutes, goals, assists, clean_sheet, yellow/red cards, saves, bonus

- **Schemas** (`app/schemas/`): Pydantic v2 models with `from_attributes = True`

- **Services** (`app/services/`): Business logic, DB queries
  - `auth_service`: signup (hash + create user + JWT), login (verify + JWT)
  - `league_service`: create (generate 8-char code), list user leagues, join by code, standings
  - `squad_service`: create squad, get my squad, update lineup
  - `transfers_service`: player out/in swap with budget check
  - `scoring_service`: Fantasy point rules (goals=6/5, assists=3, clean_sheet=4/1, cards=-1/-3, saves, bonus)
  - `ai_coach_service`: Delegates to `llm_client` for squad-builder/lineup/transfers/QA
  - `worldcup_sync_service`: Seed and sync from API-Football
  - `stats_service`: Player match stats aggregation

- **Routers** (`app/routers/`): Thin HTTP layer
  - `/auth/signup`, `/auth/login` — public
  - `/users/me` — protected (get_current_user)
  - `/leagues` — CRUD + join by code; all protected
  - `/squads` — create, my (by league_id), update lineup; protected
  - `/transfers` — make transfer; protected
  - `/matches` — list (optional status filter), detail
  - `/players` — list (optional filters: team, position, price, search), detail
  - `/ai/squad-builder`, `/ai/lineup`, `/ai/transfers`, `/ai/qa` — protected

### Auth flow
1. `POST /auth/signup` → creates user, returns UserBase
2. `POST /auth/login` → verifies password, returns JWT token
3. Protected routes use `Depends(get_current_user)` which decodes JWT from `Authorization: Bearer <token>`

### Key files
- `app/core/config.py` — `Settings` class, reads from env vars
- `app/core/db.py` — SQLAlchemy engine, SessionLocal, `get_db` generator, `Base`
- `app/core/security.py` — bcrypt hash/verify, JWT encode/decode
- `app/integrations/llm_client.py` — **STUB** — returns mock AI responses
- `app/integrations/api_football_client.py` — HTTP client for API-Football v3

### Running tests
```bash
cd apps/backend
pytest tests/
```

---

## Mobile architecture

### Pattern: features (presentation + state + data) with Riverpod

Each feature follows:
```
features/<name>/
  ├── presentation/     # Screens (ConsumerWidget / ConsumerStatefulWidget)
  ├── state/           # Controller (StateNotifier<State>) + Provider
  └── data/            # Repository (Dio HTTP calls)
```

### State management
- **Riverpod** `StateNotifier<T>` pattern throughout
- State classes are immutable with `copyWith()`
- Providers defined at bottom of controller files
- Example: `authControllerProvider = StateNotifierProvider<AuthController, AuthState>(...)`

### API client
- **Dio** singleton in `services/api_client.dart`
- Auto-injects Bearer token via interceptor (reads from `StorageService`)
- Base URL resolved platform-aware via `AppConfig.apiBaseUrl`:
  - Android emulator: `http://10.0.2.2:8000`
  - Everything else: `http://localhost:8000`
  - Override with `--dart-define API_BASE_URL=...`

### Navigation
- Direct `Navigator.push(MaterialPageRoute(...))` — no GoRouter
- Bottom nav: My Squad, Leagues, Matches, AI Coach
- Settings accessed via AppBar icon

### Key dependencies (pubspec.yaml)
- `flutter_riverpod: ^2.5.1` — state management
- `dio: ^5.7.0` — HTTP client
- `flutter_secure_storage: ^9.2.2` — token persistence
- `intl: ^0.19.0` — date/currency formatting
- `shared_preferences: ^2.3.2` — installed but unused

---

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_ALGORITHM` | No | Default `HS256` |
| `API_FOOTBALL_KEY` | For sync | API-Football API key |
| `WORLD_CUP_LEAGUE_ID` | For sync | API-Football league ID |
| `WORLD_CUP_SEASON` | For sync | `2026` |
| `OPENAI_API_KEY` | For AI | OpenAI-compatible API key |

---

## Known gaps & TODOs

### Critical
- **No auth gate in mobile app** — MainShell loads even without login; API calls 401. Need to check token on startup and redirect to LoginScreen.
- **Logout doesn't clear token** — `SettingsScreen` logout only does `Navigator.popUntil`; does NOT call `AuthController.logout()` or `StorageService.clearToken()`.
- **AI Coach LLM is stub** — `app/integrations/llm_client.py` returns hardcoded mock responses. Wire real OpenAI (or compatible) provider.

### Mobile
- Hardcoded `'default'` league ID in `MySquadScreen` and `AICoachChatScreen`
- `EditSquadScreen` and `LineupScreen` are placeholder text only
- `LeagueDetailScreen` standings section is placeholder
- `PlayerDetailScreen` fixtures section is placeholder
- `TransfersScreen` uses raw text field for player IDs (no picker)
- No error handling on API calls — unhandled exceptions crash the app
- `app_router.dart` exists but unused; all navigation is imperative
- No dark theme
- `shared_preferences` dependency installed but unused
- `notification_service.dart` is a stub

### Backend
- Alembic migrations may not be fully up to date with all models
- No Dockerfile in `apps/backend/` — docker-compose references `build: ./apps/backend` but no Dockerfile found
- No pagination on list endpoints
- No rate limiting
- CORS is open (`allow_origins=["*"]`)

---

## Conventions for contributors

### Backend
- Add new features as: model → schema → service → router
- All route handlers should be thin; business logic goes in services
- Protected endpoints use `user=Depends(get_current_user)`
- DB sessions via `db: Session = Depends(get_db)`
- IDs are UUID strings generated with `uuid.uuid4()`

### Mobile
- New features go in `lib/features/<name>/` with `presentation/`, `state/`, `data/` subdirs
- State: immutable state class + `StateNotifier` controller + provider
- Repositories handle Dio calls; controllers handle state transitions
- Use `ConsumerWidget` or `ConsumerStatefulWidget` for screens
- Shared widgets in `lib/widgets/`
- Models in `lib/models/` with `fromJson()` factory constructors

### Domain rules
- All leagues are **private** — join only via invite code
- Scoring rules defined in `app/services/scoring_service.py`
- Squad budget is tracked per squad; transfers check budget constraints
- Player positions: GK, DEF, MID, FWD
- Match statuses: scheduled, live, finished, postponed
