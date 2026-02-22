/**
 * Zustand auth store.
 *
 * State is kept minimal — the source of truth for "is the user logged in"
 * is the presence of a JWT in SecureStore. The store reflects that state
 * in memory for fast React reads without async lookups.
 */
import { create } from 'zustand';
import { clearToken } from '@/services/storage';
import { signOut as firebaseSignOut } from '@/services/firebaseAuth';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true, // true until startup token check completes

  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setLoading: (value) => set({ isLoading: value }),

  logout: async () => {
    await clearToken();
    await firebaseSignOut();
    set({ isAuthenticated: false });
  },
}));
