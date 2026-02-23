"""
World Cup sync service — fetches real data from API-Football v3.

Uses WORLD_CUP_SEASON env var:
  - "2022" during dev (real WC 2022 data with real players)
  - "2026" when API-Football publishes WC 2026 (expected April 2026)

Costs ~35 API calls per full seed (1 teams + 32 squads + 1 fixtures + 1 buffer).
Well within the 100/day free limit.
"""
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.integrations.api_football_client import APIFootballClient
from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.round import Round
from app.models.team import Team

POSITION_MAP = {
    "Goalkeeper": "GK",
    "Defender": "DEF",
    "Midfielder": "MID",
    "Attacker": "FWD",
}

PRICE_MAP = {"GK": 4.5, "DEF": 5.0, "MID": 5.5, "FWD": 6.0}

STATUS_MAP = {
    "Match Finished": MatchStatus.FINISHED,
    "Match Finished After Extra Time": MatchStatus.FINISHED,
    "Match Finished After Penalties": MatchStatus.FINISHED,
    "Not Started": MatchStatus.SCHEDULED,
    "Time to be Defined": MatchStatus.SCHEDULED,
}


def seed_teams(db: Session, client: APIFootballClient) -> dict[int, str]:
    """Fetch all WC teams → upsert into DB. Returns {api_id: db_id} map."""
    raw_teams = client.fetch_wc26_teams()
    api_to_db = {}

    for item in raw_teams:
        team_data = item["team"]
        api_id = team_data["id"]
        name = team_data["name"]
        code = team_data.get("code", "")[:3]

        existing = db.query(Team).filter(Team.external_id == str(api_id)).first()
        if existing:
            api_to_db[api_id] = existing.id
            continue

        db_id = str(uuid.uuid4())
        db.add(Team(
            id=db_id,
            external_id=str(api_id),
            name=name,
            country_code=code,
            group_name=None,
            flag_url=team_data.get("logo"),
        ))
        api_to_db[api_id] = db_id

    db.flush()
    print(f"  Teams: {len(api_to_db)}")
    return api_to_db


def seed_squads(db: Session, client: APIFootballClient, api_to_db: dict[int, str]) -> int:
    """Fetch squad for each team → upsert players. Returns total player count."""
    total = 0

    for i, (api_team_id, db_team_id) in enumerate(api_to_db.items()):
        existing_count = db.query(Player).filter(Player.team_id == db_team_id).count()
        if existing_count > 0:
            total += existing_count
            continue

        squad_resp = client.fetch_squad(api_team_id)
        if not squad_resp:
            print(f"    No squad data for team {api_team_id}, skipping")
            continue

        players = squad_resp[0].get("players", [])
        team_name = db.query(Team).filter(Team.id == db_team_id).first()
        print(f"    [{i+1}/{len(api_to_db)}] {team_name.name if team_name else api_team_id}: {len(players)} players")

        for p in players:
            pos_raw = p.get("position", "Midfielder")
            pos = POSITION_MAP.get(pos_raw, "MID")
            price = PRICE_MAP.get(pos, 5.0)

            db.add(Player(
                id=str(uuid.uuid4()),
                external_id=str(p["id"]),
                team_id=db_team_id,
                name=p["name"],
                position=pos,
                price=price,
                is_active=True,
            ))
            total += 1

        db.flush()

    print(f"  Players total: {total}")
    return total


def seed_fixtures(db: Session, client: APIFootballClient, api_to_db: dict[int, str]) -> int:
    """Fetch all WC fixtures → upsert matches + rounds. Returns match count."""
    raw_fixtures = client.fetch_fixtures()
    rounds_seen: dict[str, str] = {}
    match_count = 0

    for item in raw_fixtures:
        fix = item["fixture"]
        teams = item["teams"]
        goals = item.get("goals", {})
        league = item.get("league", {})

        fixture_id = str(fix["id"])
        round_name = league.get("round", "Unknown")

        existing = db.query(Match).filter(Match.external_id == fixture_id).first()
        if existing:
            match_count += 1
            continue

        # Create round if new
        if round_name not in rounds_seen:
            rid = str(uuid.uuid4())
            kickoff = datetime.fromisoformat(fix["date"].replace("Z", "+00:00"))
            db.add(Round(
                id=rid,
                name=round_name,
                start_utc=kickoff,
                deadline_utc=kickoff,
                end_utc=kickoff,
            ))
            rounds_seen[round_name] = rid
            db.flush()

        # Resolve team IDs
        home_api_id = teams["home"]["id"]
        away_api_id = teams["away"]["id"]
        home_db_id = api_to_db.get(home_api_id)
        away_db_id = api_to_db.get(away_api_id)
        if not home_db_id or not away_db_id:
            continue

        # Map status
        status_long = fix.get("status", {}).get("long", "Not Started")
        status = STATUS_MAP.get(status_long, MatchStatus.SCHEDULED)
        if "Live" in status_long or "Half" in status_long or "Progress" in status_long:
            status = MatchStatus.LIVE

        kickoff = datetime.fromisoformat(fix["date"].replace("Z", "+00:00"))

        # Extract group letter from round name like "Group A - 1"
        if "Group" in round_name:
            parts = round_name.split(" ")
            for idx, part in enumerate(parts):
                if part == "Group" and idx + 1 < len(parts):
                    group_letter = parts[idx + 1].rstrip(" -")
                    db.query(Team).filter(Team.id == home_db_id).update({"group_name": group_letter})
                    db.query(Team).filter(Team.id == away_db_id).update({"group_name": group_letter})
                    break

        db.add(Match(
            id=str(uuid.uuid4()),
            external_id=fixture_id,
            home_team_id=home_db_id,
            away_team_id=away_db_id,
            kickoff_utc=kickoff,
            venue=fix.get("venue", {}).get("name"),
            status=status,
            home_score=goals.get("home"),
            away_score=goals.get("away"),
            round_name=round_name,
        ))
        match_count += 1

    db.flush()
    print(f"  Matches: {match_count}")
    return match_count


def seed_worldcup(db: Session):
    """Full seed: teams → squads → fixtures from API-Football."""
    print("Fetching real World Cup data from API-Football...")
    client = APIFootballClient()

    api_to_db = seed_teams(db, client)
    seed_squads(db, client, api_to_db)
    seed_fixtures(db, client, api_to_db)

    db.commit()
    print("Seed complete!")

