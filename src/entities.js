'use strict';
// Player, enemies, items, platforms and effects.
(() => {
  const T = SDW.T;
  const A = () => SDW.art.S;
  const sfx = (n) => SDW.audio.play(n);

  // ------------------------------------------------------------ player --
  const PHYS = {
    accWalk: 0.08, accRun: 0.11, maxWalk: 1.4, maxRun: 2.5,
    friction: 0.08, skid: 0.2, airAcc: 0.07,
    gHold: 0.22, gUp: 0.6, gFall: 0.4, maxFall: 4.8,
    jump: 5.2, jumpRunBonus: 0.3,
  };
  // Rows of the Dario sprite sheets.
  const ROW = { idle: 0, runR: 1, runL: 2, wave: 3, jump: 4, fail: 5 };

  class Player {
    constructor(world, x, bottom, power) {
      this.world = world;
      this.power = power;
      this.duck = false;
      this.setDims();
      this.x = x;
      this.y = bottom - this.h;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.jumping = false;
      this.inv = 0;
      this.dead = false;
      this.deadT = 0;
      this.dist = 0;
      this.combo = 0;
      this.plat = null;
      this.prevPower = power;
      this.waveT = 0;
    }

    setDims() {
      const bottom = this.y + this.h;
      this.w = this.power ? 12 : 10;
      this.h = this.power ? (this.duck ? 18 : 28) : this.duck ? 14 : 20;
      if (!isNaN(bottom)) this.y = bottom - this.h;
    }

    setPower(p) {
      this.prevPower = this.power;
      this.power = p;
      this.setDims();
      this.world.freeze = 36;
    }

    hurt() {
      if (this.inv > 0 || this.dead || this.world.state !== 'play') return;
      if (this.buddy) {
        // Clawd takes the hit and runs off to cool down.
        this.world.ents.push(new BuddyLeaving(this.buddy));
        this.buddy = null;
        SDW.game.session.buddy = false;
        this.inv = 120;
        sfx('hurt');
      } else if (this.power > 0) {
        this.setPower(this.power === 2 ? 1 : 0);
        this.inv = 120;
        sfx('hurt');
      } else {
        this.die();
      }
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.deadT = 0;
      this.vx = 0;
      this.vy = 0;
      SDW.audio.stopMusic();
      sfx('die');
    }

    update(inp) {
      const w = this.world;
      if (this.dead) {
        this.deadT++;
        if (this.deadT === 30) this.vy = -5;
        if (this.deadT > 30) {
          this.vy = Math.min(this.vy + 0.22, 5);
          this.y += this.vy;
        }
        return;
      }

      const held = w.state === 'clear' ? { right: true } : inp.held;
      const pressed = w.state === 'clear' ? {} : inp.pressed;

      // Ducking (keeps your feet where they are).
      const wantDuck = this.onGround && held.down && !held.left && !held.right;
      if (wantDuck !== this.duck) {
        if (wantDuck || !w.blockedAbove(this, this.power ? 28 : 20)) {
          this.duck = wantDuck;
          this.setDims();
        }
      }

      // Horizontal movement.
      const dir = this.duck ? 0 : (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const run = w.state === 'play'; // Dario always runs
      const max = w.state === 'clear' ? 1.1 : run ? PHYS.maxRun : PHYS.maxWalk;
      if (dir) {
        this.facing = dir;
        if (this.vx * dir < 0) {
          this.vx += dir * (this.onGround ? PHYS.skid : PHYS.airAcc * 1.5);
        } else if (Math.abs(this.vx) < max) {
          this.vx += dir * (this.onGround ? (run ? PHYS.accRun : PHYS.accWalk) : PHYS.airAcc);
          if (Math.abs(this.vx) > max) this.vx = dir * max;
        } else if (this.onGround) {
          this.vx -= Math.sign(this.vx) * PHYS.friction * 0.5;
        }
      } else {
        const f = this.onGround ? PHYS.friction : 0.02;
        if (Math.abs(this.vx) <= f) this.vx = 0;
        else this.vx -= Math.sign(this.vx) * f;
      }

      // Jumping, with a little coyote time and input buffering.
      if (pressed.jump) this.jumpBuf = 7;
      this.coyote = this.onGround ? 6 : this.coyote - 1;
      if (this.jumpBuf > 0 && this.coyote > 0) {
        this.vy = -(PHYS.jump + Math.abs(this.vx) * PHYS.jumpRunBonus);
        this.jumping = true;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.onGround = false;
        this.plat = null;
        sfx('jump');
      }
      this.jumpBuf--;
      this.jumping = this.jumping && held.jump;
      const g = this.vy < 0 ? (this.jumping ? PHYS.gHold : PHYS.gUp) : PHYS.gFall;
      this.vy = Math.min(this.vy + g, PHYS.maxFall);

      // Ride moving platforms.
      if (this.plat) {
        this.x += this.plat.dx;
        if (this.vy >= 0) this.y = this.plat.y - this.h;
      }

      const prevBottom = this.y + this.h;
      const res = w.moveBody(this, true);
      this.onGround = res.ground;
      if (res.ground) {
        this.vy = 0;
        this.combo = 0;
      }
      if (res.ceil) {
        this.vy = Math.max(this.vy, 0.5);
        this.jumping = false;
        w.bumpFromBelow(res.ceilTiles, res.ceilRow, this);
      }
      if (res.left || res.right) this.vx = 0;

      // Conveyor belts carry you along.
      if (res.ground) {
        const under = w.tile(Math.floor((this.x + this.w / 2) / T), Math.floor((this.y + this.h + 1) / T));
        if (under === '>' || under === '<') {
          const keep = [this.vx, this.vy];
          this.vx = under === '>' ? 1.1 : -1.1;
          this.vy = 0;
          w.moveBody(this, true);
          [this.vx, this.vy] = keep;
        }
      }

      // Land on moving platforms.
      this.plat = null;
      if (this.vy >= 0) {
        for (const p of w.ents) {
          if (p.type !== 'plat') continue;
          const within = this.x + this.w > p.x && this.x < p.x + p.w;
          if (within && prevBottom <= p.y + Math.max(0, p.dy) + 1 && this.y + this.h >= p.y) {
            this.y = p.y - this.h;
            this.vy = 0;
            this.onGround = true;
            this.combo = 0;
            this.plat = p;
          }
        }
      }

      // Keep inside the level (and the boss arena).
      const minX = w.lockX != null ? w.lockX + 16 : 0;
      if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx); }
      const maxX = w.w * T - this.w;
      if (this.x > maxX) { this.x = maxX; this.vx = 0; }

      if (res.spike) this.hurt();
      if (w.touches(this, '~', 6)) this.die();
      if (this.y > w.h * T + 8) this.die();
      w.collectTokens(this);

      // Sparks (powered-up form).
      if (pressed.spark && this.power === 2 && !this.duck) {
        const live = w.ents.filter((e) => e.type === 'spark').length;
        if (live < 2) {
          w.ents.push(new Spark(this.x + this.w / 2 + this.facing * 6, this.y + this.h * 0.35, this.facing));
          sfx('spark');
        }
      }

      if (this.buddy) this.buddy.update(w, this);
      if (this.inv > 0) this.inv--;
      this.dist += Math.abs(this.vx);
      this.skidding = this.onGround && dir && this.vx * dir < 0;
    }

    draw(ctx, camX, t) {
      if (this.inv > 0 && (t >> 1) % 2 && !this.dead) return;
      let power = this.power;
      if (this.world.freeze > 0 && !this.dead) power = (this.world.freeze >> 2) % 2 ? this.prevPower : this.power;
      const size = SDW.game.darioSize(power);
      let row = ROW.idle;
      let frame = Math.floor(t / 10) % 6;
      const runRow = this.facing > 0 ? ROW.runR : ROW.runL;
      if (this.dead) {
        row = ROW.fail;
        frame = Math.min(7, Math.floor(this.deadT / 10));
      } else if (this.waveT > 0) {
        row = ROW.wave;
        frame = Math.floor(this.waveT / 8) % 4;
      } else if (this.duck) {
        row = ROW.jump;
        frame = 2;
      } else if (!this.onGround) {
        row = runRow;
        frame = this.vy < 0 ? 3 : 6;
      } else if (this.skidding) {
        row = ROW.jump;
        frame = 0;
      } else if (Math.abs(this.vx) > 0.05) {
        row = runRow;
        frame = Math.floor(this.dist / (Math.abs(this.vx) > 2 ? 7 : 6)) % 8;
      }
      const sx = this.x + this.w / 2 - size.w / 2 - camX;
      const sy = this.y + this.h - size.h;
      SDW.game.drawDario(ctx, power, row, frame, sx, sy);
    }
  }

  // ------------------------------------------------------------ enemies --
  class Enemy {
    constructor(x, y, w, h) {
      Object.assign(this, { x, y, w, h, vx: 0, vy: 0, dir: -1 });
      this.enemy = true;
      this.active = false;
      this.dead = false;
      this.dying = false;
      this.stompable = true;
      this.t = 0;
    }
    walk(world, speed, turnAtLedge) {
      this.vx = this.dir * speed;
      this.vy = Math.min(this.vy + 0.3, 4);
      if (turnAtLedge && this.onGround) {
        const fx = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
        const below = world.tile(Math.floor(fx / T), Math.floor((this.y + this.h + 2) / T));
        if (!SDW.art.solid(below) && below !== '-') this.dir *= -1;
        this.vx = this.dir * speed;
      }
      const res = world.moveBody(this, false);
      this.onGround = res.ground;
      if (res.ground) this.vy = 0;
      if (res.left) this.dir = 1;
      if (res.right) this.dir = -1;
      if (this.y > world.h * T + 32) this.dead = true;
      if (world.touches(this, '~', 6)) this.dead = true;
      return res;
    }
    // Knocked out by a spark, a sliding robot or a bumped block.
    flipKill(world, points = 200) {
      if (this.dying) return;
      this.dying = true;
      this.vy = -3.5;
      this.vx = Math.sign(this.x - world.player.x || 1) * 1;
      world.addScore(points, this.x, this.y);
      sfx('kick');
    }
    updateDying() {
      this.vy += 0.25;
      this.x += this.vx;
      this.y += this.vy;
      if (this.y > 300) this.dead = true;
    }
    drawSprite(ctx, img, camX, ox, oy) {
      const sx = Math.round(this.x - camX + ox);
      const sy = Math.round(this.y + oy);
      if (this.dying) {
        ctx.save();
        ctx.translate(sx + img.width / 2, sy + img.height / 2);
        ctx.scale(1, -1);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx, sy);
      }
    }
  }

  class Bug extends Enemy {
    constructor(x, y) { super(x * T + 1, (y + 1) * T - 12, 14, 12); this.type = 'bug'; this.flat = 0; }
    update(world) {
      this.t++;
      if (this.flat) { if (--this.flat === 0) this.dead = true; return; }
      this.walk(world, 0.5, false);
    }
    stomp(world) {
      this.flat = 30;
      this.stompable = false;
      this.harmless = true;
      sfx('stomp');
    }
    draw(ctx, camX) {
      const s = A();
      const face = this.dir > 0 ? 'R' : 'L';
      const img = this.flat ? s.bugFlat[face] : s.bug[(this.t >> 3) % 2][face];
      this.drawSprite(ctx, img, camX, -1, -4);
    }
  }

  class Hopper extends Enemy {
    constructor(x, y) { super(x * T + 1, (y + 1) * T - 12, 14, 12); this.type = 'hopper'; this.hopT = 40; }
    update(world) {
      this.t++;
      if (this.onGround && --this.hopT <= 0) {
        this.vy = -4.6;
        this.hopT = 50;
        this.onGround = false;
      }
      this.walk(world, 0.6, false);
    }
    stomp(world) {
      // Losing its wings turns it into a regular bug.
      const b = new Bug(0, 0);
      Object.assign(b, { x: this.x, y: this.y, dir: this.dir, active: true });
      world.ents.push(b);
      this.dead = true;
      sfx('stomp');
    }
    draw(ctx, camX) {
      const face = this.dir > 0 ? 'R' : 'L';
      const fr = this.onGround ? (this.t >> 4) % 2 : (this.t >> 2) % 2;
      this.drawSprite(ctx, A().hopper[fr][face], camX, -1, -4);
    }
  }

  class Robot extends Enemy {
    constructor(x, y) { super(x * T + 2, (y + 1) * T - 13, 12, 13); this.type = 'robot'; this.off = 0; this.kickGrace = 0; }
    get sliding() { return this.off > 0 && this.vx !== 0; }
    update(world) {
      this.t++;
      if (this.kickGrace > 0) this.kickGrace--;
      if (this.off > 0) {
        this.vy = Math.min(this.vy + 0.3, 4);
        const res = world.moveBody(this, false);
        if (res.ground) this.vy = 0;
        if (res.left || res.right) { this.vx = -this.vx; sfx('bump'); }
        if (this.vx !== 0) {
          for (const e of world.ents) {
            if (e !== this && e.enemy && !e.dying && !e.dead && !e.isBoss && SDW.overlap(this, e)) e.flipKill(world, 400);
          }
          if (this.x < world.camX - 64 || this.x > world.camX + SDW.W + 64) this.dead = true;
        } else if (--this.off === 0) {
          this.stompable = true;
          this.dir = world.player.x < this.x ? -1 : 1;
        }
        if (this.y > world.h * T + 32 || world.touches(this, '~', 6)) this.dead = true;
        return;
      }
      this.walk(world, 0.45, true);
    }
    stomp(world, player) {
      if (this.off > 0 && this.vx !== 0) {
        this.vx = 0;
        this.off = 420;
      } else {
        this.off = 420;
        this.vx = 0;
      }
      sfx('stomp');
    }
    kick(world, player) {
      this.vx = player.x + player.w / 2 < this.x + this.w / 2 ? 3.6 : -3.6;
      this.kickGrace = 14;
      sfx('kick');
      world.addScore(100, this.x, this.y);
    }
    draw(ctx, camX, t) {
      const face = this.dir > 0 ? 'R' : 'L';
      let img;
      let ox = -2;
      if (this.off > 0) {
        img = A().robotOff[face];
        if (this.vx === 0 && this.off < 60) ox += (t >> 1) % 2 ? 1 : -1;
      } else {
        img = A().robot[(this.t >> 3) % 2][face];
      }
      this.drawSprite(ctx, img, camX, ox, -3);
    }
  }

  class Ghost extends Enemy {
    constructor(x, y) { super(x * T + 1, y * T + 1, 14, 14); this.type = 'ghost'; this.baseY = this.y; this.puff = 0; }
    update(world) {
      this.t++;
      if (this.puff) { if (--this.puff === 0) this.dead = true; return; }
      const p = world.player;
      const dx = p.x + p.w / 2 - (this.x + this.w / 2);
      this.dir = dx > 0 ? 1 : -1;
      this.vx += this.dir * 0.02;
      this.vx = SDW.clamp(this.vx, -0.55, 0.55);
      this.x += this.vx;
      const dy = p.y - this.baseY;
      this.baseY += SDW.clamp(dy, -0.25, 0.25);
      this.y = this.baseY + Math.sin(this.t * 0.06) * 6;
    }
    stomp(world) {
      this.puff = 16;
      this.stompable = false;
      this.harmless = true;
      world.puff(this.x + 7, this.y + 7, '#e9d0ff');
      sfx('stomp');
    }
    draw(ctx, camX) {
      if (this.puff) return;
      const face = this.dir > 0 ? 'R' : 'L';
      ctx.globalAlpha = 0.9;
      this.drawSprite(ctx, A().ghost[(this.t >> 4) % 2][face], camX, -1, -1);
      ctx.globalAlpha = 1;
    }
  }

  // The final boss: a giant hallucination wearing a crown.
  class Boss extends Enemy {
    constructor(x, y, arena) {
      super(x * T, -60, 40, 40);
      this.type = 'boss';
      this.isBoss = true;
      this.arena = arena;
      this.hp = 3;
      this.state = 'wait';
      this.st = 0;
      this.hurtT = 0;
      this.homeX = x * T;
      this.spawnT = 0;
    }
    update(world) {
      this.t++;
      this.st++;
      if (this.hurtT > 0) this.hurtT--;
      const p = world.player;
      const floor = 12 * T - this.h - 2;
      switch (this.state) {
        case 'wait':
          if (world.lockX != null) { this.state = 'intro'; this.st = 0; }
          return;
        case 'intro':
          this.y += (40 - this.y) * 0.04;
          if (this.st > 120) { this.state = 'float'; this.st = 0; }
          break;
        case 'float': {
          const speed = 0.018 + (3 - this.hp) * 0.006;
          this.x = this.homeX + Math.sin(this.t * speed) * 130;
          this.y = 40 + Math.sin(this.t * 0.05) * 10;
          if (this.st > 200 - (3 - this.hp) * 40) {
            this.state = 'swoop';
            this.st = 0;
            this.targetX = SDW.clamp(p.x - this.w / 2, this.arena * T + 20, (this.arena + 24) * T - this.w - 20);
          }
          break;
        }
        case 'swoop':
          this.x += (this.targetX - this.x) * 0.08;
          this.y += (floor - this.y) * 0.08;
          if (this.st > 50) { this.state = 'linger'; this.st = 0; }
          break;
        case 'linger':
          this.y = floor + Math.sin(this.st * 0.3) * 2;
          if (this.st > 45) { this.state = 'rise'; this.st = 0; }
          break;
        case 'rise':
          this.y += (40 - this.y) * 0.06;
          this.x += (this.homeX + Math.sin(this.t * 0.02) * 130 - this.x) * 0.06;
          if (this.st > 50) { this.state = 'float'; this.st = 0; }
          break;
        case 'dying':
          if (this.st % 8 === 0) world.puff(this.x + SDW.rand(0, 40), this.y + SDW.rand(0, 40), '#f4dcff');
          if (this.st > 120) {
            this.dead = true;
            world.ents.push(new Item('trophy', (this.arena + 11.5) * T, 2 * T, true));
          }
          return;
      }
      this.dir = p.x > this.x ? 1 : -1;
      // Summon small hallucinations now and then.
      if (this.state !== 'intro' && ++this.spawnT > 280) {
        this.spawnT = 0;
        const minis = world.ents.filter((e) => e.type === 'ghost' && !e.dead && !e.dying && e.x > this.arena * T).length;
        if (minis < 2) {
          const g = new Ghost(0, 0);
          Object.assign(g, { x: this.x + 13, y: this.y + 13, baseY: this.y + 13, active: true });
          world.ents.push(g);
        }
      }
    }
    get stompable() { return this.state !== 'wait' && this.state !== 'intro' && this.state !== 'dying' && this.hurtT === 0; }
    set stompable(v) { /* derived */ }
    get harmless() { return this.state === 'wait' || this.state === 'dying' || this.hurtT > 0; }
    set harmless(v) { /* derived */ }
    stomp(world) {
      this.hp--;
      this.hurtT = 90;
      sfx('bossHit');
      world.shake = 16;
      if (this.hp <= 0) {
        this.state = 'dying';
        this.st = 0;
        world.addScore(10000, this.x + 10, this.y);
        for (const e of world.ents) if (e.type === 'ghost') e.flipKill(world, 0);
        SDW.audio.stopMusic();
      } else {
        this.state = 'rise';
        this.st = 0;
        world.addScore(2000, this.x + 10, this.y);
      }
    }
    flipKill() { /* immune to sparks and shells */ }
    draw(ctx, camX, t) {
      if (this.state === 'wait') return;
      if (this.state === 'dying' && (t >> 2) % 2) return;
      const face = this.dir > 0 ? 'R' : 'L';
      const img = this.hurtT > 0 && (t >> 2) % 2 ? A().ghostHurt[face] : A().ghost[(this.t >> 4) % 2][face];
      const sx = Math.round(this.x - camX - 4);
      const sy = Math.round(this.y - 4);
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, sx, sy, 48, 48);
      ctx.globalAlpha = 1;
      // Crown
      const R = SDW.art.R;
      const cx = sx + 12;
      const cy = sy - 6;
      R(ctx, '#7a4a00', cx - 1, cy + 2, 26, 9);
      R(ctx, '#ffc83a', cx, cy + 3, 24, 7);
      for (const px of [0, 9, 18]) {
        R(ctx, '#7a4a00', cx + px - 1, cy - 3, 8, 6);
        R(ctx, '#ffc83a', cx + px, cy - 2, 6, 6);
      }
      R(ctx, '#fff3b0', cx, cy + 3, 24, 1);
      R(ctx, '#ff3b5c', cx + 10, cy + 5, 4, 3);
      R(ctx, '#38e0ff', cx + 3, cy + 6, 2, 2);
      R(ctx, '#38e0ff', cx + 19, cy + 6, 2, 2);
      // Health pips
      for (let i = 0; i < 3; i++) {
        R(ctx, '#1d1533', sx + 11 + i * 9, sy - 18, 8, 4);
        if (i < this.hp) R(ctx, '#ff5a8a', sx + 12 + i * 9, sy - 17, 6, 2);
      }
    }
  }

  // ------------------------------------------------------------- items --
  class Item {
    constructor(kind, x, y, fromAbove) {
      this.type = 'item';
      this.kind = kind;
      this.w = 14;
      this.h = 14;
      this.x = x + 1;
      this.y = y + 2;
      this.vx = 0;
      this.vy = 0;
      this.dead = false;
      this.active = true;
      this.t = 0;
      if (fromAbove) {
        this.emerge = 0;
      } else {
        this.emerge = 16;
        this.blockTop = y;
        sfx('sprout');
      }
      this.speed = kind === 'chip' ? 1 : kind === 'disk' ? 1.2 : kind === 'clawd' ? 0.9 : 0;
    }
    update(world) {
      this.t++;
      if (this.emerge > 0) {
        this.y -= 0.5;
        this.emerge -= 0.5;
        if (this.emerge <= 0) this.vx = this.speed;
        return;
      }
      this.vy = Math.min(this.vy + 0.3, 4);
      const res = world.moveBody(this, false);
      if (res.ground) this.vy = this.kind === 'clawd' ? -3.2 : 0; // Clawd hops about
      if (res.left) this.vx = Math.abs(this.vx);
      if (res.right) this.vx = -Math.abs(this.vx);
      if (this.y > world.h * T + 32) this.dead = true;
    }
    collect(world, p) {
      this.dead = true;
      const g = SDW.game.session;
      if (this.kind === 'chip') {
        if (p.power === 0) { p.setPower(1); sfx('power'); } else sfx('token');
        world.addScore(1000, this.x, this.y);
      } else if (this.kind === 'bolt') {
        if (p.power !== 2) { p.setPower(2); sfx('power'); } else sfx('token');
        world.addScore(1000, this.x, this.y);
      } else if (this.kind === 'disk') {
        g.lives++;
        sfx('life');
        world.text('1UP', this.x, this.y);
      } else if (this.kind === 'clawd') {
        if (p.buddy) world.addScore(1000, this.x, this.y);
        else { p.buddy = new Buddy(p); world.text('CLAWD JOINED!', this.x - 30, this.y - 6); }
        sfx('buddy');
      } else if (this.kind === 'trophy') {
        world.win();
      }
    }
    draw(ctx, camX, t) {
      const s = A();
      const sx = Math.round(this.x - camX - 1);
      const sy = Math.round(this.y - 2);
      if (this.emerge > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx - 2, this.blockTop - 32, 20, 32);
        ctx.clip();
      }
      if (this.kind === 'chip') ctx.drawImage(s.chip, sx, sy);
      else if (this.kind === 'bolt') ctx.drawImage(s.bolt, sx, sy + ((t >> 3) % 2));
      else if (this.kind === 'disk') ctx.drawImage(s.disk, sx, sy);
      else if (this.kind === 'trophy') drawTrophy(ctx, sx, sy, t);
      else if (this.kind === 'clawd') ctx.drawImage(s.clawd[(t >> 3) % 2][this.vx > 0 ? 'R' : 'L'], sx, sy + 4);
      if (this.emerge > 0) ctx.restore();
    }
  }

  function drawTrophy(ctx, x, y, t) {
    const R = SDW.art.R;
    R(ctx, '#7a4a00', x + 1, y - 1, 14, 9);
    R(ctx, '#ffc83a', x + 2, y, 12, 7);
    R(ctx, '#fff3b0', x + 3, y + 1, 3, 4);
    R(ctx, '#7a4a00', x - 1, y + 1, 3, 4);
    R(ctx, '#7a4a00', x + 14, y + 1, 3, 4);
    R(ctx, '#d98a00', x + 6, y + 7, 4, 4);
    R(ctx, '#7a4a00', x + 3, y + 11, 10, 4);
    R(ctx, '#ffc83a', x + 4, y + 12, 8, 2);
    if ((t >> 3) % 4 === 0) R(ctx, '#ffffff', x + 12, y + 1, 1, 1);
  }

  class Spark {
    constructor(x, y, dir) {
      Object.assign(this, { type: 'spark', x: x - 3, y: y - 3, w: 6, h: 6, vx: dir * 4.5, vy: 0, life: 40, dead: false, active: true, t: 0 });
    }
    update(world) {
      this.t++;
      this.x += this.vx;
      this.y += Math.sin(this.t * 0.6) * 0.8;
      if (--this.life <= 0) this.dead = true;
      const tx = Math.floor((this.x + 3) / T);
      const ty = Math.floor((this.y + 3) / T);
      if (SDW.art.solid(world.tile(tx, ty))) {
        this.dead = true;
        world.puff(this.x + 3, this.y + 3, '#fff36b');
      }
      for (const e of world.ents) {
        if (e.enemy && !e.dying && !e.dead && !e.harmless && SDW.overlap(this, e)) {
          this.dead = true;
          if (e.isBoss) { world.puff(this.x + 3, this.y + 3, '#fff36b'); if (e.sparked) e.sparked(world); } else e.flipKill(world, 200);
          break;
        }
      }
    }
    draw(ctx, camX, t) {
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      const y = Math.round(this.y);
      const c = (t >> 1) % 2 ? '#fff36b' : '#ffffff';
      R(ctx, '#3f7dff', x, y + 2, 6, 2);
      R(ctx, '#3f7dff', x + 2, y, 2, 6);
      R(ctx, c, x + 1, y + 2, 4, 2);
      R(ctx, c, x + 2, y + 1, 2, 4);
    }
  }

  // ------------------------------------------------------- level props --
  class Platform {
    constructor(x, y, opts) {
      this.type = 'plat';
      this.x = x * T;
      this.y = y * T;
      this.w = 48;
      this.h = 6;
      this.x0 = this.x;
      this.y0 = this.y;
      this.range = opts.range * T;
      this.axis = opts.axis || 'x';
      this.speed = opts.speed || 0.6;
      this.pos = 0;
      this.dirn = 1;
      this.dx = 0;
      this.dy = 0;
      this.active = true;
    }
    update() {
      this.pos += this.dirn * this.speed;
      if (this.pos >= this.range) { this.pos = this.range; this.dirn = -1; }
      if (this.pos <= 0) { this.pos = 0; this.dirn = 1; }
      const nx = this.axis === 'x' ? this.x0 + this.pos : this.x0;
      const ny = this.axis === 'y' ? this.y0 - this.pos : this.y0;
      this.dx = nx - this.x;
      this.dy = ny - this.y;
      this.x = nx;
      this.y = ny;
    }
    draw(ctx, camX) {
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      const y = Math.round(this.y);
      R(ctx, '#1d2230', x, y, 48, 7);
      R(ctx, '#ffb347', x + 1, y + 1, 46, 4);
      R(ctx, '#fff0c0', x + 1, y + 1, 46, 1);
      for (let i = 4; i < 46; i += 8) R(ctx, '#b86a14', x + i, y + 3, 4, 2);
    }
  }

  class Checkpoint {
    constructor(x, y) {
      this.type = 'checkpoint';
      this.x = x * T + 4;
      this.bottom = (y + 1) * T;
      this.y = this.bottom - 48;
      this.w = 8;
      this.h = 48;
      this.hit = false;
      this.active = true;
    }
    update(world) {
      if (!this.hit && SDW.overlap(world.player, this)) {
        this.hit = true;
        world.checkpointHit = true;
        sfx('checkpoint');
        world.text('SAVED', this.x - 8, this.y);
        if (world.player.power === 0) { world.player.setPower(1); sfx('power'); }
      }
    }
    draw(ctx, camX, t) {
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      R(ctx, '#1d2230', x + 2, this.y, 3, 48);
      R(ctx, '#c9d2df', x + 3, this.y, 1, 48);
      R(ctx, '#1d2230', x, this.bottom - 3, 8, 3);
      const wav = this.hit ? Math.round(Math.sin(t * 0.15) * 1) : 0;
      const col = this.hit ? '#3dd16a' : '#9aa3b5';
      R(ctx, '#1d2230', x + 5, this.y + 1, 14, 10);
      R(ctx, col, x + 5, this.y + 2 + wav, 13, 8);
      // tiny floppy glyph on the banner
      R(ctx, '#1d2230', x + 9, this.y + 4 + wav, 5, 4);
      R(ctx, '#ffffff', x + 10, this.y + 5 + wav, 3, 1);
    }
  }

  class Goal {
    constructor(x, y) {
      this.type = 'goal';
      this.x = x * T;
      this.bottom = (y + 1) * T;
      this.top = this.bottom - 9 * T;
      this.barY = this.top + 8;
      this.barDir = 1;
      this.barGone = false;
      this.active = true;
      this.done = false;
    }
    update(world) {
      this.barY += this.barDir * 1.2;
      if (this.barY > this.bottom - 12) this.barDir = -1;
      if (this.barY < this.top + 8) this.barDir = 1;
      const p = world.player;
      if (this.done || p.dead) return;
      const bar = { x: this.x + 8, y: this.barY - 2, w: 48, h: 6 };
      if (!this.barGone && SDW.overlap(p, bar)) {
        this.barGone = true;
        const frac = 1 - (this.barY - this.top) / (this.bottom - this.top);
        const pts = Math.max(100, Math.round(frac * 50) * 100);
        world.addScore(pts, p.x, p.y - 10);
      }
      if (p.x + p.w / 2 > this.x + 16) {
        this.done = true;
        world.clear();
      }
    }
    drawBack(ctx, camX, t) {
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      this.post(ctx, x + 2, t);
      if (!this.barGone) {
        const y = Math.round(this.barY);
        R(ctx, '#1d1533', x + 8, y - 3, 48, 7);
        R(ctx, (t >> 3) % 2 ? '#9b84ff' : '#c4b5ff', x + 9, y - 2, 46, 5);
        R(ctx, '#ffffff', x + 9, y - 2, 46, 1);
      }
    }
    drawFront(ctx, camX, t) {
      this.post(ctx, Math.round(this.x - camX) + 54, t);
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      // "SHIP IT" sign on top
      R(ctx, '#1d1533', x - 2, this.top - 14, 68, 13);
      R(ctx, '#6b4fd6', x - 1, this.top - 13, 66, 11);
      SDW.game.text(ctx, 'SHIP IT', x + 32, this.top - 11, '#ffffff', 'center');
    }
    post(ctx, x, t) {
      const R = SDW.art.R;
      R(ctx, '#1d2230', x, this.top, 8, this.bottom - this.top);
      R(ctx, '#7f8aa3', x + 1, this.top, 6, this.bottom - this.top);
      R(ctx, '#b8c2d6', x + 1, this.top, 1, this.bottom - this.top);
      for (let y = this.top + 6, n = 0; y < this.bottom - 4; y += 10, n++) {
        R(ctx, (n + (t >> 4)) % 3 === 0 ? '#4dff88' : '#2a5a3a', x + 3, y, 2, 2);
      }
    }
  }

  // Paperclip maximizer: harmless alone, but it keeps making more of itself.
  class Paperclip extends Enemy {
    constructor(x, y) { super(x * T + 1, (y + 1) * T - 13, 14, 13); this.type = 'clip'; this.flat = 0; this.copyT = 200 + Math.floor(SDW.rand(0, 120)); }
    update(world) {
      this.t++;
      if (this.flat) { if (--this.flat === 0) this.dead = true; return; }
      this.walk(world, 0.4, true);
      if (--this.copyT <= 0) {
        this.copyT = 320;
        const clips = world.ents.filter((e) => e.type === 'clip' && !e.dead && !e.dying).length;
        const onScreen = this.x > world.camX && this.x < world.camX + SDW.W;
        if (clips < 7 && onScreen && this.onGround) {
          const c = new Paperclip(0, 0);
          Object.assign(c, { x: this.x, y: this.y - 6, vy: -3, dir: -this.dir, active: true, copyT: 360 });
          world.ents.push(c);
          world.text('+1 CLIP', this.x - 8, this.y - 10);
          sfx('sprout');
        }
      }
    }
    stomp() { this.flat = 30; this.stompable = false; this.harmless = true; sfx('stomp'); }
    draw(ctx, camX) {
      const face = this.dir > 0 ? 'R' : 'L';
      const img = this.flat ? A().clipFlat[face] : A().paperclip[(this.t >> 3) % 2][face];
      this.drawSprite(ctx, img, camX, -1, -3);
    }
  }

  // Clawd follows Dario around and zaps nearby enemies.
  class Buddy {
    constructor(p) {
      this.x = p.x - 14;
      this.y = p.y;
      this.t = 0;
      this.cool = 40;
      this.face = 1;
    }
    update(world, p) {
      this.t++;
      const tx = p.x + p.w / 2 - p.facing * 16 - 8;
      const ty = p.y + p.h - 22 + Math.sin(this.t * 0.12) * 2;
      this.x += (tx - this.x) * 0.12;
      this.y += (ty - this.y) * 0.12;
      this.face = p.facing;
      if (--this.cool > 0) return;
      let best = null;
      let bd = 170;
      for (const e of world.ents) {
        if (!e.enemy || e.dead || e.dying || e.harmless || !e.active || e.isBoss) continue;
        const d = Math.hypot(e.x + e.w / 2 - this.x, e.y + e.h / 2 - this.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        world.ents.push(new BuddyShot(this.x + 8, this.y + 4, best));
        sfx('zap');
        this.cool = 75;
      } else this.cool = 10;
    }
    draw(ctx, camX, t) {
      ctx.drawImage(A().clawd[(t >> 3) % 2][this.face > 0 ? 'R' : 'L'], Math.round(this.x - camX), Math.round(this.y));
    }
  }

  // A runaway Clawd (after taking a hit for Dario).
  class BuddyLeaving {
    constructor(b) { Object.assign(this, { type: 'fx', x: b.x, y: b.y, vx: -b.face * 2, vy: -3, active: true, dead: false, t: 0 }); }
    update(world) {
      this.t++;
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.15;
      if (this.t === 1) world.text('BRB, RATE LIMITED', this.x - 40, this.y - 10);
      if (this.t > 120) this.dead = true;
    }
    draw(ctx, camX, t) {
      if ((t >> 2) % 2) ctx.drawImage(A().clawd[0][this.vx > 0 ? 'R' : 'L'], Math.round(this.x - camX), Math.round(this.y));
    }
  }

  class BuddyShot {
    constructor(x, y, target) {
      Object.assign(this, { type: 'spark', x: x - 3, y: y - 3, w: 7, h: 7, target, life: 70, dead: false, active: true, t: 0 });
      const d = Math.hypot(target.x - x, target.y - y) || 1;
      this.vx = ((target.x + target.w / 2 - x) / d) * 3.5;
      this.vy = ((target.y + target.h / 2 - y) / d) * 3.5;
    }
    update(world) {
      this.t++;
      const g = this.target;
      if (g && !g.dead && !g.dying) {
        const d = Math.hypot(g.x + g.w / 2 - this.x, g.y + g.h / 2 - this.y) || 1;
        this.vx += ((g.x + g.w / 2 - this.x) / d) * 0.35;
        this.vy += ((g.y + g.h / 2 - this.y) / d) * 0.35;
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 4) { this.vx *= 4 / sp; this.vy *= 4 / sp; }
      }
      this.x += this.vx;
      this.y += this.vy;
      if (--this.life <= 0) this.dead = true;
      for (const e of world.ents) {
        if (e.enemy && !e.dying && !e.dead && !e.harmless && !e.isBoss && SDW.overlap(this, e)) {
          this.dead = true;
          e.flipKill(world, 200);
          world.puff(this.x + 3, this.y + 3, '#f0a07c');
          break;
        }
      }
    }
    draw(ctx, camX, t) {
      ctx.save();
      ctx.translate(Math.round(this.x - camX + 3.5), Math.round(this.y + 3.5));
      ctx.rotate(Math.floor(t / 4) * (Math.PI / 4));
      ctx.drawImage(A().star, -3.5, -3.5);
      ctx.restore();
    }
  }

  // Billboards and signs with jokes. Pure decoration.
  class Sign {
    constructor(x, y, lines, style) {
      this.type = 'sign';
      this.lines = lines;
      this.style = style || 'board';
      this.active = true;
      const wChars = Math.max(...lines.map((l) => l.length));
      this.w = wChars * 8 + 10;
      this.h = lines.length * 10 + 6;
      this.x = x * T + 8 - this.w / 2;
      this.bottom = (y + 1) * T;
      this.post = this.style === 'float' ? 0 : 18;
      this.y = this.bottom - this.h - this.post;
    }
    update() {}
    draw(ctx, camX, t) {
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      const y = this.y;
      if (x > SDW.W || x + this.w < 0) return;
      const st = this.style;
      if (this.post) {
        R(ctx, '#1d1533', x + 6, y + this.h, 4, this.post);
        R(ctx, '#1d1533', x + this.w - 10, y + this.h, 4, this.post);
        R(ctx, '#6b5a7a', x + 7, y + this.h, 2, this.post);
        R(ctx, '#6b5a7a', x + this.w - 9, y + this.h, 2, this.post);
      }
      const frame = { board: ['#1d1533', '#f4ead2', '#3a2a5a'], neon: ['#0d0f12', '#10131a', '#76d82a'], warn: ['#1d1533', '#ffcc33', '#1d1533'], hype: ['#1d1533', '#2a1a4a', '#ff7ad9'] }[st] || ['#1d1533', '#f4ead2', '#3a2a5a'];
      R(ctx, frame[0], x, y, this.w, this.h);
      R(ctx, frame[1], x + 1, y + 1, this.w - 2, this.h - 2);
      if (st === 'neon' || st === 'hype') {
        const on = (t >> 5) % 8 !== 0;
        ctx.strokeStyle = on ? frame[2] : '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2.5, y + 2.5, this.w - 5, this.h - 5);
      }
      const col = st === 'board' || st === 'warn' ? frame[2] : frame[2];
      this.lines.forEach((l, i) => {
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = col;
        ctx.fillText(l, x + this.w / 2, y + 4 + i * 10);
      });
    }
  }

  // The cooling door in the data center: touch it to play Rack Stack.
  class RackDoor {
    constructor(x, top, bottom) {
      Object.assign(this, { type: 'rackdoor', tx: x, top, bottom, x: x * T - 30, y: (bottom + 1) * T - 26, w: 18, h: 26, open: false, active: true });
    }
    update(world) {
      const p = world.player;
      if (this.open || p.dead) return;
      if (p.x + p.w >= this.tx * T - 3 && p.onGround) {
        p.vx = 0;
        p.x = this.tx * T - p.w - 4;
        world.startMini(new SDW.mini.rackstack({ lines: 4 }), () => {
          this.open = true;
          for (let ty = this.top; ty <= this.bottom; ty++) {
            world.setTile(this.tx, ty, '.');
            world.puff(this.tx * T + 8, ty * T + 8, '#7fe0ff');
          }
          sfx('door');
          world.shake = 10;
          world.text('COOLING ONLINE!', this.tx * T - 50, this.top * T + 40);
          world.addScore(2000, p.x, p.y - 20);
        });
      }
    }
    draw(ctx, camX, t) {
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      const y = this.y;
      // terminal
      R(ctx, '#1d2230', x, y, 18, 26);
      R(ctx, '#3a4152', x + 1, y + 1, 16, 24);
      R(ctx, '#0b1020', x + 3, y + 3, 12, 9);
      if (!this.open) {
        R(ctx, (t >> 4) % 2 ? '#ff5a5a' : '#7a1a2a', x + 4, y + 4, 10, 2);
        R(ctx, '#ff5a5a', x + 4, y + 8, 6, 1);
      } else {
        R(ctx, '#3dd16a', x + 4, y + 4, 10, 2);
        R(ctx, '#3dd16a', x + 4, y + 8, 8, 1);
      }
      for (let i = 0; i < 3; i++) R(ctx, '#7f8aa3', x + 4 + i * 4, y + 16, 2, 2);
      if (!this.open && (t >> 5) % 2) SDW.game.text(ctx, 'RACK FULL!', x - 12, y - 14, '#ff9a9a');
    }
  }

  // "429" rate-limit gate: a laser fence that switches on and off.
  class Gate {
    constructor(x, top, bottom, period = 150, offset = 0) {
      Object.assign(this, { type: 'gate', tx: x, top, bottom, period, t: offset, on: true, active: true, x: x * T, y: top * T, w: T, h: (bottom - top + 1) * T });
    }
    update(world) {
      this.t++;
      const want = this.t % (this.period * 2) < this.period;
      if (want !== this.on) {
        const p = world.player;
        if (want && SDW.overlap(p, this)) return; // never close on Dario
        this.on = want;
        for (let ty = this.top; ty <= this.bottom; ty++) world.setTile(this.tx, ty, want ? '=' : '.');
        if (Math.abs(this.x - world.player.x) < SDW.W) sfx(want ? 'bump' : 'select');
      }
    }
    draw(ctx, camX, t) {
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      R(ctx, '#1d1533', x + 2, this.y - 12, 12, 10);
      SDW.game.text(ctx, '429', x + 8, this.y - 11, this.on ? '#ff5a5a' : '#3dd16a', 'center');
      if (!this.on) {
        for (let y = this.y; y < this.y + this.h; y += 6) R(ctx, 'rgba(61,209,106,0.25)', x + 7, y, 2, 3);
        return;
      }
      const flick = (t >> 1) % 2;
      R(ctx, 'rgba(255,90,90,0.25)', x + 2, this.y, 12, this.h);
      R(ctx, flick ? '#ff5a5a' : '#ffb0b0', x + 5, this.y, 2, this.h);
      R(ctx, flick ? '#ffb0b0' : '#ff5a5a', x + 9, this.y, 2, this.h);
      const left = Math.max(0, Math.ceil((this.period - (this.t % (this.period * 2))) / 60));
      if (left <= 2) SDW.game.text(ctx, `${left}`, x + 8, this.y + this.h / 2, '#ffffff', 'center');
    }
  }

  // Projectiles thrown by bosses. They hurt on touch; sparks pop most of them.
  class Proj extends Enemy {
    constructor(kind, x, y, vx, vy, opts = {}) {
      super(x, y, opts.w || 12, opts.h || 12);
      Object.assign(this, { type: 'proj', proj: true, kind, vx, vy, active: true, life: opts.life || 400, g: opts.g || 0 });
      this.stompable = !!opts.stompable;
      this.label = opts.label;
      this.bounces = opts.bounces || 0;
      this.home = opts.home || 0;
      this.ox = x;
    }
    update(world) {
      this.t++;
      if (--this.life <= 0) { this.dead = true; return; }
      const p = world.player;
      if (this.home) {
        const dx = p.x + p.w / 2 - (this.x + this.w / 2);
        const dy = p.y + p.h / 2 - (this.y + this.h / 2);
        const d = Math.hypot(dx, dy) || 1;
        this.vx += (dx / d) * this.home;
        this.vy += (dy / d) * this.home;
        const sp = Math.hypot(this.vx, this.vy);
        const max = 1.3;
        if (sp > max) { this.vx *= max / sp; this.vy *= max / sp; }
      }
      if (this.kind === 'jacket') {
        this.vx -= Math.sign(this.vx0 || (this.vx0 = this.vx)) * 0.06; // boomerang
        if (this.t > 60 && Math.abs(this.x - this.ox) < 8) this.dead = true;
      }
      this.vy += this.g;
      this.x += this.vx;
      this.y += this.vy;
      if (this.g && this.y + this.h >= 12 * T) {
        this.y = 12 * T - this.h;
        if (this.bounces-- > 0) { this.vy = -this.vy * 0.55; sfx('bump'); } else { this.dead = true; world.puff(this.x + 6, this.y + 6, this.kind === 'bag' ? '#ffd84a' : '#76d82a'); }
      }
      if (this.y > 15 * T || this.x < world.camX - 80 || this.x > world.camX + SDW.W + 80) this.dead = true;
    }
    stomp(world) { this.dead = true; world.puff(this.x + 6, this.y + 6, '#ffffff'); sfx('stomp'); }
    flipKill(world) { this.dead = true; world.puff(this.x + 6, this.y + 6, '#ffffff'); world.addScore(100, this.x, this.y); }
    draw(ctx, camX, t) {
      const R = SDW.art.R;
      const x = Math.round(this.x - camX);
      const y = Math.round(this.y);
      if (this.kind === 'crate') {
        R(ctx, '#0d0f12', x - 1, y - 1, 14, 14);
        R(ctx, '#2c3138', x, y, 12, 12);
        R(ctx, '#76d82a', x, y, 12, 2);
        R(ctx, '#76d82a', x + 2, y + 5, 8, 4);
        R(ctx, '#0d0f12', x + 4, y + 6, 4, 2);
        R(ctx, (t >> 2) % 2 ? '#c8ff7a' : '#3f8a12', x + 9, y + 10, 2, 1);
      } else if (this.kind === 'jacket') {
        ctx.save();
        ctx.translate(x + 7, y + 7);
        ctx.rotate(this.t * 0.4);
        R(ctx, '#0a0a0e', -7, -6, 14, 12);
        R(ctx, '#2a2a34', -6, -5, 12, 10);
        R(ctx, '#6a6a7a', -5, -5, 2, 8);
        R(ctx, '#0a0a0e', -1, -5, 2, 10);
        R(ctx, '#9aa0b0', 3, -4, 1, 3);
        ctx.restore();
      } else if (this.kind === 'bag') {
        R(ctx, '#1d1533', x, y + 2, 14, 12);
        R(ctx, '#3a8a2a', x + 1, y + 3, 12, 10);
        R(ctx, '#1d1533', x + 4, y - 1, 6, 4);
        R(ctx, '#ffd84a', x + 4, y + 5, 6, 6);
        SDW.game.text(ctx, '$', x + 7, y + 4, '#1d1533', 'center');
      } else if (this.kind === 'bubble') {
        const label = this.label || 'AGI SOON';
        const w = label.length * 8 + 8;
        R(ctx, '#1d1533', x - w / 2 + 6, y - 2, w, 16);
        R(ctx, (t >> 3) % 2 ? '#ffffff' : '#ffe0f4', x - w / 2 + 7, y - 1, w - 2, 14);
        R(ctx, '#ffffff', x + 4, y + 13, 4, 3);
        SDW.game.text(ctx, label, x + 6, y + 2, '#c0258a', 'center');
      } else {
        R(ctx, '#76d82a', x, y, this.w, this.h);
      }
    }
  }

  SDW.ent = { Player, Enemy, Bug, Hopper, Robot, Ghost, Boss, Item, Spark, Platform, Checkpoint, Goal,
    Paperclip, Buddy, BuddyLeaving, BuddyShot, Sign, RackDoor, Gate, Proj, drawTrophy };
})();
