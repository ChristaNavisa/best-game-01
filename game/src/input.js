// Keyboard and mouse: movement keys, the aim point, firing, dash, and the one-shot
// actions (confirm, pause, mute, restart) the main loop drains once per frame.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_DASH = 16;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Aim in playfield coordinates: the canvas is scaled to the window, so the mouse is mapped back. */
export function toField(clientX, clientY, rect, field) {
  const scale = Math.min(rect.width / field.width, rect.height / field.height);
  const ox = (rect.width - field.width * scale) / 2;
  const oy = (rect.height - field.height * scale) / 2;
  return {
    x: (clientX - rect.left - ox) / scale,
    y: (clientY - rect.top - oy) / scale,
  };
}

export function createInput(canvas, field) {
  const held = new Set();
  let actions = 0;
  let firing = false;
  let aim = { x: field.width / 2, y: field.height / 2 - 120 };
  let dashQueued = false;
  let digitQueued = -1;
  let clickQueued = null;

  const DIGIT_KEYS = {
    Digit1: 0, Numpad1: 0,
    Digit2: 1, Numpad2: 1,
    Digit3: 2, Numpad3: 2,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    const code = event.code;
    if (DIGIT_KEYS[code] !== undefined) {
      digitQueued = DIGIT_KEYS[code];
    } else if (code === 'Space' || code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (code === 'KeyP' || code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (code === 'KeyR') {
      actions |= ACTION_RESTART;
    } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      dashQueued = true;
    } else if (MOVE_KEYS[code]) {
      held.add(code);
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    aim = toField(event.clientX, event.clientY, canvas.getBoundingClientRect(), field);
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      firing = true;
      actions |= ACTION_CONFIRM;
      clickQueued = toField(event.clientX, event.clientY, canvas.getBoundingClientRect(), field);
    } else if (event.button === 2) {
      dashQueued = true;
    }
    onMouseMove(event);
  }

  function onMouseUp(event) {
    if (event.button === 0) firing = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onBlur() {
    held.clear();
    firing = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    /** Normalised movement direction from the held keys. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
      const len = Math.hypot(x, y);
      return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    aim() {
      return aim;
    },
    firing() {
      return firing;
    },
    /** True once when a dash was queued since the last call. */
    takeDash() {
      const d = dashQueued;
      dashQueued = false;
      return d;
    },
    /** Upgrade card picked with 1/2/3 since the last call, or -1. */
    takeDigit() {
      const d = digitQueued;
      digitQueued = -1;
      return d;
    },
    /** Where the mouse was clicked since the last call, in field coordinates, or null. */
    takeClick() {
      const c = clickQueued;
      clickQueued = null;
      return c;
    },
    /** One-shot actions since the last call, as a bitmask. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
