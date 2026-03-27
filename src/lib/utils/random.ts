/**
 * Deterministic PRNG based on a 32-bit seed.
 * Useful for consistent layouts in procedural generation.
 */
export const mulberry32 = (a: number) => {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
