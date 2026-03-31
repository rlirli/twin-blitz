import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DeckSettingsState {
  order: number;
  totalSymbolCount: number;
  totalCardCount: number;
  symbolsPerCard: number;
  setOrder: (order: number) => void;
  setTotalCardCount: (count: number) => void;
}

const calculateCounts = (order: number) => ({
  totalSymbolCount: order * order + order + 1,
  totalCardCount: order * order + order + 1,
  symbolsPerCard: order + 1,
});

export const useDeckSettingsStore = create<DeckSettingsState>()(
  persist(
    (set) => ({
      order: 7,
      ...calculateCounts(7),
      setOrder: (order: number) => {
        set({ order, ...calculateCounts(order) });
      },
      setTotalCardCount: (totalCardCount: number) => set({ totalCardCount }),
    }),
    {
      name: "twin-blitz-settings",
    },
  ),
);
