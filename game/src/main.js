// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CLEAR, EVENT_DASH, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_SHARD, EVENT_WAVE } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';
import { upgradeCardRect } from './upgrades.js';
import { autopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, { width: 1280, height: 720 });
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function playEvents(events) {
    if (events & EVENT_WAVE) audio.waveHorn();
    if (events & EVENT_CLEAR) audio.waveClear();
    if (events & EVENT_KILL) audio.enemyDie();
    if (events & EVENT_SHARD) audio.shard();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HIT) audio.playerHit();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_OVER) audio.gameOver();
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.begin();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Three hearts. Survive the waves.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}. Wave ${world.state.wave}.`);
  }

  function pickUpgrade(index) {
    const offer = world.state.upgradeOffer;
    if (!offer[index]) return;
    const def = world.applyUpgrade(offer[index].id);
    if (!def) return;
    audio.upgrade();
    screen = SCREEN_PLAY;
    announce(`Picked ${def.name}. Wave ${world.state.wave + 1} incoming.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_UPGRADE) {
      const digit = input.takeDigit();
      if (digit >= 0) pickUpgrade(digit);
      else {
        const click = input.takeClick();
        if (click) {
          for (let i = 0; i < 3; i += 1) {
            const rect = upgradeCardRect(i);
            if (click.x >= rect.x && click.x <= rect.x + rect.width
              && click.y >= rect.y && click.y <= rect.y + rect.height) {
              pickUpgrade(i);
              break;
            }
          }
        }
      }
      return;
    }
    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) startGame();
    else if (screen === SCREEN_OVER && (actions & (ACTION_CONFIRM | ACTION_RESTART))) startGame();
    else if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, autopilot(world.state, 'demo'), true);
      return;
    }
    const events = world.step(
      STEP,
      {
        move: input.direction(),
        aim: input.aim(),
        firing: input.firing(),
        dash: input.takeDash(),
      },
      false,
    );
    playEvents(events);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) {
      announce(world.state.player.hp === 1 ? 'Hit. 1 heart left.' : `Hit. ${world.state.player.hp} hearts left.`);
    }
    if (world.state.awaitingUpgrade) {
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} clear. Choose an upgrade: press 1, 2 or 3, or click a card.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, muted);
  }

  // Leaving the tab pauses a running game rather than letting shadows close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumen Drift. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
