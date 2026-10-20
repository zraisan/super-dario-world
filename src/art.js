'use strict';
// Original procedural pixel art: tiles, enemies, items and backgrounds.
// Only the Dario character sheets are loaded from image files.
SDW.art = (() => {
  const T = SDW.T;
  const mk = SDW.makeCanvas;
  const R = (x, c, X, Y, W, H) => { x.fillStyle = c; x.fillRect(X, Y, W, H); };

  // Build a canvas from rows of characters mapped through a palette.
  function pix(rows, pal) {
    const [c, x] = mk(rows[0].length, rows.length);
    rows.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) {
        const col = pal[row[i]];
        if (col) R(x, col, i, y, 1, 1);
      }
    });
    return c;
  }
  function flipped(src) {
    const [c, x] = mk(src.width, src.height);
    x.translate(src.width, 0);
    x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  }
  function both(src) { return { L: src, R: flipped(src) }; }

  // -------------------------------------------------------------- sprites --
  const BUG_TOP = [
    '................',
    '................',
    '................',
    '.a..............',
    '..a.a...kkkkk...',
    '...a.a.kRRrrrkk.',
    '....kkkRRrrrrrrk',
    '...kkkkrrrrdrrrk',
    '..kwwkkrrrdrrrrk',
    '..kwbkkrdrrrrdrk',
    '..kkkkkrrrrrdrrk',
    '...kkkkkrrrrrrk.',
    '....kkkkkkkkkk..',
  ];
  const BUG_LEGS_A = ['....l..l..l..l..', '...l..l..l..l...', '...l.....l......'];
  const BUG_LEGS_B = ['....l..l..l..l..', '.....l..l..l..l.', '......l.....l...'];
  const BUG_FLAT = [
    '................', '................', '................', '................',
    '................', '................', '................', '................',
    '................', '................', '................',
    '....kkkkkkkkk...',
    '..kkrRRrrrdrrkk.',
    '.kwbkrrrdrrrrrrk',
    '.kkkkkkkkkkkkkk.',
    '..l.l.l..l.l.l..',
  ];
  const WING_UP = [
    '........vv......',
    '.......vVVv.vv..',
    '.......vVVvvVVv.',
    '........vvVVVv..',
    '.........vvvv...',
  ];
  const WING_DOWN = [
    '................',
    '................',
    '..........vvvv..',
    '.........vVVVVv.',
    '..........vvvv..',
  ];
  const ROBOT = [
    '......r.........',
    '.....rRr........',
    '......k.........',
    '...kkkkkkkkkk...',
    '..kGGGGGGGGggk..',
    '..kGkkkkkkkkgk..',
    '..kgkCckCckkgk..',
    '..kgkkkkkkkkgk..',
    '..kggggggggssk..',
    '...kkkkkkkkkk...',
    '..kgGGggggggsk..',
    '.kkgGgggggsssk..',
    '..kgggggggsssk..',
    '..kkkkkkkkkkkk..',
  ];
  const TREAD_A = ['.ktTttTttTttTtk.', '..kkkkkkkkkkkk..'];
  const TREAD_B = ['.kTttTttTttTttk.', '..kkkkkkkkkkkk..'];
  const GHOST = [
    '................',
    '.....kkkkkk.....',
    '...kkPPPpppkk...',
    '..kPPpppppppqk..',
    '.kPpppppppppqqk.',
    '.kpwwwpppwwwpqk.',
    '.kpwbwpppwbwpqk.',
    '.kpwwwpppwwwpqk.',
    '.kppppppppppqqk.',
    '.kpppkpkpkppqqk.',
    '.kppppkpkppppqk.',
    '.kpppppppppqqqk.',
    '.kppppppppqqqqk.',
    '.kpqppqpppqqqqk.',
  ];
  const GHOST_A = ['.kk.kpk.kpk.kqk.', '................'];
  const GHOST_B = ['.kpk.kpk.kqk.kk.', '..k...k...k.....'];
  const TOKEN = [
    '...kkkkkk...',
    '..kYYyyyyk..',
    '.kYYyyyyyyk.',
    'kYYyyyWyyyok',
    'kYyyyWWWyyok',
    'kYyyWWWWWyok',
    'kYyyyWWWyyok',
    'kyyyyyWyyyok',
    '.kyyyyyyyok.',
    '..kyyyyyok..',
    '...kkkkkk...',
  ];
  const CHIP = [
    '................',
    '...y.y.y.y.y....',
    '...y.y.y.y.y....',
    '..kkkkkkkkkkk...',
    'yykGGGGGGGGGkyy.',
    '..kGkkkkkkkGk...',
    'yykGkDDdddkGkyy.',
    '..kGkDddddkGk...',
    'yykGkdddddkGkyy.',
    '..kGkddddDkGk...',
    'yykGkkkkkkkGkyy.',
    '..kGGGGGGGGGk...',
    '..kkkkkkkkkkk...',
    '...y.y.y.y.y....',
    '...y.y.y.y.y....',
    '................',
  ];
  const BOLT = [
    '................',
    '.....bbbbbb.....',
    '...bbBBBBBBbb...',
    '..bBBBBBBYYYBb..',
    '.bBBBBBBYYYBBBb.',
    '.bBBBBBYYYBBBBb.',
    'bBBBBBYYYBBBBBBb',
    'bBBBBYYYYYYYBBBb',
    'bBBBYYYYYYYBBBBb',
    'bBBBBBBBYYYBBBBb',
    '.bBBBBBYYYBBBBb.',
    '.bBBBBYYYBBBBBb.',
    '..bBBBYYBBBBBb..',
    '...bbYBBBBBbb...',
    '.....bbbbbb.....',
    '................',
  ];
  const DISK = [
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    '.kgggSSSSSSgggk.',
    '.kgggSSkkSSgggk.',
    '.kgggSSkkSSgggk.',
    '.kgggSSSSSSgggk.',
    '.kggggggggggggk.',
    '.kgwwwwwwwwwwgk.',
    '.kgwLLLLLLLLwgk.',
    '.kgwwwwwwwwwwgk.',
    '.kgwLLLLLwwwwgk.',
    '.kgwwwwwwwwwwgk.',
    '.kggggggggggggk.',
    '.kggggggggggggk.',
    '.kkkkkkkkkkkkkk.',
  ];

  // Clawd: a little orange pair-programming buddy.
  const CLAWD = [
    '..OOOOOOOOOOOO..',
    '..oOOOOOOOOOOo..',
    '..ooKooooooKoo..',
    '..ooKooooooKoo..',
    'oooooooooooooooo',
    'dooooooooooooood',
    '..oooooooooooo..',
    '..dddddddddddd..',
  ];
  const CLAWD_LEGS = [['..d.d......d.d..', '..d.d......d.d..'], ['...d.d....d.d...', '..d...d..d...d..']];
  const STAR = [
    '...w...',
    '.w.o.w.',
    '..ooo..',
    'woooooo',
    '..ooo..',
    '.w.o.w.',
    '...w...',
  ];

  const PAL = {
    bug: { a: '#2a1a24', k: '#1b1020', r: '#e2453c', R: '#ff8a7a', d: '#9a2228', w: '#ffffff', b: '#1b1020', l: '#3a2430' },
    hopper: { a: '#1d2a14', k: '#14200f', r: '#46c75a', R: '#a6f59a', d: '#23803a', w: '#ffffff', b: '#14200f', l: '#26351c', v: '#bfe9ff', V: '#ffffff' },
    robot: { r: '#ff3b5c', R: '#ffd0d8', k: '#1d2230', G: '#e3e9f0', g: '#b7c0cc', s: '#7d8799', C: '#38e0ff', c: '#b8f6ff', t: '#2b2f3a', T: '#6a7080' },
    robotOff: { r: '#552030', R: '#552030', k: '#1d2230', G: '#9aa2b0', g: '#7c8494', s: '#5a6170', C: '#ff3b5c', c: '#7a1a2a', t: '#2b2f3a', T: '#4a505e' },
    ghost: { k: '#3a1550', P: '#f4dcff', p: '#c58cff', q: '#9a5be0', w: '#ffffff', b: '#2a0a3a' },
    ghostHurt: { k: '#550a1a', P: '#ffffff', p: '#ffb0c0', q: '#ff7090', w: '#ffffff', b: '#550a1a' },
    token: { k: '#7a4a00', Y: '#fff3b0', y: '#ffc83a', o: '#d98a00', W: '#fffbe8' },
    chip: { k: '#0d2a14', G: '#2fae55', D: '#5a6478', d: '#20242e', y: '#ffd24a' },
    bolt: { b: '#0e2a6a', B: '#3f7dff', Y: '#fff36b' },
    disk: { k: '#0f2a1a', g: '#2fbf6a', S: '#c9d2df', w: '#f4f7fb', L: '#7b8aa0' },
    clawd: { O: '#f0a07c', o: '#d97757', d: '#a8502f', K: '#1b1020' },
    star: { w: '#ffe2cf', o: '#d97757' },
  };

  // Paperclip maximizer: a bent steel wire with googly eyes.
  const CLIP = [
    '....kkkkkk......',
    '...kSSSSSSk.....',
    '..kSkkkkkkSk....',
    '..kSk....kSk....',
    '..kSk.kk.kSk....',
    '..kSk.kSkkSk....',
    '..kSk.kSk.kSk...',
    '..kSk.kSk.kSk...',
    '..kSk.kSk.kSk...',
    '..kSk.kSk.kSk...',
    '..kSk.kkk.kSk...',
    '..kSk.....kSk...',
    '...kSkkkkkSk....',
    '....kSSSSSk.....',
    '.....kkkkk......',
  ];
  function paperclip(frame) {
    const [c, x] = mk(16, 16);
    x.drawImage(pix(CLIP, { k: '#2b3142', S: '#dfe6f0' }), 0, 0);
    // googly eyes on the top bend
    for (const ex of [3, 8]) {
      R(x, '#1b1020', ex - 1, 1, 6, 6);
      R(x, '#ffffff', ex, 2, 4, 4);
      R(x, '#1b1020', ex + 1 + (frame % 2), 3, 2, 2);
    }
    // little feet
    R(x, '#2b3142', frame ? 3 : 2, 15, 3, 1);
    R(x, '#2b3142', frame ? 9 : 10, 15, 3, 1);
    return c;
  }

  const S = {};
  function buildSprites() {
    S.bug = [both(pix(BUG_TOP.concat(BUG_LEGS_A), PAL.bug)), both(pix(BUG_TOP.concat(BUG_LEGS_B), PAL.bug))];
    S.bugFlat = both(pix(BUG_FLAT, PAL.bug));
    const hop = (legs, wing, wy) => {
      const body = pix(BUG_TOP.concat(legs), PAL.hopper);
      const [c, x] = mk(16, 16);
      x.drawImage(body, 0, 0);
      x.drawImage(pix(wing, PAL.hopper), 0, wy);
      return both(c);
    };
    S.hopper = [hop(BUG_LEGS_A, WING_UP, 0), hop(BUG_LEGS_B, WING_DOWN, 1)];
    S.robot = [both(pix(ROBOT.concat(TREAD_A), PAL.robot)), both(pix(ROBOT.concat(TREAD_B), PAL.robot))];
    S.robotOff = both(pix(ROBOT.concat(TREAD_A), PAL.robotOff));
    S.ghost = [both(pix(GHOST.concat(GHOST_A), PAL.ghost)), both(pix(GHOST.concat(GHOST_B), PAL.ghost))];
    S.ghostHurt = both(pix(GHOST.concat(GHOST_A), PAL.ghostHurt));
    S.token = pix(TOKEN, PAL.token);
    S.chip = pix(CHIP, PAL.chip);
    S.bolt = pix(BOLT, PAL.bolt);
    S.disk = pix(DISK, PAL.disk);
    S.clawd = [0, 1].map((f) => both(pix(CLAWD.concat(CLAWD_LEGS[f]), PAL.clawd)));
    S.star = pix(STAR, PAL.star);
    S.paperclip = [both(paperclip(0)), both(paperclip(1))];
    S.clipFlat = (() => {
      const [c, x] = mk(16, 16);
      R(x, '#2b3142', 0, 11, 16, 5); R(x, '#dfe6f0', 1, 12, 14, 3); R(x, '#2b3142', 4, 13, 8, 1);
      return both(c);
    })();
  }

  // ---------------------------------------------------------------- tiles --
  const THEMES = {
    plains: {
      grass: '#45c94f', grassHi: '#9af07f', grassLo: '#2c9a3d',
      dirt: '#c47a3d', dirtLo: '#9a5a2a', dirtHi: '#e0a066', edge: '#7a4420',
    },
    cave: {
      grass: '#8a95ad', grassHi: '#b9c4da', grassLo: '#5f6980',
      dirt: '#525b70', dirtLo: '#3d4456', dirtHi: '#6c7690', edge: '#2c3240', gem: '#5ff3ff',
    },
    sky: {
      grass: '#ffffff', grassHi: '#ffffff', grassLo: '#d9ecff',
      dirt: '#bcdcf7', dirtLo: '#9cc5ec', dirtHi: '#e2f1ff', edge: '#5f93c8',
    },
    castle: {
      grass: '#8b6a80', grassHi: '#b893aa', grassLo: '#5c3f54',
      dirt: '#6e4b63', dirtLo: '#3c2436', dirtHi: '#8b6a80', edge: '#2a1626',
    },
    foundry: {
      grass: '#76d82a', grassHi: '#c8ff7a', grassLo: '#3f8a12',
      dirt: '#2c3138', dirtLo: '#1c2026', dirtHi: '#454c57', edge: '#0d0f12',
    },
    summit: {
      grass: '#ffe9a8', grassHi: '#ffffff', grassLo: '#d9b45a',
      dirt: '#e8e0f2', dirtLo: '#bfb2d6', dirtHi: '#ffffff', edge: '#6a5a8a',
    },
  };

  const cache = new Map();
  function cached(key, w, h, draw) {
    let c = cache.get(key);
    if (!c) {
      const [cv, x] = mk(w, h);
      draw(x);
      cache.set(key, cv);
      c = cv;
    }
    return c;
  }

  // Deterministic noise for tile speckles.
  const hash = (a, b) => {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  function ground(theme, top, left, right, bottom, seed) {
    const P = THEMES[theme];
    return cached(`g:${theme}:${+top}${+left}${+right}${+bottom}:${seed}`, T, T, (x) => {
      if (theme === 'castle') {
        R(x, P.dirtLo, 0, 0, T, T);
        for (let row = 0; row < 4; row++) {
          const off = row % 2 ? 4 : 0;
          for (let col = -1; col < 3; col++) {
            const bx = col * 8 + off;
            R(x, P.dirt, bx + 1, row * 4 + 1, 7, 3);
            R(x, P.dirtHi, bx + 1, row * 4 + 1, 7, 1);
          }
        }
      } else if (theme === 'foundry') {
        // Riveted steel plates.
        R(x, P.dirt, 0, 0, T, T);
        R(x, P.dirtHi, 0, 0, T, 1);
        R(x, P.dirtLo, 0, 8, T, 1);
        for (const [px, py] of [[2, 3], [13, 3], [2, 12], [13, 12]]) { R(x, P.dirtHi, px, py, 1, 1); R(x, P.edge, px + 1, py + 1, 1, 1); }
        if (seed === 5) { R(x, '#ffcc33', 5, 10, 6, 2); R(x, P.edge, 7, 10, 2, 2); }
      } else if (theme === 'summit') {
        // Marble with gold veins.
        R(x, P.dirt, 0, 0, T, T);
        for (let i = 0; i < 4; i++) R(x, P.dirtLo, Math.floor(hash(seed, i) * 12), Math.floor(hash(i, seed) * 14), 4, 1);
        if (seed % 3 === 0) R(x, '#f2c94c', Math.floor(hash(seed, 9) * 10), Math.floor(hash(9, seed) * 12), 5, 1);
      } else if (theme === 'sky') {
        R(x, P.dirt, 0, 0, T, T);
        for (let i = 0; i < 6; i++) {
          R(x, P.dirtLo, Math.floor(hash(seed, i) * 14), Math.floor(hash(i, seed) * 14), 2, 1);
        }
      } else {
        R(x, P.dirt, 0, 0, T, T);
        for (let i = 0; i < 7; i++) {
          const px = Math.floor(hash(seed, i) * 15);
          const py = Math.floor(hash(i + 9, seed) * 15);
          R(x, i % 3 ? P.dirtLo : P.dirtHi, px, py, 2, i % 2 ? 1 : 2);
        }
        if (theme === 'cave' && seed === 3) {
          R(x, P.gem, 6, 8, 2, 3);
          R(x, '#ffffff', 6, 8, 1, 1);
        }
      }
      if (left) R(x, P.edge, 0, 0, 1, T);
      if (right) R(x, P.edge, T - 1, 0, 1, T);
      if (bottom) R(x, P.edge, 0, T - 1, T, 1);
      if (top) {
        if (theme === 'sky') {
          R(x, '#ffffff', 0, 0, T, 5);
          for (let i = 0; i < T; i += 4) R(x, '#ffffff', i, 5, 3, 1 + ((i / 4) % 2));
          R(x, P.edge, 0, 0, T, 1);
          R(x, '#e2f1ff', 2, 2, 5, 1);
          if (left) R(x, P.edge, 0, 0, 1, 6);
          if (right) R(x, P.edge, T - 1, 0, 1, 6);
        } else {
          R(x, P.grass, 0, 0, T, 4);
          R(x, P.grassHi, 0, 0, T, 1);
          for (let i = 0; i < T; i += 3) R(x, P.grassLo, i, 4, 2, 1 + ((i + seed) % 2));
          if (left) R(x, P.grassLo, 0, 0, 1, 5);
          if (right) R(x, P.grassLo, T - 1, 0, 1, 5);
        }
      }
    });
  }

  function brick(frame) {
    return cached(`B:${frame}`, T, T, (x) => {
      R(x, '#2b3142', 0, 0, T, T);
      R(x, '#7f8aa3', 1, 1, 14, 14);
      R(x, '#b8c2d6', 1, 1, 14, 1);
      R(x, '#b8c2d6', 1, 1, 1, 14);
      R(x, '#586178', 1, 14, 14, 1);
      R(x, '#586178', 14, 1, 1, 14);
      for (const vy of [6, 9, 12]) R(x, '#454d60', 3, vy, 10, 1);
      R(x, frame ? '#2a7a4a' : '#4dff88', 3, 3, 2, 1);
      R(x, frame ? '#ffbf3a' : '#7a5a1a', 6, 3, 2, 1);
    });
  }

  const GLYPH = [
    '.k......',
    '..k.....',
    '...k....',
    '..k.....',
    '.k..kkk.',
  ];
  function prompt(frame) {
    return cached(`Q:${frame}`, T, T, (x) => {
      R(x, '#1d1533', 0, 0, T, T);
      R(x, '#6b4fd6', 1, 1, 14, 14);
      R(x, '#9b84ff', 1, 1, 14, 2);
      R(x, '#4a35a8', 1, 13, 14, 2);
      R(x, '#d9cfff', 2, 2, 1, 1);
      R(x, '#d9cfff', 13, 2, 1, 1);
      R(x, '#2f2266', 2, 13, 1, 1);
      R(x, '#2f2266', 13, 13, 1, 1);
      GLYPH.forEach((row, gy) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] !== 'k') continue;
          if (i >= 4 && frame % 2) continue; // blinking cursor
          R(x, '#2a1e5c', 3 + i, 6 + gy, 1, 1);
          R(x, '#f2ecff', 3 + i, 5 + gy, 1, 1);
        }
      });
    });
  }

  function used() {
    return cached('U', T, T, (x) => {
      R(x, '#221d30', 0, 0, T, T);
      R(x, '#4b4560', 1, 1, 14, 14);
      R(x, '#5f5878', 1, 1, 14, 1);
      R(x, '#221d30', 3, 3, 1, 1);
      R(x, '#221d30', 12, 3, 1, 1);
      R(x, '#221d30', 3, 12, 1, 1);
      R(x, '#221d30', 12, 12, 1, 1);
    });
  }

  function metal() {
    return cached('M', T, T, (x) => {
      R(x, '#3a4152', 0, 0, T, T);
      R(x, '#a2acbf', 1, 1, 14, 14);
      R(x, '#d3dae8', 1, 1, 14, 1);
      R(x, '#d3dae8', 1, 1, 1, 14);
      R(x, '#6f788c', 1, 14, 14, 1);
      R(x, '#6f788c', 14, 1, 1, 14);
      R(x, '#8892a6', 4, 4, 8, 8);
      R(x, '#b5bdcd', 5, 5, 6, 6);
      for (const [px, py] of [[3, 3], [12, 3], [3, 12], [12, 12]]) {
        R(x, '#f0f4fa', px, py, 1, 1);
      }
    });
  }

  function semi(theme) {
    return cached(`S:${theme}`, T, T, (x) => {
      if (theme === 'sky') {
        R(x, '#ffffff', 0, 1, T, 5);
        R(x, '#ffffff', 2, 0, 5, 1);
        R(x, '#ffffff', 9, 0, 5, 1);
        R(x, '#cfe5fb', 0, 5, T, 2);
      } else if (theme === 'cave') {
        R(x, '#2c3240', 0, 0, T, 5);
        R(x, '#9aa5bd', 0, 0, T, 1);
        for (let i = 1; i < T; i += 3) R(x, '#6c7690', i, 1, 2, 3);
      } else if (theme === 'foundry') {
        R(x, '#0d0f12', 0, 0, T, 5);
        R(x, '#76d82a', 0, 0, T, 1);
        for (let i = 0; i < T; i += 4) R(x, '#454c57', i + 1, 1, 2, 3);
      } else if (theme === 'summit') {
        R(x, '#6a5a8a', 0, 0, T, 5);
        R(x, '#ffe9a8', 0, 0, T, 2);
        R(x, '#d9b45a', 0, 2, T, 2);
      } else if (theme === 'castle') {
        R(x, '#2a1626', 0, 0, T, 6);
        R(x, '#b893aa', 0, 0, T, 2);
        R(x, '#6e4b63', 0, 2, T, 3);
      } else {
        R(x, '#7d4e22', 0, 0, T, 6);
        R(x, '#e0a35e', 0, 0, T, 2);
        R(x, '#b97a3e', 0, 2, T, 3);
        R(x, '#7d4e22', 7, 2, 1, 3);
        R(x, '#5c3814', 3, 6, 2, 3);
        R(x, '#5c3814', 11, 6, 2, 3);
      }
    });
  }

  function spikes() {
    return cached('^', T, T, (x) => {
      R(x, '#3a3f4c', 0, 13, T, 3);
      R(x, '#5a6070', 0, 13, T, 1);
      for (let s = 0; s < 2; s++) {
        const cx = s * 8 + 4;
        for (let i = 0; i < 10; i++) {
          const half = Math.ceil(((i + 1) * 4) / 10);
          R(x, '#e6eaf2', cx - half, 3 + i, half, 1);
          R(x, '#7c8496', cx, 3 + i, half, 1);
        }
        R(x, '#ffffff', cx - 1, 3, 1, 2);
      }
    });
  }

  function lava(top, frame) {
    return cached(`L:${+top}:${frame}`, T, T, (x) => {
      R(x, '#d8380c', 0, 0, T, T);
      for (let i = 0; i < 5; i++) {
        R(x, '#ff6a1a', Math.floor(hash(i, frame + 3) * 13), Math.floor(hash(frame, i) * 13), 3, 2);
      }
      if (top) {
        x.clearRect(0, 0, T, 3);
        for (let i = 0; i < T; i++) {
          const h = 2 + Math.round(Math.sin((i + frame * 4) * 0.8) * 1.5);
          x.clearRect(i, 0, 1, h);
          R(x, '#ffd33a', i, h, 1, 2);
        }
      }
    });
  }

  // Conveyor belt: chevrons scroll in the belt's direction.
  function conveyor(dir, frame) {
    return cached(`C:${dir}:${frame}`, T, T, (x) => {
      R(x, '#0d0f12', 0, 0, T, T);
      R(x, '#3a414c', 0, 1, T, 6);
      R(x, '#5a6372', 0, 1, T, 1);
      for (let i = -8; i < T + 8; i += 6) {
        const cx = i + (dir > 0 ? frame * 2 : -frame * 2);
        R(x, '#ffcc33', cx, 3, 2, 1); R(x, '#ffcc33', cx + (dir > 0 ? 1 : -1), 4, 2, 1); R(x, '#ffcc33', cx, 5, 2, 1);
      }
      R(x, '#22262d', 0, 7, T, 9);
      for (const wx of [3, 12]) { R(x, '#5a6372', wx - 2, 9, 5, 5); R(x, '#1c2026', wx, 10 + ((frame + wx) % 3), 1, 1); }
    });
  }

  // Cooling door: locked until the rack is stacked.
  function door(ty) {
    return cached(`D:${ty % 3}`, T, T, (x) => {
      R(x, '#1d2a3a', 0, 0, T, T);
      R(x, '#5a7a9a', 1, 0, 14, T);
      R(x, '#8fb4d8', 1, 0, 1, T);
      R(x, '#3a5674', 14, 0, 1, T);
      if (ty % 3 === 1) {
        R(x, '#1d2a3a', 4, 3, 8, 8);
        R(x, '#7fe0ff', 5, 4, 6, 6);
        R(x, '#ffffff', 7, 4, 2, 6); R(x, '#ffffff', 5, 6, 6, 2);
      } else {
        for (let y = 2; y < T; y += 4) R(x, '#3a5674', 3, y, 10, 1);
      }
    });
  }

  function solid(ch) {
    return ch === '#' || ch === 'B' || ch === '?' || ch === 'P' || ch === '1' || ch === 'U' || ch === '=' || ch === '^' ||
      ch === 'C' || ch === '<' || ch === '>' || ch === 'D';
  }

  // Draw a single map tile. `world` lets ground tiles look at neighbours.
  function drawTile(ctx, world, ch, tx, ty, sx, sy, t) {
    let img = null;
    switch (ch) {
      case '#': {
        const up = world.tile(tx, ty - 1);
        const top = up !== '#';
        const left = world.tile(tx - 1, ty) !== '#' && tx > 0;
        const right = world.tile(tx + 1, ty) !== '#' && tx < world.w - 1;
        const bottom = ty < world.h - 1 && world.tile(tx, ty + 1) !== '#';
        img = ground(world.theme, top, left, right, bottom, Math.floor(hash(tx, ty) * 8));
        break;
      }
      case 'B': img = brick(((t >> 5) + tx) % 2); break;
      case '?': case 'P': case '1': case 'C': img = prompt((t >> 4) % 4); break;
      case '>': img = conveyor(1, (t >> 2) % 3); break;
      case '<': img = conveyor(-1, (t >> 2) % 3); break;
      case 'D': img = door(ty); break;
      case 'U': img = used(); break;
      case '=': img = metal(); break;
      case '-': img = semi(world.theme); break;
      case '^': img = spikes(); break;
      case '~': img = lava(world.tile(tx, ty - 1) !== '~', (t >> 3) % 4); break;
      default: return;
    }
    ctx.drawImage(img, sx, sy);
  }

  // ---------------------------------------------------------- backgrounds --
  const STRIP = 512;
  function strip(key, h, draw) { return cached(key, STRIP, h, draw); }
  const wave = (x, a) => a.reduce((s, [amp, k, ph]) => s + amp * Math.sin((x / STRIP) * Math.PI * 2 * k + ph), 0);

  function hills(key, color, hi, base, waves) {
    return strip(key, SDW.H, (x) => {
      for (let i = 0; i < STRIP; i++) {
        const top = Math.round(base - wave(i, waves));
        R(x, color, i, top, 1, SDW.H - top);
        R(x, hi, i, top, 1, 1);
      }
    });
  }

  function cloudShape(x, cx, cy, s, col, shade) {
    R(x, col, cx - 10 * s, cy, 20 * s, 6 * s);
    R(x, col, cx - 6 * s, cy - 4 * s, 10 * s, 6 * s);
    R(x, col, cx + 1 * s, cy - 6 * s, 7 * s, 8 * s);
    R(x, col, cx - 13 * s, cy + 2 * s, 26 * s, 4 * s);
    if (shade) R(x, shade, cx - 13 * s, cy + 5 * s, 26 * s, s);
  }

  function clouds(key, col, shade, count, ymin, ymax, scale) {
    return strip(key, SDW.H, (x) => {
      for (let i = 0; i < count; i++) {
        const cx = Math.floor((i + 0.5) * (STRIP / count) + (hash(i, 3) - 0.5) * 40);
        const cy = Math.floor(ymin + hash(i, 7) * (ymax - ymin));
        cloudShape(x, cx, cy, scale, col, shade);
      }
    });
  }

  function gradient(key, top, bottom) {
    return cached(key, 1, SDW.H, (x) => {
      const g = x.createLinearGradient(0, 0, 0, SDW.H);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      x.fillStyle = g;
      x.fillRect(0, 0, 1, SDW.H);
    });
  }

  function racks() {
    return strip('bg:racks', SDW.H, (x) => {
      for (let i = 0; i < 8; i++) {
        const rx = i * 64 + 8;
        const top = 40 + Math.floor(hash(i, 1) * 40);
        R(x, '#16223a', rx, top, 40, SDW.H - top);
        R(x, '#1f2f4d', rx + 2, top + 2, 36, SDW.H - top);
        for (let sy = top + 6; sy < SDW.H; sy += 8) R(x, '#121b2e', rx + 4, sy, 32, 5);
      }
    });
  }

  function castleWall() {
    return strip('bg:castle', SDW.H, (x) => {
      for (let row = 0; row < SDW.H / 8; row++) {
        const off = row % 2 ? 8 : 0;
        for (let col = -1; col < STRIP / 16 + 1; col++) {
          R(x, '#2e1630', col * 16 + off + 1, row * 8 + 1, 15, 7);
        }
      }
      for (let i = 0; i < 4; i++) {
        const wx = i * 128 + 48;
        R(x, '#120814', wx, 50, 20, 34);
        R(x, '#120814', wx + 2, 46, 16, 4);
        R(x, '#ffb347', wx + 4, 56, 12, 24);
        R(x, '#ff7b2a', wx + 4, 70, 12, 10);
        R(x, '#120814', wx + 9, 56, 2, 24);
      }
    });
  }

  function factory() {
    return strip('bg:factory', SDW.H, (x) => {
      for (let i = 0; i < 4; i++) {
        const fx = i * 128 + 10;
        const top = 110 + Math.floor(hash(i, 4) * 30);
        R(x, '#0b1a0f', fx, top, 100, SDW.H - top);
        for (let k = 0; k < 4; k++) R(x, '#0b1a0f', fx + k * 25, top - 12, 18, 14);
        R(x, '#0b1a0f', fx + 70, top - 60, 12, 60);
        for (let wy = top + 10; wy < SDW.H - 10; wy += 14) {
          for (let wx = fx + 8; wx < fx + 92; wx += 16) R(x, hash(wx, wy) > 0.4 ? '#4f9a1e' : '#183a1e', wx, wy, 8, 6);
        }
      }
    });
  }

  function tiled(ctx, img, camX, factor, y = 0, drift = 0) {
    let off = Math.floor((camX * factor + drift) % STRIP);
    if (off < 0) off += STRIP;
    for (let x = -off; x < SDW.W; x += STRIP) ctx.drawImage(img, x, y);
  }

  function background(ctx, theme, camX, t) {
    if (theme === 'plains') {
      ctx.drawImage(gradient('sky:plains', '#4aa8f0', '#c8ecff'), 0, 0, SDW.W, SDW.H);
      tiled(ctx, clouds('bg:pc', '#ffffff', '#dff1ff', 5, 20, 70, 2), camX, 0.1, 0, t * 0.05);
      tiled(ctx, hills('bg:p1', '#9fd3e6', '#c7e9f5', 120, [[22, 2, 0], [10, 5, 1]]), camX, 0.2);
      tiled(ctx, hills('bg:p2', '#6fcf7f', '#9be6a4', 150, [[16, 3, 2], [8, 7, 0.4]]), camX, 0.4);
      tiled(ctx, hills('bg:p3', '#4caf5c', '#78cc80', 178, [[10, 4, 1], [5, 11, 2]]), camX, 0.6);
    } else if (theme === 'cave') {
      ctx.drawImage(gradient('sky:cave', '#070b14', '#1a2640'), 0, 0, SDW.W, SDW.H);
      tiled(ctx, racks(), camX, 0.3);
      // Blinking rack LEDs, drawn live so they animate.
      let off = (camX * 0.3) % STRIP;
      for (let base = -off; base < SDW.W; base += STRIP) {
        for (let i = 0; i < 8; i++) {
          const rx = base + i * 64 + 8;
          const top = 40 + Math.floor(hash(i, 1) * 40);
          for (let sy = top + 7, n = 0; sy < SDW.H; sy += 8, n++) {
            const on = hash(i * 31 + n, Math.floor(t / 20) + n) > 0.55;
            if (on) R(ctx, n % 3 ? '#3dff8a' : '#38c8ff', rx + 30, sy + 1, 2, 2);
          }
        }
      }
    } else if (theme === 'sky') {
      ctx.drawImage(gradient('sky:sky', '#5ab8ff', '#eaf7ff'), 0, 0, SDW.W, SDW.H);
      tiled(ctx, clouds('bg:s1', '#d6ecff', null, 4, 120, 190, 4), camX, 0.15, 0, t * 0.03);
      tiled(ctx, clouds('bg:s2', '#ffffff', '#d4ebff', 6, 40, 110, 2), camX, 0.35, 0, t * 0.08);
    } else if (theme === 'foundry') {
      ctx.drawImage(gradient('sky:foundry', '#05100a', '#173a1c'), 0, 0, SDW.W, SDW.H);
      // A stock chart that only goes up.
      const off = camX * 0.08 + t * 0.15;
      ctx.strokeStyle = 'rgba(118,216,42,0.18)';
      ctx.lineWidth = 1;
      for (let gy = 30; gy < SDW.H; gy += 24) { ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(SDW.W, gy + 0.5); ctx.stroke(); }
      ctx.strokeStyle = '#76d82a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let sx = 0; sx <= SDW.W; sx += 4) {
        const u = sx + off;
        const y = 150 - ((u * 0.12) % 110) - Math.sin(u * 0.07) * 6 - hash(Math.floor(u / 4), 3) * 5;
        if (sx === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
      }
      ctx.stroke();
      tiled(ctx, factory(), camX, 0.35);
      // Furnace glow pulses in time with the chart.
      ctx.fillStyle = `rgba(118,216,42,${0.1 + Math.sin(t * 0.04) * 0.04})`;
      ctx.fillRect(0, SDW.H - 50, SDW.W, 50);
    } else if (theme === 'summit') {
      ctx.drawImage(gradient('sky:summit', '#1a0b3a', '#ff9a5a'), 0, 0, SDW.W, SDW.H);
      for (let i = 0; i < 40; i++) {
        const sx = Math.floor((hash(i, 11) * STRIP - camX * 0.03) % SDW.W + SDW.W) % SDW.W;
        if ((t >> 4) % 5 !== i % 5) R(ctx, '#ffffff', sx, Math.floor(hash(i, 12) * 90), 1, 1);
      }
      // The glowing AGI orb on the horizon.
      const ox = 270 - ((camX * 0.05) % 40);
      for (let r = 46; r > 0; r -= 6) {
        ctx.fillStyle = `rgba(255,${200 + (46 - r)},${120 + (46 - r) * 2},${0.12 + (46 - r) / 120})`;
        ctx.beginPath(); ctx.arc(ox, 120, r + Math.sin(t * 0.05) * 2, 0, Math.PI * 2); ctx.fill();
      }
      tiled(ctx, hills('bg:su1', '#4a2a6a', '#6a4a8a', 150, [[24, 2, 1], [12, 5, 0]]), camX, 0.2);
      tiled(ctx, clouds('bg:su2', 'rgba(255,220,240,0.55)', null, 5, 60, 130, 3), camX, 0.3, 0, t * 0.05);
      tiled(ctx, hills('bg:su3', '#2a1a4a', '#4a3a6a', 185, [[12, 3, 2], [6, 9, 1]]), camX, 0.5);
    } else {
      ctx.drawImage(gradient('sky:castle', '#14070f', '#4b1a24'), 0, 0, SDW.W, SDW.H);
      tiled(ctx, castleWall(), camX, 0.5);
      const glow = 0.25 + Math.sin(t * 0.05) * 0.08;
      ctx.fillStyle = `rgba(255,90,20,${glow})`;
      ctx.fillRect(0, SDW.H - 40, SDW.W, 40);
    }
  }

  function init() { buildSprites(); }

  return { init, S, drawTile, background, solid, pix, flipped, cloudShape, hash, R };
})();
