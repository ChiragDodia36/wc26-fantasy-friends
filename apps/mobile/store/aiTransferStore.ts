/**
 * Zustand store for on-device AI transfer suggestions.
 * Manages model lifecycle, transfer context fetching, and streaming inference.
 */
import { create } from 'zustand';
import api from '@/services/api';
import { isModelDownloaded, downloadModel } from '@/services/modelManager';
import {
  initModel,
  isModelLoaded,
  isLlamaAvailable,
  suggestTransfers,
  parseTransferAnswer,
} from '@/services/llmInference';
import type { TransferContext, TransferSwap, PlayerContext } from '@/types/ai';
import { useSquadStore } from '@/store/squadStore';

interface AITransferState {
  // Model lifecycle
  modelReady: boolean;
  modelDownloading: boolean;
  downloadProgress: number;

  // Transfer context from backend
  transferContext: TransferContext | null;
  loadingContext: boolean;

  // Inference state
  inferring: boolean;
  thinkingText: string;
  answerText: string;
  swaps: TransferSwap[];
  summary: string;
  confidence: number;
  error: string | null;

  // Actions
  ensureModel: () => Promise<void>;
  fetchContext: (squadId: string) => Promise<void>;
  runInference: () => Promise<void>;
  reset: () => void;
}

/**
 * Build a TransferContext from local squad store data when backend is unavailable.
 * Uses squad players + all loaded players to create candidate list.
 */
function buildLocalTransferContext(): TransferContext | null {
  const { squad, players } = useSquadStore.getState();
  if (!squad || players.length === 0) return null;

  const squadPlayerIds = new Set(squad.players.map((sp) => sp.player_id));

  const toPlayerContext = (p: typeof players[0], sp?: typeof squad.players[0]): PlayerContext => ({
    player_id: p.id,
    name: p.name,
    position: p.position,
    price: Number(p.price),
    team_id: p.team_id,
    team_name: p.team_name ?? null,
    is_starting: sp?.is_starting,
    is_captain: sp?.is_captain,
    form_last_5: [],
    avg_form: Math.round(Math.random() * 4 + 3), // placeholder 3-7
    upcoming_fdr: null,
  });

  const squadPlayers: PlayerContext[] = squad.players
    .map((sp) => {
      const p = players.find((pl) => pl.id === sp.player_id);
      return p ? toPlayerContext(p, sp) : null;
    })
    .filter(Boolean) as PlayerContext[];

  const candidatePlayers: PlayerContext[] = players
    .filter((p) => !squadPlayerIds.has(p.id))
    .slice(0, 100)
    .map((p) => toPlayerContext(p));

  return {
    squad_id: squad.id,
    budget_remaining: squad.budget_remaining ?? 0,
    free_transfers_remaining: squad.free_transfers_remaining ?? 1,
    squad_players: squadPlayers,
    upcoming_matches: [],
    candidate_players: candidatePlayers,
    max_transfers: 3,
    past_lessons: [],
  };
}

export const useAITransferStore = create<AITransferState>((set, get) => ({
  modelReady: false,
  modelDownloading: false,
  downloadProgress: 0,

  transferContext: null,
  loadingContext: false,

  inferring: false,
  thinkingText: '',
  answerText: '',
  swaps: [],
  summary: '',
  confidence: 0,
  error: null,

  ensureModel: async () => {
    if (isModelLoaded()) {
      set({ modelReady: true });
      return;
    }

    // Check if llama.rn native module is available before attempting anything
    if (!isLlamaAvailable()) {
      set({ error: 'llama.rn is not available. AI features require a native dev build (npx expo run:ios).' });
      return;
    }

    try {
      // Download the model file if not already on disk
      const downloaded = await isModelDownloaded();
      console.log('[AI] Model already downloaded:', downloaded);
      if (!downloaded) {
        set({ modelDownloading: true, downloadProgress: 0 });
        await downloadModel((pct) => set({ downloadProgress: pct }));
        set({ modelDownloading: false });
        console.log('[AI] Model download complete');
      }
      // Initialize llama.rn with the downloaded model
      console.log('[AI] Initializing llama.rn...');
      await initModel();
      console.log('[AI] Model ready');
      set({ modelReady: true });
    } catch (err: any) {
      const raw = err?.message ?? String(err);
      // Map cryptic native errors to user-friendly messages
      const msg = raw.includes("'install' of null") || raw.includes("'initLlama' of null")
        ? 'llama.rn native module not found. Run "npx expo run:ios --device" to build for your phone.'
        : raw;
      console.warn('[AI] ensureModel failed:', msg);
      set({
        modelDownloading: false,
        error: msg || 'Failed to load model',
      });
    }
  },

  fetchContext: async (squadId) => {
    set({ loadingContext: true, error: null });
    try {
      const res = await api.get<TransferContext>(
        `/ai/transfer-context?squad_id=${squadId}`,
      );
      set({ transferContext: res.data, loadingContext: false });
    } catch (err: any) {
      // Fallback: build transfer context locally from squad store data
      const localCtx = buildLocalTransferContext();
      if (localCtx) {
        console.log('[AI] Backend unavailable, using local squad data for transfer context');
        set({ transferContext: localCtx, loadingContext: false });
      } else {
        set({
          loadingContext: false,
          error: err?.response?.data?.detail ?? 'Failed to load transfer data',
        });
      }
    }
  },

  runInference: async () => {
    const { transferContext } = get();
    if (!transferContext) {
      set({ error: 'No transfer context loaded' });
      return;
    }

    set({
      inferring: true,
      thinkingText: '',
      answerText: '',
      swaps: [],
      summary: '',
      confidence: 0,
      error: null,
    });

    await suggestTransfers(transferContext, {
      onThinkingToken: (token) => {
        set((s) => ({ thinkingText: s.thinkingText + token }));
      },
      onAnswerToken: (token) => {
        set((s) => ({ answerText: s.answerText + token }));
      },
      onComplete: (fullText) => {
        const parsed = parseTransferAnswer(fullText);
        if (parsed) {
          // Cap at 3 swaps and filter out entries with missing names
          const validSwaps = parsed.swaps
            .filter((s) => s.out_name && s.in_name && s.out_name !== '?' && s.in_name !== '?')
            .slice(0, 3);
          set({
            swaps: validSwaps,
            summary: parsed.summary,
            confidence: parsed.confidence,
            inferring: false,
          });
        } else {
          set({
            inferring: false,
            error: 'Could not parse AI response. Try again.',
          });
        }
      },
      onError: (err) => {
        set({ inferring: false, error: err.message });
      },
    });
  },

  reset: () => {
    set({
      thinkingText: '',
      answerText: '',
      swaps: [],
      summary: '',
      confidence: 0,
      error: null,
      inferring: false,
    });
  },
}));
