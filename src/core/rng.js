// Seeded RNG (mulberry32) with serializable state, so games are reproducible
// (?seed= URL param, unit tests, e2e runs).
export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.getState = () => a >>> 0;
  rng.setState = (s) => { a = s >>> 0; };
  return rng;
}
