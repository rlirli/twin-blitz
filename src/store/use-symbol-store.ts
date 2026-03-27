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
  setBulkSymbols: (updates: { id: number; url: string }[]) => void;
  removeSymbol: (id: number) => void;
  clearAll: () => void;
  isComplete: () => boolean;
}

import { TOTAL_SYMBOLS } from "@/lib/constants";

const INITIAL_SYMBOLS: SymbolSlot[] = Array.from({ length: TOTAL_SYMBOLS }, (_, i) => ({
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
      setBulkSymbols: (updates) =>
        set((state) => {
          const updateMap = new Map(updates.map((u) => [u.id, u.url]));
          return {
            symbols: state.symbols.map((s) =>
              updateMap.has(s.id) ? { ...s, url: updateMap.get(s.id)! } : s,
            ),
          };
        }),
      removeSymbol: (id) =>
        set((state) => ({
          symbols: state.symbols.map((s) => (s.id === id ? { ...s, url: null } : s)),
        })),
      clearAll: () => {
        set({ symbols: INITIAL_SYMBOLS });
      },
      isComplete: () => get().symbols.every((s) => s.url !== null),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ symbols: state.symbols }),
    },
  ),
);
