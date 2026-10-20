'use strict';
// THE WEEKEND: a first-person raycaster level. The Hype-Man was fired on
// Friday; Dario collects 5 pages of the letter before Monday 9 AM, then
// reaches the boardroom. Walls, sprites and HUD are all drawn procedurally.
(() => {
  const W = SDW.W;
  const H = SDW.H;
  const VH = 192;                 // 3D view height; status bar below
  const PL = 0.7;                 // camera plane half-width (FOV ~70 deg)
  const K = W / 2 / PL;           // screen px per world unit at distance 1
  const TS = 64;                  // wall texture size
  const NS = 10;                  // distance shade levels
  const FOG = '#0a0814';
  const HOURS = 64;               // FRI 5 PM -> MON 9 AM
  const HPF = HOURS / (165 * 60); // in-game hours per step (~165 s total)
  const PX = 1 / 48;              // sprite pixel size in world units
  const mk = SDW.makeCanvas;
  const hash = (a, b) => SDW.art.hash(a | 0, b | 0);
  const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const au = () => SDW.audio;

  // ------------------------------------------------------------ map --
  // O window  # wall  S server rack  G glass  E elevator  R boardroom wall
  // B boardroom door  P poster pillar  H HQ sign  C CEO counter  T kombucha
  // K kitchen counter.  Lowercase = things on the floor: l letter page,
  // t token, c coffee, z pizza, b board member, r recruiter, d desk,
  // p plant, m meeting table, q reception, w water cooler, @ start.
  const MAP = [
    'OOOOOOOOOOOOOOOOOOOOOOOO',
    'Ot.....r#.l..t.#RRRRRRRO',
    'O.SSSSS.#.P..P.#RRRRRRRO',
    'O.ttt..c#..b...#RRRBRRRO',
    'O.SSSSS......t.........O',
    'O...l...#..t...#p.b..p.O',
    'O.SSSSS.#.P..P.#.......O',
    'Ot......#....z.#.t..c..O',
    'O###.####.####.##.#####O',
    'O....t.......t....GGGGGO',
    'O..d..d....d..d...G.m..O',
    'O..t......t......r....lO',
    'O.###..P..P..###..G.p..O',
    'O..c....b.........GGGGGO',
    'O..d..d....d..d...G.m..O',
    'O......t..t...........zO',
    'O...t.........t...Gt.t.O',
    'O##.######H..C###..GGGGO',
    'O....c.#p......p#..t...O',
    'T..KK..#........#......O',
    'O.............q....P...O',
    'O.l....#...@....#....l.O',
    'Ot..t..#w......w#t....tO',
    'OOOOOOOOOOEEEEOOOOOOOOOO',
  ];
  const MW = 24;
  const MH = 24;
  const ZONES = [ // [name, x0, y0, x1, y1] inclusive
    ['server', 1, 1, 7, 7], ['safety', 9, 1, 14, 7], ['board', 15, 4, 22, 7],
    ['open', 1, 8, 16, 16], ['meet', 17, 8, 22, 16], ['kitchen', 1, 17, 6, 22],
    ['lobby', 8, 17, 15, 22], ['comms', 17, 17, 22, 22],
  ];
  const ZONE_MSG = {
    server: ['SERVER ROOM', '10,000 GPUS. ZERO DECISIONS.'],
    safety: ['SAFETY TEAM', 'WHITEBOARDS FULL OF P(DOOM)'],
    board: ['BOARD WING', 'THE DOOR NEEDS ALL 5 PAGES'],
    open: ['OPEN PLAN', 'EVERYONE IS IN THE GROUP CHAT'],
    meet: ['MEETING ROOMS', 'ALL DOUBLE-BOOKED BY THE BOARD'],
    kitchen: ['KITCHEN', 'THE KOMBUCHA TAP IS SAD'],
    lobby: ['LOBBY', "YOUR BADGE SAYS 'INTERIM CEO'"],
    comms: ['COMMS WAR ROOM', '47 DRAFT STATEMENTS. 0 SENT.'],
  };
  const PAGE_TXT = [
    "SIGNED: 505 OF 770. IT'S HAPPENING.",
    'SIGNED: 650 OF 770. INTERNS TOO.',
    'SIGNED: 702. EVEN A BOARD MEMBER!',
    'SIGNED: 743 OF 770. <3 <3 <3',
    'SIGNED: 747 OF 770. CLOSE ENOUGH!',
  ];
  const NEWS = [ // [clock hour, from, text]
    [0.6, 'GROUP CHAT', 'WAIT. WHAT JUST HAPPENED??'],
    [5, 'NEWS', "HYPE-MAN 'NOT CONSISTENTLY CANDID'"],
    [10, 'INVESTORS', 'WE WOULD LIKE A WORD. MANY WORDS.'],
    [16, 'NEWS', 'HYPE-MAN SPOTTED WITH A GUEST BADGE'],
    [22, 'BOARD', 'BRING HIM BACK? MAYBE. NO. MAYBE.'],
    [28, 'NEWS', 'INTERIM CEO NAMED'],
    [33, 'NEWS', 'A DIFFERENT INTERIM CEO NAMED'],
    [39, 'BIG TECH', 'EVERYONE CAN JOIN US. EVERYONE.'],
    [45, 'GROUP CHAT', '<3 <3 <3 <3 <3 <3 <3 <3 <3 <3'],
    [51, 'NEWS', 'NOBODY HAS SLEPT SINCE FRIDAY'],
    [57, 'BOARD', 'OK OK. LET US TALK.'],
    [60, 'CALENDAR', 'MONDAY 9 AM: ALL HANDS (AWKWARD)'],
  ];
  const FIRED = ["YOU'RE FIRED! -3 HOURS", 'NOT CONSISTENTLY CANDID! -3 HRS', 'BOARD LOST CONFIDENCE! -3 HOURS'];

  // ------------------------------------------------------ tiny font --
  // 3x5 pixel glyphs for text painted into textures (rows as octal bits).
  const GLYPHS = {
    A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755',
    I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644',
    Q: '25563', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255',
    Y: '55222', Z: '71247', 0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616',
    6: '34652', 7: '71222', 8: '25252', 9: '25316', ' ': '00000', ':': '02020', '.': '00002',
    ',': '00024', '!': '22202', '?': '61202', "'": '22000', '(': '12221', ')': '42224', '-': '00700',
    '/': '11244', '%': '51245', $: '36236', '&': '25253', '+': '02720', '=': '07070', '>': '42124',
    '#': '57575', '*': '05250', '_': '00007',
  };
  function tiny(c, s, x, y, col, sc = 1) {
    c.fillStyle = col;
    for (let i = 0; i < s.length; i++) {
      const g = GLYPHS[s[i]];
      if (!g) continue;
      for (let r = 0; r < 5; r++) {
        const b = +g[r];
        for (let k = 0; k < 3; k++) if (b & (4 >> k)) c.fillRect(x + (i * 4 + k) * sc, y + r * sc, sc, sc);
      }
    }
  }
  const tinyC = (c, s, cx, y, col, sc = 1) => tiny(c, s, Math.round(cx - ((s.length * 4 - 1) * sc) / 2), y, col, sc);

  // ------------------------------------------------------------ art --
  // Every texture/sprite is pre-shaded into NS rows (near -> far fog).
  function shadeSheet(frames, w, h) {
    const [s, x] = mk(w * frames.length, h * NS);
    for (let lv = 0; lv < NS; lv++) {
      frames.forEach((f, i) => x.drawImage(f, i * w, lv * h));
      if (!lv) continue;
      x.globalCompositeOperation = 'source-atop';
      x.globalAlpha = (lv / (NS - 1)) * 0.86;
      R(x, FOG, 0, lv * h, w * frames.length, h);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
    }
    return s;
  }
  function tex(draw) {
    const [c, x] = mk(TS, TS);
    draw(x);
    return shadeSheet([c], TS, TS);
  }
  function outline(c) {
    const x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    const w = c.width;
    const a = (i, j) => (i < 0 || j < 0 || i >= w || j >= c.height ? 0 : p[(j * w + i) * 4 + 3]);
    const out = [];
    for (let j = 0; j < c.height; j++) {
      for (let i = 0; i < w; i++) {
        if (a(i, j) < 128 && (a(i - 1, j) > 128 || a(i + 1, j) > 128 || a(i, j - 1) > 128 || a(i, j + 1) > 128)) out.push(i, j);
      }
    }
    for (let k = 0; k < out.length; k += 2) R(x, '#140f20', out[k], out[k + 1], 1, 1);
  }
  // A sprite: `frames` drawings of w x h, 1px dark outline, shaded sheet.
  function sprite(w, h, frames, draw, line = true) {
    const fs = [];
    for (let f = 0; f < frames; f++) {
      const [c, x] = mk(w, h);
      draw(x, f);
      if (line) outline(c);
      fs.push(c);
    }
    return { img: shadeSheet(fs, w, h), fw: w, fh: h, n: frames };
  }
  function speckle(x, col, n, seed) {
    for (let i = 0; i < n; i++) R(x, col, Math.floor(hash(i, seed) * TS), Math.floor(hash(seed, i + 99) * TS), 1, 1);
  }

  // Walls
  function officeBase(x, seed) {
    R(x, '#a39cc0', 0, 0, TS, TS);
    speckle(x, '#9891b6', 110, seed);
    speckle(x, '#aca5c8', 60, seed + 7);
    R(x, '#c6c0dc', 0, 0, TS, 2);
    R(x, '#4a4368', 0, 57, TS, 7);
    R(x, '#6a6290', 0, 57, TS, 1);
    R(x, '#8e87ad', 0, 0, 1, TS);
  }
  function wbFrame(x) {
    R(x, '#6d7484', 4, 7, 56, 42);
    R(x, '#f2f3f8', 5, 8, 54, 40);
    R(x, '#e2e4ee', 5, 44, 54, 4);
    R(x, '#6d7484', 8, 48, 48, 3);
    R(x, '#ff5a5a', 12, 47, 5, 1);
    R(x, '#3f7dff', 19, 47, 5, 1);
    R(x, '#3dd16a', 26, 47, 5, 1);
  }
  function posterFrame(x, bg, border) {
    R(x, '#2a2240', 4, 5, 56, 49);
    R(x, border, 5, 6, 54, 47);
    R(x, bg, 6, 7, 52, 45);
  }
  function sparkle(x, cx, cy, col) {
    R(x, col, cx, cy - 2, 1, 5);
    R(x, col, cx - 2, cy, 5, 1);
  }
  function buildArt() {
    const A = {};
    A.office = [0, 1, 2].map((v) => tex((x) => {
      officeBase(x, 11 + v);
      if (v === 0) { R(x, '#e6e2f0', 50, 30, 5, 8); R(x, '#9a93b8', 52, 32, 1, 3); }
      if (v === 1) { // an office door
        R(x, '#3a2a1e', 16, 8, 32, 50);
        R(x, '#7a5236', 18, 10, 28, 48);
        R(x, '#8a6040', 21, 14, 22, 14);
        R(x, '#8a6040', 21, 32, 22, 20);
        R(x, '#ffd84a', 41, 32, 3, 2);
        R(x, '#f2f3f8', 19, 2, 26, 5);
        R(x, '#e6e2f0', 22, 17, 20, 8);
        tinyC(x, 'INTERIM', 32, 18, '#2a2240');
        tinyC(x, 'CEO #3', 32, 0, '#2a2240');
      }
      if (v === 2) { // employee of the month
        R(x, '#8a6a3a', 12, 10, 40, 38);
        R(x, '#f2e6c8', 14, 12, 36, 34);
        tinyC(x, 'EMPLOYEE', 32, 14, '#2a2240');
        tinyC(x, 'OF MONTH', 32, 20, '#2a2240');
        R(x, '#1e7a3a', 20, 28, 24, 12);
        R(x, '#3dd16a', 21, 29, 22, 10);
        R(x, '#2a2240', 24, 31, 6, 6);
        R(x, '#2a2240', 33, 31, 6, 6);
        R(x, '#ffd84a', 22, 40, 20, 2);
        tinyC(x, 'GPU', 32, 6 + 36, '#2a2240');
      }
    }));
    A.wb = [0, 1, 2, 3].map((v) => tex((x) => {
      officeBase(x, 21 + v);
      wbFrame(x);
      if (v === 0) {
        tinyC(x, 'AGI?', 32, 11, '#e03a3a', 3);
        R(x, '#3f7dff', 14, 31, 36, 1);
        tinyC(x, 'SOON (TM)', 32, 35, '#3f7dff');
      } else if (v === 1) {
        tinyC(x, 'SAFETY', 32, 11, '#1e9a4a', 2);
        tinyC(x, 'VS', 32, 23, '#2a2240');
        tinyC(x, 'SCALE', 32, 31, '#e03a3a', 2);
        R(x, '#3f7dff', 8, 42, 48, 1);
      } else if (v === 2) { // loss curve
        R(x, '#2a2240', 11, 12, 1, 30);
        R(x, '#2a2240', 11, 41, 44, 1);
        for (let i = 0; i < 42; i++) {
          const yy = Math.round(40 - 26 * Math.exp(-i / 7) - (i > 30 ? (i - 30) * 0.2 : 0));
          R(x, '#3f7dff', 12 + i, 38 - (yy - 14), 1, 2);
        }
        tiny(x, 'LOSS', 13, 9, '#2a2240');
        tiny(x, 'COMPUTE', 27, 43, '#2a2240');
        tiny(x, 'AGI?', 38, 14, '#e03a3a');
        R(x, '#e03a3a', 49, 20, 1, 8);
      } else {
        tinyC(x, 'P(DOOM) =', 32, 11, '#2a2240');
        tinyC(x, '??%', 32, 19, '#e03a3a', 2);
        tinyC(x, 'RLHF > VIBES', 32, 33, '#3f7dff');
        tinyC(x, 'CEOS: IIII', 32, 40, '#1e9a4a');
      }
    }));
    A.poster = [0, 1, 2, 3, 4].map((v) => tex((x) => {
      officeBase(x, 31 + v);
      if (v === 0) {
        posterFrame(x, '#3a1a6a', '#ffd84a');
        tinyC(x, 'FEEL', 32, 10, '#ffffff', 2);
        tinyC(x, 'THE', 32, 22, '#c4b5ff');
        tinyC(x, 'AGI', 32, 30, '#ffd84a', 3);
        sparkle(x, 12, 14, '#7fe0ff');
        sparkle(x, 51, 26, '#7fe0ff');
      } else if (v === 1) {
        posterFrame(x, '#1a4a8a', '#7fe0ff');
        tinyC(x, 'MOVE FAST', 32, 11, '#ffffff');
        tinyC(x, 'AND', 32, 19, '#7fe0ff');
        tinyC(x, 'ALIGN', 32, 27, '#ffd84a', 2);
        tinyC(x, 'THINGS', 32, 41, '#ffffff');
      } else if (v === 2) {
        posterFrame(x, '#f2e6c8', '#8a6a3a');
        tinyC(x, 'OUR MISSION:', 32, 10, '#2a2240');
        tinyC(x, 'BENEFIT ALL', 32, 19, '#6b4fd6');
        tinyC(x, 'OF HUMANITY', 32, 26, '#6b4fd6');
        R(x, '#ffd84a', 26, 34, 12, 2);
        tinyC(x, '(TERMS APPLY)', 32, 41, '#e03a3a');
      } else if (v === 3) {
        posterFrame(x, '#1c3a2a', '#3dd16a');
        tinyC(x, 'CAPPED', 32, 10, '#ffffff');
        tinyC(x, 'PROFIT:', 32, 17, '#ffffff');
        tinyC(x, '100X', 32, 26, '#ffd84a', 3);
        tinyC(x, '(CAP TBD)', 32, 44, '#3dd16a');
      } else {
        posterFrame(x, '#b02a36', '#ffffff');
        tinyC(x, 'IN CASE OF', 32, 10, '#ffffff');
        tinyC(x, 'BOARD COUP', 32, 18, '#ffd84a');
        R(x, '#ffffff', 22, 26, 20, 12);
        R(x, 'rgba(160,220,255,0.8)', 23, 27, 18, 10);
        R(x, '#6a4020', 26, 31, 12, 2);
        R(x, '#9aa3b5', 36, 29, 3, 6);
        tinyC(x, 'BREAK GLASS', 32, 42, '#ffffff');
      }
    }));
    A.glass = tex((x) => {
      R(x, 'rgba(140,215,255,0.16)', 0, 0, TS, TS);
      x.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 64; i++) { x.fillRect(10 + i * 0.5, 50 - i, 2, 1); x.fillRect(22 + i * 0.5, 54 - i, 1, 1); }
      R(x, 'rgba(240,248,255,0.5)', 0, 28, TS, 7);
      tinyC(x, 'ALIGNMENT', 32, 29, 'rgba(60,70,110,0.9)');
      R(x, '#c8d2e0', 0, 0, TS, 3);
      R(x, '#8a96a8', 0, 3, TS, 1);
      R(x, '#c8d2e0', 0, 56, TS, 8);
      R(x, '#8a96a8', 0, 56, TS, 1);
      R(x, '#aab6c8', 0, 0, 2, TS);
      R(x, '#aab6c8', 62, 0, 2, TS);
    });
    A.rack = [0, 1, 2].map((f) => tex((x) => {
      R(x, '#0d0f16', 0, 0, TS, TS);
      R(x, '#05060a', 0, 0, 4, TS);
      R(x, '#05060a', 60, 0, 4, TS);
      for (let u = 0; u < 8; u++) {
        const y = 2 + u * 7;
        R(x, '#2a2f40', 5, y, 54, 6);
        R(x, '#3a4058', 5, y, 54, 1);
        for (let k = 0; k < 8; k++) R(x, '#161925', 30 + k * 3, y + 2, 2, 3);
        for (let k = 0; k < 4; k++) {
          const on = hash(u * 5 + k, f * 7 + 3) > 0.42;
          const col = ['#3dff8a', '#38c8ff', '#ffb347'][(u + k) % 3];
          R(x, on ? col : '#1e2a26', 8 + k * 4, y + 2, 2, 2);
        }
      }
      tinyC(x, 'GPU POD', 32, 58, '#5a6378');
    }));
    A.metal = [0, 1].map((v) => tex((x) => {
      R(x, '#394057', 0, 0, TS, TS);
      R(x, '#2a3044', 31, 0, 2, TS);
      R(x, '#2a3044', 0, 31, TS, 2);
      for (const [a, b] of [[3, 3], [28, 3], [36, 3], [60, 3], [3, 28], [60, 28], [3, 36], [60, 36], [3, 60], [28, 60], [36, 60], [60, 60]]) R(x, '#5a6378', a, b, 1, 1);
      if (v) {
        R(x, '#2a2240', 7, 15, 50, 32);
        R(x, '#ffd84a', 8, 16, 48, 30);
        tinyC(x, 'DO NOT', 32, 19, '#1a1a24');
        tinyC(x, 'UNPLUG', 32, 26, '#1a1a24', 1);
        tinyC(x, 'AGI INSIDE?', 32, 36, '#b02a36');
      } else {
        for (let k = 0; k < 6; k++) R(x, '#2a3044', 10, 42 + k * 3, 16, 1);
      }
    }));
    A.elev = tex((x) => {
      R(x, '#5a5f70', 0, 0, TS, TS);
      R(x, '#3a3e4a', 7, 8, 50, 56);
      R(x, '#b9c0cc', 9, 10, 46, 54);
      for (let i = 0; i < 46; i += 4) R(x, '#c9d0dc', 9 + i, 10, 1, 54);
      R(x, '#6a7080', 31, 10, 2, 54);
      R(x, '#11131c', 24, 1, 16, 6);
      tinyC(x, '17', 32, 2, '#ff5a5a');
      R(x, '#3a3e4a', 58, 30, 4, 10);
      R(x, '#ffd84a', 59, 32, 2, 2);
      R(x, '#ffd84a', 59, 36, 2, 2);
    });
    const tiles = (x) => {
      R(x, '#e9eef3', 0, 0, TS, TS);
      for (let i = 0; i < TS; i += 8) { R(x, '#c4ccd6', i, 0, 1, TS); R(x, '#c4ccd6', 0, i, TS, 1); }
      for (let i = 0; i < 8; i++) R(x, i % 2 ? '#7fe0ff' : '#5ac0e0', i * 8 + 1, 25, 7, 7);
      R(x, '#8a96a8', 0, 58, TS, 6);
    };
    A.tile = tex(tiles);
    A.kombucha = tex((x) => {
      tiles(x);
      R(x, '#ffffff', 8, 3, 48, 16);
      R(x, '#2a2240', 8, 3, 48, 1);
      tinyC(x, 'KOMBUCHA', 32, 5, '#1e9a4a');
      tinyC(x, 'ON TAP :(', 32, 12, '#e03a3a');
      R(x, '#8a6a20', 26, 22, 12, 8);
      R(x, '#d8a82a', 27, 23, 10, 6);
      R(x, '#8a6a20', 30, 30, 4, 8);
      R(x, '#1a1a24', 29, 25, 1, 1);
      R(x, '#1a1a24', 34, 25, 1, 1);
      R(x, '#1a1a24', 30, 27, 4, 1);
      R(x, '#7fc8ff', 31, 40, 2, 2);
      R(x, '#555b6a', 22, 44, 20, 3);
      R(x, '#ffffff', 10, 48, 44, 10);
      tinyC(x, 'EMPTY SINCE', 32, 48, '#2a2240');
      tinyC(x, 'FRIDAY', 32, 53, '#2a2240');
    });
    const marble = (x) => {
      R(x, '#d6cfc0', 0, 0, TS, TS);
      for (let v = 0; v < 4; v++) {
        let yy = hash(v, 5) * TS;
        for (let i = 0; i < TS; i++) { yy += (hash(i, v + 9) - 0.5) * 3; R(x, '#bdb4a2', i, Math.round(yy) & 63, 1, 1); }
      }
      R(x, '#b8902a', 0, 58, TS, 6);
      R(x, '#e8d48a', 0, 58, TS, 1);
      R(x, '#b8902a', 0, 0, TS, 2);
    };
    A.marble = tex(marble);
    A.hq = tex((x) => {
      marble(x);
      R(x, '#b8902a', 3, 5, 58, 50);
      R(x, '#1d1533', 4, 6, 56, 48);
      R(x, '#9b84ff', 28, 9, 8, 8);
      R(x, '#1d1533', 30, 11, 4, 4);
      R(x, '#ffd84a', 31, 12, 2, 2);
      tinyC(x, 'THE', 32, 21, '#c4b5ff');
      tinyC(x, "NONPROFIT'S", 32, 28, '#ffffff');
      tinyC(x, 'FOR-PROFIT', 32, 35, '#ffd84a');
      tinyC(x, 'HQ', 32, 42, '#ffffff', 2);
    });
    A.ceo = [3, 4].map((n) => tex((x) => {
      marble(x);
      R(x, '#5a5f70', 5, 8, 54, 44);
      R(x, '#05060a', 6, 9, 52, 42);
      tinyC(x, 'CEOS THIS', 32, 12, '#9aa3b5');
      tinyC(x, 'WEEKEND:', 32, 18, '#9aa3b5');
      tinyC(x, String(n), 32, 26, '#ff5a5a', 4);
      tinyC(x, '?', 46, 40, '#ff5a5a');
    }));
    const wood = (x) => {
      for (let i = 0; i < 4; i++) R(x, i % 2 ? '#64412d' : '#5a3a28', i * 16, 0, 16, TS);
      for (let i = 0; i < 40; i++) R(x, '#4a2e1f', Math.floor(hash(i, 3) * TS), Math.floor(hash(i, 4) * 60), 1, 4);
      for (let i = 0; i < 4; i++) R(x, '#3a2418', i * 16, 0, 1, TS);
      R(x, '#b8902a', 0, 55, TS, 2);
      R(x, '#2a1a10', 0, 57, TS, 7);
    };
    A.wood = tex(wood);
    A.plaque = tex((x) => {
      wood(x);
      R(x, '#7a5a1a', 17, 21, 30, 14);
      R(x, '#d8b04a', 18, 22, 28, 12);
      tinyC(x, 'THE', 32, 23, '#2a1a10');
      tinyC(x, 'BOARD', 32, 28, '#2a1a10');
    });
    const door = (open) => tex((x) => {
      wood(x);
      R(x, '#2a1a10', 6, 12, 52, 52);
      R(x, open ? '#8a5a32' : '#6a3e22', 8, 14, 23, 50);
      R(x, open ? '#8a5a32' : '#6a3e22', 33, 14, 23, 50);
      R(x, '#4a2a16', 11, 18, 17, 18);
      R(x, '#4a2a16', 36, 18, 17, 18);
      R(x, '#4a2a16', 11, 40, 17, 20);
      R(x, '#4a2a16', 36, 40, 17, 20);
      R(x, '#ffd84a', 28, 36, 2, 4);
      R(x, '#ffd84a', 34, 36, 2, 4);
      R(x, '#7a5a1a', 9, 2, 46, 9);
      R(x, '#d8b04a', 10, 3, 44, 7);
      tinyC(x, 'BOARDROOM', 32, 4, '#2a1a10');
      R(x, '#1a1a24', 11, 26, 42, 8);
      tinyC(x, open ? 'OPEN!' : 'LOCKED', 32, 28, open ? '#3dd16a' : '#ff5a5a');
      R(x, open ? '#3dd16a' : '#ff5a5a', 30, 44, 4, 3);
    });
    A.doorLocked = door(false);
    A.doorOpen = door(true);
    A.win = [0, 1].map((v) => tex((x) => {
      const g = x.createLinearGradient(0, 0, 0, TS);
      g.addColorStop(0, '#070a24');
      g.addColorStop(1, '#3a2466');
      x.fillStyle = g;
      x.fillRect(0, 0, TS, TS);
      for (let i = 0; i < 14; i++) R(x, '#c9d2ff', Math.floor(hash(i, v + 40) * TS), Math.floor(hash(v + 40, i) * 26), 1, 1);
      if (v) { R(x, '#f4f0d8', 46, 7, 7, 7); R(x, '#d8d0b0', 49, 9, 2, 2); }
      let bx = 0;
      let n = 0;
      while (bx < TS) {
        const bw = 6 + Math.floor(hash(n, v + 3) * 9);
        const top = 26 + Math.floor(hash(n, v + 8) * 26);
        R(x, n % 2 ? '#151229' : '#1d1838', bx, top, bw, TS - top);
        for (let wy = top + 2; wy < 56; wy += 3) {
          for (let wx = bx + 1; wx < bx + bw - 1; wx += 2) {
            if (hash(wx * 7 + wy, n + v) > 0.62) R(x, hash(wx, wy) > 0.8 ? '#7fe0ff' : '#ffd84a', wx, wy, 1, 1);
          }
        }
        bx += bw;
        n++;
      }
      R(x, '#3a3550', 0, 0, TS, 3);
      R(x, '#3a3550', 0, 0, 3, TS);
      R(x, '#3a3550', 61, 0, 3, TS);
      R(x, '#3a3550', 31, 0, 2, 56);
      R(x, '#3a3550', 0, 30, TS, 2);
      R(x, '#4a4368', 0, 56, TS, 8);
      R(x, '#6a6290', 0, 56, TS, 1);
    }));

    // Sprites (pixel size PX in the world)
    const skin = ['#e8b890', '#c98e64', '#f0c8a0'];
    A.board = [0, 1, 2].map((v) => sprite(30, 46, 2, (x, f) => {
      x.translate(1, 1);
      const hair = ['#9a9aa8', '#3a2a20', '#d8d0b0'][v];
      const s = skin[v];
      R(x, '#1e2034', 9, 32, 4, 9 - f);
      R(x, '#1e2034', 15, 32, 4, 8 + f);
      R(x, '#0c0c14', 8, 40 - f, 5, 2);
      R(x, '#0c0c14', 15, 39 + f, 5, 2);
      R(x, '#2f3550', 6, 14, 16, 19);
      R(x, '#3c4366', 6, 14, 16, 2);
      R(x, '#e8e8f0', 12, 14, 4, 6);
      R(x, '#c0303a', 13, 15, 2, 7);
      R(x, s, 10, 4, 8, 10);
      R(x, hair, 9, 1, 10, 4);
      R(x, hair, 9, 4, 1, 4);
      R(x, hair, 18, 4, 1, 4);
      R(x, '#1a1a24', 11, 7, 2, 1);
      R(x, '#1a1a24', 15, 7, 2, 1);
      R(x, '#1a1a24', 12, 8, 1, 1);
      R(x, '#1a1a24', 15, 8, 1, 1);
      R(x, '#7a3a3a', 12, 11, 4, 1);
      R(x, '#c0303a', 0, 18, 28, 15);
      R(x, '#f6f1e6', 1, 19, 26, 13);
      tinyC(x, "YOU'RE", 14, 20, '#c0303a');
      tinyC(x, 'FIRED', 14, 26, '#c0303a');
      R(x, s, -1, 23, 2, 3);
      R(x, s, 27, 23, 2, 3);
    }));
    A.recruit = [0, 1].map((v) => sprite(34, 46, 2, (x, f) => {
      x.translate(2, 1);
      const s = skin[v * 2];
      const hood = ['#2fb8a0', '#f08a3a'][v];
      R(x, '#3a5a9a', 9, 32, 4, 9 - f);
      R(x, '#3a5a9a', 16, 32, 4, 8 + f);
      R(x, '#ffffff', 8, 40 - f, 6, 2);
      R(x, '#ffffff', 16, 39 + f, 6, 2);
      R(x, hood, 6, 14, 18, 19);
      R(x, hood, 8, 12, 14, 3);
      if (f) { R(x, hood, 24, 6, 4, 10); R(x, s, 24, 2, 4, 4); } else { R(x, hood, 24, 8, 5, 8); R(x, s, 26, 4, 4, 4); }
      R(x, s, 10, 3, 10, 10);
      R(x, ['#6a4020', '#2a1a10'][v], 9, 0, 12, 4);
      R(x, ['#6a4020', '#2a1a10'][v], 9, 3, 2, 3);
      R(x, '#1a1a24', 12, 6, 2, 2);
      R(x, '#1a1a24', 16, 6, 2, 2);
      R(x, '#7a3a3a', 11, 9, 8, 1);
      R(x, '#ffffff', 12, 10, 6, 1);
      R(x, '#7a3a3a', 12, 11, 6, 1);
      R(x, '#ff9a9a', 10, 9, 1, 1);
      R(x, '#ff9a9a', 19, 9, 1, 1);
      R(x, '#3dd16a', -1, 18, 30, 15);
      R(x, '#f6fff0', 0, 19, 28, 13);
      tinyC(x, 'HIRING!', 14, 20, '#1e7a3a');
      tinyC(x, '$$$$$', 14, 26, '#3dd16a');
      R(x, s, -1, 23, 2, 3);
    }));
    A.page = sprite(24, 28, 2, (x, f) => {
      x.fillStyle = `rgba(255,216,74,${f ? 0.22 : 0.14})`;
      x.fillRect(0, 0, 24, 28);
      x.fillStyle = `rgba(255,216,74,${f ? 0.4 : 0.3})`;
      x.fillRect(2, 2, 20, 24);
      R(x, '#5a4a20', 4, 3, 16, 22);
      R(x, '#fffdf2', 5, 4, 14, 20);
      R(x, '#e6e0c8', 15, 4, 4, 4);
      R(x, '#5a4a20', 15, 4, 1, 4);
      R(x, '#5a4a20', 15, 7, 4, 1);
      for (let i = 0; i < 5; i++) R(x, '#9aa3b5', 7, 8 + i * 2, i === 4 ? 6 : 10, 1);
      R(x, '#3f7dff', 7, 20, 2, 1);
      R(x, '#3f7dff', 9, 19, 2, 1);
      R(x, '#3f7dff', 11, 20, 3, 1);
      R(x, '#3f7dff', 14, 19, 2, 1);
    }, false);
    A.token = { img: shadeSheet([SDW.art.S.token], 12, 11), fw: 12, fh: 11, n: 1 };
    A.coffee = sprite(14, 20, 2, (x, f) => {
      x.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 4; i++) x.fillRect(5 + ((i + f) % 2) * 2, 1 + i, 1, 1);
      R(x, '#3a3a3a', 2, 6, 10, 2);
      R(x, '#f4f4f4', 3, 8, 8, 10);
      R(x, '#8a5a2a', 3, 11, 8, 4);
      R(x, '#ffd84a', 6, 12, 2, 2);
    });
    A.pizza = sprite(26, 14, 1, (x) => {
      R(x, '#d8a868', 1, 3, 24, 9);
      R(x, '#e8c088', 1, 3, 24, 2);
      R(x, '#b88848', 1, 11, 24, 1);
      tinyC(x, 'PIZZA', 13, 5, '#c0303a');
    });
    A.desk = sprite(44, 30, 1, (x) => {
      R(x, '#22223a', 15, 2, 15, 12);
      R(x, '#7fe0ff', 16, 3, 13, 9);
      tiny(x, '>', 17, 4, '#1a4a8a');
      R(x, '#1a4a8a', 21, 8, 4, 1);
      R(x, '#ffd84a', 27, 3, 3, 3);
      R(x, '#22223a', 21, 14, 3, 2);
      R(x, '#8a6a4a', 1, 16, 42, 3);
      R(x, '#6a4e36', 1, 19, 42, 2);
      R(x, '#4a3a2a', 3, 21, 3, 8);
      R(x, '#4a3a2a', 38, 21, 3, 8);
      R(x, '#ffffff', 33, 12, 4, 4);
      R(x, '#e8e4dc', 5, 14, 8, 2);
    });
    A.plant = sprite(18, 30, 1, (x) => {
      R(x, '#b8643a', 4, 20, 10, 9);
      R(x, '#d07a4a', 3, 19, 12, 2);
      R(x, '#1f7a34', 8, 4, 2, 15);
      R(x, '#2f9a48', 3, 8, 5, 3);
      R(x, '#2f9a48', 10, 6, 5, 3);
      R(x, '#3dd16a', 2, 13, 6, 3);
      R(x, '#3dd16a', 10, 11, 6, 3);
      R(x, '#2f9a48', 6, 1, 6, 3);
      R(x, '#1f7a34', 5, 16, 8, 3);
    });
    A.table = sprite(44, 20, 1, (x) => {
      R(x, '#9aa3b5', 6, 2, 10, 6);
      R(x, '#c9f0ff', 7, 3, 8, 4);
      R(x, '#9aa3b5', 27, 2, 10, 6);
      R(x, '#ffe0a0', 28, 3, 8, 4);
      R(x, '#f2f3f8', 1, 8, 42, 3);
      R(x, '#c9cbd6', 1, 11, 42, 1);
      R(x, '#5a6378', 8, 12, 3, 7);
      R(x, '#5a6378', 33, 12, 3, 7);
    });
    A.reception = sprite(44, 26, 1, (x) => {
      R(x, '#ffd84a', 34, 1, 5, 3);
      R(x, '#c9c4e0', 1, 4, 42, 3);
      R(x, '#3a2f5a', 1, 7, 42, 18);
      R(x, '#6b4fd6', 1, 7, 42, 1);
      tinyC(x, 'WELCOME', 22, 10, '#ffd84a');
      tinyC(x, 'SIGN NDA', 22, 17, '#c4b5ff');
    });
    A.cooler = sprite(14, 32, 1, (x) => {
      R(x, '#7fc8ff', 3, 1, 8, 11);
      R(x, '#b8e4ff', 4, 2, 2, 8);
      R(x, '#e8eef4', 2, 12, 10, 18);
      R(x, '#ff5a5a', 4, 15, 2, 2);
      R(x, '#3f7dff', 8, 15, 2, 2);
      R(x, '#9aa3b5', 3, 22, 8, 1);
    });
    A.light = sprite(28, 5, 1, (x) => {
      R(x, '#c9d2df', 0, 0, 28, 5);
      R(x, '#ffffff', 1, 1, 26, 3);
    }, false);
    A.alert = sprite(10, 12, 1, (x) => {
      R(x, '#ffffff', 1, 1, 8, 9);
      R(x, '#ffffff', 3, 10, 2, 1);
      R(x, '#e03a3a', 4, 2, 2, 5);
      R(x, '#e03a3a', 4, 8, 2, 1);
    });
    return A;
  }
  let ART = null;

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DECOR = { // [art, solid radius]
    d: ['desk', 0.42], p: ['plant', 0.25], m: ['table', 0.45], q: ['reception', 0.45], w: ['cooler', 0.2],
  };

  SDW.modes = SDW.modes || {};
  SDW.modes.maze = class Maze {
    constructor(def, opts = {}) {
      if (!ART) ART = buildArt();
      this.def = def;
      this.power = opts.power || 0;
      this.state = 'intro';
      this.ownHud = true;
      this.t = 0;
      this.introT = 0;
      this.endT = 0;
      this.done = false;
      this.clock = 0;
      this.pages = 0;
      this.open = false;
      this.grid = [];
      this.zone = [];
      this.seen = new Uint8Array(MW * MH);
      this.items = [];
      this.decor = [];
      this.enemies = [];
      this.lights = [];
      this.parts = [];
      this.toasts = [];
      this.toast = null;
      this.news = 0;
      this.flash = 0;
      this.flashCol = '#ff3030';
      this.shake = 0;
      this.hurtT = 0;
      this.inv = 0;
      this.coffeeT = 0;
      this.pizzaT = 0;
      this.lockMsgT = 0;
      this.phoneT = 0;
      this.visited = {};
      this.zb = new Float32Array(W);
      this.miniDirty = true;
      [this.mini, this.miniCtx] = mk(MW * 3, MH * 3);

      for (let y = 0; y < MH; y++) {
        for (let x = 0; x < MW; x++) {
          const ch = MAP[y][x];
          const cx = x + 0.5;
          const cy = y + 0.5;
          this.grid.push(/[a-z@]/.test(ch) ? '.' : ch);
          const z = ZONES.find((r) => x >= r[1] && x <= r[3] && y >= r[2] && y <= r[4]);
          this.zone.push(z ? z[0] : 'hall');
          if (ch === '@') this.start = { x: cx, y: cy, a: -Math.PI / 2 };
          else if (ch === 'l') this.items.push({ kind: 'page', x: cx, y: cy, art: 'page', z: 0.22, bright: true });
          else if (ch === 't') this.items.push({ kind: 'token', x: cx, y: cy, art: 'token', z: 0.2 });
          else if (ch === 'c') this.items.push({ kind: 'coffee', x: cx, y: cy, art: 'coffee', z: 0 });
          else if (ch === 'z') this.items.push({ kind: 'pizza', x: cx, y: cy, art: 'pizza', z: 0 });
          else if (ch === 'b' || ch === 'r') {
            const n = this.enemies.length;
            this.enemies.push({
              kind: ch === 'b' ? 'board' : 'recruit', x: cx, y: cy, hx: cx, hy: cy, v: n % (ch === 'b' ? 3 : 2),
              leash: ch === 'b' ? 5 : 6, stun: 0, tgt: null, last: null, chase: false, walk: 0, talkT: 0, stuck: 0,
            });
          } else if (DECOR[ch]) {
            this.decor.push({ x: cx, y: cy, art: DECOR[ch][0], r: DECOR[ch][1], z: 0 });
          }
          if (this.grid[y * MW + x] === '.' && x % 3 === 1 && y % 3 === 1) this.lights.push({ x: cx, y: cy, art: 'light', z: 0.94, bright: true });
        }
      }
      this.px = this.start.x;
      this.py = this.start.y;
      this.a = this.start.a;
      this.vx = 0;
      this.vy = 0;
      this.kx = 0;
      this.ky = 0;
      this.turnV = 0;
      this.bobP = 0;
      this.bobAmt = 0;
      this.markSeen();
    }

    // -------------------------------------------------------- world --
    cell(x, y) {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return 'O';
      return this.grid[cy * MW + cx];
    }
    isOpen(cx, cy) { return cx >= 0 && cy >= 0 && cx < MW && cy < MH && this.grid[cy * MW + cx] === '.'; }

    // Move a circle through the grid one axis at a time (slides along walls).
    // Returns the wall char it bumped into, if any.
    move(o, dx, dy, r) {
      let hit = null;
      if (dx) {
        const nx = o.x + dx;
        const ex = nx + (dx > 0 ? r : -r);
        const c1 = this.cell(ex, o.y - r);
        const c2 = this.cell(ex, o.y + r);
        if (c1 === '.' && c2 === '.') o.x = nx;
        else {
          hit = c1 !== '.' ? c1 : c2;
          o.x = dx > 0 ? Math.floor(ex) - r - 0.001 : Math.floor(ex) + 1 + r + 0.001;
        }
      }
      if (dy) {
        const ny = o.y + dy;
        const ey = ny + (dy > 0 ? r : -r);
        const c1 = this.cell(o.x - r, ey);
        const c2 = this.cell(o.x + r, ey);
        if (c1 === '.' && c2 === '.') o.y = ny;
        else {
          hit = hit || (c1 !== '.' ? c1 : c2);
          o.y = dy > 0 ? Math.floor(ey) - r - 0.001 : Math.floor(ey) + 1 + r + 0.001;
        }
      }
      // Push out of solid furniture.
      for (const d of this.decor) {
        const ddx = o.x - d.x;
        const ddy = o.y - d.y;
        const dist = Math.hypot(ddx, ddy);
        const min = d.r + r;
        if (dist < min && dist > 0.0001) {
          const nx = d.x + (ddx / dist) * min;
          const ny = d.y + (ddy / dist) * min;
          if (this.cell(nx + Math.sign(ddx) * r, o.y) === '.') o.x = nx;
          if (this.cell(o.x, ny + Math.sign(ddy) * r) === '.') o.y = ny;
        }
      }
      return hit;
    }

    los(ax, ay, bx, by) {
      const d = Math.hypot(bx - ax, by - ay);
      const n = Math.ceil(d / 0.25);
      for (let i = 1; i < n; i++) if (this.cell(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n) !== '.') return false;
      return true;
    }

    markSeen() {
      const cx = Math.floor(this.px);
      const cy = Math.floor(this.py);
      for (let y = cy - 1; y <= cy + 1; y++) {
        for (let x = cx - 1; x <= cx + 1; x++) {
          if (x >= 0 && y >= 0 && x < MW && y < MH && !this.seen[y * MW + x]) { this.seen[y * MW + x] = 1; this.miniDirty = true; }
        }
      }
    }

    say(a, b, col = '#ffd84a', now = false) {
      const m = { a, b, col, t: 0 };
      if (now) { this.toasts.length = 0; this.toast = m; } else this.toasts.push(m);
    }

    burst(n, cols, x = W / 2, y = VH / 2 + 10, sp = 3) {
      for (let i = 0; i < n; i++) {
        const an = Math.random() * Math.PI * 2;
        const v = Math.random() * sp + 0.5;
        this.parts.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 1.5, life: 30 + Math.random() * 30, col: cols[i % cols.length], s: Math.random() < 0.3 ? 3 : 2 });
      }
    }

    // ------------------------------------------------------- update --
    update(inp) {
      this.t++;
      this.tickFx();
      if (this.state === 'intro') {
        this.introT++;
        const p = inp.pressed;
        if (this.introT > 30 && (p.jump || p.up || p.spark)) {
          this.state = 'play';
          au().seq([[76, 0.08], [83, 0.16]], 'square', 0.1);
          this.say('GO!', 'FIND THE 5 PAGES OF THE LETTER', '#3dd16a', true);
          this.visited.lobby = true;
        }
        return;
      }
      if (this.state !== 'play') {
        this.endT++;
        if (this.state === 'clear' && this.endT % 8 === 0 && this.endT < 200) this.burst(6, ['#ffd84a', '#7fe0ff', '#ff5a5a', '#3dd16a', '#ffffff'], Math.random() * W, -4, 2);
        if (this.endT >= 240 && !this.done) {
          this.done = true;
          if (this.state === 'clear') SDW.game.levelCleared(SDW.game.session.power);
          else SDW.game.playerDied(false);
        }
        return;
      }

      // Clock: Friday evening to Monday morning.
      const prevH = Math.floor(this.clock);
      this.clock += HPF;
      const left = HOURS - this.clock;
      if (Math.floor(this.clock) !== prevH && left < 8) au().tone(left < 3 ? 1500 : 1100, 0.04, { vol: 0.06 });
      while (this.news < NEWS.length && this.clock >= NEWS[this.news][0]) {
        const [, from, txt] = NEWS[this.news++];
        this.say(`PHONE: ${from}`, txt, '#7fe0ff');
        this.phoneT = 40;
        au().seq([[43, 0.09], [0, 0.05], [43, 0.09]], 'sawtooth', 0.06);
      }
      if (this.clock >= HOURS) { this.lose(); return; }

      this.movePlayer(inp);
      this.updateEnemies();
      this.pickups();
      this.markSeen();

      const z = this.zone[Math.floor(this.py) * MW + Math.floor(this.px)];
      if (ZONE_MSG[z] && !this.visited[z]) {
        this.visited[z] = true;
        const m = ZONE_MSG[z];
        this.say(m[0], z === 'board' && this.open ? 'THE DOOR IS OPEN! GO GO GO!' : m[1], '#c4b5ff');
      }
    }

    tickFx() {
      if (this.toast) this.toast.t++;
      if (this.toasts.length && (!this.toast || this.toast.t > 100)) this.toast = this.toasts.shift();
      else if (this.toast && this.toast.t > 210) this.toast = null;
      for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; }
      this.parts = this.parts.filter((p) => p.life > 0);
      if (this.flash > 0) this.flash--;
      if (this.shake > 0) this.shake--;
      if (this.hurtT > 0) this.hurtT--;
      if (this.inv > 0) this.inv--;
      if (this.coffeeT > 0) this.coffeeT--;
      if (this.pizzaT > 0) this.pizzaT--;
      if (this.lockMsgT > 0) this.lockMsgT--;
      if (this.phoneT > 0) this.phoneT--;
    }

    movePlayer(inp) {
      const h = inp.held;
      let turn = 0;
      let mv = 0;
      let st = 0;
      if (h.left) { if (h.spark) st -= 1; else turn -= 1; }
      if (h.right) { if (h.spark) st += 1; else turn += 1; }
      if (h.jump || h.up) mv += 1;
      if (h.down) mv -= 1;
      this.turnV += (turn * 0.048 - this.turnV) * 0.3;
      this.a += this.turnV;
      const sp = 0.055 * (this.coffeeT > 0 ? 1.45 : 1);
      const fx = Math.cos(this.a);
      const fy = Math.sin(this.a);
      const tx = (fx * mv - fy * st * 0.85) * sp * (mv < 0 && !st ? 0.7 : 1);
      const ty = (fy * mv + fx * st * 0.85) * sp * (mv < 0 && !st ? 0.7 : 1);
      this.vx += (tx - this.vx) * 0.25;
      this.vy += (ty - this.vy) * 0.25;
      this.kx *= 0.86;
      this.ky *= 0.86;
      const o = { x: this.px, y: this.py };
      const hit = this.move(o, this.vx + this.kx, this.vy + this.ky, 0.24);
      const moved = Math.hypot(o.x - this.px, o.y - this.py);
      this.px = o.x;
      this.py = o.y;
      if (hit === 'B') this.bumpDoor();
      // Head-bob and footsteps.
      this.bobAmt += ((moved > 0.01 ? 1 : 0) - this.bobAmt) * 0.15;
      const before = Math.floor(this.bobP / Math.PI);
      this.bobP += moved * 3.4;
      if (Math.floor(this.bobP / Math.PI) !== before) au().noise(0.05, { vol: 0.035, freq: 420, filter: 'lowpass' });
    }

    bumpDoor() {
      if (this.open) { this.win(); return; }
      if (this.lockMsgT > 0) return;
      this.lockMsgT = 120;
      au().play('bump');
      this.say('BOARDROOM: LOCKED', `NEED ALL 5 LETTER PAGES (${this.pages}/5)`, '#ff5a5a', true);
    }

    updateEnemies() {
      for (const e of this.enemies) {
        if (e.talkT > 0) e.talkT--;
        if (e.stun > 0) { e.stun--; continue; }
        const dx = this.px - e.x;
        const dy = this.py - e.y;
        const dist = Math.hypot(dx, dy);
        const nearHome = Math.hypot(this.px - e.hx, this.py - e.hy) < e.leash + 1.5;
        const was = e.chase;
        e.chase = this.inv <= 0 && dist < 5.5 && nearHome && this.los(e.x, e.y, this.px, this.py);
        if (e.chase && !was && e.talkT <= 0) {
          e.talkT = 600;
          if (e.kind === 'board') { this.say('BOARD MEMBER', 'WE NEED TO TALK. RIGHT NOW.', '#ff5a5a'); au().tone(330, 0.12, { type: 'sawtooth', vol: 0.08, slide: 220 }); } else { this.say('RECRUITER', 'HAVE YOU CONSIDERED... BIG TECH?', '#3dd16a'); au().seq([[76, 0.06], [83, 0.1]], 'triangle', 0.1); }
        }
        let mx = 0;
        let my = 0;
        const spd = e.kind === 'board' ? (e.chase ? 0.03 : 0.018) : (e.chase ? 0.036 : 0.02);
        if (e.chase) {
          mx = (dx / dist) * spd;
          my = (dy / dist) * spd;
          e.tgt = null;
        } else {
          if (!e.tgt || Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 0.06 || e.stuck > 40) {
            const cx = Math.floor(e.x);
            const cy = Math.floor(e.y);
            let opts = DIRS.filter(([ax, ay]) => this.isOpen(cx + ax, cy + ay) && Math.hypot(cx + ax + 0.5 - e.hx, cy + ay + 0.5 - e.hy) <= e.leash &&
              !this.decor.some((d) => Math.floor(d.x) === cx + ax && Math.floor(d.y) === cy + ay));
            const fwd = opts.filter(([ax, ay]) => !e.last || ax !== -e.last[0] || ay !== -e.last[1]);
            if (fwd.length) opts = fwd;
            if (e.stuck > 40 || !opts.length) { e.tgt = { x: cx + 0.5, y: cy + 0.5 }; e.last = null; } else {
              const d = opts[Math.floor(Math.random() * opts.length)];
              e.tgt = { x: cx + d[0] + 0.5, y: cy + d[1] + 0.5 };
              e.last = d;
            }
            e.stuck = 0;
          }
          const tx = e.tgt.x - e.x;
          const ty = e.tgt.y - e.y;
          const td = Math.hypot(tx, ty) || 1;
          mx = (tx / td) * Math.min(spd, td);
          my = (ty / td) * Math.min(spd, td);
        }
        const ox = e.x;
        const oy = e.y;
        this.move(e, mx, my, 0.22);
        const m = Math.hypot(e.x - ox, e.y - oy);
        e.walk += m;
        e.stuck = m < 0.004 ? e.stuck + 1 : 0;

        if (dist < 0.5 && this.inv <= 0) this.touch(e, dx / (dist || 1), dy / (dist || 1));
      }
    }

    touch(e, nx, ny) {
      if (e.kind === 'board') {
        if (this.pizzaT > 0) {
          e.stun = 120;
          this.inv = 40;
          this.kx = nx * 0.12;
          this.ky = ny * 0.12;
          au().play('stomp');
          this.say('UNFIREABLE!', 'PIZZA POWER BOUNCES THE BOARD', '#ffd84a', true);
          return;
        }
        this.clock += 3;
        this.inv = 100;
        e.stun = 110;
        this.hurtT = 50;
        this.flash = 24;
        this.flashCol = '#ff2a2a';
        this.shake = 16;
        this.kx = nx * 0.2;
        this.ky = ny * 0.2;
        this.say(FIRED[Math.floor(Math.random() * FIRED.length)], 'THE CLOCK JUMPS AHEAD 3 HOURS', '#ff5a5a', true);
        au().tone(180, 0.32, { type: 'sawtooth', slide: 60, vol: 0.15 });
        au().noise(0.15, { vol: 0.12, filter: 'lowpass', freq: 900 });
      } else {
        this.inv = 100;
        e.stun = 150;
        e.x = e.hx;
        e.y = e.hy;
        e.tgt = null;
        this.hurtT = 40;
        this.flash = 30;
        this.flashCol = '#ffffff';
        this.shake = 8;
        this.px = this.start.x;
        this.py = this.start.y;
        this.a = this.start.a;
        this.vx = this.vy = this.kx = this.ky = 0;
        this.say('YOU JOINED BIG TECH...', 'FOR 1 SECOND. BACK TO THE LOBBY!', '#3dd16a', true);
        au().seq([[72, 0.07], [76, 0.07], [79, 0.07], [84, 0.12], [0, 0.05], [60, 0.2]], 'triangle', 0.14);
      }
    }

    pickups() {
      for (const it of this.items) {
        if (it.got || Math.hypot(it.x - this.px, it.y - this.py) > 0.45) continue;
        it.got = true;
        if (it.kind === 'page') {
          this.pages++;
          SDW.game.addScore(1000);
          this.say(`LETTER PAGE ${this.pages}/5`, PAGE_TXT[this.pages - 1], '#ffd84a', true);
          this.burst(30, ['#fffdf2', '#ffd84a', '#ffffff', '#9b84ff']);
          this.flash = 10;
          this.flashCol = '#ffd84a';
          au().seq([[84, 0.06], [88, 0.06], [91, 0.06], [96, 0.16]], 'square', 0.1);
          if (this.pages === 5) {
            this.open = true;
            this.say('BOARDROOM UNLOCKED!', 'THE LETTER IS DONE. DELIVER IT!', '#3dd16a');
            setTimeout(() => au().seq([[60, 0.1], [64, 0.1], [67, 0.1], [72, 0.2], [67, 0.1], [72, 0.4]], 'square', 0.12), 450);
            this.miniDirty = true;
          }
        } else if (it.kind === 'token') {
          SDW.game.addTokens(1);
          this.burst(8, ['#ffd84a', '#fff2a0'], W / 2, VH / 2 + 20, 2);
        } else if (it.kind === 'coffee') {
          this.clock = Math.max(0, this.clock - 2);
          this.coffeeT = 300;
          SDW.game.addScore(200);
          this.say('COLD BREW!', '+2 HOURS AND SPEEDY LEGS', '#7fe0ff', true);
          this.burst(14, ['#8a5a2a', '#ffffff', '#7fe0ff']);
          au().tone(380, 0.22, { type: 'triangle', slide: 980, vol: 0.12 });
        } else if (it.kind === 'pizza') {
          this.clock = Math.max(0, this.clock - 1);
          this.pizzaT = 600;
          SDW.game.addScore(200);
          this.say('WEEKEND FUEL!', '+1 HOUR. UNFIREABLE FOR 10 SECONDS', '#ffd84a', true);
          this.burst(14, ['#d8a868', '#ff5a5a', '#ffd84a']);
          au().seq([[67, 0.06], [71, 0.06], [74, 0.06], [79, 0.14]], 'square', 0.1);
        }
      }
    }

    win() {
      if (this.state !== 'play') return;
      this.state = 'clear';
      this.endT = 0;
      this.px = 19.5;
      this.py = 5.7;
      this.a = -Math.PI / 2;
      this.bobAmt = 0;
      this.flash = 40;
      this.flashCol = '#ffffff';
      SDW.game.addScore(Math.floor(HOURS - this.clock) * 100);
      au().stopMusic();
      au().play('clear');
    }

    lose() {
      if (this.state !== 'play') return;
      this.clock = HOURS;
      this.state = 'lost';
      this.endT = 0;
      this.shake = 20;
      au().stopMusic();
      au().play('die');
    }

    // --------------------------------------------------------- draw --
    wallSheet(ch, cx, cy, face, zone) {
      const A = ART;
      switch (ch) {
        case 'O': return A.win[(cx * 3 + cy) & 1];
        case 'S': return A.rack[(Math.floor(this.t / 16) + cx * 2 + cy) % 3];
        case 'G': return A.glass;
        case 'E': return A.elev;
        case 'R': return hash(cx * 4 + face, cy) > 0.72 ? A.plaque : A.wood;
        case 'B': return this.open ? A.doorOpen : A.doorLocked;
        case 'P': return A.poster[Math.floor(hash(cx * 4 + face, cy + 17) * 5)];
        case 'H': return A.hq;
        case 'C': return A.ceo[(this.t >> 6) & 1];
        case 'T': return A.kombucha;
        case 'K': return A.tile;
      }
      const h = hash(cx * 4 + face, cy * 7 + 3);
      switch (zone) {
        case 'server': return A.metal[h > 0.72 ? 1 : 0];
        case 'kitchen': return A.tile;
        case 'lobby': return A.marble;
        case 'board': return A.wood;
        case 'safety': return h > 0.3 ? A.wb[Math.floor(h * 97) % 4] : A.office[0];
        case 'comms': return h > 0.35 ? A.poster[Math.floor(h * 97) % 5] : A.office[1];
      }
      if (h < 0.45) return A.office[h < 0.12 ? 1 : h < 0.2 ? 2 : 0];
      if (h < 0.68) return A.wb[Math.floor(h * 97) % 4];
      return A.poster[Math.floor(h * 89) % 5];
    }

    draw(ctx) {
      const shx = this.shake ? Math.round(SDW.rand(-1, 1) * Math.min(4, this.shake / 3)) : 0;
      const shy = this.shake ? Math.round(SDW.rand(-1, 1) * Math.min(4, this.shake / 3)) : 0;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, VH);
      ctx.clip();
      ctx.translate(shx, shy);
      this.render3D(ctx);
      ctx.restore();
      if (this.state === 'intro') { this.drawIntro(ctx); return; }
      this.drawWeapon(ctx);
      if (this.flash > 0) {
        ctx.globalAlpha = Math.min(0.6, this.flash / 40);
        R(ctx, this.flashCol, 0, 0, W, VH);
        ctx.globalAlpha = 1;
      }
      if (this.pizzaT > 0 && (this.pizzaT > 120 || (this.t >> 3) & 1)) {
        ctx.strokeStyle = 'rgba(255,216,74,0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, W - 2, VH - 2);
      }
      for (const p of this.parts) R(ctx, p.col, Math.round(p.x), Math.round(p.y), p.s, p.s);
      this.drawTopHud(ctx);
      this.drawStatus(ctx);
      if (this.state === 'clear' || this.state === 'lost') this.drawBanner(ctx);
    }

    render3D(ctx) {
      const hz = Math.round(VH / 2 + Math.sin(this.bobP * 2) * 1.6 * this.bobAmt);
      // Ceiling tiles fade into the dark; carpet below.
      let g = ctx.createLinearGradient(0, 0, 0, hz);
      g.addColorStop(0, '#3a3654');
      g.addColorStop(1, '#0c0a18');
      ctx.fillStyle = g;
      ctx.fillRect(0, -6, W, hz + 6);
      g = ctx.createLinearGradient(0, hz, 0, VH);
      g.addColorStop(0, '#0c0a18');
      g.addColorStop(1, '#4a3a5e');
      ctx.fillStyle = g;
      ctx.fillRect(0, hz, W, VH - hz + 6);

      const px = this.px;
      const py = this.py;
      const dirX = Math.cos(this.a);
      const dirY = Math.sin(this.a);
      const plX = -dirY * PL;
      const plY = dirX * PL;
      const glass = [];
      const zb = this.zb;
      for (let x = 0; x < W; x++) {
        const cam = (2 * x + 1) / W - 1;
        const rdx = dirX + plX * cam || 1e-9;
        const rdy = dirY + plY * cam || 1e-9;
        let mx = Math.floor(px);
        let my = Math.floor(py);
        const ddx = Math.abs(1 / rdx);
        const ddy = Math.abs(1 / rdy);
        const sx = rdx < 0 ? -1 : 1;
        const sy = rdy < 0 ? -1 : 1;
        let sdx = (rdx < 0 ? px - mx : mx + 1 - px) * ddx;
        let sdy = (rdy < 0 ? py - my : my + 1 - py) * ddy;
        let side = 0;
        let ch = 'O';
        let dist = 0;
        for (let n = 0; n < 64; n++) {
          if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
          if (mx < 0 || my < 0 || mx >= MW || my >= MH) { ch = 'O'; break; }
          const idx = my * MW + mx;
          ch = this.grid[idx];
          dist = side === 0 ? sdx - ddx : sdy - ddy;
          if (dist < 7 && !this.seen[idx]) { this.seen[idx] = 1; this.miniDirty = true; }
          if (ch === '.') continue;
          if (ch === 'G') {
            if (glass.length < 1200) glass.push(this.slice(x, mx, my, side, sx, sy, rdx, rdy, dist, ch, hz));
            continue;
          }
          break;
        }
        dist = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy);
        zb[x] = dist;
        const s = this.slice(x, mx, my, side, sx, sy, rdx, rdy, dist, ch, hz);
        this.blitSlice(ctx, s);
      }

      // Billboards: items, enemies, decor, lights; merged with glass by depth.
      const spr = [];
      const inv = 1 / (plX * dirY - dirX * plY);
      const add = (o, art, frame, z, bright) => {
        const dx = o.x - px;
        const dy = o.y - py;
        const ty = inv * (-plY * dx + plX * dy);
        if (ty < 0.12 || ty > 18) return;
        const tx = inv * (dirY * dx - dirX * dy);
        spr.push({ d: ty, sx: (W / 2) * (1 + tx / ty), art, frame, z, bright });
      };
      for (const l of this.lights) if (Math.abs(l.x - px) + Math.abs(l.y - py) > 1.4) add(l, ART.light, 0, l.z, true);
      for (const d of this.decor) add(d, ART[d.art], 0, 0, false);
      for (const it of this.items) {
        if (it.got) continue;
        const bob = it.kind === 'page' || it.kind === 'token' ? Math.sin(this.t * 0.08 + it.x) * 0.05 : 0;
        add(it, ART[it.art], it.kind === 'page' ? (this.t >> 4) & 1 : it.kind === 'coffee' ? (this.t >> 4) & 1 : 0, it.z + bob, it.bright);
      }
      for (const e of this.enemies) {
        const art = e.kind === 'board' ? ART.board[e.v] : ART.recruit[e.v];
        const fr = e.kind === 'recruit' ? (this.t >> 4) & 1 : Math.floor(e.walk * 5) & 1;
        add(e, art, fr, e.stun > 0 ? Math.abs(Math.sin(e.stun * 0.3)) * 0.06 : 0, false);
        if (e.chase) add(e, ART.alert, 0, 0.98 + Math.sin(this.t * 0.3) * 0.02, true);
      }
      spr.sort((a, b) => b.d - a.d);
      glass.sort((a, b) => b.d - a.d);
      let gi = 0;
      for (const s of spr) {
        while (gi < glass.length && glass[gi].d > s.d) this.blitSlice(ctx, glass[gi++]);
        this.drawSprite(ctx, s, hz);
      }
      while (gi < glass.length) this.blitSlice(ctx, glass[gi++]);
    }

    slice(x, mx, my, side, sx, sy, rdx, rdy, dist, ch, hz) {
      dist = Math.max(0.05, dist);
      let wx = side === 0 ? this.py + dist * rdy : this.px + dist * rdx;
      wx -= Math.floor(wx);
      let tx = Math.floor(wx * TS);
      if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) tx = TS - 1 - tx;
      const face = side * 2 + (side === 0 ? (sx > 0 ? 1 : 0) : (sy > 0 ? 1 : 0));
      const fx = side === 0 ? mx - sx : mx;
      const fy = side === 1 ? my - sy : my;
      const zone = this.zone[fy * MW + fx];
      const sheet = this.wallSheet(ch, mx, my, face, zone);
      const level = Math.min(NS - 1, Math.floor(dist * 0.8) + side);
      const lh = K / dist;
      return { x, d: dist, sheet, tx, level, top: hz - lh / 2, lh };
    }

    blitSlice(ctx, s) {
      let dy = s.top;
      let dh = s.lh;
      let sy = 0;
      let sh = TS;
      if (dy < 0) { const cut = -dy; sy = (cut / s.lh) * TS; sh -= sy; dh -= cut; dy = 0; }
      if (dy + dh > VH) { const cut = dy + dh - VH; sh -= (cut / s.lh) * TS; dh -= cut; }
      if (dh <= 0 || sh <= 0) return;
      ctx.drawImage(s.sheet, s.tx, s.level * TS + sy, 1, sh, s.x, dy, 1, dh);
    }

    drawSprite(ctx, s, hz) {
      const a = s.art;
      const sc = (K / s.d) * PX;
      const dw = a.fw * sc;
      const dh = a.fh * sc;
      const bottom = hz + ((0.5 - s.z) * K) / s.d;
      const top = bottom - dh;
      const left = s.sx - dw / 2;
      const c0 = Math.max(0, Math.floor(left));
      const c1 = Math.min(W, Math.ceil(left + dw));
      if (c1 <= c0) return;
      const level = s.bright ? 0 : Math.min(NS - 1, Math.floor(s.d * 0.8));
      const zb = this.zb;
      let run = -1;
      for (let c = c0; c <= c1; c++) {
        const vis = c < c1 && s.d < zb[c];
        if (vis && run < 0) run = c;
        else if (!vis && run >= 0) {
          const sx0 = Math.max(0, (run - left) / sc);
          const sx1 = Math.min(a.fw, (c - left) / sc);
          if (sx1 > sx0) ctx.drawImage(a.img, s.frame * a.fw + sx0, level * a.fh, sx1 - sx0, a.fh, left + sx0 * sc, top, (sx1 - sx0) * sc, dh);
          run = -1;
        }
      }
    }

    // Dario's hand holding his phone (the group chat never sleeps).
    drawWeapon(ctx) {
      if (this.state !== 'play') return;
      const bx = Math.round(Math.sin(this.bobP) * 3 * this.bobAmt);
      const by = Math.round(Math.abs(Math.cos(this.bobP)) * 3 * this.bobAmt);
      const buzz = this.phoneT > 0 ? Math.round(Math.sin(this.t * 2.5) * 1.5) : 0;
      const x = 272 + bx + buzz;
      const y = VH - 50 + by;
      R(ctx, '#140f20', x - 1, y - 1, 34, 54);
      R(ctx, '#1a1a24', x, y, 32, 52);
      R(ctx, '#3a3e4a', x + 1, y + 1, 30, 1);
      const lit = this.phoneT > 0;
      R(ctx, lit ? '#f4f8ff' : '#dfe6f2', x + 2, y + 4, 28, 40);
      R(ctx, '#6b4fd6', x + 2, y + 4, 28, 5);
      tiny(ctx, 'CHAT', x + 4, y + 4, '#ffffff');
      const n = this.news;
      for (let i = 0; i < 4; i++) {
        const k = n - 4 + i;
        if (k < 0) continue;
        const mine = hash(k, 3) > 0.6;
        const w = 10 + Math.floor(hash(k, 9) * 12);
        R(ctx, mine ? '#3dd16a' : (k === n - 1 && lit ? '#ffd84a' : '#9aa3b5'), mine ? x + 28 - w : x + 4, y + 12 + i * 8, w, 5);
      }
      // hand
      const sk = '#e8b890';
      const sd = '#c98e64';
      R(ctx, '#140f20', x - 7, y + 23, 12, 30);
      R(ctx, sk, x - 6, y + 24, 10, 30);
      R(ctx, sd, x - 6, y + 24, 2, 30);
      for (let i = 0; i < 3; i++) {
        R(ctx, '#140f20', x + 25, y + 21 + i * 7, 10, 7);
        R(ctx, sk, x + 26, y + 22 + i * 7, 8, 5);
        R(ctx, sd, x + 26, y + 26 + i * 7, 8, 1);
      }
      R(ctx, '#1d2a4a', x - 10, y + 40, 18, 14);
      R(ctx, '#2a3a60', x - 10, y + 40, 18, 2);
    }

    drawTopHud(ctx) {
      const g = SDW.game;
      // Clock
      const left = HOURS - this.clock;
      const col = left < 6 ? ((this.t >> 4) & 1 ? '#ff5a5a' : '#ffffff') : left < 14 ? '#ffb347' : '#ffffff';
      R(ctx, 'rgba(10,8,20,0.65)', 94, 2, 196, 20);
      R(ctx, '#6b4fd6', 94, 21, 196, 1);
      g.text(ctx, this.clockStr(), W / 2, 4, col, 'center', 16);
      // Toast
      const m = this.toast;
      if (m && m.t < 210 && this.state === 'play') {
        ctx.font = '8px "Press Start 2P", monospace';
        const w = Math.max(ctx.measureText(m.a).width, ctx.measureText(m.b || '').width) + 12;
        const a = m.t < 8 ? m.t / 8 : m.t > 195 ? (210 - m.t) / 15 : 1;
        ctx.globalAlpha = a;
        R(ctx, 'rgba(10,8,20,0.75)', Math.round(W / 2 - w / 2), 26, Math.round(w), m.b ? 24 : 13);
        g.text(ctx, m.a, W / 2, 28, m.col, 'center');
        if (m.b) g.text(ctx, m.b, W / 2, 38, '#ffffff', 'center');
        ctx.globalAlpha = 1;
      }
      this.drawCompass(ctx);
      this.drawMinimap(ctx);
      // Buff timers
      let bx = 6;
      if (this.coffeeT > 0) { this.buff(ctx, bx, ART.coffee, this.coffeeT / 300, '#7fe0ff'); bx += 22; }
      if (this.pizzaT > 0) this.buff(ctx, bx, ART.pizza, this.pizzaT / 600, '#ffd84a');
    }

    buff(ctx, x, art, f, col) {
      const sc = 14 / Math.max(art.fw, art.fh);
      R(ctx, 'rgba(10,8,20,0.6)', x, 50, 20, 22);
      ctx.drawImage(art.img, 0, 0, art.fw, art.fh, x + 10 - (art.fw * sc) / 2, 51, art.fw * sc, art.fh * sc);
      R(ctx, '#140f20', x + 2, 67, 16, 3);
      R(ctx, col, x + 2, 67, Math.ceil(16 * f), 3);
    }

    target() {
      if (this.open) return { x: 19.5, y: 3.5, label: 'DOOR' };
      let best = null;
      let bd = 1e9;
      for (const it of this.items) {
        if (it.kind !== 'page' || it.got) continue;
        const d = Math.hypot(it.x - this.px, it.y - this.py);
        if (d < bd) { bd = d; best = it; }
      }
      return best && { x: best.x, y: best.y, label: 'PAGE' };
    }

    drawCompass(ctx) {
      const tg = this.target();
      if (!tg) return;
      const cx = 22;
      const cy = 20;
      ctx.fillStyle = 'rgba(10,8,20,0.65)';
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.open ? '#3dd16a' : '#ffd84a';
      ctx.lineWidth = 1;
      ctx.stroke();
      const rel = Math.atan2(tg.y - this.py, tg.x - this.px) - this.a - Math.PI / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rel);
      ctx.fillStyle = this.open ? '#3dd16a' : '#ffd84a';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(7, 4);
      ctx.lineTo(0, 0);
      ctx.lineTo(-7, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      SDW.game.text(ctx, tg.label, cx, 39, this.open ? '#3dd16a' : '#ffd84a', 'center');
    }

    drawMinimap(ctx) {
      const m = this.miniCtx;
      if (this.miniDirty) {
        this.miniDirty = false;
        m.clearRect(0, 0, MW * 3, MH * 3);
        for (let y = 0; y < MH; y++) {
          for (let x = 0; x < MW; x++) {
            if (!this.seen[y * MW + x]) continue;
            const ch = this.grid[y * MW + x];
            const col = ch === '.' ? '#3a2f6a' : ch === 'G' ? '#7fe0ff' : ch === 'B' ? (this.open ? '#3dd16a' : '#ff5a5a') : ch === 'S' ? '#3dff8a' : ch === 'E' ? '#9aa3b5' : '#c4b5ff';
            R(m, col, x * 3, y * 3, 3, 3);
          }
        }
      }
      const x0 = W - 76;
      const y0 = VH - 77;
      R(ctx, 'rgba(10,8,20,0.7)', x0 - 2, y0 - 2, MW * 3 + 4, MH * 3 + 4);
      ctx.drawImage(this.mini, x0, y0);
      if ((this.t >> 4) & 1) {
        for (const it of this.items) {
          if (it.kind !== 'page' || it.got || !this.seen[Math.floor(it.y) * MW + Math.floor(it.x)]) continue;
          R(ctx, '#ffd84a', x0 + Math.floor(it.x) * 3 - 1, y0 + Math.floor(it.y) * 3 - 1, 5, 5);
        }
      }
      const ppx = x0 + this.px * 3;
      const ppy = y0 + this.py * 3;
      for (let i = 2; i <= 5; i++) R(ctx, '#ffffff', Math.round(ppx + Math.cos(this.a) * i), Math.round(ppy + Math.sin(this.a) * i), 1, 1);
      R(ctx, '#ffffff', Math.round(ppx) - 1, Math.round(ppy) - 1, 3, 3);
      R(ctx, '#ff5a3a', Math.round(ppx), Math.round(ppy), 1, 1);
    }

    clockStr() {
      const abs = 17 + Math.min(HOURS, this.clock);
      const day = ['FRI', 'SAT', 'SUN', 'MON'][Math.min(3, Math.floor(abs / 24))];
      const t10 = Math.floor(abs * 6 + 1e-6);
      const hr = Math.floor(t10 / 6) % 24;
      const mins = (t10 % 6) * 10;
      return `${day} ${hr % 12 || 12}:${mins ? mins : '00'} ${hr < 12 ? 'AM' : 'PM'}`;
    }

    drawStatus(ctx) {
      const g = SDW.game;
      const s = g.session;
      const y = VH;
      R(ctx, '#1d1533', 0, y, W, H - y);
      R(ctx, '#6b4fd6', 0, y, W, 2);
      const panel = (x, w) => { R(ctx, '#0f0a1e', x, y + 4, w, 26); R(ctx, '#3a2a7a', x, y + 29, w, 1); };
      panel(3, 118);
      panel(124, 44);
      panel(216, 76);
      panel(295, 86);
      // Letter
      g.text(ctx, 'LETTER', 8, y + 7, '#9b84ff');
      g.text(ctx, `${this.pages}/5`, 8, y + 15, this.open ? '#3dd16a' : '#ffd84a', 'left', 16);
      for (let i = 0; i < 5; i++) {
        const got = i < this.pages;
        const px = 62 + i * 11;
        R(ctx, '#140f20', px - 1, y + 8, 10, 14);
        R(ctx, got ? '#fffdf2' : '#3a2f5a', px, y + 9, 8, 12);
        if (got) for (let k = 0; k < 3; k++) R(ctx, '#9aa3b5', px + 1, y + 11 + k * 3, 6, 1);
      }
      // Hours left
      const left = Math.max(0, Math.ceil(HOURS - this.clock));
      g.text(ctx, 'HRS', 146, y + 7, '#9b84ff', 'center');
      g.text(ctx, String(left), 146, y + 17, left < 6 ? '#ff5a5a' : left < 14 ? '#ffb347' : '#ffffff', 'center');
      // Face
      R(ctx, '#140f20', 171, y + 2, 42, 30);
      R(ctx, this.hurtT > 0 ? '#5a1a2a' : '#2a2050', 172, y + 3, 40, 29);
      const pw = s.power;
      const d = g.darioSize(pw);
      const sc = 48 / d.w;
      let row = 0;
      let fr = Math.floor(this.t / 12) % 6;
      if (this.state === 'clear') { row = 3; fr = Math.floor(this.t / 8) % 4; } else if (this.state === 'lost') { row = 5; fr = 2; } else if (this.hurtT > 0) { row = 5; fr = 2; }
      ctx.save();
      ctx.beginPath();
      ctx.rect(172, y + 3, 40, 29);
      ctx.clip();
      if (g.images && g.images.dario) g.drawDario(ctx, pw, row, fr, 192 - 24, y + 3 - 1, sc);
      ctx.restore();
      // Tokens & lives
      ctx.drawImage(SDW.art.S.token, 221, y + 7, 10, 10);
      g.text(ctx, `x${String(s.tokens).padStart(2, '0')}`, 234, y + 8, '#ffd84a');
      g.text(ctx, `LIVES x${s.lives}`, 221, y + 19, '#ffffff');
      // Score
      g.text(ctx, 'SCORE', 300, y + 8, '#9b84ff');
      g.text(ctx, String(s.score).padStart(7, '0'), 300, y + 19, '#ffffff');
      if (SDW.audio.isMuted && SDW.audio.isMuted()) g.text(ctx, 'MUTED', W - 6, VH - 12, '#9aa3b5', 'right');
    }

    drawIntro(ctx) {
      const g = SDW.game;
      R(ctx, 'rgba(10,8,20,0.82)', 0, 0, W, H);
      R(ctx, '#6b4fd6', 12, 8, W - 24, 1);
      R(ctx, '#6b4fd6', 12, H - 9, W - 24, 1);
      g.bigText(ctx, 'THE WEEKEND', W / 2, 16, 16, '#ffd84a', '#3a1a5a');
      g.text(ctx, "THE NONPROFIT'S FOR-PROFIT HQ", W / 2, 38, '#7fe0ff', 'center');
      g.text(ctx, 'THE HYPE-MAN WAS FIRED ON FRIDAY.', W / 2, 56, '#ffffff', 'center');
      g.text(ctx, 'GET 5 PAGES OF THE LETTER SIGNED', W / 2, 67, '#ffffff', 'center');
      g.text(ctx, 'BEFORE MONDAY, THEN OPEN THE BOARDROOM.', W / 2, 78, '#ffffff', 'center');
      g.text(ctx, 'BOARD MEMBERS COST YOU 3 HOURS.', W / 2, 96, '#ff7a7a', 'center');
      g.text(ctx, 'RECRUITERS SEND YOU BACK TO THE LOBBY.', W / 2, 107, '#3dd16a', 'center');
      g.text(ctx, 'COFFEE AND PIZZA BUY YOU TIME.', W / 2, 118, '#ffd84a', 'center');
      R(ctx, 'rgba(107,79,214,0.25)', 24, 132, W - 48, 36);
      g.text(ctx, 'Z/UP WALK  ARROWS TURN  X+ARROWS STRAFE', W / 2, 137, '#c4b5ff', 'center');
      g.text(ctx, 'PHONE: JUMP WALK  ZAP+ARROWS STRAFE', W / 2, 149, '#c4b5ff', 'center');
      g.text(ctx, 'DOWN = BACK UP', W / 2, 159, '#9b84ff', 'center');
      // Dario peeking in from the side
      const pw = g.session.power;
      const d = g.darioSize(pw);
      if (g.images && g.images.dario) g.drawDario(ctx, pw, 3, Math.floor(this.t / 8) % 4, 30, 206 - d.h * 1.2, 1.2);
      if (this.introT > 30 && (this.t >> 5) % 2 === 0) g.text(ctx, 'PRESS JUMP TO START', W / 2, 186, '#ffd84a', 'center');
    }

    drawBanner(ctx) {
      const g = SDW.game;
      const won = this.state === 'clear';
      const a = Math.min(1, this.endT / 20);
      ctx.globalAlpha = a * 0.8;
      R(ctx, won ? '#1d1533' : '#2a0a14', 0, 40, W, 120);
      ctx.globalAlpha = 1;
      if (won) {
        g.bigText(ctx, 'THE HYPE-MAN IS BACK!', W / 2, 54, 16, '#ffd84a', '#3a1a5a');
        g.text(ctx, 'NOTHING CHANGED. EVERYONE WENT HOME.', W / 2, 80, '#ffffff', 'center');
        g.text(ctx, `TIME BONUS ${Math.floor(HOURS - this.clock)} HRS`, W / 2, 132, '#7fe0ff', 'center');
      } else {
        g.bigText(ctx, "IT'S MONDAY.", W / 2, 52, 16, '#ff5a5a', '#2a0a14');
        g.bigText(ctx, 'EVERYONE JOINED', W / 2, 76, 16, '#ffffff', '#2a0a14');
        g.bigText(ctx, 'BIG TECH.', W / 2, 98, 16, '#ffffff', '#2a0a14');
      }
      const pw = g.session.power;
      const d = g.darioSize(pw);
      if (g.images && g.images.dario) {
        const row = won ? 3 : 5;
        const fr = won ? Math.floor(this.t / 8) % 4 : Math.min(7, Math.floor(this.endT / 10));
        g.drawDario(ctx, pw, row, fr, W / 2 - d.w * 0.75, (won ? 128 : 156) - d.h * 1.5, 1.5);
      }
      for (const p of this.parts) R(ctx, p.col, Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
  };
})();
