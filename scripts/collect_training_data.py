"""
Training data collection — downloads open-source football datasets and builds
RL training episodes for the fantasy WC26 AI manager.

Sources:
  1. vaastav/Fantasy-Premier-League — FPL gameweek data (2016–2025)
  2. jfjelstul/worldcup — All WC tournaments 1930–2022 player stats
  3. StatsBomb open data — WC 2022 event-level JSON

Output (all under data/):
  - fpl_gameweeks.csv          — FPL per-player per-GW stats
  - historical_player_stats.csv — merged WC player stats with fantasy scoring
  - historical_match_results.csv — WC match outcomes for FDR computation
  - training_episodes.pkl       — pre-built RL episodes (state → reward)

Run:
    cd apps/backend
    source .venv/bin/activate
    python ../../scripts/collect_training_data.py
"""
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# ── Scoring rules (mirror scoring_service.py) ──────────────────────

GOAL_PTS = {"GK": 6, "DEF": 6, "MID": 5, "FWD": 4}
FPL_POS_MAP = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}


def compute_fantasy_points(row: dict, position: str) -> int:
    """Compute WC26-style fantasy points from raw stats."""
    pts = 0
    minutes = row.get("minutes", 0)
    if minutes >= 1:
        pts += 1
    if minutes >= 60:
        pts += 1

    goals = row.get("goals_scored", row.get("goals", 0))
    pts += goals * GOAL_PTS.get(position, 4)
    pts += row.get("assists", 0) * 3

    if row.get("clean_sheets", row.get("clean_sheet", 0)) and minutes >= 60:
        if position in ("GK", "DEF"):
            pts += 4
        elif position == "MID":
            pts += 1

    if position in ("GK", "DEF"):
        gc = row.get("goals_conceded", 0)
        pts -= gc // 2

    if position == "GK":
        pts += row.get("saves", 0) // 3

    pts += row.get("penalties_scored", 0) * 3
    pts -= row.get("penalties_missed", 0) * 2
    pts -= row.get("yellow_cards", 0)
    pts -= row.get("red_cards", 0) * 3
    pts -= row.get("own_goals", 0) * 2

    return pts


# ── 1. FPL Dataset ─────────────────────────────────────────────────

def collect_fpl():
    """Download vaastav FPL dataset and extract gameweek CSVs."""
    fpl_dir = DATA_DIR / "fpl"
    if fpl_dir.exists() and (fpl_dir / "README.md").exists():
        print("[FPL] Already cloned, skipping.")
    else:
        print("[FPL] Cloning vaastav/Fantasy-Premier-League (sparse — latest season only)...")
        subprocess.run(
            ["git", "clone", "--depth", "1",
             "https://github.com/vaastav/Fantasy-Premier-League.git",
             str(fpl_dir)],
            check=True, capture_output=True,
        )
        print("[FPL] Cloned.")

    # Find the latest season's merged_gw.csv
    merged_files = sorted(fpl_dir.glob("data/*/gws/merged_gw.csv"))
    if not merged_files:
        print("[FPL] WARNING: No merged_gw.csv found. Try a full clone.")
        return None

    print(f"[FPL] Found {len(merged_files)} seasons of gameweek data.")

    frames = []
    for f in merged_files:
        season = f.parts[-3]  # e.g. "2024-25"
        try:
            df = pd.read_csv(f, encoding="utf-8", on_bad_lines="skip")
            df["season"] = season
            frames.append(df)
        except Exception as e:
            print(f"[FPL] Skipping {season}: {e}")

    if not frames:
        return None

    combined = pd.concat(frames, ignore_index=True)
    out_path = DATA_DIR / "fpl_gameweeks.csv"
    combined.to_csv(out_path, index=False)
    print(f"[FPL] Saved {len(combined)} rows to {out_path}")
    return combined


# ── 2. World Cup historical data ──────────────────────────────────

