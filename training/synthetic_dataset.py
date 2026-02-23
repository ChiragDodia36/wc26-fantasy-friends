"""
Generate synthetic training data for GRPO fine-tuning.

Each sample is a (prompt, chosen, rejected) triple where:
  - prompt: player stats context + squad constraints
  - chosen: optimal squad selection (high fantasy points)
  - rejected: suboptimal squad selection (random/low points)

Output: training/data/grpo_dataset.jsonl

Run on Colab or locally:
    python training/synthetic_dataset.py --samples 5000
"""
import json
import random
from pathlib import Path

# Position constraints
POSITIONS = {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}
BUDGET = 100.0
MAX_PER_TEAM = 2

# Synthetic player names
FIRST_NAMES = [
    "Luka", "Kylian", "Lionel", "Erling", "Vinicius", "Jude", "Bukayo",
    "Phil", "Bruno", "Kevin", "Rodri", "Thibaut", "Alisson", "Virgil",
    "Ruben", "Bernardo", "Mohamed", "Son", "Harry", "Jamal", "Florian",
    "Pedri", "Gavi", "Nico", "Joshua", "Alphonso", "Achraf", "Josko",
]
LAST_NAMES = [
    "Modric", "Mbappe", "Messi", "Haaland", "Junior", "Bellingham", "Saka",
    "Foden", "Fernandes", "De Bruyne", "Hernandez", "Courtois", "Becker",
    "van Dijk", "Dias", "Silva", "Salah", "Heung-min", "Kane", "Musiala",
    "Wirtz", "Gonzalez", "Lopez", "Williams", "Kimmich", "Davies", "Hakimi",
    "Gvardiol",
]
TEAMS = [
    "Brazil", "Germany", "France", "Argentina", "England", "Spain",
    "Portugal", "Netherlands", "Belgium", "Croatia", "Uruguay", "Japan",
    "Morocco", "USA", "Mexico", "Canada", "South Korea", "Senegal",
]
PRICE_BY_POS = {"GK": (4.0, 5.5), "DEF": (4.0, 6.5), "MID": (4.5, 8.0), "FWD": (5.5, 9.0)}


def generate_player_pool(n: int = 120) -> list[dict]:
    """Generate a random pool of players."""
    pool = []
    for i in range(n):
        pos = random.choice(list(POSITIONS.keys()))
        lo, hi = PRICE_BY_POS[pos]
        player = {
            "id": f"p{i:03d}",
            "name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            "team": random.choice(TEAMS),
            "position": pos,
            "price": round(random.uniform(lo, hi), 1),
            "avg_points": round(random.uniform(1, 9), 1),
            "form": round(random.uniform(0, 10), 1),
            "goals": random.randint(0, 8),
            "assists": random.randint(0, 6),
        }
        pool.append(player)
    return pool


def select_squad(pool: list[dict], strategy: str = "optimal") -> list[dict]:
    """Select a 15-player squad from the pool.

    strategy='optimal': pick highest avg_points per position slot
    strategy='random': pick randomly (for rejected samples)
    """
    squad = []
    pos_counts = {"GK": 0, "DEF": 0, "MID": 0, "FWD": 0}
    team_counts: dict[str, int] = {}
    budget = BUDGET

    if strategy == "optimal":
        candidates = sorted(pool, key=lambda p: p["avg_points"], reverse=True)
    else:
        candidates = random.sample(pool, len(pool))

    for p in candidates:
        if len(squad) >= 15:
            break
        if pos_counts[p["position"]] >= POSITIONS[p["position"]]:
            continue
        if p["price"] > budget:
            continue
        if team_counts.get(p["team"], 0) >= MAX_PER_TEAM:
            continue

        squad.append(p)
        pos_counts[p["position"]] += 1
        team_counts[p["team"]] = team_counts.get(p["team"], 0) + 1
        budget -= p["price"]

    return squad


def format_prompt(pool: list[dict]) -> str:
    """Format the player pool as a prompt context."""
    lines = ["Select a 15-player squad (2 GK, 5 DEF, 5 MID, 3 FWD) within £100m budget."]
    lines.append("Max 2 players from the same team.")
    lines.append("")
    lines.append("Available players:")
    for p in pool[:50]:  # Show top 50 for prompt length
        lines.append(
            f"  {p['id']} | {p['name']:25s} | {p['position']:3s} | £{p['price']:.1f}m | "
            f"Avg: {p['avg_points']:.1f} | Form: {p['form']:.1f} | {p['team']}"
        )
    return "\n".join(lines)


def format_response(squad: list[dict]) -> str:
    """Format a squad selection as a response."""
    total_cost = sum(p["price"] for p in squad)
    total_points = sum(p["avg_points"] for p in squad)
    lines = ["Selected squad:"]
    for p in squad:
        lines.append(f"  {p['id']} {p['name']:25s} {p['position']:3s} £{p['price']:.1f}m (avg {p['avg_points']:.1f})")
    lines.append(f"\nTotal cost: £{total_cost:.1f}m | Projected points: {total_points:.1f}")
    return "\n".join(lines)


def generate_dataset(n_samples: int = 5000) -> list[dict]:
    """Generate GRPO training dataset."""
    dataset = []
    for i in range(n_samples):
        pool = generate_player_pool(120)
        prompt = format_prompt(pool)
        chosen_squad = select_squad(pool, strategy="optimal")
        rejected_squad = select_squad(pool, strategy="random")

        if len(chosen_squad) < 15 or len(rejected_squad) < 15:
            continue

        dataset.append({
            "prompt": prompt,
            "chosen": format_response(chosen_squad),
            "rejected": format_response(rejected_squad),
        })

        if (i + 1) % 500 == 0:
            print(f"  Generated {i + 1}/{n_samples} samples...")

    return dataset


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=5000)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)
    out_path = Path(args.output) if args.output else out_dir / "grpo_dataset.jsonl"

    print(f"Generating {args.samples} GRPO training samples...")
    dataset = generate_dataset(args.samples)

    with open(out_path, "w") as f:
        for item in dataset:
            f.write(json.dumps(item) + "\n")

    print(f"Saved {len(dataset)} samples to {out_path}")


if __name__ == "__main__":
    main()
