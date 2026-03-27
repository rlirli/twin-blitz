import React from "react";

import { getCardPlacements } from "@/lib/utils/layout-engine";
import { SymbolSlot } from "@/store/use-symbol-store";

import { CardSymbol } from "./card-symbol";

interface GameCardProps {
  cardIdx: number;
  cardIndices: number[];
  symbols: SymbolSlot[];
}

export const GameCard: React.FC<GameCardProps> = ({ cardIdx, cardIndices, symbols }) => {
  const placements = React.useMemo(() => getCardPlacements(cardIdx), [cardIdx]);

  return (
    <div
      className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-white shadow-lg transition-transform hover:scale-105"
      style={{ width: "100%", maxWidth: "250px" }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-full border-4 border-dashed border-gray-50" />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 font-mono text-[10px] text-gray-300">
        CARD #{cardIdx + 1}
      </div>

      {cardIndices.map((symbolIdx, i) => {
        const symbol = symbols[symbolIdx];
        const placement = placements[i];

        return (
          <CardSymbol
            key={symbolIdx}
            symbolIdx={symbolIdx}
            url={symbol.url}
            placement={
              {
                left: `${placement.x}%`,
                top: `${placement.y}%`,
                transform: `translate(-50%, -50%) rotate(${placement.rotation}deg) scale(${placement.scale})`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
};
