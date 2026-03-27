import { mulberry32 } from "./random";

/**
 * Normalized layout spots for a card.
 * x, y: 0-100 (percentage of card diameter)
 * baseScale: multiplier for symbol size
 */
export const CARD_LAYOUT_SPOTS = [
  { x: 50, y: 50, baseScale: 1.38 }, // Center
  { x: 26, y: 26, baseScale: 1.05 },
  { x: 74, y: 26, baseScale: 1.25 },
  { x: 26, y: 74, baseScale: 0.95 },
  { x: 74, y: 74, baseScale: 1.15 },
  { x: 50, y: 18, baseScale: 1.1 },
  { x: 50, y: 82, baseScale: 1.2 },
  { x: 18, y: 50, baseScale: 1.0 },
];

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
export function getCardPlacements(cardIdx: number): SymbolPlacement[] {
  // Each card uses a unique base seed (cardIdx * constant offset)
  const seedBase = cardIdx * 1337;

  return CARD_LAYOUT_SPOTS.map((spot, index) => {
    // Each spot on the card has its own supplemental seed
    const rand = mulberry32(seedBase + index);

    const rotation = Math.floor(rand() * 360);
    const scaleMod = 0.85 + rand() * 0.45; // Subtle variation (0.85x to 1.3x)

    return {
      x: spot.x,
      y: spot.y,
      rotation,
      scale: spot.baseScale * scaleMod,
    };
  });
}
