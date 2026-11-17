// The rules: waves of shadows, the player's orb, bullets on both sides, ember shards,
// pickups and the combo multiplier. One fixed step advances everything; the step
// returns an event bitmask so the main loop can answer each event with sound or text.

import { COMBO, ENEMY, FIELD, PICKUP, PLAYER, SHARD_VALUE, STEP, waveBudget } from './config.js';
import {
  KIND_BRUTE,
  KIND_DASHER,
  KIND_MINI,
  KIND_SPITTER,
  KIND_SPLITTER,
  KIND_WISP,
  PICKUP_HEART,
  PICKUP_MAGNET,
  PICKUP_SHIELD,
  PICKUP_SPREAD,
  clampToField,
  createBullet,
  createEnemy,
  createFloater,
  createParticle,
  createPickup,
  createPlayer,
  createShard,
  edgePoint,
  seek,
} from './entities.js';
import { applyUpgradeTo, rollUpgrades } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE = 4;
export const EVENT_CLEAR = 8;
export const EVENT_PICKUP = 16;
export const EVENT_KILL = 32;
export const EVENT_SHARD = 64;
export const EVENT_DASH = 128;

const WAVE_COST = { [KIND_WISP]: 1, [KIND_SPITTER]: 3, [KIND_SPLITTER]: 3, [KIND_BRUTE]: 6, [KIND_DASHER]: 3 };

/** What wave n may contain: brutes from wave 3, spitters and dashers from wave 2. */
function waveKinds(wave) {
  const kinds = [KIND_WISP, KIND_WISP, KIND_WISP, KIND_SPLITTER];
  if (wave >= 2) kinds.push(KIND_SPITTER, KIND_SPITTER, KIND_DASHER);
  if (wave >= 3) kinds.push(KIND_BRUTE);
  if (wave >= 4) kinds.push(KIND_DASHER);
  return kinds;
}

/** Spread of a volley with this many bullets, in radians off the aim. */
function volleyAngles(count) {
  if (count <= 1) return [0];
  if (count === 2) return [-0.09, 0.09];
  if (count === 3) return [-0.16, 0, 0.16];
  return [-0.24, -0.08, 0.08, 0.24];
}

function buildQueue(random, wave) {
  const kinds = waveKinds(wave);
  const queue = [];
  let budget = waveBudget(wave);
  while (budget > 0) {
    const kind = random.pick(kinds);
    const cost = WAVE_COST[kind];
    if (cost > budget) {
      queue.push(KIND_WISP);
      budget -= 1;
    } else {
      queue.push(kind);
      budget -= cost;
    }
  }
  return queue;
}

function burst(state, x, y, color, count, random, speed) {
  state.particles.push(...createParticle(x, y, color, count, random, speed));
}