def collect_worldcup():
    """Download jfjelstul/worldcup dataset."""
    wc_dir = DATA_DIR / "worldcup"
    if wc_dir.exists() and (wc_dir / "README.md").exists():
        print("[WC] Already cloned, skipping.")
    else:
        print("[WC] Cloning jfjelstul/worldcup...")
        subprocess.run(
            ["git", "clone", "--depth", "1",
             "https://github.com/jfjelstul/worldcup.git",
             str(wc_dir)],
            check=True, capture_output=True,
        )
        print("[WC] Cloned.")

    # Load player-level appearances
    player_apps = wc_dir / "data" / "player_appearances.csv"
    if not player_apps.exists():
        print("[WC] WARNING: player_appearances.csv not found.")
        return None, None

    players = pd.read_csv(player_apps)
    print(f"[WC] Loaded {len(players)} player appearance records.")

    # Load match results
    matches_path = wc_dir / "data" / "matches.csv"
    matches = pd.read_csv(matches_path) if matches_path.exists() else pd.DataFrame()
    if not matches.empty:
        out_matches = DATA_DIR / "historical_match_results.csv"
        matches.to_csv(out_matches, index=False)
        print(f"[WC] Saved {len(matches)} match results to {out_matches}")

    return players, matches


# ── 3. Build training episodes ────────────────────────────────────

def build_player_stats(wc_players: pd.DataFrame) -> pd.DataFrame:
    """Aggregate WC player appearances into per-tournament stats with fantasy points."""
    if wc_players is None or wc_players.empty:
        return pd.DataFrame()

    # Map position names
    pos_map = {
        "goalkeeper": "GK", "goalie": "GK",
        "defender": "DEF", "defence": "DEF",
        "midfielder": "MID", "midfield": "MID",
        "forward": "FWD", "attacker": "FWD",
    }

    if "position" in wc_players.columns:
        wc_players["position_mapped"] = (
            wc_players["position"].str.lower().map(pos_map).fillna("MID")
        )
    else:
        wc_players["position_mapped"] = "MID"

    # Compute fantasy points per appearance
    records = []
    for _, row in wc_players.iterrows():
        r = row.to_dict()
        pos = r.get("position_mapped", "MID")
        pts = compute_fantasy_points(r, pos)
        r["fantasy_points"] = pts
        records.append(r)

    df = pd.DataFrame(records)
    out_path = DATA_DIR / "historical_player_stats.csv"
    df.to_csv(out_path, index=False)
    print(f"[Stats] Saved {len(df)} player-match records to {out_path}")
    return df


def build_training_episodes(player_stats: pd.DataFrame):
    """Build RL training episodes: each episode is one tournament round.

    Episode format: {
        'round_id': str,
        'player_features': list of dicts (player_id, position, goals, assists, ...),
        'rewards': list of floats (fantasy points per player),
    }
    """
    import pickle

    if player_stats.empty:
        print("[Episodes] No player stats to build episodes from.")
        return

    # Group by tournament + stage/round
    group_cols = []
    for col in ["tournament_id", "tournament_name", "stage_name", "match_id"]:
        if col in player_stats.columns:
            group_cols.append(col)

    if not group_cols:
        group_cols = ["match_id"] if "match_id" in player_stats.columns else []

    if not group_cols:
        print("[Episodes] Cannot group episodes — no round/match columns found.")
        return

    episodes = []
    for group_key, group in player_stats.groupby(group_cols):
        episode = {
            "round_id": str(group_key),
            "player_features": [],
            "rewards": [],
        }
        for _, row in group.iterrows():
            episode["player_features"].append({
                "name": row.get("player_name", row.get("name", "Unknown")),
                "position": row.get("position_mapped", "MID"),
                "goals": row.get("goals_scored", row.get("goals", 0)),
                "assists": row.get("assists", 0),
                "minutes": row.get("minutes", row.get("minutes_played", 0)),
            })
            episode["rewards"].append(row.get("fantasy_points", 0))
        episodes.append(episode)

    out_path = DATA_DIR / "training_episodes.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(episodes, f)
    print(f"[Episodes] Saved {len(episodes)} training episodes to {out_path}")


# ── Main ──────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("WC26 Fantasy Friends — Training Data Collection")
    print("=" * 60)

    # 1. FPL
    fpl_df = collect_fpl()

    # 2. World Cup
    wc_players, wc_matches = collect_worldcup()

    # 3. Build stats + episodes
    player_stats = build_player_stats(wc_players)
    build_training_episodes(player_stats)

    print("\n" + "=" * 60)
    print("Collection complete! Files in data/:")
    for f in sorted(DATA_DIR.glob("*.csv")) + sorted(DATA_DIR.glob("*.pkl")):
        size_mb = f.stat().st_size / (1024 * 1024)
        print(f"  {f.name:40s} {size_mb:.1f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
