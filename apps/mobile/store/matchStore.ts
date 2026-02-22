/**
 * Match state — fixture calendar + live scores.
 * Mobile app polls /matches?status=live every 30s when the app is foregrounded.
 */
import { create } from 'zustand';
import api from '@/services/api';
import type { Match } from '@/types/api';

interface MatchState {
  matches: Match[];
  liveMatches: Match[];
  loading: boolean;
  error: string | null;

  fetchMatches: () => Promise<void>;
  fetchLive: () => Promise<void>;
}

export const useMatchStore = create<MatchState>((set) => ({
  matches: [],
  liveMatches: [],
  loading: false,
  error: null,

  fetchMatches: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<Match[]>('/matches?limit=100');
      set({ matches: res.data, loading: false });
    } catch (err: any) {
      set({ error: err?.response?.data?.detail ?? 'Failed to load matches', loading: false });
    }
  },

  fetchLive: async () => {
    try {
      const res = await api.get<Match[]>('/matches/live');
      set({ liveMatches: res.data });
    } catch {
      // No live matches
    }
  },
}));
