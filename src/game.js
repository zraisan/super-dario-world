'use strict';
// Game states (title, story, map, shop, level, ending), HUD and the main loop.
(() => {
  const W = SDW.W;
  const H = SDW.H;
  const input = SDW.input;
  const audio = SDW.audio;
  const R = (...a) => SDW.art.R(...a);

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  // The canvas is rendered at screen resolution (W*H times `scale`). Tiles and
  // enemies are scaled up with crisp nearest-neighbour pixels, while Dario is
  // drawn from a detailed sprite sheet so his face stays sharp.
  let scale = 1;

  const FONT = '"Press Start 2P", monospace';

  const game = {
    images: {},
    state: 'boot',
    t: 0,
    session: null,
    world: null,
    levelIndex: 0,
    node: 0,
    checkpoints: {},
  };
  SDW.game = game;

  // Dario sprite sheets: 8 columns x 9 rows of high-detail frames.
  const DARIO = [
    { img: 'dario', w: 24, h: 26 },
    { img: 'dario', w: 32, h: 35 },
    { img: 'suit', w: 32, h: 35 },
  ];
  game.darioSize = (power) => DARIO[power];
  game.drawDario = (c, power, row, frame, x, y, sc = 1) => {
    const d = DARIO[power];
    const img = game.images[d.img];
    const sw = img.width / 8;
    const sh = img.height / 9;
    // Snap to the device-pixel grid so he doesn't shimmer while moving.
    const snap = (v) => Math.round(v * scale) / scale;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, frame * sw, row * sh, sw, sh, snap(x), snap(y), d.w * sc, d.h * sc);
    c.imageSmoothingEnabled = false;
  };

  function newSession() {
    game.session = { lives: 5, tokens: 0, score: 0, power: 0, buddy: false, shopMult: 1 };
    game.checkpoints = {};
  }

  // ------------------------------------------------------------- text --
  game.text = (c, str, x, y, color = '#ffffff', align = 'left', size = 8) => {
    c.font = `${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = 'top';
    c.fillStyle = '#000000';
    c.fillText(str, x + 1, y + 1);
    c.fillStyle = color;
    c.fillText(str, x, y);
  };

  function bigText(c, str, x, y, size, fill, outline = '#1d1533') {
    c.font = `${size}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillStyle = outline;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 3; dy++) c.fillText(str, x + dx, y + dy);
    c.fillStyle = fill;
    c.fillText(str, x, y);
  }

  game.bigText = bigText;

  // Score helpers shared by every kind of level.
  game.addScore = (n) => { game.session.score += n; };
  game.addTokens = (n = 1) => {
    const s = game.session;
    s.tokens += n;
    s.score += 10 * n;
    let life = false;
    while (s.tokens >= 100) { s.tokens -= 100; s.lives++; life = true; }
    audio.play(life ? 'life' : 'token');
    return life;
  };

  const KEYS = () => (SDW.touch
    ? { move: 'D-PAD', jump: 'JUMP', zap: 'ZAP', start: 'JUMP' }
    : { move: 'ARROWS', jump: 'Z', zap: 'X', start: 'ENTER' });

  // One-line flavour text for each world's title card.
  const TAGLINES = {
    'PROMPT PLAINS': 'WHERE IT ALL BEGAN: ATTENTION.',
    'DATA CENTER DEPTHS': 'IT IS VERY WARM DOWN HERE.',
    'THE AI RACE': 'USA VS CHINA VS EVERYONE.',
    'NVIDIOUS FOUNDRY': 'HOME OF THE SHOVEL SALESMAN.',
    'CLOUD CLUSTER': "IT'S JUST SOMEONE ELSE'S COMPUTER.",
    'THE WEEKEND': 'FRIDAY 5PM. NOBODY KNOWS WHY.',
    'HYPE CASTLE': 'BUILT ENTIRELY ON VIBES.',
    'AGI SUMMIT': 'THE HYPE-MAN AWAITS.',
  };

  // ------------------------------------------------------------ states --
  function setState(s) {
    game.state = s;
    game.t = 0;
  }

  // Every level is a "scene": the platformer World, or one of the special
  // modes in src/modes/ (race, maze...). Scenes share one small contract:
  // update(input), draw(ctx), a `state` ('play' while playable), and they
  // call game.levelCleared() / game.playerDied() when they end.
  game.startLevel = (i) => {
    game.levelIndex = i;
    const def = SDW.levels.LIST[i];
    const Scene = def.kind ? SDW.modes[def.kind] : SDW.World;
    game.world = new Scene(def, {
      power: game.session.power,
      checkpoint: game.checkpoints[i],
    });
    audio.stopMusic();
    setState('intro');
  };

  game.levelCleared = (power) => {
    const i = game.levelIndex;
    game.session.power = power;
    game.checkpoints[i] = false;
    const save = SDW.save.data;
    if (!save.cleared.includes(i)) save.cleared.push(i);
    save.best = Math.max(save.best, game.session.score);
    SDW.save.write();
    const MAP = SDW.levels.MAP;
    const cur = MAP.findIndex((n) => n.level === i);
    game.node = cur;
    game.mapWalk = cur + 1 < MAP.length ? { from: cur, to: cur + 1, p: 0, unlock: true } : null;
    setState('map');
    audio.startSong('map');
  };

  game.playerDied = (checkpointHit) => {
    const s = game.session;
    s.lives--;
    s.power = 0;
    s.buddy = false;
    if (checkpointHit) game.checkpoints[game.levelIndex] = true;
    if (s.lives <= 0) {
      SDW.save.data.best = Math.max(SDW.save.data.best, s.score);
      SDW.save.write();
      audio.play('gameover');
      setState('gameover');
    } else {
      game.startLevel(game.levelIndex);
    }
  };

  game.finishGame = () => {
    const i = game.levelIndex;
    const save = SDW.save.data;
    if (!save.cleared.includes(i)) save.cleared.push(i);
    save.best = Math.max(save.best, game.session.score);
    SDW.save.write();
    setState('ending');
    audio.startSong('foundry');
  };

  // A node is open once the level before it is cleared (shops don't block).
  const unlocked = (nodeIdx) => {
    if (nodeIdx <= 0) return true;
    const prev = SDW.levels.MAP[nodeIdx - 1];
    if (prev.shop) return unlocked(nodeIdx - 1);
    return SDW.save.data.cleared.includes(prev.level);
  };
  const cleared = (n) => (n.shop ? false : SDW.save.data.cleared.includes(n.level));

  // ------------------------------------------------------------ update --
  function update() {
    game.t++;
    const p = input.pressed;
    if (p.mute) audio.toggleMute();

    switch (game.state) {
      case 'title':
        if (game.t > 10 && (p.start || p.jump)) {
          newSession();
          audio.play('select');
          setState('story');
          audio.startSong('map');
        }
        break;

      case 'story':
        if (game.t > 20 && (p.start || p.jump)) {
          if (game.t < STORY.length * 50 + 30) {
            game.t = STORY.length * 50 + 30; // first press shows everything
          } else {
            audio.play('select');
            game.node = Math.min(game.node, SDW.levels.MAP.length - 1);
            game.mapWalk = null;
            setState('map');
          }
        }
        break;

      case 'map': updateMap(p); break;

      case 'shop':
        if (SDW.shop.update(p)) {
          setState('map');
          audio.startSong('map');
        }
        break;

      case 'intro':
        if (game.t > 120 || (game.t > 20 && (p.start || p.jump))) {
          setState('level');
          audio.startSong(game.world.def.music);
        }
        break;

      case 'level':
        if (p.start && game.world.state === 'play' && !(game.world.player && game.world.player.dead)) {
          audio.play('pause');
          setState('paused');
          break;
        }
        game.world.update(input);
        break;

      case 'paused':
        if (p.start) { audio.play('pause'); game.state = 'level'; }
        break;

      case 'gameover':
        if (game.t > 200 || (game.t > 60 && (p.start || p.jump))) {
          setState('title');
          audio.startSong('plains');
        }
        break;

      case 'ending':
        if (game.t > ENDING_EPILOGUE + 240 && (p.start || p.jump)) {
          setState('title');
          audio.startSong('plains');
        } else if (game.t > 60 && game.t < ENDING_EPILOGUE && (p.start || p.jump)) {
          game.t = ENDING_EPILOGUE;
          audio.startSong('map');
        }
        if (game.t === ENDING_EPILOGUE) audio.startSong('map');
        break;
    }
  }

  function updateMap(p) {
    const MAP = SDW.levels.MAP;
    const walk = game.mapWalk;
    if (walk) {
      walk.p += 0.025;
      if (walk.p >= 1) {
        game.node = walk.to;
        game.mapWalk = null;
        if (walk.unlock) audio.play('checkpoint');
      }
      return;
    }
    const n = game.node;
    if ((p.right || p.up) && n + 1 < MAP.length && unlocked(n + 1)) {
      game.mapWalk = { from: n, to: n + 1, p: 0 };
    } else if ((p.left || p.down) && n > 0) {
      game.mapWalk = { from: n, to: n - 1, p: 0 };
    } else if (p.jump || p.start) {
      audio.play('select');
      if (MAP[n].shop) {
        SDW.shop.open();
        setState('shop');
        audio.startSong('shop');
      } else {
        game.startLevel(MAP[n].level);
      }
    }
  }

  // -------------------------------------------------------------- draw --
  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    switch (game.state) {
      case 'boot':
        game.text(ctx, 'LOADING...', W / 2, H / 2 - 4, '#ffffff', 'center');
        break;
      case 'title': drawTitle(); break;
      case 'story': drawStory(); break;
      case 'map': drawMap(); break;
      case 'shop': SDW.shop.draw(ctx); break;
      case 'intro': drawIntro(); break;
      case 'level':
      case 'paused': {
        const w = game.world;
        w.draw(ctx);
        if (!w.ownHud) drawHud();
        if (game.state === 'paused') {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(0, 0, W, H);
          bigText(ctx, 'PAUSED', W / 2, H / 2 - 20, 16, '#ffffff', '#1d1533');
          game.text(ctx, 'THE MODEL IS THINKING...', W / 2, H / 2 + 6, '#c4b5ff', 'center');
          game.text(ctx, `${KEYS().start === 'JUMP' ? 'II' : 'ENTER'} TO RESUME   M MUTE`, W / 2, H / 2 + 22, '#9aa3b5', 'center');
        }
        if (w.state === 'clear' && w.stateT > 30 && !w.def.kind) {
          bigText(ctx, 'SHIPPED IT!', W / 2, 70, 16, '#ffd84a', '#1d1533');
        }
        if (w.state === 'won') {
          const [a, b] = w.def.winBanner || ['BOSS', 'DEFEATED!'];
          bigText(ctx, a, W / 2, 60, 16, '#ffd84a', '#1d1533');
          bigText(ctx, b, W / 2, 82, 16, '#ffd84a', '#1d1533');
        }
        break;
      }
      case 'gameover':
        bigText(ctx, 'GAME OVER', W / 2, H / 2 - 20, 16, '#ff5a5a', '#1d1533');
        game.text(ctx, 'THE CONTEXT WINDOW HAS CLOSED.', W / 2, H / 2 + 8, '#c4b5ff', 'center');
        game.text(ctx, `SCORE ${game.session.score}`, W / 2, H / 2 + 24, '#ffffff', 'center');
        break;
      case 'ending': drawEnding(); break;
    }
  }

  function drawHud() {
    const w = game.world;
    game.hud(ctx, `TIME ${String(w.time).padStart(3, '0')}`, w.time <= 100 ? '#ff7a7a' : '#ffffff');
    if (w.player && w.player.buddy) ctx.drawImage(SDW.art.S.clawd[0].R, 160, 2);
  }

  // The top status bar. Special modes call this with their own middle text.
  game.hud = (c, middle = '', middleColor = '#ffffff') => {
    const s = game.session;
    R(c, 'rgba(10,8,20,0.55)', 0, 0, W, 15);
    game.text(c, `DARIO x${s.lives}`, 6, 4, '#ffffff');
    c.drawImage(SDW.art.S.token, 108, 2, 10, 10);
    game.text(c, `x${String(s.tokens).padStart(2, '0')}`, 120, 4, '#ffd84a');
    if (middle) game.text(c, middle, 186, 4, middleColor);
    game.text(c, String(s.score).padStart(7, '0'), W - 6, 4, '#ffffff', 'right');
    if (audio.isMuted()) game.text(c, 'MUTED', W - 6, H - 12, '#9aa3b5', 'right');
  };

  function drawIntro() {
    const lv = SDW.levels.LIST[game.levelIndex];
    const t = game.t;
    R(ctx, '#0b0814', 0, 0, W, H);
    for (let i = 0; i < 40; i++) R(ctx, '#2a2050', Math.floor(SDW.art.hash(i, 5) * W), Math.floor((SDW.art.hash(i, 6) * H + t * (0.3 + (i % 3) * 0.2)) % H), 2, 2);
    game.text(ctx, `WORLD ${game.levelIndex + 1}-${SDW.levels.LIST.length}`, W / 2, 50, '#9b84ff', 'center');
    bigText(ctx, lv.name, W / 2, 68, 16, '#ffffff', '#3a2a7a');
    game.text(ctx, TAGLINES[lv.name] || '', W / 2, 96, '#c4b5ff', 'center');
    const pw = game.session.power;
    game.drawDario(ctx, pw, 0, Math.floor(t / 10) % 6, W / 2 - 40, 160 - DARIO[pw].h);
    if (game.session.buddy && !lv.kind) ctx.drawImage(SDW.art.S.clawd[(t >> 4) % 2].R, W / 2 - 62, 150);
    game.text(ctx, `x ${game.session.lives}`, W / 2 - 2, 146, '#ffffff');
    if (game.checkpoints[game.levelIndex]) game.text(ctx, 'FROM CHECKPOINT', W / 2, 184, '#3dd16a', 'center');
  }

  function drawTitle() {
    const t = game.t;
    SDW.art.background(ctx, 'plains', t * 0.6, t);
    for (let x = 0; x < W + 16; x += 16) {
      SDW.art.drawTile(ctx, titleGround, '#', 0, 12, x - ((t * 0.6) % 16), 12 * 16, t);
      SDW.art.drawTile(ctx, titleGround, '#', 0, 13, x - ((t * 0.6) % 16), 13 * 16, t);
    }
    bigText(ctx, 'SUPER DARIO', W / 2, 24, 24, '#ffd84a', '#3a1a5a');
    bigText(ctx, 'WORLD', W / 2, 56, 24, '#7fe0ff', '#3a1a5a');
    game.text(ctx, 'THE AI RACE PLATFORMER', W / 2, 90, '#ffffff', 'center');

    // Dario runs, Clawd keeps up, and a bug gets chased off.
    game.drawDario(ctx, 1, 1, Math.floor(t / 7) % 8, W / 2 - 16, 192 - 35);
    ctx.drawImage(SDW.art.S.clawd[(t >> 3) % 2].R, W / 2 - 40, 178 + Math.round(Math.sin(t * 0.2)));
    const bx = W - ((t * 1.2) % (W + 60));
    ctx.drawImage(SDW.art.S.bug[(t >> 3) % 2].L, Math.round(bx), 176);

    const k = KEYS();
    if ((t >> 5) % 2 === 0) game.text(ctx, `PRESS ${k.start}`, W / 2, 112, '#ffffff', 'center');
    game.text(ctx, `${k.move} MOVE   ${k.jump} JUMP   ${k.zap} ZAP`, W / 2, 130, '#1d1533', 'center');
    if (SDW.save.data.best) game.text(ctx, `BEST ${SDW.save.data.best}`, W / 2, 146, '#1d1533', 'center');
    R(ctx, 'rgba(0,0,0,0.45)', 0, H - 12, W, 12);
    game.text(ctx, 'FAN PARODY. NOT AFFILIATED WITH ANYONE.', W / 2, H - 10, '#c9d2df', 'center');
  }
  const titleGround = { theme: 'plains', w: 1, tile: (tx, ty) => (ty >= 12 ? '#' : '.') };

  // ------------------------------------------------------------- story --
  const STORY = [
    'THE YEAR IS 2027. THE AI RACE IS ON.',
    'DARIO HAS NOT SLEPT IN 400 DAYS.',
    'HE IS BUSY REPLACING ENGINEERS,',
    'MATHEMATICIANS, LAWYERS AND DESIGNERS.',
    "(POLITELY. IT'S IN THE CONSTITUTION.)",
    'BUT BUGS, HALLUCINATIONS, A RIVAL WHALE',
    'AND A LOT OF HYPE STAND IN HIS WAY.',
    'MEANWHILE, A MAN IN A LEATHER JACKET',
    'IS SELLING SHOVELS TO EVERYONE.',
  ];
  function drawStory() {
    const t = game.t;
    R(ctx, '#0b0814', 0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      const tw = (t + i * 7) % 90 < 80;
      if (tw) R(ctx, i % 4 ? '#3a3060' : '#9b84ff', Math.floor(SDW.art.hash(i, 21) * W), Math.floor(SDW.art.hash(i, 22) * 150), 1, 1);
    }
    STORY.forEach((line, i) => {
      const start = i * 50;
      if (t < start) return;
      const n = Math.min(line.length, Math.floor((t - start) / 2));
      const col = i === 4 ? '#9aa3b5' : i >= 7 ? '#c8ff7a' : '#ffffff';
      game.text(ctx, line.slice(0, n), 26, 14 + i * 15, col);
      if (n < line.length && (t >> 1) % 2 === 0 && t - start < line.length * 2) audio.play('talk');
    });
    // Dario at his desk, still awake.
    R(ctx, '#3a2a5a', 120, 196, 150, 6);
    R(ctx, '#1d1533', 130, 202, 6, 22); R(ctx, '#1d1533', 254, 202, 6, 22);
    R(ctx, '#1d2230', 196, 170, 40, 26);
    R(ctx, '#0b1020', 199, 173, 34, 18);
    for (let i = 0; i < 4; i++) R(ctx, (t >> 3) % 4 === i ? '#7fe0ff' : '#3dd16a', 202, 176 + i * 4, 8 + ((i * 7 + (t >> 4)) % 20), 2);
    game.drawDario(ctx, 0, 0, Math.floor(t / 10) % 6, 158, 196 - 26);
    ctx.drawImage(SDW.art.S.clawd[(t >> 4) % 2].L, 240, 188);
    R(ctx, '#ffffff', 186, 186, 6, 8); R(ctx, '#6a3a1a', 187, 187, 4, 3); // coffee
    if (t > STORY.length * 50 + 30 && (t >> 5) % 2 === 0) game.text(ctx, `PRESS ${KEYS().start}`, W - 10, H - 12, '#ffd84a', 'right');
  }

  // --------------------------------------------------------- overworld --
  function disc(cx, cy, r, color) {
    for (let y = -r; y <= r; y++) {
      const half = Math.round(Math.sqrt(r * r - y * y));
      R(ctx, color, cx - half, cy + y, half * 2, 1);
    }
  }
  const ISLAND = [[40, 172, 34], [70, 150, 30], [92, 128, 32], [128, 172, 30], [150, 160, 26], [172, 142, 32],
    [214, 180, 34], [232, 150, 26], [252, 122, 32], [276, 146, 26], [298, 168, 32], [318, 132, 26], [334, 104, 34],
    [350, 66, 30], [196, 196, 22]];

  function drawMap() {
    const t = game.t;
    const MAP = SDW.levels.MAP;
    R(ctx, '#2f6fd0', 0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = (SDW.art.hash(i, 1) * W + t * 0.2) % W;
      const y = SDW.art.hash(i, 2) * H;
      if (((t >> 4) + i) % 3) R(ctx, '#5a95e8', Math.floor(x), Math.floor(y), 6, 1);
    }
    for (const [x, y, r] of ISLAND) disc(x, y + 4, r + 6, '#1e4f9a');
    for (const [x, y, r] of ISLAND) disc(x, y, r + 5, '#f2d48a');
    for (const [x, y, r] of ISLAND) disc(x, y, r, '#4caf5c');
    for (const [x, y, r] of ISLAND) disc(x - 6, y - 6, Math.floor(r * 0.6), '#5cc46c');

    // Paths
    for (let i = 0; i + 1 < MAP.length; i++) {
      const a = MAP[i];
      const b = MAP[i + 1];
      const open = unlocked(i + 1);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = 8; d < len - 6; d += 6) {
        const x = a.x + ((b.x - a.x) * d) / len;
        const y = a.y + ((b.y - a.y) * d) / len;
        R(ctx, open ? '#8a5a2a' : 'rgba(40,60,40,0.5)', Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      }
    }
    // Landmarks sit just above their node.
    MAP.forEach((n) => landmark(n.icon, n.x, n.y - 9, t));
    MAP.forEach((n, i) => {
      const col = cleared(n) ? '#3f7dff' : n.shop ? '#76d82a' : unlocked(i) ? '#ff5a3a' : '#7a8090';
      disc(n.x, n.y + 2, 6, '#1d1533');
      disc(n.x, n.y, 6, '#1d1533');
      disc(n.x, n.y, 4, col);
      R(ctx, '#ffffff', n.x - 2, n.y - 3, 2, 1);
    });

    // Dario
    let px;
    let py;
    let moving = false;
    if (game.mapWalk) {
      const a = MAP[game.mapWalk.from];
      const b = MAP[game.mapWalk.to];
      px = a.x + (b.x - a.x) * game.mapWalk.p;
      py = a.y + (b.y - a.y) * game.mapWalk.p;
      moving = true;
    } else {
      px = MAP[game.node].x;
      py = MAP[game.node].y;
    }
    let row = 0;
    let fr = Math.floor(t / 10) % 6;
    if (moving) {
      row = MAP[game.mapWalk.to].x >= MAP[game.mapWalk.from].x ? 1 : 2;
      fr = Math.floor(t / 5) % 8;
    }
    game.drawDario(ctx, 0, row, fr, px - 12, py - 24);
    if (game.session.buddy) ctx.drawImage(SDW.art.S.clawd[(t >> 3) % 2].R, Math.round(px - 26), Math.round(py - 10));

    // Banner
    const n = MAP[game.mapWalk ? game.mapWalk.to : game.node];
    const name = n.shop ? 'GPU SHOP' : SDW.levels.LIST[n.level].name;
    const label = n.shop ? '$' : `${n.level + 1}`;
    R(ctx, '#1d1533', 0, 0, W, 22);
    R(ctx, '#6b4fd6', 0, 21, W, 2);
    game.text(ctx, `${label}  ${name}`, 10, 8, n.shop ? '#c8ff7a' : '#ffffff');
    ctx.drawImage(SDW.art.S.token, W - 104, 6, 10, 10);
    game.text(ctx, `${game.session.tokens}`, W - 90, 8, '#ffd84a');
    game.text(ctx, `x${game.session.lives}`, W - 10, 8, '#ffffff', 'right');
    R(ctx, 'rgba(10,8,20,0.6)', 0, H - 14, W, 14);
    const k = KEYS();
    game.text(ctx, `${k.move}: WALK   ${k.jump}: ${n.shop ? 'SHOP' : 'PLAY'}`, W / 2, H - 11, '#c9d2df', 'center');
  }

  function landmark(icon, x, y, t) {
    switch (icon) {
      case 'trees':
        drawTree(x - 8, y); drawTree(x + 8, y - 2);
        break;
      case 'racks':
        for (let i = -1; i <= 1; i++) {
          R(ctx, '#1d2230', x + i * 10 - 4, y - 16, 9, 16);
          R(ctx, '#5a6378', x + i * 10 - 3, y - 15, 7, 14);
          for (let j = 0; j < 3; j++) R(ctx, (t >> 4) % 2 === (j + i + 2) % 2 ? '#4dff88' : '#2a3a50', x + i * 10 - 1, y - 13 + j * 4, 2, 2);
        }
        break;
      case 'shop':
        R(ctx, '#0d0f12', x - 12, y - 16, 24, 16);
        R(ctx, '#2c3138', x - 11, y - 15, 22, 14);
        R(ctx, (t >> 4) % 2 ? '#76d82a' : '#c8ff7a', x - 11, y - 15, 22, 3);
        R(ctx, '#ffd84a', x - 3, y - 9, 6, 8);
        break;
      case 'flag':
        R(ctx, '#1d1533', x - 1, y - 20, 2, 20);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) R(ctx, (i + j) % 2 ? '#ffffff' : '#1d1533', x + 1 + i * 3, y - 20 + j * 3 + ((t >> 3) % 2 && i > 1 ? 1 : 0), 3, 3);
        R(ctx, '#3a3a4a', x - 14, y - 2, 28, 3);
        break;
      case 'factory':
        R(ctx, '#0b1a0f', x - 12, y - 12, 24, 12);
        R(ctx, '#0b1a0f', x + 4, y - 22, 6, 12);
        R(ctx, '#76d82a', x - 9, y - 8, 4, 3); R(ctx, '#76d82a', x - 2, y - 8, 4, 3);
        if ((t >> 3) % 3) disc(x + 7, y - 26 - ((t >> 2) % 4), 2, 'rgba(200,255,122,0.5)');
        break;
      case 'cloud':
        SDW.art.cloudShape(ctx, x, y - 8, 1, '#ffffff', '#cfe5fb');
        break;
      case 'office':
        R(ctx, '#1d2230', x - 9, y - 26, 18, 26);
        for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) R(ctx, SDW.art.hash(i + (t >> 6), j) > 0.4 ? '#ffd84a' : '#3a4152', x - 7 + j * 5, y - 24 + i * 5, 3, 3);
        break;
      case 'castle':
        R(ctx, '#2a1626', x - 14, y - 22, 28, 22);
        R(ctx, '#6e4b63', x - 13, y - 21, 26, 20);
        for (let i = 0; i < 4; i++) R(ctx, '#6e4b63', x - 13 + i * 7, y - 26, 4, 5);
        R(ctx, (t >> 3) % 2 ? '#ffb347' : '#ff7b2a', x - 3, y - 12, 6, 11);
        break;
      case 'summit':
        for (let i = 0; i < 20; i++) R(ctx, i < 6 ? '#ffffff' : '#7a6a9a', x - i, y - 20 + i, i * 2 + 1, 1);
        disc(x, y - 30, 6 + ((t >> 4) % 2), 'rgba(255,220,120,0.5)');
        disc(x, y - 30, 4, '#ffe9a8');
        break;
    }
  }

  function drawTree(x, y) {
    R(ctx, '#6b3f1a', x - 1, y - 6, 3, 6);
    disc(x, y - 9, 6, '#1f7a34');
    disc(x - 1, y - 10, 4, '#2f9a48');
  }

  // ------------------------------------------------------------ ending --
  const ENDING_EPILOGUE = 640;
  function drawEnding() {
    const t = game.t;
    if (t < ENDING_EPILOGUE) return drawEpilogue(t);
    const u = t - ENDING_EPILOGUE;
    SDW.art.background(ctx, 'summit', u * 0.5, u);
    const lines = [
      ['CONGRATULATIONS!', '#ffd84a'],
      ['', ''],
      ['THE HYPE-MAN HAS BEEN ALIGNED.', '#ffffff'],
      ['THE TOKENS ARE SAFE.', '#ffffff'],
      ['DARIO FINALLY TOOK A NAP.', '#ffffff'],
      ['', ''],
      [`FINAL SCORE ${game.session.score}`, '#7fe0ff'],
      ['', ''],
      ['SUPER DARIO WORLD', '#c4b5ff'],
      ['AN UNOFFICIAL, NON-COMMERCIAL', '#ffffff'],
      ['FAN PARODY MADE FOR FUN.', '#ffffff'],
      ['', ''],
      ['EVERY CHARACTER IS A PARODY.', '#ffffff'],
      ['NOT AFFILIATED WITH OR ENDORSED', '#ffffff'],
      ['BY NINTENDO, ANTHROPIC, OPENAI,', '#ffffff'],
      ['NVIDIA, DEEPSEEK, META, OR ANY', '#ffffff'],
      ['PERSON PORTRAYED.', '#ffffff'],
      ['', ''],
      ['DARIO SPRITES: OPENPETS', '#c4b5ff'],
      ['COMMUNITY ARTISTS', '#c4b5ff'],
      ['EVERYTHING ELSE: ORIGINAL', '#c4b5ff'],
      ['', ''],
      ['CODE: WRITTEN BY CLAUDE', '#f0a07c'],
      ['(SO DARIO REPLACED THE GAME DEV TOO)', '#f0a07c'],
      ['', ''],
      ['THANKS FOR PLAYING!', '#ffd84a'],
    ];
    const y0 = Math.max(24 - (lines.length * 12 - H + 60), H - u * 0.5);
    R(ctx, 'rgba(10,8,30,0.6)', 14, 0, W - 28, H);
    lines.forEach(([s, c], i) => { if (s) game.text(ctx, s, W / 2, y0 + i * 12, c, 'center'); });
    if (u > 240 && (t >> 5) % 2 === 0) game.text(ctx, `PRESS ${KEYS().start}`, W / 2, H - 14, '#ffffff', 'center');
  }

  // Meanwhile, the only real winner of the AI race...
  function drawEpilogue(t) {
    SDW.art.background(ctx, 'foundry', t * 2, t);
    // Giant chart going up and to the right.
    ctx.strokeStyle = '#c8ff7a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const end = Math.min(W, t * 1.2);
    for (let x = 0; x <= end; x += 4) {
      const y = 200 - Math.pow(x / W, 2.2) * 170 - SDW.art.hash(x, 7) * 6;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const hx = end;
    const hy = 200 - Math.pow(hx / W, 2.2) * 170;
    const sp = SDW.bosses.sprites();
    const bounce = Math.abs(Math.sin(t * 0.15)) * 6;
    ctx.drawImage((t >> 4) % 2 ? sp.jacketThrow : sp.jacket, Math.round(Math.min(hx, W - 50) - 20), Math.round(hy - 52 - bounce), 40, 52);
    R(ctx, 'rgba(5,16,10,0.75)', 0, 0, W, 70);
    if (t > 30) bigText(ctx, 'MEANWHILE...', W / 2, 10, 16, '#c8ff7a', '#05100a');
    if (t > 150) game.text(ctx, `NVIDIOUS MARKET CAP: $${Math.min(999, Math.floor(Math.pow(1.02, t - 150) * 3))}T`, W / 2, 36, '#ffffff', 'center');
    if (t > 330) game.text(ctx, 'EVERY TOKEN EVER SPENT WENT TO', W / 2, 50, '#ffd84a', 'center');
    if (t > 330) game.text(ctx, 'ONE GUY IN A LEATHER JACKET.', W / 2, 60, '#ffd84a', 'center');
    if (t > 470) SDW.bosses.bubble(ctx, 'THE MORE YOU BUY...', Math.min(hx, W - 50), hy - 60);
  }

  // -------------------------------------------------------------- boot --
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${src}`));
      img.src = src;
    });
  }

  // Size the canvas to the stage (the area left over by the touch controls).
  // Desktop keeps whole-number zoom for crisp pixels; phones use every pixel.
  const stage = document.getElementById('stage');
  function fit() {
    const sw = stage.clientWidth || window.innerWidth;
    const sh = stage.clientHeight || window.innerHeight;
    const fitted = Math.min(sw / W, sh / H);
    const css = SDW.touch || fitted < 2 ? fitted : Math.floor(fitted);
    scale = SDW.clamp(Math.ceil(css * (window.devicePixelRatio || 1)), 1, 8);
    if (canvas.width !== W * scale) {
      canvas.width = W * scale;
      canvas.height = H * scale;
    }
    canvas.style.width = `${Math.floor(W * css)}px`;
    canvas.style.height = `${Math.floor(H * css)}px`;
  }
  window.addEventListener('resize', fit);
  window.addEventListener('sdw-layout', () => requestAnimationFrame(fit));
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  fit();

  async function boot() {
    SDW.art.init();
    input.bindTouch();
    const fontReady = document.fonts ? Promise.race([
      Promise.all([document.fonts.load(`8px ${FONT}`), document.fonts.load(`16px ${FONT}`), document.fonts.load(`24px ${FONT}`)]),
      new Promise((r) => setTimeout(r, 2500)),
    ]) : Promise.resolve();
    try {
      const [dario, suit] = await Promise.all([
        loadImage('assets/dario.png'),
        loadImage('assets/dario-suit.png'),
      ]);
      game.images = { dario, suit };
    } catch (e) {
      game.error = e.message;
    }
    await fontReady.catch(() => {});
    newSession();
    setState(game.error ? 'boot' : 'title');
    audio.startSong('plains');
    if (!game.error) debugStart();
  }

  // Developer shortcuts: ?play=<index|kind|name> jumps straight into a level,
  // ?mini=<name> opens a mini-game, ?power=0|1|2 sets Dario's form,
  // ?buddy=1 adds Clawd, ?state=shop|story|ending|map opens a screen.
  function debugStart() {
    const q = new URLSearchParams(location.search);
    if (q.has('power')) game.session.power = +q.get('power');
    if (q.has('buddy')) game.session.buddy = true;
    if (q.has('tokens')) game.session.tokens = +q.get('tokens');
    const want = q.get('play');
    if (want != null) {
      const LIST = SDW.levels.LIST;
      const i = /^\d+$/.test(want) ? +want : LIST.findIndex((d) => d.kind === want || d.name === want.toUpperCase().replace(/[-_]/g, ' '));
      if (LIST[i]) { game.startLevel(i); setState('level'); audio.startSong(LIST[i].music); }
    }
    const mini = q.get('mini');
    if (mini && SDW.mini[mini]) {
      if (game.state !== 'level') { game.startLevel(0); setState('level'); }
      game.world.startMini(new SDW.mini[mini]({}), () => {});
    }
    const st = q.get('state');
    if (st === 'shop') { SDW.shop.open(); setState('shop'); }
    else if (st === 'story' || st === 'ending' || st === 'map') setState(st);
  }

  // ---------------------------------------------------------- main loop --
  let last = performance.now();
  let acc = 0;
  const STEP = 1000 / 60;
  function frame(now) {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= STEP) {
      input.poll();
      if (game.state !== 'boot') update();
      input.endStep();
      acc -= STEP;
    }
    draw();
    if (game.error) game.text(ctx, game.error, W / 2, H / 2 + 12, '#ff7a7a', 'center');
    requestAnimationFrame(frame);
  }

  boot();
  requestAnimationFrame(frame);
})();
