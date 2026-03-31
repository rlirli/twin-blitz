import { mulberry32 } from "./random";

export interface LayoutSpot {
  x: number; // 0-100
  y: number; // 0-100
  baseScale: number;
}

/**
 * Pre-defined optimized layouts for different symbol counts.
 */
const LAYOUT_MAP: Record<number, LayoutSpot[]> = {
  5: [
    { x: 50, y: 50, baseScale: 1.8 },
    { x: 80, y: 50, baseScale: 1.4 },
    { x: 50, y: 80, baseScale: 1.4 },
    { x: 20, y: 50, baseScale: 1.4 },
    { x: 50, y: 20, baseScale: 1.4 },
  ],
  6: [
    { x: 50, y: 50, baseScale: 1.7 },
    { x: 78, y: 38, baseScale: 1.3 },
    { x: 65, y: 75, baseScale: 1.3 },
    { x: 35, y: 75, baseScale: 1.3 },
    { x: 22, y: 38, baseScale: 1.3 },
    { x: 50, y: 18, baseScale: 1.3 },
  ],
  8: [
    { x: 50, y: 50, baseScale: 1.45 },
    { x: 82, y: 50, baseScale: 1.1 },
    { x: 70, y: 75, baseScale: 1.31 },
    { x: 43, y: 81, baseScale: 1.0 },
    { x: 21, y: 64, baseScale: 1.21 },
    { x: 21, y: 36, baseScale: 1.16 },
    { x: 43, y: 19, baseScale: 1.26 },
    { x: 70, y: 25, baseScale: 1.05 },
  ],
  9: [
    { x: 50, y: 50, baseScale: 1.4 },
    { x: 80, y: 50, baseScale: 1.1 },
    { x: 71, y: 71, baseScale: 1.1 },
    { x: 50, y: 80, baseScale: 1.1 },
    { x: 29, y: 71, baseScale: 1.1 },
    { x: 20, y: 50, baseScale: 1.1 },
    { x: 29, y: 29, baseScale: 1.1 },
    { x: 50, y: 20, baseScale: 1.1 },
    { x: 71, y: 29, baseScale: 1.1 },
  ],
  10: [
    { x: 50, y: 50, baseScale: 1.35 },
    { x: 75, y: 35, baseScale: 1.0 },
    { x: 82, y: 58, baseScale: 1.0 },
    { x: 67, y: 79, baseScale: 1.0 },
    { x: 45, y: 84, baseScale: 1.0 },
    { x: 22, y: 72, baseScale: 1.0 },
    { x: 18, y: 46, baseScale: 1.0 },
    { x: 31, y: 23, baseScale: 1.0 },
    { x: 55, y: 16, baseScale: 1.0 },
    { x: 77, y: 14, baseScale: 0.9 }, // Offset outer
  ],
};

export interface SymbolPlacement {
  x: number; // 0-100
  y: number; // 0-100
  rotation: number; // 0-359
  scale: number; // Multiplier
}

/**
 * Deterministically generates placements for all symbols on a card.
 * Ensures the UI and Exporter always render identical layouts.
 */
export function getCardPlacements(cardIdx: number, symbolsPerCard: number): SymbolPlacement[] {
  const spots = LAYOUT_MAP[symbolsPerCard] || LAYOUT_MAP[8]; // Fallback to 8
  const seedBase = cardIdx * 1337;

  return spots.map((spot, index) => {
    const rand = mulberry32(seedBase + index);
    const rotation = Math.floor(rand() * 360);
    const scaleMod = 0.8 + rand() * 0.45;

    return {
      x: spot.x,
      y: spot.y,
      rotation,
      scale: spot.baseScale * scaleMod,
    };
  });
}
