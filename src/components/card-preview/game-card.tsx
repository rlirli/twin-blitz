import React from "react";

import { cn } from "@/lib/utils/cn";
import { getCardPlacements } from "@/lib/utils/layout-engine";
import { SymbolData } from "@/store/use-symbol-store";

import { CardSymbol } from "./card-symbol";

interface GameCardProps {
  cardIdx: number;
  cardIndices: number[];
  symbols: SymbolData[];
  size?: number;
  showShadow?: boolean;
  showLabel?: boolean;
  interactive?: boolean;
  className?: string;
}

export const GameCard: React.FC<GameCardProps> = ({
  cardIdx,
  cardIndices,
  symbols,
  size = 250,
  showShadow = true,
  showLabel = true,
  interactive = true,
  className,
}) => {
  const placements = React.useMemo(() => getCardPlacements(cardIdx), [cardIdx]);

  return (
    <div
      className={cn(
        "group relative flex aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-white",
        showShadow && "shadow-lg",
        interactive && "transition-transform hover:scale-105",
        className,
      )}
      style={{ width: `${size}px`, maxWidth: "100%" }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-full border-4 border-dashed border-gray-50" />

      {showLabel && (
        <div className="pointer-events-none absolute top-[5%] left-1/2 -translate-x-1/2 font-mono text-[max(8px,1.5vw)] text-gray-300 select-none md:text-[10px]">
          CARD #{cardIdx + 1}
        </div>
      )}

      {cardIndices.map((symbolIdx, i) => {
        const symbol = symbols[symbolIdx];
        const placement = placements[i];

        return (
          <CardSymbol
            key={symbolIdx}
            symbolIdx={symbolIdx}
            url={symbol.url}
            relativeSize={20} // 20% of card size
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
