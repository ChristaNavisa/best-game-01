// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Everything is drawn in code — glowing orbs, jagged shadows, particles — so the
// game ships no image assets at all.

import { FIELD, PALETTE, PLAYER } from './config.js';
import { KIND_BRUTE, KIND_MINI, KIND_SPITTER, KIND_SPLITTER, KIND_WISP, PICKUP_HEART, PICKUP_MAGNET, PICKUP_SHIELD, PICKUP_SPREAD } from './entities.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT_TITLE = '700 84px "Trebuchet MS", "Segoe UI", sans-serif';
const FONT_BANNER = '700 46px "Trebuchet MS", "Segoe UI", sans-serif';
const FONT_PANEL = '700 34px "Trebuchet MS", "Segoe UI", sans-serif';
const FONT_BODY = '400 20px "Trebuchet MS", "Segoe UI", sans-serif';
const FONT_HUD = '700 24px "Trebuchet MS", "Segoe UI", sans-serif';
const FONT_SMALL = '400 16px "Trebuchet MS", "Segoe UI", sans-serif';

/** Fixed stars, seeded once so the backdrop never changes between runs. */
const STARS = (() => {
  const random = createRandom(1337);
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({
      x: random.range(0, FIELD.width),
      y: random.range(0, FIELD.height),
      r: random.range(0.6, 2.1),
      phase: random.range(0, Math.PI * 2),
      speed: random.range(0.6, 2),
    });
  }
  return stars;
})();

function heartPath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.9);
  ctx.bezierCurveTo(x - size * 1.2, y, x - size * 0.6, y - size, x, y - size * 0.25);
  ctx.bezierCurveTo(x + size * 0.6, y - size, x + size * 1.2, y, x, y + size * 0.9);
  ctx.closePath();
}

