'use strict';
// Rack Stack: a falling-blade puzzle. Slot GPU blades into the server rack to
// bring the cooling online and unlock the door in the Data Center Depths.
// World hands over the whole screen: update(inp) at 60 Hz, draw(ctx) per frame.
(() => {
  const W = SDW.W;
  const H = SDW.H;
  const R = (...a) => SDW.art.R(...a);
  const text = (...a) => SDW.game.text(...a);
  const tone = (...a) => SDW.audio.tone(...a);
  const noise = (...a) => SDW.audio.noise(...a);
  const seq = (...a) => SDW.audio.seq(...a);

  const COLS = 8;
  const ROWS = 14;
  const C = 12;           // cell size
  const BX = 112;         // board origin
  const BY = 30;
  const DAS = 10;         // auto-repeat delay
  const ARR = 3;          // auto-repeat rate
  const LOCK = 30;        // lock delay
  const CLEAR_T = 24;     // line clear animation length

  // ------------------------------------------------------------ pieces --
  // Seven 4-cell shapes; `cells` order matters (it picks each cell's hardware).
  const TYPES = [
    { name: 'H-ONE-HUNDRED-ISH', tag: 'NOW WITH MORE VRAM', n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]],
      pcb: true, body: '#2f8a4a', hi: '#56b86a', lo: '#1d5a32', acc: '#ffd84a', led: '#7fe0ff', kinds: ['fan', 'fins', 'fins', 'fan'] },
    { name: 'THE BRICK (8U)', tag: 'HEAVY. VERY HEAVY.', n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]],
      pcb: false, body: '#4a5266', hi: '#6f7a92', lo: '#2c3242', acc: '#ff5a5a', led: '#ffb347', kinds: ['vent', 'vent', 'vent', 'vent'] },
    { name: 'TENSOR T', tag: 'MATMULS ALL DAY', n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]],
      pcb: false, body: '#3a3f58', hi: '#5d6488', lo: '#24283a', acc: '#7fe0ff', led: '#7fe0ff', kinds: ['fan', 'chip', 'chip', 'chip'] },
    { name: 'SKETCHY S', tag: 'FELL OFF A TRUCK', n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]],
      pcb: true, body: '#5a7a2e', hi: '#82a446', lo: '#3a5220', acc: '#ff9a3a', led: '#ff9a3a', kinds: ['fan', 'chip', 'fins', 'fan'] },
    { name: 'ZERO-SHOT Z', tag: 'NEVER SAW A ROW', n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]],
      pcb: true, body: '#2a6e6a', hi: '#46a39c', lo: '#1a4744', acc: '#ff6ad5', led: '#ff6ad5', kinds: ['fins', 'fan', 'chip', 'fins'] },
    { name: 'JBOD J', tag: 'JUST A BOX OF DISKS', n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]],
      pcb: false, body: '#55505e', hi: '#7c7588', lo: '#35313d', acc: '#c6f05a', led: '#c6f05a', kinds: ['disk', 'disk', 'disk', 'disk'] },
    { name: 'LIQUID-COOLED L', tag: 'SLIGHTLY LEAKY', n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]],
      pcb: false, body: '#3c4a5e', hi: '#5c7090', lo: '#253040', acc: '#4a8cff', led: '#4a8cff', kinds: ['fan', 'tube', 'tube', 'tube'] },
  ];
  // Precompute the four rotations (clockwise) of every shape.
  for (const tp of TYPES) {
    tp.rots = [tp.cells];
    for (let r = 1; r < 4; r++) tp.rots.push(tp.rots[r - 1].map(([x, y]) => [tp.n - 1 - y, x]));
  }
  const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-2, 0], [2, 0]];

  const TICKER = [
    'RACK 94% FULL OF IDLE GPUS', 'POWER BILL: YES', 'JUST ONE MORE NUCLEAR PLANT', 'TEMPS: SPICY',
    'LOSS: GOING DOWN (HOPEFULLY)', 'FANS AT 110%', 'COOLANT: MOSTLY COLD BREW', 'GPU UTILIZATION: 3%',
    'HEAT REUSE PROGRAM: TOASTING BAGELS', 'SCALING LAWS STILL SCALING', 'BENCHMARKS: VIBES ONLY',
    'NEW CLUSTER VISIBLE FROM SPACE', 'CONTEXT WINDOW: AJAR', 'WATER COOLER GOSSIP NOW LITERAL',
  ].join('   +++   ') + '   +++   ';

  const RETRY = [
    'HAVE YOU TRIED MORE COMPUTE?', 'SCALING LAWS SAY: AGAIN', 'TURNED IT OFF AND ON AGAIN',
    'HAVE YOU TRIED MORE COMPUTE?', 'UNDERCLOCKED FOR SAFETY', 'JUST ONE MORE RUN',
  ];
  const IDLE_QUIPS = [
    ['NEEDS MORE', 'GPUS'], ['SHIP IT!'], ['ALIGN THE', 'BLADES'], ['IS IT HOT', 'IN HERE?'], ['FLOPS GO', 'BRRR'],
  ];
  const CLEAR_QUIPS = [null, [['COOLER!'], ['NICE ROW!'], ['+1 FAN']], [['DOUBLE', 'CHILL!']], [['TRIPLE', 'FREEZE!']], [['FOUR ROWS!', 'ICE COLD']]];
  const CLEAR_WORDS = [null, 'COOLED', 'DOUBLE CHILL', 'TRIPLE FREEZE', 'MEGA COOL'];

  // ---------------------------------------------------------- pixel art --
  // 3x5 digits for the rack-unit labels.
  const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
    '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
  function digits(ctx, str, x, y, col) {
    for (const ch of str) {
      const d = DIG[+ch];
      for (let i = 0; i < 15; i++) if (d[i] === '1') R(ctx, col, x + (i % 3), y + Math.floor(i / 3), 1, 1);
      x += 4;
    }
  }

  let ART = null;
  function buildArt() {
    const mk = SDW.makeCanvas;
    const cells = TYPES.map((tp) => {
      const out = {};
      for (const kind of ['fan', 'fins', 'chip', 'vent', 'disk', 'tube']) {
        out[kind] = [0, 1].map((f) => {
          const [c, x] = mk(C, C);
          const r = (col, a, b, w, h) => R(x, col, a, b, w, h);
          r('#07080c', 0, 0, C, C);
          r(tp.lo, 1, 1, 10, 10);
          r(tp.body, 1, 1, 9, 9);
          r(tp.hi, 1, 1, 9, 1);
          r(tp.hi, 1, 1, 1, 9);
          if (tp.pcb) for (let i = 1; i < 11; i += 2) r('#d9b24a', i, 10, 1, 1); // edge connector
          else r(tp.acc, 1, 2, 1, 7); // metal: accent trim
          if (kind === 'fan') {
            r('#0d0f15', 4, 2, 4, 1); r('#0d0f15', 3, 3, 6, 1); r('#0d0f15', 2, 4, 8, 4);
            r('#0d0f15', 3, 8, 6, 1); r('#0d0f15', 4, 9, 4, 1);
            r('#1c2029', 4, 3, 4, 1); r('#1c2029', 3, 4, 6, 4); r('#1c2029', 4, 8, 4, 1);
            const bl = '#a7b0c4';
            if (f === 0) { r(bl, 5, 3, 2, 2); r(bl, 5, 7, 2, 2); r(bl, 3, 5, 2, 2); r(bl, 7, 5, 2, 2); }
            else { r(bl, 3, 3, 2, 2); r(bl, 7, 3, 2, 2); r(bl, 3, 7, 2, 2); r(bl, 7, 7, 2, 2); }
            r(tp.acc, 5, 5, 2, 2);
          } else if (kind === 'fins') {
            for (let i = 0; i < 4; i++) { r('#c4ccd9', 2 + i * 2, 2, 1, 8); r('#2a2f3a', 3 + i * 2, 2, 1, 8); }
          } else if (kind === 'chip') {
            r('#c9a64a', 4, 2, 4, 8); r('#c9a64a', 2, 4, 8, 4);
            r('#15171d', 3, 3, 6, 6);
            r('#3a3f4c', 4, 4, 2, 2);
            r(tp.acc, 7, 7, 1, 1);
          } else if (kind === 'vent') {
            for (let i = 0; i < 3; i++) { r('#0d0f15', 2, 2 + i * 2, 8, 1); r(tp.hi, 2, 3 + i * 2, 8, 1); }
            r('#9aa3b5', 3, 8, 6, 1); r('#07080c', 3, 9, 6, 1);
            r(tp.acc, 2, 8, 1, 1); r(tp.acc, 9, 8, 1, 1);
          } else if (kind === 'disk') {
            r('#1a1d26', 2, 2, 8, 3); r(tp.hi, 2, 5, 8, 1);
            r('#1a1d26', 2, 6, 8, 3); r(tp.hi, 2, 9, 8, 1);
            r(tp.acc, 8, 3, 1, 1); r(tp.acc, 8, 7, 1, 1);
          } else if (kind === 'tube') {
            r('#9aa3b5', 2, 3, 1, 6); r('#9aa3b5', 9, 3, 1, 6);
            r('#0d0f15', 3, 4, 6, 4);
            r(tp.acc, 3, 5, 6, 2);
            r('#cfe6ff', 3 + f * 3, 5, 2, 1); // bubbles drifting through the pipe
          }
          return c;
        });
      }
      return out;
    });

    // Background: dim aisle of far-away racks.
    const [bg, b] = mk(W, H);
    R(b, '#0b0916', 0, 0, W, H);
    for (let y = 0; y < H; y += 2) R(b, y % 4 ? '#0d0b1a' : '#0b0916', 0, y, W, 1);
    for (let i = 0; i < 16; i++) {
      const x = i * 26 - 6;
      R(b, '#121022', x, 22, 22, 184);
      R(b, '#17142b', x + 1, 23, 20, 182);
      for (let y = 26; y < 200; y += 6) R(b, '#100e1e', x + 3, y, 16, 3);
    }
    R(b, '#0a0812', 0, 204, W, 10);
    for (let x = 0; x < W; x += 16) R(b, '#151226', x, 205, 14, 1);

    // The rack cabinet around the board.
    const [rk, k] = mk(124, 194);
    const ox = BX - 12;
    const oy = BY - 12;
    R(k, '#07080c', 0, 0, 124, 194);
    R(k, '#2a3040', 1, 1, 122, 192);
    R(k, '#3a4256', 1, 1, 122, 1);
    // top cap with vent slots
    R(k, '#1d2230', 3, 3, 118, 8);
    for (let x = 6; x < 70; x += 4) R(k, '#0b0d14', x, 5, 2, 4);
    // rails
    for (const rx of [1, 108]) {
      R(k, '#07080c', rx, 11, 15, 170);
      R(k, '#5a6378', rx + 1, 12, 13, 168);
      R(k, '#7f8aa3', rx + 1, 12, 1, 168);
      R(k, '#3a4256', rx + 13, 12, 1, 168);
    }
    // interior
    const ix = BX - ox;
    const iy = BY - oy;
    R(k, '#0f121a', ix, iy, COLS * C, ROWS * C);
    for (let y = 0; y < ROWS * C; y += 3) for (let x = (y / 3) % 2 ? 1 : 3; x < COLS * C; x += 4) R(k, '#141824', ix + x, iy + y, 1, 1);
    for (let r = 0; r < ROWS; r++) {
      const y = iy + r * C;
      R(k, '#191e2b', ix, y + C - 1, COLS * C, 1);
      const u = String(ROWS - r).padStart(2, '0');
      digits(k, u, 2, y + 4, '#d6dbe6');
      // cage-nut holes and screws
      R(k, '#0b0d14', 9, y + 1, 2, 2); R(k, '#0b0d14', 9, y + 9, 2, 2);
      R(k, '#0b0d14', 110, y + 1, 2, 2); R(k, '#0b0d14', 110, y + 9, 2, 2);
      if (r % 3 === 1) {
        for (const sx of [115]) {
          R(k, '#2c3242', sx - 1, y + 4, 5, 5);
          R(k, '#b8c2d6', sx, y + 5, 3, 3);
          R(k, '#4a5266', sx + 1, y + 5, 1, 3);
        }
      }
    }
    // plinth
    R(k, '#1d2230', 3, 182, 118, 10);
    for (let x = 8; x < 116; x += 6) R(k, '#0b0d14', x, 185, 3, 4);
    R(k, '#07080c', 6, 192, 12, 2); R(k, '#07080c', 106, 192, 12, 2);
    ART = { cells, bg, rack: rk };
  }

  // ------------------------------------------------------------- mode --
  SDW.mini = SDW.mini || {};
  SDW.mini.rackstack = class RackStack {
    constructor(opts = {}) {
      if (!ART) buildArt();
      this.goal = opts.lines || 4;
      this.result = null;
      this.finished = false;
      this.music = 'stack';
      this.t = 0;
      this.tries = 1;
      this.score = 0;
      this.fx = [];
      this.pops = [];
      this.shake = 0;
      this.flash = 0;
      this.coolShown = 0;
      this.bubble = null;
      this.cheer = 0;
      this.squat = 0;
      this.nextQuip = 420;
      this.resetBoard();
      this.setPhase('intro');
      this.say(["LET'S", 'STACK!'], 150);
    }

    resetBoard() {
      this.grid = [];
      for (let r = 0; r < ROWS; r++) this.grid.push(new Array(COLS).fill(null));
      this.lines = 0;
      this.bag = [];
      this.cur = null;
      this.next = this.draw7(true);
      // Each failed attempt slows gravity a little: "underclocked for safety".
      this.baseGrav = Math.round(48 * Math.pow(1.15, this.tries - 1));
    }

    setPhase(p) {
      this.phase = p;
      this.pt = 0;
    }

    // 7-bag randomizer; the very first piece is never an S or Z.
    draw7(first) {
      if (!this.bag.length) {
        this.bag = [0, 1, 2, 3, 4, 5, 6];
        for (let i = 6; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
        if (first) while (this.bag[0] === 3 || this.bag[0] === 4) this.bag.push(this.bag.shift());
      }
      return this.bag.shift();
    }

    get gravity() { return Math.max(14, this.baseGrav - this.lines * 4); }

    say(lines, time = 110) { this.bubble = { lines, t: time, age: 0 }; }

    // -------------------------------------------------------- board --
    cellsOf(p, dx = 0, dy = 0, dr = 0) {
      const tp = TYPES[p.k];
      return tp.rots[(p.r + dr) & 3].map(([x, y]) => [p.x + x + dx, p.y + y + dy]);
    }

    fits(p, dx = 0, dy = 0, dr = 0) {
      for (const [x, y] of this.cellsOf(p, dx, dy, dr)) {
        if (x < 0 || x >= COLS || y >= ROWS) return false;
        if (y >= 0 && this.grid[y][x]) return false;
      }
      return true;
    }

    spawn() {
      const k = this.next;
      this.next = this.draw7();
      const tp = TYPES[k];
      const minY = Math.min(...tp.rots[0].map((c) => c[1]));
      this.cur = { k, r: 0, x: Math.floor((COLS - tp.n) / 2), y: -minY, ph: Math.floor(Math.random() * 8) };
      this.grav = 0;
      this.lockT = 0;
      this.resets = 0;
      this.rotPop = 0;
      if (!this.fits(this.cur)) this.overheat();
    }

    move(dx) {
      if (!this.fits(this.cur, dx, 0)) return false;
      this.cur.x += dx;
      this.touched();
      tone(520, 0.025, { vol: 0.03 });
      return true;
    }

    rotate() {
      for (const [kx, ky] of KICKS) {
        if (this.fits(this.cur, kx, ky, 1)) {
          this.cur.x += kx;
          this.cur.y += ky;
          this.cur.r = (this.cur.r + 1) & 3;
          this.rotPop = 6;
          this.touched();
          tone(660, 0.05, { slide: 990, vol: 0.05 });
          return;
        }
      }
      tone(150, 0.05, { type: 'triangle', vol: 0.1 });
    }

    // Successful moves on the ground buy a bit more lock time (limited).
    touched() {
      if (!this.fits(this.cur, 0, 1) && this.resets < 15) { this.lockT = 0; this.resets++; }
    }

    dropDist() {
      let d = 0;
      while (this.fits(this.cur, 0, d + 1)) d++;
      return d;
    }

    hardDrop() {
      const d = this.dropDist();
      this.cur.y += d;
      this.addScore(d * 2);
      for (const [x, y] of this.cellsOf(this.cur)) {
        for (let i = 0; i < 2; i++) {
          this.fx.push({ kind: 'dust', x: BX + x * C + SDW.rand(0, C), y: BY + y * C + C, vx: SDW.rand(-1, 1), vy: SDW.rand(-1.4, -0.4), g: 0.05, life: 18, color: '#c4ccd9' });
        }
        // speed streaks above the landed piece
        if (d > 1) this.fx.push({ kind: 'streak', x: BX + x * C + 5, y: BY + (y - Math.min(d, 4)) * C, h: Math.min(d, 4) * C, life: 8 });
      }
      this.shake = Math.max(this.shake, 4);
      this.squat = 10;
      tone(240, 0.12, { slide: 60, type: 'triangle', vol: 0.2 });
      noise(0.1, { vol: 0.1, filter: 'lowpass', freq: 900 });
      if (Math.random() < 0.15) this.say(['YEET!'], 50);
      this.lock(true);
    }

    lock(hard) {
      const tp = TYPES[this.cur.k];
      let above = false;
      this.cellsOf(this.cur).forEach(([x, y], i) => {
        if (y < 0) { above = true; return; }
        this.grid[y][x] = { k: this.cur.k, kind: tp.kinds[i], ph: (this.cur.ph + i * 3) & 7, lt: this.t };
      });
      if (!hard) {
        tone(160, 0.07, { type: 'triangle', vol: 0.15, slide: 90 });
        noise(0.04, { vol: 0.05, filter: 'lowpass', freq: 1200 });
      }
      this.cur = null;
      if (above) { this.overheat(); return; }
      const full = [];
      for (let r = 0; r < ROWS; r++) if (this.grid[r].every((c) => c)) full.push(r);
      if (full.length) this.startClear(full);
      else this.spawn();
    }

    startClear(rows) {
      const n = rows.length;
      this.clearRows = rows;
      this.gone = rows.map(() => new Array(COLS).fill(false));
      this.setPhase('clear');
      this.lines = Math.min(this.goal, this.lines + n);
      this.flash = 6;
      this.shake = Math.max(this.shake, 4 + n * 2);
      this.cheer = 50;
      const pts = 100 * n * n;
      this.addScore(pts);
      SDW.game.addTokens(n);
      const my = BY + (rows[0] + n / 2) * C;
      this.pops.push({ str: `+${pts}`, x: BX + 48, y: my - 10, life: 70, color: '#ffffff' });
      this.pops.push({ str: CLEAR_WORDS[n], x: BX + 48, y: my + 2, life: 70, color: '#7fe0ff' });
      const q = CLEAR_QUIPS[n];
      this.say(q[Math.floor(Math.random() * q.length)], 90);
      const notes = [[72, 0.05], [76, 0.05], [79, 0.05], [84, 0.05], [88, 0.05], [91, 0.12]].slice(0, 2 + n);
      notes.push([notes[notes.length - 1][0] + 5, 0.15]);
      seq(notes, 'square', 0.1);
      noise(0.35, { vol: 0.08, filter: 'highpass', freq: 3000 });
    }

    collapse() {
      const idx = [];
      for (let r = 0; r < ROWS; r++) if (!this.clearRows.includes(r)) idx.push(r);
      const n = ROWS - idx.length;
      this.grid = this.grid.filter((_, r) => !this.clearRows.includes(r));
      while (this.grid.length < ROWS) this.grid.unshift(new Array(COLS).fill(null));
      // Cells above the cleared rows slide down instead of teleporting.
      const drop = [];
      for (let r = 0; r < ROWS; r++) drop.push(r < n ? 0 : r - idx[r - n]);
      this.slide = { drop, t: 8 };
      this.clearRows = null;
      tone(110, 0.08, { type: 'triangle', vol: 0.14 });
    }

    overheat() {
      this.cur = null;
      this.setPhase('overheat');
      this.tries++;
      this.shake = 30;
      this.flash = 0;
      this.say(["IT'S FINE.", "IT'S FINE."], 160);
      tone(880, 0.7, { type: 'sawtooth', slide: 110, vol: 0.1 });
      noise(0.6, { vol: 0.15, filter: 'lowpass', freq: 600 });
      seq([[0, 0.25], [81, 0.1], [0, 0.06], [81, 0.1], [0, 0.06], [81, 0.1]], 'square', 0.08);
    }

    win() {
      this.result = 'win';
      this.setPhase('win');
      this.cheer = 0;
      this.addScore(1000);
      this.say(["DOOR'S", 'OPEN!'], 200);
      seq([[72, 0.08], [76, 0.08], [79, 0.08], [84, 0.08], [79, 0.08], [84, 0.08], [88, 0.35]], 'square', 0.12);
    }

    addScore(n) {
      if (!n) return;
      this.score += n;
      SDW.game.addScore(n);
    }

    // stack height in rows (0 = empty)
    height() {
      for (let r = 0; r < ROWS; r++) if (this.grid[r].some((c) => c)) return ROWS - r;
      return 0;
    }

    // ------------------------------------------------------- update --
    update(inp) {
      this.t++;
      this.pt++;
      if (this.shake > 0) this.shake--;
      if (this.flash > 0) this.flash--;
      if (this.cheer > 0) this.cheer--;
      if (this.squat > 0) this.squat--;
      if (this.rotPop > 0) this.rotPop--;
      if (this.slide && --this.slide.t <= 0) this.slide = null;
      this.coolShown += (this.lines / this.goal - this.coolShown) * 0.08;
      if (this.bubble) { this.bubble.age++; if (--this.bubble.t <= 0) this.bubble = null; }

      switch (this.phase) {
        case 'intro':
          if (this.pt >= 100 || (this.pt > 30 && (inp.pressed.jump || inp.pressed.spark))) {
            this.setPhase('play');
            seq([[72, 0.06], [79, 0.1]], 'square', 0.1);
            this.hDir = 0;
            this.spawn();
          }
          break;
        case 'play': this.updatePlay(inp); break;
        case 'clear':
          this.updateClear();
          if (this.pt === CLEAR_T) {
            this.collapse();
            if (this.lines >= this.goal) this.win();
            else { this.setPhase('play'); this.spawn(); }
          }
          break;
        case 'overheat':
          if (this.t % 3 === 0) {
            const x = BX + SDW.rand(0, COLS * C);
            const top = BY + (ROWS - this.height()) * C;
            this.fx.push({ kind: 'smoke', x, y: SDW.rand(top, BY + ROWS * C), vx: SDW.rand(-0.3, 0.3), vy: SDW.rand(-1.2, -0.5), life: 50, s: 3 });
            if (this.pt < 60) this.fx.push({ kind: 'sq', x, y: SDW.rand(top, BY + ROWS * C), vx: SDW.rand(-2, 2), vy: SDW.rand(-3, -1), g: 0.15, life: 30, color: Math.random() < 0.5 ? '#ff5a5a' : '#ffb347', s: 2 });
          }
          if (this.pt === 110) {
            this.resetBoard();
            this.setPhase('reboot');
            tone(200, 0.5, { slide: 900, type: 'triangle', vol: 0.1 });
          }
          break;
        case 'reboot':
          if (this.pt === 60) {
            this.setPhase('play');
            this.hDir = 0;
            this.say(this.tries > 2 ? ['UNDER-', 'CLOCKED!'] : ['ROUND', 'TWO!'], 90);
            this.spawn();
          }
          break;
        case 'win':
          if (this.t % 2 === 0) {
            this.fx.push({ kind: 'snow', x: SDW.rand(0, W), y: -4, vx: 0, vy: SDW.rand(0.5, 1.2), life: 240, ph: Math.random() * 6 });
          }
          if (this.pt === 20 || this.pt === 45) {
            for (let i = 0; i < 26; i++) {
              const a = Math.random() * Math.PI * 2;
              const sp = SDW.rand(1, 3.5);
              this.fx.push({ kind: 'sq', x: BX + 48, y: 90, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, g: 0.08, life: 60, color: ['#7fe0ff', '#ffd84a', '#ffffff', '#3dd16a'][i % 4], s: 2 });
            }
          }
          if (this.pt === 60) {
            tone(180, 0.1, { type: 'triangle', vol: 0.2 });
            noise(0.08, { vol: 0.1, filter: 'lowpass', freq: 800 });
            SDW.audio.play('checkpoint');
          }
          if (this.pt >= 130) this.finished = true;
          break;
      }

      for (const f of this.fx) {
        f.life--;
        f.x += f.vx || 0;
        f.y += f.vy || 0;
        f.vy = (f.vy || 0) + (f.g || 0);
        if (f.kind === 'snow') f.x += Math.sin(this.t * 0.05 + f.ph) * 0.4;
        if (f.kind === 'smoke') f.s += 0.12;
      }
      this.fx = this.fx.filter((f) => f.life > 0 && f.y < H + 8);
      for (const p of this.pops) { p.life--; p.y -= 0.4; }
      this.pops = this.pops.filter((p) => p.life > 0);

      // Idle banter and a danger beep when the stack gets tall.
      if (this.phase === 'play') {
        const h = this.height();
        if (h >= 11 && this.t % 60 === 0) {
          tone(1200, 0.05, { vol: 0.05 });
          if (!this.bubble) this.say(Math.random() < 0.5 ? ['UH OH...'] : ['SPICY!'], 60);
        }
        if (--this.nextQuip <= 0) {
          this.nextQuip = 480 + Math.floor(Math.random() * 300);
          if (!this.bubble) this.say(IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)], 120);
        }
      }
    }

    updatePlay(inp) {
      const p = inp.pressed;
      const h = inp.held;
      if (p.jump || p.up) this.rotate();

      // Horizontal movement with auto-repeat.
      let dir = h.left && !h.right ? -1 : h.right && !h.left ? 1 : h.left && h.right ? this.hDir : 0;
      if (p.left) dir = -1;
      if (p.right) dir = 1;
      if (dir !== this.hDir || p.left || p.right) {
        this.hDir = dir;
        this.das = 0;
        if (dir) this.move(dir);
      } else if (dir) {
        this.das++;
        if (this.das >= DAS && (this.das - DAS) % ARR === 0) this.move(dir);
      }

      if (p.spark) { this.hardDrop(); return; }

      const grounded = !this.fits(this.cur, 0, 1);
      if (!grounded) {
        this.grav++;
        const interval = h.down ? Math.min(2, this.gravity) : this.gravity;
        if (this.grav >= interval) {
          this.grav = 0;
          this.cur.y++;
          if (h.down) this.addScore(1);
        }
      } else {
        this.grav = 0;
        this.lockT += h.down ? 3 : 1;
        if (this.lockT >= LOCK) this.lock(false);
      }
    }

    updateClear() {
      // Rows burst from the middle outwards.
      this.clearRows.forEach((row, i) => {
        for (let c = 0; c < COLS; c++) {
          const at = 5 + Math.abs(c - 3.5) * 3;
          if (this.gone[i][c] || this.pt < at) continue;
          this.gone[i][c] = true;
          const cell = this.grid[row][c];
          const tp = TYPES[cell.k];
          const cx = BX + c * C + 6;
          const cy = BY + row * C + 6;
          for (let j = 0; j < 4; j++) {
            this.fx.push({ kind: 'sq', x: cx, y: cy, vx: SDW.rand(-2.2, 2.2), vy: SDW.rand(-3.2, -0.6), g: 0.18, life: 34, color: j ? tp.body : tp.acc, s: j ? 3 : 2 });
          }
          this.fx.push({ kind: 'snow', x: cx, y: cy, vx: SDW.rand(-0.6, 0.6), vy: SDW.rand(-1, -0.3), life: 50, ph: Math.random() * 6 });
        }
      });
    }

    // --------------------------------------------------------- draw --
    draw(ctx) {
      const t = this.t;
      ctx.drawImage(ART.bg, 0, 0);
      // distant blinking LEDs
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(SDW.art.hash(i, 7) * 16) * 26 + 2 + Math.floor(SDW.art.hash(i, 8) * 16);
        const y = 28 + Math.floor(SDW.art.hash(i, 9) * 29) * 6;
        if ((((t >> 4) + i * 7) % 5) > 1) R(ctx, i % 3 ? '#2f7a4a' : '#7a6a2f', x, y, 2, 1);
      }

      ctx.save();
      if (this.shake > 0) {
        const m = this.shake > 12 ? 3 : 2;
        ctx.translate(Math.round(SDW.rand(-m, m)), Math.round(SDW.rand(-m, m)));
      }
      this.drawRack(ctx);
      this.drawBoard(ctx);
      this.drawFx(ctx);
      this.drawLeft(ctx);
      this.drawRight(ctx);
      ctx.restore();

      this.drawHeader(ctx);
      this.drawTicker(ctx);
      this.drawOverlay(ctx);
    }

    drawRack(ctx) {
      const t = this.t;
      ctx.drawImage(ART.rack, BX - 12, BY - 12);
      // status LEDs on the top cap
      const danger = this.phase === 'play' && this.height() >= 11;
      for (let i = 0; i < 8; i++) {
        let col = ((t >> 3) + i * 3) % 7 < 4 ? '#3dd16a' : '#1f5a32';
        if (danger || this.phase === 'overheat') col = (t >> 2) % 2 ? '#ff5a5a' : '#5a1a1a';
        if (this.phase === 'win') col = (i + (t >> 2)) % 2 ? '#7fe0ff' : '#ffffff';
        R(ctx, col, BX + 60 + i * 5, BY - 7, 3, 2);
      }
    }

    cellImg(cell) {
      return ART.cells[cell.k][cell.kind][(this.t >> 2) & 1];
    }

    drawCell(ctx, cell, x, y, ledOn) {
      ctx.drawImage(this.cellImg(cell), x, y);
      const tp = TYPES[cell.k];
      R(ctx, ledOn ? tp.led : '#20242e', x + 10, y + 1, 1, 1);
    }

    drawBoard(ctx) {
      const t = this.t;
      const ph = this.phase;
      ctx.save();
      ctx.beginPath();
      ctx.rect(BX, BY, COLS * C, ROWS * C);
      ctx.clip();
      for (let r = 0; r < ROWS; r++) {
        const ci = this.clearRows ? this.clearRows.indexOf(r) : -1;
        let off = 0;
        if (this.slide) off = -Math.round(this.slide.drop[r] * C * (this.slide.t / 8) * (this.slide.t / 8));
        for (let c = 0; c < COLS; c++) {
          const cell = this.grid[r][c];
          if (!cell) continue;
          if (ci >= 0 && this.gone[ci][c]) continue;
          const x = BX + c * C;
          const y = BY + r * C + off;
          this.drawCell(ctx, cell, x, y, (((t >> 4) + cell.ph) & 3) !== 0);
          if (ci >= 0) {
            R(ctx, (this.pt >> 1) % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(127,224,255,0.6)', x, y, C, C);
          } else if (t - cell.lt < 6) {
            R(ctx, `rgba(255,255,255,${0.6 * (1 - (t - cell.lt) / 6)})`, x, y, C, C);
          }
          if (ph === 'overheat') {
            const heat = SDW.clamp((this.pt * 2.5 - (ROWS - 1 - r) * 6) / 30, 0, 1);
            if (heat > 0) R(ctx, `rgba(255,${Math.round(80 - heat * 60)},30,${heat * (0.45 + 0.15 * ((t >> 2) & 1))})`, x, y, C, C);
          } else if (ph === 'win') {
            const wave = this.pt * 0.35 - (ROWS - 1 - r);
            const a = SDW.clamp(1 - Math.abs(wave) / 2.5, 0, 1) * 0.7 + (wave > 0 ? 0.12 : 0);
            if (a > 0) R(ctx, `rgba(127,224,255,${a})`, x, y, C, C);
          }
        }
      }

      if (this.cur && ph === 'play') {
        const d = this.dropDist();
        // ghost / landing preview
        if (d > 0) {
          for (const [x, y] of this.cellsOf(this.cur, 0, d)) {
            if (y < 0) continue;
            const gx = BX + x * C;
            const gy = BY + y * C;
            const a = 0.35 + 0.15 * Math.sin(t * 0.15);
            R(ctx, `rgba(127,224,255,0.08)`, gx, gy, C, C);
            R(ctx, `rgba(127,224,255,${a})`, gx, gy, C, 1);
            R(ctx, `rgba(127,224,255,${a})`, gx, gy + C - 1, C, 1);
            R(ctx, `rgba(127,224,255,${a})`, gx, gy + 1, 1, C - 2);
            R(ctx, `rgba(127,224,255,${a})`, gx + C - 1, gy + 1, 1, C - 2);
          }
        }
        // smooth sub-row fall while airborne
        const sub = d > 0 ? Math.round((this.grav / this.gravity) * C * 0.9) : 0;
        const tp = TYPES[this.cur.k];
        const flashLock = d === 0 && this.lockT > LOCK - 10 && (t >> 1) % 2;
        this.cellsOf(this.cur).forEach(([x, y], i) => {
          const py = BY + y * C + Math.min(sub, C - 1);
          const cell = { k: this.cur.k, kind: tp.kinds[i], ph: 0 };
          const px = BX + x * C;
          this.drawCell(ctx, cell, px, py, (t >> 3) & 1);
          if (this.rotPop > 0) R(ctx, `rgba(255,255,255,${this.rotPop / 12})`, px, py, C, C);
          if (flashLock) R(ctx, 'rgba(255,255,255,0.25)', px, py, C, C);
        });
      }
      ctx.restore();
    }

    drawFx(ctx) {
      for (const f of this.fx) {
        const x = Math.round(f.x);
        const y = Math.round(f.y);
        if (f.kind === 'sq') {
          R(ctx, '#07080c', x - 1, y - 1, f.s + 2, f.s + 2);
          R(ctx, f.color, x, y, f.s, f.s);
        } else if (f.kind === 'dust') {
          R(ctx, f.color, x, y, 2, 2);
        } else if (f.kind === 'snow') {
          const a = Math.min(1, f.life / 30);
          ctx.globalAlpha = a;
          R(ctx, '#ffffff', x - 1, y, 3, 1);
          R(ctx, '#ffffff', x, y - 1, 1, 3);
          ctx.globalAlpha = 1;
        } else if (f.kind === 'smoke') {
          const s = Math.round(f.s);
          ctx.globalAlpha = Math.min(0.55, f.life / 60);
          R(ctx, '#5a5566', x - s, y - s, s * 2, s * 2);
          R(ctx, '#7a7488', x - s + 1, y - s, s, s);
          ctx.globalAlpha = 1;
        } else if (f.kind === 'streak') {
          ctx.globalAlpha = f.life / 10;
          R(ctx, '#cfe6ff', x, y, 2, f.h);
          ctx.globalAlpha = 1;
        }
      }
      for (const p of this.pops) {
        const a = Math.min(1, p.life / 20);
        ctx.globalAlpha = a;
        text(ctx, p.str, Math.round(p.x), Math.round(p.y), p.color, 'center');
        ctx.globalAlpha = 1;
      }
    }

    temp() {
      if (this.phase === 'overheat') return 99;
      const h = this.phase === 'reboot' || this.phase === 'intro' ? 0 : this.height();
      return Math.round(SDW.clamp(52 + h * 3 - this.coolShown * 34 + Math.sin(this.t * 0.03) * 1.2, 18, 98));
    }

    drawLeft(ctx) {
      const t = this.t;
      // core temperature readout
      text(ctx, 'CORE TEMP', 48, 22, '#9b84ff', 'center');
      R(ctx, '#07080c', 10, 32, 76, 26);
      R(ctx, '#2a3040', 11, 33, 74, 24);
      R(ctx, '#05060a', 13, 35, 70, 20);
      const tc = this.temp();
      const hot = tc >= 85;
      const col = tc >= 85 ? '#ff5a5a' : tc >= 60 ? '#ffb347' : tc >= 35 ? '#ffd84a' : '#7fe0ff';
      if (!(hot && (t >> 3) % 2)) text(ctx, `${tc}C`, 48, 38, col, 'center', 16);
      for (let x = 15; x < 81; x += 2) R(ctx, 'rgba(255,255,255,0.04)', x, 35, 1, 20);

      // Dario next to the rack
      const g = SDW.game;
      const pw = g.session.power;
      const d = g.darioSize(pw);
      const sc = 44 / d.h;
      const dw = d.w * sc;
      const dh = d.h * sc;
      let row = 0;
      let fr = Math.floor(t / 10) % 6;
      if (this.phase === 'win' || this.cheer > 0) { row = 3; fr = Math.floor(t / 8) % 4; }
      else if (this.phase === 'overheat') { row = 5; fr = Math.min(7, Math.floor(this.pt / 6)); }
      else if (this.squat > 0) { row = 4; fr = 2; }
      const dx = 48 - dw / 2;
      const dy = 204 - dh + (this.phase === 'win' && this.pt > 60 ? -Math.abs(Math.sin(t * 0.2)) * 6 : 0);
      R(ctx, 'rgba(0,0,0,0.4)', Math.round(48 - dw / 3), 203, Math.round(dw * 2 / 3), 2);
      g.drawDario(ctx, pw, row, fr, dx, dy, sc);
      // cables running into the rack
      R(ctx, '#1d2230', 70, 200, 30, 2);
      R(ctx, '#3a2a7a', 74, 196, 26, 2);
      R(ctx, '#2f8a4a', 82, 192, 18, 1);

      if (this.bubble) this.drawBubble(ctx, this.bubble, 204 - dh - 8);
    }

    drawBubble(ctx, b, bottom) {
      const lines = b.lines;
      const w = Math.max(...lines.map((s) => s.length)) * 8 + 10;
      const h = lines.length * 10 + 7;
      const x = Math.round(SDW.clamp(48 - w / 2, 2, 96 - w));
      const pop = b.age < 6 ? 6 - b.age : 0;
      const y = Math.round(bottom - h - pop / 2);
      R(ctx, '#07080c', x + 1, y, w - 2, h);
      R(ctx, '#07080c', x, y + 1, w, h - 2);
      R(ctx, '#ffffff', x + 1, y + 1, w - 2, h - 2);
      R(ctx, '#c4b5ff', x + 1, y + h - 2, w - 2, 1);
      // tail
      R(ctx, '#07080c', 45, y + h, 6, 2);
      R(ctx, '#ffffff', 46, y + h - 1, 4, 2);
      R(ctx, '#07080c', 47, y + h + 2, 3, 2);
      R(ctx, '#ffffff', 48, y + h + 1, 1, 2);
      lines.forEach((s, i) => {
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#1d1533';
        ctx.fillText(s, x + w / 2 + 1, y + 5 + i * 10);
      });
    }

    drawRight(ctx) {
      const t = this.t;
      const x0 = 230;
      // NEXT box
      text(ctx, 'NEXT', x0, 22, '#9b84ff');
      R(ctx, '#07080c', x0, 32, 66, 42);
      R(ctx, '#2a3040', x0 + 1, 33, 64, 40);
      R(ctx, '#0f121a', x0 + 3, 35, 60, 36);
      const tp = TYPES[this.next];
      const cs = tp.rots[0];
      const xs = cs.map((c) => c[0]);
      const ys = cs.map((c) => c[1]);
      const pw = (Math.max(...xs) - Math.min(...xs) + 1) * C;
      const ph = (Math.max(...ys) - Math.min(...ys) + 1) * C;
      const ox = x0 + 33 - pw / 2 - Math.min(...xs) * C;
      const bob = Math.round(Math.sin(t * 0.08) * 1.5);
      const oy = 53 - ph / 2 - Math.min(...ys) * C + bob;
      cs.forEach(([x, y], i) => this.drawCell(ctx, { k: this.next, kind: tp.kinds[i], ph: 0 }, ox + x * C, oy + y * C, ((t >> 3) + i) & 1));

      // lines counter
      text(ctx, 'LINES', 306, 32, '#9b84ff');
      const done = this.lines >= this.goal;
      text(ctx, `${this.lines}/${this.goal}`, 306, 46, done ? '#3dd16a' : '#ffffff', 'left', 16);
      text(ctx, 'ROWS', 306, 64, '#6a6390');

      // piece name card
      text(ctx, tp.name, x0, 82, '#ffd84a');
      text(ctx, tp.tag, x0, 93, '#8f88b8');

      // COOLING thermometer
      const pct = Math.round(this.coolShown * 100);
      text(ctx, 'COOLING', x0, 110, '#9b84ff');
      text(ctx, `${pct}%`, 376, 110, '#7fe0ff', 'right');
      const tx = x0 + 10;
      const ty = 123;
      const tw = 134;
      // bulb
      R(ctx, '#07080c', x0, ty - 3, 12, 14);
      R(ctx, '#07080c', x0 - 1, ty - 2, 14, 12);
      const cool = this.coolShown;
      const bulbCol = cool > 0.99 ? '#7fe0ff' : cool > 0.5 ? '#c4b5ff' : '#ff5a5a';
      R(ctx, bulbCol, x0 + 1, ty - 1, 10, 10);
      R(ctx, 'rgba(255,255,255,0.6)', x0 + 3, ty + 1, 2, 2);
      // tube
      R(ctx, '#07080c', tx, ty, tw + 2, 8);
      R(ctx, '#1a1d26', tx, ty + 1, tw + 1, 6);
      const fw = Math.round(tw * cool);
      for (let i = 0; i < fw; i++) {
        const f = i / tw;
        const col = f < 0.33 ? '#ff7a5a' : f < 0.66 ? '#c4b5ff' : '#7fe0ff';
        R(ctx, col, tx, ty + 2, i + 1, 4);
      }
      if (fw > 0) R(ctx, 'rgba(255,255,255,0.5)', tx, ty + 2, fw, 1);
      // tick marks for each row needed
      for (let i = 1; i < this.goal; i++) R(ctx, '#07080c', tx + Math.round((tw * i) / this.goal), ty + 1, 1, 6);
      if (cool > 0.99 && (t >> 3) % 2) R(ctx, '#ffffff', tx + tw - 4, ty + 2, 3, 4);

      // score / clock
      text(ctx, 'SCORE', x0, 142, '#9b84ff');
      text(ctx, String(this.score).padStart(6, '0'), 376, 142, '#ffffff', 'right');
      text(ctx, 'CLOCK', x0, 156, '#9b84ff');
      const ghz = ((2.4 * 48) / this.gravity).toFixed(1);
      text(ctx, `${ghz} GHZ`, 376, 156, this.tries > 1 ? '#ffb347' : '#ffffff', 'right');

      // controls reminder
      R(ctx, 'rgba(10,8,20,0.6)', x0 - 4, 172, 152, 34);
      text(ctx, 'Z/JUMP  ROTATE', x0, 176, '#c9d2df');
      text(ctx, 'X/ZAP   DROP', x0, 186, '#c9d2df');
      text(ctx, 'DOWN    FASTER', x0, 196, '#c9d2df');
    }

    drawHeader(ctx) {
      R(ctx, '#1d1533', 0, 0, W, 15);
      R(ctx, '#6b4fd6', 0, 15, W, 1);
      text(ctx, 'RACK STACK', 6, 4, '#ffd84a');
      text(ctx, 'COOL THE RACK', 186, 4, '#7fe0ff', 'center');
      text(ctx, `ATTEMPT ${this.tries}`, W - 6, 4, '#ffffff', 'right');
      if (SDW.audio.isMuted()) text(ctx, 'MUTED', W - 6, 200, '#9aa3b5', 'right');
    }

    drawTicker(ctx) {
      R(ctx, '#05040a', 0, 211, W, 13);
      R(ctx, '#2a2050', 0, 211, W, 1);
      const len = TICKER.length * 8;
      const off = Math.floor(this.t * 0.6) % len;
      ctx.save();
      ctx.beginPath();
      ctx.rect(66, 211, W - 66, 13);
      ctx.clip();
      text(ctx, TICKER, 66 - off, 214, '#3dd16a');
      text(ctx, TICKER, 66 - off + len, 214, '#3dd16a');
      ctx.restore();
      R(ctx, '#3dd16a', 0, 212, 62, 12);
      text(ctx, 'STATUS', 6, 214, '#05040a');
    }

    drawOverlay(ctx) {
      const t = this.t;
      const pt = this.pt;
      const g = SDW.game;
      if (this.flash > 0) R(ctx, `rgba(255,255,255,${this.flash / 14})`, BX, BY, COLS * C, ROWS * C);

      if (this.phase === 'intro') {
        const e = Math.min(1, pt / 14);
        const y = Math.round(-120 + (1 - Math.pow(1 - e, 3)) * 162);
        const out = pt > 88 ? (pt - 88) / 12 : 0;
        R(ctx, `rgba(5,4,12,${0.6 * (1 - out)})`, 0, 16, W, 195);
        const py = y - Math.round(out * out * 200);
        R(ctx, '#07080c', 30, py - 2, W - 60, 128);
        R(ctx, '#6b4fd6', 31, py - 1, W - 62, 126);
        R(ctx, '#1d1533', 33, py + 1, W - 66, 122);
        g.bigText(ctx, 'RACK STACK', W / 2, py + 12, 24, '#ffd84a', '#3a1a5a');
        text(ctx, `STACK ${this.goal} ROWS OF GPUS TO COOL THE RACK`, W / 2, py + 48, '#ffffff', 'center');
        text(ctx, 'ARROWS MOVE  Z ROTATE  X DROP', W / 2, py + 66, '#7fe0ff', 'center');
        text(ctx, 'PHONE: JUMP ROTATE  ZAP DROP', W / 2, py + 80, '#7fe0ff', 'center');
        // boot progress bar
        R(ctx, '#07080c', 92, py + 100, 200, 8);
        R(ctx, '#3dd16a', 93, py + 101, Math.round(198 * Math.min(1, pt / 88)), 6);
        text(ctx, 'BOOTING', W / 2, py + 111, '#8f88b8', 'center');
      }

      if (this.phase === 'overheat') {
        const a = pt < 40 ? 0.35 * (1 - pt / 40) + ((t >> 2) % 2 ? 0.12 : 0) : ((t >> 3) % 2 ? 0.12 : 0.04);
        R(ctx, `rgba(255,40,40,${a})`, 0, 16, W, 195);
        const s = Math.min(1, pt / 8);
        if (s > 0) {
          const by = 80;
          R(ctx, 'rgba(20,4,8,0.85)', 0, by - 6, W, 66);
          R(ctx, '#ff5a5a', 0, by - 6, W, 2);
          R(ctx, '#ff5a5a', 0, by + 58, W, 2);
          const jx = pt < 30 ? Math.round(SDW.rand(-2, 2)) : 0;
          g.bigText(ctx, 'OVERHEATED!', W / 2 + jx, by + 4, 24, '#ff5a5a', '#3a0a10');
          if (pt > 30) {
            text(ctx, `ATTEMPT ${this.tries}. ${RETRY[(this.tries - 2) % RETRY.length]}`, W / 2, by + 36, '#ffd84a', 'center');
            text(ctx, 'NO LIVES LOST. REBOOTING RACK...', W / 2, by + 48, '#c9d2df', 'center');
          }
        }
      }

      if (this.phase === 'reboot') {
        R(ctx, 'rgba(5,4,12,0.7)', BX, BY + 60, COLS * C, 44);
        text(ctx, 'REBOOT', BX + 48, BY + 66, '#3dd16a', 'center');
        R(ctx, '#07080c', BX + 8, BY + 80, 80, 8);
        R(ctx, '#3dd16a', BX + 9, BY + 81, Math.round(78 * Math.min(1, pt / 50)), 6);
        if (this.tries > 1 && (t >> 4) % 2) text(ctx, 'UNDERCLOCKED', BX + 48, BY + 92, '#ffb347', 'center');
      }

      if (this.phase === 'win') {
        const e = Math.min(1, pt / 12);
        const by = Math.round(60 - (1 - e) * 80 + (pt < 20 ? Math.sin(pt * 0.6) * (20 - pt) * 0.3 : 0));
        R(ctx, 'rgba(4,10,20,0.75)', 0, by - 8, W, pt > 50 ? 76 : 44);
        R(ctx, '#7fe0ff', 0, by - 8, W, 2);
        g.bigText(ctx, 'COOLING ONLINE!', W / 2, by, 24, (t >> 3) % 2 ? '#7fe0ff' : '#ffffff', '#0a2a4a');
        if (pt > 50) {
          const ok = (t >> 3) % 2;
          // little padlock popping open
          const lx = W / 2 - 106;
          const ly = by + 38;
          R(ctx, '#07080c', lx - 1, ly + 3, 14, 11);
          R(ctx, '#ffd84a', lx, ly + 4, 12, 9);
          R(ctx, '#b88a1a', lx + 5, ly + 7, 2, 4);
          R(ctx, '#c9d2df', lx + 1, ly - 6, 2, 9);
          R(ctx, '#c9d2df', lx + 1, ly - 7, 12, 2);
          R(ctx, '#c9d2df', lx + 11, ly - 6, 2, 4);
          g.bigText(ctx, 'DOOR UNLOCKED', W / 2 + 12, by + 36, 16, ok ? '#3dd16a' : '#ffd84a', '#0a2a1a');
          R(ctx, '#7fe0ff', 0, by + 66, W, 2);
        } else {
          R(ctx, '#7fe0ff', 0, by + 34, W, 2);
        }
      }
    }
  };
})();
