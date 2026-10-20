'use strict';
// Level layouts, built with a tiny builder so they stay readable.
//
// Tiles:  # ground   B server block (breakable)   ? prompt block (token)
//         P prompt block (power-up)   1 prompt block (extra life)
//         C prompt block (Clawd buddy)   i hidden extra-life block
//         = metal block   - one-way platform   ^ spikes   ~ lava   o token
//         > < conveyor belts   D cooling door (opened by Rack Stack)
SDW.levels = (() => {
  const H = 14;

  class Builder {
    constructor(name, theme, music, w) {
      Object.assign(this, { name, theme, music, w });
      this.rows = Array.from({ length: H }, () => new Array(w).fill('.'));
      this.ents = [];
      this.start = { x: 3, y: 11 };
      this.meta = {};
    }
    set(x, y, ch) {
      if (x >= 0 && x < this.w && y >= 0 && y < H) this.rows[y][x] = ch;
      return this;
    }
    fill(x, y, w, h, ch) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, ch);
      return this;
    }
    ground(x, w, top = 12) { return this.fill(x, top, w, H - top, '#'); }
    row(x, y, s) {
      for (let i = 0; i < s.length; i++) if (s[i] !== ' ') this.set(x + i, y, s[i]);
      return this;
    }
    // Staircase of metal blocks standing on the ground (row 12).
    stairs(x, n, up = true) {
      for (let i = 0; i < n; i++) {
        const h = up ? i + 1 : n - i;
        this.fill(x + i, 12 - h, 1, h, '=');
      }
      return this;
    }
    ent(type, x, y = 11, opts = {}) {
      this.ents.push(Object.assign({ type, x, y }, opts));
      return this;
    }
    // A billboard; `lines` is an array of short strings.
    sign(x, y, lines, style) { return this.ent('sign', x, y, { lines, style }); }
    // Locked cooling door spanning rows top..bottom; opens after Rack Stack.
    rackdoor(x, top, bottom) {
      this.fill(x, top, 1, bottom - top + 1, 'D');
      return this.ent('rackdoor', x, bottom, { top });
    }
    // "429" laser gate that blinks on and off.
    gate(x, top, bottom, period = 150, offset = 0) { return this.ent('gate', x, bottom, { top, period, offset }); }
    done() {
      return Object.assign({ name: this.name, theme: this.theme, music: this.music, w: this.w, h: H,
        rows: this.rows.map((r) => r.join('')), ents: this.ents, start: this.start }, this.meta);
    }
  }

  // ------------------------------------------------------- 1 Prompt Plains --
  function promptPlains() {
    const b = new Builder('PROMPT PLAINS', 'plains', 'plains', 220);
    b.ground(0, 42).ground(46, 30).ground(82, 42).ground(128, 33).ground(165, 55);

    b.sign(6, 11, ['ATTENTION IS', 'ALL YOU NEED']);
    b.sign(30, 9, ['BONK >_ BLOCKS', 'FROM BELOW']);
    b.row(10, 8, '?');
    b.row(15, 8, 'B?BPB');
    b.row(17, 4, '?');
    b.ent('bug', 22);
    b.row(23, 10, 'ooo');
    b.fill(27, 10, 2, 2, '=');
    b.ent('bug', 31);
    b.fill(35, 9, 2, 3, '=');
    b.row(35, 7, 'oo');
    b.ent('bug', 38).ent('bug', 40);
    b.row(42, 9, 'oooo');

    b.row(50, 8, 'BBB?BBB');
    b.row(52, 5, 'ooo');
    b.ent('robot', 55);
    b.stairs(62, 3);
    b.ent('hopper', 68);
    b.row(69, 9, 'ooo');

    b.row(77, 9, '----');
    b.row(77, 7, 'oooo');
    b.set(88, 8, 'i');
    b.row(92, 9, '------');
    b.row(98, 6, '-----');
    b.row(98, 5, 'ooooo');
    b.ent('bug', 94).ent('bug', 97).ent('robot', 104);
    b.ent('checkpoint', 108);
    b.row(113, 11, '^^');
    b.ent('hopper', 118);

    b.sign(126, 11, ['PAPERCLIP FARM', '(DO NOT MAXIMIZE)'], 'warn');
    b.row(132, 8, 'B?B?B');
    b.ent('bug', 134).ent('clip', 138);
    b.row(142, 8, 'P');
    b.ent('robot', 146).ent('clip', 150);
    b.stairs(154, 4);
    b.fill(158, 8, 3, 4, '=');
    b.row(161, 6, 'oooo');
    b.stairs(165, 4, false);

    b.ent('bug', 174).ent('bug', 176).ent('robot', 182);
    b.row(186, 8, 'ooooo');
    b.sign(194, 11, ['SHIP FAST,', 'ALIGN FASTER']);
    b.ent('goal', 202);
    return b.done();
  }

  // ------------------------------------------------ 2 Data Center Depths --
  function dataCenter() {
    const b = new Builder('DATA CENTER DEPTHS', 'cave', 'cave', 210);
    b.fill(0, 0, 210, 2, '#');
    b.ground(0, 36).ground(40, 30).ground(74, 40).ground(119, 40).ground(163, 47);

    b.sign(5, 11, ['NOW HIRING:', 'GPU WHISPERER'], 'neon');
    b.row(8, 8, 'BBPBB');
    b.ent('bug', 15).ent('bug', 17);
    b.fill(20, 2, 12, 2, '#');
    b.row(22, 10, 'oooooooo');
    b.row(24, 8, 'B?B');
    b.ent('ghost', 31, 7);
    b.row(36, 8, 'oooo');

    b.fill(46, 9, 2, 3, 'B');
    b.ent('robot', 52);
    b.set(56, 8, 'i');
    b.row(58, 8, '?B?B?');
    b.ent('bug', 60).ent('bug', 62);
    b.ent('ghost', 66, 6);
    b.row(70, 9, '----');

    b.fill(78, 9, 2, 3, '=');
    b.row(82, 5, 'BBBBBB');
    b.row(82, 4, 'oooooo');
    b.ent('robot', 86).ent('bug', 90);
    b.ent('ghost', 91, 6);
    b.sign(93, 11, ['POWER BILL:', '$$$$$$$$'], 'warn');
    b.rackdoor(98, 2, 11);
    b.ent('checkpoint', 100);

    b.row(104, 8, 'BBBB?BBBB');
    b.ent('bug', 106).ent('bug', 108).ent('bug', 110);
    b.row(115, 8, '---');
    b.row(115, 6, 'ooo');
    b.fill(122, 10, 3, 2, '=');
    b.ent('ghost', 126, 5);
    b.row(128, 8, 'P');
    b.ent('ghost', 134, 7);
    b.ent('robot', 138);
    b.fill(140, 2, 14, 4, '#');
    b.row(141, 9, 'oooooooooooo');
    b.ent('bug', 144).ent('bug', 148).ent('hopper', 152);
    b.row(159, 9, 'oooo');

    b.stairs(170, 4);
    b.fill(174, 8, 2, 4, '=');
    b.ent('robot', 182).ent('bug', 186);
    b.ent('goal', 195);
    return b.done();
  }

  // ------------------------------------------------------ 3 Cloud Cluster --
  function cloudCluster() {
    const b = new Builder('CLOUD CLUSTER', 'sky', 'sky', 232);
    b.ground(0, 16);
    b.sign(5, 11, ['SERVERLESS', '(THERE ARE SERVERS)']);
    b.row(8, 8, '?P?');
    b.ent('bug', 13);

    b.row(18, 10, '----');
    b.fill(24, 9, 6, 2, '#');
    b.row(24, 7, 'oooooo');
    b.ent('hopper', 27, 8);
    b.ent('plat', 32, 9, { range: 6, axis: 'x', speed: 0.6 });
    b.fill(44, 10, 8, 2, '#');
    b.ent('bug', 48, 9);
    b.row(46, 6, '?C?');

    b.row(54, 8, '---').row(58, 6, '---').row(62, 8, '---');
    b.row(58, 4, 'ooo');
    b.ent('ghost', 60, 3);
    b.fill(66, 11, 10, 3, '#');
    b.ent('robot', 70, 10);
    b.ent('plat', 78, 10, { range: 4, axis: 'y', speed: 0.5 });
    b.fill(82, 7, 6, 2, '#');
    b.row(82, 5, 'oooooo');
    b.set(84, 3, '1');
    b.ent('plat', 90, 8, { range: 8, axis: 'x', speed: 0.7 });

    b.fill(102, 10, 10, 4, '#');
    b.ent('checkpoint', 105, 9);
    b.ent('hopper', 109, 9);
    b.row(114, 9, '---').row(118, 7, '---').row(122, 9, '---');
    b.row(118, 5, 'ooo');
    b.ent('ghost', 118, 3).ent('ghost', 124, 5);
    b.fill(127, 10, 6, 2, '#');
    b.row(128, 6, 'P');
    b.ent('bug', 131, 9);
    b.ent('plat', 135, 10, { range: 6, axis: 'x', speed: 0.8 });
    b.ent('plat', 145, 7, { range: 5, axis: 'x', speed: 0.6 });

    b.fill(155, 9, 12, 2, '#');
    b.row(157, 7, 'oooooooo');
    b.ent('robot', 158, 8).ent('hopper', 163, 8);
    b.ent('ghost', 168, 4);
    b.row(169, 10, '--').row(173, 8, '--').row(177, 6, '--').row(181, 8, '--');
    b.row(173, 7, 'oo').row(177, 5, 'oo').row(181, 7, 'oo');
    b.ent('plat', 185, 10, { range: 4, axis: 'y', speed: 0.6 });

    b.ground(190, 42);
    b.sign(192, 11, ['SCALING LAWS', 'SAY: KEEP GOING'], 'neon');
    b.ent('bug', 197).ent('bug', 200);
    b.ent('goal', 212);
    return b.done();
  }

  // -------------------------------------------------------- 4 Hype Castle --
  function hypeCastle() {
    const b = new Builder('HYPE CASTLE', 'castle', 'castle', 190);
    b.meta = { winBanner: ['HALLUCINATIONS', 'CLEARED!'] };
    b.fill(0, 0, 190, 2, '#');
    b.ground(0, 20);
    b.sign(5, 11, ['FEEL THE AGI'], 'hype');
    b.fill(20, 12, 6, 2, '~');
    b.ground(26, 20);
    b.row(8, 8, '?P?');
    b.ent('robot', 13);
    b.row(22, 9, '--');

    b.fill(30, 9, 2, 3, '=');
    b.ent('ghost', 34, 6).ent('bug', 38);
    b.row(40, 11, '^^');
    b.fill(46, 12, 8, 2, '~');
    b.ent('plat', 46, 9, { range: 5, axis: 'x', speed: 0.6 });

    b.ground(54, 30);
    b.row(58, 8, 'B?B');
    b.ent('robot', 60).ent('robot', 66);
    b.fill(70, 9, 2, 3, '#');
    b.row(70, 7, 'oo');
    b.ent('ghost', 76, 6);
    b.ent('checkpoint', 80);

    b.fill(84, 12, 6, 2, '~');
    b.row(86, 8, '--');
    b.ground(90, 30);
    b.sign(93, 11, ['AGI ACHIEVED?', '(NO)'], 'hype');
    b.row(96, 11, '^^');
    b.row(99, 8, 'P');
    b.ent('bug', 100);
    b.row(104, 11, '^^');
    b.ent('hopper', 108).ent('robot', 112);
    b.fill(120, 12, 8, 2, '~');
    b.ent('plat', 120, 9, { range: 5, axis: 'x', speed: 0.7 });

    b.ground(128, 62);
    b.fill(130, 2, 10, 4, '#');
    b.row(131, 9, 'oooooooo');
    b.ent('ghost', 134, 7).ent('robot', 138);
    b.row(146, 8, '?1?');
    b.sign(151, 11, ['CAUTION:', 'HALLUCINATIONS'], 'warn');

    // Boss arena: columns 156..179, locked once the player walks in.
    b.fill(180, 2, 10, 10, '#');
    b.row(159, 8, '----');
    b.row(173, 8, '----');
    b.ent('boss', 167, 4, { arena: 156 });
    return b.done();
  }

  // ------------------------------------------------- 4 Nvidious Foundry --
  function foundry() {
    const b = new Builder('NVIDIOUS FOUNDRY', 'foundry', 'foundry', 200);
    b.meta = { bossSong: 'boss', winBanner: ['EARNINGS CALL', 'SURVIVED!'] };
    b.ground(0, 30);
    b.sign(5, 11, ['WELCOME TO', 'NVIDIOUS'], 'neon');
    b.row(10, 8, '?P?');
    b.fill(16, 12, 8, 1, '>');
    b.ent('bug', 21).ent('clip', 27);

    b.ground(34, 26);
    b.fill(38, 12, 9, 1, '<');
    b.ent('robot', 44);
    b.row(48, 8, '>>>>');
    b.row(48, 6, 'oooo');
    b.sign(56, 11, ['THE MORE YOU BUY', 'THE MORE YOU SAVE'], 'neon');

    b.ground(64, 30);
    b.gate(70, 7, 11, 120);
    b.ent('clip', 75).ent('clip', 78);
    b.row(80, 8, 'BCB');
    b.sign(86, 11, ['CLAWD WANTS TO', 'PAIR PROGRAM']);
    b.ent('checkpoint', 91);

    b.row(95, 9, '>>');
    b.ground(98, 34);
    b.ent('robot', 104);
    b.gate(110, 6, 11, 100, 50);
    b.ent('hopper', 115);
    b.row(117, 8, '?1?');
    b.fill(120, 12, 12, 1, '>');
    b.sign(125, 11, ['GPUS SOLD OUT', 'UNTIL 2027'], 'warn');

    b.ground(136, 64);
    b.ent('clip', 140).ent('clip', 146).ent('bug', 151);
    b.row(142, 7, 'oooooo');
    b.sign(160, 11, ['KEYNOTE', 'AHEAD'], 'neon');

    // Arena: columns 168..191, locked once the player walks in.
    b.fill(192, 0, 8, 12, '#');
    b.row(171, 8, '----');
    b.row(185, 8, '----');
    b.ent('jacket', 182, 4, { arena: 168 });
    return b.done();
  }

  // ------------------------------------------------------- 8 AGI Summit --
  function agiSummit() {
    const b = new Builder('AGI SUMMIT', 'summit', 'summit', 150);
    b.meta = { bossSong: 'final', final: true, time: 400, winBanner: ['AGI ACHIEVED', '(INTERNALLY)'] };
    b.ground(0, 20);
    b.sign(5, 11, ['AGI SUMMIT', 'ELEVATION: HYPE'], 'hype');
    b.row(9, 8, '?P?');
    b.ent('ghost', 17, 6);
    b.stairs(19, 4);
    b.fill(23, 8, 7, 4, '#');
    b.ent('hopper', 26, 7);

    b.ent('plat', 30, 8, { range: 2, axis: 'x', speed: 0.5 });
    b.ground(34, 20, 10);
    b.sign(37, 9, ['NEXT EXIT:', 'SUPERINTELLIGENCE'], 'hype');
    b.gate(45, 5, 9, 120);
    b.ent('clip', 49, 9);
    b.row(50, 6, 'oooo');
    b.ent('ghost', 51, 4);

    b.row(55, 9, '---');
    b.ground(58, 24);
    b.ent('checkpoint', 60);
    b.row(64, 8, 'B?B1B');
    b.ent('robot', 67).ent('bug', 71).ent('bug', 74);

    b.ent('plat', 82, 9, { range: 2, axis: 'x', speed: 0.5 });
    b.ground(86, 64);
    b.ent('ghost', 92, 5);
    b.gate(98, 7, 11, 110);
    b.ent('hopper', 103);
    b.row(106, 8, 'P');
    b.sign(111, 11, ['WARNING:', 'HYPE AHEAD'], 'warn');

    // Arena: columns 118..141.
    b.fill(142, 0, 8, 12, '#');
    b.row(121, 8, '----');
    b.row(135, 8, '----');
    b.ent('hypeman', 129, 4, { arena: 118 });
    return b.done();
  }

  // Special modes live in src/modes/ and only need a name and a song here.
  const race = { kind: 'race', name: 'THE AI RACE', music: 'race' };
  const maze = { kind: 'maze', name: 'THE WEEKEND', music: 'weekend' };

  const LIST = [promptPlains(), dataCenter(), race, foundry(), cloudCluster(), maze, hypeCastle(), agiSummit()];

  // Overworld nodes (screen coordinates on the map). `shop` nodes open the
  // GPU shop instead of a level.
  const MAP = [
    { x: 40, y: 172, level: 0, icon: 'trees' },
    { x: 86, y: 128, level: 1, icon: 'racks' },
    { x: 128, y: 176, shop: true, icon: 'shop' },
    { x: 172, y: 140, level: 2, icon: 'flag' },
    { x: 214, y: 182, level: 3, icon: 'factory' },
    { x: 250, y: 120, level: 4, icon: 'cloud' },
    { x: 298, y: 168, level: 5, icon: 'office' },
    { x: 330, y: 104, level: 6, icon: 'castle' },
    { x: 350, y: 56, level: 7, icon: 'summit' },
  ];

  return { LIST, MAP };
})();
