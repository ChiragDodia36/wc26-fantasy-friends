/** AI Coach types — used by Step 8 ToT branch cards. */

export type TotBranch = 'safe' | 'differential' | 'fixture';

export interface ToTBranchCard {
  branch: TotBranch;
  title: string;
  reasoning: string;
  recommendedPlayerIds: string[];
  captainId: string;
  confidencePct: number;
}

export interface AIRecommendation {
  squadPlayerIds: string[];
  captainId: string;
  viceCaptainId: string;
  totBranches: ToTBranchCard[];
  selectedBranch: TotBranch;
}

export interface PlayerFormSnapshot {
  playerId: string;
  name: string;
  position: string;
  teamName: string;
  last5Points: number[];
  upcomingFdr: number;
  totalPointsThisTournament: number;
}

// ---------------------------------------------------------------------------
// Transfer context — structured data from backend for on-device LLM
// ---------------------------------------------------------------------------

export interface PlayerContext {
  player_id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price: number;
  team_id: string;
  team_name: string | null;
  is_starting?: boolean;
  is_captain?: boolean;
  form_last_5: number[];
  avg_form: number;
  upcoming_fdr: number | null;
}

export interface MatchContext {
  match_id: string;
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  away_team_name: string;
  kickoff_utc: string;
  venue: string | null;
}

export interface TransferContext {
  squad_id: string;
  budget_remaining: number;
  free_transfers_remaining: number;
  squad_players: PlayerContext[];
  upcoming_matches: MatchContext[];
  candidate_players: PlayerContext[];
  max_transfers: number;
  past_lessons: string[];
}

export interface TransferSwap {
  out: string;       // player_id to remove
  in: string;        // player_id to add
  out_name: string;
  in_name: string;
  reason: string;
}

export interface TransferSuggestion {
  swaps: TransferSwap[];
  summary: string;
  confidence: number;
}

export interface LineupSuggestion {
  explanation: string;
  starting: string[];
  bench: string[];
  captain_id: string | null;
  vice_captain_id: string | null;
}
