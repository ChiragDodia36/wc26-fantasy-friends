"""
Home dashboard endpoint — aggregates squad summary, deadline, action items,
league standings, live matches, and upcoming player fixtures into one response.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.db import get_db
from app.deps.auth_deps import get_current_user
from app.models.league import League, league_memberships
from app.models.match import Match, MatchStatus
from app.models.player import Player
from app.models.round import Round
from app.models.squad import Squad
from app.models.squad_player import SquadPlayer
from app.models.user import User

router = APIRouter()


# ── Response schemas ─────────────────────────────────────────────────────────

class SquadSummary(BaseModel):
    squad_id: str
    team_name: str | None = None
    formation: str = "4-4-2"
    total_points: int = 0
    captain_name: str | None = None
    player_count: int = 0
    budget_remaining: float = 100.0


class DeadlineInfo(BaseModel):
    round_name: str
    deadline_utc: str


class LeagueSnippet(BaseModel):
    league_id: str
    league_name: str
    rank: int | None = None
    total_members: int = 0
    total_points: int = 0


class MatchSnippet(BaseModel):
    id: str
    home_team_name: str | None = None
    away_team_name: str | None = None
    kickoff_utc: str
    status: str
    home_score: int | None = None
    away_score: int | None = None
    venue: str | None = None
    round_name: str | None = None


class PlayerFixture(BaseModel):
    player_name: str
    position: str
    opponent: str
    kickoff_utc: str
    is_home: bool


class DashboardResponse(BaseModel):
    squad_summary: SquadSummary | None = None
    deadline: DeadlineInfo | None = None
    action_items: List[str] = []
    leagues: List[LeagueSnippet] = []
    live_matches: List[MatchSnippet] = []
    upcoming_matches: List[MatchSnippet] = []
    my_fixtures: List[PlayerFixture] = []


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resp = DashboardResponse()
    now = datetime.now(timezone.utc)

    # ── Squad summary ────────────────────────────────────────────────────
    squad = (
        db.query(Squad)
        .filter(Squad.user_id == user.id)
        .options(joinedload(Squad.players))
        .first()
    )

    captain_name = None
    my_player_ids: list[str] = []

    if squad:
        sp_list = squad.players
        my_player_ids = [sp.player_id for sp in sp_list]

        # Find captain name
        captain_sp = next((sp for sp in sp_list if sp.is_captain), None)
        if captain_sp:
            captain_player = db.get(Player, captain_sp.player_id)
            if captain_player:
                captain_name = captain_player.name

        resp.squad_summary = SquadSummary(
            squad_id=squad.id,
            team_name=squad.team_name,
            formation=squad.formation or "4-4-2",
            total_points=0,  # TODO: aggregate from SquadRoundPoints
            captain_name=captain_name,
            player_count=len(sp_list),
            budget_remaining=float(squad.budget_remaining),
        )

    # ── Deadline ─────────────────────────────────────────────────────────
    next_round = (
        db.query(Round)
        .filter(Round.deadline_utc > now)
        .order_by(Round.deadline_utc)
        .first()
    )
    if next_round:
        resp.deadline = DeadlineInfo(
            round_name=next_round.name,
            deadline_utc=next_round.deadline_utc.isoformat() + "Z",
        )

    # ── Action items ─────────────────────────────────────────────────────
    if not squad:
        resp.action_items.append("Create your squad — pick 15 players with £100m budget")
    else:
        sp_list = squad.players
        if len(sp_list) < 15:
            resp.action_items.append(f"Complete your squad — {len(sp_list)}/15 players selected")
        starters = [sp for sp in sp_list if sp.is_starting]
        if len(starters) < 11:
            resp.action_items.append("Set your starting XI before the deadline")
        has_captain = any(sp.is_captain for sp in sp_list)
        if not has_captain:
            resp.action_items.append("Pick a captain for double points")
        if next_round:
            resp.action_items.append(f"Deadline: {next_round.name}")

    # ── Leagues ──────────────────────────────────────────────────────────
    user_leagues = (
        db.query(League)
        .join(league_memberships, League.id == league_memberships.c.league_id)
        .filter(league_memberships.c.user_id == user.id)
        .all()
    )
    for lg in user_leagues:
        member_count = (
            db.query(league_memberships)
            .filter(league_memberships.c.league_id == lg.id)
            .count()
        )
        resp.leagues.append(
            LeagueSnippet(
                league_id=lg.id,
                league_name=lg.name,
                total_members=member_count,
            )
        )

    # ── Live matches ─────────────────────────────────────────────────────
    live = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .filter(Match.status == MatchStatus.LIVE)
        .all()
    )
    resp.live_matches = [_match_snippet(m) for m in live]

    # ── Upcoming matches (next 5) ────────────────────────────────────────
    upcoming = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .filter(Match.status == MatchStatus.SCHEDULED)
        .filter(Match.kickoff_utc > now)
        .order_by(Match.kickoff_utc)
        .limit(5)
        .all()
    )
    resp.upcoming_matches = [_match_snippet(m) for m in upcoming]

    # ── My players' next fixtures ────────────────────────────────────────
    if my_player_ids:
        players = db.query(Player).filter(Player.id.in_(my_player_ids)).all()
        team_ids = list({p.team_id for p in players})
        player_by_team: dict[str, list[Player]] = {}
        for p in players:
            player_by_team.setdefault(p.team_id, []).append(p)

        next_matches = (
            db.query(Match)
            .options(joinedload(Match.home_team), joinedload(Match.away_team))
            .filter(Match.status == MatchStatus.SCHEDULED)
            .filter(Match.kickoff_utc > now)
            .filter(
                (Match.home_team_id.in_(team_ids)) | (Match.away_team_id.in_(team_ids))
            )
            .order_by(Match.kickoff_utc)
            .limit(20)
            .all()
        )

        seen_teams: set[str] = set()
        for m in next_matches:
            for tid in [m.home_team_id, m.away_team_id]:
                if tid in seen_teams or tid not in player_by_team:
                    continue
                seen_teams.add(tid)
                is_home = tid == m.home_team_id
                opponent = m.away_team.name if is_home else m.home_team.name
                for p in player_by_team[tid]:
                    resp.my_fixtures.append(
                        PlayerFixture(
                            player_name=p.name,
                            position=p.position,
                            opponent=opponent or "TBD",
                            kickoff_utc=m.kickoff_utc.isoformat() + "Z",
                            is_home=is_home,
                        )
                    )

    return resp


def _match_snippet(m: Match) -> MatchSnippet:
    return MatchSnippet(
        id=m.id,
        home_team_name=m.home_team.name if m.home_team else None,
        away_team_name=m.away_team.name if m.away_team else None,
        kickoff_utc=m.kickoff_utc.isoformat() + "Z",
        status=m.status.value if hasattr(m.status, "value") else str(m.status),
        home_score=m.home_score,
        away_score=m.away_score,
        venue=m.venue,
        round_name=m.round_name,
    )
