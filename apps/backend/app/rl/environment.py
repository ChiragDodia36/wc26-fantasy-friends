"""
Fantasy WC26 RL Environment — Gymnasium-compatible.

State:  player feature matrix (flattened) + budget + position slot counts + squad size
Action: pick one player (discrete 0..MAX_PLAYERS-1)
Reward: fantasy points of the selected squad after a simulated round

Constraint masking: invalid actions (over budget, wrong position, too many
from same team) are masked via the `action_masks()` method, compatible with
Stable-Baselines3 MaskablePPO.
"""
import numpy as np
import gymnasium as gym
from gymnasium import spaces

MAX_PLAYERS = 200  # padded pool size (actual count may be less)
FEATURE_DIM = 8    # features per player

# Position limits for a 15-player squad
POSITION_LIMITS = {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}
SQUAD_SIZE = 15
MAX_PER_TEAM = 2
INITIAL_BUDGET = 100.0

# Position encoding
POS_TO_IDX = {"GK": 0, "DEF": 1, "MID": 2, "FWD": 3}
IDX_TO_POS = {v: k for k, v in POS_TO_IDX.items()}


def _generate_random_pool(n: int = MAX_PLAYERS) -> np.ndarray:
    """Generate a random player pool for training.

    Each player: [position_idx, price, avg_points, goals, assists, minutes, saves, form]
    """
    rng = np.random.default_rng()
    pool = np.zeros((n, FEATURE_DIM), dtype=np.float32)

    positions = rng.choice(4, size=n, p=[0.13, 0.33, 0.33, 0.21])  # realistic distribution
    pool[:, 0] = positions

    # Price by position
    base_prices = {0: 4.5, 1: 5.0, 2: 5.5, 3: 6.5}
    for i in range(n):
        pos = int(positions[i])
        pool[i, 1] = base_prices[pos] + rng.uniform(-0.5, 1.5)  # price
        pool[i, 2] = rng.uniform(1, 8)   # avg_points
        pool[i, 3] = rng.integers(0, 5)  # goals
        pool[i, 4] = rng.integers(0, 5)  # assists
        pool[i, 5] = rng.uniform(0, 90)  # avg minutes
        pool[i, 6] = rng.integers(0, 5) if pos == 0 else 0  # saves (GK only)
        pool[i, 7] = rng.uniform(0, 10)  # form score

    return pool


def _generate_team_ids(n: int = MAX_PLAYERS, n_teams: int = 48) -> np.ndarray:
    """Assign each player to a random team (0..n_teams-1)."""
    rng = np.random.default_rng()
    return rng.integers(0, n_teams, size=n)


class FantasyEnv(gym.Env):
    """Fantasy football squad selection environment."""

    metadata = {"render_modes": []}

    def __init__(self, player_pool: np.ndarray | None = None,
                 team_ids: np.ndarray | None = None):
        super().__init__()

        self.player_pool = player_pool if player_pool is not None else _generate_random_pool()
        self.team_ids = team_ids if team_ids is not None else _generate_team_ids(len(self.player_pool))
        self.n_players = len(self.player_pool)

        # Pad to MAX_PLAYERS if needed
        if self.n_players < MAX_PLAYERS:
            pad = np.zeros((MAX_PLAYERS - self.n_players, FEATURE_DIM), dtype=np.float32)
            self.player_pool = np.vstack([self.player_pool, pad])
            self.team_ids = np.concatenate([
                self.team_ids,
                np.full(MAX_PLAYERS - self.n_players, -1, dtype=np.int64),
            ])

        # Spaces
        obs_dim = MAX_PLAYERS * FEATURE_DIM + 6  # + budget + 4 pos slots + squad_size
        self.observation_space = spaces.Box(
            low=-np.inf, high=np.inf, shape=(obs_dim,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(MAX_PLAYERS)

        # Constraints
        self.position_limits = dict(POSITION_LIMITS)
        self.max_per_team = MAX_PER_TEAM

        # State (set in reset)
        self.budget_remaining = INITIAL_BUDGET
        self.squad: list[int] = []
        self.position_counts = {"GK": 0, "DEF": 0, "MID": 0, "FWD": 0}
        self.team_counts: dict[int, int] = {}

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.budget_remaining = INITIAL_BUDGET
        self.squad = []
        self.position_counts = {"GK": 0, "DEF": 0, "MID": 0, "FWD": 0}
        self.team_counts = {}
        return self._get_obs(), {}

    def step(self, action: int):
        assert self.action_space.contains(action), f"Invalid action {action}"

        reward = 0.0
        terminated = False
        truncated = False
        info = {}

        # Check if action is valid
        if not self._is_valid_pick(action):
            # Invalid pick: small penalty, don't add to squad
            reward = -1.0
            info["invalid_pick"] = True
        else:
            # Add player to squad
            self.squad.append(action)
            player = self.player_pool[action]
            pos_idx = int(player[0])
            pos = IDX_TO_POS.get(pos_idx, "MID")
            price = float(player[1])

            self.budget_remaining -= price
            self.position_counts[pos] = self.position_counts.get(pos, 0) + 1

            team_id = int(self.team_ids[action])
            self.team_counts[team_id] = self.team_counts.get(team_id, 0) + 1

            # Small reward for picking — proportional to player quality
            reward = float(player[2]) * 0.1  # avg_points * 0.1

        # Check if squad is complete
        if len(self.squad) >= SQUAD_SIZE:
            terminated = True
            # Final reward: sum of avg_points for entire squad
            total_points = sum(float(self.player_pool[pid][2]) for pid in self.squad)
            reward += total_points
            info["squad_points"] = total_points
            info["budget_remaining"] = self.budget_remaining

        # Check if no valid picks remain (budget too low, all positions filled)
        elif not any(self._is_valid_pick(i) for i in range(self.n_players)):
            terminated = True
            # Incomplete squad penalty
            reward -= 10.0 * (SQUAD_SIZE - len(self.squad))
            info["incomplete_squad"] = True

        return self._get_obs(), reward, terminated, truncated, info

    def action_masks(self) -> np.ndarray:
        """Return boolean mask of valid actions (for MaskablePPO)."""
        mask = np.zeros(MAX_PLAYERS, dtype=bool)
        for i in range(self.n_players):
            mask[i] = self._is_valid_pick(i)
        return mask

    def _is_valid_pick(self, action: int) -> bool:
        """Check if picking player `action` is valid."""
        if action >= self.n_players:
            return False
        if action in self.squad:
            return False  # already picked

        player = self.player_pool[action]
        pos_idx = int(player[0])
        pos = IDX_TO_POS.get(pos_idx, "MID")
        price = float(player[1])

        # Budget check
        if price > self.budget_remaining:
            return False

        # Position limit check
        if self.position_counts.get(pos, 0) >= self.position_limits.get(pos, 0):
            return False

        # Team limit check
        team_id = int(self.team_ids[action])
        if team_id >= 0 and self.team_counts.get(team_id, 0) >= self.max_per_team:
            return False

        return True

    def _get_obs(self) -> np.ndarray:
        """Build flat observation vector."""
        flat_pool = self.player_pool.flatten()  # MAX_PLAYERS * FEATURE_DIM

        extras = np.array([
            self.budget_remaining,
            self.position_counts.get("GK", 0),
            self.position_counts.get("DEF", 0),
            self.position_counts.get("MID", 0),
            self.position_counts.get("FWD", 0),
            len(self.squad),
        ], dtype=np.float32)

        return np.concatenate([flat_pool, extras])
