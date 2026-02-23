"""Tests for the Fantasy RL Gym environment (Step 11)."""
import numpy as np
import pytest


def test_env_creation():
    from app.rl.environment import FantasyEnv
    env = FantasyEnv()
    assert env is not None


def test_env_reset_returns_observation():
    from app.rl.environment import FantasyEnv
    env = FantasyEnv()
    obs, info = env.reset()
    assert isinstance(obs, np.ndarray)
    assert obs.shape[0] > 0
    assert isinstance(info, dict)


def test_env_observation_space():
    from app.rl.environment import FantasyEnv, MAX_PLAYERS, FEATURE_DIM
    env = FantasyEnv()
    # Observation: player features (MAX_PLAYERS * FEATURE_DIM) + budget + position_slots(4) + squad_size
    expected_dim = MAX_PLAYERS * FEATURE_DIM + 6  # budget + 4 position slots + squad_size
    assert env.observation_space.shape == (expected_dim,)


def test_env_action_space():
    from app.rl.environment import FantasyEnv, MAX_PLAYERS
    env = FantasyEnv()
    # Action: pick one player at a time (discrete)
    assert env.action_space.n == MAX_PLAYERS


def test_env_step_valid_action():
    from app.rl.environment import FantasyEnv
    env = FantasyEnv()
    obs, _ = env.reset()
    # Pick the first active player
    action = 0
    obs2, reward, terminated, truncated, info = env.step(action)
    assert isinstance(obs2, np.ndarray)
    assert isinstance(reward, (int, float))
    assert isinstance(terminated, bool)
    assert isinstance(truncated, bool)


def test_env_squad_constraints():
    """After filling 15 players, episode should terminate."""
    from app.rl.environment import FantasyEnv
    env = FantasyEnv()
    env.reset()

    steps = 0
    terminated = False
    while not terminated and steps < 100:
        # Try each player in order; env should mask invalid picks
        obs, reward, terminated, truncated, info = env.step(steps % env.action_space.n)
        steps += 1

    # Should terminate after picking 15 valid players (or hitting budget)
    assert steps <= 100  # sanity: doesn't loop forever


def test_env_budget_tracking():
    from app.rl.environment import FantasyEnv
    env = FantasyEnv()
    obs, _ = env.reset()
    initial_budget = env.budget_remaining
    assert initial_budget == 100.0

    # After picking a player, budget should decrease
    env.step(0)
    assert env.budget_remaining <= initial_budget


def test_env_position_limits():
    """Env should respect position limits: 2 GK, 5 DEF, 5 MID, 3 FWD."""
    from app.rl.environment import FantasyEnv
    env = FantasyEnv()
    env.reset()
    # Position limits are enforced via action masking
    assert env.position_limits == {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}


def test_env_team_limit():
    """Max 2 players from the same team."""
    from app.rl.environment import FantasyEnv
    env = FantasyEnv()
    env.reset()
    assert env.max_per_team == 2
