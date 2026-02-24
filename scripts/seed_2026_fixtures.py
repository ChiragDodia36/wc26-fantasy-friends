"""
Seed 2026 FIFA World Cup fixture schedule.

Keeps existing WC 2022 players/teams — only replaces matches and rounds
with a realistic 2026 WC schedule (June 11 – July 19, 2026).

Usage:
    cd apps/backend
    source .venv/bin/activate && source .env && export DATABASE_URL
    PYTHONPATH=$(pwd) python ../../scripts/seed_2026_fixtures.py
"""
import uuid
from datetime import datetime, timedelta

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "apps", "backend"))

from app.core.db import SessionLocal
from app.models.match import Match, MatchStatus
from app.models.round import Round, round_matches
from app.models.team import Team


# ── 2026 WC Venues ──────────────────────────────────────────────────────────
VENUES = [
    "MetLife Stadium, New York/New Jersey",
    "SoFi Stadium, Los Angeles",
    "AT&T Stadium, Dallas",
    "Hard Rock Stadium, Miami",
    "Mercedes-Benz Stadium, Atlanta",
    "NRG Stadium, Houston",
    "Lumen Field, Seattle",
    "Levi's Stadium, San Francisco",
    "Lincoln Financial Field, Philadelphia",
    "Arrowhead Stadium, Kansas City",
    "Gillette Stadium, Boston",
    "Estadio Azteca, Mexico City",
    "Estadio Akron, Guadalajara",
    "Estadio BBVA, Monterrey",
    "BC Place, Vancouver",
    "BMO Field, Toronto",
]

# ── Assign 32 WC 2022 teams into 8 groups of 4 (A–H) ───────────────────────
# Realistic draw-style distribution
GROUPS = {
    "A": ["USA", "Mexico", "Morocco", "Australia"],
    "B": ["England", "Germany", "Japan", "Iran"],
    "C": ["France", "Argentina", "Saudi Arabia", "Tunisia"],
    "D": ["Brazil", "Spain", "South Korea", "Ghana"],
    "E": ["Netherlands", "Portugal", "Ecuador", "Cameroon"],
    "F": ["Belgium", "Croatia", "Canada", "Costa Rica"],
    "G": ["Uruguay", "Denmark", "Senegal", "Qatar"],
    "H": ["Switzerland", "Poland", "Serbia", "Wales"],
}

# ── Schedule dates ───────────────────────────────────────────────────────────
# WC 2026 runs June 11 – July 19, 2026
BASE = datetime(2026, 6, 11)  # Opening match

# Each group matchday: 3 matches per group per matchday
# Matchday 1: June 11–14, Matchday 2: June 17–20, Matchday 3: June 23–26
GROUP_MD_OFFSETS = [0, 6, 12]  # days after BASE for each matchday

# Knockout dates
R32_START = datetime(2026, 6, 28)
R16_START = datetime(2026, 7, 2)
QF_START = datetime(2026, 7, 8)
SF_START = datetime(2026, 7, 14)
THIRD_PLACE = datetime(2026, 7, 18)
FINAL = datetime(2026, 7, 19)


def get_group_matches(group_teams: list[str]) -> list[tuple[str, str]]:
    """Round-robin: each team plays the other 3 once → 6 matches."""
    matches = []
    for i in range(len(group_teams)):
        for j in range(i + 1, len(group_teams)):
            matches.append((group_teams[i], group_teams[j]))
    return matches