export function createWorld(random) {
  const state = {
    player: createPlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    shards: [],
    particles: [],
    floaters: [],
    wave: 0,
    score: 0,
    kills: 0,
    shardsCollected: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 1,
    comboTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    betweenWaves: 0,
    waveStartedAt: -99,
    shake: 0,
    flash: 0,
    time: 0,
    over: false,
    /** The three upgrade cards on offer after a wave clear, until one is picked. */
    upgradeOffer: [],
    awaitingUpgrade: false,
  };

  function startWave() {
    state.wave += 1;
    state.spawnQueue = buildQueue(random, state.wave);
    state.spawnTimer = 0.5;
    state.betweenWaves = 0;
    state.waveStartedAt = state.time;
    return EVENT_WAVE;
  }

  function dropPickup(x, y) {
    if (random.next() >= PICKUP.dropChance) return;
    const roll = random.next();
    const kind = roll < 0.3 ? PICKUP_HEART : roll < 0.6 ? PICKUP_SPREAD : roll < 0.8 ? PICKUP_SHIELD : PICKUP_MAGNET;
    state.pickups.push(createPickup(kind, x, y));
  }

  function killEnemy(enemy, index) {
    enemy.dead = true;
    state.enemies.splice(index, 1);
    state.kills += 1;
    const def = ENEMY[enemy.kind];
    burst(state, enemy.x, enemy.y, '#b39dff', enemy.kind === KIND_BRUTE ? 26 : 12, random);
    for (let i = 0; i < def.shards; i += 1) state.shards.push(createShard(enemy.x, enemy.y, random));
    if (enemy.kind === KIND_SPLITTER) {
      for (let i = 0; i < 2; i += 1) {
        const mini = createEnemy(KIND_MINI, enemy.x + random.range(-14, 14), enemy.y + random.range(-14, 14), state.wave);
        state.enemies.push(mini);
      }
    }
    dropPickup(enemy.x, enemy.y);
    // A kill inside the window raises the multiplier; a quiet spell lets it fall.
    if (state.comboTimer > 0) state.combo = Math.min(COMBO.max, state.combo + 1);
    else state.combo = 2;
    state.comboTimer = COMBO.window;
    state.floaters.push(createFloater(enemy.x, enemy.y - 18, `+${def.score}`, '#cdbfff'));
  }

  function hurtPlayer(fromX, fromY) {
    const player = state.player;
    if (player.invulnerable > 0 || player.dashTimer > 0) return 0;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 0.8;
      burst(state, player.x, player.y, '#6ea8ff', 14, random);
      state.floaters.push(createFloater(player.x, player.y - 24, 'SHIELD', '#6ea8ff'));
      return EVENT_HIT;
    }
    player.hp -= 1;
    player.invulnerable = PLAYER.invulnerable;
    state.combo = 1;
    state.comboTimer = 0;
    state.shake = 0.35;
    state.flash = 0.25;
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    player.x += (dx / d) * 26;
    player.y += (dy / d) * 26;
    clampToField(player, PLAYER.radius + 4);
    burst(state, player.x, player.y, '#ff5d73', 18, random);
    if (player.hp <= 0) {
      state.over = true;
      burst(state, player.x, player.y, '#7df3ff', 40, random, 340);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function updatePlayer(dt, input) {
    const player = state.player;
    player.fireTimer -= dt;
    player.dashCooldown -= dt;
    player.invulnerable -= dt;
    player.spreadTimer -= dt;
    player.magnetTimer -= dt;
    player.angle = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
    player.moving = input.move.x !== 0 || input.move.y !== 0;

    if (input.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      const dx = player.moving ? input.move.x : Math.cos(player.angle);
      const dy = player.moving ? input.move.y : Math.sin(player.angle);
      player.dashX = dx;
      player.dashY = dy;
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = player.dashCooldownMax;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.05);
      burst(state, player.x, player.y, '#7df3ff', 8, random, 160);
      return EVENT_DASH;
    }

    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.x += player.dashX * PLAYER.dashSpeed * dt;
      player.y += player.dashY * PLAYER.dashSpeed * dt;
    } else {
      player.x += input.move.x * player.speed * dt;
      player.y += input.move.y * player.speed * dt;
    }
    clampToField(player, PLAYER.radius + 4);

    if (input.firing && player.fireTimer <= 0) {
      player.fireTimer = player.fireInterval;
      const count = Math.max(player.bulletCount, player.spreadTimer > 0 ? 3 : 1);
      const angles = volleyAngles(count);
      for (const off of angles) {
        const a = player.angle + off;
        state.bullets.push(
          createBullet(
            player.x + Math.cos(a) * (PLAYER.radius + 8),
            player.y + Math.sin(a) * (PLAYER.radius + 8),
            a,
            true,
            player.damage,
          ),
        );
      }
      state.shotsFired += angles.length;
    }
    return 0;
  }

  function updateEnemies(dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      enemy.flash -= dt;
      enemy.wobble += dt * 3;
      if (enemy.kind === KIND_SPITTER) {
        const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (d > ENEMY.spitter.range) seek(enemy, player.x, player.y, enemy.speed, dt);
        else if (d < ENEMY.spitter.range - 60) seek(enemy, enemy.x * 2 - player.x, enemy.y * 2 - player.y, enemy.speed, dt);
        enemy.shotTimer -= dt;
        if (enemy.shotTimer <= 0 && d < 560) {
          enemy.shotTimer = ENEMY.spitter.shotInterval;
          const a = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          state.enemyBullets.push(createBullet(enemy.x, enemy.y, a, false));
        }
      } else if (enemy.kind === KIND_DASHER) {
        // Drifts in, flashes a warning as the lunge winds up, then bursts at the orb.
        if (enemy.lungeTime > 0) {
          enemy.lungeTime -= dt;
          enemy.x += enemy.lungeX * ENEMY.dasher.lungeSpeed * dt;
          enemy.y += enemy.lungeY * ENEMY.dasher.lungeSpeed * dt;
        } else {
          enemy.lungeTimer -= dt;
          if (enemy.lungeTimer <= 0) {
            const d = Math.hypot(player.x - enemy.x, player.y - enemy.y) || 1;
            enemy.lungeX = (player.x - enemy.x) / d;
            enemy.lungeY = (player.y - enemy.y) / d;
            enemy.lungeTime = ENEMY.dasher.lungeTime;
            enemy.lungeTimer = ENEMY.dasher.lungeInterval;
          } else {
            if (enemy.lungeTimer < 0.45) enemy.flash = 0.1;
            seek(enemy, player.x, player.y, enemy.speed, dt);
          }
        }
      } else {
        seek(enemy, player.x, player.y, enemy.speed, dt);
      }
      clampToField(enemy, enemy.radius);
    }
    // Gentle separation so enemies do not stack into one blob.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d > 0.01 && d < min) {
          const push = ((min - d) / 2) * 0.5;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  function updateBullets(dt) {
    let events = 0;
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        bullet.dead = true;
        continue;
      }
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = state.enemies[i];
        const d = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
        if (d < enemy.radius + bullet.radius) {
          bullet.dead = true;
          enemy.hp -= bullet.damage;
          enemy.flash = 0.12;
          state.shotsHit += 1;
          burst(state, bullet.x, bullet.y, '#aef7ff', 4, random, 140);
          if (enemy.hp <= 0) {
            killEnemy(enemy, i);
            events |= EVENT_KILL;
          }
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
    for (const bullet of state.enemyBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        bullet.dead = true;
        continue;
      }
      const player = state.player;
      const d = Math.hypot(player.x - bullet.x, player.y - bullet.y);
      if (d < player.radius + bullet.radius) {
        bullet.dead = true;
        events |= hurtPlayer(bullet.x, bullet.y);
      }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => !b.dead);
    return events;
  }

  function updateTouch(dt) {
    let events = 0;
    const player = state.player;
    for (const enemy of state.enemies) {
      const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (d < player.radius + enemy.radius - 2) {
        events |= hurtPlayer(enemy.x, enemy.y);
        // The attacker is knocked back so one touch is one hit.
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const len = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / len) * 30;
        enemy.y += (dy / len) * 30;
        if (events & EVENT_OVER) break;
      }
    }
    return events;
  }

  function updatePickupsAndShards(dt) {
    let events = 0;
    const player = state.player;
    const vacuum = player.magnetTimer > 0 ? 280 : player.vacuum;
    for (const shard of state.shards) {
      const dx = player.x - shard.x;
      const dy = player.y - shard.y;
      const d = Math.hypot(dx, dy);
      if (d < vacuum) {
        const pull = 520 * (1 - d / (vacuum + 40));
        shard.vx += (dx / (d || 1)) * pull * dt * 4;
        shard.vy += (dy / (d || 1)) * pull * dt * 4;
      }
      shard.vx *= 1 - 2.4 * dt;
      shard.vy *= 1 - 2.4 * dt;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (d < player.radius + shard.radius + 6) {
        shard.dead = true;
        state.shardsCollected += 1;
        const gained = SHARD_VALUE * state.combo;
        state.score += gained;
        state.floaters.push(createFloater(shard.x, shard.y - 10, `+${gained}`, '#ffc44d'));
        events |= EVENT_SHARD;
      }
    }
    state.shards = state.shards.filter((s) => !s.dead);
    for (const pickup of state.pickups) {
      pickup.life -= dt;
      pickup.bob += dt * 4;
      if (pickup.life <= 0) {
        pickup.dead = true;
        continue;
      }
      const d = Math.hypot(player.x - pickup.x, player.y - pickup.y);
      if (d < player.radius + 18) {
        pickup.dead = true;
        if (pickup.kind === PICKUP_HEART) {
          player.hp = Math.min(player.maxHp + 2, player.hp + 1);
          state.floaters.push(createFloater(player.x, player.y - 24, '+1 HP', '#ff5d73'));
        } else if (pickup.kind === PICKUP_SPREAD) {
          player.spreadTimer = PICKUP.spreadTime;
          state.floaters.push(createFloater(player.x, player.y - 24, 'SPREAD SHOT', '#7dff9e'));
        } else if (pickup.kind === PICKUP_SHIELD) {
          player.shield = true;
          state.floaters.push(createFloater(player.x, player.y - 24, 'SHIELD', '#6ea8ff'));
        } else {
          player.magnetTimer = PICKUP.magnetTime;
          state.floaters.push(createFloater(player.x, player.y - 24, 'MAGNET', '#ffd94d'));
        }
        burst(state, pickup.x, pickup.y, '#e8ecf7', 10, random, 150);
        events |= EVENT_PICKUP;
      }
    }
    state.pickups = state.pickups.filter((p) => !p.dead);
    return events;
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
    }
    state.particles = state.particles.filter((p) => !p.dead);
    for (const f of state.floaters) {
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) f.dead = true;
    }
    state.floaters = state.floaters.filter((f) => !f.dead);
  }

  const world = {
    state,
    reset() {
      state.player = createPlayer();
      state.enemies = [];
      state.bullets = [];
      state.enemyBullets = [];
      state.pickups = [];
      state.shards = [];
      state.particles = [];
      state.floaters = [];
      state.wave = 0;
      state.score = 0;
      state.kills = 0;
      state.shardsCollected = 0;
      state.shotsFired = 0;
      state.shotsHit = 0;
      state.combo = 1;
      state.comboTimer = 0;
      state.spawnQueue = [];
      state.spawnTimer = 0;
      state.betweenWaves = 0;
      state.waveStartedAt = -99;
      state.shake = 0;
      state.flash = 0;
      state.time = 0;
      state.over = false;
      state.upgradeOffer = [];
      state.awaitingUpgrade = false;
    },
    /**
     * Advance the world one fixed step. `input` is { move, aim, firing, dash }.
     * In demo mode the player cannot die and nothing is scored: the title screen
     * runs the world behind it.
     */
    step(dt, input, demo = false) {
      let events = 0;
      state.time += dt;
      state.shake = Math.max(0, state.shake - dt);
      state.flash = Math.max(0, state.flash - dt);
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 1;
      }
      if (state.over) {
        updateParticles(dt);
        return 0;
      }
      if (state.betweenWaves > 0) {
        // Breather between waves: the player still moves and collects, but
        // nothing new spawns until the next wave starts.
        state.betweenWaves -= dt;
        if (state.betweenWaves <= 0) events |= startWave();
      }
      if (state.betweenWaves <= 0 && state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = Math.max(0.25, 0.9 - state.wave * 0.05);
          const kind = state.spawnQueue.shift();
          const at = edgePoint(random);
          state.enemies.push(createEnemy(kind, at.x, at.y, state.wave));
        }
      }
      events |= updatePlayer(dt, input);
      updateEnemies(dt);
      events |= updateBullets(dt);
      if (!demo) events |= updateTouch(dt);
      events |= updatePickupsAndShards(dt);
      updateParticles(dt);
      if (demo) {
        // The title demo never ends: refill wisps and keep the orb whole.
        if (state.enemies.length < 5 && state.spawnQueue.length === 0) {
          const at = edgePoint(random);
          state.enemies.push(createEnemy(KIND_WISP, at.x, at.y, 1));
        }
        state.player.hp = PLAYER.maxHp;
      } else if (state.wave > 0 && state.betweenWaves <= 0 && !state.over && state.spawnQueue.length === 0 && state.enemies.length === 0) {
        const bonus = 50 * state.wave;
        state.score += bonus;
        state.floaters.push(createFloater(FIELD.width / 2, FIELD.height / 2 - 120, `WAVE ${state.wave} CLEAR  +${bonus}`, '#ffd94d'));
        if (random.next() < 0.5) state.pickups.push(createPickup(PICKUP_HEART, FIELD.width / 2, FIELD.height / 2));
        // The next wave waits on the player's pick: three upgrade cards, one choice.
        state.upgradeOffer = rollUpgrades(random);
        state.awaitingUpgrade = true;
        events |= EVENT_CLEAR;
      }
      if (state.over) events |= EVENT_OVER;
      return events;
    },
    /** Begin wave 1 (used by the title demo and the first start). */
    begin() {
      return startWave();
    },
    /**
     * Take one of the offered upgrades (by id) and open the breather before the
     * next wave. Returns the upgrade taken, or null when nothing was on offer.
     */
    applyUpgrade(id) {
      if (!state.awaitingUpgrade) return null;
      const def = applyUpgradeTo(state.player, id);
      if (!def) return null;
      state.awaitingUpgrade = false;
      state.upgradeOffer = [];
      state.betweenWaves = 3;
      return def;
    },
  };

  return world;
}
