// A tiny seeded random source (mulberry32) so a ?seed=N run always plays the same way:
// the same seed gives the same spawns, the same screenshots and the same demo on the title.

export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    /** A float in [0, 1). */
    next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** A float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    /** One of the array's entries, uniformly. */
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    /** An angle in radians, uniformly around the circle. */
    angle() {
      return this.next() * Math.PI * 2;
    },
  };
}
