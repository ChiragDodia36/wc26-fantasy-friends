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
