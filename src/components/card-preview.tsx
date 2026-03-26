"use client";

import React, { useMemo } from "react";

import * as LucideIcons from "lucide-react";

import { generateProjectivePlane } from "@/lib/utils/game-core";
import { useSymbolStore } from "@/store/use-symbol-store";

// Deterministic random generator based on a seed
const mulberry32 = (a: number) => {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const CardPreview: React.FC = () => {
  const { symbols } = useSymbolStore();
  const rawCards = useMemo(() => generateProjectivePlane(7), []);

  // Positions for 8 symbols in a circle + 1 in the middle
  // To avoid overlapping, we use a more balanced approach
  const getSymbolPlacement = (seed: number, index: number) => {
    const rand = mulberry32(seed + index);

    // 8 points around a center
    // We'll place 2 in the inner ring, 5 in the outer ring, 1 in the very center?
    // Actually, let's just use a fixed layout for 8 symbols to ensure no overlap.
    const layout = [
      { x: 50, y: 50, scale: 1.2 }, // Center
      { x: 30, y: 30, scale: 0.9 },
      { x: 70, y: 30, scale: 1.1 },
      { x: 30, y: 70, scale: 0.8 },
      { x: 70, y: 70, scale: 1.0 },
      { x: 50, y: 22, scale: 0.95 },
      { x: 50, y: 78, scale: 1.05 },
      { x: 22, y: 50, scale: 0.85 },
      { x: 78, y: 50, scale: 1.15 },
    ];

    const pos = layout[index];
    const rotation = Math.floor(rand() * 360);
    const scaleMod = 0.8 + rand() * 0.5; // Random scale variation

    return {
      left: `${pos.x}%`,
      top: `${pos.y}%`,
      transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${pos.scale * scaleMod})`,
    };
  };

  return (
    <div className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">2. Preview Cards</h2>
          <p className="text-gray-500">Checking the 57 generated cards.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {rawCards.map((cardIndices, cardIdx) => (
          <div
            key={cardIdx}
            className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-lg transition-transform hover:scale-105"
            style={{ width: "100%", maxWidth: "250px" }}
          >
            {/* 84mm marker (visual only) */}
            <div className="pointer-events-none absolute inset-0 rounded-full border-4 border-dashed border-gray-50" />

            <div className="absolute top-2 left-1/2 -translate-x-1/2 font-mono text-[10px] text-gray-300">
              CARD #{cardIdx + 1}
            </div>

            {cardIndices.map((symbolIdx, i) => {
              const symbol = symbols[symbolIdx];
              const placement = getSymbolPlacement(cardIdx * 100, i);

              return (
                <div key={symbolIdx} className="absolute" style={placement}>
                  {symbol.url ? (
                    symbol.url.startsWith("icon:") ? (
                      <div className="text-gray-800">
                        {(() => {
                          const IconComp = (LucideIcons as any)[symbol.url.split(":")[1]];
                          return IconComp ? (
                            React.createElement(IconComp, { size: 36 })
                          ) : (
                            <LucideIcons.Image size={36} />
                          );
                        })()}
                      </div>
                    ) : (
                      <img src={symbol.url} alt="symbol" className="h-12 w-12 object-contain" />
                    )
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[8px] text-gray-400">
                      S{symbolIdx}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
