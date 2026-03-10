"""
Generate synthetic training data for Qwen3-0.6B fine-tuning on fantasy football transfers.

Each sample is a (prompt, chosen, rejected) triple where:
  - prompt:   system message + user message (squad context + candidates)
  - chosen:   optimal 3 swaps — removes lowest-form players, picks highest-form candidates
  - rejected: poor 3 swaps — removes high-form players or ignores budget/position rules

The format matches exactly what llmInference.ts sends at inference time, so the model
learns the correct reasoning pattern for the actual task.

Output: training/data/grpo_dataset.jsonl

Run locally or on Colab:
    python training/synthetic_dataset.py --samples 5000
"""
import json
import random
from pathlib import Path

POSITIONS = ["GK", "DEF", "MID", "FWD"]
SQUAD_SHAPE = {"GK": 2, "DEF": 5, "MID": 5, "FWD": 3}  # 15 players total
BUDGET = 100.0
PRICE_RANGE = {"GK": (4.0, 5.5), "DEF": (4.0, 6.5), "MID": (4.5, 8.5), "FWD": (5.5, 9.5)}

TEAMS = [
    "Brazil", "Germany", "France", "Argentina", "England", "Spain",
    "Portugal", "Netherlands", "Croatia", "Uruguay", "Japan", "Morocco",
    "USA", "Mexico", "Canada", "South Korea", "Senegal", "Switzerland",
]
FIRST = [
    "Luka", "Kylian", "Lionel", "Erling", "Vinicius", "Jude", "Bukayo",
    "Phil", "Bruno", "Kevin", "Thibaut", "Alisson", "Virgil", "Ruben",
    "Mohamed", "Son", "Harry", "Jamal", "Pedri", "Gavi", "Alphonso",
    "Achraf", "Josko", "Florian", "Joshua", "Marcus", "Declan", "Leroy",
]
LAST = [
    "Modric", "Mbappe", "Messi", "Haaland", "Junior", "Bellingham", "Saka",
    "Foden", "Fernandes", "De Bruyne", "Courtois", "Becker", "van Dijk",
    "Dias", "Salah", "Heung-min", "Kane", "Musiala", "Gonzalez", "Lopez",
    "Davies", "Hakimi", "Gvardiol", "Wirtz", "Kimmich", "Rashford", "Rice",
]


def rand_name() -> str:
    return f"{random.choice(FIRST)} {random.choice(LAST)}"


def generate_player(pos: str, idx: int) -> dict:
    lo, hi = PRICE_RANGE[pos]
    return {
        "id": f"p{idx:03d}",
        "name": rand_name(),
        "position": pos,
        "price": round(random.uniform(lo, hi), 1),
        "avg_form": round(random.uniform(1.0, 10.0), 1),
        "team_name": random.choice(TEAMS),
    }


def generate_squad() -> list[dict]:
    """Generate a valid 15-player squad."""
    players = []
    idx = 0
    for pos, count in SQUAD_SHAPE.items():
        for _ in range(count):
            players.append(generate_player(pos, idx))
            idx += 1
    return players


def generate_candidates(squad: list[dict], n: int = 30) -> list[dict]:
    """Generate candidate pool (players not in squad)."""
    candidates = []
    for i in range(n):
        pos = random.choice(POSITIONS)
        candidates.append(generate_player(pos, 1000 + i))
    return candidates


def format_context(squad: list[dict], candidates: list[dict], budget: float) -> str:
    """Format context exactly as llmInference.ts does."""
    lines = [f"Budget: £{budget:.1f}m", "\nSQUAD:"]
    for p in squad:
        lines.append(f"{p['name']} ({p['position']}) £{p['price']:.1f}m avg={p['avg_form']}")

    top_candidates = sorted(candidates, key=lambda p: p["avg_form"], reverse=True)[:15]
    lines.append("\nCANDIDATES:")
    for p in top_candidates:
        lines.append(f"{p['name']} ({p['position']}) £{p['price']:.1f}m avg={p['avg_form']} {p['team_name']}")

    return "\n".join(lines)


def optimal_swaps(squad: list[dict], candidates: list[dict], budget: float) -> list[dict] | None:
    """
    Find 3 optimal swaps: remove lowest-form squad players, bring in highest-form
    same-position candidates that fit the remaining budget.
    """
    sorted_squad = sorted(squad, key=lambda p: p["avg_form"])
    swaps = []
    used_budget = 0.0
    used_candidate_ids = set()

    for out_player in sorted_squad:
        if len(swaps) >= 3:
            break
        pos = out_player["position"]
        budget_available = budget - used_budget + out_player["price"]

        # Find best candidate of same position within budget
        best = None
        for c in sorted(candidates, key=lambda p: p["avg_form"], reverse=True):
            if c["id"] in used_candidate_ids:
                continue
            if c["position"] != pos:
                continue
            if c["avg_form"] <= out_player["avg_form"]:
                continue  # only bring in improvement
            if c["price"] > budget_available:
                continue
            best = c
            break

        if best is None:
            continue

        cost = best["price"] - out_player["price"]
        used_budget += cost
        used_candidate_ids.add(best["id"])
        swaps.append({
            "out_name": out_player["name"],
            "in_name": best["name"],
            "reason": f"{out_player['name']} form {out_player['avg_form']} → {best['name']} form {best['avg_form']}",
        })

    return swaps if len(swaps) == 3 else None


