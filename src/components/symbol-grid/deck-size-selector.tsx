import React, { useState, useRef, useEffect } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { getCardPlacements } from "@/lib/utils/layout-engine";
import { useDeckSettingsStore } from "@/store/use-settings-store";

/**
 * Metadata for deck sizes.
 * order: Mathematical basis (n)
 * symbolsPerCard: (n + 1)
 * cards: Final deck size (n² + n + 1)
 *
 * Note: `symbolsPerCard` and `cards` in DECK_OPTIONS have no direct effect.
 * Only `order` is used to set the value in the useDeckSettingsStore, which in
 * turn determines the number of symbols per card and the total number of cards.
 * The values are kept here for UI labels and potential future i18n/metadata needs.
 */
export const DECK_OPTIONS = [
  {
    order: 4,
    symbolsPerCard: 5,
    cards: 21,
    totalSymbols: 21,
    label: "5 symbols per card (21 cards)",
  },
  {
    order: 5,
    symbolsPerCard: 6,
    cards: 31,
    totalSymbols: 31,
    label: "6 symbols per card (31 cards)",
  },
  {
    order: 7,
    symbolsPerCard: 8,
    cards: 57,
    totalSymbols: 57,
    label: "8 symbols per card (57 cards) — Classic",
  },
  {
    order: 8,
    symbolsPerCard: 9,
    cards: 73,
    totalSymbols: 73,
    label: "9 symbols per card (73 cards)",
  },
  {
    order: 9,
    symbolsPerCard: 10,
    cards: 91,
    totalSymbols: 91,
    label: "10 symbols per card (91 cards)",
  },
];

/**
 * A mini card representation showing the arrangement of symbols.
 * Uses getCardPlacements(0, ...) to ensure visual consistency with the actual cards.
 */
const DeckIcon = ({
  symbolsPerCard,
  className,
}: {
  symbolsPerCard: number;
  className?: string;
}) => {
  const placements = getCardPlacements(0, symbolsPerCard);

  return (
    <div
      className={cn(
        "border-border relative aspect-square w-10 shrink-0 rounded-full border bg-white transition-colors dark:bg-zinc-900",
        className,
      )}
    >
      {placements.map((p, i) => (
        <div
          key={i}
          className="absolute h-[18%] w-[18%] rounded-full bg-current transition-colors"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
};

export const DeckSizeSelector: React.FC = () => {
  const { order, setOrder } = useDeckSettingsStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = DECK_OPTIONS.find((opt) => opt.order === order) || DECK_OPTIONS[2];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative w-full sm:w-auto" ref={containerRef}>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "bg-primary-soft text-primary grid h-full w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-transparent px-3 py-0 transition-all active:scale-[0.98] sm:flex sm:w-auto sm:px-4",
          isOpen
            ? "ring-primary/20 border-primary/30 shadow-sm ring-2"
            : "hover:border-primary/40 hover:brightness-105",
        )}
      >
        <DeckIcon
          symbolsPerCard={currentOption.symbolsPerCard}
          className="border-primary/20 -top-2 h-12 w-12 scale-120 shadow-lg"
        />
        <div className="flex flex-col items-start leading-tight">
          <span className="mb-[0.2rem] text-sm leading-none font-bold tracking-tight whitespace-nowrap md:text-base">
            {currentOption.symbolsPerCard} Symbols per card
          </span>
          <span className="text-[0.65rem] font-bold tracking-wider uppercase opacity-75">
            {currentOption.totalSymbols} symbols • {currentOption.cards} cards
          </span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown size={14} className="opacity-50" />
        </motion.div>
      </button>

      {/* ── Dropdown Popover ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className={cn(
              "border-primary bg-card absolute top-full z-50 mt-2 block overflow-hidden rounded-xl border p-1.5 shadow-2xl backdrop-blur-xl md:w-72",
              "fixed inset-x-4 top-auto bottom-8 md:absolute md:inset-x-auto md:bottom-auto md:left-0",
            )}
          >
            <div className="flex flex-col gap-1">
              <div className="px-3 py-2 text-[0.6rem] font-black tracking-widest text-zinc-400 uppercase">
                Choose Deck Complexity
              </div>
              {DECK_OPTIONS.map((opt) => {
                const isActive = opt.order === order;
                return (
                  <button
                    key={opt.order}
                    onClick={() => {
                      setOrder(opt.order);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-4 rounded-xl px-3 py-2 text-left transition-all",
                      isActive
                        ? "bg-primary/5 border-primary/20 border"
                        : "hover:bg-muted border border-transparent",
                    )}
                  >
                    <DeckIcon
                      symbolsPerCard={opt.symbolsPerCard}
                      className={cn(
                        "h-12 w-12",
                        isActive
                          ? "border-primary/30 text-primary"
                          : "text-zinc-300 dark:text-zinc-600",
                      )}
                    />
                    <div className="flex flex-col gap-0.5">
                      <span
                        className={cn(
                          "text-sm leading-tight font-bold tracking-tight",
                          isActive ? "text-primary" : "text-card-foreground",
                        )}
                      >
                        {opt.symbolsPerCard} Symbols per card
                      </span>
                      <span className="text-muted-foreground text-[0.65rem] font-medium">
                        {opt.totalSymbols} symbols total • {opt.cards} cards
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
