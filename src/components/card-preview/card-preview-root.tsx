"use client";

import React, { useMemo } from "react";

import { PROJECTIVE_PLANE_ORDER } from "@/lib/constants";
import { generateProjectivePlane } from "@/lib/utils/game-core";
import { useSymbolStore } from "@/store/use-symbol-store";

import { GameCard } from "./game-card";

export const CardPreview: React.FC = () => {
  const { symbols } = useSymbolStore();
  const rawCards = useMemo(() => generateProjectivePlane(PROJECTIVE_PLANE_ORDER), []);

  return (
    <div className="bg-card border-border mb-16 rounded-2xl border px-8 py-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
      <div className="mb-8">
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
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {rawCards.map((cardIndices, cardIdx) => (
          <GameCard key={cardIdx} cardIdx={cardIdx} cardIndices={cardIndices} symbols={symbols} />
        ))}
      </div>
    </div>
  );
};