def random_swaps(squad: list[dict], candidates: list[dict]) -> list[dict]:
    """
    Generate deliberately bad swaps: remove high-form players, ignore position matching.
    """
    sorted_squad = sorted(squad, key=lambda p: p["avg_form"], reverse=True)  # remove BEST players
    swaps = []
    used_ids = set()

    for out_player in sorted_squad[:3]:
        # Pick a random candidate regardless of position
        pool = [c for c in candidates if c["id"] not in used_ids]
        if not pool:
            break
        c = random.choice(pool)
        used_ids.add(c["id"])
        swaps.append({
            "out_name": out_player["name"],
            "in_name": c["name"],
            "reason": "random swap",
        })

    return swaps


def format_chosen(swaps: list[dict], squad: list[dict], candidates: list[dict]) -> str:
    """Format chosen response with thinking trace + JSON."""
    out_players = {s["out_name"]: next(p for p in squad if p["name"] == s["out_name"]) for s in swaps}
    in_players = {s["in_name"]: next(p for p in candidates if p["name"] == s["in_name"]) for s in swaps}

    think_lines = ["Analysing squad for lowest-form players:"]
    for s in swaps:
        op = out_players[s["out_name"]]
        ip = in_players[s["in_name"]]
        think_lines.append(
            f"- {op['name']} ({op['position']}) form={op['avg_form']} → "
            f"{ip['name']} form={ip['avg_form']}, cost diff=£{ip['price']-op['price']:.1f}m"
        )
    think_lines.append("All swaps improve form and fit budget. Outputting JSON.")

    answer = json.dumps({
        "swaps": swaps,
        "summary": f"Replaced {len(swaps)} low-form players with higher-form alternatives.",
        "confidence": random.randint(70, 90),
    })

    return f"<think>\n{chr(10).join(think_lines)}\n</think>\n{answer}"


def format_rejected(swaps: list[dict]) -> str:
    """Format rejected response — no thinking, bad swaps."""
    answer = json.dumps({
        "swaps": swaps,
        "summary": "Made some transfer changes.",
        "confidence": random.randint(40, 60),
    })
    return answer  # no <think> trace, and swaps are suboptimal


def build_messages(system: str, user: str) -> str:
    """Format as Qwen3 chat template string for DPO prompt field."""
    return f"<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n"


SYSTEM_PROMPT = """You are an expert fantasy football transfer advisor for FIFA World Cup 2026.

Your job: analyse the current squad and suggest exactly 3 player swaps to maximise projected fantasy points.

EVALUATION CRITERIA (priority order):
1. Form: avg_form > 6 is good, < 4 is poor — target low-form players for removal
2. Value: prefer high form relative to price (form/price ratio)
3. Position: always swap like-for-like (DEF out → DEF in, MID out → MID in, etc.)
4. Budget: total (out_price - in_price) across all 3 swaps must be <= budget_remaining
5. Spread: avoid picking players from the same country as existing squad members

DECISION PROCESS:
- Step 1: Identify the 3 squad players with the lowest avg_form
- Step 2: For each, find the highest-form candidate of the same position
- Step 3: Verify the swap fits the budget; if not, pick next best candidate
- Step 4: Write a short concrete reason (mention form numbers)

Think inside <think>...</think> tags, then output ONLY valid JSON — no markdown, no extra text:
{"swaps":[{"out_name":"Name","in_name":"Name","reason":"short reason"},...],
"summary":"one sentence summary","confidence":75}"""


def generate_dataset(n_samples: int = 5000) -> list[dict]:
    dataset = []
    skipped = 0
    for i in range(n_samples + 500):  # overshoot to hit target
        if len(dataset) >= n_samples:
            break

        budget = round(random.uniform(2.0, 15.0), 1)  # realistic remaining budget
        squad = generate_squad()
        candidates = generate_candidates(squad, n=40)

        swaps = optimal_swaps(squad, candidates, budget)
        if swaps is None:
            skipped += 1
            continue

        bad_swaps = random_swaps(squad, candidates)
        if len(bad_swaps) < 3:
            skipped += 1
            continue

        user_msg = format_context(squad, candidates, budget)
        prompt = build_messages(SYSTEM_PROMPT, user_msg)

        dataset.append({
            "prompt": prompt,
            "chosen": format_chosen(swaps, squad, candidates),
            "rejected": format_rejected(bad_swaps),
        })

        if (len(dataset)) % 500 == 0 and len(dataset) > 0:
            print(f"  Generated {len(dataset)}/{n_samples} samples (skipped {skipped})...")

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

    print(f"Generating {args.samples} transfer-swap training samples...")
    dataset = generate_dataset(args.samples)

    with open(out_path, "w") as f:
        for item in dataset:
            f.write(json.dumps(item) + "\n")

    print(f"Saved {len(dataset)} samples to {out_path}")


if __name__ == "__main__":
    main()
