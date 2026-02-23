"""
RL Executor inference — uses trained FantasyPolicy to recommend squads.

Called by ai_coach_service to generate squad/lineup/transfer suggestions
based on the RL policy's learned evaluation of player combinations.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from app.models.player import Player
from app.models.team import Team
from app.rl.environment import (
    FEATURE_DIM,
    INITIAL_BUDGET,
    MAX_PLAYERS,
    MAX_PER_TEAM,
    POSITION_LIMITS,
    POS_TO_IDX,
    IDX_TO_POS,
    FantasyEnv,
)
from app.rl.executor_policy import FantasyPolicy
from app.services.feature_service import build_player_features

_policy: Optional[FantasyPolicy] = None


def _get_policy() -> FantasyPolicy:
    """Load the trained policy (lazy singleton)."""
    global _policy
    if _policy is not None:
        return _policy

    model_path = os.environ.get("RL_MODEL_PATH", "models/rl_executor.npz")
    if Path(model_path).exists():
        _policy = FantasyPolicy.load(model_path)
    else:
        # No trained model yet — use random initialization
        _policy = FantasyPolicy(seed=42)
    return _policy


def _build_pool_from_db(db: Session) -> tuple[np.ndarray, list[Player], np.ndarray]:
    """Build a player feature pool from the database.

    Returns (pool_array, player_list, team_id_array).
    """
    players = db.query(Player).filter(Player.is_active == True).all()  # noqa: E712

    # Map team IDs to integers
    teams = db.query(Team).all()
    team_idx_map = {t.id: i for i, t in enumerate(teams)}

    pool = np.zeros((MAX_PLAYERS, FEATURE_DIM), dtype=np.float32)
    team_ids = np.full(MAX_PLAYERS, -1, dtype=np.int64)
    player_list: list[Player] = []

    for i, p in enumerate(players[:MAX_PLAYERS]):
        features = build_player_features(p.id, db)
        if features is None:
            continue

        pool[i, 0] = POS_TO_IDX.get(p.position, 2)  # position
        pool[i, 1] = float(p.price)                   # price
        pool[i, 2] = features.get("avg_points", 0)    # avg points
        pool[i, 3] = features.get("total_goals", 0)   # goals
        pool[i, 4] = features.get("total_assists", 0) # assists
        pool[i, 5] = features.get("total_minutes", 0) / max(features.get("matches_played", 1), 1)  # avg minutes
        pool[i, 6] = features.get("total_saves", 0)   # saves
        pool[i, 7] = features.get("avg_points", 0)    # form (= avg_points for now)

        team_ids[i] = team_idx_map.get(p.team_id, -1)
        player_list.append(p)

    return pool, player_list, team_ids


def suggest_squad_rl(db: Session, budget: float = 100.0) -> dict:
    """Use the RL policy to recommend a 15-player squad.

    Returns dict with player_ids, captain_id, explanation.
    """
    pool, player_list, team_ids = _build_pool_from_db(db)
    policy = _get_policy()

    env = FantasyEnv(player_pool=pool, team_ids=team_ids)
    obs, _ = env.reset()
    env.budget_remaining = budget

    selected_indices: list[int] = []
    terminated = False

    while not terminated:
        mask = env.action_masks()
        if not mask.any():
            break
        action = policy.select_action(obs, mask)
        obs, reward, terminated, truncated, info = env.step(action)
        if action not in selected_indices and action < len(player_list):
            selected_indices.append(action)

    # Map indices back to player IDs
    selected_players = [player_list[i] for i in selected_indices if i < len(player_list)]
    player_ids = [p.id for p in selected_players]

    # Pick captain (highest avg_points among FWD/MID)
    captain_id = None
    best_score = -1
    for i in selected_indices:
        if i < len(player_list):
            p = player_list[i]
            score = float(pool[i, 2])  # avg_points
            if score > best_score and p.position in ("FWD", "MID"):
                best_score = score
                captain_id = p.id

    if captain_id is None and player_ids:
        captain_id = player_ids[0]

    return {
        "player_ids": player_ids,
        "captain_id": captain_id,
        "budget_remaining": round(env.budget_remaining, 1),
        "positions": {pos: sum(1 for i in selected_indices if i < len(player_list) and player_list[i].position == pos) for pos in ("GK", "DEF", "MID", "FWD")},
        "explanation": f"RL policy selected {len(player_ids)} players within £{budget}m budget. "
                       f"£{round(env.budget_remaining, 1)}m remaining.",
    }


def suggest_lineup_rl(db: Session, squad_player_ids: list[str]) -> dict:
    """Given a 15-player squad, pick the best starting XI + captain.

    Uses player features to rank — highest avg_points start.
    """
    players = db.query(Player).filter(Player.id.in_(squad_player_ids)).all()
    player_map = {p.id: p for p in players}

    # Build features for ranking
    scored = []
    for pid in squad_player_ids:
        features = build_player_features(pid, db)
        p = player_map.get(pid)
        if features and p:
            scored.append((pid, p.position, features.get("avg_points", 0)))

    # Sort by avg_points descending
    scored.sort(key=lambda x: x[2], reverse=True)

    # Pick starting XI respecting min formation: 1 GK, 3 DEF, 2 MID, 1 FWD
    starting = []
    bench = []
    pos_counts = {"GK": 0, "DEF": 0, "MID": 0, "FWD": 0}
    min_required = {"GK": 1, "DEF": 3, "MID": 2, "FWD": 1}

    # First pass: fill minimums
    remaining = list(scored)
    for pos in ("GK", "DEF", "MID", "FWD"):
        for item in remaining[:]:
            if item[1] == pos and pos_counts[pos] < min_required[pos]:
                starting.append(item[0])
                pos_counts[pos] += 1
                remaining.remove(item)

    # Fill remaining slots (11 - len(starting)) with best available
    for item in remaining:
        if len(starting) >= 11:
            bench.append(item[0])
        else:
            starting.append(item[0])
            pos_counts[item[1]] += 1

    # Captain = highest avg_points in starting
    captain_id = starting[0] if starting else None
    vice_captain_id = starting[1] if len(starting) > 1 else None

    return {
        "starting": starting,
        "bench": bench,
        "captain_id": captain_id,
        "vice_captain_id": vice_captain_id,
        "explanation": f"Lineup optimized by player form. Captain: {captain_id}.",
    }
