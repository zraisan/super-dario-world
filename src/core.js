'use strict';
// Shared namespace, constants, helpers, input and save data.
const SDW = (window.SDW = window.SDW || {});

SDW.W = 384; // logical screen width  (24 tiles)
SDW.H = 224; // logical screen height (14 tiles)
SDW.T = 16;  // tile size

SDW.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
SDW.rand = (a, b) => a + Math.random() * (b - a);
SDW.overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

SDW.makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
};

// ---------------------------------------------------------------- input --
SDW.input = (() => {
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    KeyZ: 'jump', Space: 'jump', KeyK: 'jump',
    KeyX: 'spark', ShiftLeft: 'spark', ShiftRight: 'spark', KeyJ: 'spark',
    Enter: 'start', KeyP: 'start', Escape: 'start',
    KeyM: 'mute',
  };
  const held = {};
  const pressed = {};
  const sources = { key: {}, touch: {}, pad: {} };

  function set(src, action, down) {
    const was = held[action];
    sources[src][action] = down;
    held[action] = sources.key[action] || sources.touch[action] || sources.pad[action] || false;
    if (held[action] && !was) pressed[action] = true;
  }

  window.addEventListener('keydown', (e) => {
    const a = KEYS[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) set('key', a, true);
    SDW.audio && SDW.audio.unlock();
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYS[e.code];
    if (a) set('key', a, false);
  });
  window.addEventListener('blur', () => {
    for (const a in sources.key) set('key', a, false);
  });
  window.addEventListener('pointerdown', () => SDW.audio && SDW.audio.unlock());

  // On-screen controls for touch devices. Media queries like (pointer: coarse)
  // are unreliable in in-app browsers, so we also switch them on at the first
  // touch we see.
  const body = document.body;
  function enableTouch() {
    if (SDW.touch) return;
    SDW.touch = true;
    body.classList.add('touch');
    const fs = document.documentElement;
    if (fs.requestFullscreen || fs.webkitRequestFullscreen) body.classList.add('can-fs');
    layout();
  }
  function layout() {
    const portrait = window.innerHeight > window.innerWidth;
    body.classList.toggle('portrait', portrait);
    body.classList.toggle('landscape', !portrait);
    window.dispatchEvent(new Event('sdw-layout'));
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 150));
  window.addEventListener('touchstart', enableTouch, { passive: true });
  const mq = (q) => window.matchMedia && matchMedia(q).matches;
  if ((navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && (mq('(pointer: coarse)') || mq('(hover: none)') || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))) enableTouch();

  function bindTouch() {
    // Action buttons: one pointer each, so jump + zap + d-pad work together.
    document.querySelectorAll('[data-btn]').forEach((el) => {
      const a = el.dataset.btn;
      const on = (e) => {
        e.preventDefault();
        if (el.setPointerCapture) try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        set('touch', a, true);
        el.classList.add('on');
        SDW.audio.unlock();
      };
      const off = (e) => { e.preventDefault(); set('touch', a, false); el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    // D-pad: one round pad read by angle, so you can slide your thumb from
    // left to right (or into a diagonal) without lifting it.
    const pad = document.getElementById('dpad');
    if (pad) {
      const arrows = {};
      pad.querySelectorAll('[data-dir]').forEach((s) => { arrows[s.dataset.dir] = s; });
      let owner = null;
      const apply = (dirs) => {
        for (const d of ['left', 'right', 'up', 'down']) {
          set('touch', d, !!dirs[d]);
          arrows[d].classList.toggle('on', !!dirs[d]);
        }
      };
      const read = (e) => {
        const r = pad.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < r.width * 0.12) return apply({});
        const a = (Math.atan2(dy, dx) * 180) / Math.PI; // 0 = right, 90 = down
        apply({
          right: a > -60 && a < 60,
          down: a > 30 && a < 150,
          left: a > 120 || a < -120,
          up: a > -150 && a < -30,
        });
      };
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        owner = e.pointerId;
        if (pad.setPointerCapture) try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        SDW.audio.unlock();
        read(e);
      });
      pad.addEventListener('pointermove', (e) => { if (e.pointerId === owner) read(e); });
      const end = (e) => { if (e.pointerId === owner) { owner = null; apply({}); } };
      pad.addEventListener('pointerup', end);
      pad.addEventListener('pointercancel', end);
      pad.addEventListener('lostpointercapture', end);
    }

    // Fullscreen (Android and desktop; iPhone Safari doesn't allow it).
    const fsBtn = document.getElementById('fs');
    if (fsBtn) {
      fsBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      fsBtn.addEventListener('click', () => {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else if (req) {
          Promise.resolve(req.call(el)).then(() => {
            if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
          }).catch(() => {});
        }
      });
    }
    // Stop long-press menus and double-tap zoom anywhere on the page.
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  function poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((g) => g);
    if (!p) return;
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const ax = p.axes[0] || 0;
    const ay = p.axes[1] || 0;
    set('pad', 'left', b(14) || ax < -0.4);
    set('pad', 'right', b(15) || ax > 0.4);
    set('pad', 'up', b(12) || ay < -0.5);
    set('pad', 'down', b(13) || ay > 0.5);
    set('pad', 'jump', b(0) || b(1));
    set('pad', 'spark', b(2) || b(3));
    set('pad', 'start', b(9));
  }

  function endStep() {
    for (const k in pressed) delete pressed[k];
  }

  return { held, pressed, poll, endStep, bindTouch };
})();

// ----------------------------------------------------------------- save --
SDW.save = (() => {
  const KEY = 'super-dario-world-save-v2';
  let data = { cleared: [], best: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(data, JSON.parse(raw));
  } catch (e) { /* storage unavailable: play without saving */ }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  return { data, write };
})();
