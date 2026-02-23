"""
PPO executor policy — lightweight NumPy MLP for squad selection.

Architecture: obs → FC(hidden) → ReLU → FC(MAX_PLAYERS) → logits
Action selection uses masked softmax for constraint enforcement.

For production training on Colab A100, this can be replaced with a
PyTorch/SB3 policy. This NumPy version is used for local inference
and lightweight training.
"""
from __future__ import annotations

import numpy as np

from app.rl.environment import MAX_PLAYERS, FEATURE_DIM

OBS_DIM = MAX_PLAYERS * FEATURE_DIM + 6  # pool features + budget/pos/squad
HIDDEN_DIM = 128


def _xavier_init(fan_in: int, fan_out: int, rng: np.random.Generator) -> np.ndarray:
    limit = np.sqrt(6.0 / (fan_in + fan_out))
    return rng.uniform(-limit, limit, size=(fan_in, fan_out)).astype(np.float32)


class FantasyPolicy:
    """Two-layer MLP policy with masked action selection."""

    def __init__(self, hidden_dim: int = HIDDEN_DIM, seed: int | None = None):
        rng = np.random.default_rng(seed)
        self.w1 = _xavier_init(OBS_DIM, hidden_dim, rng)
        self.b1 = np.zeros(hidden_dim, dtype=np.float32)
        self.w2 = _xavier_init(hidden_dim, MAX_PLAYERS, rng)
        self.b2 = np.zeros(MAX_PLAYERS, dtype=np.float32)

    def forward(self, obs: np.ndarray) -> np.ndarray:
        """Forward pass: obs → logits (MAX_PLAYERS,)."""
        h = obs @ self.w1 + self.b1
        h = np.maximum(h, 0)  # ReLU
        logits = h @ self.w2 + self.b2
        return logits

    def select_action(self, obs: np.ndarray, mask: np.ndarray) -> int:
        """Select an action using masked softmax sampling."""
        logits = self.forward(obs)

        # Mask invalid actions with -inf
        masked_logits = np.where(mask, logits, -1e9)

        # Numerically stable softmax
        shifted = masked_logits - masked_logits.max()
        exp = np.exp(shifted)
        probs = exp / (exp.sum() + 1e-10)

        # Ensure probs are valid (mask might zero everything)
        if probs.sum() < 1e-8:
            # Fallback: pick first valid action
            valid = np.where(mask)[0]
            return int(valid[0]) if len(valid) > 0 else 0

        return int(np.random.choice(len(probs), p=probs))

    def action_probs(self, obs: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Return action probabilities (for training)."""
        logits = self.forward(obs)
        masked_logits = np.where(mask, logits, -1e9)
        shifted = masked_logits - masked_logits.max()
        exp = np.exp(shifted)
        probs = exp / (exp.sum() + 1e-10)
        return probs

    def save(self, path: str) -> None:
        np.savez(path, w1=self.w1, b1=self.b1, w2=self.w2, b2=self.b2)

    @classmethod
    def load(cls, path: str) -> FantasyPolicy:
        policy = cls.__new__(cls)
        data = np.load(path)
        policy.w1 = data["w1"]
        policy.b1 = data["b1"]
        policy.w2 = data["w2"]
        policy.b2 = data["b2"]
        return policy
