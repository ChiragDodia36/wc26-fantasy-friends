/**
 * Home dashboard state — fetches aggregated dashboard data + news.
 */
import { create } from 'zustand';
import api from '@/services/api';

export interface SquadSummary {
  squad_id: string;
  team_name: string | null;
  formation: string;
  total_points: number;
  captain_name: string | null;
  player_count: number;
  budget_remaining: number;
}

export interface DeadlineInfo {
  round_name: string;
  deadline_utc: string;
}

export interface LeagueSnippet {
  league_id: string;
  league_name: string;
  rank: number | null;
  total_members: number;
  total_points: number;
}

export interface MatchSnippet {
  id: string;
  home_team_name: string | null;
  away_team_name: string | null;
  kickoff_utc: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  round_name: string | null;
}

export interface PlayerFixture {
  player_name: string;
  position: string;
  opponent: string;
  kickoff_utc: string;
  is_home: boolean;
}

export interface NewsItem {
  title: string;
  description: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  image_url: string | null;
}

interface DashboardData {
  squad_summary: SquadSummary | null;
  deadline: DeadlineInfo | null;
  action_items: string[];
  leagues: LeagueSnippet[];
  live_matches: MatchSnippet[];
  upcoming_matches: MatchSnippet[];
  my_fixtures: PlayerFixture[];
}

interface HomeState {
  dashboard: DashboardData | null;
  news: NewsItem[];
  loading: boolean;
  error: string | null;

  fetchDashboard: () => Promise<void>;
  fetchNews: () => Promise<void>;
  loadAll: () => Promise<void>;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  dashboard: null,
  news: [],
  loading: false,
  error: null,

  fetchDashboard: async () => {
    try {
      const res = await api.get<DashboardData>('/home/dashboard');
      set({ dashboard: res.data });
    } catch (err: any) {
      set({ error: err?.response?.data?.detail ?? 'Failed to load dashboard' });
    }
  },

  fetchNews: async () => {
    try {
      const res = await api.get<NewsItem[]>('/news?limit=5');
      set({ news: res.data });
    } catch {
      // News is non-critical
    }
  },

  loadAll: async () => {
    set({ loading: true, error: null });
    await Promise.all([get().fetchDashboard(), get().fetchNews()]);
    set({ loading: false });
  },
}));
