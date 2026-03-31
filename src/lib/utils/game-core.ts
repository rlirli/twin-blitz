/**
 * Minimal Galois Field implementation for supported projective plane orders.
 * Orders: 4 (2^2), 5 (5), 7 (7), 8 (2^3), 9 (3^2).
 */
class GaloisField {
  private addTable: number[][];
  private mulTable: number[][];
  readonly n: number;

  constructor(n: number) {
    this.n = n;
    this.addTable = Array.from({ length: n }, () => Array(n).fill(0));
    this.mulTable = Array.from({ length: n }, () => Array(n).fill(0));

    if (this.isPrime(n)) {
      this.initPrimeField(n);
    } else if (n === 4) {
      this.initGF4();
    } else if (n === 8) {
      this.initGF8();
    } else if (n === 9) {
      this.initGF9();
    } else {
      throw new Error(`Order ${n} is not supported (Projective planes require prime power orders)`);
    }
  }

  private isPrime(n: number): boolean {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
    return true;
  }

  private initPrimeField(p: number) {
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        this.addTable[i][j] = (i + j) % p;
        this.mulTable[i][j] = (i * j) % p;
      }
    }
  }

  private initGF4() {
    // GF(4) with irreducible polynomial x^2 + x + 1
    // Elements: 0, 1, 2 (x), 3 (x+1)
    this.addTable = [
      [0, 1, 2, 3],
      [1, 0, 3, 2],
      [2, 3, 0, 1],
      [3, 2, 1, 0],
    ];
    this.mulTable = [
      [0, 0, 0, 0],
      [0, 1, 2, 3],
      [0, 2, 3, 1],
      [0, 3, 1, 2],
    ];
  }

  private initGF8() {
    // GF(8) with irreducible polynomial x^3 + x + 1
    // Using a simple LFSR/Primitive element approach
    const poly = 0b1011; // x^3 + x + 1
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        this.addTable[i][j] = i ^ j;
        let res = 0;
        let a = i,
          b = j;
        for (let k = 0; k < 3; k++) {
          if (b & 1) res ^= a;
          const highBit = a & 0b100;
          a <<= 1;
          if (highBit) a ^= poly;
          b >>= 1;
        }
        this.mulTable[i][j] = res & 0b111;
      }
    }
  }

  private initGF9() {
    // GF(9) = GF(3)[x] / (x^2 + 1)
    // Elements represented as 3a + b (a,b in {0,1,2}) -> a*x + b
    for (let i = 0; i < 9; i++) {
      const a = Math.floor(i / 3),
        b = i % 3;
      for (let j = 0; j < 9; j++) {
        const c = Math.floor(j / 3),
          d = j % 3;
        // Addition: component-wise mod 3
        this.addTable[i][j] = ((a + c) % 3) * 3 + ((b + d) % 3);
        // Multiplication: (ax+b)(cx+d) = acx^2 + (ad+bc)x + bd
        // Since x^2 = -1 = 2 mod 3:
        // = (ad+bc)x + (bd + 2ac)
        const real = (b * d + 2 * a * c) % 3;
        const imag = (a * d + b * c) % 3;
        this.mulTable[i][j] = imag * 3 + real;
      }
    }
  }

  add(a: number, b: number): number {
    return this.addTable[a][b];
  }
  mul(a: number, b: number): number {
    return this.mulTable[a][b];
  }
}

/**
 * Generates a finite projective plane of order n.
 * The number of points (symbols) and lines (cards) will be n^2 + n + 1.
 * Each line will have n + 1 points.
 * Each point will be on n + 1 lines.
 * Any two lines will intersect at exactly one point.
 *
 * @param n The order of the projective plane (must be a prime power, e.g., 2, 3, 4, 5, 7, 8, 9, 11).
 *          For standard Twin Blitz, n = 7.
 */
export function generateProjectivePlane(n: number): number[][] {
  const cards: number[][] = [];
  const field = new GaloisField(n);

  // 1. Add n^2 cards (ordinary lines)
  // For each slope m and intercept b
  for (let m = 0; m < n; m++) {
    for (let b = 0; b < n; b++) {
      const card: number[] = [];
      // Ordinary points (x, y = mx + b)
      for (let x = 0; x < n; x++) {
        const y = field.add(field.mul(m, x), b);
        card.push(x * n + y);
      }
      // Point at infinity (slope category)
      card.push(n * n + m);
      cards.push(card);
    }
  }

  // 2. Add n cards (vertical lines)
  // For each vertical intercept x0
  for (let x0 = 0; x0 < n; x0++) {
    const card: number[] = [];
    for (let y = 0; y < n; y++) {
      card.push(x0 * n + y);
    }
    // Point at absolute infinity
    card.push(n * n + n);
    cards.push(card);
  }

  // 3. Add 1 card (line at infinity)
  const infiniteCard: number[] = [];
  for (let m = 0; m < n; m++) {
    infiniteCard.push(n * n + m);
  }
  infiniteCard.push(n * n + n);
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
