/** API response types matching backend Pydantic schemas. */

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserBase {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  created_at: string;
}

export interface Player {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price: number;
  team_id: string;
  team_name: string | null;
  is_active: boolean;
}

export interface Match {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string | null;
  away_team_name: string | null;
  kickoff_utc: string;
  venue: string | null;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  home_score: number | null;
  away_score: number | null;
  round_name: string | null;
}

export interface Round {
  id: string;
  name: string;
  start_utc: string;
  deadline_utc: string;
  end_utc: string;
}

export interface SquadPlayer {
  id: string;
  player_id: string;
  is_starting: boolean;
  bench_order: number | null;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface Squad {
  id: string;
  league_id: string;
  budget_remaining: number;
  free_transfers_remaining: number;
  wildcard_used: boolean;
  players: SquadPlayer[];
}
