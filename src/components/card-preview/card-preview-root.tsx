"use client";

import React, { useMemo, useState } from "react";

import { ChevronDown, ChevronUp } from "lucide-react";

import { PROJECTIVE_PLANE_ORDER, TOTAL_CARDS } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";
import { generateProjectivePlane } from "@/lib/utils/game-core";
import { useSymbolStore } from "@/store/use-symbol-store";

import { GameCard } from "./game-card";

export const CardPreview: React.FC = () => {
  const { symbols } = useSymbolStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const rawCards = useMemo(
    () => generateProjectivePlane(PROJECTIVE_PLANE_ORDER).slice(0, TOTAL_CARDS),
    [PROJECTIVE_PLANE_ORDER],
  );

  return (
    <div className="bg-card border-border mb-6 rounded-2xl border pt-6 pb-1 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
      <div className="mb-5 px-8">
        <span className="bg-primary-soft text-primary mb-2 block inline-flex w-fit items-center rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-widest uppercase">
          Step 2
        </span>
        <h2 className="text-card-foreground mb-1 text-xl font-extrabold tracking-tight">
          Preview Card Deck
        </h2>
        <p className="text-muted-foreground text-sm">
          Check all generated cards. Every pair shares exactly one symbol.
        </p>
      </div>
      <div className="relative">
        <div
          className={cn(
            "grid grid-cols-1 justify-items-center gap-8 overflow-hidden px-8 pt-3 transition-all duration-500 ease-in-out sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
            !isExpanded ? "max-h-[340px]" : "max-h-[50000px] pb-6",
          )}
        >
          {rawCards.map((cardIndices, cardIdx) => (
            <GameCard key={cardIdx} cardIdx={cardIdx} cardIndices={cardIndices} symbols={symbols} />
          ))}
        </div>

        {!isExpanded && (
          <div className="from-card via-card/80 pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent" />
        )}
      </div>

      <div
        className={cn(
          "border-muted flex justify-center border-t border-dashed pt-1",
          isExpanded ? "mt-4" : "mt-2",
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary hover:bg-primary/5 flex items-center gap-2 rounded-full px-6 py-2 text-sm font-bold transition-all active:scale-95"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={20} />
              Show Fewer Cards
            </>
          ) : (
            <>
              <ChevronDown size={20} />
              Show All {TOTAL_CARDS} Cards
            </>
          )}
        </button>
      </div>
    </div>
  );
};
