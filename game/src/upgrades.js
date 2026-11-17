// Between-wave upgrades: clear a wave, pick one of three cards, keep drifting.
// Each upgrade is a small permanent change to the orb, so every run builds
// differently and the choice matters: a fast gun, a heavy gun, a quicker dash
// or one more heart are not the same run. The pool is rolled fresh every wave
// from the world's seeded random, so a ?seed=N run always offers the same cards.

/** Where the three cards sit on the 1280x720 field; main.js hit-tests clicks against these. */
export const UPGRADE_PANEL = { cardWidth: 340, cardHeight: 196, gap: 24, y: 244 };

export function upgradeCardRect(index) {
  const total = UPGRADE_PANEL.cardWidth * 3 + UPGRADE_PANEL.gap * 2;
  const x0 = (1280 - total) / 2;
  return {
    x: x0 + index * (UPGRADE_PANEL.cardWidth + UPGRADE_PANEL.gap),
    y: UPGRADE_PANEL.y,
    width: UPGRADE_PANEL.cardWidth,
    height: UPGRADE_PANEL.cardHeight,
  };
}

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'RAPID FIRE',
    glyph: '»',
    color: '#aef7ff',
    blurb: 'Fire 18% faster. More embers, more combo.',
    apply(player) {
      player.fireInterval *= 0.82;
    },
  },
  {
    id: 'heavy',
    name: 'HEAVY ROUNDS',
    glyph: '●',
    color: '#ffc44d',
    blurb: '+1 damage per bullet. Brutes fall sooner.',
    apply(player) {
      player.damage += 1;
    },
  },
  {
    id: 'swift',
    name: 'SWIFT DRIFT',
    glyph: '»»',
    color: '#7df3ff',
    blurb: '+10% move speed. Outrun the lunge.',
    apply(player) {
      player.speed *= 1.1;
    },
  },
  {
    id: 'heart',
    name: 'EXTRA HEART',
    glyph: '♥',
    color: '#ff5d73',
    blurb: '+1 max heart, and heal 1 now.',
    apply(player) {
      player.maxHp += 1;
      player.hp = Math.min(player.maxHp, player.hp + 1);
    },
  },
  {
    id: 'dash',
    name: 'QUICK DASH',
    glyph: '↯',
    color: '#6ea8ff',
    blurb: 'Dash recharges 30% faster.',
    apply(player) {
      player.dashCooldownMax *= 0.7;
    },
  },
  {
    id: 'vacuum',
    name: 'EMBER VACUUM',
    glyph: '◎',
    color: '#ffd94d',
    blurb: 'Embers drift to you from 60% further.',
    apply(player) {
      player.vacuum *= 1.6;
    },
  },
  {
    id: 'split',
    name: 'SPLIT SHOT',
    glyph: '×3',
    color: '#7dff9e',
    blurb: '+1 bullet per volley, forever.',
    apply(player) {
      player.bulletCount += 1;
    },
  },
  {
    id: 'pierce',
    name: 'PIERCING ROUNDS',
    glyph: '➶',
    color: '#aef7ff',
    blurb: 'Bullets pass through +1 shadow each.',
    apply(player) {
      player.pierce += 1;
    },
  },
];

/** Three distinct upgrades, rolled from the pool. */
export function rollUpgrades(random) {
  const pool = [...UPGRADES];
  const offer = [];
  while (offer.length < 3 && pool.length > 0) {
    const at = Math.floor(random.next() * pool.length);
    offer.push(pool.splice(at, 1)[0]);
  }
  return offer;
}

/** Apply one upgrade to the player and record it in the run's build. */
export function applyUpgradeTo(player, id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return null;
  def.apply(player);
  player.upgrades[def.id] = (player.upgrades[def.id] || 0) + 1;
  return def;
}
