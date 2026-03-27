import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SymbolSlot {
  id: number;
  url: string | null;
  name: string;
}

interface SymbolState {
  symbols: SymbolSlot[];
  setSymbol: (id: number, url: string) => void;
  removeSymbol: (id: number) => void;
  clearAll: () => void;
  isComplete: () => boolean;
}

const INITIAL_SYMBOLS: SymbolSlot[] = Array.from({ length: 57 }, (_, i) => ({
  id: i,
  url: null,
  name: `Symbol ${i + 1}`,
}));

/** localStorage key for persisted symbol data */
const STORAGE_KEY = "twin-blitz-symbols";

export const useSymbolStore = create<SymbolState>()(
  persist(
    (set, get) => ({
      symbols: INITIAL_SYMBOLS,
      setSymbol: (id, url) =>
        set((state) => ({
          symbols: state.symbols.map((s) => (s.id === id ? { ...s, url } : s)),
        })),
      removeSymbol: (id) =>
        set((state) => ({
          symbols: state.symbols.map((s) => (s.id === id ? { ...s, url: null } : s)),
        })),
      clearAll: () => {
        // Reset in-memory state
        set({ symbols: INITIAL_SYMBOLS });
        // Also wipe the persisted localStorage entry so the cleared state is saved
        localStorage.removeItem(STORAGE_KEY);
      },
      isComplete: () => get().symbols.every((s) => s.url !== null),
    }),
    {
      name: STORAGE_KEY,
      // Only persist the symbols array — actions are not serialisable
      partialize: (state) => ({ symbols: state.symbols }),
    },
  ),
);
