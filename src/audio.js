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
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
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
  // Each song: tempo, a lead line ("note:eighths" tokens, "-" = rest),
  // one bass root per bar, and an 8-step drum pattern (k kick, s snare, h hat).
  const SONGS = {
    plains: {
      bpm: 150, wave: 'square', drums: 'k.h.s.hh',
      chords: 'C3 G2 A2 F2 C3 G2 F2 G2',
      lead: `E5:2 G5:1 E5:1 C5:2 D5:2  D5:1 E5:1 D5:1 B4:1 G4:4
             A4:2 C5:1 E5:1 A5:2 G5:2  F5:1 E5:1 D5:1 C5:1 A4:2 C5:2
             E5:1 E5:1 G5:2 C6:2 B5:1 A5:1  G5:2 D5:2 B4:2 D5:2
             A4:1 C5:1 F5:2 E5:1 D5:1 C5:2  D5:2 B4:2 G4:2 -:2`,
    },
    cave: {
      bpm: 112, wave: 'triangle', drums: 'k...s..h',
      chords: 'A2 A2 F2 G2 A2 A2 D3 E2',
      lead: `A4:3 C5:1 E5:2 -:2  D5:1 C5:1 B4:2 A4:4
             F4:2 A4:2 C5:3 B4:1  B4:2 D5:2 G4:4
             A4:3 E5:1 A5:2 G5:1 E5:1  F5:2 E5:2 C5:4
             D5:2 F5:2 A5:2 F5:2  E5:2 G#4:2 B4:2 E4:2`,
    },
    sky: {
      bpm: 128, wave: 'square', drums: 'k.hhs.h.',
      chords: 'D3 E3 B2 G2 D3 E3 G2 A2',
      lead: `F#5:2 A5:2 D6:2 A5:2  G#5:2 B5:2 E5:4
             D5:1 F#5:1 B5:2 A5:2 F#5:2  G5:2 B4:2 D5:4
             A5:1 F#5:1 D5:2 A4:2 D5:2  E5:1 G#5:1 B5:2 E6:2 B5:2
             D6:2 B5:1 G5:1 D5:2 B4:2  C#5:2 E5:2 A5:4`,
    },
    castle: {
      bpm: 156, wave: 'sawtooth', drums: 'k.hsk.hs',
      chords: 'D3 D3 Bb2 C3 D3 D3 G2 A2',
      lead: `D5:1 -:1 D5:1 F5:1 A5:2 G5:1 F5:1  E5:1 F5:1 E5:1 D5:1 C#5:2 A4:2
             Bb4:2 D5:2 F5:2 Bb5:2  A5:1 G5:1 E5:1 C5:1 G5:4
             D5:1 -:1 D5:1 F5:1 A5:2 D6:2  C6:1 A5:1 F5:1 D5:1 A4:4
             G4:2 Bb4:2 D5:2 G5:2  A5:2 G5:1 F5:1 E5:2 C#5:2`,
    },
    boss: {
      bpm: 172, wave: 'sawtooth', drums: 'kshskshs',
      chords: 'E3 E3 C3 D3 E3 E3 B2 B2',
      lead: `E5:1 E5:1 G5:1 E5:1 B5:2 A5:1 G5:1  F#5:1 G5:1 F#5:1 E5:1 D#5:2 B4:2
             C5:1 E5:1 G5:1 C6:1 B5:2 G5:2  A5:1 F#5:1 D5:1 A4:1 D5:4
             E5:1 B4:1 E5:1 G5:1 B5:2 E6:2  D6:1 B5:1 G5:1 E5:1 B4:4
             B4:1 D#5:1 F#5:1 B5:1 A5:2 F#5:2  D#5:2 F#5:2 B4:4`,
    },
    stack: {
      bpm: 140, wave: 'square', drums: 'k.h.s.h.',
      chords: 'G2 E2 C3 D3 G2 E2 C3 D3',
      lead: `B4:2 D5:1 G5:1 F#5:2 E5:2  D5:2 B4:2 G4:4
             E5:1 G5:1 B5:2 A5:2 G5:2  F#5:2 E5:1 D5:1 E5:4
             C5:2 E5:1 G5:1 C6:2 B5:2  A5:1 G5:1 F#5:1 E5:1 D5:4
             B4:1 D5:1 G5:2 F#5:1 A5:1 D6:2  C6:2 A5:2 F#5:2 D5:2`,
    },
    race: {
      bpm: 176, wave: 'square', drums: 'k.hsk.hs',
      chords: 'A2 F2 G2 E2 A2 F2 D3 E2',
      lead: `A4:1 C5:1 E5:1 A5:1 G5:2 E5:2  F5:1 A5:1 C6:2 A5:2 F5:2
             G5:1 D5:1 B4:1 D5:1 G5:2 B5:2  G#5:2 E5:2 B4:4
             A5:1 A5:1 C6:2 B5:1 A5:1 E5:2  F5:1 E5:1 D5:1 C5:1 A4:4
             D5:2 F5:2 A5:2 D6:2  E6:2 D6:1 B5:1 G#5:2 E5:2`,
    },
    weekend: {
      bpm: 120, wave: 'triangle', drums: 'k..hk.s.',
      chords: 'D2 D2 Bb1 C2 D2 D2 G1 A1',
      lead: `D4:2 F4:2 A4:3 G4:1  F4:2 E4:2 D4:4
             Bb3:2 D4:2 F4:2 E4:2  C4:2 E4:2 G4:4
             D4:1 F4:1 A4:1 D5:1 C5:2 A4:2  Bb4:1 A4:1 G4:1 F4:1 E4:4
             G4:2 Bb4:2 D5:2 C5:2  A4:2 C#5:2 E5:4`,
    },
    foundry: {
      bpm: 132, wave: 'square', drums: 'k.hsk.hs',
      chords: 'E2 E2 G2 A2 E2 E2 C3 B2',
      lead: `E5:1 -:1 E5:1 G5:1 -:1 E5:1 D5:2  B4:2 D5:1 E5:1 -:4
             G5:1 -:1 G5:1 A5:1 -:1 G5:1 E5:2  A5:2 B5:1 A5:1 G5:2 E5:2
             E5:1 -:1 E5:1 G5:1 -:1 B5:1 A5:2  G5:1 E5:1 D5:1 B4:1 E5:4
             C5:2 E5:1 G5:1 C6:2 B5:2  B5:1 A5:1 F#5:1 D#5:1 B4:4`,
    },
    summit: {
      bpm: 140, wave: 'square', drums: 'k.h.s.hh',
      chords: 'C3 Ab2 Bb2 C3 C3 Ab2 Bb2 G2',
      lead: `C5:2 Eb5:2 G5:3 F5:1  Eb5:2 C5:2 Ab4:4
             Bb4:2 D5:2 F5:2 Bb5:2  C6:4 G5:4
             C5:1 Eb5:1 G5:1 C6:1 Bb5:2 G5:2  Ab5:2 F5:2 C5:4
             D5:2 F5:2 Bb5:2 F5:2  G5:2 D5:2 B4:4`,
    },
    final: {
      bpm: 184, wave: 'sawtooth', drums: 'kshskshs',
      chords: 'C3 C3 Ab2 Bb2 C3 C3 F2 G2',
      lead: `C5:1 C5:1 Eb5:1 G5:1 C6:2 Bb5:1 G5:1  Ab5:1 G5:1 F5:1 Eb5:1 D5:2 G4:2
             Ab4:1 C5:1 Eb5:1 Ab5:1 G5:2 Eb5:2  Bb4:1 D5:1 F5:1 Bb5:1 Ab5:2 F5:2
             C6:1 G5:1 Eb5:1 C5:1 G5:2 C6:2  Eb6:2 D6:1 C6:1 Bb5:2 G5:2
             F5:1 Ab5:1 C6:1 Ab5:1 F5:2 C5:2  G5:2 B5:2 D6:2 G5:2`,
    },
    shop: {
      bpm: 96, wave: 'triangle', drums: 'k..hs..h',
      chords: 'F2 D2 G2 C3 F2 D2 G2 C3',
      lead: `A4:3 C5:1 F5:2 E5:2  D5:3 F5:1 A5:4
             G5:2 F5:1 E5:1 D5:2 Bb4:2  C5:2 E5:2 G5:4
             A5:3 G5:1 F5:2 C5:2  D5:2 F#5:2 A5:4
             Bb5:2 A5:1 G5:1 F5:2 D5:2  E5:2 G5:2 F5:4`,
    },
    map: {
      bpm: 104, wave: 'triangle', drums: 'k...k.h.',
      chords: 'F2 C3 D3 Bb2 F2 C3 Bb2 C3',
      lead: `A4:2 C5:2 F5:3 E5:1  E5:2 G5:2 C5:4
             D5:2 F5:2 A5:2 G5:1 F5:1  F5:2 D5:2 Bb4:4
             C5:1 F5:1 A5:2 C6:2 A5:2  G5:2 E5:1 C5:1 G4:4
             Bb4:2 D5:2 F5:2 D5:2  E5:2 G5:2 C5:2 -:2`,
    },
  };
  const BASS = [0, -1, 7, -1, 12, -1, 7, -1];

  function compile(song) {
    if (song.steps) return song;
    const roots = song.chords.split(/\s+/).map(midi);
    const total = roots.length * 8;
    const lead = new Array(total).fill(null);
    let pos = 0;
    for (const tok of song.lead.trim().split(/\s+/)) {
      const [n, len] = tok.split(':');
      if (n !== '-') lead[pos] = { m: midi(n), len: +len };
      pos += +len;
    }
    if (pos !== total) console.warn('song length mismatch', pos, total);
    song.steps = total;
    song.leadSteps = lead;
    song.roots = roots;
    return song;
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
    step = 0;
    nextTime = ctx.currentTime + 0.05;
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
    const dt = 60 / s.bpm / 2;
    while (nextTime < ctx.currentTime + 0.12) {
      const i = step % s.steps;
      const ev = s.leadSteps[i];
      if (ev) {
        tone(midiHz(ev.m), ev.len * dt * 0.9, { type: s.wave, vol: s.wave === 'sawtooth' ? 0.05 : 0.08, when: nextTime, bus: musicBus });
      }
      const root = s.roots[Math.floor(i / 8)];
      const b = BASS[i % 8];
      if (b >= 0) tone(midiHz(root + b), dt * 0.9, { type: 'triangle', vol: 0.16, when: nextTime, bus: musicBus });
      const d = s.drums[i % 8];
      if (d === 'k') tone(120, 0.12, { slide: 40, type: 'sine', vol: 0.35, when: nextTime, bus: musicBus });
      else if (d === 's') noise(0.1, { vol: 0.12, freq: 1500, when: nextTime, bus: musicBus });
      else if (d === 'h') noise(0.03, { vol: 0.05, freq: 7000, when: nextTime, bus: musicBus });
      nextTime += dt;
      step++;
    }
  }

  function play(name) {
    if (ctx && sfx[name]) sfx[name]();
  }

  // tone/noise/seq are exported so special modes can make their own sounds.
  return { unlock, play, startSong, stopMusic, toggleMute, isMuted: () => muted, tone, noise, seq, midiHz };
})();
