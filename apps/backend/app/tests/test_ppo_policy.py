"""Tests for PPO executor policy (Step 12)."""
import numpy as np
import pytest


def test_policy_creation():
    from app.rl.executor_policy import FantasyPolicy
    policy = FantasyPolicy()
    assert policy is not None


def test_policy_forward():
    from app.rl.executor_policy import FantasyPolicy
    from app.rl.environment import MAX_PLAYERS, FEATURE_DIM

    policy = FantasyPolicy()
    obs_dim = MAX_PLAYERS * FEATURE_DIM + 6
    obs = np.random.randn(obs_dim).astype(np.float32)
    action_logits = policy.forward(obs)
    assert action_logits.shape == (MAX_PLAYERS,)


def test_policy_select_action():
    from app.rl.executor_policy import FantasyPolicy
    from app.rl.environment import MAX_PLAYERS, FEATURE_DIM

    policy = FantasyPolicy()
    obs_dim = MAX_PLAYERS * FEATURE_DIM + 6
    obs = np.random.randn(obs_dim).astype(np.float32)
    mask = np.ones(MAX_PLAYERS, dtype=bool)
    action = policy.select_action(obs, mask)
    assert 0 <= action < MAX_PLAYERS


def test_policy_masked_action():
    """With only one valid action, policy should select it."""
    from app.rl.executor_policy import FantasyPolicy
    from app.rl.environment import MAX_PLAYERS, FEATURE_DIM

    policy = FantasyPolicy()
    obs_dim = MAX_PLAYERS * FEATURE_DIM + 6
    obs = np.random.randn(obs_dim).astype(np.float32)
    mask = np.zeros(MAX_PLAYERS, dtype=bool)
    mask[42] = True  # only player 42 is valid
    action = policy.select_action(obs, mask)
    assert action == 42


def test_policy_save_load(tmp_path):
    from app.rl.executor_policy import FantasyPolicy
    path = tmp_path / "test_policy.npz"

    policy = FantasyPolicy()
    policy.save(str(path))
    assert path.exists()

    policy2 = FantasyPolicy.load(str(path))
    assert policy2 is not None


def test_train_ppo_one_episode():
    """Train for 1 episode — should not crash."""
    from app.rl.train_ppo import train_one_episode
    from app.rl.executor_policy import FantasyPolicy
    from app.rl.environment import FantasyEnv

    env = FantasyEnv()
    policy = FantasyPolicy()
    total_reward = train_one_episode(env, policy, lr=0.001)
    assert isinstance(total_reward, float)
