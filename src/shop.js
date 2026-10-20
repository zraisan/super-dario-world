'use strict';
// The GPU shop on the overworld map. Run by a familiar man in a leather
// jacket. Every purchase makes everything more expensive.
SDW.shop = (() => {
  const W = SDW.W;
  const H = SDW.H;
  const R = (...a) => SDW.art.R(...a);
  const sfx = (n) => SDW.audio.play(n);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const ITEMS = [
    { id: 'chip', name: 'COMPUTE CHIP', desc: 'START EVERY LEVEL BIG.', base: 15, icon: 'chip',
      have: (s) => s.power >= 1, apply: (s) => { s.power = Math.max(s.power, 1); } },
    { id: 'bolt', name: 'SPARK BOLT', desc: 'SUIT UP AND THROW ZAPS.', base: 30, icon: 'bolt',
      have: (s) => s.power >= 2, apply: (s) => { s.power = 2; } },
    { id: 'clawd', name: 'CLAWD BUDDY', desc: 'PAIR PROGRAMMER. ZAPS BUGS.', base: 25, icon: 'clawd',
      have: (s) => s.buddy, apply: (s) => { s.buddy = true; } },
    { id: 'disk', name: 'BACKUP DISK', desc: '+1 LIFE. RESTORE FROM BACKUP.', base: 20, icon: 'disk',
      have: () => false, apply: (s) => { s.lives++; } },
    { id: 'gpu', name: 'MYSTERY GPU', desc: 'DOES NOTHING. +5000 PTS. VIBES.', base: 40, icon: 'gpu',
      have: () => false, apply: (s) => { s.score += 5000; } },
    { id: 'exit', name: 'LEAVE SHOP', desc: 'SEE YOU NEXT QUARTER.' },
  ];
  const HELLO = ['WELCOME TO THE GPU STORE!', 'THE MORE YOU BUY, THE MORE YOU SAVE!', 'EVERYTHING MUST GO. TO ME.'];
  const THANKS = ['THANKS! PRICES JUST WENT UP.', 'MY JACKET THANKS YOU.', 'ANOTHER RECORD QUARTER!', 'THE MORE YOU BUY...'];
  const POOR = ['NO TOKENS? TRY RAISING A ROUND.', "I DON'T DO FREE TRIALS.", 'COME BACK WITH MORE TOKENS.'];

  const st = { sel: 0, t: 0, line: '', lineT: 0, flash: 0, bought: null };
  const price = (it) => Math.round(it.base * (SDW.game.session.shopMult || 1));
  const say = (line) => { st.line = line; st.lineT = 200; };

  function open() {
    st.sel = 0;
    st.t = 0;
    st.flash = 0;
    say(pick(HELLO));
  }

  // Returns true when the player leaves.
  function update(p) {
    st.t++;
    if (st.lineT > 0) st.lineT--;
    if (st.flash > 0) st.flash--;
    if (p.left || p.up) { st.sel = (st.sel + ITEMS.length - 1) % ITEMS.length; sfx('select'); }
    if (p.right || p.down) { st.sel = (st.sel + 1) % ITEMS.length; sfx('select'); }
    if (p.spark || p.start) { sfx('select'); return true; }
    if (p.jump && st.t > 10) {
      const it = ITEMS[st.sel];
      const s = SDW.game.session;
      if (it.id === 'exit') { sfx('select'); return true; }
      if (it.have(s)) { say('YOU ALREADY HAVE ONE. BUY TWO?'); sfx('bump'); return false; }
      const cost = price(it);
      if (s.tokens < cost) { say(pick(POOR)); sfx('bump'); return false; }
      s.tokens -= cost;
      it.apply(s);
      s.shopMult = (s.shopMult || 1) * 1.25;
      st.flash = 30;
      st.bought = it.id;
      sfx('cash');
      setTimeout(() => sfx('power'), 120);
      say(pick(THANKS));
    }
    return false;
  }

  function icon(ctx, id, x, y, t) {
    const S = SDW.art.S;
    if (id === 'chip') ctx.drawImage(S.chip, x, y);
    else if (id === 'bolt') ctx.drawImage(S.bolt, x, y);
    else if (id === 'disk') ctx.drawImage(S.disk, x, y);
    else if (id === 'clawd') ctx.drawImage(S.clawd[(t >> 4) % 2].R, x, y + 3);
    else if (id === 'gpu') {
      R(ctx, '#0d0f12', x, y + 3, 16, 10);
      R(ctx, '#2c3138', x + 1, y + 4, 14, 8);
      R(ctx, '#76d82a', x + 1, y + 4, 14, 1);
      R(ctx, '#5a6372', x + 4, y + 6, 5, 5);
      R(ctx, '#1c2026', x + 6, y + 8, 1, 1);
      R(ctx, '#ffd24a', x + 2, y + 13, 12, 1);
    } else {
      R(ctx, '#9aa3b5', x + 3, y + 3, 10, 10);
      R(ctx, '#1d1533', x + 5, y + 5, 6, 6);
    }
  }

  function draw(ctx) {
    const t = st.t;
    const g = SDW.game;
    const s = g.session;
    // Store interior.
    ctx.fillStyle = '#07140c';
    ctx.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 32) R(ctx, '#0c2014', x, 30, 30, 140);
    for (let y = 40; y < 170; y += 22) R(ctx, '#173a1c', 0, y, W, 2);
    // Shelves of boxes behind the counter.
    for (let i = 0; i < 12; i++) {
      const bx = 196 + (i % 6) * 30;
      const by = 46 + Math.floor(i / 6) * 22;
      R(ctx, '#0d0f12', bx, by, 24, 16);
      R(ctx, i % 3 ? '#2c3138' : '#3a414c', bx + 1, by + 1, 22, 14);
      R(ctx, '#76d82a', bx + 1, by + 1, 22, 2);
      if ((i + (t >> 5)) % 5 === 0) R(ctx, '#c8ff7a', bx + 18, by + 10, 3, 2);
    }
    // Neon sign.
    const on = (t >> 3) % 40 !== 0;
    R(ctx, '#0d0f12', 70, 4, 244, 22);
    ctx.strokeStyle = on ? '#76d82a' : '#2a3a20';
    ctx.lineWidth = 1;
    ctx.strokeRect(72.5, 6.5, 239, 17);
    g.text(ctx, 'NVIDIOUS GPU STORE', W / 2, 11, on ? '#c8ff7a' : '#3f5a2a', 'center');

    // The shopkeeper behind the counter.
    const sp = SDW.bosses.sprites();
    const bob = Math.round(Math.sin(t * 0.08));
    const jx = 268;
    const jy = 92 + bob;
    ctx.drawImage(st.flash > 0 && (t >> 2) % 2 ? sp.jacketThrow : sp.jacket, jx, jy, 40, 52);
    R(ctx, '#1c2026', 186, 136, 198, 36);
    R(ctx, '#3a414c', 186, 136, 198, 3);
    R(ctx, '#76d82a', 186, 139, 198, 1);
    g.text(ctx, `CASH REGISTER: $${(s.shopMult || 1).toFixed(2)}T`, 284, 152, '#76d82a', 'center');
    if (st.lineT > 0) SDW.bosses.bubble(ctx, st.line, jx + 20, jy - 2);

    // Item list.
    R(ctx, 'rgba(10,8,20,0.85)', 8, 32, 176, 140);
    R(ctx, '#6b4fd6', 8, 32, 176, 1);
    ITEMS.forEach((it, i) => {
      const y = 38 + i * 22;
      const sel = i === st.sel;
      if (sel) R(ctx, (t >> 3) % 2 ? '#3a2a7a' : '#2f2266', 10, y - 2, 172, 20);
      if (it.id !== 'exit') icon(ctx, it.icon, 14, y, t);
      const owned = it.have && it.have(s);
      g.text(ctx, it.name, 34, y + 1, owned ? '#7a8090' : sel ? '#ffffff' : '#c4b5ff');
      if (it.id !== 'exit') {
        const cost = price(it);
        ctx.drawImage(SDW.art.S.token, 34, y + 10, 8, 8);
        g.text(ctx, owned ? 'OWNED' : `${cost}`, 46, y + 10, owned ? '#7a8090' : cost > s.tokens ? '#ff7a7a' : '#ffd84a');
      }
      if (sel) g.text(ctx, '>', 178, y + 4, '#ffd84a', 'right');
    });

    // Footer: wallet, description and controls.
    R(ctx, 'rgba(10,8,20,0.9)', 0, H - 50, W, 50);
    ctx.drawImage(SDW.art.S.token, 10, H - 45, 10, 10);
    g.text(ctx, `YOUR TOKENS: ${s.tokens}`, 24, H - 44, '#ffd84a');
    g.text(ctx, `LIVES: ${s.lives}`, W - 10, H - 44, '#ffffff', 'right');
    g.text(ctx, ITEMS[st.sel].desc, 10, H - 30, '#ffffff');
    g.text(ctx, SDW.touch ? 'D-PAD PICK   JUMP BUY   ZAP LEAVE' : 'ARROWS PICK   Z BUY   X LEAVE', W / 2, H - 14, '#9aa3b5', 'center');
  }

  return { open, update, draw };
})();
