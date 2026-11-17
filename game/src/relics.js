// Relics: permanent keepsakes the Lantern Warden drops when it falls. Unlike the
// between-wave upgrade cards, a relic is earned, not chosen — one per Warden, and
// each one changes the run for good. A relic a run already holds cannot drop again;
// when every relic is held, the Warden pays out in score instead.

export const RELICS = [
  {
    id: 'emberheart',
    name: 'EMBER HEART',
    glyph: '♥',
    color: '#ff5d73',
    blurb: '+1 max heart, and heal 1 now.',
    apply(player) {
      player.maxHp += 1;
      player.hp = Math.min(player.maxHp, player.hp + 1);
    },
  },
  {
    id: 'lanterncore',
    name: 'LANTERN CORE',
    glyph: '●',
    color: '#ffc44d',
    blurb: '+1 damage per bullet, forever.',
    apply(player) {
      player.damage += 1;
    },
  },
  {
    id: 'swiftwick',
    name: 'SWIFT WICK',
    glyph: '»»',
    color: '#7df3ff',
    blurb: '+12% move speed, forever.',
    apply(player) {
      player.speed *= 1.12;
    },
  },
  {
    id: 'prismlens',
    name: 'PRISM LENS',
    glyph: '✦',
    color: '#b39dff',
    blurb: '+1 bullet per volley, forever.',
    apply(player) {
      player.bulletCount += 1;
    },
  },
  {
    id: 'aegisflame',
    name: 'AEGIS FLAME',
    glyph: '◊',
    color: '#6ea8ff',
    blurb: 'Begin every wave behind a shield.',
    apply() {
      // No immediate change: startWave re-arms the shield while this is held.
    },
  },
  {
    id: 'greedwick',
    name: 'GREED WICK',
    glyph: '◎',
    color: '#ffd94d',
    blurb: 'Embers are worth 50% more, forever.',
    apply(player) {
      player.shardBonus *= 1.5;
    },
  },
];

/** One relic the run does not hold yet, rolled from the world's seeded random. */
export function rollRelic(random, owned) {
  const pool = RELICS.filter((r) => !owned[r.id]);
  if (pool.length === 0) return null;
  return pool[Math.floor(random.next() * pool.length)];
}

/** Grant a relic to the player and record it in the run's build. */
export function grantRelic(player, id) {
  const def = RELICS.find((r) => r.id === id);
  if (!def || player.relics[def.id]) return null;
  def.apply(player);
  player.relics[def.id] = 1;
  return def;
}
