# WC26 Fantasy Friends — AI Manager Design
**Date:** 2026-02-22
**Status:** Approved

---

## Overview

Transform the WC26 Fantasy Friends app from a broken scaffold into a fully working fantasy football platform powered by an intelligent RL + LLM AI Manager. The agent acts as an optimal fantasy coach: picking squads, setting lineups, choosing captains, and recommending transfers — all backed by real player form data and a trained cognitive agent.

**Two-phase approach:**
- **Phase 1** — Revamp & stabilize the existing broken codebase (backend + mobile)
- **Phase 2** — Build the RL/LLM AI Manager on top of the stable foundation

---

## Phase 1: Revamp & Stabilize

### 1.1 Backend Fixes

| Issue | Fix |
|-------|-----|
| No Dockerfile | Add `apps/backend/Dockerfile` (Python 3.11 slim, uvicorn) |
| API-Football client is stub | Wire real HTTP calls in `api_football_client.py` |
| Background tasks are empty | Implement `sync_fixtures_task.py` + `sync_stats_task.py` |
| League standings empty | Implement `league_standings()` in `league_service.py` |
| No pagination | Add `skip`/`limit` params to player/match list endpoints |
| Alembic migrations stale | Regenerate migration to match all current models |
| Saves stat not scored | Add saves scoring rule in `scoring_service.py` |
| Transfer no budget check | Add budget validation in `transfers_service.py` |
| CORS open | Restrict to known origins in production config |

### 1.2 Mobile Fixes

| Issue | Fix |
|-------|-----|
| No auth gate | Check token on app startup in `main.dart`; redirect to `LoginScreen` if missing |
| Logout doesn't clear token | Call `StorageService.clearToken()` + `AuthController.logout()` in `SettingsScreen` |
| Hardcoded `'default'` league ID | Pass real `league_id` through navigation args in `MySquadScreen` + `AICoachChatScreen` |
| `EditSquadScreen` placeholder | Implement full player picker UI with budget/position constraints |
| `LineupScreen` placeholder | Implement drag-and-drop or tap-to-toggle starting XI screen |
| `LeagueDetailScreen` standings | Wire real standings API response |
| `TransfersScreen` raw text field | Replace with searchable player picker |
| No error handling | Wrap all Dio calls in try/catch, show SnackBar on failure |
| `PlayerDetailScreen` fixtures | Show upcoming fixtures from `/matches` endpoint |

---

