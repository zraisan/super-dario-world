'use strict';
// THE AI RACE: an into-the-screen kart race. The road is a loop of short
// segments projected row by row (curves, hills, rumble strips); karts, signs
// and pickups are sprites scaled by depth. Three laps, finish 1st to clear.
(() => {
  const W = SDW.W;
  const H = SDW.H;
  const clamp = SDW.clamp;
  const hash = (a, b) => SDW.art.hash(a, b);
  const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const mod = (a, n) => ((a % n) + n) % n;
  const lerp = (a, b, t) => a + (b - a) * t;
  const tone = (f, d, o) => SDW.audio.tone(f, d, o);
  const noise = (d, o) => SDW.audio.noise(d, o);
  const seq = (n, t, v) => SDW.audio.seq(n, t, v);
  const FONT = '"Press Start 2P", monospace';

  // World units. Sprites are drawn 1:1 at the player's depth (K units per px).
  const SEG = 100;        // segment length
  const RW = 1000;        // road half-width
  const CAMH = 600;       // camera height
  const F = 160;          // focal length (px)
  const PZ = 800;         // camera -> player distance
  const K = PZ / F;
  const HY = 92;          // horizon row
  const DRAW = 170;       // segments drawn
  const LAPS = 3;
  const MAXS = 6000;      // top speed: ~25 s a lap
  const DT = 1 / 60;
  const LANE = [-0.62, 0, 0.62];
  const KW = 0.24;        // kart width in road half-widths
  const PY = HY + Math.round((CAMH * F) / PZ); // ground row under the player
  const OUT = '#14101e';
  const ORD = ['', '1ST', '2ND', '3RD', '4TH'];

  // ------------------------------------------------------- tiny 3x5 font --
  // Each glyph is 5 rows of 3 bits (octal digits), for labels on sprites.
  const GLYPH = {
    A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755',
    I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644',
    Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255',
    Y: '55222', Z: '71247', 0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616',
    6: '34757', 7: '71222', 8: '75757', 9: '75716', '!': '22202', '?': '61202', $: '36236', '.': '00002',
    '-': '00700', '%': '51245', "'": '22000', '{': '32623', '}': '62326', ':': '02020', '/': '11244',
  };
  function tiny(g, str, x, y, col, sc = 1) {
    g.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const gl = GLYPH[str[i]];
      if (!gl) continue;
      for (let r = 0; r < 5; r++) {
        for (let b = 0; b < 3; b++) if (+gl[r] & (4 >> b)) g.fillRect(x + (i * 4 + b) * sc, y + r * sc, sc, sc);
      }
    }
  }
  const tinyW = (s, sc = 1) => (s.length * 4 - 1) * sc;

  // -------------------------------------------------------------- art kit --
  function cv(w, h, fn) {
    const [c, g] = SDW.makeCanvas(w, h);
    fn(g);
    return c;
  }
  function blob(g, cx, cy, rx, ry, col) {
    for (let y = -ry; y <= ry; y++) {
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      R(g, col, cx - hw, cy + y, hw * 2, 1);
    }
  }
  function blobO(g, cx, cy, rx, ry, col) {
    blob(g, cx, cy, rx + 1, ry + 1, OUT);
    blob(g, cx, cy, rx, ry, col);
  }

  function pixmap(g, rows, x, y, pal) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (pal[row[i]]) R(g, pal[row[i]], x + i, y + j, 1, 1);
    });
  }
  const FLUKE = [
    'kk..................kk',
    'klk................kbk',
    'kbbk..............kbbk',
    '.kbbkk..........kkbbk.',
    '..klbbkkk....kkkbbbk..',
    '...kkbbbbkkkkbbbbkk...',
    '.....kkkbbbbbbkkk.....',
    '.......kkbbbbkk.......',
  ];

  const KARTS = {
    dario: { body: '#2c3e9a', hi: '#5a74d8', dark: '#1a2560', stripe: '#e8333a', plate: 'D-1' },
    whale: { body: '#d8323a', hi: '#ff6a6a', dark: '#8a1820', stripe: '#ffd84a', plate: '$6M' },
    llama: { body: '#6b4fd6', hi: '#9b84ff', dark: '#3a2a7a', stripe: '#f4f4f8', plate: 'OSS' },
  };

  function kartBack(g, ox, oy, c, f) {
    for (const tx of [0, 37]) {
      R(g, OUT, ox + tx, oy + 8, 11, 16);
      R(g, '#2b2836', ox + tx + 1, oy + 9, 9, 14);
      for (let y = f; y < 14; y += 3) R(g, '#4a4658', ox + tx + 1, oy + 9 + y, 9, 1);
    }
    R(g, OUT, ox + 13, oy, 22, 8);
    R(g, c.dark, ox + 14, oy + 1, 20, 6);
    R(g, OUT, ox + 8, oy + 5, 32, 17);
    R(g, c.body, ox + 9, oy + 6, 30, 15);
    R(g, c.hi, ox + 9, oy + 6, 30, 2);
    R(g, c.stripe, ox + 9, oy + 10, 30, 2);
    R(g, c.dark, ox + 9, oy + 17, 30, 4);
    R(g, OUT, ox + 10, oy + 12, 6, 4); R(g, '#ff4a4a', ox + 11, oy + 13, 4, 2);
    R(g, OUT, ox + 32, oy + 12, 6, 4); R(g, '#ff4a4a', ox + 33, oy + 13, 4, 2);
    R(g, OUT, ox + 17, oy + 12, 14, 8); R(g, '#f4f4f8', ox + 18, oy + 13, 12, 6);
    tiny(g, c.plate, ox + 18 + ((12 - tinyW(c.plate)) >> 1), oy + 14, '#1d1533');
    R(g, OUT, ox + 6, oy + 20, 36, 4); R(g, '#7a8094', ox + 7, oy + 21, 34, 2);
    R(g, OUT, ox + 13, oy + 21, 5, 3); R(g, '#c8d0e0', ox + 14, oy + 22, 3, 1);
    R(g, OUT, ox + 30, oy + 21, 5, 3); R(g, '#c8d0e0', ox + 31, oy + 22, 3, 1);
  }

  function kartFront(g, ox, oy, c) {
    for (const tx of [0, 38]) {
      R(g, OUT, ox + tx, oy + 8, 10, 15); R(g, '#2b2836', ox + tx + 1, oy + 9, 8, 13);
      R(g, '#4a4658', ox + tx + 2, oy + 12, 6, 1); R(g, '#4a4658', ox + tx + 2, oy + 17, 6, 1);
    }
    R(g, OUT, ox + 16, oy, 16, 4); R(g, '#3a3646', ox + 17, oy + 1, 14, 2);
    R(g, OUT, ox + 8, oy + 3, 32, 18);
    R(g, c.body, ox + 9, oy + 4, 30, 16);
    R(g, c.hi, ox + 9, oy + 4, 30, 2);
    R(g, c.stripe, ox + 22, oy + 4, 4, 12);
    R(g, c.dark, ox + 9, oy + 16, 30, 4);
    R(g, OUT, ox + 10, oy + 9, 7, 5); R(g, '#fff6b0', ox + 11, oy + 10, 5, 3);
    R(g, OUT, ox + 31, oy + 9, 7, 5); R(g, '#fff6b0', ox + 32, oy + 10, 5, 3);
    R(g, OUT, ox + 5, oy + 19, 38, 4); R(g, '#7a8094', ox + 6, oy + 20, 36, 2);
  }

  function makeFlag(kind) {
    return cv(13, 8, (g) => {
      if (kind === 'us') {
        for (let y = 0; y < 8; y++) R(g, y % 2 ? '#ffffff' : '#e8333a', 0, y, 13, 1);
        R(g, '#2a3a9a', 0, 0, 6, 4);
        for (const [x, y] of [[1, 1], [3, 1], [2, 2], [4, 2], [1, 3], [3, 3]]) R(g, '#ffffff', x, y - 1 + (y === 1 ? 0 : 0), 1, 1);
      } else if (kind === 'cn') {
        R(g, '#e3262b', 0, 0, 13, 8);
        R(g, '#ffde3a', 1, 2, 3, 1); R(g, '#ffde3a', 2, 1, 1, 3);
        for (const [x, y] of [[5, 1], [6, 2], [6, 4], [5, 5]]) R(g, '#ffde3a', x, y, 1, 1);
      } else if (kind === 'oss') {
        R(g, '#6b4fd6', 0, 0, 13, 8);
        tiny(g, '{}', 3, 1, '#ffffff');
      } else {
        R(g, '#ffd84a', 0, 0, 13, 8);
        R(g, '#ffffff', 6, 1, 1, 6); R(g, '#ffffff', 4, 3, 5, 2); R(g, '#ffffff', 5, 2, 3, 4);
      }
    });
  }
  // Waving flag: columns bob more the further they are from the pole.
  function drawFlag(g, flag, x, y, f, dir) {
    for (let i = 0; i < 13; i++) {
      const dy = Math.round(Math.sin(i * 0.7 - f * Math.PI) * 1.4 * (i / 12));
      g.drawImage(flag, i, 0, 1, 8, dir > 0 ? x + i : x - 1 - i, y + dy, 1, 8);
    }
  }
  const POLE = '#c8ccd8';

  // ------------------------------------------------------------ racers --
  function whaleBack(f, A) {
    return cv(64, 52, (g) => {
      R(g, POLE, 9, 0, 1, 38);
      drawFlag(g, A.flag.cn, 10, 0, f, 1);
      blobO(g, 32, 31, 17, 16, '#3f7dff');
      blob(g, 27, 23, 9, 6, '#6a9cff');
      R(g, '#7fb0ff', 22, 19, 6, 2);
      blobO(g, 14, 31 - f, 4, 2, '#3f7dff');
      blobO(g, 50, 31 + f, 4, 2, '#3f7dff');
      R(g, OUT, 29, 9, 6, 8); R(g, '#3f7dff', 30, 9, 4, 8); R(g, '#2c5fd8', 33, 9, 1, 8);
      pixmap(g, FLUKE, 21 + (f ? 1 : -1), 2, { k: OUT, b: '#3f7dff', l: '#7fb0ff' });
      kartBack(g, 8, 28, KARTS.whale, f);
    });
  }
  function whaleFront(A) {
    return cv(64, 56, (g) => {
      R(g, POLE, 9, 2, 1, 40);
      drawFlag(g, A.flag.cn, 10, 2, 0, 1);
      R(g, '#bfe9ff', 31, 0, 2, 5); R(g, '#bfe9ff', 28, 1, 2, 2); R(g, '#bfe9ff', 34, 1, 2, 2);
      blobO(g, 32, 24, 18, 16, '#3f7dff');
      R(g, '#7fb0ff', 22, 11, 9, 2);
      blob(g, 32, 33, 13, 7, '#dce9ff');
      for (const y of [31, 34, 37]) R(g, '#a9c4f0', 22, y, 21, 1);
      for (const ex of [16, 42]) {
        R(g, OUT, ex, 19, 7, 7); R(g, '#ffffff', ex + 1, 20, 5, 5); R(g, OUT, ex + 2, 21, 3, 3); R(g, '#ffffff', ex + 2, 21, 1, 1);
      }
      R(g, '#ff9ab8', 17, 27, 4, 2); R(g, '#ff9ab8', 43, 27, 4, 2);
      R(g, OUT, 24, 26, 2, 1); R(g, OUT, 26, 27, 2, 1); R(g, OUT, 28, 28, 8, 1); R(g, OUT, 36, 27, 2, 1); R(g, OUT, 38, 26, 2, 1);
      kartFront(g, 8, 32, KARTS.whale);
    });
  }
  const LL = '#b48ce8';
  const LL2 = '#9a70d8';
  const LL3 = '#dcc6ff';
  function llamaBack(f, A) {
    return cv(64, 60, (g) => {
      R(g, POLE, 54, 2, 1, 44);
      drawFlag(g, A.flag.oss, 54, 2, f, -1);
      blobO(g, 32, 40, 15, 9, LL);
      for (let i = 0; i < 9; i++) R(g, LL3, 19 + i * 3, 32 + (i % 2), 2, 2);
      R(g, OUT, 25, 2 + f, 5, 10); R(g, LL, 26, 3 + f, 3, 8);
      R(g, OUT, 34, 2, 5, 10); R(g, LL, 35, 3, 3, 8);
      R(g, OUT, 26, 12, 12, 28); R(g, LL, 27, 12, 10, 28); R(g, LL2, 34, 12, 3, 28);
      blobO(g, 32, 12, 7, 6, LL);
      blob(g, 31, 9, 4, 2, LL3);
      kartBack(g, 8, 36, KARTS.llama, f);
    });
  }
  function llamaFront(A) {
    return cv(64, 64, (g) => {
      R(g, POLE, 54, 4, 1, 44);
      drawFlag(g, A.flag.oss, 54, 4, 0, -1);
      R(g, OUT, 22, 1, 5, 11); R(g, LL, 23, 2, 3, 9); R(g, '#ff9ab8', 24, 4, 1, 5);
      R(g, OUT, 37, 1, 5, 11); R(g, LL, 38, 2, 3, 9); R(g, '#ff9ab8', 39, 4, 1, 5);
      R(g, OUT, 26, 18, 12, 26); R(g, LL, 27, 18, 10, 26);
      blob(g, 32, 40, 11, 6, LL3);
      blobO(g, 32, 14, 8, 7, LL);
      blob(g, 32, 8, 6, 3, LL3);
      R(g, LL3, 27, 6, 2, 2); R(g, LL3, 35, 6, 2, 2);
      R(g, OUT, 27, 13, 2, 3); R(g, OUT, 35, 13, 2, 3); R(g, '#ffffff', 27, 13, 1, 1); R(g, '#ffffff', 35, 13, 1, 1);
      blob(g, 32, 19, 4, 3, '#efe4ff');
      R(g, OUT, 31, 18, 2, 1); R(g, OUT, 32, 19, 1, 2); R(g, OUT, 30, 21, 5, 1);
      kartFront(g, 8, 40, KARTS.llama);
    });
  }
  const SKIN = '#f1c7a1';
  const HAIR = '#6b4a2b';
  const GREY = '#8d939e';
  function hypeBack(f, A) {
    return cv(64, 44, (g) => {
      R(g, POLE, 5, 0, 1, 16);
      drawFlag(g, A.flag.hype, 6, 0, f, 1);
      blobO(g, 32, 7, 5, 6, HAIR);
      R(g, '#8a6440', 29, 3, 4, 2);
      R(g, SKIN, 26, 7, 1, 3); R(g, SKIN, 37, 7, 1, 3);
      R(g, OUT, 21, 12, 22, 6); R(g, GREY, 22, 13, 20, 5); R(g, '#e3b48e', 30, 12, 4, 2);
      R(g, OUT, 1, 15, 62, 5); R(g, '#f4f6fa', 2, 16, 60, 3); R(g, '#c9cfdb', 2, 18, 60, 1);
      R(g, OUT, 1, 12, 4, 10); R(g, OUT, 59, 12, 4, 10);
      R(g, OUT, 20, 19, 3, 5); R(g, OUT, 41, 19, 3, 5);
      for (const tx of [0, 54]) {
        R(g, OUT, tx, 24, 10, 18); R(g, '#2b2836', tx + 1, 25, 8, 16);
        for (let y = f; y < 16; y += 3) R(g, '#4a4658', tx + 1, 25 + y, 8, 1);
      }
      R(g, OUT, 6, 22, 52, 16); R(g, '#f4f6fa', 7, 23, 50, 14); R(g, '#c9cfdb', 7, 32, 50, 5);
      R(g, OUT, 8, 25, 48, 4); R(g, '#ff3b5c', 9, 26, 46, 2);
      R(g, OUT, 25, 29, 14, 8); R(g, '#ffffff', 26, 30, 12, 6); tiny(g, 'AGI', 26, 31, '#1d1533');
      R(g, OUT, 8, 37, 48, 5);
      for (let i = 0; i < 6; i++) R(g, '#3a3f4c', 11 + i * 8, 38, 2, 3);
    });
  }
  function hypeFront(A) {
    return cv(64, 46, (g) => {
      R(g, POLE, 5, 0, 1, 26);
      drawFlag(g, A.flag.hype, 6, 0, 0, 1);
      R(g, OUT, 20, 15, 24, 11); R(g, GREY, 21, 16, 22, 10); R(g, '#6d727c', 28, 16, 8, 2); R(g, '#e3b48e', 30, 15, 4, 2);
      blobO(g, 32, 9, 5, 6, SKIN);
      R(g, HAIR, 27, 2, 10, 4); R(g, HAIR, 27, 6, 1, 2); R(g, HAIR, 36, 6, 1, 2); R(g, '#8a6440', 29, 2, 4, 1);
      R(g, OUT, 29, 8, 2, 2); R(g, OUT, 34, 8, 2, 2);
      R(g, '#d99c7c', 32, 10, 1, 2); R(g, OUT, 30, 13, 5, 1); R(g, '#ffffff', 31, 13, 3, 1);
      R(g, OUT, 2, 24, 60, 17); R(g, '#f4f6fa', 3, 25, 58, 15); R(g, '#c9cfdb', 3, 33, 58, 7);
      R(g, OUT, 12, 14, 2, 11); R(g, OUT, 50, 14, 2, 11); R(g, 'rgba(127,224,255,0.35)', 14, 18, 36, 7);
      R(g, OUT, 5, 28, 15, 4); R(g, '#fff6b0', 6, 29, 13, 2);
      R(g, OUT, 44, 28, 15, 4); R(g, '#fff6b0', 45, 29, 13, 2);
      R(g, OUT, 22, 33, 20, 5); R(g, '#3a3f4c', 23, 34, 18, 3);
      R(g, OUT, 0, 30, 6, 14); R(g, OUT, 58, 30, 6, 14);
    });
  }

  // Dario from behind: the sheet has no back view, so his idle frame's
  // silhouette is repainted as curly hair, neck and shirt.
  const backCache = {};
  function darioBack(power) {
    if (backCache[power]) return backCache[power];
    const img = SDW.game.images[power === 2 ? 'suit' : 'dario'];
    const sw = img.width / 8;
    const sh = img.height / 9;
    const [c, g] = SDW.makeCanvas(sw, sh);
    g.drawImage(img, 0, 0, sw, sh, 0, 0, sw, sh);
    g.globalCompositeOperation = 'source-atop';
    const P = power === 2 ? { head: 0.45, ear: 0.27, l: 0.27, r: 0.66 } : { head: 0.6, ear: 0.36, l: 0.21, r: 0.74 };
    const headB = Math.round(sh * P.head);
    R(g, '#3b2a20', 0, 0, sw, headB);
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 7) * sw;
      const y = hash(i, 9) * headB;
      g.fillStyle = i % 3 ? '#5a4030' : '#24180f';
      g.beginPath();
      g.arc(x, y, 3 + hash(i, 4) * 3, 0, Math.PI * 2);
      g.fill();
    }
    R(g, '#e8b48e', 0, headB, sw, Math.round(sh * 0.04));
    R(g, power === 2 ? '#262c48' : '#2e3a66', 0, headB + Math.round(sh * 0.04), sw, sh);
    R(g, power === 2 ? '#323a5e' : '#3d4b80', sw * 0.3, headB + Math.round(sh * 0.07), sw * 0.12, sh * 0.3);
    g.globalCompositeOperation = 'source-over';
    // Ears peeking out of the hair.
    R(g, '#d99c7c', sw * P.l, sh * P.ear, sw * 0.05, sh * 0.08);
    R(g, '#d99c7c', sw * P.r, sh * P.ear, sw * 0.05, sh * 0.08);
    // Dark outline around the repainted silhouette.
    const [o, og] = SDW.makeCanvas(sw, sh);
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) og.drawImage(c, dx, dy);
    og.globalCompositeOperation = 'source-in';
    R(og, OUT, 0, 0, sw, sh);
    og.globalCompositeOperation = 'source-over';
    og.drawImage(c, 0, 0);
    return (backCache[power] = o);
  }

  // ------------------------------------------------------------ objects --
  function barrier() {
    return cv(72, 44, (g) => {
      for (const px of [8, 60]) { R(g, OUT, px, 28, 5, 16); R(g, '#9aa3b5', px + 1, 28, 3, 16); }
      R(g, OUT, 0, 0, 72, 32);
      for (let y = 1; y < 7; y++) for (let x = 1; x < 71; x++) R(g, ((x + y) >> 2) % 2 ? '#ffffff' : '#e8333a', x, y, 1, 1);
      R(g, '#f4f4f8', 1, 7, 70, 24);
      tiny(g, 'EXPORT', 36 - (tinyW('EXPORT', 2) >> 1), 9, '#c81e2a', 2);
      tiny(g, 'CONTROL', 36 - (tinyW('CONTROL', 2) >> 1), 20, '#c81e2a', 2);
    });
  }
  function cone() {
    return cv(28, 28, (g) => {
      for (let y = 0; y < 22; y++) {
        const hw = 1 + Math.round(y * 0.42);
        R(g, OUT, 14 - hw - 1, y + 1, hw * 2 + 2, 1);
        R(g, y > 7 && y < 11 ? '#ffffff' : '#ff7a1a', 14 - hw, y + 1, hw * 2, 1);
        R(g, '#ffae5a', 14 - hw, y + 1, 1, 1);
      }
      R(g, OUT, 2, 22, 24, 6); R(g, '#2b2836', 3, 23, 22, 4);
      R(g, OUT, 1, 13, 26, 8); R(g, '#ffe9a8', 2, 14, 24, 6); tiny(g, 'TARIFF', 3, 14, '#c81e2a');
    });
  }
  function rateSign() {
    return cv(44, 54, (g) => {
      R(g, OUT, 20, 26, 5, 28); R(g, '#9aa3b5', 21, 26, 3, 28);
      blob(g, 22, 14, 14, 14, OUT); blob(g, 22, 14, 13, 13, '#e8333a'); blob(g, 22, 14, 10, 10, '#ffffff');
      tiny(g, '429', 22 - (tinyW('429', 2) >> 1), 9, '#1d1533', 2);
      R(g, OUT, 0, 30, 44, 9); R(g, '#ffd84a', 1, 31, 42, 7); tiny(g, 'RATE LIMIT', 3, 32, '#1d1533');
    });
  }
  function puddle(f) {
    return cv(64, 22, (g) => {
      blob(g, 32, 15, 31, 6, '#3a1550');
      blob(g, 32, 15, 29, 5, '#7a3fbf');
      blob(g, 28 + f * 4, 14, 16, 2, '#b07af0');
      for (let i = 0; i < 5; i++) R(g, '#ffffff', 8 + ((i * 11 + f * 7) % 48), 12 + ((i + f) % 3) * 2, 1, 1);
      tiny(g, 'HALLUCINATION', 32 - (tinyW('HALLUCINATION') >> 1), f, '#e8c8ff');
    });
  }
  function gpu() {
    return cv(26, 26, (g) => {
      for (let i = 0; i < 5; i++) {
        R(g, '#ffd24a', 6 + i * 3, 0, 1, 4); R(g, '#ffd24a', 6 + i * 3, 22, 1, 4);
        R(g, '#ffd24a', 0, 6 + i * 3, 4, 1); R(g, '#ffd24a', 22, 6 + i * 3, 4, 1);
      }
      R(g, OUT, 3, 3, 20, 20); R(g, '#3dd16a', 4, 4, 18, 18); R(g, '#1f8a43', 5, 5, 16, 16);
      R(g, '#7dffa0', 4, 4, 18, 1);
      tiny(g, 'GPU', 13 - (tinyW('GPU') >> 1), 11, '#eaffef');
    });
  }
  function tree() {
    return cv(30, 40, (g) => {
      R(g, OUT, 12, 26, 6, 14); R(g, '#7a4a22', 13, 26, 4, 14);
      blobO(g, 15, 18, 13, 10, '#1f7a34');
      blob(g, 12, 13, 8, 5, '#2f9a48');
      blob(g, 10, 11, 4, 2, '#5cc46c');
    });
  }
  function rack(f) {
    return cv(18, 36, (g) => {
      R(g, OUT, 0, 0, 18, 36); R(g, '#2a3040', 1, 1, 16, 34); R(g, '#3a4258', 1, 1, 16, 2);
      for (let y = 5; y < 33; y += 4) {
        R(g, '#151a24', 3, y, 12, 3);
        if (hash(y, f) > 0.4) R(g, (y + f) % 3 ? '#3dff8a' : '#38c8ff', 4 + ((y * 3 + f * 5) % 9), y + 1, 2, 1);
      }
    });
  }
  function lamp() {
    return cv(16, 60, (g) => {
      R(g, OUT, 6, 6, 3, 54); R(g, '#7a8094', 7, 6, 1, 54);
      R(g, OUT, 6, 4, 10, 3); R(g, OUT, 10, 6, 6, 3); R(g, '#fff3b0', 11, 7, 4, 1);
      R(g, OUT, 4, 56, 7, 4);
    });
  }
  const BILLS = [
    { l: ['AGI BY 2027', '(PROBABLY)'], bg: '#1d1533', fg: '#ffd84a', fr: '#6b4fd6' },
    { l: ['SCALE IS', 'ALL YOU NEED'], bg: '#0f2a4a', fg: '#7fe0ff', fr: '#3f7dff' },
    { l: ['CHIPS ACT', 'FABS NOW', 'ON SALE!'], bg: '#123a22', fg: '#ffd84a', fr: '#3dd16a' },
    { l: ['SMUGGLED', 'GPUS? NEVER', 'HEARD OF', 'THEM.'], bg: '#2a2030', fg: '#ffffff', fr: '#ff7a1a' },
    { l: ['THE MORE', 'YOU BUY,', 'THE MORE', 'YOU SAVE'], bg: '#101418', fg: '#3dd16a', fr: '#3dd16a' },
    { l: ['OPEN WEIGHTS:', 'NOW 90%', 'CHEAPER'], bg: '#3a0d14', fg: '#ff8a8a', fr: '#ffd84a' },
    { l: ["PLEASE DON'T", 'DISTILL ME'], bg: '#f4f4f8', fg: '#1d1533', fr: '#9b84ff' },
    { l: ['ATTENTION IS', 'ALL YOU NEED'], bg: '#2a1a4a', fg: '#c4b5ff', fr: '#ff5a5a' },
    { l: ['TOKENS:', 'THE NEW OIL'], bg: '#3a2a00', fg: '#ffd84a', fr: '#ffffff' },
    { l: ['BENCHMARKS', 'GO UP.', 'VIBES TOO.'], bg: '#0a2a2a', fg: '#7fe0ff', fr: '#3dd16a' },
  ];
  function billboard(b) {
    return cv(128, 84, (g) => {
      for (const px of [22, 100]) { R(g, OUT, px, 60, 7, 24); R(g, '#5a5668', px + 1, 60, 5, 24); }
      R(g, OUT, 0, 0, 128, 63);
      R(g, b.fr, 1, 1, 126, 61);
      R(g, b.bg, 4, 4, 120, 55);
      g.font = `8px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      const y0 = 32 - b.l.length * 6 + 1;
      b.l.forEach((s, i) => {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillText(s, 65, y0 + i * 12 + 1);
        g.fillStyle = b.fg;
        g.fillText(s, 64, y0 + i * 12);
      });
      for (let x = 10; x < 120; x += 18) R(g, '#ffe9a8', x, 0, 4, 2);
    });
  }

  // ---------------------------------------------------------- backdrops --
  function skyCanvas() {
    return cv(W + 16, HY + 2, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, HY + 2);
      gr.addColorStop(0, '#140c34');
      gr.addColorStop(0.45, '#4a2378');
      gr.addColorStop(0.8, '#c8508a');
      gr.addColorStop(1, '#ffb36b');
      g.fillStyle = gr;
      g.fillRect(0, 0, W + 16, HY + 2);
      for (let i = 0; i < 50; i++) R(g, hash(i, 2) > 0.7 ? '#ffffff' : '#9b84ff', Math.floor(hash(i, 1) * (W + 16)), Math.floor(hash(i, 3) * 40), 1, 1);
    });
  }
  function sunCanvas() {
    return cv(70, 70, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 70);
      gr.addColorStop(0, '#fff3a0');
      gr.addColorStop(1, '#ff5a8a');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(35, 35, 34, 0, Math.PI * 2);
      g.fill();
      for (let y = 38, h = 1; y < 70; y += 6, h++) g.clearRect(0, y, 70, h);
    });
  }
  function farLayer() {
    return cv(768, 64, (g) => {
      for (let x = 0; x < 768;) {
        const w = 10 + Math.floor(hash(x, 5) * 26);
        const h = 8 + Math.floor(hash(x, 6) * 34);
        R(g, '#3c2766', x, 64 - h, w, h);
        for (let wy = 64 - h + 3; wy < 62; wy += 4) {
          for (let wx = x + 2; wx < x + w - 2; wx += 4) if (hash(wx, wy) > 0.8) R(g, '#ff9ad0', wx, wy, 1, 1);
        }
        x += w + Math.floor(hash(x, 7) * 8);
      }
      R(g, '#3c2766', 400, 6, 2, 20); R(g, '#3c2766', 394, 24, 14, 40);
    });
  }
  // Near skyline: data centers, cooling towers and a giant chip fab.
  function nearLayer() {
    return cv(768, 56, (g) => {
      const B = '#24163f';
      const dc = (x, w, h) => {
        R(g, B, x, 56 - h, w, h);
        R(g, '#33215a', x, 56 - h, w, 1);
        for (let i = x + 4; i < x + w - 6; i += 14) R(g, B, i, 56 - h - 3, 8, 3);
        for (let wy = 56 - h + 4; wy < 54; wy += 4) {
          for (let wx = x + 3; wx < x + w - 3; wx += 3) if (hash(wx, wy) > 0.45) R(g, hash(wy, wx) > 0.5 ? '#3dd16a' : '#38c8ff', wx, wy, 1, 1);
        }
      };
      const tower = (cx, h) => {
        for (let y = 0; y < h; y++) {
          const t = y / h;
          const hw = Math.round(7 + 10 * (t - 0.3) * (t - 0.3) + (t > 0.3 ? 2 * (t - 0.3) : 0));
          R(g, y % 7 === 3 ? '#4a3a78' : '#3a2c66', cx - hw, 56 - h + y, hw * 2, 1);
        }
        R(g, '#5d4f96', cx - 8, 56 - h, 16, 1);
      };
      dc(20, 90, 18);
      tower(150, 36); tower(180, 30);
      // chip fab
      R(g, B, 220, 26, 150, 30);
      R(g, '#33215a', 220, 26, 150, 1);
      R(g, B, 240, 18, 30, 8); R(g, B, 320, 14, 12, 12);
      R(g, '#1a0f30', 280, 30, 30, 22);
      for (let i = 0; i < 6; i++) {
        R(g, '#d9a52a', 283 + i * 5, 27, 2, 3); R(g, '#d9a52a', 283 + i * 5, 52, 2, 3);
      }
      R(g, '#d9a52a', 283, 33, 24, 16); R(g, '#1a0f30', 285, 35, 20, 12); R(g, '#ffd84a', 286, 36, 18, 1);
      tiny(g, 'FAB', 290, 39, '#ffd84a');
      for (let wx = 226; wx < 366; wx += 6) if (wx < 276 || wx > 312) R(g, '#7fe0ff', wx, 34, 3, 1), R(g, '#7fe0ff', wx, 42, 3, 1);
      dc(400, 60, 14); dc(470, 110, 22);
      tower(610, 40);
      dc(640, 100, 16);
      R(g, '#2b1c4a', 0, 52, 768, 4);
    });
  }
  const TURBINES = [[118, 30], [205, 26], [560, 34], [590, 28], [745, 24]];
  const STEAM = [[150, 36], [180, 30], [610, 40]];

  // ------------------------------------------------------------- the art --
  let A = null;
  function buildArt() {
    if (A) return A;
    A = {};
    A.flag = { us: makeFlag('us'), cn: makeFlag('cn'), oss: makeFlag('oss'), hype: makeFlag('hype') };
    A.back = {
      whale: [whaleBack(0, A), whaleBack(1, A)],
      llama: [llamaBack(0, A), llamaBack(1, A)],
      hype: [hypeBack(0, A), hypeBack(1, A)],
    };
    A.front = { whale: whaleFront(A), llama: llamaFront(A), hype: hypeFront(A) };
    // The player kart: body plus a pole with the stars & stripes.
    A.me = [0, 1].map((f) => cv(64, 54, (g) => {
      R(g, POLE, 50, 2, 1, 38);
      drawFlag(g, A.flag.us, 50, 2, f, -1);
      kartBack(g, 8, 30, KARTS.dario, f);
    }));
    A.meFront = cv(64, 54, (g) => {
      R(g, POLE, 13, 4, 1, 36);
      drawFlag(g, A.flag.us, 14, 4, 0, 1);
      kartFront(g, 8, 32, KARTS.dario);
    });
    A.barrier = barrier();
    A.cone = cone();
    A.sign = rateSign();
    A.puddle = [puddle(0), puddle(1)];
    A.gpu = gpu();
    A.tree = tree();
    A.rack = [rack(0), rack(1)];
    A.lamp = lamp();
    A.bills = BILLS.map(billboard);
    A.sky = skyCanvas();
    A.sun = sunCanvas();
    A.ground = cv(1, 40, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 40);
      gr.addColorStop(0, '#945f75');
      gr.addColorStop(0.45, '#1c6a42');
      gr.addColorStop(1, '#1a6a40');
      g.fillStyle = gr;
      g.fillRect(0, 0, 1, 40);
    });
    A.far = farLayer();
    A.near = nearLayer();
    return A;
  }

  // ------------------------------------------------------------ racers --
  const RIVALS = [
    {
      id: 'whale', name: 'THE WHALE', color: '#3f7dff', base: 0.965, slow: 0.16, slowLast: 0.06, push: 0.05, delay: 4,
      port: [12, 6, 40, 34],
      lines: ['TRAINED FOR $6M!', 'OPEN WEIGHTS, BABY', 'WE DISTILLED YOUR LAST LAP', 'SAME SPEED, 1/10TH THE PRICE', 'THINKING... THINKING... PASSING!'],
    },
    {
      id: 'hype', name: 'THE HYPE-MAN', color: '#e8e8f0', base: 0.955, slow: 0.17, slowLast: 0.08, push: 0.05, delay: 9,
      port: [21, 1, 22, 22],
      lines: ['FEEL THE AGI!', 'I NEED 7 TRILLION FOR THIS LAP', 'THIS IS JUST A RESEARCH PREVIEW', 'SHIPPING IN A FEW WEEKS', 'THIS LAP IS SCARY GOOD'],
    },
    {
      id: 'llama', name: 'THE LLAMA', color: '#b48ce8', base: 0.94, slow: 0.18, slowLast: 0.1, push: 0.05, delay: 14,
      port: [19, 0, 26, 26],
      lines: ["I'M OPEN SOURCE... MOSTLY", 'MY LICENSE HAS 700 PAGES', 'FORK ME ON THE NEXT LAP', 'OVER 700M USERS? CALL US FIRST'],
    },
  ];
  const WIN_QUOTES = {
    whale: ['2ND PLACE FOR 1/100TH THE PRICE.', 'WE CALL THAT A WIN.'],
    hype: ['WE WERE JUST SANDBAGGING.', 'NEXT LAP IS AGI. TRUST ME.'],
    llama: ["WE'LL OPEN-SOURCE OUR 2ND PLACE.", 'SOME RESTRICTIONS APPLY.'],
  };
  const LOSE_QUOTES = {
    whale: ['THE WHALE DID IT CHEAPER', 'SAME FINISH LINE, 1% OF THE COMPUTE.', 'NICE TRY! WE TOOK NOTES.'],
    hype: ['THE HYPE-MAN SHIPPED FIRST', 'AGI ACHIEVED INTERNALLY!', 'NOW, ABOUT THOSE 7 TRILLION...'],
    llama: ['THE LLAMA FORKED YOUR WIN', 'THE TROPHY IS OPEN NOW.', '(SEE 700-PAGE LICENSE)'],
  };

  // -------------------------------------------------------------- track --
  const HILL = { LOW: 12, MED: 24, HIGH: 40 };
  function buildTrack() {
    const segs = [];
    const lastY = () => (segs.length ? segs[segs.length - 1].y2 : 0);
    const add = (curve, y) => {
      const i = segs.length;
      segs.push({ i, curve, y1: lastY(), y2: y, objs: [], alt: Math.floor(i / 3) % 2 });
    };
    const easeIn = (a, b, p) => a + (b - a) * p * p;
    const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
    const road = (enter, hold, leave, curve, hill) => {
      const y0 = lastY();
      const y1 = y0 + hill * SEG;
      const tot = enter + hold + leave;
      for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / tot));
      for (let n = 0; n < hold; n++) add(curve, easeInOut(y0, y1, (enter + n) / tot));
      for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / tot));
    };
    road(10, 40, 0, 0, 0);
    road(20, 40, 20, 1, 0);
    road(25, 50, 25, 0, HILL.MED);
    road(25, 50, 25, -2, -HILL.MED);
    road(20, 30, 20, 0, 0);
    road(15, 25, 15, 2, HILL.LOW);
    road(15, 25, 15, -2, -HILL.LOW);
    road(30, 60, 30, 3, 0);
    road(25, 50, 25, 0, HILL.HIGH);
    road(25, 50, 25, 0, -HILL.HIGH);
    for (let i = 0; i < 6; i++) road(10, 10, 10, 0, i % 2 ? -HILL.LOW / 2 : HILL.LOW / 2);
    road(30, 40, 30, -3, 0);
    road(20, 40, 20, 2, HILL.MED);
    road(20, 40, 20, -1, -HILL.MED);
    road(25, 60, 25, 1.5, 0);
    const rest = 1500 - segs.length;
    road(20, rest - 40, 20, 0, -lastY() / SEG);
    segs[segs.length - 1].y2 = 0;
    const N = segs.length;

    const put = (i, o) => segs[mod(i, N)].objs.push(Object.assign({ taken: -99, x: 0, w: 0.2, sc: 1 }, o));
    put(0, { k: 'gantry', start: true });
    put(700, { k: 'gantry', lines: ['NEXT EXIT:', 'SUPERINTELLIGENCE'], bg: '#1f7a4a' });
    put(1110, { k: 'gantry', lines: ['SPEED LIMIT:', 'NONE (VOLUNTARY)'], bg: '#2a3a9a' });
    // Billboards, alternating sides, with props filling the gaps.
    const busy = new Set();
    BILLS.forEach((b, j) => {
      const s = 70 + j * 142;
      const side = j % 2 ? 1 : -1;
      put(s, { k: 'bill', img: j, x: side * 2.15, w: 1.2, sc: 2.5 });
      for (let d = -8; d <= 8; d++) busy.add(`${s + d}:${side}`);
    });
    for (let i = 12; i < N - 6; i += 6) {
      for (const side of [-1, 1]) {
        if (busy.has(`${i}:${side}`)) continue;
        const h = hash(i, side + 5);
        if (h < 0.35) put(i, { k: 'lamp', x: side * 1.22, w: 0.06 });
        else if (h < 0.65) put(i, { k: 'tree', x: side * (1.5 + hash(i, 3) * 0.6), w: 0.24 });
        else if (h < 0.9) put(i, { k: 'rack', x: side * (1.4 + hash(i, 4) * 0.4), w: 0.18 });
      }
    }
    // Hazards and pickups (same every lap). Lanes: -1 left, 0 centre, 1 right.
    const PLAN = [
      [100, 'coins', 0], [150, 'cone', -1], [150, 'cone', 1], [190, 'gpu', 0], [235, 'barrier', 1],
      [270, 'coins', -1], [305, 'puddle', 0], [345, 'sign', -1], [380, 'coins', 1], [415, 'barrier', 0],
      [450, 'gpu', -1], [485, 'cone', 0], [485, 'cone', 1], [525, 'puddle', -1], [560, 'coins', 0],
      [605, 'barrier', -1], [605, 'barrier', 1], [650, 'sign', 1], [690, 'gpu', 1], [740, 'coins', -1],
      [780, 'puddle', 1], [815, 'barrier', 0], [850, 'coins', 1], [880, 'cone', -1], [920, 'sign', 0],
      [960, 'gpu', 0], [1000, 'puddle', 0], [1000, 'cone', -1], [1045, 'barrier', 1], [1080, 'coins', -1],
      [1125, 'sign', -1], [1165, 'puddle', 1], [1200, 'gpu', -1], [1245, 'barrier', -1], [1245, 'cone', 1],
      [1290, 'coins', 0], [1335, 'sign', 1], [1375, 'puddle', -1], [1375, 'puddle', 0], [1420, 'coins', 1],
    ];
    const W_OF = { cone: 0.14, barrier: 0.42, sign: 0.22, puddle: 0.4, gpu: 0.2, coin: 0.18 };
    for (const [s, k, l] of PLAN) {
      const x = LANE[l + 1];
      if (k === 'coins') for (let c = 0; c < 4; c++) put(s + c * 5, { k: 'coin', x, w: W_OF.coin });
      else put(s, { k, x, w: W_OF[k], hazard: k !== 'gpu' });
    }
    return segs;
  }

  // --------------------------------------------------------------- race --
  SDW.modes = SDW.modes || {};
  SDW.modes.race = class Race {
    constructor(def, opts = {}) {
      this.def = def;
      this.power = opts.power != null ? opts.power : SDW.game.session.power;
      this.state = 'intro';
      this.ownHud = true;
      this.t = 0;
      this.introT = 0;
      this.goT = 0;
      this.endT = 0;
      this.done = false;
      this.art = buildArt();
      this.segs = buildTrack();
      this.N = this.segs.length;
      this.L = this.N * SEG;
      this.me = {
        d: -1000, x: LANE[2] - 0.17, speed: 0, hz: 0, hv: 0, spin: 0, spinA: 0, boostT: 0, rateT: 0,
        crashT: 0, cells: 1, steer: 0, fin: 0, look: 0,
      };
      this.rivals = RIVALS.map((r, i) => Object.assign({}, r, {
        d: i < 2 ? -400 : -1000, x: i % 2 ? 0.45 : -0.45, lane: i % 2 ? 2 : 0, tx: i % 2 ? 0.45 : -0.45,
        speed: 0, boostT: 0, boostCd: 300 + i * 120, think: i * 3, line: 0, cd: 0, fin: 0, ahead: i < 2,
      }));
      this.finCount = 0;
      this.place = 0;
      this.camX = this.me.x * RW;
      this.bg = 0;
      this.shake = 0;
      this.fx = [];
      this.pops = [];
      this.bubble = null;
      this.bubbleCd = 0;
      this.banner = null;
      this.bumpCd = 0;
      this.proj = [];
      for (let n = 0; n < DRAW; n++) this.proj.push({ X1: 0, Y1: 0, W1: 0, s1: 0, X2: 0, Y2: 0, W2: 0, s2: 0, z1: 0, clip: H });
      this.items = [];
      this.photo = null;
      this.lastLap = 1;
    }

    segAt(d) { return this.segs[Math.floor(mod(d, this.L) / SEG)]; }
    lapOf(d) { return clamp(Math.floor(d / this.L) + 1, 1, LAPS); }

    // ---------------------------------------------------------- update --
    update(inp) {
      this.t++;
      if (this.shake > 0) this.shake *= 0.85;
      if (this.shake < 0.3) this.shake = 0;
      if (this.bubbleCd > 0) this.bubbleCd--;
      if (this.bumpCd > 0) this.bumpCd--;
      if (this.goT > 0) this.goT--;
      if (this.bubble && ++this.bubble.t > 170) this.bubble = null;
      if (this.banner && ++this.banner.t > 100) this.banner = null;
      this.updateFx();
      if (this.state === 'intro') { this.updateIntro(inp); return; }
      this.updateMe(inp);
      this.updateRivals();
      this.collideRacers();
      this.checkOrder();
      if (this.me.fin) this.updateEnd();
    }

    updateIntro(inp) {
      const CARD = 150;
      this.introT++;
      if (this.introT > 30 && this.introT < CARD && (inp.pressed.jump || inp.pressed.spark)) this.introT = CARD;
      const c = this.introT - CARD;
      if (c === 0 || c === 60 || c === 120) tone(440, 0.18, { vol: 0.12 });
      if (c > 0 && c % 12 === 0) tone(60 + (c % 24) * 2, 0.1, { type: 'sawtooth', vol: 0.02 });
      if (c >= 180) {
        this.state = 'play';
        this.goT = 60;
        tone(880, 0.5, { vol: 0.13 });
        tone(1320, 0.5, { vol: 0.05, type: 'triangle' });
      }
    }

    updateMe(inp) {
      const me = this.me;
      const held = inp.held;
      const prevD = me.d;
      const seg = this.segAt(me.d);
      const pct = me.speed / MAXS;
      const air = me.hz > 0;

      // Steering, plus the curve pushing the kart outwards.
      let steer = 0;
      if (me.fin) steer = clamp(-me.x * 2, -1, 1) * 0.6;
      else if (me.spin <= 0 && me.crashT <= 0) steer = (held.left ? -1 : 0) + (held.right ? 1 : 0);
      me.steer = lerp(me.steer, steer, 0.25);
      me.x += steer * DT * 1.8 * Math.min(1.45, pct + 0.15);
      me.x -= DT * pct * pct * seg.curve * 0.4;
      me.x = clamp(me.x, -2.1, 2.1);

      // Speed: always accelerating (Dario never stops running).
      const off = Math.abs(me.x) > 1.06;
      let top = MAXS;
      if (me.boostT > 0) top = MAXS * 1.45;
      if (me.rateT > 0) top = Math.min(top, MAXS * 0.5);
      if (off && !air) top = Math.min(top, MAXS * 0.45);
      if (me.fin) top = MAXS * 0.5;
      if (held.down && !me.fin) me.speed -= 9000 * DT;
      else if (me.speed < top) me.speed += (me.boostT > 0 ? 7000 : 3300 * (1 - 0.55 * pct)) * DT;
      else me.speed = Math.max(top, me.speed - (off ? 7000 : 4000) * DT);
      if (me.spin > 0) { me.spin--; me.speed *= 0.985; me.spinA += 0.42; }
      else if (me.spinA) {
        const r = mod(me.spinA, Math.PI * 2);
        me.spinA = r < 0.45 || r > Math.PI * 2 - 0.45 ? 0 : me.spinA + 0.42;
      }
      me.speed = Math.max(0, me.speed);
      if (me.boostT > 0) me.boostT--;
      if (me.rateT > 0) me.rateT--;
      if (me.crashT > 0) me.crashT--;
      if (me.look > 0) me.look--;

      // Buttons: hop and boost.
      if (!me.fin) {
        if (inp.pressed.jump && !air) {
          me.hv = 3.4;
          me.hz = 0.01;
          tone(260, 0.14, { slide: 520, vol: 0.1 });
        }
        if (inp.pressed.spark && me.cells > 0) {
          me.cells--;
          me.boostT = Math.min(170, me.boostT + 90);
          noise(0.5, { vol: 0.12, freq: 600 });
          tone(220, 0.5, { type: 'sawtooth', vol: 0.07, slide: 880 });
          this.pop('BOOST!', '#7fe0ff');
        } else if (inp.pressed.spark) {
          tone(150, 0.08, { vol: 0.08 });
          this.pop('NO GPUS!', '#9aa3b5');
        }
      }
      if (me.hz > 0) {
        me.hz += me.hv;
        me.hv -= 0.26;
        if (me.hz <= 0) {
          me.hz = 0;
          me.hv = 0;
          noise(0.06, { vol: 0.06, freq: 400, filter: 'lowpass' });
          this.dust(6, '#c8ccd8');
        }
      }

      me.d += me.speed * DT;
      this.bg += seg.curve * (me.speed * DT / SEG) * 0.5;
      this.camX += (me.x * RW - this.camX) * 0.2;

      // Rumble strips and grass.
      const ax = Math.abs(me.x);
      if (!air && me.speed > 600) {
        if (ax > 0.86 && ax < 1.08) {
          if (this.t % 3 === 0) this.sparks();
          if (this.t % 6 === 0) noise(0.05, { vol: 0.05, freq: 250, filter: 'lowpass' });
          this.shake = Math.max(this.shake, 1);
        } else if (off && this.t % 2 === 0) this.dust(2, this.t % 4 ? '#2f9a48' : '#7a5a3a');
      }
      // Engine hum: a short low buzz every few frames, pitched by speed.
      if (this.t % 6 === 0 && !me.fin) {
        const p = me.speed / MAXS;
        tone(55 + 110 * p, 0.09, { type: 'sawtooth', vol: 0.022, slide: 60 + 120 * p });
      }

      // Everything we drove over this step.
      const a = Math.floor(prevD / SEG);
      const b = Math.floor(me.d / SEG);
      for (let s = a + 1; s <= b; s++) {
        const lap = Math.floor(s / this.N);
        for (const o of this.segs[mod(s, this.N)].objs) this.touch(o, lap);
      }

      // Laps.
      const lap = Math.floor(me.d / this.L) + 1;
      if (lap > this.lastLap && lap <= LAPS) {
        this.lastLap = lap;
        if (lap === LAPS) {
          this.banner = { text: 'FINAL LAP!', color: '#ffd84a', t: 0 };
          seq([[72, 0.1], [76, 0.1], [79, 0.1], [84, 0.3]], 'square', 0.12);
        } else {
          this.banner = { text: `LAP ${lap}`, color: '#ffffff', t: 0 };
          SDW.audio.play('checkpoint');
        }
      }
      if (!me.fin && me.d >= LAPS * this.L) this.finish();
    }

    touch(o, lap) {
      const me = this.me;
      if (o.taken === lap || o.k === 'gantry') return;
      if (Math.abs(me.x - o.x) > (KW + o.w) / 2) return;
      const air = me.hz > 4;
      switch (o.k) {
        case 'coin':
          o.taken = lap;
          SDW.game.addTokens(1);
          this.burst(W / 2 + (me.x * RW - this.camX) * 0.2, PY - 30 - me.hz, '#ffd84a', 6);
          break;
        case 'gpu':
          o.taken = lap;
          if (me.cells < 3) {
            me.cells++;
            this.pop('+1 GPU', '#3dd16a');
          } else {
            SDW.game.addScore(500);
            this.pop('GPUS FULL +500', '#3dd16a');
          }
          seq([[72, 0.05], [79, 0.05], [84, 0.05], [91, 0.12]], 'square', 0.1);
          this.burst(W / 2 + (me.x * RW - this.camX) * 0.2, PY - 30 - me.hz, '#3dd16a', 10);
          break;
        case 'cone':
          if (air) return;
          o.taken = lap;
          me.speed *= 0.7;
          this.shake = 4;
          this.pop('TARIFFED! +25%', '#ff7a1a');
          tone(500, 0.08, { vol: 0.12, type: 'triangle', slide: 900 });
          noise(0.08, { vol: 0.08 });
          this.fx.push({ img: this.art.cone, x: W / 2 + (o.x * RW - this.camX) * 0.2, y: PY - 20, vx: (o.x >= me.x ? 1 : -1) * 2.5, vy: -4, life: 50, rot: 0 });
          break;
        case 'puddle':
          if (air) return;
          if (me.spin <= 0) {
            me.spin = 50;
            this.pop('HALLUCINATING!', '#e0b0ff');
            tone(900, 0.6, { type: 'sine', vol: 0.1, slide: 200 });
            tone(700, 0.6, { type: 'triangle', vol: 0.06, slide: 1400 });
          }
          break;
        case 'sign':
          o.taken = lap;
          me.rateT = 100;
          me.speed *= 0.8;
          this.shake = 4;
          this.pop('429: TOO MANY REQUESTS', '#ffd84a');
          seq([[76, 0.08], [0, 0.04], [76, 0.08], [0, 0.04], [64, 0.2]], 'square', 0.1);
          this.fx.push({ img: this.art.sign, x: W / 2 + (o.x * RW - this.camX) * 0.2, y: PY - 20, vx: (o.x >= me.x ? 1 : -1) * 2, vy: -3.5, life: 50, rot: 0 });
          break;
        case 'barrier':
          this.crash('EXPORT CONTROLLED!', 0.25);
          me.x += (me.x >= o.x ? 1 : -1) * 0.05;
          break;
        default:
          // Roadside scenery.
          this.crash(o.k === 'bill' ? 'NICE AD PLACEMENT...' : 'OOF!', 0.35);
          me.x -= Math.sign(me.x) * 0.25;
      }
    }

    crash(msg, keep) {
      const me = this.me;
      if (me.crashT > 0) return;
      me.speed *= keep;
      me.crashT = 30;
      me.boostT = 0;
      this.shake = 9;
      this.pop(msg, '#ff5a5a');
      noise(0.35, { vol: 0.2, filter: 'lowpass', freq: 900 });
      tone(180, 0.3, { type: 'triangle', vol: 0.18, slide: 50 });
      const x = W / 2 + (me.x * RW - this.camX) * 0.2;
      this.burst(x, PY - 16, '#ffd84a', 8);
      this.burst(x, PY - 16, '#9aa3b5', 8);
    }

    updateRivals() {
      const me = this.me;
      const finalLap = me.d > (LAPS - 1) * this.L;
      for (const r of this.rivals) {
        if (r.delay > 0) { r.delay--; continue; }
        const gap = (r.d - me.d) / SEG;
        let f = r.base;
        if (!me.fin) {
          // Rubber band: wait up when ahead, push when behind.
          const g = clamp(gap / 60, -1, 1);
          f -= g > 0 ? g * (finalLap ? r.slowLast : r.slow) : g * r.push;
        }
        if (r.boostT > 0) { r.boostT--; f += 0.25; }
        else if (--r.boostCd <= 0 && !me.fin && gap > -30 && gap < 0 && Math.random() < 0.02) {
          r.boostT = 70;
          r.boostCd = finalLap ? 360 : 600;
        }
        const target = MAXS * f;
        r.speed += clamp(target - r.speed, -3000 * DT, 2800 * DT);
        r.d += r.speed * DT;
        this.steerRival(r);
        if (r.cd > 0) r.cd--;
      }
    }

    // Rivals pick the lane with the fewest hazards ahead (and no rival in it).
    steerRival(r) {
      if (--r.think <= 0) {
        r.think = 10;
        const s0 = Math.floor(r.d / SEG);
        const score = [0, 0, 0];
        for (let s = s0 + 2; s < s0 + 36; s++) {
          for (const o of this.segs[mod(s, this.N)].objs) {
            if (!o.hazard) continue;
            for (let l = 0; l < 3; l++) if (Math.abs(LANE[l] - o.x) < 0.45) score[l] += 60 - (s - s0);
          }
        }
        for (const q of this.rivals) {
          if (q === r) continue;
          const dz = (q.d - r.d) / SEG;
          if (dz > -2 && dz < 8) for (let l = 0; l < 3; l++) if (Math.abs(LANE[l] - q.x) < 0.4) score[l] += 15;
        }
        score[r.lane] -= 4;
        if (r.lane !== 1) score[1] -= 1;
        let best = r.lane;
        for (let l = 0; l < 3; l++) if (score[l] < score[best]) best = l;
        if (Math.abs(best - r.lane) === 2 && score[1] <= score[best] + 10) best = 1;
        r.lane = best;
        r.tx = LANE[best] + (hash(r.id.length, Math.floor(r.d / 3000)) - 0.5) * 0.12;
      }
      r.x += clamp(r.tx - r.x, -1.3 * DT, 1.3 * DT);
    }

    collideRacers() {
      const me = this.me;
      for (const r of this.rivals) {
        const dz = r.d - me.d;
        if (Math.abs(dz) < 110 && Math.abs(r.x - me.x) < KW * 1.05 && me.hz < 10) {
          const dir = me.x >= r.x ? 1 : -1;
          me.x += dir * 0.03;
          r.x -= dir * 0.015;
          if (dz > 0 && me.speed > r.speed) me.speed = r.speed * 0.95;
          else if (dz < 0 && r.speed > me.speed) r.speed = me.speed * 0.95;
          if (this.bumpCd <= 0) {
            this.bumpCd = 20;
            this.shake = Math.max(this.shake, 3);
            SDW.audio.play('bump');
            this.burst(W / 2 + ((me.x + r.x) / 2 * RW - this.camX) * 0.2, PY - 14, '#ffffff', 5);
          }
        }
      }
    }

    // Overtakes trigger banter; finishers get their places.
    checkOrder() {
      const me = this.me;
      for (const r of this.rivals) {
        if (!r.fin && r.d >= LAPS * this.L) r.fin = ++this.finCount;
        const ahead = r.d > me.d;
        if (ahead !== r.ahead && !me.fin && r.cd <= 0 && this.bubbleCd <= 0 && this.t > 30) {
          this.say(r, r.lines[r.line++ % r.lines.length]);
          if (!ahead) me.look = 40;
        }
        r.ahead = ahead;
      }
    }

    say(r, text) {
      this.bubble = { r, text, t: 0 };
      this.bubbleCd = 150;
      r.cd = 420;
      const m = r.id === 'whale' ? 76 : r.id === 'llama' ? 69 : 81;
      seq([[m, 0.05], [m + 3, 0.05], [m - 2, 0.05], [m + 5, 0.07]], 'square', 0.05);
    }

    position() {
      const me = this.me;
      if (me.fin) return me.fin;
      let p = 1;
      for (const r of this.rivals) if (r.fin || r.d > me.d) p++;
      return p;
    }

    finish() {
      const me = this.me;
      me.fin = ++this.finCount;
      me.boostT = 0;
      me.spin = 0;
      this.place = me.fin;
      this.state = me.fin === 1 ? 'clear' : 'lost';
      this.endT = 0;
      this.wantPhoto = true;
      this.bubble = null;
      this.banner = null;
      SDW.audio.stopMusic();
      if (me.fin === 1) SDW.audio.play('clear');
      else seq([[67, 0.15], [64, 0.15], [60, 0.15], [55, 0.4]], 'triangle', 0.18);
    }

    updateEnd() {
      this.endT++;
      if (this.endT === 240 && !this.done) {
        this.done = true;
        if (this.place === 1) SDW.game.levelCleared(SDW.game.session.power);
        else SDW.game.playerDied(false);
      }
    }

    // --------------------------------------------------------- effects --
    pop(text, color) {
      this.pops.push({ text, color, t: 0 });
      if (this.pops.length > 3) this.pops.shift();
    }
    burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 1 + Math.random() * 2.5;
        this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, life: 22 + Math.random() * 14, color, g: 0.12 });
      }
    }
    sparks() {
      const me = this.me;
      const x = W / 2 + (me.x * RW - this.camX) * 0.2 + (me.x > 0 ? 18 : -18);
      for (let i = 0; i < 3; i++) {
        this.fx.push({ x, y: PY - 2, vx: (Math.random() - 0.5) * 3 - me.x, vy: -1 - Math.random() * 2.5, life: 12 + Math.random() * 8, color: i % 2 ? '#ffd84a' : '#ffffff', g: 0.2 });
      }
    }
    dust(n, color) {
      const me = this.me;
      const x = W / 2 + (me.x * RW - this.camX) * 0.2;
      for (let i = 0; i < n; i++) {
        this.fx.push({ x: x + (Math.random() - 0.5) * 44, y: PY - 2, vx: (Math.random() - 0.5) * 2, vy: -0.5 - Math.random() * 1.5, life: 16 + Math.random() * 10, color, g: 0.06, size: 2 });
      }
    }
    updateFx() {
      for (const p of this.fx) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.g == null ? 0.25 : p.g;
        if (p.rot != null) p.rot += 0.25;
        p.life--;
      }
      if (this.fx.some((p) => p.life <= 0)) this.fx = this.fx.filter((p) => p.life > 0);
      if (this.fx.length > 160) this.fx.splice(0, this.fx.length - 160);
      for (const p of this.pops) p.t++;
      if (this.pops.length && this.pops[0].t > 70) this.pops.shift();
    }

    // ------------------------------------------------------------ draw --
    draw(ctx) {
      const s = this.shake;
      ctx.save();
      if (s) ctx.translate(Math.round((Math.random() - 0.5) * s), Math.round((Math.random() - 0.5) * s));
      this.drawSky(ctx);
      this.drawRoad(ctx);
      this.drawSprites(ctx);
      this.drawFx(ctx);
      ctx.restore();
      if (this.wantPhoto) {
        this.wantPhoto = false;
        const [p, pg] = SDW.makeCanvas(192, 112);
        pg.imageSmoothingEnabled = true;
        pg.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, 0, 0, 192, 112);
        this.photo = p;
      }
      if (this.state === 'intro') this.drawIntro(ctx);
      else if (this.me.fin) this.drawFinish(ctx);
      else this.drawHud(ctx);
    }

    drawSky(ctx) {
      const A = this.art;
      ctx.drawImage(A.sky, -8, 0);
      const tile = (img, off, y) => {
        for (let x = -mod(off, img.width) - 8; x < W + 8; x += img.width) ctx.drawImage(img, Math.round(x), y);
      };
      ctx.drawImage(A.sun, Math.round(W / 2 - 35 - mod(this.bg * 0.05 + 2000, 4000) + 2000), HY - 58);
      tile(A.far, this.bg * 0.3, HY - 63);
      const off = this.bg * 0.6;
      // Wind turbines and steam behind the near skyline.
      ctx.strokeStyle = '#4a3a78';
      ctx.lineWidth = 1;
      for (let base = -mod(off, 768) - 8; base < W + 8; base += 768) {
        for (const [tx, th] of TURBINES) {
          const x = base + tx;
          if (x < -20 || x > W + 20) continue;
          const top = HY - 4 - th;
          R(ctx, '#5d4f96', x, top, 1, th);
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const a = this.t * 0.05 + tx + (k * Math.PI * 2) / 3;
            ctx.moveTo(x + 0.5, top + 0.5);
            ctx.lineTo(x + 0.5 + Math.cos(a) * 11, top + 0.5 + Math.sin(a) * 11);
          }
          ctx.strokeStyle = '#8a7ac8';
          ctx.stroke();
          R(ctx, '#c4b5ff', x - 1, top - 1, 3, 2);
        }
        for (const [sx, sh] of STEAM) {
          const x = base + sx;
          if (x < -30 || x > W + 30) continue;
          for (let k = 0; k < 3; k++) {
            const p = ((this.t * 0.4 + k * 20) % 60) / 60;
            const r = 4 + p * 8;
            ctx.fillStyle = `rgba(220,200,255,${0.35 * (1 - p)})`;
            ctx.fillRect(x - r + p * 10, HY - 4 - sh - p * 26 - r / 2, r * 2, r);
          }
        }
      }
      tile(A.near, off, HY - 55);
      ctx.drawImage(A.ground, -8, HY, W + 16, 40);
      R(ctx, '#1a6a40', -8, HY + 40, W + 16, H - HY - 32);
    }

    drawRoad(ctx) {
      const me = this.me;
      const N = this.N;
      const segs = this.segs;
      const camD = me.d - PZ;
      const camZ = mod(camD, this.L);
      const baseI = Math.floor(camZ / SEG);
      const basePct = (camZ % SEG) / SEG;
      const pz = mod(me.d, this.L);
      const pSeg = segs[Math.floor(pz / SEG)];
      const playerY = lerp(pSeg.y1, pSeg.y2, (pz % SEG) / SEG);
      const camY = playerY + CAMH;
      const camX = this.camX;
      this.camZ = camZ;
      this.baseI = baseI;
      this.absBase = Math.floor(camD / SEG);
      let x = 0;
      let dx = -(segs[baseI].curve * basePct);
      let maxy = H;
      for (let n = 0; n < DRAW; n++) {
        const seg = segs[(baseI + n) % N];
        const p = this.proj[n];
        const z1 = (baseI + n) * SEG - camZ;
        const z2 = z1 + SEG;
        p.z1 = z1;
        p.clip = maxy;
        p.s2 = F / z2;
        p.X2 = W / 2 + p.s2 * (x + dx - camX);
        p.Y2 = HY + p.s2 * (camY - seg.y2);
        p.W2 = p.s2 * RW;
        if (z1 > 1) {
          p.s1 = F / z1;
          p.X1 = W / 2 + p.s1 * (x - camX);
          p.Y1 = HY + p.s1 * (camY - seg.y1);
          p.W1 = p.s1 * RW;
        } else {
          p.s1 = 0;
        }
        x += dx;
        dx += seg.curve;
        if (z1 <= 1) continue;
        const y1 = Math.round(p.Y1);
        const y2 = Math.round(p.Y2);
        if (y2 >= y1 || y2 >= maxy) continue;
        this.drawSegment(ctx, seg, n, p, y1, y2, maxy);
        maxy = y2;
      }
    }

    drawSegment(ctx, seg, n, p, y1, y2, maxy) {
      const alt = seg.alt;
      const bottom = Math.min(y1, maxy, H);
      const top = Math.max(y2, 0);
      if (bottom <= top) return;
      R(ctx, alt ? '#1f7a4a' : '#1a6a40', -8, top, W + 16, bottom - top);
      const road = alt ? '#4a4a5c' : '#45455a';
      const rumble = alt ? '#ff5a5a' : '#f4f4f8';
      const check = seg.i < 3;
      for (let y = top; y < bottom; y++) {
        const t = (p.Y1 - y) / (p.Y1 - p.Y2);
        const X = p.X1 + (p.X2 - p.X1) * t;
        const w = p.W1 + (p.W2 - p.W1) * t;
        const rw = w / 6;
        const l = Math.round(X - w);
        const r = Math.round(X + w);
        R(ctx, rumble, Math.round(X - w - rw), y, l - Math.round(X - w - rw), 1);
        R(ctx, rumble, r, y, Math.round(X + w + rw) - r, 1);
        if (check) {
          const cw = (w * 2) / 10;
          for (let c = 0; c < 10; c++) R(ctx, (c + seg.i) % 2 ? '#f4f4f8' : '#1d1533', Math.round(X - w + c * cw), y, Math.ceil(cw), 1);
          continue;
        }
        R(ctx, road, l, y, r - l, 1);
        if (alt) {
          const lw = Math.max(1, w / 36);
          R(ctx, '#e8e8f0', Math.round(X - w / 3 - lw / 2), y, Math.round(lw), 1);
          R(ctx, '#e8e8f0', Math.round(X + w / 3 - lw / 2), y, Math.round(lw), 1);
        }
      }
      if (n > 70) {
        ctx.fillStyle = `rgba(200,90,140,${Math.min(0.7, (n - 70) / 140)})`;
        ctx.fillRect(-8, top, W + 16, bottom - top);
      }
    }

    // Collect every visible sprite, then paint far to near.
    drawSprites(ctx) {
      const items = this.items;
      items.length = 0;
      const me = this.me;
      const camD = me.d - PZ;
      for (let n = 1; n < DRAW; n++) {
        const p = this.proj[n];
        if (p.z1 <= 40) continue;
        const seg = this.segs[(this.baseI + n) % this.N];
        if (!seg.objs.length) continue;
        const lap = Math.floor((this.absBase + n) / this.N);
        for (const o of seg.objs) {
          if (o.taken === lap) continue;
          items.push({ z: p.z1, o, X: p.X1 + o.x * p.W1, Y: p.Y1, s: p.s1, clip: p.clip, p });
        }
      }
      for (const r of this.rivals) {
        const rz = mod(r.d - camD, this.L);
        if (rz < 60 || rz > (DRAW - 2) * SEG) continue;
        const along = this.camZ % SEG + rz;
        const n = Math.floor(along / SEG);
        const t = (along % SEG) / SEG;
        const p = this.proj[n];
        if (!p) continue;
        const X1 = p.s1 ? p.X1 : p.X2;
        const Y1 = p.s1 ? p.Y1 : p.Y2;
        const W1 = p.s1 ? p.W1 : p.W2;
        items.push({ z: rz, r, X: lerp(X1, p.X2, t) + r.x * lerp(W1, p.W2, t), Y: lerp(Y1, p.Y2, t), s: F / rz, clip: p.clip });
      }
      items.push({ z: PZ, me: true });
      items.sort((a, b) => b.z - a.z);
      for (const it of items) {
        if (it.me) this.drawMe(ctx);
        else if (it.r) this.drawRival(ctx, it);
        else this.drawObj(ctx, it);
      }
    }

    sprite(ctx, img, X, Y, sc, clip, lift = 0) {
      const w = img.width * sc;
      const h = img.height * sc;
      const x = Math.round(X - w / 2);
      const y = Math.round(Y - h - lift);
      if (y >= clip || x > W + 8 || x + w < -8 || w < 1) return;
      if (y + h > clip) {
        const vh = clip - y;
        ctx.drawImage(img, 0, 0, img.width, vh / sc, x, y, w, vh);
      } else ctx.drawImage(img, x, y, w, h);
    }

    drawObj(ctx, it) {
      const A = this.art;
      const o = it.o;
      const sc = it.s * K * o.sc;
      const f = (this.t >> 3) & 1;
      switch (o.k) {
        case 'coin': {
          const img = SDW.art.S.token;
          const sq = Math.abs(Math.cos(this.t * 0.1 + o.x * 3));
          const w = img.width * sc * 1.4;
          const h = img.height * sc * 1.4;
          const y = Math.round(it.Y - h - 90 * it.s - Math.sin(this.t * 0.1) * 2 * sc);
          if (y + h > it.clip || w < 1) return;
          ctx.drawImage(img, Math.round(it.X - (w * Math.max(0.2, sq)) / 2), y, w * Math.max(0.2, sq), h);
          break;
        }
        case 'gpu': {
          const lift = 70 * it.s + (Math.sin(this.t * 0.12) + 1) * 3 * sc;
          const g = 14 * sc * (1 + Math.sin(this.t * 0.2) * 0.15);
          if (it.Y - lift - 13 * sc < it.clip) {
            ctx.fillStyle = 'rgba(61,209,106,0.35)';
            ctx.fillRect(Math.round(it.X - g), Math.round(it.Y - lift - 13 * sc - g), Math.round(g * 2), Math.round(g * 2));
          }
          this.sprite(ctx, A.gpu, it.X, it.Y, sc, it.clip, lift);
          break;
        }
        case 'cone': this.sprite(ctx, A.cone, it.X, it.Y, sc, it.clip); break;
        case 'sign': this.sprite(ctx, A.sign, it.X, it.Y, sc, it.clip); break;
        case 'barrier': this.sprite(ctx, A.barrier, it.X, it.Y, sc, it.clip); break;
        case 'puddle': this.sprite(ctx, A.puddle[f], it.X, it.Y + 6 * sc, sc, it.clip); break;
        case 'tree': this.sprite(ctx, A.tree, it.X, it.Y, sc * 1.6, it.clip); break;
        case 'rack': this.sprite(ctx, A.rack[(this.t >> 4) & 1], it.X, it.Y, sc * 1.4, it.clip); break;
        case 'lamp': this.sprite(ctx, A.lamp, it.X, it.Y, sc * 1.6, it.clip); break;
        case 'bill': this.sprite(ctx, A.bills[o.img], it.X, it.Y, sc, it.clip); break;
        case 'gantry': this.drawGantry(ctx, it); break;
      }
    }

    drawGantry(ctx, it) {
      const o = it.o;
      const p = it.p;
      const s = it.s;
      const lx = p.X1 - 1.22 * p.W1;
      const rx = p.X1 + 1.22 * p.W1;
      const pw = Math.max(1, 70 * s);
      const bot = it.Y - 850 * s;
      const top = it.Y - 1400 * s;
      const clip = it.clip;
      if (top >= clip) return;
      const postB = Math.min(it.Y, clip);
      R(ctx, OUT, Math.round(lx - pw / 2), Math.round(top), Math.round(pw), Math.round(postB - top));
      R(ctx, OUT, Math.round(rx - pw / 2), Math.round(top), Math.round(pw), Math.round(postB - top));
      R(ctx, '#9aa3b5', Math.round(lx - pw / 2 + pw * 0.25), Math.round(top), Math.max(1, Math.round(pw * 0.4)), Math.round(postB - top));
      R(ctx, '#9aa3b5', Math.round(rx - pw / 2 + pw * 0.25), Math.round(top), Math.max(1, Math.round(pw * 0.4)), Math.round(postB - top));
      const sb = Math.min(bot, clip);
      const x0 = Math.round(lx - pw / 2);
      const w = Math.round(rx + pw / 2) - x0;
      R(ctx, OUT, x0, Math.round(top), w, Math.round(sb - top));
      const b = Math.max(1, Math.round(pw * 0.3));
      if (o.start) {
        // Checkered banner with start lights.
        const cw = w / 16;
        const ch = (sb - top - 2 * b) / 2;
        for (let c = 0; c < 16; c++) for (let rr = 0; rr < 2; rr++) {
          R(ctx, (c + rr) % 2 ? '#f4f4f8' : '#1d1533', Math.round(x0 + c * cw), Math.round(top + b + rr * ch), Math.ceil(cw), Math.ceil(ch));
        }
        if (w > 120) {
          R(ctx, OUT, Math.round(x0 + w / 2 - 50), Math.round(top + b), 100, Math.round(sb - top - 2 * b));
          SDW.game.text(ctx, this.me.d > (LAPS - 1) * this.L - 4000 ? 'FINISH' : 'THE AI RACE', Math.round(x0 + w / 2), Math.round((top + sb) / 2 - 4), '#ffd84a', 'center');
        }
        if (this.state === 'intro' || this.goT > 0) {
          const c = this.introT - 150;
          const lit = this.state === 'play' ? 4 : c < 0 ? 0 : Math.floor(c / 60) + 1;
          const r = Math.max(1, Math.round(90 * s));
          for (let i = 0; i < 3; i++) {
            const cx = Math.round(x0 + w / 2 + (i - 1) * r * 3);
            const cy = Math.round(sb + r * 1.6);
            R(ctx, OUT, cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2);
            R(ctx, lit === 4 ? '#3dd16a' : i < lit ? '#ff3b3b' : '#3a2a3a', cx - r, cy - r, r * 2, r * 2);
          }
        }
        return;
      }
      R(ctx, o.bg, x0 + b, Math.round(top + b), w - b * 2, Math.round(sb - top - b * 2));
      if (w > 150 && sb === bot) {
        o.lines.forEach((line, i) => {
          SDW.game.text(ctx, line, Math.round(x0 + w / 2), Math.round((top + sb) / 2 - o.lines.length * 5 + i * 11 + 1), '#ffffff', 'center');
        });
      } else if (w > 20) {
        o.lines.forEach((line, i) => {
          const lw = (line.length * 8 * w) / 170;
          R(ctx, 'rgba(255,255,255,0.7)', Math.round(x0 + w / 2 - lw / 2), Math.round(top + (sb - top) * (0.3 + i * 0.3)), Math.round(lw), Math.max(1, Math.round((sb - top) * 0.12)));
        });
      }
    }

    drawRival(ctx, it) {
      const r = it.r;
      const sc = it.s * K;
      const img = this.art.back[r.id][(this.t >> 2) & 1 && r.speed > 100 ? 1 : 0];
      const bob = r.speed > 100 && ((this.t + r.id.length) >> 2) & 1 ? sc : 0;
      this.sprite(ctx, img, it.X, it.Y - bob, sc, it.clip);
      if (r.boostT > 0 && it.Y < it.clip) this.flames(ctx, it.X, it.Y, sc);
      if (this.bubble && this.bubble.r === r && sc > 0.25 && it.Y - img.height * sc - 10 > 18) {
        const y = Math.round(it.Y - img.height * sc - 9 - bob);
        SDW.game.text(ctx, '!', Math.round(it.X), y, '#ffd84a', 'center');
      }
    }

    flames(ctx, X, Y, sc) {
      const fl = 3 + ((this.t >> 1) % 3) * 2;
      for (const ex of [-9.5, 7.5]) {
        R(ctx, '#ff7a1a', Math.round(X + ex * sc), Math.round(Y - 2 * sc), Math.max(1, Math.round(3 * sc)), Math.max(1, Math.round(fl * sc)));
        R(ctx, '#ffe36a', Math.round(X + (ex + 1) * sc), Math.round(Y - 2 * sc), Math.max(1, Math.round(sc)), Math.max(1, Math.round((fl - 2) * sc)));
      }
    }

    drawMe(ctx) {
      const me = this.me;
      const A = this.art;
      const X = Math.round(W / 2 + (me.x * RW - this.camX) * (F / PZ));
      const air = me.hz > 0;
      const bounce = !air && me.speed > 1500 && (this.t >> 1) & 1 ? 1 : 0;
      const Y = PY - Math.round(me.hz) - bounce;
      // Shadow stays on the road.
      ctx.fillStyle = 'rgba(10,6,20,0.45)';
      const sw = 46 - Math.min(16, me.hz);
      ctx.fillRect(X - sw / 2, PY - 3, sw, 4);
      ctx.save();
      ctx.translate(X, Y);
      const c = Math.cos(me.spinA);
      const lean = me.spinA ? 0 : me.steer * -0.07;
      ctx.rotate(lean + (me.crashT > 0 ? Math.sin(me.crashT) * 0.08 : 0));
      if (me.spinA) ctx.scale(Math.max(0.12, Math.abs(c)), 1);
      const big = this.power > 0;
      const d = SDW.game.darioSize(this.power);
      const ds = big ? 0.78 : 1;
      const dw = d.w * ds;
      const dh = d.h * ds;
      const lookBack = me.look > 0 || c < 0;
      const sx = Math.round(me.steer * 2);
      if (lookBack) {
        // Facing us (spinning out or glancing back at a rival he just passed).
        if (c < 0) {
          SDW.game.drawDario(ctx, this.power, 0, (this.t >> 3) % 6, -dw / 2, -54 + 16 - (big ? 3 : 0), ds);
          ctx.drawImage(A.meFront, -32, -54);
        } else {
          SDW.game.drawDario(ctx, this.power, 0, 2, -dw / 2 + sx, -54 + 15 - (big ? 4 : 0), ds);
          ctx.drawImage(A.me[(this.t >> 2) & 1], -32, -54);
        }
      } else {
        const back = darioBack(this.power);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(back, -dw / 2 + sx, -54 + 15 - (big ? 4 : 0), dw, dh);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(A.me[me.speed > 100 && (this.t >> 2) & 1 ? 1 : 0], -32, -54);
      }
      ctx.restore();
      if (me.boostT > 0) this.flames(ctx, X, Y + 1, 1);
    }

    drawFx(ctx) {
      const me = this.me;
      // Speed lines while boosting.
      if (me.boostT > 0 || (me.speed > MAXS * 1.1)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = hash(i, this.t) * Math.PI * 2;
          const r0 = 70 + hash(this.t, i) * 120;
          const len = 20 + hash(i + 7, this.t) * 40;
          const ca = Math.cos(a);
          const sa = Math.sin(a) * 0.7;
          ctx.moveTo(W / 2 + ca * r0, HY + 10 + sa * r0);
          ctx.lineTo(W / 2 + ca * (r0 + len), HY + 10 + sa * (r0 + len));
        }
        ctx.stroke();
      }
      for (const p of this.fx) {
        if (p.img) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, p.life / 20);
          ctx.drawImage(p.img, -p.img.width / 2, -p.img.height / 2);
          ctx.restore();
        } else {
          const sz = p.size || 1;
          R(ctx, p.color, Math.round(p.x), Math.round(p.y), sz, sz);
        }
      }
      // Popups rise from the kart.
      const X = W / 2 + (me.x * RW - this.camX) * 0.2;
      this.pops.forEach((p, i) => {
        if ((p.t < 40 || (p.t >> 2) % 2 === 0)) {
          SDW.game.text(ctx, p.text, Math.round(clamp(X, 90, W - 90)), Math.round(PY - 70 - p.t * 0.35 - i * 10), p.color, 'center');
        }
      });
    }

    // ------------------------------------------------------------- HUD --
    drawHud(ctx) {
      const me = this.me;
      const g = SDW.game;
      const lap = this.lapOf(me.d);
      // Position, top right.
      const pos = this.position();
      g.bigText(ctx, ORD[pos], W - 30, 20, 16, pos === 1 ? '#ffd84a' : pos === 4 ? '#ff7a7a' : '#ffffff', '#1d1533');
      // Speedometer, bottom left.
      const pct = me.speed / MAXS;
      R(ctx, 'rgba(10,8,20,0.6)', 4, H - 25, 84, 21);
      g.text(ctx, String(Math.round(pct * 240)).padStart(3, '0'), 8, H - 22, me.boostT > 0 ? '#7fe0ff' : '#ffffff');
      g.text(ctx, 'TOK/S', 36, H - 22, '#9b84ff');
      for (let i = 0; i < 12; i++) {
        const on = pct * 12 > i + 0.2;
        const col = i < 6 ? '#3dd16a' : i < 9 ? '#ffd84a' : '#ff5a5a';
        R(ctx, on ? (me.boostT > 0 ? '#7fe0ff' : col) : '#2a2440', 8 + i * 6, H - 11 - Math.floor(i / 3), 5, 4 + Math.floor(i / 3));
      }
      // Boost cells, bottom right.
      R(ctx, 'rgba(10,8,20,0.6)', W - 92, H - 25, 88, 21);
      g.text(ctx, 'BOOST', W - 88, H - 22, me.cells ? '#3dd16a' : '#6a6480');
      for (let i = 0; i < 3; i++) {
        const full = i < me.cells;
        R(ctx, OUT, W - 88 + i * 26, H - 12, 24, 7);
        R(ctx, full ? ((this.t >> 3) & 1 ? '#3dd16a' : '#7dffa0') : '#2a2440', W - 87 + i * 26, H - 11, 22, 5);
      }
      if (me.cells && !me.boostT && (this.t >> 4) & 1) g.text(ctx, 'X / ZAP TO BOOST!', W - 6, H - 36, '#7dffa0', 'right');
      if (me.boostT > 0) R(ctx, '#7fe0ff', W - 88, H - 4, Math.round((me.boostT / 170) * 76), 2);
      // Race progress with racer dots.
      const x0 = 112;
      const bw = W - 224;
      const y = 22;
      R(ctx, 'rgba(10,8,20,0.55)', x0 - 4, y - 5, bw + 10, 12);
      R(ctx, '#6b4fd6', x0, y, bw, 2);
      for (let i = 1; i < LAPS; i++) R(ctx, '#c4b5ff', x0 + Math.round((bw * i) / LAPS), y - 2, 1, 6);
      for (let i = 0; i < 4; i++) R(ctx, i % 2 ? '#ffffff' : '#1d1533', x0 + bw - 2 + (i % 2) * 3, y - 4 + (i >> 1) * 3, 3, 3);
      const dot = (d, col, big) => {
        const px = x0 + Math.round(clamp(d / (LAPS * this.L), 0, 1) * bw);
        const s = big ? 5 : 4;
        R(ctx, OUT, px - (s >> 1) - 1, y - (s >> 1), s + 2, s + 2);
        R(ctx, col, px - (s >> 1), y + 1 - (s >> 1), s, s);
      };
      for (const r of this.rivals) dot(r.d, r.color, false);
      dot(me.d, '#ff5a5a', true);
      if (this.goT > 0) g.bigText(ctx, 'GO!', W / 2, 70, 32, '#3dd16a', '#1d1533');
      if (this.banner && (this.banner.t < 60 || (this.banner.t >> 3) & 1)) g.bigText(ctx, this.banner.text, W / 2, 72, 16, this.banner.color, '#1d1533');
      this.drawBubble(ctx);
      g.hud(ctx, `LAP ${lap}/${LAPS}`, lap === LAPS ? '#ffd84a' : '#ffffff');
    }

    portrait(ctx, r, x, y, size) {
      const [px, py, pw, ph] = r.port;
      const k = size / Math.max(pw, ph);
      R(ctx, OUT, x - 1, y - 1, size + 2, size + 2);
      R(ctx, '#2a2050', x, y, size, size);
      ctx.drawImage(this.art.front[r.id], px, py, pw, ph, Math.round(x + (size - pw * k) / 2), Math.round(y + (size - ph * k) / 2), pw * k, ph * k);
    }

    drawBubble(ctx) {
      const b = this.bubble;
      if (!b) return;
      const g = SDW.game;
      const w = 40 + b.text.length * 8;
      const slide = b.t < 8 ? (8 - b.t) * 12 : b.t > 160 ? (b.t - 160) * 30 : 0;
      const x = 4 - slide;
      const y = 33;
      R(ctx, 'rgba(29,21,51,0.92)', x, y, w, 30);
      R(ctx, b.r.color, x, y, w, 1);
      R(ctx, b.r.color, x, y + 29, w, 1);
      R(ctx, b.r.color, x + w - 1, y, 1, 30);
      this.portrait(ctx, b.r, x + 4, y + 3, 24);
      g.text(ctx, b.r.name, x + 34, y + 5, b.r.color);
      const shown = b.text.slice(0, Math.floor(b.t * 1.5));
      g.text(ctx, shown, x + 34, y + 17, '#ffffff');
    }

    drawIntro(ctx) {
      const g = SDW.game;
      const c = this.introT - 150;
      g.hud(ctx, `LAP 1/${LAPS}`, '#ffffff');
      if (c < 0) {
        const fade = Math.min(1, (150 - this.introT) / 12);
        ctx.save();
        ctx.globalAlpha = fade;
        R(ctx, 'rgba(16,10,36,0.88)', 0, 15, W, H - 15);
        g.bigText(ctx, 'THE AI RACE', W / 2, 22, 16, '#ffd84a', '#3a1a5a');
        g.text(ctx, 'USA VS CHINA VS EVERYONE', W / 2, 44, '#7fe0ff', 'center');
        const xs = [60, 148, 236, 324];
        const bob = (i) => ((this.t >> 3) + i) % 2;
        // Dario
        const pw = this.power;
        const d = g.darioSize(pw);
        const ds = pw ? 0.78 : 1;
        g.drawDario(ctx, pw, 0, (this.t >> 3) % 6, xs[0] - (d.w * ds) / 2, 118 - 54 + 16 - (pw ? 3 : 0) - bob(0), ds);
        ctx.drawImage(this.art.meFront, xs[0] - 32, 118 - 54);
        ctx.drawImage(this.art.front.whale, xs[1] - 32, 118 - 56 - bob(1));
        ctx.drawImage(this.art.front.llama, xs[2] - 32, 118 - 64 - bob(2));
        ctx.drawImage(this.art.front.hype, xs[3] - 32, 118 - 46 - bob(3));
        const names = [['DARIO', '#ff7a7a'], ['THE WHALE', '#7fb0ff'], ['THE LLAMA', '#c4a0ff'], ['HYPE-MAN', '#ffffff']];
        names.forEach(([n, col], i) => g.text(ctx, n, xs[i], 124, col, 'center'));
        const tags = ['SAFETY FIRST', 'TRAINED CHEAP', 'MOSTLY OPEN', 'FEELS THE AGI'];
        tags.forEach((s, i) => {
          const tw = tinyW(s);
          tiny(ctx, s, Math.round(xs[i] - tw / 2), 135, '#9b84ff');
        });
        g.text(ctx, '3 LAPS. FINISH 1ST TO WIN!', W / 2, 148, '#ffffff', 'center');
        g.text(ctx, 'ARROWS STEER  Z HOP  X BOOST  DOWN BRAKE', W / 2, 164, '#ffd84a', 'center');
        g.text(ctx, 'PHONE: < > STEER  JUMP HOP  ZAP BOOST', W / 2, 176, '#ffd84a', 'center');
        g.text(ctx, 'GRAB GPUS TO FILL YOUR BOOST.', W / 2, 192, '#3dd16a', 'center');
        g.text(ctx, 'HOP OVER CONES + HALLUCINATIONS.', W / 2, 204, '#e0b0ff', 'center');
        ctx.restore();
        return;
      }
      const n = 3 - Math.floor(c / 60);
      const k = (c % 60) / 60;
      g.bigText(ctx, String(n), W / 2, 100 - Math.round((1 - k) * 6), 32, n === 1 ? '#ffd84a' : '#ffffff', '#1d1533');
      R(ctx, 'rgba(16,10,36,0.7)', 0, 15, W, 24);
      g.text(ctx, 'ARROWS STEER  Z HOP  X BOOST', W / 2, 18, '#ffffff', 'center');
      g.text(ctx, 'PHONE: JUMP HOP  ZAP BOOST', W / 2, 29, '#c4b5ff', 'center');
    }

    drawFinish(ctx) {
      const g = SDW.game;
      const t = this.endT;
      const won = this.place === 1;
      if (t < 12) {
        ctx.fillStyle = `rgba(255,255,255,${(12 - t) / 12})`;
        ctx.fillRect(0, 0, W, H);
      }
      g.hud(ctx, 'FINISH!', '#ffd84a');
      if (t < 20) return;
      R(ctx, 'rgba(16,10,36,0.6)', 0, 15, W, H - 15);
      g.bigText(ctx, won ? 'YOU WON THE AI RACE!' : `YOU FINISHED ${ORD[this.place]}`, W / 2, 22, 16, won ? '#ffd84a' : '#ff7a7a', '#1d1533');
      const winner = this.rivals.find((q) => q.fin === 1) || this.rivals[0];
      g.text(ctx, won ? 'SAFETY FIRST. SPEED ALSO FIRST.' : LOSE_QUOTES[winner.id][0], W / 2, 42, won ? '#ffffff' : '#ffd84a', 'center');
      if (!won && t > 60) g.text(ctx, 'FINISH 1ST TO MOVE ON. TRY AGAIN!', W / 2, 210, '#c4b5ff', 'center');
      // Photo-finish polaroid.
      const drop = Math.max(0, 30 - (t - 20)) * 4;
      ctx.save();
      ctx.translate(96, 104 - drop);
      ctx.rotate(-0.05);
      R(ctx, OUT, -71, -46, 142, 102);
      R(ctx, '#f4f4f8', -70, -45, 140, 100);
      if (this.photo) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.photo, 14, 20, 164, 92, -64, -39, 128, 75);
        ctx.imageSmoothingEnabled = false;
      }
      g.text(ctx, 'PHOTO FINISH', 0, 41, '#1d1533', 'center');
      ctx.restore();
      // Standings.
      const order = [{ name: 'DARIO', color: '#ff7a7a', d: this.me.d, fin: this.me.fin }]
        .concat(this.rivals.map((r) => ({ name: r.name, color: r.color, d: r.d, fin: r.fin })))
        .sort((a, b) => (a.fin || 99) - (b.fin || 99) || b.d - a.d);
      order.forEach((o, i) => {
        if (t > 40 + i * 10) g.text(ctx, `${ORD[i + 1]} ${o.name}`, 196, 66 + i * 14, o.color);
      });
      // Joke from 2nd place (win) or from the winner (loss).
      if (t > 90) {
        const r = won ? this.rivals.find((q) => q.fin === 2) || this.rivals[0] : winner;
        const q = won ? WIN_QUOTES[r.id] : LOSE_QUOTES[r.id].slice(1);
        const y = 162;
        R(ctx, 'rgba(29,21,51,0.95)', 4, y, W - 8, 40);
        R(ctx, r.color, 4, y, W - 8, 1);
        R(ctx, r.color, 4, y + 39, W - 8, 1);
        this.portrait(ctx, r, 10, y + 6, 28);
        g.text(ctx, `${r.name}:`, 46, y + 5, r.color);
        g.text(ctx, q[0], 46, y + 17, '#ffffff');
        g.text(ctx, q[1], 46, y + 28, '#ffffff');
      }
    }
  };
})();
