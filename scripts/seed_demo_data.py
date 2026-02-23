"""
Seed demo data for local testing — teams, players, matches, rounds.

Run from project root:
    cd apps/backend
    source .venv/bin/activate
    source .env
    PYTHONPATH=$(pwd) python ../../scripts/seed_demo_data.py
"""
import uuid
from datetime import datetime, timedelta

# Must be imported after PYTHONPATH is set
from app.core.db import SessionLocal
from app.models.team import Team
from app.models.player import Player
from app.models.match import Match, MatchStatus
from app.models.round import Round, round_matches
from app.models.player_match_stats import PlayerMatchStats

# ──────────────────────────────────────────
# Demo teams (8 WC-style national teams)
# ──────────────────────────────────────────
TEAMS = [
    {"name": "Brazil", "code": "BR", "group": "A"},
    {"name": "Germany", "code": "DE", "group": "A"},
    {"name": "Japan", "code": "JP", "group": "A"},
    {"name": "Morocco", "code": "MA", "group": "A"},
    {"name": "France", "code": "FR", "group": "B"},
    {"name": "Argentina", "code": "AR", "group": "B"},
    {"name": "England", "code": "GB", "group": "B"},
    {"name": "Portugal", "code": "PT", "group": "B"},
]

# Template squads per team (positional mix)
SQUAD_TEMPLATE = [
    # (position, name_suffix, price)
    ("GK", "Keeper 1", 4.5),
    ("GK", "Keeper 2", 4.0),
    ("DEF", "Defender 1", 5.5),
    ("DEF", "Defender 2", 5.0),
    ("DEF", "Defender 3", 5.0),
    ("DEF", "Defender 4", 4.5),
    ("DEF", "Defender 5", 4.5),
    ("MID", "Midfielder 1", 6.5),
    ("MID", "Midfielder 2", 6.0),
    ("MID", "Midfielder 3", 5.5),
    ("MID", "Midfielder 4", 5.0),
    ("MID", "Midfielder 5", 5.0),
    ("FWD", "Forward 1", 7.0),
    ("FWD", "Forward 2", 6.5),
    ("FWD", "Forward 3", 6.0),
]

# Famous player names by country
FAMOUS_PLAYERS = {
    "Brazil": [
        "Alisson", "Ederson", "Marquinhos", "Militao", "Danilo", "Alex Sandro", "Bremer",
        "Casemiro", "Paqueta", "Bruno G.", "Fred", "Neymar Jr",
        "Vinicius Jr", "Richarlison", "Raphinha",
    ],
    "Germany": [
        "Neuer", "ter Stegen", "Rudiger", "Schlotterbeck", "Raum", "Kehrer", "Sule",
        "Gundogan", "Kimmich", "Musiala", "Goretzka", "Sane",
        "Havertz", "Fullkrug", "Muller",
    ],
    "Japan": [
        "Gonda", "Suzuki", "Tomiyasu", "Itakura", "Nagatomo", "Sakai", "Taniguchi",
        "Endo", "Kamada", "Kubo", "Mitoma", "Doan",
        "Maeda", "Ueda", "Asano",
    ],
    "Morocco": [
        "Bounou", "Munir", "Hakimi", "Saiss", "Aguerd", "Mazraoui", "Dari",
        "Amrabat", "Ounahi", "Ziyech", "Boufal", "Amallah",
        "En-Nesyri", "Hamdallah", "Aboukhlal",
    ],
    "France": [
        "Lloris", "Maignan", "Varane", "Kounde", "T. Hernandez", "Upamecano", "Saliba",
        "Tchouameni", "Rabiot", "Griezmann", "Coman", "Dembele",
        "Mbappe", "Giroud", "Thuram",
    ],
    "Argentina": [
        "E. Martinez", "Armani", "Otamendi", "Romero", "Molina", "Acuna", "Lisandro M.",
        "De Paul", "Enzo Fernandez", "Mac Allister", "Lo Celso", "Di Maria",
        "Messi", "Lautaro", "Julian Alvarez",
    ],
    "England": [
        "Pickford", "Ramsdale", "Stones", "Maguire", "Walker", "Shaw", "Trippier",
        "Rice", "Bellingham", "Foden", "Mount", "Saka",
        "Kane", "Rashford", "Sterling",
    ],
    "Portugal": [
        "Diogo Costa", "Rui Patricio", "Pepe", "Ruben Dias", "Cancelo", "Nuno Mendes", "Dalot",
        "Bruno Fernandes", "Bernardo", "Vitinha", "Joao Felix", "Otavio",
        "Ronaldo", "Goncalo Ramos", "Rafael Leao",
    ],
}


