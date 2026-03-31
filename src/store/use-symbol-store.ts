import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";

import { getDb, setDb, delDb, DB_KEYS } from "@/lib/db";
import { Transformation, MaskPath } from "@/lib/utils/image-processing";

export interface SymbolData {
  id: number;
  url: string | null; // Display-ready sticker (300px WebP)
  sourceId: string | null; // Reference to hi-res source in IDB
  name: string;
  transformation: Transformation;
  maskData: MaskPath[];
}

interface SymbolState {
  symbols: SymbolData[];
  hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  /** Sets both the final display URL and the high-res source for a slot */
  setSymbolWithSource: (id: number, url: string, sourceUrl: string) => void;
  /** Update only the display result (e.g. after masking) */
  setSymbolResult: (id: number, url: string) => void;
  updateTransformation: (id: number, transformation: Transformation) => void;
  updateMaskData: (id: number, maskData: MaskPath[]) => void;
  removeSymbol: (id: number) => void;
  clearAll: () => void;
  isComplete: (requiredCount: number) => boolean;
  getSourceImage: (id: number) => Promise<string | null>;
}

const DEFAULT_TRANSFORM: Transformation = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };

// Support up to Order 11 (133 symbols) + some buffer
const MAX_POSSIBLE_SYMBOLS = 150;

const INITIAL_SYMBOLS: SymbolData[] = Array.from({ length: MAX_POSSIBLE_SYMBOLS }, (_, i) => ({
  id: i,
  url: null,
  sourceId: null,
  name: `Symbol ${i + 1}`,
  transformation: { ...DEFAULT_TRANSFORM },
  maskData: [],
}));

/** IndexedDB key for persisted symbol data */
const STORAGE_KEY = "twin-blitz-symbols";

/** Custom storage adapter for Zustand -> idb-keyval */
const localIndexedDbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    return (await getDb(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === "undefined") return;
    await setDb(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === "undefined") return;
    await delDb(name);
  },
};

export const useSymbolStore = create<SymbolState>()(
  persist(
    (set, get) => ({
      symbols: INITIAL_SYMBOLS,
      hasHydrated: false,
      setHasHydrated: (state) => set({ hasHydrated: state }),

      setSymbolWithSource: async (id, url, sourceUrl) => {
        const sourceId = `source-${id}-${Date.now()}`;
        await setDb(DB_KEYS.SOURCE_IMAGE(sourceId), sourceUrl);
        set((state) => ({
          symbols: state.symbols.map((s) =>
            s.id === id
              ? {
                  ...s,
                  url,
                  sourceId,
                  transformation: { ...DEFAULT_TRANSFORM },
                  maskData: [],
                }
              : s,
          ),
        }));
      },

      setSymbolResult: (id, url) =>
        set((state) => ({
          symbols: state.symbols.map((s) => (s.id === id ? { ...s, url } : s)),
        })),

      updateTransformation: (id, transformation) =>
        set((state) => ({
          symbols: state.symbols.map((s) => (s.id === id ? { ...s, transformation } : s)),
        })),

      updateMaskData: (id, maskData) =>
        set((state) => ({
          symbols: state.symbols.map((s) => (s.id === id ? { ...s, maskData } : s)),
        })),

      removeSymbol: async (id) => {
        const symbol = get().symbols.find((s) => s.id === id);
        if (symbol?.sourceId) {
          await delDb(DB_KEYS.SOURCE_IMAGE(symbol.sourceId));
        }
        set((state) => ({
          symbols: state.symbols.map((s) =>
            s.id === id
              ? {
                  ...s,
                  url: null,
                  sourceId: null,
                  transformation: { ...DEFAULT_TRANSFORM },
                  maskData: [],
                }
              : s,
          ),
        }));
      },

      clearAll: async () => {
        const { symbols } = get();
        for (const s of symbols) {
          if (s.sourceId) {
            await delDb(DB_KEYS.SOURCE_IMAGE(s.sourceId));
          }
        }
        set({ symbols: INITIAL_SYMBOLS });
      },

      isComplete: (requiredCount: number) => {
        const activeSymbols = get().symbols.slice(0, requiredCount);
        return activeSymbols.every((s) => s.url !== null);
      },

      getSourceImage: async (id: number) => {
        const symbol = get().symbols.find((s) => s.id === id);
        if (!symbol?.sourceId) return null;
        const data = await getDb(DB_KEYS.SOURCE_IMAGE(symbol.sourceId));
        return (data as string) || null;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localIndexedDbStorage),
      partialize: (state) => ({ symbols: state.symbols }),
      onRehydrateStorage: (state) => {
        return (rehydratedState, error) => {
          if (rehydratedState && !error) {
            // Migration: Ensure the array is padded to MAX_POSSIBLE_SYMBOLS
            // This handles cases where users had fewer slots in their localStorage
            const currentSymbols = rehydratedState.symbols || [];
            if (currentSymbols.length < MAX_POSSIBLE_SYMBOLS) {
              const paddingCount = MAX_POSSIBLE_SYMBOLS - currentSymbols.length;
              const startId = currentSymbols.length;
              const padding = Array.from({ length: paddingCount }, (_, i) => ({
                id: startId + i,
                url: null,
                sourceId: null,
                name: `Symbol ${startId + i + 1}`,
                transformation: { ...DEFAULT_TRANSFORM },
                maskData: [],
              }));
              rehydratedState.symbols = [...currentSymbols, ...padding];
            }
          }
          state.setHasHydrated(true);
        };
      },
    },
  ),
);
