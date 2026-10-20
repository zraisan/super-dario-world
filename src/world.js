'use strict';
// A running level: tile map, collisions, entities, camera and drawing.
(() => {
  const T = SDW.T;
  const E = SDW.ent;
  const sfx = (n) => SDW.audio.play(n);
  const solid = (ch) => SDW.art.solid(ch);

  class World {
    constructor(def, opts) {
      this.def = def;
      this.name = def.name;
      this.theme = def.theme;
      this.w = def.w;
      this.h = def.h;
      this.grid = def.rows.map((r) => r.split(''));
      this.ents = [];
      this.fx = [];
      this.bumps = [];
      this.t = 0;
      this.freeze = 0;
      this.shake = 0;
      this.time = 300;
      this.state = 'play';
      this.stateT = 0;
      this.lockX = null;
      this.checkpointHit = !!opts.checkpoint;
      this.goal = null;

      let startX = def.start.x;
      for (const d of def.ents) {
        let e = null;
        switch (d.type) {
          case 'bug': e = new E.Bug(d.x, d.y); break;
          case 'hopper': e = new E.Hopper(d.x, d.y); break;
          case 'robot': e = new E.Robot(d.x, d.y); break;
          case 'ghost': e = new E.Ghost(d.x, d.y); break;
          case 'clip': e = new E.Paperclip(d.x, d.y); break;
          case 'plat': e = new E.Platform(d.x, d.y, d); break;
          case 'sign': e = new E.Sign(d.x, d.y, d.lines, d.style); break;
          case 'rackdoor': e = new E.RackDoor(d.x, d.top, d.y); break;
          case 'gate':
            e = new E.Gate(d.x, d.top, d.y, d.period, d.offset);
            for (let ty = d.top; ty <= d.y; ty++) this.setTile(d.x, ty, '=');
            break;
          case 'boss': e = new E.Boss(d.x, d.y, d.arena); this.arena = d.arena; break;
          case 'jacket': e = new SDW.bosses.Jacket(d.x, d.y, d.arena); this.arena = d.arena; break;
          case 'hypeman': e = new SDW.bosses.HypeMan(d.x, d.y, d.arena); this.arena = d.arena; break;
          case 'goal': e = this.goal = new E.Goal(d.x, d.y); break;
          case 'checkpoint':
            e = new E.Checkpoint(d.x, d.y);
            if (opts.checkpoint) {
              e.hit = true;
              startX = d.x;
            }
            break;
        }
        if (e) this.ents.push(e);
      }
      // Clear out enemies right next to a checkpoint respawn.
      if (opts.checkpoint) {
        this.ents = this.ents.filter((e) => !e.enemy || e.isBoss || Math.abs(e.x - startX * T) > 6 * T);
      }
      if (def.time) this.time = def.time;
      this.player = new E.Player(this, startX * T + 3, this.findFloor(startX), opts.power);
      if (SDW.game.session.buddy) this.player.buddy = new E.Buddy(this.player);
      this.camX = SDW.clamp(this.player.x - SDW.W / 3, 0, this.w * T - SDW.W);
    }

    findFloor(tx) {
      for (let ty = 2; ty < this.h; ty++) if (solid(this.tile(tx, ty))) return ty * T;
      return 12 * T;
    }

    tile(tx, ty) {
      if (tx < 0 || tx >= this.w) return '#';
      if (ty < 0 || ty >= this.h) return '.';
      return this.grid[ty][tx];
    }

    setTile(tx, ty, ch) {
      if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) this.grid[ty][tx] = ch;
    }

    // Move a body through the tile map, resolving X then Y.
    moveBody(b, isPlayer) {
      const res = { left: false, right: false, ground: false, ceil: false, ceilTiles: [], ceilRow: 0, spike: false };
      const x0 = () => Math.floor(b.x / T);
      const x1 = () => Math.floor((b.x + b.w - 0.01) / T);
      const y0 = () => Math.floor(b.y / T);
      const y1 = () => Math.floor((b.y + b.h - 0.01) / T);

      b.x += b.vx;
      if (b.vx > 0) {
        const tx = x1();
        for (let ty = y0(); ty <= y1(); ty++) {
          const ch = this.tile(tx, ty);
          if (solid(ch)) { b.x = tx * T - b.w; res.right = true; if (ch === '^') res.spike = true; break; }
        }
      } else if (b.vx < 0) {
        const tx = x0();
        for (let ty = y0(); ty <= y1(); ty++) {
          const ch = this.tile(tx, ty);
          if (solid(ch)) { b.x = (tx + 1) * T; res.left = true; if (ch === '^') res.spike = true; break; }
        }
      }

      const prevBottom = b.y + b.h;
      const prevTop = b.y;
      b.y += b.vy;
      if (b.vy > 0) {
        const ty = y1();
        for (let tx = x0(); tx <= x1(); tx++) {
          const ch = this.tile(tx, ty);
          if (solid(ch) || (ch === '-' && prevBottom <= ty * T + 0.01)) {
            b.y = ty * T - b.h;
            res.ground = true;
            if (ch === '^') res.spike = true;
          }
        }
      } else if (b.vy < 0) {
        const ty = y0();
        for (let tx = x0(); tx <= x1(); tx++) {
          const ch = this.tile(tx, ty);
          const hidden = ch === 'i' && isPlayer && prevTop >= (ty + 1) * T - 0.01;
          if (solid(ch) || hidden) {
            res.ceil = true;
            res.ceilTiles.push(tx);
            res.ceilRow = ty;
          }
        }
        if (res.ceil) b.y = (ty + 1) * T;
      }
      return res;
    }

    blockedAbove(b, newH) {
      const top = b.y + b.h - newH;
      for (let ty = Math.floor(top / T); ty <= Math.floor((b.y - 0.01) / T); ty++) {
        for (let tx = Math.floor(b.x / T); tx <= Math.floor((b.x + b.w - 0.01) / T); tx++) {
          if (solid(this.tile(tx, ty))) return true;
        }
      }
      return false;
    }

    touches(b, ch, insetTop = 0) {
      for (let ty = Math.floor((b.y + insetTop) / T); ty <= Math.floor((b.y + b.h - 0.01) / T); ty++) {
        for (let tx = Math.floor(b.x / T); tx <= Math.floor((b.x + b.w - 0.01) / T); tx++) {
          if (this.tile(tx, ty) === ch && b.y + b.h > ty * T + insetTop) return true;
        }
      }
      return false;
    }

    collectTokens(p) {
      for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h - 0.01) / T); ty++) {
        for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++) {
          if (this.tile(tx, ty) === 'o') {
            this.setTile(tx, ty, '.');
            this.addToken();
          }
        }
      }
    }

    addToken() {
      const s = SDW.game.session;
      s.tokens++;
      s.score += 10;
      sfx('token');
      if (s.tokens >= 100) {
        s.tokens -= 100;
        s.lives++;
        sfx('life');
        this.text('1UP', this.player.x, this.player.y - 8);
      }
    }

    addScore(n, x, y) {
      if (!n) return;
      SDW.game.session.score += n;
      this.text(String(n), x, y);
    }

    text(str, x, y) {
      this.fx.push({ kind: 'text', str, x, y, vy: -0.6, life: 50 });
    }

    puff(x, y, color) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, life: 18, color, g: 0 });
      }
    }

    // The player's head hit one or more blocks; react to the one nearest the centre.
    bumpFromBelow(tiles, ty, p) {
      const cx = p.x + p.w / 2;
      let best = tiles[0];
      for (const tx of tiles) if (Math.abs((tx + 0.5) * T - cx) < Math.abs((best + 0.5) * T - cx)) best = tx;
      const tx = best;
      const ch = this.tile(tx, ty);
      const bx = tx * T;
      const by = ty * T;
      if (ch === '?') {
        this.setTile(tx, ty, 'U');
        this.fx.push({ kind: 'pop', x: bx + 2, y: by - 14, vy: -4, life: 24 });
        this.addToken();
        this.bump(tx, ty);
      } else if (ch === 'P') {
        this.setTile(tx, ty, 'U');
        this.ents.push(new E.Item(p.power === 0 ? 'chip' : 'bolt', bx, by));
        this.bump(tx, ty);
      } else if (ch === 'C') {
        this.setTile(tx, ty, 'U');
        this.ents.push(new E.Item('clawd', bx, by));
        this.bump(tx, ty);
      } else if (ch === '1' || ch === 'i') {
        this.setTile(tx, ty, 'U');
        this.ents.push(new E.Item('disk', bx, by));
        this.bump(tx, ty);
      } else if (ch === 'B') {
        if (p.power > 0) {
          this.setTile(tx, ty, '.');
          sfx('brick');
          SDW.game.session.score += 50;
          for (let i = 0; i < 4; i++) {
            this.fx.push({ kind: 'chunk', x: bx + (i % 2) * 8 + 4, y: by + (i >> 1) * 8 + 4, vx: (i % 2 ? 1 : -1) * 1.2, vy: i < 2 ? -5 : -3.5, life: 90, g: 0.3 });
          }
          this.hitAbove(tx, ty);
        } else {
          this.bump(tx, ty);
        }
      } else {
        sfx('bump');
      }
    }

    bump(tx, ty) {
      this.bumps.push({ tx, ty, t: 0 });
      sfx('bump');
      this.hitAbove(tx, ty);
    }

    // Things standing on a bumped block get knocked out.
    hitAbove(tx, ty) {
      const zone = { x: tx * T, y: ty * T - 4, w: T, h: 4 };
      for (const e of this.ents) {
        if (e.enemy && !e.dying && !e.dead && !e.isBoss && SDW.overlap(e, zone)) e.flipKill(this, 100);
      }
      if (this.tile(tx, ty - 1) === 'o') {
        this.setTile(tx, ty - 1, '.');
        this.fx.push({ kind: 'pop', x: tx * T + 2, y: (ty - 1) * T, vy: -4, life: 24 });
        this.addToken();
      }
    }

    clear() {
      if (this.state !== 'play') return;
      this.state = 'clear';
      this.stateT = 0;
      SDW.audio.stopMusic();
      sfx('clear');
      for (const e of this.ents) if (e.enemy && !e.dying) { e.dead = true; this.puff(e.x + 6, e.y + 6, '#ffffff'); }
      SDW.game.session.buddy = !!this.player.buddy;
    }

    // Mini-games (like Rack Stack) take over the screen until they finish.
    startMini(mini, onWin) {
      this.sub = mini;
      this.subWin = onWin;
      SDW.audio.startSong(mini.music || 'stack');
    }

    get ownHud() { return !!this.sub; }

    win() {
      this.state = 'won';
      this.stateT = 0;
      SDW.game.session.buddy = !!this.player.buddy;
      for (const e of this.ents) if (e.enemy && !e.dying && !e.isBoss) { e.dead = true; this.puff(e.x + 6, e.y + 6, '#ffffff'); }
      sfx('clear');
      this.player.waveT = 1;
      this.player.vx = 0;
    }

    update(inp) {
      this.t++;
      this.stateT++;
      if (this.shake > 0) this.shake--;
      const p = this.player;

      if (this.sub) {
        this.sub.update(inp);
        if (this.sub.finished) {
          const won = this.sub.result === 'win';
          this.sub = null;
          SDW.audio.startSong(this.lockX != null ? 'boss' : this.def.music);
          if (won && this.subWin) this.subWin();
        }
        return;
      }

      if (this.freeze > 0) {
        this.freeze--;
        this.updateFx();
        return;
      }

      if (this.state === 'won') {
        p.waveT++;
        p.vy = Math.min(p.vy + 0.4, 4);
        const r = this.moveBody(p, true);
        if (r.ground) { p.vy = 0; p.onGround = true; }
        this.updateFx();
        if (this.stateT === 260) {
          if (this.def.final) SDW.game.finishGame();
          else SDW.game.levelCleared(p.power);
        }
        return;
      }

      p.update(inp);

      if (p.dead) {
        this.updateFx();
        if (p.deadT === 170) SDW.game.playerDied(this.checkpointHit);
        return;
      }

      // Camera
      const lead = p.facing * 20;
      const target = p.x + p.w / 2 - SDW.W / 2 + lead;
      this.camX += SDW.clamp((target - this.camX) * 0.1, -4, 4);
      this.camX = SDW.clamp(this.camX, 0, this.w * T - SDW.W);
      if (this.arena != null && this.lockX == null && p.x > (this.arena + 2) * T) {
        this.lockX = this.arena * T;
        for (let ty = 2; ty < 12; ty++) this.setTile(this.arena, ty, '=');
        SDW.audio.startSong(this.def.bossSong || 'boss');
      }
      if (this.lockX != null) this.camX += (this.lockX - this.camX) * 0.15;

      // Entities
      const view0 = this.camX - 32;
      const view1 = this.camX + SDW.W + 32;
      for (const e of this.ents) {
        if (!e.active && e.x < view1 && e.x + (e.w || 16) > view0) e.active = true;
        if (!e.active || e.dead) continue;
        if (e.enemy && (e.x < this.camX - 200 || e.x > this.camX + SDW.W + 200) && !e.isBoss) continue;
        if (e.dying) e.updateDying();
        else e.update(this, p);
      }

      this.interact(p, inp);
      this.ents = this.ents.filter((e) => !e.dead);

      for (const b of this.bumps) b.t++;
      this.bumps = this.bumps.filter((b) => b.t < 10);
      this.updateFx();

      if (this.state === 'play' && this.t % 40 === 0) {
        this.time--;
        if (this.time === 100) sfx('pause');
        if (this.time <= 0) { this.time = 0; p.die(); }
      }
      if (this.state === 'clear') {
        if (this.stateT === 120 && this.time > 0) {
          SDW.game.session.score += this.time * 10;
          this.text(`TIME BONUS ${this.time * 10}`, p.x - 40, p.y - 20);
          this.time = 0;
        }
        if (this.stateT === 300) SDW.game.levelCleared(p.power);
      }
    }

    interact(p, inp) {
      for (const e of this.ents) {
        if (e.dead || !e.active || !SDW.overlap(p, e)) continue;
        if (e.type === 'item') {
          if (!(e.emerge > 0)) e.collect(this, p);
          continue;
        }
        if (!e.enemy || e.dying || e.harmless || p.dead) continue;

        if (e.type === 'robot' && e.off > 0 && e.vx === 0) {
          // Stunned robot: touching it kicks it away.
          e.kick(this, p);
          continue;
        }
        const falling = p.vy > 0 && p.y + p.h - p.vy <= e.y + 8;
        if (falling && e.stompable) {
          e.stomp(this, p);
          p.combo++;
          const chain = [100, 200, 400, 800, 1000, 2000, 4000, 8000];
          if (p.combo > chain.length) {
            SDW.game.session.lives++;
            sfx('life');
            this.text('1UP', e.x, e.y);
          } else {
            this.addScore(chain[p.combo - 1], e.x, e.y - 8);
          }
          p.vy = inp.held.jump ? -6 : -3.8;
          p.jumping = inp.held.jump;
          p.y = Math.min(p.y, e.y - p.h + 2);
          if (e.isBoss) p.vy = -6.5;
        } else if (!(e.type === 'robot' && e.kickGrace > 0)) {
          p.hurt();
        }
      }
    }

    updateFx() {
      for (const f of this.fx) {
        f.life--;
        if (f.kind === 'text') f.y += f.vy;
        else if (f.kind === 'pop') { f.y += f.vy; f.vy += 0.3; }
        else { f.x += f.vx; f.y += f.vy; f.vy += f.g || 0; }
      }
      this.fx = this.fx.filter((f) => f.life > 0);
    }

    draw(ctx) {
      const t = this.t;
      let camX = Math.round(this.camX);
      ctx.save();
      if (this.shake > 0) ctx.translate(Math.round(SDW.rand(-2, 2)), Math.round(SDW.rand(-2, 2)));

      SDW.art.background(ctx, this.theme, camX, t);

      // Emerging items sit behind their block.
      for (const e of this.ents) if (e.type === 'item' && e.emerge > 0) e.draw(ctx, camX, t);
      if (this.goal) this.goal.drawBack(ctx, camX, t);
      for (const e of this.ents) if (e.type === 'sign') e.draw(ctx, camX, t);

      const tx0 = Math.floor(camX / T);
      const tx1 = tx0 + Math.ceil(SDW.W / T) + 1;
      const tokenW = [12, 8, 3, 8][(t >> 3) % 4];
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = tx0; tx <= tx1 && tx < this.w; tx++) {
          const ch = this.grid[ty][tx];
          if (ch === '.' || ch === 'i') continue;
          let sx = tx * T - camX;
          let sy = ty * T;
          if (ch === 'o') {
            ctx.drawImage(SDW.art.S.token, sx + 2 + (12 - tokenW) / 2, sy + 2, tokenW, 11);
            continue;
          }
          const b = this.bumps.find((q) => q.tx === tx && q.ty === ty);
          if (b) sy -= Math.round(Math.sin((b.t / 10) * Math.PI) * 5);
          SDW.art.drawTile(ctx, this, ch, tx, ty, sx, sy, t);
        }
      }

      for (const e of this.ents) {
        if (!e.active && e.enemy) continue;
        if (e.type === 'goal' || e.type === 'sign' || (e.type === 'item' && e.emerge > 0) || e.type === 'spark') continue;
        e.draw(ctx, camX, t);
      }
      this.player.draw(ctx, camX, t);
      if (this.player.buddy && !this.player.dead) this.player.buddy.draw(ctx, camX, t);
      for (const e of this.ents) if (e.type === 'spark') e.draw(ctx, camX, t);
      if (this.goal) this.goal.drawFront(ctx, camX, t);

      for (const f of this.fx) {
        const x = Math.round(f.x - camX);
        const y = Math.round(f.y);
        if (f.kind === 'text') SDW.game.text(ctx, f.str, x, y, '#ffffff');
        else if (f.kind === 'pop') ctx.drawImage(SDW.art.S.token, x, y);
        else if (f.kind === 'chunk') {
          SDW.art.R(ctx, '#2b3142', x - 1, y - 1, 6, 6);
          SDW.art.R(ctx, (t >> 2) % 2 ? '#7f8aa3' : '#b8c2d6', x, y, 4, 4);
        } else if (f.kind === 'dot') {
          SDW.art.R(ctx, f.color, x - 1, y - 1, 3, 3);
        }
      }
      ctx.restore();
      for (const e of this.ents) if (e.isBoss && e.drawHud && this.lockX != null) e.drawHud(ctx, t);
      if (this.sub) this.sub.draw(ctx);
    }
  }

  SDW.World = World;
})();