def seed():
    db = SessionLocal()
    try:
        # Check if already seeded
        existing = db.query(Team).count()
        if existing > 0:
            print(f"DB already has {existing} teams — skipping seed. Drop tables first to re-seed.")
            return

        team_ids = {}
        player_ids = []

        # Create teams
        for t in TEAMS:
            tid = str(uuid.uuid4())
            team_ids[t["name"]] = tid
            db.add(Team(
                id=tid,
                external_id=f"ext_{t['code'].lower()}",
                name=t["name"],
                country_code=t["code"],
                group_name=t["group"],
            ))

        db.flush()
        print(f"Created {len(TEAMS)} teams")

        # Create players
        for t in TEAMS:
            names = FAMOUS_PLAYERS.get(t["name"], [])
            for i, (pos, suffix, price) in enumerate(SQUAD_TEMPLATE):
                pid = str(uuid.uuid4())
                player_ids.append(pid)
                player_name = names[i] if i < len(names) else f"{t['name']} {suffix}"
                db.add(Player(
                    id=pid,
                    external_id=f"ext_{t['code'].lower()}_{i}",
                    team_id=team_ids[t["name"]],
                    name=player_name,
                    position=pos,
                    price=price,
                ))

        db.flush()
        print(f"Created {len(TEAMS) * len(SQUAD_TEMPLATE)} players")

        # Create rounds
        now = datetime.utcnow()
        rounds = []
        round_data = [
            ("Group Stage - 1", -10),
            ("Group Stage - 2", -5),
            ("Group Stage - 3", 2),
        ]
        for rname, day_offset in round_data:
            rid = str(uuid.uuid4())
            start = now + timedelta(days=day_offset)
            rounds.append({
                "id": rid,
                "name": rname,
                "start": start,
                "deadline": start - timedelta(hours=1),
                "end": start + timedelta(days=3),
            })
            db.add(Round(
                id=rid,
                name=rname,
                start_utc=start,
                deadline_utc=start - timedelta(hours=1),
                end_utc=start + timedelta(days=3),
            ))

        db.flush()
        print(f"Created {len(rounds)} rounds")

        # Create matches (each team plays 3 group games)
        team_names = [t["name"] for t in TEAMS]
        group_a = team_names[:4]
        group_b = team_names[4:]
        match_count = 0

        for group in [group_a, group_b]:
            matchups = [
                (group[0], group[1], 0),
                (group[2], group[3], 0),
                (group[0], group[2], 1),
                (group[1], group[3], 1),
                (group[0], group[3], 2),
                (group[1], group[2], 2),
            ]
            for home, away, round_idx in matchups:
                mid = str(uuid.uuid4())
                rd = rounds[round_idx]
                is_finished = round_idx < 2  # first 2 rounds finished
                home_score = __import__("random").randint(0, 3) if is_finished else None
                away_score = __import__("random").randint(0, 2) if is_finished else None

                match = Match(
                    id=mid,
                    external_id=f"ext_match_{match_count}",
                    home_team_id=team_ids[home],
                    away_team_id=team_ids[away],
                    kickoff_utc=rd["start"] + timedelta(hours=match_count % 3 * 3),
                    venue="Demo Stadium",
                    status=MatchStatus.FINISHED if is_finished else MatchStatus.SCHEDULED,
                    home_score=home_score,
                    away_score=away_score,
                    round_name=rd["name"],
                )
                db.add(match)
                db.flush()

                # Add player stats for finished matches
                if is_finished:
                    _add_demo_stats(db, mid, team_ids[home], team_ids[away],
                                    home_score or 0, away_score or 0)

                match_count += 1

        print(f"Created {match_count} matches")
        db.commit()
        print("Seed complete!")

    finally:
        db.close()


def _add_demo_stats(db, match_id, home_team_id, away_team_id, home_score, away_score):
    """Add random but plausible player stats for a finished match."""
    import random

    for team_id, goals_scored, goals_conceded in [
        (home_team_id, home_score, away_score),
        (away_team_id, away_score, home_score),
    ]:
        players = db.query(Player).filter(Player.team_id == team_id).all()
        clean_sheet = goals_conceded == 0
        goals_left = goals_scored

        for p in players:
            minutes = random.choice([0, 60, 70, 80, 90, 90, 90])
            if minutes == 0:
                # Sub who didn't play
                continue

            player_goals = 0
            player_assists = 0
            if goals_left > 0 and p.position in ("FWD", "MID"):
                player_goals = min(goals_left, random.randint(0, 2))
                goals_left -= player_goals
                if random.random() > 0.5:
                    player_assists = 1

            # Compute basic fantasy points
            pts = 0
            pts += 1 if minutes >= 1 else 0
            pts += 1 if minutes >= 60 else 0
            goal_pts = {"GK": 6, "DEF": 6, "MID": 5, "FWD": 4}
            pts += player_goals * goal_pts.get(p.position, 4)
            pts += player_assists * 3
            if clean_sheet and minutes >= 60 and p.position in ("GK", "DEF"):
                pts += 4
            if clean_sheet and minutes >= 60 and p.position == "MID":
                pts += 1

            saves = random.randint(2, 7) if p.position == "GK" else 0
            pts += saves // 3

            db.add(PlayerMatchStats(
                id=str(uuid.uuid4()),
                match_id=match_id,
                player_id=p.id,
                minutes_played=minutes,
                goals=player_goals,
                assists=player_assists,
                clean_sheet=clean_sheet and minutes >= 60,
                goals_conceded=goals_conceded if p.position in ("GK", "DEF") else 0,
                saves=saves,
                fantasy_points=pts,
            ))


if __name__ == "__main__":
    seed()
