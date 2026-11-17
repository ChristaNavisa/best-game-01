// The things that move: the player orb, the four shadow kinds, bullets on both sides,
// pickups, ember shards and the particles and floating score text that answer every hit.
// Factories live here; the world owns the lists and the rules that move them.

import { ENEMY, FIELD, PICKUP, PLAYER } from './config.js';

export const KIND_WISP = 'wisp';
export const KIND_SPITTER = 'spitter';
export const KIND_SPLITTER = 'splitter';
export const KIND_MINI = 'mini';
export const KIND_BRUTE = 'brute';
export const KIND_DASHER = 'dasher';

export const PICKUP_HEART = 'heart';
export const PICKUP_SPREAD = 'spread';
export const PICKUP_SHIELD = 'shield';
export const PICKUP_MAGNET = 'magnet';

/** Where an enemy walks in: a point just outside one of the field's edges. */
export function edgePoint(random) {
  const side = random.int(0, 3);
  const m = 30;
  if (side === 0) return { x: random.range(0, FIELD.width), y: -m };
  if (side === 1) return { x: FIELD.width + m, y: random.range(0, FIELD.height) };
  if (side === 2) return { x: random.range(0, FIELD.width), y: FIELD.height + m };
  return { x: -m, y: random.range(0, FIELD.height) };
}

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    angle: -Math.PI / 2,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invulnerable: 0,
    spreadTimer: 0,
    magnetTimer: 0,
    shield: false,
    moving: false,
    // Run stats the between-wave upgrades change: fire rate, bullet damage,
    // move speed, ember vacuum, bullets per volley, dash cooldown and max hearts.
    fireInterval: PLAYER.fireInterval,
    damage: 1,
    speed: PLAYER.speed,
    vacuum: PLAYER.vacuum,
    bulletCount: 1,
    dashCooldownMax: PLAYER.dashCooldown,
    maxHp: PLAYER.maxHp,
    upgrades: {},
  };
}

export function createEnemy(kind, x, y, wave) {
  const def = ENEMY[kind];
  const hpScale = kind === KIND_BRUTE ? 1 + Math.floor(wave / 3) : 1;
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: def.radius,
    hp: def.hp * hpScale,
    maxHp: def.hp * hpScale,
    speed: def.speed + Math.min(40, wave * 3),
    touch: def.touch,
    shotTimer: def.shotInterval ? def.shotInterval * 0.6 : 0,
    flash: 0,
    wobble: Math.random() * Math.PI * 2,
    dead: false,
    // Dasher lunge state: counts down to the next burst, then the burst itself.
    lungeTimer: def.lungeInterval ? def.lungeInterval * 0.8 : 0,
    lungeTime: 0,
    lungeX: 0,
    lungeY: 0,
  };
}

export function createBullet(x, y, angle, friendly, damage = 1) {
  const speed = friendly ? PLAYER.bulletSpeed : ENEMY.spitter.bulletSpeed;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: friendly ? PLAYER.bulletRadius : 7,
    friendly,
    damage,
    dead: false,
  };
}

export function createPickup(kind, x, y) {
  return { kind, x, y, life: PICKUP.life, bob: Math.random() * Math.PI * 2, dead: false };
}

export function createShard(x, y, random) {
  const angle = random.angle();
  const speed = random.range(40, 130);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 6,
    dead: false,
  };
}

export function createParticle(x, y, color, count, random, speed = 220) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const angle = random.angle();
    const s = random.range(speed * 0.3, speed);
    out.push({
      x,
      y,
      vx: Math.cos(angle) * s,
      vy: Math.sin(angle) * s,
      life: random.range(0.3, 0.7),
      maxLife: 0.7,
      radius: random.range(2, 4.5),
      color,
      dead: false,
    });
  }
  return out;
}

export function createFloater(x, y, text, color) {
  return { x, y, text, color, life: 0.9, maxLife: 0.9, dead: false };
}

/** Move a point toward a target at most `speed * dt`, returning the distance left. */
export function seek(entity, tx, ty, speed, dt) {
  const dx = tx - entity.x;
  const dy = ty - entity.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return 0;
  const step = Math.min(d, speed * dt);
  entity.x += (dx / d) * step;
  entity.y += (dy / d) * step;
  return d - step;
}

export function clampToField(entity, margin) {
  entity.x = Math.max(margin, Math.min(FIELD.width - margin, entity.x));
  entity.y = Math.max(margin, Math.min(FIELD.height - margin, entity.y));
}
