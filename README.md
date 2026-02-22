# WC26 Fantasy Friends

Friends-only FIFA World Cup 2026 fantasy football monorepo. Includes a Flutter mobile app (primary client) and a FastAPI backend with PostgreSQL. Uses API-Football for World Cup data and an LLM-powered AI Coach for squad, lineup, and transfer suggestions.

## What works in this MVP scaffold
- Auth flows, private leagues only (invite codes), squad creation/edit, lineup + captain, transfers endpoints.
- World Cup data model for teams/players/matches/rounds with basic scoring rules.
- AI Coach endpoints with pluggable LLM client (OpenAI-compatible).
- Flutter app skeleton with Riverpod, screens, repositories, and services wired to HTTP API.
- Docker Compose for Postgres + backend; scripts for seeding/syncing.

## Quick start (no Docker)
1) Copy envs  
```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
```

2) Start Postgres yourself (local instance) and set `DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/wc26` (or your values).

3) Backend (venv + run):  
```bash
cd apps/backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

4) Mobile app:  
```bash
cd apps/mobile
flutter pub get
flutter run  # Android emulator uses http://10.0.2.2:8000; iOS/web/desktop use http://localhost:8000
```

Optional: Docker Compose remains available if you prefer `docker compose up --build` for Postgres + backend.

Run Flutter app (requires Flutter installed):
```bash
cd apps/mobile
flutter pub get
flutter run
```

## Env vars
- `DATABASE_URL` (Postgres, matching docker-compose)
- `API_FOOTBALL_KEY`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `JWT_ALGORITHM` (default HS256)
- `WORLD_CUP_LEAGUE_ID`
- `WORLD_CUP_SEASON`

## Folder layout
See the repository tree for `apps/mobile` (Flutter) and `apps/backend` (FastAPI) plus infra and scripts. Backend code follows layers: models → schemas → services → routers; mobile code follows core/services/models/features with Riverpod controllers.

## Notes
- All leagues are private; joining requires invite code.
- Scoring rules are defined in `app/services/scoring_service.py`.
- AI Coach endpoints produce structured JSON; integrate your LLM provider in `app/integrations/llm_client.py`.

