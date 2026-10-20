'use strict';
// The two parody bosses: THE LEATHER JACKET (a GPU tycoon you can't really
// beat, only outlast) and THE HYPE-MAN (the final boss).
SDW.bosses = (() => {
  const T = SDW.T;
  const E = SDW.ent;
  const sfx = (n) => SDW.audio.play(n);
  const R = (...a) => SDW.art.R(...a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const FLOOR = 12 * T;

  // ------------------------------------------------------------- sprites --
  const JACKET = [
    '......kkkkkkkk......',
    '.....khHhhHhhHk.....',
    '....khHhhHhhHhhk....',
    '....kHhhhhhhhhHk....',
    '....khsssssssshk....',
    '....ksseessseeSk....',
    '....kssssssssssk....',
    '....ksssssSssssk....',
    '....kssmmmmmsssk....',
    '.....kssssssssk.....',
    '......kkSSSSkk......',
    '...kkkJJkTTkJJkkk...',
    '..kJjJJJkTTkJJJjJk..',
    '.kJjwJJJkTTkJJJwjJk.',
    '.kJjJJJJkTTkJJJJjJk.',
    '.kJjJJJJJkkJJJJJjJk.',
    '.kJjJJJJJJJJJJJJjJk.',
    '.kJJkJJJJJJJJJJkJJk.',
    '.kssk.kJJJJJJk.kssk.',
    '..kk..kPPPPPPk..kk..',
    '......kPPPPPPk......',
    '......kPPkkPPk......',
    '......kPPkkPPk......',
    '......kPPkkPPk......',
    '.....kBBBkkBBBk.....',
    '.....kkkkkkkkkk.....',
  ];
  const HYPE = [
    '......kkkkkkkk......',
    '.....kHHhHHhHHk.....',
    '....kHhHHhHHhHHk....',
    '....kHssssssssHk....',
    '....kssssssssssk....',
    '....kswwesswwesk....',
    '....kswwesswwesk....',
    '....kssssSsssssk....',
    '....ksssmmmssssk....',
    '.....kssssssssk.....',
    '......kkSSSSkk......',
    '....kkGGGkkGGGkk....',
    '...kGGgGGGGGGgGGk...',
    '...kGgGGGGGGGGgGk...',
    '...kGgGGGGGGGGgGk...',
    '...kGgGGGGGGGGgGk...',
    '...kGgkGGGGGGkgGk...',
    '...ksskGGGGGGkssk...',
    '......kDDDDDDk......',
    '......kDDDDDDk......',
    '......kDDkkDDk......',
    '......kDDkkDDk......',
    '......kDDkkDDk......',
    '.....kWWWkkWWWk.....',
    '.....kkkkkkkkkk.....',
  ];
  const PAL = {
    jacket: { k: '#0b0a0e', H: '#2b2b30', h: '#9a9aa6', s: '#e3ab7c', S: '#b87a50', e: '#1a1010', m: '#8a3a2a',
      J: '#1c1c22', j: '#4a4a58', w: '#b0b6c6', T: '#0d0d10', P: '#25252d', B: '#050505' },
    hype: { k: '#1a1018', H: '#6a4226', h: '#8f5e36', s: '#f0c29c', S: '#d09a74', w: '#ffffff', e: '#2a1a10', m: '#a0503a',
      G: '#9aa0aa', g: '#c4c9d2', D: '#3a5a8a', W: '#f4f4f4' },
  };

  // Variants built by editing rows: walking legs and a throwing arm.
  const swap = (rows, edits) => rows.map((r, i) => (edits[i] != null ? edits[i] : r));
  const JACKET_WALK = swap(JACKET, { 21: '......kPPk.kPPk.....', 22: '.....kPPk...kPPk....', 23: '.....kPPk...kPPk....', 24: '....kBBBk...kBBBk...' });
  const JACKET_THROW = swap(JACKET, {
    9: '.....kssssssssk.kssk', 10: '......kkSSSSkk.kJJk.', 11: '...kkkJJkTTkJJkJJk..',
    17: '.kJJkJJJJJJJJJJJJk..', 18: '.kssk.kJJJJJJk......', 19: '..kk..kPPPPPPk......',
  });
  const HYPE_ARMS = swap(HYPE, { 11: '.kk.kkGGGkkGGGkk.kk.', 12: '.kskGGgGGGGGGgGGkSk.', 13: '..kGGgGGGGGGGGgGGk..', 17: '...kGGkGGGGGGkGGk...' });
  const HYPE_SIT = swap(HYPE, { 20: '.....kDDDDDDDDk.....', 21: '.....kDDkkkkDDk.....', 22: '.....kWWk..kWWk.....', 23: '....................', 24: '....................' });

  let S = null;
  function sprites() {
    if (S) return S;
    const pix = SDW.art.pix;
    S = {
      jacket: pix(JACKET, PAL.jacket),
      jacketWalk: pix(JACKET_WALK, PAL.jacket),
      jacketThrow: pix(JACKET_THROW, PAL.jacket),
      hype: pix(HYPE, PAL.hype),
      hypeArms: pix(HYPE_ARMS, PAL.hype),
      hypeSit: pix(HYPE_SIT, PAL.hype),
    };
    return S;
  }

  // Speech bubble that stays on screen.
  function bubble(ctx, text, cx, bottom) {
    const w = text.length * 8 + 10;
    let x = Math.round(cx - w / 2);
    x = SDW.clamp(x, 4, SDW.W - w - 4);
    const y = Math.max(18, Math.round(bottom - 18));
    R(ctx, '#1d1533', x - 1, y - 1, w + 2, 16);
    R(ctx, '#ffffff', x, y, w, 14);
    const tx = SDW.clamp(Math.round(cx), x + 6, x + w - 8);
    R(ctx, '#1d1533', tx - 1, y + 14, 6, 4);
    R(ctx, '#ffffff', tx, y + 14, 4, 3);
    SDW.game.text(ctx, text, x + w / 2, y + 3, '#1d1533', 'center');
  }

  class BossBase extends E.Enemy {
    constructor(x, y, w, h, arena) {
      super(x * T, -90, w, h);
      this.isBoss = true;
      this.arena = arena;
      this.state = 'wait';
      this.st = 0;
      this.hurtT = 0;
      this.line = null;
      this.lineT = 0;
    }
    say(text, frames = 150) {
      this.line = text;
      this.lineT = frames;
      sfx('talk');
    }
    get left() { return (this.arena + 1) * T; }
    get right() { return (this.arena + 23) * T - this.w; }
    setState(s) { this.state = s; this.st = 0; }
    flipKill() { /* bosses shrug off shells and blocks */ }
    tickTalk() {
      if (this.lineT > 0 && --this.lineT === 0) this.line = null;
      if (this.lineT > 0 && this.lineT % 9 === 0 && this.lineT > 100) sfx('talk');
    }
    drawLine(ctx, camX) {
      if (this.line) bubble(ctx, this.line, this.x + this.w / 2 - camX, this.y - 6);
    }
  }

  // ------------------------------------------------- THE LEATHER JACKET --
  // A GPU tycoon's keynote. You can't beat him: every stomp just pumps his
  // market cap. Survive until the earnings call ends.
  const JACKET_LINES = [
    'THE MORE YOU BUY, THE MORE YOU SAVE!', 'EVERY PIXEL WILL BE GENERATED!', 'ACCELERATED COMPUTING, BABY!',
    'I LOVE THIS JACKET.', 'SHOVELS! GET YOUR SHOVELS!', 'DEMAND IS INSANE!', 'SOLD OUT UNTIL NEXT YEAR!',
  ];
  const JACKET_HIT = ['THANKS FOR THE PURCHASE!', 'STOCK UP 5%!', 'YOU BOUGHT ANOTHER RACK!', 'CHA-CHING!', 'ANOTHER BILLION, LOL'];

  class Jacket extends BossBase {
    constructor(x, y, arena) {
      super(x, y, 26, 50, arena);
      this.type = 'jacket';
      this.timer = 45 * 60;
      this.cap = 3.1;
      this.pose = 'stand';
      this.nextAttack = 90;
      this.sparkSaid = 0;
    }
    update(world) {
      this.t++;
      this.st++;
      if (this.hurtT > 0) this.hurtT--;
      if (this.sparkSaid > 0) this.sparkSaid--;
      this.tickTalk();
      const p = world.player;
      const onFloor = () => {
        this.vy += 0.35;
        this.y += this.vy;
        if (this.y + this.h >= FLOOR) {
          const hard = this.vy > 4;
          this.y = FLOOR - this.h;
          this.vy = 0;
          return hard ? 'land' : 'ground';
        }
        return null;
      };

      switch (this.state) {
        case 'wait':
          if (world.lockX != null) { this.setState('intro'); this.x = (this.arena + 15) * T; this.y = -80; this.vy = 0; }
          return;
        case 'intro':
          if (onFloor() === 'land') { world.shake = 14; sfx('boom'); this.say('WELCOME TO MY KEYNOTE!', 160); }
          if (this.st > 170) { this.setState('walk'); this.say('BUY MORE GPUS!'); }
          return;
        case 'walk': {
          const want = p.x < this.x ? 1 : -1; // keep a little distance
          const dist = Math.abs(p.x - this.x);
          this.dir = p.x > this.x ? 1 : -1;
          this.vx = dist < 90 ? want * 1.1 : dist > 160 ? -want * 0.7 : 0;
          this.x = SDW.clamp(this.x + this.vx, this.left, this.right);
          onFloor();
          this.pose = this.vx ? ((this.t >> 3) % 2 ? 'walk' : 'stand') : 'stand';
          if (--this.nextAttack <= 0) {
            const speedUp = this.timer < 20 * 60 ? 0.7 : 1;
            this.nextAttack = Math.floor(SDW.rand(70, 110) * speedUp);
            this.setState(pick(['toss', 'toss', 'jacket', 'hop']));
          }
          if (!this.line && this.t % 260 === 0) this.say(pick(JACKET_LINES));
          break;
        }
        case 'toss':
          this.pose = 'throw';
          this.dir = p.x > this.x ? 1 : -1;
          if (this.st === 20 || this.st === 45 || (this.timer < 20 * 60 && this.st === 70)) {
            const sx = this.x + this.w / 2;
            const dx = p.x + p.w / 2 - sx + SDW.rand(-24, 24);
            const proj = new E.Proj('crate', sx - 6, this.y + 6, SDW.clamp(dx / 55, -3.2, 3.2), -5.2, { g: 0.2, bounces: 1, stompable: true, life: 300 });
            world.ents.push(proj);
            sfx('throw');
          }
          onFloor();
          if (this.st > 85) this.setState('walk');
          break;
        case 'jacket':
          this.pose = this.st < 40 ? 'throw' : 'stand';
          if (this.st === 1) this.say('CATCH! IT\'S A LIMITED EDITION!', 90);
          if (this.st === 30) {
            const d = p.x > this.x ? 1 : -1;
            const proj = new E.Proj('jacket', this.x + this.w / 2 - 7, FLOOR - 24, d * 4.2, 0, { w: 14, h: 12, life: 400 });
            world.ents.push(proj);
            sfx('throw');
          }
          onFloor();
          if (this.st > 120) this.setState('walk');
          break;
        case 'hop': {
          if (this.st === 1) {
            const mid = (this.left + this.right) / 2;
            this.vy = -7.5;
            this.vx = (this.x < mid ? this.right - this.x : this.left - this.x) / 42;
          }
          this.x = SDW.clamp(this.x + this.vx, this.left, this.right);
          this.pose = 'throw';
          const r = onFloor();
          if (r === 'land' || (r === 'ground' && this.st > 10)) {
            world.shake = 12;
            sfx('boom');
            for (let i = 0; i < 2; i++) {
              const fx = SDW.rand(this.left, this.right);
              world.ents.push(new E.Proj('crate', fx, 20, 0, 0.5, { g: 0.12, bounces: 0, life: 300 }));
            }
            this.vx = 0;
            this.setState('walk');
          }
          break;
        }
        case 'leaving':
          this.pose = 'throw';
          if (this.st === 1) { this.say('GREAT QUARTER, EVERYONE!', 200); this.vy = -2; }
          if (this.st > 100) { this.vy -= 0.25; this.y += this.vy; }
          if (this.st === 220) {
            world.ents.push(new E.Item('trophy', (this.arena + 11.5) * T, 2 * T, true));
            world.text('HE LEFT WITH ALL YOUR TOKENS', (this.arena + 4) * T, 80);
          }
          if (this.st > 230) this.dead = true;
          return;
      }
      // The keynote clock.
      this.timer--;
      this.cap += 0.0011;
      if (this.timer <= 0) {
        this.setState('leaving');
        for (const e of world.ents) if (e.proj) { e.dead = true; world.puff(e.x + 6, e.y + 6, '#76d82a'); }
      }
    }
    get stompable() { return ['walk', 'toss', 'jacket', 'hop'].includes(this.state) && this.hurtT === 0; }
    set stompable(v) { /* derived */ }
    get harmless() { return ['wait', 'intro', 'leaving'].includes(this.state) || this.hurtT > 0; }
    set harmless(v) { /* derived */ }
    stomp(world) {
      this.hurtT = 70;
      this.cap += 0.4;
      this.say(pick(JACKET_HIT), 100);
      world.addScore(1000, this.x, this.y - 10);
      world.shake = 6;
      sfx('cash');
    }
    sparked() {
      this.cap += 0.05;
      if (!this.sparkSaid) { this.say('MORE COMPUTE? BUY IT FROM ME!', 90); this.sparkSaid = 200; }
    }
    draw(ctx, camX, t) {
      if (this.state === 'wait') return;
      const s = sprites();
      const img = this.pose === 'throw' ? s.jacketThrow : this.pose === 'walk' ? s.jacketWalk : s.jacket;
      const sx = Math.round(this.x + this.w / 2 - 20 - camX);
      const sy = Math.round(this.y + this.h - 52);
      if (this.hurtT > 0 && (t >> 2) % 2) ctx.globalAlpha = 0.5;
      ctx.save();
      if (this.dir > 0) { ctx.translate(sx + 40, sy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, 40, 52); } else ctx.drawImage(img, sx, sy, 40, 52);
      ctx.restore();
      ctx.globalAlpha = 1;
      this.drawLine(ctx, camX);
    }
    // Screen-space panel: the stock ticker and the countdown.
    drawHud(ctx, t) {
      if (this.state === 'wait') return;
      R(ctx, 'rgba(5,16,10,0.85)', 70, 18, 244, 28);
      R(ctx, '#76d82a', 70, 18, 244, 1);
      SDW.game.text(ctx, `NVIDIOUS CAP $${this.cap.toFixed(1)}T`, 76, 22, '#c8ff7a');
      SDW.game.text(ctx, (t >> 4) % 2 ? '^' : ' ', 300, 22, '#76d82a');
      const secs = Math.max(0, Math.ceil(this.timer / 60));
      SDW.game.text(ctx, this.state === 'leaving' ? 'EARNINGS CALL OVER!' : `SURVIVE THE KEYNOTE: ${secs}`, 76, 34, secs <= 10 ? '#ffd84a' : '#ffffff');
    }
  }

  // -------------------------------------------------------- THE HYPE-MAN --
  const HYPE_PHASE = ['', 'THIS IS THE GENTLE SINGULARITY.', "WE'LL FIGURE OUT REVENUE LATER.", 'I NEED 7 TRILLION DOLLARS.',
    "IT'S JUST A RESEARCH PREVIEW.", 'FEEL THE AGI!'];
  const HYPE_BUBBLES = ['AGI SOON', 'FEEL IT', 'SCALE!', '$7T', 'NEXT WEEK', 'SOTA'];
  const HYPE_PODCAST = ['SO, ANYWAY, AGI...', 'I THINK ABOUT THIS A LOT.', "IT'S A REALLY GOOD QUESTION.", 'HONESTLY? VIBES.'];

  class HypeMan extends BossBase {
    constructor(x, y, arena) {
      super(x, y, 24, 46, arena);
      this.type = 'hypeman';
      this.hp = 5;
      this.homeX = x * T;
      this.attacks = 0;
      this.sparkSaid = 0;
    }
    update(world) {
      this.t++;
      this.st++;
      if (this.hurtT > 0) this.hurtT--;
      if (this.sparkSaid > 0) this.sparkSaid--;
      this.tickTalk();
      const p = world.player;
      const fast = 5 - this.hp; // 0..4
      this.dir = p.x > this.x ? 1 : -1;
      switch (this.state) {
        case 'wait':
          if (world.lockX != null) { this.setState('intro'); this.y = -70; }
          return;
        case 'intro':
          this.y += (40 - this.y) * 0.03;
          if (this.st === 60) this.say("HI! I'M HERE TO SAVE THE WORLD.", 170);
          if (this.st > 230) { this.setState('float'); this.say(HYPE_PHASE[this.hp]); }
          return;
        case 'float':
          this.x += (this.homeX + Math.sin(this.t * 0.02) * 120 - this.x) * 0.05;
          this.y = 36 + Math.sin(this.t * 0.06) * 6;
          if (this.st > 80 - fast * 10) {
            if (this.attacks >= (this.hp > 3 ? 1 : 2)) { this.attacks = 0; this.setState('descend'); } else { this.attacks++; this.setState(pick(['hype', 'raise'])); }
          }
          break;
        case 'hype':
          this.y = 36 + Math.sin(this.t * 0.06) * 6;
          if (this.st % 40 === 1 && this.st < 40 * (2 + (fast > 2 ? 1 : 0))) {
            const b = new E.Proj('bubble', this.x + 6, this.y + 10, this.dir * 0.6, 0.4, { w: 16, h: 12, home: 0.03 + fast * 0.004, life: 330, label: pick(HYPE_BUBBLES) });
            world.ents.push(b);
            sfx('talk');
          }
          if (this.st > 150) this.setState('float');
          break;
        case 'raise':
          this.y = 36 + Math.sin(this.t * 0.06) * 6;
          if (this.st === 1) this.say(pick(['TIME TO RAISE A ROUND!', 'INVESTORS, ASSEMBLE!', 'PRE-MONEY: EVERYTHING.']), 110);
          if (this.st % (14 - fast) === 0 && this.st < 110) {
            const bx = SDW.rand(this.left, this.right + this.w - 14);
            world.ents.push(new E.Proj('bag', bx, -16, 0, 0.6, { w: 14, h: 14, g: 0.09, life: 400 }));
            sfx('cash');
          }
          if (this.st > 170) this.setState('float');
          break;
        case 'descend':
          // Floats down to the floor to record a podcast. That's your chance.
          if (this.st === 1) {
            this.targetX = SDW.clamp(p.x + (p.x > (this.left + this.right) / 2 ? -100 : 100), this.left, this.right);
            this.say('BRB, RECORDING A PODCAST.', 100);
          }
          this.x += (this.targetX - this.x) * 0.06;
          this.y += (FLOOR - this.h - this.y) * 0.07;
          if (this.st > 50) { this.setState('podcast'); this.say(pick(HYPE_PODCAST), 150); }
          break;
        case 'podcast':
          this.y = FLOOR - this.h;
          if (this.st > 170 - fast * 15) this.setState('rise');
          break;
        case 'rise':
          this.y += (36 - this.y) * 0.06;
          if (this.st > 60) this.setState('float');
          break;
        case 'dying':
          if (this.st % 6 === 0) world.puff(this.x + SDW.rand(0, 24), this.y + SDW.rand(0, 40), pick(['#ffd84a', '#ff7ad9', '#ffffff']));
          if (this.st === 1) { this.say('AGI ACHIEVED... INTERNALLY.', 200); SDW.audio.stopMusic(); }
          this.y += (FLOOR - this.h - this.y) * 0.05;
          if (this.st > 210) {
            this.dead = true;
            world.puff(this.x + 12, this.y + 20, '#ffffff');
            world.ents.push(new E.Item('trophy', (this.arena + 11.5) * T, 2 * T, true));
          }
          return;
      }
    }
    get stompable() { return (this.state === 'podcast' || this.state === 'descend') && this.hurtT === 0; }
    set stompable(v) { /* derived */ }
    get harmless() { return ['wait', 'intro', 'dying'].includes(this.state) || this.hurtT > 0; }
    set harmless(v) { /* derived */ }
    stomp(world) {
      this.hp--;
      this.hurtT = 80;
      world.shake = 16;
      sfx('bossHit');
      if (this.hp <= 0) {
        this.setState('dying');
        world.addScore(20000, this.x, this.y - 10);
        for (const e of world.ents) if (e.proj) e.flipKill(world);
      } else {
        world.addScore(3000, this.x, this.y - 10);
        this.setState('rise');
        this.say(HYPE_PHASE[this.hp], 160);
      }
    }
    sparked() {
      if (!this.sparkSaid) { this.say('NICE TRY. I HAVE A MOAT.', 90); this.sparkSaid = 200; }
    }
    draw(ctx, camX, t) {
      if (this.state === 'wait') return;
      if (this.state === 'dying' && (t >> 2) % 2) return;
      const s = sprites();
      const sitting = this.state === 'podcast';
      const img = sitting ? s.hypeSit : this.state === 'hype' || this.state === 'raise' ? s.hypeArms : s.hype;
      const sx = Math.round(this.x + this.w / 2 - 20 - camX);
      const sy = Math.round(this.y + this.h - 50);
      // Hype cloud when airborne, podcast set when sitting.
      if (!sitting && this.state !== 'dying') {
        const cy = sy + 50;
        SDW.art.cloudShape(ctx, sx + 20, cy, 1, '#ffe0f4', '#ff7ad9');
        if ((t >> 3) % 2) SDW.game.text(ctx, 'HYPE', sx + 20, cy, '#c0258a', 'center');
      } else if (sitting) {
        R(ctx, '#1d1533', sx + 2, sy + 30, 36, 6);
        R(ctx, '#ff7ad9', sx + 3, sy + 31, 34, 4);
        R(ctx, '#1d1533', sx + 8, sy + 36, 3, 14); R(ctx, '#1d1533', sx + 29, sy + 36, 3, 14);
        // microphone
        R(ctx, '#1d1533', sx + 40, sy + 18, 2, 32);
        R(ctx, '#1d1533', sx + 34, sy + 14, 9, 7);
        R(ctx, '#9aa0aa', sx + 35, sy + 15, 7, 5);
        if ((t >> 4) % 2) SDW.game.text(ctx, 'ON AIR', sx + 20, sy - 12, '#ff5a5a', 'center');
      }
      if (this.hurtT > 0 && (t >> 2) % 2) ctx.globalAlpha = 0.5;
      ctx.drawImage(img, sx, sy, 40, 50);
      ctx.globalAlpha = 1;
      this.drawLine(ctx, camX);
    }
    drawHud(ctx) {
      if (this.state === 'wait') return;
      R(ctx, 'rgba(26,11,58,0.85)', 112, 18, 160, 18);
      SDW.game.text(ctx, 'HYPE', 118, 23, '#ff7ad9');
      for (let i = 0; i < 5; i++) {
        R(ctx, '#1d1533', 158 + i * 22, 22, 20, 10);
        if (i < this.hp) R(ctx, (i + (this.t >> 3)) % 5 === 0 ? '#ffffff' : '#ff7ad9', 159 + i * 22, 23, 18, 8);
      }
    }
  }

  return { Jacket, HypeMan, bubble, sprites };
})();
