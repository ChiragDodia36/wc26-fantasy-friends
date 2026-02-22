"""initial_schema

Revision ID: d602857e663e
Revises:
Create Date: 2026-02-22 04:12:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "d602857e663e"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # teams
    op.create_table(
        "teams",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("country_code", sa.String(), nullable=False),
        sa.Column("group_name", sa.String(), nullable=True),
        sa.Column("flag_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_teams_external_id"), "teams", ["external_id"], unique=False)

    # leagues
    op.create_table(
        "leagues",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leagues_code"), "leagues", ["code"], unique=True)

    # league_memberships
    op.create_table(
        "league_memberships",
        sa.Column("league_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("league_id", "user_id"),
    )

    # players
    op.create_table(
        "players",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.Column("team_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("position", sa.String(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_players_external_id"), "players", ["external_id"], unique=False)

    # rounds
    op.create_table(
        "rounds",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("start_utc", sa.DateTime(), nullable=False),
        sa.Column("deadline_utc", sa.DateTime(), nullable=False),
        sa.Column("end_utc", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # matches
    matchstatus_enum = sa.Enum("SCHEDULED", "LIVE", "FINISHED", name="matchstatus")
    op.create_table(
        "matches",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.Column("home_team_id", sa.String(), nullable=False),
        sa.Column("away_team_id", sa.String(), nullable=False),
        sa.Column("kickoff_utc", sa.DateTime(), nullable=False),
        sa.Column("venue", sa.String(), nullable=True),
        sa.Column("status", matchstatus_enum, nullable=True),
        sa.Column("home_score", sa.Integer(), nullable=True),
        sa.Column("away_score", sa.Integer(), nullable=True),
        sa.Column("round_name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["away_team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["home_team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_matches_external_id"), "matches", ["external_id"], unique=False)

    # round_matches
    op.create_table(
        "round_matches",
        sa.Column("round_id", sa.String(), nullable=False),
        sa.Column("match_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"]),
        sa.ForeignKeyConstraint(["round_id"], ["rounds.id"]),
        sa.PrimaryKeyConstraint("round_id", "match_id"),
    )

    # squads
    op.create_table(
        "squads",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("league_id", sa.String(), nullable=False),
        sa.Column("budget_remaining", sa.Numeric(10, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # squad_players
    op.create_table(
        "squad_players",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("squad_id", sa.String(), nullable=False),
        sa.Column("player_id", sa.String(), nullable=False),
        sa.Column("is_starting", sa.Boolean(), nullable=True),
        sa.Column("bench_order", sa.Integer(), nullable=True),
        sa.Column("is_captain", sa.Boolean(), nullable=True),
        sa.Column("is_vice_captain", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["squad_id"], ["squads.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("squad_id", "player_id", name="uq_squad_player"),
    )

    # squad_round_points
    op.create_table(
        "squad_round_points",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("squad_id", sa.String(), nullable=False),
        sa.Column("round_id", sa.String(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=True),
        sa.Column("rank_in_league", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["round_id"], ["rounds.id"]),
        sa.ForeignKeyConstraint(["squad_id"], ["squads.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("squad_id", "round_id", name="uq_squad_round"),
    )

    # player_match_stats
    op.create_table(
        "player_match_stats",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("match_id", sa.String(), nullable=False),
        sa.Column("player_id", sa.String(), nullable=False),
        sa.Column("minutes_played", sa.Integer(), nullable=True),
        sa.Column("goals", sa.Integer(), nullable=True),
        sa.Column("assists", sa.Integer(), nullable=True),
        sa.Column("clean_sheet", sa.Boolean(), nullable=True),
        sa.Column("goals_conceded", sa.Integer(), nullable=True),
        sa.Column("yellow_cards", sa.Integer(), nullable=True),
        sa.Column("red_cards", sa.Integer(), nullable=True),
        sa.Column("own_goals", sa.Integer(), nullable=True),
        sa.Column("penalties_scored", sa.Integer(), nullable=True),
        sa.Column("penalties_missed", sa.Integer(), nullable=True),
        sa.Column("saves", sa.Integer(), nullable=True),
        sa.Column("fantasy_points", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"]),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("match_id", "player_id", name="uq_match_player"),
    )


def downgrade() -> None:
    op.drop_table("player_match_stats")
    op.drop_table("squad_round_points")
    op.drop_table("squad_players")
    op.drop_table("squads")
    op.drop_table("round_matches")
    op.drop_index(op.f("ix_matches_external_id"), table_name="matches")
    op.drop_table("matches")
    op.execute("DROP TYPE IF EXISTS matchstatus")
    op.drop_table("rounds")
    op.drop_index(op.f("ix_players_external_id"), table_name="players")
    op.drop_table("players")
    op.drop_table("league_memberships")
    op.drop_index(op.f("ix_leagues_code"), table_name="leagues")
    op.drop_table("leagues")
    op.drop_index(op.f("ix_teams_external_id"), table_name="teams")
    op.drop_table("teams")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
