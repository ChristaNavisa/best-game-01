// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by an autopilot that
// aims at the nearest shadow, keeps its distance and dashes clear when crowded, so the
// frame is what a short game really looks like and the same seed always gives the same
// frame. The end scene's pilot is deliberately clumsy — it shoots but never dashes and
// drifts at half speed — so it is caught out once the waves thicken, as a hurried player is.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;

/** Nearest living thing of a list to a point, or null. */
function nearest(list, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const item of list) {
    const d = Math.hypot(item.x - x, item.y - y);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best === null ? null : { item: best, distance: bestD };
}

/**
 * Steer the orb for one step. `skill` is 'full' (a decent player), 'weak' (a clumsy
 * one that never fires or dashes) or 'demo' (the title screen's wander).
 */
export function autopilot(state, skill) {
  const player = state.player;
  const foe = nearest(state.enemies, player.x, player.y);
  const shard = nearest(state.shards, player.x, player.y);
  let move = { x: 0, y: 0 };
  let aim = { x: player.x, y: player.y - 120 };
  let firing = false;
  let dash = false;

  if (skill === 'weak') {
    // A clumsy pilot: it shoots, but it never dashes and it drifts at half speed
    // toward the nearest ember, so the waves catch up with it.
    const target = shard ?? foe;
    if (target) {
      const d = Math.hypot(target.item.x - player.x, target.item.y - player.y);
      if (d > 4) move = { x: ((target.item.x - player.x) / d) * 0.5, y: ((target.item.y - player.y) / d) * 0.5 };
    }
    if (foe) {
      aim = { x: foe.item.x, y: foe.item.y };
      firing = foe.distance < 420;
    }
    return { move, aim, firing, dash };
  }

  if (foe) {
    aim = { x: foe.item.x, y: foe.item.y };
    firing = foe.distance < 560;
    // Keep a fighting distance: close in when far, back off when crowded.
    const dx = player.x - foe.item.x;
    const dy = player.y - foe.item.y;
    const d = foe.distance || 1;
    if (d > 240) move = { x: -dx / d, y: -dy / d };
    else if (d < 130) move = { x: dx / d, y: dy / d };
    else {
      // Strafe sideways, switching side every couple of seconds.
      const side = Math.sin(state.time * 0.9) > 0 ? 1 : -1;
      move = { x: (-dy / d) * side, y: (dx / d) * side };
    }
    if (skill === 'full' && foe.distance < 115) dash = true;
  } else if (shard) {
    const d = Math.hypot(shard.x - player.x, shard.y - player.y);
    if (d > 4) move = { x: (shard.x - player.x) / d, y: (shard.y - player.y) / d };
  } else {
    const d = Math.hypot(640 - player.x, 360 - player.y);
    if (d > 4) move = { x: (640 - player.x) / d, y: (360 - player.y) / d };
  }
  return { move, aim, firing, dash };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    world.begin();
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world.state, 'demo'), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.begin();
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const skill = name === 'end' ? 'weak' : 'full';
  for (let index = 0; index < limit / STEP; index += 1) {
    world.step(STEP, autopilot(world.state, skill), false);
    if (world.state.over) break;
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
