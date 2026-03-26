/**
 * Generates a finite projective plane of order p.
 * The number of points (symbols) and lines (cards) will be p^2 + p + 1.
 * Each line will have p + 1 points.
 * Each point will be on p + 1 lines.
 * Any two lines will intersect at exactly one point.
 *
 * @param p The order of the projective plane (must be a prime power, e.g., 2, 3, 4, 5, 7, 8, 9, 11).
 *          For standard Twin Blitz, p = 7.
 */
export function generateProjectivePlane(p: number): number[][] {
  const cards: number[][] = [];

  // 1. Add p^2 cards (ordinary lines)
  // For each slope m and intercept b
  for (let m = 0; m < p; m++) {
    for (let b = 0; b < p; b++) {
      const card: number[] = [];
      // Ordinary points (x, mx + b)
      for (let x = 0; x < p; x++) {
        card.push(x * p + ((m * x + b) % p));
      }
      // Point at infinity (slope category)
      card.push(p * p + m);
      cards.push(card);
    }
  }

  // 2. Add p cards (vertical lines)
  // For each vertical intercept x0
  for (let x0 = 0; x0 < p; x0++) {
    const card: number[] = [];
    for (let y = 0; y < p; y++) {
      card.push(x0 * p + y);
    }
    // Point at absolute infinity
    card.push(p * p + p);
    cards.push(card);
  }

  // 3. Add 1 card (line at infinity)
  const infiniteCard: number[] = [];
  for (let m = 0; m < p; m++) {
    infiniteCard.push(p * p + m);
  }
  infiniteCard.push(p * p + p);
  cards.push(infiniteCard);

  return cards;
}

/**
 * Validates that the generated cards follow the game rule:
 * Every pair of cards shares exactly one symbol.
 */
export function validateCards(cards: number[][]): boolean {
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const intersection = cards[i].filter((symbol) => cards[j].includes(symbol));
      if (intersection.length !== 1) {
        console.error(
          `Cards ${i} and ${j} have ${intersection.length} common symbols:`,
          intersection,
        );
        return false;
      }
    }
  }
  return true;
}
