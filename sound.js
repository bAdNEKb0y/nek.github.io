/* Sons du jeu, tous synthétisés (pas de fichiers à charger) : frappes, sifflet, poteau, foule, but… */
let AC = null, OUT = null, NOISE = null, CROWD = null, ON = true;
try { ON = localStorage.getItem('fdp-sound') !== '0'; } catch { }

export function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      OUT = AC.createGain(); OUT.gain.value = ON ? .9 : 0; OUT.connect(comp); comp.connect(AC.destination);
      const len = AC.sampleRate * 2; NOISE = AC.createBuffer(1, len, AC.sampleRate);
      const d = NOISE.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => { });
  return AC;
}
export const soundOn = () => ON;
export function setSound(v) {
  ON = !!v; try { localStorage.setItem('fdp-sound', ON ? '1' : '0'); } catch { }
  if (OUT) OUT.gain.setTargetAtTime(ON ? .9 : 0, AC.currentTime, .05);
}
const now = () => AC.currentTime;
function env(g, t0, a, peak, dur) { g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); }
function osc(type, f, t0, dur, vol, f2, dest = OUT) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  env(g, t0, .005, vol, dur); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + .05); return o;
}
function noise(t0, dur, vol, ftype, freq, q = .8, f2, a = .004) {
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; s.loop = true; f.type = ftype; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (f2) f.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  env(g, t0, a, vol, dur); s.connect(f); f.connect(g); g.connect(OUT);
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + .05);
}
const ok = () => AC && OUT && ON;

/** Ancienne API simple (encore utilisée par l'ouverture des packs) */
export function tone(f, dur, type, vol, f2, delay) { if (!ok()) return; try { osc(type || 'sine', f, now() + (delay || 0), dur, vol || .15, f2); } catch { } }

export const S = {
  kick(p = 1) { if (!ok()) return; const t = now(), v = Math.min(1, .45 + p * .35); osc('sine', 120 + p * 20, t, .14, .55 * v, 42); noise(t, .05, .32 * v, 'bandpass', 1800, 1.2); },
  header() { if (!ok()) return; const t = now(); osc('sine', 190, t, .12, .4, 85); noise(t, .06, .18, 'lowpass', 900); },
  cross() { if (!ok()) return; const t = now(); this.kick(.8); noise(t + .02, .38, .12, 'bandpass', 500, 1.4, 1800, .08); },
  whistle(n = 1) {
    if (!ok()) return;
    for (let i = 0; i < n; i++) {
      const t = now() + i * .32, dur = i === n - 1 ? (n > 1 ? .7 : .45) : .2;
      const o = AC.createOscillator(), lfo = AC.createOscillator(), lg = AC.createGain(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = 3050; lfo.frequency.value = 34; lg.gain.value = 140;
      lfo.connect(lg); lg.connect(o.frequency); env(g, t, .01, .16, dur); o.connect(g); g.connect(OUT);
      o.start(t); lfo.start(t); o.stop(t + dur + .05); lfo.stop(t + dur + .05);
      noise(t, dur, .05, 'bandpass', 3000, 3);
    }
  },
  post() { if (!ok()) return; const t = now(); for (const [f, v] of [[523, .2], [1247, .12], [1961, .08], [2840, .05]]) osc('sine', f, t, .9, v); noise(t, .03, .2, 'highpass', 2500); crowdOoh(.7); },
  save() { if (!ok()) return; const t = now(); noise(t, .09, .45, 'lowpass', 1100); osc('sine', 95, t, .1, .3, 60); crowdOoh(.5); },
  steal() { if (!ok()) return; const t = now(); noise(t, .14, .35, 'lowpass', 500); osc('sine', 80, t, .12, .35, 50); },
  volley() { if (!ok()) return; this.kick(1.4); crowdOoh(.9); },
  bicycle() { if (!ok()) return; this.kick(1.5); crowdOoh(1); },
  goal() { if (!ok()) return; roar(3.2, .55); const t = now() + .15; for (const f of [233, 294, 349]) { const o = osc('sawtooth', f, t, .9, .06); } },
  click() { if (!ok()) return; const t = now(); osc('triangle', 1400, t, .04, .05, 900); },
  coin() { if (!ok()) return; const t = now(); osc('square', 988, t, .08, .06); osc('square', 1319, t + .08, .25, .06); },
};
function roar(dur, vol) {
  const t = now(), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; s.loop = true; f.type = 'bandpass'; f.frequency.value = 750; f.Q.value = .6;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .35); g.gain.setTargetAtTime(vol * .6, t + .9, .6); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(OUT); s.start(t); s.stop(t + dur + .1);
}
function crowdOoh(k) { const t = now(); noise(t, .9, .14 * k, 'bandpass', 420, 2.5, 700, .18); }
export const cheer = () => { if (ok()) roar(1.8, .4); };

/** Ambiance de stade en continu pendant les matchs ; l'intensité monte près des buts */
export function crowdStart() {
  if (!AC || CROWD) return;
  try {
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
    s.buffer = NOISE; s.loop = true; f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = .5;
    g.gain.value = 0; lfo.frequency.value = .13; lg.gain.value = .012; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(OUT); s.start(); lfo.start();
    CROWD = { s, g, lfo, lvl: .03 }; g.gain.setTargetAtTime(.03, AC.currentTime, .8);
  } catch { CROWD = null; }
}
export function crowdLevel(k) { if (!CROWD || !AC) return; const v = .025 + Math.max(0, Math.min(1, k)) * .05; if (Math.abs(v - CROWD.lvl) > .004) { CROWD.lvl = v; CROWD.g.gain.setTargetAtTime(v, AC.currentTime, .5); } }
export function crowdStop() { if (!CROWD || !AC) return; const c = CROWD; CROWD = null; try { c.g.gain.setTargetAtTime(.0001, AC.currentTime, .3); c.s.stop(AC.currentTime + 1.2); c.lfo.stop(AC.currentTime + 1.2); } catch { } }
