from sqlalchemy.orm import Session

from app.integrations.api_football_client import APIFootballClient
from app.models.match import Match, MatchStatus
from app.models.team import Team
from app.models.player import Player


async def seed_worldcup(db: Session):
    client = APIFootballClient()
    teams = await client.fetch_teams()
    for t in teams:
        db_team = Team(
            external_id=str(t.get("team", {}).get("id")),
            name=t.get("team", {}).get("name"),
            country_code=t.get("team", {}).get("country", ""),
            group_name=t.get("league", {}).get("group"),
            flag_url=t.get("team", {}).get("logo"),
        )
        db.add(db_team)
    db.commit()

    # Players per team (stub)
    for team in db.query(Team).all():
        players = await client.fetch_players(int(team.external_id))
        for p in players:
            db.add(
                Player(
                    external_id=str(p.get("player", {}).get("id")),
                    team_id=team.id,
                    name=p.get("player", {}).get("name"),
                    position=p.get("statistics", [{}])[0].get("games", {}).get("position", "MID"),
                    price=10.0,
                )
            )
    db.commit()

    fixtures = await client.fetch_fixtures()
    for f in fixtures:
        db.add(
            Match(
                external_id=str(f.get("fixture", {}).get("id")),
                home_team_id=team_id_by_external(db, f.get("teams", {}).get("home", {}).get("id")),
                away_team_id=team_id_by_external(db, f.get("teams", {}).get("away", {}).get("id")),
                kickoff_utc=f.get("fixture", {}).get("date"),
                venue=f.get("fixture", {}).get("venue", {}).get("name"),
                status=MatchStatus.SCHEDULED,
                round_name=f.get("league", {}).get("round"),
            )
        )
    db.commit()


def team_id_by_external(db: Session, external_id: int | None):
    if not external_id:
        return None
    team = db.query(Team).filter(Team.external_id == str(external_id)).first()
    return team.id if team else None

