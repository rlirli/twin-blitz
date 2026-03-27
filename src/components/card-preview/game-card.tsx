import React from "react";

import { mulberry32 } from "@/lib/utils/random";
import { SymbolSlot } from "@/store/use-symbol-store";

import { CardSymbol } from "./card-symbol";

interface GameCardProps {
  cardIdx: number;
  cardIndices: number[];
  symbols: SymbolSlot[];
}

const getSymbolPlacement = (seed: number, index: number) => {
  const rand = mulberry32(seed + index);

  const layout = [
    { x: 50, y: 50, scale: 1.38 }, // Center
    { x: 26, y: 26, scale: 1.05 },
    { x: 74, y: 26, scale: 1.25 },
    { x: 26, y: 74, scale: 0.95 },
    { x: 74, y: 74, scale: 1.15 },
    { x: 50, y: 18, scale: 1.1 },
    { x: 50, y: 82, scale: 1.2 },
    { x: 18, y: 50, scale: 1.0 },
  ];

  const pos = layout[index];
  const rotation = Math.floor(rand() * 360);
  const scaleMod = 0.8 + rand() * 0.5;

  return {
    left: `${pos.x}%`,
    top: `${pos.y}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${pos.scale * scaleMod})`,
  };
};

export const GameCard: React.FC<GameCardProps> = ({ cardIdx, cardIndices, symbols }) => {
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
        const placement = getSymbolPlacement(cardIdx * 100, i);

        return (
          <CardSymbol
            key={symbolIdx}
            symbolIdx={symbolIdx}
            url={symbol.url}
            placement={placement as React.CSSProperties}
          />
        );
      })}
    </div>
  );
};