function drawHeart(ctx, x, y, size, filled) {
  heartPath(ctx, x, y, size);
  ctx.fillStyle = filled ? PALETTE.heart : '#2a3350';
  ctx.fill();
  if (filled) {
    ctx.shadowColor = PALETTE.heart;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = 'rgba(8, 12, 26, 0.88)';
  ctx.strokeStyle = 'rgba(125, 243, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 16);
  ctx.fill();
  ctx.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function drawBackground(time) {
    const gradient = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, 80,
      FIELD.width / 2, FIELD.height / 2, 760,
    );
    gradient.addColorStop(0, '#0d1330');
    gradient.addColorStop(1, PALETTE.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let x = 80; x < FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const star of STARS) {
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * star.speed + star.phase));
      ctx.globalAlpha = twinkle * 0.8;
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShards(state) {
    for (const shard of state.shards) {
      const pulse = 1 + 0.18 * Math.sin(state.time * 6 + shard.x);
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(Math.PI / 4);
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.shard;
      const s = shard.radius * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.bob) * 3;
      const blink = pickup.life < 3 ? (Math.sin(state.time * 12) > 0 ? 1 : 0.35) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.shadowBlur = 14;
      if (pickup.kind === PICKUP_HEART) {
        ctx.shadowColor = PALETTE.heart;
        drawHeart(ctx, 0, 0, 11, true);
      } else {
        ctx.shadowColor = pickup.kind === PICKUP_SPREAD ? PALETTE.spread : pickup.kind === PICKUP_SHIELD ? PALETTE.shield : PALETTE.magnet;
        ctx.fillStyle = ctx.shadowColor;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0e1a';
        ctx.font = '700 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pickup.kind === PICKUP_SPREAD ? '×3' : pickup.kind === PICKUP_SHIELD ? '◊' : '◎', 0, 1);
      }
      ctx.restore();
    }
  }

  function drawEnemy(enemy, time) {
    const wobble = Math.sin(enemy.wobble) * 0.08;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const flash = enemy.flash > 0;
    const color = flash ? '#ffffff'
      : enemy.kind === KIND_WISP ? PALETTE.wisp
      : enemy.kind === KIND_SPITTER ? PALETTE.spitter
      : enemy.kind === KIND_SPLITTER ? PALETTE.splitter
      : enemy.kind === KIND_MINI ? PALETTE.mini
      : PALETTE.brute;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    if (enemy.kind === KIND_SPITTER) {
      ctx.rotate(Math.PI / 4 + wobble);
      ctx.fillRect(-enemy.radius * 0.72, -enemy.radius * 0.72, enemy.radius * 1.44, enemy.radius * 1.44);
      ctx.rotate(-Math.PI / 4 - wobble);
    } else if (enemy.kind === KIND_SPLITTER) {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + wobble;
        const px = Math.cos(a) * enemy.radius;
        const py = Math.sin(a) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === KIND_BRUTE) {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const r = enemy.radius * (i % 2 === 0 ? 1 : 0.78);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * (1 + wobble), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Eyes that track the player.
    ctx.fillStyle = '#ffdf6e';
    const eyeDx = enemy.kind === KIND_BRUTE ? 9 : 5;
    const eyeDy = enemy.kind === KIND_BRUTE ? -4 : -3;
    const eyeR = enemy.kind === KIND_BRUTE ? 4.5 : 3;
    ctx.beginPath();
    ctx.arc(-eyeDx, eyeDy, eyeR, 0, Math.PI * 2);
    ctx.arc(eyeDx, eyeDy, eyeR, 0, Math.PI * 2);
    ctx.fill();
    // Brutes show their remaining health.
    if (enemy.kind === KIND_BRUTE && enemy.hp < enemy.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-26, -enemy.radius - 14, 52, 6);
      ctx.fillStyle = PALETTE.danger;
      ctx.fillRect(-26, -enemy.radius - 14, 52 * (enemy.hp / enemy.maxHp), 6);
    }
    ctx.restore();
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (state.over) return;
    const blink = player.invulnerable > 0 && player.dashTimer <= 0 && Math.sin(time * 30) > 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.translate(player.x, player.y);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 44);
    glow.addColorStop(0, 'rgba(125, 243, 255, 0.5)');
    glow.addColorStop(1, 'rgba(125, 243, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    // Aim barrel.
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(Math.cos(player.angle) * 10, Math.sin(player.angle) * 10);
    ctx.lineTo(Math.cos(player.angle) * 24, Math.sin(player.angle) * 24);
    ctx.stroke();
    const body = ctx.createRadialGradient(-4, -5, 2, 0, 0, PLAYER.radius);
    body.addColorStop(0, PALETTE.playerCore);
    body.addColorStop(1, PALETTE.player);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    if (player.shield) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER.radius + 8 + Math.sin(time * 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBullets(state) {
    for (const bullet of state.bullets) {
      ctx.strokeStyle = PALETTE.bullet;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowColor = PALETTE.bullet;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (const bullet of state.enemyBullets) {
      ctx.fillStyle = PALETTE.enemyBullet;
      ctx.shadowColor = PALETTE.enemyBullet;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = '700 17px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    const player = state.player;
    ctx.textBaseline = 'alphabetic';
    // Hearts, top left.
    for (let i = 0; i < PLAYER.maxHp + 2; i += 1) {
      drawHeart(ctx, 30 + i * 30, 30, 10, i < player.hp);
    }
    // Score, top centre.
    ctx.font = FONT_HUD;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${state.score}`, FIELD.width / 2, 40);
    if (state.combo > 1) {
      ctx.fillStyle = PALETTE.banner;
      ctx.font = '700 20px "Trebuchet MS", sans-serif';
      ctx.fillText(`COMBO ×${state.combo}`, FIELD.width / 2, 66);
    }
    // Wave and best, top right.
    ctx.textAlign = 'right';
    ctx.font = FONT_HUD;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`WAVE ${Math.max(1, state.wave)}`, FIELD.width - 24, 40);
    ctx.font = FONT_SMALL;
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, FIELD.width - 24, 64);
    // Dash cooldown, bottom left.
    const dashReady = player.dashCooldown <= 0;
    ctx.textAlign = 'left';
    ctx.font = FONT_SMALL;
    ctx.fillStyle = dashReady ? PALETTE.player : PALETTE.dim;
    const dashFrac = dashReady ? 1 : 1 - player.dashCooldown / PLAYER.dashCooldown;
    ctx.fillRect(24, FIELD.height - 34, 120 * dashFrac, 6);
    ctx.strokeStyle = PALETTE.dim;
    ctx.lineWidth = 1;
    ctx.strokeRect(24, FIELD.height - 34, 120, 6);
    ctx.fillText(dashReady ? 'DASH READY  [Shift]' : 'DASH…', 24, FIELD.height - 44);
    // Active power-ups, bottom centre.
    const timers = [];
    if (player.spreadTimer > 0) timers.push(`SPREAD ${Math.ceil(player.spreadTimer)}s`);
    if (player.magnetTimer > 0) timers.push(`MAGNET ${Math.ceil(player.magnetTimer)}s`);
    if (player.shield) timers.push('SHIELD');
    if (timers.length > 0) {
      ctx.textAlign = 'center';
      ctx.font = FONT_SMALL;
      ctx.fillStyle = PALETTE.spread;
      ctx.fillText(timers.join('   •   '), FIELD.width / 2, FIELD.height - 22);
    }
    if (muted) {
      ctx.textAlign = 'right';
      ctx.font = FONT_SMALL;
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText('MUTED [M]', FIELD.width - 24, FIELD.height - 22);
    }
    // Wave banners.
    if (state.betweenWaves > 0) {
      ctx.textAlign = 'center';
      ctx.font = FONT_BANNER;
      ctx.fillStyle = PALETTE.banner;
      ctx.fillText(`WAVE ${state.wave + 1}`, FIELD.width / 2, FIELD.height / 2 - 40);
      ctx.font = FONT_BODY;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`incoming in ${Math.ceil(state.betweenWaves)}…`, FIELD.width / 2, FIELD.height / 2);
    } else if (state.time - state.waveStartedAt < 2 && state.wave > 0) {
      ctx.textAlign = 'center';
      ctx.font = FONT_BANNER;
      ctx.fillStyle = PALETTE.banner;
      ctx.globalAlpha = Math.min(1, 2 - (state.time - state.waveStartedAt));
      ctx.fillText(`WAVE ${state.wave}`, FIELD.width / 2, 130);
      ctx.globalAlpha = 1;
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.player;
    ctx.font = FONT_TITLE;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 30;
    ctx.fillText('LUMEN DRIFT', FIELD.width / 2, 218);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '400 24px "Trebuchet MS", sans-serif';
    ctx.fillText('Hold the light. Outlast the dark.', FIELD.width / 2, 262);
    ctx.font = FONT_BODY;
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click — fire', FIELD.width / 2, 330);
    ctx.fillText('Shift / Space — dash      P — pause      M — mute', FIELD.width / 2, 360);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText('Blast the shadows. Gather their embers. Chain kills to raise your combo.', FIELD.width / 2, 410);
    ctx.fillText('Grab hearts, spread shot, shields and magnets. Survive the waves.', FIELD.width / 2, 440);
    if (best > 0) {
      ctx.fillStyle = PALETTE.banner;
      ctx.font = FONT_PANEL;
      ctx.fillText(`BEST  ${best}`, FIELD.width / 2, 500);
    }
    ctx.fillStyle = PALETTE.player;
    ctx.font = '700 26px "Trebuchet MS", sans-serif';
    ctx.fillText(Math.sin(state.time * 4) > -0.2 ? '— click or press Space to begin —' : '', FIELD.width / 2, 580);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT_PANEL;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
    ctx.font = FONT_BODY;
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('P or click to resume', FIELD.width / 2, FIELD.height / 2 + 34);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const width = 620;
    const height = 380;
    panel(ctx, (FIELD.width - width) / 2, 150, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = FONT_PANEL;
    ctx.fillText('THE LIGHT FADES', FIELD.width / 2, 210);
    const accuracy = state.shotsFired > 0 ? Math.round((100 * state.shotsHit) / state.shotsFired) : 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 30px "Trebuchet MS", sans-serif';
    ctx.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 268);
    ctx.font = FONT_BODY;
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`Best ${best}      Wave ${state.wave}      Kills ${state.kills}`, FIELD.width / 2, 310);
    ctx.fillText(`Accuracy ${accuracy}%      Embers gathered ${state.shardsCollected}`, FIELD.width / 2, 342);
    ctx.fillStyle = PALETTE.player;
    ctx.font = '700 24px "Trebuchet MS", sans-serif';
    ctx.fillText('Press R or click to drift again', FIELD.width / 2, 420);
    if (state.score >= best && state.score > 0) {
      ctx.fillStyle = PALETTE.banner;
      ctx.font = '700 22px "Trebuchet MS", sans-serif';
      ctx.fillText('★ NEW BEST ★', FIELD.width / 2, 470);
    }
  }

  return {
    draw(state, screen, best, muted) {
      ctx.save();
      if (state.shake > 0) {
        const mag = state.shake * 22;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }
      drawBackground(state.time);
      drawShards(state);
      drawPickups(state);
      for (const enemy of state.enemies) drawEnemy(enemy, state.time);
      drawBullets(state);
      drawPlayer(state, state.time);
      drawParticles(state);
      ctx.restore();
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 60, 80, ${state.flash * 0.5})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best, muted);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
    },
  };
}
