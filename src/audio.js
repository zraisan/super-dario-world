'use strict';
// All sound is synthesized at runtime with WebAudio. Every melody here is
// original, written for this project.
SDW.audio = (() => {
  let ctx = null;
  let master, musicBus, sfxBus, noiseBuf;
  let muted = false;
  try { muted = localStorage.getItem('sdw-muted') === '1'; } catch (e) { /* ignore */ }

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    // A gentle compressor glues the mix and stops loud moments clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.7;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (wanted) startSong(wanted);
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('sdw-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
    return muted;
  }

  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) return null;
    return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  }

  function tone(freq, dur, opts = {}) {
    if (!ctx) return;
    const t = opts.when || ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    const v = opts.vol == null ? 0.2 : opts.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(opts.bus || sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, opts = {}) {
    if (!ctx) return;
    const t = opts.when || ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'highpass';
    f.frequency.value = opts.freq || 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(opts.bus || sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  function seq(notes, type = 'square', vol = 0.18) {
    if (!ctx) return;
    let t = ctx.currentTime;
    for (const [m, d] of notes) {
      if (m) tone(midiHz(m), d * 0.95, { type, vol, when: t });
      t += d;
    }
  }

  const sfx = {
    jump: () => tone(300, 0.16, { slide: 720, vol: 0.12 }),
    token: () => { tone(1320, 0.06, { vol: 0.1 }); tone(1980, 0.22, { vol: 0.1, when: ctx && ctx.currentTime + 0.06 }); },
    stomp: () => { tone(220, 0.1, { slide: 90, vol: 0.25, type: 'triangle' }); noise(0.06, { vol: 0.08 }); },
    bump: () => tone(140, 0.08, { vol: 0.2, type: 'triangle' }),
    brick: () => { noise(0.25, { vol: 0.25, filter: 'lowpass', freq: 1800 }); tone(110, 0.12, { vol: 0.2, type: 'triangle' }); },
    sprout: () => tone(200, 0.4, { slide: 800, vol: 0.12, type: 'triangle' }),
    power: () => seq([[60, 0.05], [64, 0.05], [67, 0.05], [72, 0.05], [76, 0.05], [79, 0.05], [84, 0.15]], 'square', 0.12),
    hurt: () => tone(600, 0.35, { slide: 120, vol: 0.18 }),
    spark: () => tone(1800, 0.09, { slide: 400, vol: 0.1, type: 'sawtooth' }),
    kick: () => { tone(500, 0.06, { vol: 0.15 }); noise(0.05, { vol: 0.1 }); },
    life: () => seq([[76, 0.08], [79, 0.08], [88, 0.08], [84, 0.08], [86, 0.08], [91, 0.16]], 'square', 0.12),
    checkpoint: () => seq([[67, 0.08], [72, 0.08], [79, 0.2]], 'triangle', 0.25),
    pause: () => seq([[84, 0.05], [0, 0.03], [84, 0.05]], 'square', 0.1),
    select: () => tone(880, 0.06, { vol: 0.1 }),
    bossHit: () => { tone(160, 0.3, { slide: 60, vol: 0.3, type: 'sawtooth' }); noise(0.2, { vol: 0.15, filter: 'lowpass', freq: 900 }); },
    clear: () => seq([[72, 0.1], [76, 0.1], [79, 0.1], [84, 0.25], [81, 0.1], [84, 0.1], [88, 0.5]], 'square', 0.14),
    die: () => seq([[71, 0.12], [70, 0.12], [69, 0.12], [0, 0.1], [62, 0.15], [57, 0.4]], 'square', 0.14),
    gameover: () => seq([[67, 0.3], [63, 0.3], [60, 0.3], [55, 0.8]], 'triangle', 0.25),
    cash: () => { seq([[84, 0.05], [91, 0.12]], 'square', 0.1); noise(0.12, { vol: 0.08, freq: 6000 }); },
    buddy: () => seq([[79, 0.05], [83, 0.05], [86, 0.05], [91, 0.12]], 'triangle', 0.22),
    zap: () => tone(1400, 0.08, { slide: 2600, vol: 0.07, type: 'triangle' }),
    boom: () => { noise(0.5, { vol: 0.3, filter: 'lowpass', freq: 600 }); tone(90, 0.4, { slide: 30, vol: 0.3, type: 'sine' }); },
    door: () => { seq([[60, 0.06], [64, 0.06], [67, 0.06], [72, 0.2]], 'square', 0.12); noise(0.3, { vol: 0.1, filter: 'lowpass', freq: 900 }); },
    throw: () => tone(500, 0.12, { slide: 250, vol: 0.12, type: 'triangle' }),
    talk: () => tone(220 + Math.random() * 180, 0.04, { vol: 0.05, type: 'square' }),
  };

  // ------------------------------------------------------------ music --
  // A small chiptune band: a pulse-wave lead with vibrato and echo, a quiet
  // arpeggio playing the chords, a harmony voice on every second loop, a
  // triangle bass and a drum kit with fills. Songs are written as:
  //   voice:  lead instrument (pulse25, pulse12, triangle, saw)
  //   chords: one chord per bar, e.g. 'C3 G2 A2:m F2:maj7' (root + octave)
  //   lead:   "note:eighths" tokens, '-' is a rest
  //   leadB / chordsB: an optional second section (song plays A then B)
  //   bass:   8 eighth-steps of chord degrees: R root, 3, 5, 8 octave, . rest
  //   arp:    8 eighth-steps of chord degrees (1 3 5 8), . rest
  //   drums:  16 sixteenth-steps: k kick, s snare, h hat, o open hat
  const SONGS = {
    plains: {
      bpm: 148, voice: 'pulse25', echo: 0.28,
      chords: 'C3 G2 A2:m F2 C3 G2 F2 G2',
      lead: `G4:1 C5:1 E5:1 G5:1 -:1 E5:1 G5:2  F5:1 E5:1 D5:2 B4:2 G4:2
             A4:1 C5:1 E5:1 A5:1 -:1 G5:1 E5:2  F5:2 E5:1 C5:1 A4:4
             G4:1 C5:1 E5:1 G5:1 -:1 C6:1 B5:1 C6:1  D6:2 B5:2 G5:2 D5:2
             A5:1 G5:1 F5:1 E5:1 D5:1 C5:1 A4:2  B4:2 D5:2 G5:3 -:1`,
      chordsB: 'F2 G2 E2:m A2:m F2 G2 E2:m G2',
      leadB: `A5:3 G5:1 F5:2 C5:2  D5:1 E5:1 F5:1 G5:1 B5:2 G5:2
              E5:3 D5:1 E5:2 G5:2  A5:2 E5:2 C5:2 A4:2
              F5:1 A5:1 C6:2 A5:1 F5:1 C5:2  D5:1 G5:1 B5:2 D6:2 B5:2
              G5:2 E5:1 G5:1 B5:2 G5:2  F5:1 E5:1 D5:1 B4:1 G4:2 -:2`,
      bass: 'R.8.R.85', arp: '1358.53.', drums: 'k.h.s.hhk.hks.h.',
    },
    cave: {
      bpm: 112, voice: 'triangle', leadVol: 0.16, echo: 0.38,
      chords: 'A2:m A2:m F2 G2 A2:m A2:m D3:m E2',
      lead: `A4:3 C5:1 E5:2 -:2  D5:1 C5:1 B4:2 A4:4
             F4:2 A4:2 C5:3 B4:1  B4:2 D5:2 G4:4
             A4:3 E5:1 A5:2 G5:1 E5:1  F5:2 E5:2 C5:4
             D5:2 F5:2 A5:2 F5:2  E5:2 G#4:2 B4:2 E4:2`,
      bass: 'R..R5..8', arp: '1.5.8.5.', drums: 'k.....h.s...h.h.',
    },
    sky: {
      bpm: 128, voice: 'pulse12', echo: 0.3,
      chords: 'D3 E3 B2:m G2 D3 E3 G2 A2',
      lead: `F#5:2 A5:2 D6:2 A5:2  G#5:2 B5:2 E5:4
             D5:1 F#5:1 B5:2 A5:2 F#5:2  G5:2 B4:2 D5:4
             A5:1 F#5:1 D5:2 A4:2 D5:2  E5:1 G#5:1 B5:2 E6:2 B5:2
             D6:2 B5:1 G5:1 D5:2 B4:2  C#5:2 E5:2 A5:4`,
      bass: 'R.5.8.5.', arp: '13581358', drums: 'k.hhs.h.k.hhs.ho',
    },
    castle: {
      bpm: 156, voice: 'saw', echo: 0.22,
      chords: 'D3:m D3:m Bb2 C3 D3:m D3:m G2:m A2',
      lead: `D5:1 -:1 D5:1 F5:1 A5:2 G5:1 F5:1  E5:1 F5:1 E5:1 D5:1 C#5:2 A4:2
             Bb4:2 D5:2 F5:2 Bb5:2  A5:1 G5:1 E5:1 C5:1 G5:4
             D5:1 -:1 D5:1 F5:1 A5:2 D6:2  C6:1 A5:1 F5:1 D5:1 A4:4
             G4:2 Bb4:2 D5:2 G5:2  A5:2 G5:1 F5:1 E5:2 C#5:2`,
      bass: 'RR8RRR8R', arp: '15851585', drums: 'k.h.s.k.k.h.s.hs',
    },
    boss: {
      bpm: 172, voice: 'saw', echo: 0.2,
      chords: 'E3:m E3:m C3 D3 E3:m E3:m B2 B2',
      lead: `E5:1 E5:1 G5:1 E5:1 B5:2 A5:1 G5:1  F#5:1 G5:1 F#5:1 E5:1 D#5:2 B4:2
             C5:1 E5:1 G5:1 C6:1 B5:2 G5:2  A5:1 F#5:1 D5:1 A4:1 D5:4
             E5:1 B4:1 E5:1 G5:1 B5:2 E6:2  D6:1 B5:1 G5:1 E5:1 B4:4
             B4:1 D#5:1 F#5:1 B5:1 A5:2 F#5:2  D#5:2 F#5:2 B4:4`,
      bass: 'R8R8R8R8', arp: '13581358', drums: 'k.hsk.hsk.hsk.ss',
    },
    stack: {
      bpm: 140, voice: 'pulse25', echo: 0.25,
      chords: 'G2 E2:m C3 D3 G2 E2:m C3 D3',
      lead: `B4:2 D5:1 G5:1 F#5:2 E5:2  D5:2 B4:2 G4:4
             E5:1 G5:1 B5:2 A5:2 G5:2  F#5:2 E5:1 D5:1 E5:4
             C5:2 E5:1 G5:1 C6:2 B5:2  A5:1 G5:1 F#5:1 E5:1 D5:4
             B4:1 D5:1 G5:2 F#5:1 A5:1 D6:2  C6:2 A5:2 F#5:2 D5:2`,
      bass: 'R.5.R.5.', arp: '1358.85.', drums: 'k.h.s.h.k.h.s.hh',
    },
    race: {
      bpm: 176, voice: 'pulse25', echo: 0.18,
      chords: 'A2:m F2 G2 E2 A2:m F2 D3:m E2',
      lead: `A4:1 C5:1 E5:1 A5:1 G5:2 E5:2  F5:1 A5:1 C6:2 A5:2 F5:2
             G5:1 D5:1 B4:1 D5:1 G5:2 B5:2  G#5:2 E5:2 B4:4
             A5:1 A5:1 C6:2 B5:1 A5:1 E5:2  F5:1 E5:1 D5:1 C5:1 A4:4
             D5:2 F5:2 A5:2 D6:2  E6:2 D6:1 B5:1 G#5:2 E5:2`,
      bass: 'R8R8R8R8', arp: '15851585', drums: 'k.hsk.hsk.hskshs',
    },
    weekend: {
      bpm: 120, voice: 'triangle', leadVol: 0.17, echo: 0.4,
      chords: 'D2:m D2:m Bb1 C2 D2:m D2:m G1:m A1',
      lead: `D4:2 F4:2 A4:3 G4:1  F4:2 E4:2 D4:4
             Bb3:2 D4:2 F4:2 E4:2  C4:2 E4:2 G4:4
             D4:1 F4:1 A4:1 D5:1 C5:2 A4:2  Bb4:1 A4:1 G4:1 F4:1 E4:4
             G4:2 Bb4:2 D5:2 C5:2  A4:2 C#5:2 E5:4`,
      bass: 'R..R..5.', arp: '1.3.5.3.', drums: 'k..h..h.s..h.hh.',
    },
    foundry: {
      bpm: 132, voice: 'pulse25', echo: 0.24,
      chords: 'E2:m E2:m G2 A2 E2:m E2:m C3 B2',
      lead: `E5:1 -:1 E5:1 G5:1 -:1 E5:1 D5:2  B4:2 D5:1 E5:1 -:4
             G5:1 -:1 G5:1 A5:1 -:1 G5:1 E5:2  A5:2 B5:1 A5:1 G5:2 E5:2
             E5:1 -:1 E5:1 G5:1 -:1 B5:1 A5:2  G5:1 E5:1 D5:1 B4:1 E5:4
             C5:2 E5:1 G5:1 C6:2 B5:2  B5:1 A5:1 F#5:1 D#5:1 B4:4`,
      bass: 'R.R8.RR8', arp: '1.5.8.5.', drums: 'k.hsk.hsk.hsk.ho',
    },
    summit: {
      bpm: 140, voice: 'pulse25', echo: 0.3,
      chords: 'C3:m Ab2 Bb2 C3:m C3:m Ab2 Bb2 G2',
      lead: `C5:2 Eb5:2 G5:3 F5:1  Eb5:2 C5:2 Ab4:4
             Bb4:2 D5:2 F5:2 Bb5:2  C6:4 G5:4
             C5:1 Eb5:1 G5:1 C6:1 Bb5:2 G5:2  Ab5:2 F5:2 C5:4
             D5:2 F5:2 Bb5:2 F5:2  G5:2 D5:2 B4:4`,
      bass: 'R.8.5.8.', arp: '13581358', drums: 'k.h.s.hhk.h.s.ho',
    },
    final: {
      bpm: 184, voice: 'saw', echo: 0.18,
      chords: 'C3:m C3:m Ab2 Bb2 C3:m C3:m F2:m G2',
      lead: `C5:1 C5:1 Eb5:1 G5:1 C6:2 Bb5:1 G5:1  Ab5:1 G5:1 F5:1 Eb5:1 D5:2 G4:2
             Ab4:1 C5:1 Eb5:1 Ab5:1 G5:2 Eb5:2  Bb4:1 D5:1 F5:1 Bb5:1 Ab5:2 F5:2
             C6:1 G5:1 Eb5:1 C5:1 G5:2 C6:2  Eb6:2 D6:1 C6:1 Bb5:2 G5:2
             F5:1 Ab5:1 C6:1 Ab5:1 F5:2 C5:2  G5:2 B5:2 D6:2 G5:2`,
      bass: 'R8R8R8R8', arp: '15851585', drums: 'k.hsk.hsk.hskshs',
    },
    shop: {
      bpm: 96, voice: 'triangle', leadVol: 0.17, echo: 0.35, swing: 0.33,
      chords: 'F2:maj7 D2:m7 G2:m7 C3:7 F2:maj7 D2:m7 G2:m7 C3:7',
      lead: `A4:3 C5:1 F5:2 E5:2  D5:3 F5:1 A5:4
             G5:2 F5:1 E5:1 D5:2 Bb4:2  C5:2 E5:2 G5:4
             A5:3 G5:1 F5:2 C5:2  D5:2 F#5:2 A5:4
             Bb5:2 A5:1 G5:1 F5:2 D5:2  E5:2 G5:2 F5:4`,
      bass: 'R.5.8.5.', arp: '1.3.5.8.', drums: 'k..hs..hk..hs.h.',
    },
    map: {
      bpm: 104, voice: 'pulse25', echo: 0.32, swing: 0.2,
      chords: 'F2 C3 D3:m Bb2 F2 C3 Bb2 C3',
      lead: `A4:2 C5:2 F5:3 E5:1  E5:2 G5:2 C5:4
             D5:2 F5:2 A5:2 G5:1 F5:1  F5:2 D5:2 Bb4:4
             C5:1 F5:1 A5:2 C6:2 A5:2  G5:2 E5:1 C5:1 G4:4
             Bb4:2 D5:2 F5:2 D5:2  E5:2 G5:2 C5:2 -:2`,
      bass: 'R.5.R.5.', arp: '1358.53.', drums: 'k...s.h.k.h.s.h.',
    },
  };

  const QUALITY = { '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10] };
  const DEGREE = { R: 0, 1: 0, 3: 1, 5: 2, 8: 3 };

  function parseChords(str) {
    return str.trim().split(/\s+/).map((tok) => {
      const [n, q = ''] = tok.split(':');
      return { root: midi(n), iv: QUALITY[q] };
    });
  }
  function parseLead(str, total) {
    const lead = new Array(total).fill(null);
    let pos = 0;
    for (const tok of str.trim().split(/\s+/)) {
      const [n, len] = tok.split(':');
      if (n !== '-') lead[pos] = { m: midi(n), len: +len };
      pos += +len;
    }
    if (pos !== total) console.warn('song length mismatch', pos, total);
    return lead;
  }

  function compile(song) {
    if (song.chordList) return song;
    let chords = parseChords(song.chords);
    let lead = parseLead(song.lead, chords.length * 8);
    if (song.leadB) {
      const cb = parseChords(song.chordsB);
      lead = lead.concat(parseLead(song.leadB, cb.length * 8));
      chords = chords.concat(cb);
    }
    song.chordList = chords;
    song.leadSteps = lead;
    song.steps = chords.length * 16;
    return song;
  }

  // Chord tone n (0 root, 1 third, 2 fifth, 3 octave) of a chord.
  const chordTone = (c, n) => (n === 3 ? c.root + 12 : c.root + c.iv[Math.min(n, c.iv.length - 1)]);
  // A harmony note: the nearest chord tone at least a third below the melody.
  function harmonyFor(m, c) {
    let best = null;
    for (let o = -2; o <= 4; o++) {
      for (const iv of c.iv) {
        const h = c.root + iv + o * 12;
        if (h <= m - 3 && (best == null || h > best)) best = h;
      }
    }
    return best;
  }

  // ---- instruments
  const waves = {};
  function pulseWave(duty) {
    if (!waves[duty]) {
      const n = 48;
      const re = new Float32Array(n);
      const im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      waves[duty] = ctx.createPeriodicWave(re, im);
    }
    return waves[duty];
  }
  function setWave(o, name) {
    if (name === 'pulse25') o.setPeriodicWave(pulseWave(0.25));
    else if (name === 'pulse12') o.setPeriodicWave(pulseWave(0.125));
    else if (name === 'saw') o.type = 'sawtooth';
    else o.type = name;
  }

  let leadBus = null;
  let echoSend = null;
  let echoDelay = null;
  function buildBand() {
    leadBus = ctx.createBiquadFilter();
    leadBus.type = 'lowpass';
    leadBus.frequency.value = 3400;
    leadBus.Q.value = 0.4;
    leadBus.connect(musicBus);
    // Dotted-eighth echo, darkened a little on every repeat.
    echoSend = ctx.createGain();
    echoDelay = ctx.createDelay(2);
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 2200;
    echoSend.connect(echoDelay);
    echoDelay.connect(dark);
    dark.connect(fb);
    fb.connect(echoDelay);
    dark.connect(musicBus);
  }

  function note(freq, when, dur, o) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    setWave(osc, o.wave);
    osc.frequency.setValueAtTime(freq, when);
    const v = o.vol;
    const a = o.attack || 0.006;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(v, when + a);
    g.gain.setTargetAtTime(v * (o.sustain == null ? 0.65 : o.sustain), when + a, o.decay || 0.08);
    g.gain.setTargetAtTime(0.0001, when + dur, o.release || 0.03);
    osc.connect(g);
    g.connect(o.bus);
    if (o.echo) {
      const s = ctx.createGain();
      s.gain.value = o.echo;
      g.connect(s);
      s.connect(echoSend);
    }
    if (o.vib && dur > 0.28) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, when);
      lg.gain.linearRampToValueAtTime(freq * 0.007, when + Math.min(0.35, dur * 0.6));
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(when);
      lfo.stop(when + dur + 0.25);
    }
    osc.start(when);
    osc.stop(when + dur + 0.25);
  }

  function drum(kind, when, accent = 1) {
    if (kind === 'k') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(42, when + 0.13);
      g.gain.setValueAtTime(0.4 * accent, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
      o.connect(g);
      g.connect(musicBus);
      o.start(when);
      o.stop(when + 0.22);
    } else if (kind === 's') {
      noise(0.13, { vol: 0.15 * accent, freq: 1800, filter: 'bandpass', when, bus: musicBus });
      noise(0.05, { vol: 0.08 * accent, freq: 5000, when, bus: musicBus });
      tone(190, 0.07, { slide: 130, type: 'triangle', vol: 0.12 * accent, when, bus: musicBus });
    } else if (kind === 'h') {
      noise(0.025, { vol: 0.045 * accent, freq: 8000, when, bus: musicBus });
    } else if (kind === 'o') {
      noise(0.16, { vol: 0.04 * accent, freq: 7000, when, bus: musicBus });
    }
  }

  let wanted = null;
  let current = null;
  let step = 0;
  let nextTime = 0;
  let timer = null;

  function startSong(name) {
    if (!SONGS[name]) return;
    wanted = name;
    if (!ctx) return;
    if (current === SONGS[name] && timer) return;
    stopTimer();
    current = compile(SONGS[name]);
    if (!leadBus) buildBand();
    echoDelay.delayTime.setValueAtTime((60 / current.bpm) * 0.75, ctx.currentTime);
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    timer = setInterval(schedule, 25);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function stopMusic() {
    wanted = null;
    current = null;
    stopTimer();
  }

  function schedule() {
    const s = current;
    const d16 = 60 / s.bpm / 4;
    const drums = s.drums.length === 8 ? s.drums.split('').map((c) => c + '.').join('') : s.drums;
    const leadWave = s.voice || 'pulse25';
    while (nextTime < ctx.currentTime + 0.15) {
      const i = step % s.steps;
      const pass = Math.floor(step / s.steps);
      const bar = Math.floor(i / 16);
      const inBar = i % 16;
      const c = s.chordList[bar];
      const t = nextTime + (inBar % 2 ? (s.swing || 0) * d16 : 0);

      if (inBar % 2 === 0) {
        const e = i / 2;
        const ev = s.leadSteps[e];
        if (ev) {
          const dur = ev.len * 2 * d16 * 0.92;
          const isSaw = leadWave === 'saw';
          note(midiHz(ev.m), t, dur, { wave: leadWave, vol: s.leadVol || (isSaw ? 0.06 : 0.09), bus: leadBus, vib: true, echo: s.echo });
          // Second time round, a quieter voice harmonises under the melody.
          if (pass % 2 === 1) {
            const h = harmonyFor(ev.m, c);
            if (h) note(midiHz(h), t, dur, { wave: 'pulse12', vol: 0.035, bus: leadBus, sustain: 0.5 });
          }
        }
        const b = s.bass[(e % 8)];
        if (b && b !== '.') {
          const bn = chordTone(c, DEGREE[b]) - (c.root >= 48 ? 12 : 0);
          note(midiHz(bn), t, d16 * 1.7, { wave: 'triangle', vol: 0.15, bus: musicBus, sustain: 0.6, decay: 0.1 });
        }
        const a = s.arp[(e % 8)];
        if (a && a !== '.') {
          const an = chordTone(c, DEGREE[a]) + 12;
          note(midiHz(an), t, d16 * 0.9, { wave: 'pulse12', vol: pass % 2 ? 0.03 : 0.022, bus: leadBus, sustain: 0.3, decay: 0.05, echo: 0.5 });
        }
      }

      // Drums, with a snare roll at the end of every 8-bar phrase.
      const fill = bar % 8 === 7 && inBar >= 12;
      if (fill) {
        if (inBar === 12) drum('k', t);
        drum('s', t, 0.55 + (inBar - 12) * 0.15);
      } else {
        const d = drums[inBar];
        if (d && d !== '.') drum(d, t, inBar % 4 === 0 ? 1 : 0.8);
        if (bar % 8 === 0 && inBar === 0 && pass > 0) drum('o', t, 1.4); // crash-ish on the downbeat
      }
      nextTime += d16;
      step++;
    }
  }

  function play(name) {
    if (ctx && sfx[name]) sfx[name]();
  }

  // tone/noise/seq are exported so special modes can make their own sounds.
  return { unlock, play, startSong, stopMusic, toggleMute, isMuted: () => muted, tone, noise, seq, midiHz };
})();
