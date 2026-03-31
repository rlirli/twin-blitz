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
    { x: 54, y: 50, baseScale: 1.7 },
    { x: 82, y: 35, baseScale: 1.3 },
    { x: 75, y: 75, baseScale: 1.3 },
    { x: 32, y: 78, baseScale: 1.3 },
    { x: 22, y: 38, baseScale: 1.3 },
    { x: 50, y: 18, baseScale: 1.3 },
  ],
  8: [
    { x: 50, y: 50, baseScale: 1.45 },
    { x: 82, y: 50, baseScale: 1.1 },
    { x: 70, y: 75, baseScale: 1.31 },
    { x: 46, y: 85, baseScale: 1.0 },
    { x: 21, y: 64, baseScale: 1.21 },
    { x: 21, y: 36, baseScale: 1.16 },
    { x: 43, y: 19, baseScale: 1.26 },
    { x: 70, y: 25, baseScale: 1.05 },
  ],
  9: [
    { x: 50.0, y: 50.0, baseScale: 1.95 },
    { x: 86.0, y: 50.0, baseScale: 1.05 },
    { x: 75.5, y: 75.5, baseScale: 1.4 },
    { x: 50.0, y: 86.0, baseScale: 1.15 },
    { x: 24.5, y: 75.5, baseScale: 0.85 },
    { x: 14.0, y: 50.0, baseScale: 1.2 },
    { x: 24.5, y: 24.5, baseScale: 1.0 },
    { x: 50.0, y: 14.0, baseScale: 1.25 },
    { x: 75.5, y: 24.5, baseScale: 1.1 },
  ],
  10: [
    { x: 36.9, y: 15.5, baseScale: 1.15 },
    { x: 63.1, y: 15.5, baseScale: 0.85 },
    { x: 17.3, y: 33.0, baseScale: 1.0 },
    { x: 82.7, y: 33.0, baseScale: 1.3 },
    { x: 50.0, y: 38.2, baseScale: 0.95 },
    { x: 14.2, y: 59.0, baseScale: 1.25 },
    { x: 85.8, y: 59.0, baseScale: 0.9 },
    { x: 50.0, y: 62.5, baseScale: 1.1 },
    { x: 37.2, y: 84.5, baseScale: 0.8 },
    { x: 67.8, y: 81.5, baseScale: 1.2 },
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
