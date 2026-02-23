"""
Lightweight PPO training loop using pure NumPy.

For production training on Colab A100, use Stable-Baselines3 MaskablePPO
with the FantasyEnv directly. This module provides a minimal REINFORCE
(policy gradient) trainer for local development and quick iteration.

Usage:
    cd apps/backend
    source .venv/bin/activate
    PYTHONPATH=$(pwd) python -m app.rl.train_ppo --episodes 500 --output ../../models/rl_executor.npz
"""
from __future__ import annotations

import numpy as np

from app.rl.environment import FantasyEnv
from app.rl.executor_policy import FantasyPolicy


def train_one_episode(
    env: FantasyEnv,
    policy: FantasyPolicy,
    lr: float = 0.001,
    gamma: float = 0.99,
) -> float:
    """Run one episode and update policy weights via REINFORCE.

    Returns total episode reward.
    """
    obs, _ = env.reset()
    log_probs: list[float] = []
    rewards: list[float] = []
    obs_list: list[np.ndarray] = []
    actions: list[int] = []

    terminated = False
    while not terminated:
        mask = env.action_masks()
        probs = policy.action_probs(obs, mask)
        action = int(np.random.choice(len(probs), p=probs))

        obs_list.append(obs.copy())
        actions.append(action)
        log_probs.append(np.log(probs[action] + 1e-10))

        obs, reward, terminated, truncated, info = env.step(action)
        rewards.append(reward)

        if truncated:
            break

    total_reward = sum(rewards)

    # Compute discounted returns
    returns = []
    G = 0.0
    for r in reversed(rewards):
        G = r + gamma * G
        returns.insert(0, G)
    returns_arr = np.array(returns, dtype=np.float32)

    # Normalize returns
    if len(returns_arr) > 1:
        returns_arr = (returns_arr - returns_arr.mean()) / (returns_arr.std() + 1e-8)

    # Policy gradient update (REINFORCE)
    for t in range(len(obs_list)):
        obs_t = obs_list[t]
        action_t = actions[t]

        # Forward pass
        h = obs_t @ policy.w1 + policy.b1
        h_relu = np.maximum(h, 0)
        logits = h_relu @ policy.w2 + policy.b2

        # Masked softmax
        mask = env.action_masks() if t == 0 else np.ones(len(logits), dtype=bool)
        masked_logits = np.where(mask, logits, -1e9)
        shifted = masked_logits - masked_logits.max()
        exp = np.exp(shifted)
        probs = exp / (exp.sum() + 1e-10)

        # Gradient of log pi(a|s) w.r.t. logits (softmax cross-entropy gradient)
        grad_logits = -probs.copy()
        grad_logits[action_t] += 1.0
        grad_logits *= returns_arr[t]  # scale by advantage

        # Backprop through layer 2
        grad_w2 = np.outer(h_relu, grad_logits)
        grad_b2 = grad_logits

        # Backprop through ReLU + layer 1
        grad_h = (grad_logits @ policy.w2.T) * (h > 0).astype(np.float32)
        grad_w1 = np.outer(obs_t, grad_h)
        grad_b1 = grad_h

        # SGD update
        policy.w1 += lr * grad_w1
        policy.b1 += lr * grad_b1
        policy.w2 += lr * grad_w2
        policy.b2 += lr * grad_b2

    return float(total_reward)


def train(
    episodes: int = 500,
    lr: float = 0.001,
    gamma: float = 0.99,
    output_path: str | None = None,
    verbose: bool = True,
) -> FantasyPolicy:
    """Train the policy for N episodes."""
    env = FantasyEnv()
    policy = FantasyPolicy()

    best_reward = -float("inf")
    reward_history = []

    for ep in range(episodes):
        total_reward = train_one_episode(env, policy, lr=lr, gamma=gamma)
        reward_history.append(total_reward)

        if total_reward > best_reward:
            best_reward = total_reward

        if verbose and (ep + 1) % 50 == 0:
            avg = np.mean(reward_history[-50:])
            print(f"Episode {ep+1:4d} | Avg reward (last 50): {avg:.1f} | Best: {best_reward:.1f}")

    if output_path:
        policy.save(output_path)
        if verbose:
            print(f"Saved policy to {output_path}")

    return policy


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train Fantasy PPO policy")
    parser.add_argument("--episodes", type=int, default=500)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--output", type=str, default="../../models/rl_executor.npz")
    args = parser.parse_args()

    train(episodes=args.episodes, lr=args.lr, output_path=args.output)
