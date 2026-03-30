import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";

import { getDb, setDb, delDb, DB_KEYS } from "@/lib/db";
import { Transformation, MaskPath } from "@/lib/utils/image-processing";

export interface SymbolSlot {
  id: number;
  url: string | null; // Display-ready sticker (300px WebP)
  sourceId: string | null; // Reference to hi-res source in IDB
  name: string;
  transformation: Transformation;
  maskData: MaskPath[];
}

interface SymbolState {
  symbols: SymbolSlot[];
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
  isComplete: () => boolean;
  getSourceImage: (id: number) => Promise<string | null>;
}

import { TOTAL_SYMBOLS } from "@/lib/constants";

const DEFAULT_TRANSFORM: Transformation = { x: 0, y: 0, width: 0, height: 0, rotation: 0 };

const INITIAL_SYMBOLS: SymbolSlot[] = Array.from({ length: TOTAL_SYMBOLS }, (_, i) => ({
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

      isComplete: () => get().symbols.every((s) => s.url !== null),

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
        return () => {
          state.setHasHydrated(true);
        };
      },
    },
  ),
);
