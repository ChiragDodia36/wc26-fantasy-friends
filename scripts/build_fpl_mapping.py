"""
Build FPL → WC26 player mapping.

Filters FPL players to only those whose nationality maps to a WC 2026
qualified team. Outputs data/wc_player_fpl_map.json.

Run:
    cd apps/backend
    source .venv/bin/activate
    python ../../scripts/build_fpl_mapping.py
"""
import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# WC 2026 qualified teams (48 teams — confirmed + expected)
# ISO country codes for filtering FPL player nationalities
WC26_COUNTRIES = {
    # Host nations (auto-qualified)
    "United States", "Mexico", "Canada",
    # UEFA (16 slots)
    "Germany", "France", "Spain", "England", "Portugal", "Netherlands",
    "Belgium", "Italy", "Croatia", "Switzerland", "Austria", "Denmark",
    "Scotland", "Serbia", "Turkey", "Ukraine",
    # CONMEBOL (6 slots)
    "Brazil", "Argentina", "Uruguay", "Colombia", "Ecuador", "Paraguay",
    # AFC (8 slots)
    "Japan", "South Korea", "Australia", "Saudi Arabia", "Iran", "Iraq",
    "Qatar", "Uzbekistan",
    # CAF (9 slots)
    "Morocco", "Senegal", "Nigeria", "Cameroon", "Ghana", "Egypt",
    "Ivory Coast", "Tunisia", "Algeria",
    # CONCACAF (3 more beyond hosts)
    "Jamaica", "Costa Rica", "Honduras",
    # OFC (1-2 slots)
    "New Zealand",
}


def build_mapping():
    fpl_dir = DATA_DIR / "fpl"

    # Find all player info CSVs
    player_files = sorted(fpl_dir.glob("data/*/players_raw.csv"))
    if not player_files:
        # Try alternate structure
        player_files = sorted(fpl_dir.glob("data/*/cleaned_players.csv"))

    if not player_files:
        print("No FPL player files found. Run collect_training_data.py first.")
        return

    print(f"Found {len(player_files)} seasons of player data.")

    # Use the latest season
    latest = player_files[-1]
    season = latest.parts[-2]
    print(f"Using season: {season}")

    try:
        df = pd.read_csv(latest, encoding="utf-8", on_bad_lines="skip")
    except Exception as e:
        print(f"Error reading {latest}: {e}")
        return

    # Find nationality column
    nat_col = None
    for candidate in ["nationality", "nation", "country"]:
        if candidate in df.columns:
            nat_col = candidate
            break

    if nat_col is None:
        print(f"No nationality column found. Columns: {list(df.columns)[:20]}")
        return

    # Filter to WC26 nationalities
    wc_players = df[df[nat_col].isin(WC26_COUNTRIES)]
    print(f"Filtered: {len(wc_players)} WC26-eligible players out of {len(df)} total.")

    # Build mapping
    pos_map = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
    mapping = {}
    for _, row in wc_players.iterrows():
        name = row.get("first_name", "") + " " + row.get("second_name", "")
        name = name.strip() or row.get("web_name", "Unknown")
        mapping[name] = {
            "team": row.get(nat_col, "Unknown"),
            "fpl_id": int(row.get("id", 0)),
            "wc_position": pos_map.get(row.get("element_type", 3), "MID"),
            "fpl_price": row.get("now_cost", 0) / 10 if "now_cost" in row else 0,
        }

    out_path = DATA_DIR / "wc_player_fpl_map.json"
    with open(out_path, "w") as f:
        json.dump(mapping, f, indent=2)
    print(f"Saved {len(mapping)} player mappings to {out_path}")


if __name__ == "__main__":
    build_mapping()
