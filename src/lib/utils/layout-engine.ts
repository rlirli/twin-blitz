import { mulberry32 } from "./random";

/**
 * Normalized layout spots for a card.
 * x, y: 0-100 (percentage of card diameter)
 * baseScale: multiplier for symbol size
 */
export const CARD_LAYOUT_SPOTS = [
  { x: 50, y: 50, baseScale: 1.45 }, // Center
  { x: 82, y: 50, baseScale: 1.1 }, // East
  { x: 70, y: 75, baseScale: 1.31 }, // South-East
  { x: 43, y: 81, baseScale: 1.0 }, // South
  { x: 21, y: 64, baseScale: 1.21 }, // South-West
  { x: 21, y: 36, baseScale: 1.16 }, // North-West
  { x: 43, y: 19, baseScale: 1.26 }, // North
  { x: 70, y: 25, baseScale: 1.05 }, // North-East
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
    const scaleMod = 0.8 + rand() * 0.45; // Subtle variation (0.80x to 1.3x)

    return {
      x: spot.x,
      y: spot.y,
      rotation,
      scale: spot.baseScale * scaleMod,
    };
  });
}