def main():
    db = SessionLocal()
    try:
        # Load team name → ID mapping
        teams = db.query(Team).all()
        name_to_id = {t.name: t.id for t in teams}

        missing = []
        for group, names in GROUPS.items():
            for name in names:
                if name not in name_to_id:
                    missing.append(name)
        if missing:
            print(f"WARNING: Teams not found in DB: {missing}")
            print("Continuing with available teams...")

        # ── Clear existing matches and rounds ─────────────────────────────
        print("Clearing existing matches and rounds...")
        db.execute(round_matches.delete())
        db.query(Match).delete()
        db.query(Round).delete()
        db.flush()

        # Update team groups
        for t in teams:
            t.group_name = None
        for group_letter, team_names in GROUPS.items():
            for tname in team_names:
                team = next((t for t in teams if t.name == tname), None)
                if team:
                    team.group_name = f"Group {group_letter}"
        db.flush()

        match_count = 0
        venue_idx = 0

        def next_venue():
            nonlocal venue_idx
            v = VENUES[venue_idx % len(VENUES)]
            venue_idx += 1
            return v

        # ── Group Stage ───────────────────────────────────────────────────
        print("Seeding group stage fixtures...")
        for group_letter, team_names in GROUPS.items():
            group_fixtures = get_group_matches(team_names)

            # Split 6 matches across 3 matchdays (2 per matchday)
            matchdays = [group_fixtures[0:2], group_fixtures[2:4], group_fixtures[4:6]]

            for md_idx, md_matches in enumerate(matchdays):
                round_name = f"Group {group_letter} - Matchday {md_idx + 1}"
                day_offset = GROUP_MD_OFFSETS[md_idx] + ord(group_letter) - ord("A")
                round_date = BASE + timedelta(days=day_offset)

                # Create round
                round_id = str(uuid.uuid4())
                rnd = Round(
                    id=round_id,
                    name=round_name,
                    start_utc=round_date,
                    deadline_utc=round_date - timedelta(hours=1),
                    end_utc=round_date + timedelta(hours=6),
                )
                db.add(rnd)
                db.flush()

                for match_idx, (home_name, away_name) in enumerate(md_matches):
                    home_id = name_to_id.get(home_name)
                    away_id = name_to_id.get(away_name)
                    if not home_id or not away_id:
                        continue

                    kickoff = round_date + timedelta(hours=15 + match_idx * 3)
                    match_id = str(uuid.uuid4())
                    match = Match(
                        id=match_id,
                        external_id=f"WC2026-{group_letter}{md_idx+1}-{match_idx+1}",
                        home_team_id=home_id,
                        away_team_id=away_id,
                        kickoff_utc=kickoff,
                        venue=next_venue(),
                        status=MatchStatus.SCHEDULED,
                        round_name=round_name,
                    )
                    db.add(match)
                    db.flush()
                    db.execute(round_matches.insert().values(round_id=round_id, match_id=match_id))
                    match_count += 1

        # ── Knockout Rounds ───────────────────────────────────────────────
        print("Seeding knockout stage fixtures...")

        knockout_rounds = [
            ("Round of 16", R16_START, 8, 1),
            ("Quarter-Final", QF_START, 4, 1),
            ("Semi-Final", SF_START, 2, 1),
            ("3rd Place Play-off", THIRD_PLACE, 1, 0),
            ("Final", FINAL, 1, 0),
        ]

        # Use actual teams for R16 pairings (group winners vs runners-up)
        group_letters = sorted(GROUPS.keys())
        r16_pairings = [
            (GROUPS[group_letters[0]][0], GROUPS[group_letters[1]][1]),  # A1 vs B2
            (GROUPS[group_letters[2]][0], GROUPS[group_letters[3]][1]),  # C1 vs D2
            (GROUPS[group_letters[4]][0], GROUPS[group_letters[5]][1]),  # E1 vs F2
            (GROUPS[group_letters[6]][0], GROUPS[group_letters[7]][1]),  # G1 vs H2
            (GROUPS[group_letters[1]][0], GROUPS[group_letters[0]][1]),  # B1 vs A2
            (GROUPS[group_letters[3]][0], GROUPS[group_letters[2]][1]),  # D1 vs C2
            (GROUPS[group_letters[5]][0], GROUPS[group_letters[4]][1]),  # F1 vs E2
            (GROUPS[group_letters[7]][0], GROUPS[group_letters[6]][1]),  # H1 vs G2
        ]

        # QF: winners of R16 pairs
        qf_pairings = [
            (r16_pairings[0][0], r16_pairings[1][0]),
            (r16_pairings[2][0], r16_pairings[3][0]),
            (r16_pairings[4][0], r16_pairings[5][0]),
            (r16_pairings[6][0], r16_pairings[7][0]),
        ]

        sf_pairings = [
            (qf_pairings[0][0], qf_pairings[1][0]),
            (qf_pairings[2][0], qf_pairings[3][0]),
        ]

        third_place_pairing = [(sf_pairings[0][1], sf_pairings[1][1])]
        final_pairing = [(sf_pairings[0][0], sf_pairings[1][0])]

        all_ko_pairings = [
            r16_pairings, qf_pairings, sf_pairings, third_place_pairing, final_pairing
        ]

        for (round_label, start_date, num_matches, _), pairings in zip(knockout_rounds, all_ko_pairings):
            round_id = str(uuid.uuid4())
            rnd = Round(
                id=round_id,
                name=round_label,
                start_utc=start_date,
                deadline_utc=start_date - timedelta(hours=1),
                end_utc=start_date + timedelta(hours=4 * num_matches),
            )
            db.add(rnd)
            db.flush()

            for i, (home_name, away_name) in enumerate(pairings):
                home_id = name_to_id.get(home_name)
                away_id = name_to_id.get(away_name)
                if not home_id or not away_id:
                    continue

                day_offset = i // 2  # spread across multiple days
                kickoff = start_date + timedelta(days=day_offset, hours=18 + (i % 2) * 3)
                match_id = str(uuid.uuid4())
                match = Match(
                    id=match_id,
                    external_id=f"WC2026-{round_label.replace(' ', '')}-{i+1}",
                    home_team_id=home_id,
                    away_team_id=away_id,
                    kickoff_utc=kickoff,
                    venue=next_venue(),
                    status=MatchStatus.SCHEDULED,
                    round_name=round_label,
                )
                db.add(match)
                db.flush()
                db.execute(round_matches.insert().values(round_id=round_id, match_id=match_id))
                match_count += 1

        db.commit()
        print(f"\nDone! Seeded {match_count} matches for WC 2026.")
        print("Group stage: 8 groups × 6 matches = 48 matches")
        print("Knockout: R16 (8) + QF (4) + SF (2) + 3rd (1) + Final (1) = 16 matches")

    finally:
        db.close()


if __name__ == "__main__":
    main()