## Phase 2: AI Manager Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   COGNITIVE LOOP                         │
│                                                          │
│  ┌──────────┐    ┌────────────────┐    ┌─────────────┐  │
│  │  DATA    │───▶│  QWEN3-4B      │───▶│  PPO        │  │
│  │  LAYER   │    │  PLANNER       │    │  EXECUTOR   │  │
│  │          │    │  (GRPO tuned)  │    │  (MLP net)  │  │
│  │ Nat team │    │                │    │             │  │
│  │ Dom form │    │  Tree of       │    │  Valid squad│  │
│  │ WC stats │    │  Thought 3-way │    │  + captain  │  │
│  └──────────┘    └───────┬────────┘    └──────┬──────┘  │
│                          │                    │          │
│                  ┌───────▼────────┐           │          │
│                  │  EPISODIC      │◀──────────┘          │
│                  │  MEMORY        │                      │
│                  │  (ChromaDB)    │◀──────────────────┐  │
│                  └────────────────┘                   │  │
│                                                       │  │
│                  ┌────────────────┐                   │  │
│                  │  REFLECTION    │───────────────────┘  │
│                  │  AGENT         │  (post-round)        │
│                  │  (Qwen3-4B)    │                      │
│                  └────────────────┘                      │
└─────────────────────────────────────────────────────────┘
         │
         ▼
   FastAPI /ai/* endpoints → Flutter mobile app
```

**Per-round cognitive loop:**
1. **Observe** — fetch player form, fixtures, current squad state
2. **ToT Reason** — Planner generates 3 branches (safe / differential / fixture-based), scores each
3. **Plan** — Planner outputs ranked player list + captain rationale
4. **Execute** — PPO Executor picks valid optimal squad within all constraints
5. **Respond** — Return recommendation + explanation to Flutter app
6. **Reflect** (post-round) — Reflection Agent writes lesson to ChromaDB memory

---

### 2.2 Data Pipeline

**Sources:**
- **API-Football v3** — national team matches (friendlies, qualifiers, Nations League, WC), domestic last-5 stats, fixture schedule, injury/suspension flags
- **WC26 live stats** — ingested via background `sync_stats_task` every 5 minutes during live matches

**Features engineered per player:**
```
position          (one-hot: GK/DEF/MID/FWD)
price             (normalized 0-1)
national_form     last 5 national team matches: [goals, assists, minutes, cards] × 5
domestic_form     last 5 club matches: same stats
fdr_next_3        Fixture Difficulty Rating for next 3 matches (1-5 scale)
is_injured        binary flag
ownership_pct     % of managers who own this player (differential signal)
wc_cumulative     running WC tournament totals (goals, assists, points)
```

**Fixture Difficulty Rating (FDR):**
- Calculated from opponent's defensive/offensive strength (goals conceded/scored per game)
- FDR 1 = easiest, 5 = hardest
- Stored in DB, updated each round

**New files:**
- `apps/backend/app/services/feature_service.py` — builds player feature vectors
- `apps/backend/app/services/fdr_service.py` — computes FDR per fixture
- `apps/backend/app/models/player_form.py` — caches computed form snapshots

---

### 2.3 RL Executor (PPO)

**What it does:** Takes the planner's ranked player list and constraints, outputs the optimal valid 15-player squad + starting XI + captain/vice-captain.

**State space (per player, ~500 players):**
```python
state = {
  "player_features": np.array[500, 18],  # 18 features per player
  "budget_remaining": float,
  "position_slots": dict,               # {"GK": 2, "DEF": 5, ...}
  "team_counts": dict,                  # nations already selected
  "current_round": int,
  "planner_scores": np.array[500],      # LLM planner's ranking signal
}
```

**Action space:**
- Squad selection: 15 binary choices constrained by position/budget/team limits
- Starting XI: 11 of 15 (binary)
- Captain: 1 of 15 (discrete)
- Vice-captain: 1 of 14 (discrete)

**Reward function:**
```
R = 0.5 × fantasy_points_this_round
  + 0.2 × (rank_improvement / league_size)
  + 0.2 × captain_accuracy_bonus    # +1 if captain was top scorer in squad
  + 0.1 × consistency_bonus         # rolling 3-round average improvement
```

**Training:**
- Environment: Simulated fantasy rounds using historical API-Football data
- Algorithm: PPO (stable-baselines3), ~1000 simulated episodes
- Training data: Past World Cups (2018, 2022), Euro 2020/2024
- Output: `rl_executor.pth` (~50MB) pushed to HuggingFace

**New files:**
- `apps/backend/app/rl/environment.py` — Gym-compatible fantasy environment
- `apps/backend/app/rl/executor_policy.py` — MLP policy network
- `apps/backend/app/rl/train_ppo.py` — training script (runs on Colab A100)
- `apps/backend/app/rl/inference.py` — loads trained policy for FastAPI

---

### 2.4 LLM Planner (Qwen3-4B, GRPO Fine-tuned)

**Model:** `Qwen/Qwen3-4B` base → fine-tuned with GRPO via LoRA

**What it does:**
- Reasons about player form, fixtures, injury risk, captain strategy
- Uses Tree of Thought: generates 3 reasoning branches per major decision
- Retrieves relevant past decisions from ChromaDB episodic memory
- Outputs: ranked player scores + captain recommendation + explanation text

**Tree of Thought (3 branches per decision):**
```
Branch A — "Safe Pick":    highest consistency last 5 games, low injury risk
Branch B — "Differential": under-owned player, high ceiling, good fixture
Branch C — "Fixture Play":  best FDR in next match, likely to clean sheet or score
→ Score each branch using PPO value estimates → select winner → synthesize
```

**GRPO Fine-tuning (Colab A100):**
- Base: `Qwen/Qwen3-4B`
- Method: LoRA (r=16, α=32, target: q_proj, v_proj)
- Dataset: Synthetic fantasy decision scenarios + historical tournament outcomes
- GRPO: K=8 samples per prompt, reward = fantasy points of recommended squad
- Estimated: ~10-15 A100 hours (~30-50 compute units)
- Output: LoRA adapter pushed to `huggingface/{username}/wc26-fantasy-planner`

**Episodic Memory (ChromaDB):**
```python
memory_entry = {
  "round": int,
  "decision_type": "captain" | "transfer" | "squad",
  "context_embedding": vector,    # player features at decision time
  "decision": dict,               # what was recommended
  "outcome_points": int,          # actual points scored
  "lesson": str,                  # reflection agent's written lesson
}
```
- Retrieved by cosine similarity of current context vs. past contexts
- Top-3 relevant memories injected into planner system prompt

**New files:**
- `apps/backend/app/integrations/llm_client.py` — replace stub with MLX inference
- `apps/backend/app/integrations/memory_client.py` — ChromaDB wrapper
- `apps/backend/app/integrations/planner.py` — ToT orchestration
- `training/grpo_finetune.py` — GRPO training script for Colab
- `training/synthetic_dataset.py` — generates fantasy scenario training data

---

### 2.5 Reflection Agent

Runs **post-round** (triggered by background task after all match stats are synced):

1. Load round's decisions from DB
2. Compare recommended squad vs. optimal squad in hindsight
3. Identify: wrong captain? missed differential? bad transfer?
4. Write structured lesson to ChromaDB
5. Update player form cache

**Prompt template:**
```
You recommended [player X] as captain in round [N].
They scored [Y] points. The best captain choice was [player Z] with [W] points.
Context: [fixture, form, FDR at decision time].
Write a lesson for future decisions.
```

**New file:** `apps/backend/app/services/reflection_service.py`

---

### 2.6 Backend Integration

**Replace** `apps/backend/app/integrations/llm_client.py` stub with real cognitive loop.

**New AI service architecture:**
```
ai_router.py
  └── ai_coach_service.py          (orchestrator)
        ├── feature_service.py     (build player features)
        ├── planner.py             (Qwen3-4B ToT + memory retrieval)
        ├── rl/inference.py        (PPO executor)
        └── memory_client.py      (ChromaDB read/write)
```

**New endpoint additions:**
```
GET /ai/agent-status              → model loaded, memory size, last reflection
POST /ai/reflect                  → trigger manual reflection (admin use)
GET /players/{id}/form            → player form snapshot for UI
```

---

### 2.7 Flutter App — Full Redesign

The Flutter app is being **fully redesigned** from scratch (keeping the same `apps/mobile/` directory and Dart/Riverpod/Dio stack). All existing screens are rebuilt with a modern, polished UI.

**Design principles:**
- Dark football-themed UI (deep navy + gold accents)
- Animated squad pitch view for lineup selection
- AI recommendations surfaced inline with confidence %
- Smooth Riverpod state transitions, no crashes

**Screen redesign list:**

| Screen | Key features |
|--------|-------------|
| `SplashScreen` | Token check on startup → LoginScreen or MainShell |
| `LoginScreen` / `SignupScreen` | Clean auth flow, proper error states |
| `MainShell` | Bottom nav: Squad / Leagues / Matches / AI Coach |
| `MySquadScreen` | Animated pitch, tap player to view stats, AI badge on captain |
| `EditSquadScreen` | Filterable player picker (position/price/team), budget tracker |
| `LineupScreen` | Drag-to-position or tap-to-toggle starting XI |
| `TransfersScreen` | Searchable player picker; AI transfer cards with point projections |
| `LeaguesScreen` | League cards with standings preview |
| `LeagueDetailScreen` | Full standings table, invite code share button |
| `MatchesScreen` | Live scores, fixture calendar, round selector |
| `PlayerDetailScreen` | Form chart (last 5), FDR indicator, stats breakdown |
| `AICoachScreen` | Chat + ToT branch cards (Safe / Differential / Fixture) expandable |
| `SettingsScreen` | Logout (clears token), profile, preferences |

**New shared widgets:**
- `lib/widgets/ai_insight_panel.dart` — player card with AI score + reasoning
- `lib/widgets/form_chart.dart` — last-5 sparkline chart
- `lib/widgets/fdr_badge.dart` — colour-coded fixture difficulty
- `lib/widgets/pitch_view.dart` — animated 11-player pitch formation view

**New models:**
- `lib/models/player_form_model.dart`
- `lib/models/ai_branch_model.dart` — ToT branch with explanation + confidence

---

### 2.8 Training & Deployment Pipeline

```
1. Collect data
   └── scripts/collect_training_data.py
       API-Football → WC 2018/2022/Euro 2020/2024 player stats → CSV

2. Train PPO executor
   └── apps/backend/app/rl/train_ppo.py
       Run on Colab A100 (~5 hours) → rl_executor.pth

3. Generate fine-tuning dataset
   └── training/synthetic_dataset.py
       1000 fantasy scenarios with rewards

4. GRPO fine-tune Qwen3-4B
   └── training/grpo_finetune.py
       Run on Colab A100 (~12 hours) → LoRA adapter

5. Push to HuggingFace
   └── huggingface-cli upload {username}/wc26-fantasy-planner
   └── huggingface-cli upload {username}/wc26-rl-executor

6. Deploy locally (M4 Air 16GB)
   └── MLX-LM loads Qwen3-4B Q4 + LoRA adapter (~2.5GB)
   └── PyTorch MPS loads rl_executor.pth (~50MB)
   └── ChromaDB runs locally (~500MB)
   └── FastAPI serves on port 8000
   └── Total active memory: ~3.5GB ✓
```

---

### 2.9 Tech Stack Additions

| Component | Library | Notes |
|-----------|---------|-------|
| LLM inference | `mlx-lm` | Apple MLX, optimized for M4 |
| RL training | `stable-baselines3` + `gymnasium` | PPO, runs on Colab A100 |
| Episodic memory | `chromadb` | Local vector DB |
| Embeddings | `sentence-transformers` | For memory retrieval |
| Fine-tuning | `trl` (HuggingFace) | GRPO + LoRA support |
| Data collection | `httpx` + `pandas` | API-Football → CSV |

Add to `apps/backend/pyproject.toml`:
```
mlx-lm, chromadb, sentence-transformers, stable-baselines3, gymnasium, trl, pandas
```

---

## Verification

### Phase 1
- `pytest apps/backend/tests/` — all tests pass
- `docker compose up --build` — services start without errors
- Flutter app: login → view squad → edit lineup → make transfer → logout → token cleared

### Phase 2
- `POST /ai/squad-builder` returns valid 15-player squad within budget + position constraints
- `POST /ai/lineup` returns 11 starters + captain with ToT reasoning in explanation
- `POST /ai/transfers` returns ranked transfer suggestions with point projections
- Memory: after simulating 3 rounds, ChromaDB has reflection entries
- M4 Air: full inference cycle (feature fetch → plan → execute) completes in <10 seconds
- Colab: PPO training converges (mean reward improves over 500 episodes)
