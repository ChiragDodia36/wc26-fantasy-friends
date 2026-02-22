/**
 * League state — current user's leagues, standings, invite code sharing.
 */
import { create } from 'zustand';
import api from '@/services/api';
import type { League } from '@/types/api';

export interface StandingEntry {
  squad_id: string;
  username: string;
  total_points: number;
  rank: number;
}

interface LeagueState {
  leagues: League[];
  standings: Record<string, StandingEntry[]>;
  loading: boolean;
  error: string | null;

  fetchLeagues: () => Promise<void>;
  fetchStandings: (leagueId: string) => Promise<void>;
  createLeague: (name: string) => Promise<League>;
  joinLeague: (code: string) => Promise<void>;
}

export const useLeagueStore = create<LeagueState>((set, get) => ({
  leagues: [],
  standings: {},
  loading: false,
  error: null,

  fetchLeagues: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<League[]>('/leagues');
      set({ leagues: res.data, loading: false });
    } catch (err: any) {
      set({ error: err?.response?.data?.detail ?? 'Failed to load leagues', loading: false });
    }
  },

  fetchStandings: async (leagueId) => {
    try {
      const res = await api.get<StandingEntry[]>(`/leagues/${leagueId}/standings`);
      set((s) => ({ standings: { ...s.standings, [leagueId]: res.data } }));
    } catch {
      // Standings may be empty at start
    }
  },

  createLeague: async (name) => {
    const res = await api.post<League>('/leagues', { name });
    set((s) => ({ leagues: [...s.leagues, res.data] }));
    return res.data;
  },

  joinLeague: async (code) => {
    await api.post('/leagues/join', { code });
    await get().fetchLeagues();
  },
}));
