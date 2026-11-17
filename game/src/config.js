// LUMEN DRIFT — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. All art is drawn in code; there are no image or sound assets.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const BEST_KEY = 'lumen-drift-best';

export const PLAYER = {
  radius: 14,
  speed: 335,
  /** Seconds between shots while firing. */
  fireInterval: 0.13,
  bulletSpeed: 700,
  bulletRadius: 5,
  maxHp: 3,
  /** Dash: burst speed, how long it lasts, and the cooldown after it. */
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 1.4,
  /** Seconds of mercy after a hit. */
  invulnerable: 1.2,
  /** Radius inside which ember shards drift toward the player. */
  vacuum: 100,
};

export const ENEMY = {
  wisp: { radius: 15, hp: 1, speed: 92, score: 1, shards: 1, touch: 1 },
  spitter: { radius: 17, hp: 2, speed: 62, score: 2, shards: 2, touch: 1, range: 300, shotInterval: 2.4, bulletSpeed: 250 },
  splitter: { radius: 19, hp: 2, speed: 78, score: 2, shards: 2, touch: 1 },
  mini: { radius: 10, hp: 1, speed: 165, score: 1, shards: 1, touch: 1 },
  brute: { radius: 30, hp: 9, speed: 46, score: 5, shards: 5, touch: 1 },
  /** Drifts in slowly, flashes a warning, then lunges at the orb in a burst. */
  dasher: { radius: 14, hp: 2, speed: 74, score: 3, shards: 2, touch: 1, lungeInterval: 2.4, lungeSpeed: 430, lungeTime: 0.35 },
  /** The Lantern Warden: a boss that arrives every fifth wave. Slow, huge, and it
      answers with rings of bolts and fresh wisps while it lumbers after the orb. */
  warden: { radius: 46, hp: 150, speed: 34, score: 25, shards: 10, touch: 1, burstInterval: 2.8, burstCount: 10, summonInterval: 7 },
};

/** Wave n (1-based) buys enemies with this many points; costs are ENEMY.*.score. */
export function waveBudget(wave) {
  return 6 + wave * 4;
}

/** Waves come in nights of five: night 1 is waves 1–5, night 2 is waves 6–10, and so on. */
export function nightFor(wave) {
  return Math.floor((wave - 1) / 5) + 1;
}

/** Every fifth wave the Lantern Warden arrives instead of a normal wave. */
export function isBossWave(wave) {
  return wave % 5 === 0;
}

export const PICKUP = {
  /** Chance an enemy drops a pickup on death. */
  dropChance: 0.13,
  /** How long a pickup stays on the field, in seconds. */
  life: 12,
  spreadTime: 12,
  magnetTime: 12,
};

export const COMBO = {
  /** Seconds a kill chain survives without a kill before the multiplier resets. */
  window: 3,
  max: 8,
};

export const SHARD_VALUE = 10;

export const PALETTE = {
  background: '#070a16',
  grid: '#121831',
  star: '#8fa3d9',
  player: '#7df3ff',
  playerCore: '#eafcff',
  bullet: '#aef7ff',
  enemyBullet: '#ff6ec7',
  wisp: '#7b5cff',
  spitter: '#c44dff',
  splitter: '#9d7bff',
  mini: '#b39dff',
  brute: '#5a2ea6',
  dasher: '#ff9d5c',
  warden: '#ffcf3d',
  relic: '#ff9de2',
  shard: '#ffc44d',
  heart: '#ff5d73',
  spread: '#7dff9e',
  shield: '#6ea8ff',
  magnet: '#ffd94d',
  text: '#e8ecf7',
  dim: '#9aa6c4',
  danger: '#ff5d73',
  banner: '#ffd94d',
};
