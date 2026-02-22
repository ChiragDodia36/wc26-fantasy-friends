/**
 * Squad state — loads the user's squad for the current league and exposes
 * transfer/lineup mutations.
 */
import { create } from 'zustand';
import api from '@/services/api';
import type { Squad, Player, Round } from '@/types/api';

interface SquadState {
  squad: Squad | null;
  players: Player[];
  currentRound: Round | null;
  leagueId: string | null;
  loading: boolean;
  error: string | null;

  fetchSquad: (leagueId: string) => Promise<void>;
  fetchCurrentRound: () => Promise<void>;
  makeTransfer: (playerOutId: string, playerInId: string) => Promise<void>;
  activateWildcard: () => Promise<void>;
  setCaptain: (playerId: string) => Promise<void>;
}

export const useSquadStore = create<SquadState>((set, get) => ({
  squad: null,
  players: [],
  currentRound: null,
  leagueId: null,
  loading: false,
  error: null,

  fetchSquad: async (leagueId) => {
    set({ loading: true, error: null, leagueId });
    try {
      const [squadRes, playersRes] = await Promise.all([
        api.get<Squad>(`/squads/my?league_id=${leagueId}`),
        api.get<Player[]>('/players?limit=200'),
      ]);
      set({ squad: squadRes.data, players: playersRes.data, loading: false });
    } catch (err: any) {
      set({ error: err?.response?.data?.detail ?? 'Failed to load squad', loading: false });
    }
  },

  fetchCurrentRound: async () => {
    try {
      const res = await api.get<Round>('/rounds/current');
      set({ currentRound: res.data });
    } catch {
      // No active round — tournament hasn't started yet
      set({ currentRound: null });
    }
  },

  makeTransfer: async (playerOutId, playerInId) => {
    const { squad } = get();
    if (!squad) return;
    try {
      await api.post('/transfers', {
        squad_id: squad.id,
        player_out_id: playerOutId,
        player_in_id: playerInId,
      });
      // Re-fetch to get updated state
      await get().fetchSquad(get().leagueId!);
    } catch (err: any) {
      set({ error: err?.response?.data?.detail ?? 'Transfer failed' });
      throw err;
    }
  },

  activateWildcard: async () => {
    const { squad } = get();
    if (!squad) return;
    await api.post(`/squads/${squad.id}/wildcard`);
    await get().fetchSquad(get().leagueId!);
  },

  setCaptain: async (playerId) => {
    const { squad } = get();
    if (!squad) return;
    // Build lineup payload with new captain
    const players = squad.players.map((sp) => ({
      ...sp,
      is_captain: sp.player_id === playerId,
      is_vice_captain: false,
    }));
    await api.put(`/squads/${squad.id}/lineup`, { players });
    await get().fetchSquad(get().leagueId!);
  },
}));
