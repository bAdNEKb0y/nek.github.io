/* Replays de match : enregistrement compact (10 images/s), sauvegarde, lecture avec pause, vitesse et barre de temps */
import { createRenderer } from './render.js';
import { $, esc } from './ui.js';
import { FL } from './engine.js';
import { audio, S as SND, crowdStart, crowdStop, crowdLevel, soundOn, setSound } from './sound.js';
import { SET } from './settings.js';

const HZ = 10, NP = 10, STRIDE = NP * 2 + 7; // par image : 10 joueurs (x,y) + ballon (x,y,z) + porteur + score A + score B + temps de jeu
const Q = 100; // positions au centième

export function createRecorder() {
  const buf = []; let last = -1e9, t0 = 0;
  return {
    push(V, now) {
      if (!V || !V.p || now - last < 1000 / HZ) return;
      if (!buf.length) t0 = now;
      last = now;
      for (let i = 0; i < NP; i++) { const p = V.p[i] || [0, 0]; buf.push(Math.round(p[0] * Q), Math.round(p[1] * Q)); }
      buf.push(Math.round(V.b[0] * Q), Math.round(V.b[1] * Q), Math.round((V.b[5] || 0) * Q), V.b[3] ?? -1, V.sc?.[0] || 0, V.sc?.[1] || 0, Math.min(32000, Math.round((V.tm || 0) * 10)));
    },
    get frames() { return buf.length / STRIDE; },
    data() { return Int16Array.from(buf); },
  };
}

const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
async function pipe(u8, stream) { const r = new Blob([u8]).stream().pipeThrough(stream); return new Uint8Array(await new Response(r).arrayBuffer()); }
/** Int16Array -> texte (compressé en gzip si le navigateur sait le faire) */
export async function encode(i16) {
  const raw = new Uint8Array(i16.buffer);
  if (typeof CompressionStream !== 'undefined') { try { return 'z' + b64(await pipe(raw, new CompressionStream('gzip'))); } catch { } }
  return 'r' + b64(raw);
}
export async function decode(s) {
  let u = unb64(s.slice(1));
  if (s[0] === 'z') u = await pipe(u, new DecompressionStream('gzip'));
  return new Int16Array(u.buffer, u.byteOffset, u.byteLength >> 1);
}

/* ---------- Lecteur ---------- */
let RP = null;
export async function openReplay({ data, meta, title }) {
  const el = $('#replay');
  el.hidden = false;
  el.innerHTML = `<canvas class="rp-cv" aria-label="Replay du match"></canvas>
    <div class="rp-top"><span class="rp-live">▶ REPLAY</span><b>${esc(title || 'Replay')}</b><button class="rp-x" data-r="close" aria-label="Fermer">✕</button></div>
    <div class="rp-bar">
      <button class="rp-b" data-r="play" aria-label="Lecture ou pause">❚❚</button>
      <button class="rp-b" data-r="back" aria-label="Reculer de 5 secondes">⟲5</button>
      <div class="rp-track"><input type="range" min="0" max="1000" value="0" step="1" aria-label="Avancer dans le match"><div class="rp-goals"></div></div>
      <span class="rp-time">0:00</span>
      <button class="rp-b" data-r="speed" aria-label="Vitesse">1×</button>
      <button class="rp-b" data-r="snd" aria-label="Son">${soundOn() ? '🔊' : '🔇'}</button>
    </div>
    <p class="rp-load">Chargement du replay…</p>`;
  let F;
  try { F = await decode(data); } catch { el.querySelector('.rp-load').textContent = 'Ce replay est illisible.'; bind(el, null); return; }
  el.querySelector('.rp-load')?.remove();
  const n = Math.floor(F.length / STRIDE);
  if (n < 2) { el.insertAdjacentHTML('beforeend', '<p class="rp-load">Replay vide.</p>'); bind(el, null); return; }
  const cv = el.querySelector('.rp-cv'), R = createRenderer(cv);
  const M = { ...meta, humans: [false, false], kit: meta.kit, team: meta.team, players: meta.players, names: meta.names || ['', ''], dur: meta.dur || 180 };
  RP = { F, n, R, M, t: 0, speed: 1, play: true, last: performance.now(), raf: 0, el, parts: [], fx: [], lastK: 0, ctx: cv.getContext('2d') };
  RP.evs = findEvents(F, n, M);
  const goals = RP.evs.filter(e => e.type === 'goal').map(e => e.k);
  audio(); crowdStart(); SND.whistle(1);
  el.querySelector('.rp-goals').innerHTML = goals.map(k => `<button class="rp-g" style="left:${k / (n - 1) * 100}%" data-g="${k}" title="Revoir ce but">BUT</button>`).join('');
  R.resize(); requestAnimationFrame(() => R.resize());
  bind(el, goals);
  RP.raf = requestAnimationFrame(loop);
}
function bind(el, goals) {
  el.querySelector('[data-r=close]').onclick = closeReplay;
  if (!RP) return;
  const rng = el.querySelector('input[type=range]');
  el.querySelector('[data-r=play]').onclick = e => { RP.play = !RP.play; if (RP.play && RP.t >= RP.n - 1) { RP.t = 0; RP.lastK = 0; } e.currentTarget.textContent = RP.play ? '❚❚' : '▶'; if (RP.play) { audio(); crowdStart(); } else crowdStop(); };
  el.querySelector('[data-r=snd]').onclick = e => { setSound(!soundOn()); e.currentTarget.textContent = soundOn() ? '🔊' : '🔇'; if (soundOn()) { audio(); if (RP.play) crowdStart(); } };
  el.querySelector('[data-r=back]').onclick = () => { RP.t = Math.max(0, RP.t - 5 * HZ); };
  el.querySelector('[data-r=speed]').onclick = e => { const S = [1, 2, 4, .5]; RP.speed = S[(S.indexOf(RP.speed) + 1) % S.length]; e.currentTarget.textContent = (RP.speed === .5 ? '½' : RP.speed) + '×'; };
  rng.oninput = () => { RP.t = rng.value / 1000 * (RP.n - 1); RP.drag = true; };
  rng.onchange = () => { RP.drag = false; };
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { RP.t = Math.max(0, +b.dataset.g - 4 * HZ); RP.lastK = Math.floor(RP.t); RP.play = true; el.querySelector('[data-r=play]').textContent = '❚❚'; audio(); crowdStart(); });
}
function frameAt(t) {
  t = Math.max(0, Math.min(t, RP.n - 1));
  const { F, n } = RP, i = Math.max(0, Math.min(n - 2, Math.floor(t))), k = Math.max(0, Math.min(1, t - i)), A = i * STRIDE, B = (i + 1) * STRIDE;
  const L = (a, b) => (F[A + a] + (F[B + a] - F[A + a]) * k) / Q;
  const p = [];
  for (let j = 0; j < NP; j++) {
    const x = L(j * 2), y = L(j * 2 + 1), dx = (F[B + j * 2] - F[A + j * 2]), dy = (F[B + j * 2 + 1] - F[A + j * 2 + 1]), m = Math.hypot(dx, dy);
    const prev = RP.face?.[j] || [0, j < 5 ? -1 : 1];
    const f = m > 3 ? [dx / m, dy / m] : prev; (RP.face ||= [])[j] = f;
    p.push([x, y, f[0], f[1], 0, 0]);
  }
  const o = NP * 2, bx = L(o), by = L(o + 1), bz = L(o + 2);
  const sp = Math.hypot(F[B + o] - F[A + o], F[B + o + 1] - F[A + o + 1]) / Q * HZ;
  RP.spin = (RP.spin || 0) + sp * .01;
  return { p, b: [bx, by, RP.spin, F[A + o + 3], sp, bz, -1, -1, 0], sc: [F[A + o + 4], F[A + o + 5]], tm: L(o + 6) * Q / 10, st: 'play', c: [-1, -1], pv: [-1, -1], ch: [0, 0], bn: null, ev: [] };
}
/* ---------- Temps forts : retrouvés dans les images enregistrées ---------- */
const at = (F, k, o) => F[k * STRIDE + o];
const px = (F, k, j) => at(F, k, j * 2) / Q, py = (F, k, j) => at(F, k, j * 2 + 1) / Q;
const OB = NP * 2;
export function findEvents(F, n, M) {
  const ev = [], team = j => M.players?.[j]?.t ?? (j < NP / 2 ? 0 : 1), gk = j => M.players?.[j]?.gk ?? (j % (NP / 2) === 0);
  const name = j => M.players?.[j]?.name || '';
  const carr = k => at(F, k, OB + 3), bsp = k => k > 0 ? Math.hypot(at(F, k, OB) - at(F, k - 1, OB), at(F, k, OB + 1) - at(F, k - 1, OB + 1)) / Q * HZ : 0;
  let lastDrib = -99, lastCarrier = [-1, -1];
  const near = {}; // adversaire collé au porteur : { j, k }
  for (let k = 1; k < n; k++) {
    const c = carr(k), pc = carr(k - 1);
    if (c >= 0) lastCarrier[team(c)] = c;
    // but (le score monte)
    for (const t of [0, 1]) if (at(F, k, OB + 4 + t) > at(F, k - 1, OB + 4 + t)) {
      let sc = lastCarrier[t]; for (let q = k; q > Math.max(0, k - 40); q--) { const cc = carr(q); if (cc >= 0 && team(cc) === t) { sc = cc; break; } }
      ev.push({ k, type: 'goal', team: t, who: sc >= 0 ? name(sc) : '' });
    }
    // frappe / passe : le porteur lâche le ballon qui part vite
    if (pc >= 0 && c < 0) { const v = bsp(k + 1 < n ? k + 1 : k); if (v > 14) ev.push({ k, type: 'kick', pw: Math.min(1.6, v / 30), j: pc }); }
    // récupération / arrêt du gardien
    if (c >= 0 && c !== pc) {
      const prev = pc >= 0 ? pc : carr(Math.max(0, k - 3));
      if (prev >= 0 && team(prev) !== team(c)) ev.push({ k, type: gk(c) && pc < 0 ? 'save' : 'steal', j: c });
      else if (pc < 0 && gk(c) && bsp(k) > 12) ev.push({ k, type: 'save', j: c });
    }
    // dribble : un adversaire était collé au porteur, le porteur garde le ballon et le laisse derrière lui
    if (c < 0 || c !== pc) { for (const key in near) delete near[key]; continue; }
    const t = team(c), goalY = t === 0 ? 0 : FL, cx = px(F, k, c), cy = py(F, k, c);
    for (let j = 0; j < NP; j++) {
      if (team(j) === t) continue;
      const d = Math.hypot(px(F, k, j) - cx, py(F, k, j) - cy);
      if (d < 4.2) { if (near[j] == null) near[j] = k; continue; }
      const k0 = near[j]; if (k0 == null) continue;
      if (k - k0 > 16) { delete near[j]; continue; }
      const behind = Math.abs(py(F, k, j) - goalY) > Math.abs(cy - goalY) + .6;
      if (d > 5 && behind && k - lastDrib > 20) { ev.push({ k, type: 'dribble', j: c, gk: gk(j), who: name(c) }); lastDrib = k; for (const key in near) delete near[key]; break; }
      if (d > 7) delete near[j];
    }
  }
  return ev.sort((a, b) => a.k - b.k);
}
const SLOW = 12; // le ballon ralentit 1,2 s avant chaque but
function slowAt(t) { for (const e of RP.evs) if (e.type === 'goal' && t > e.k - SLOW && t <= e.k + 2) return true; return false; }
function fire(e, V) {
  const nowT = performance.now(), R = RP.R;
  const pos = j => j >= 0 && V.p[j] ? R.toScreen(V.p[j][0], V.p[j][1]) : R.toScreen(V.b[0], V.b[1]);
  if (e.type === 'goal') {
    SND.goal(); if (SET.vib) try { navigator.vibrate?.([60, 40, 120]); } catch { }
    RP.parts.push(...R.goalBurst(e.team, RP.M));
    RP.bn = { text: 'BUT !', sub: e.who, team: e.team, t0: nowT, life: 2.4 };
    RP.fx.push({ kind: 'confetti', t0: nowT });
  } else if (e.type === 'dribble') {
    SND.dribble();
    const [x, y] = pos(e.j);
    RP.fx.push({ kind: 'pop', text: e.gk ? 'GARDIEN EFFACÉ !' : ['DRIBBLE !', 'CROCHET !', 'EFFACÉ !', 'QUEL GESTE !'][Math.floor(Math.random() * 4)], sub: e.who, j: e.j, t0: nowT, x, y });
    RP.fx.push({ kind: 'ring', j: e.j, t0: nowT });
    RP.parts.push(...R.burstAt({ ...V, b: [V.p[e.j][0], V.p[e.j][1]] }, RP.M).slice(0, 18));
  } else if (e.type === 'kick') {
    SND.kick(e.pw); if (e.pw >= 1) RP.parts.push(...R.grassAt(V));
  } else if (e.type === 'save') {
    SND.save(); const [x, y] = pos(e.j); RP.fx.push({ kind: 'pop', text: 'ARRÊT !', j: e.j, t0: nowT, x, y, small: true });
  } else if (e.type === 'steal') SND.steal();
}
function drawFx(V) {
  const ctx = RP.ctx, R = RP.R, nowT = performance.now();
  ctx.save(); ctx.setTransform(R.DPR, 0, 0, R.DPR, 0, 0);
  RP.fx = RP.fx.filter(f => {
    const k = (nowT - f.t0) / 1000;
    if (f.kind === 'ring') {
      if (k > .7 || !V.p[f.j]) return false;
      const [x, y] = R.toScreen(V.p[f.j][0], V.p[f.j][1]), r = R.S * (1.5 + k * 6);
      ctx.globalAlpha = 1 - k / .7; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([R.S, R.S]); ctx.beginPath(); ctx.arc(x, y, r * .7, k * 8, k * 8 + Math.PI * 1.4); ctx.stroke(); ctx.setLineDash([]);
      return true;
    }
    if (f.kind === 'pop') {
      const life = 1.5; if (k > life) return false;
      if (V.p[f.j]) { const [x, y] = R.toScreen(V.p[f.j][0], V.p[f.j][1]); f.x += (x - f.x) * .3; f.y += (y - f.y) * .3; }
      const sc = k < .18 ? .4 + k / .18 * .8 : k < .3 ? 1.2 - (k - .18) / .12 * .2 : 1;
      const fs = Math.max(16, Math.min(34, R.W * .045)) * (f.small ? .8 : 1);
      ctx.globalAlpha = k > life - .35 ? (life - k) / .35 : 1;
      ctx.translate(f.x, f.y - R.S * 3.2 - k * 18); ctx.rotate(-.06); ctx.scale(sc, sc);
      ctx.font = `800 ${fs}px 'Saira Extra Condensed','Arial Narrow',Impact,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(8,14,12,.9)'; ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.small ? '#9fe3ff' : '#ffe08a'; ctx.fillText(f.text, 0, 0);
      if (f.sub) { ctx.font = `700 ${fs * .5}px 'Saira Extra Condensed','Arial Narrow',Impact,sans-serif`; ctx.lineWidth = 4; ctx.strokeText(f.sub.toUpperCase(), 0, fs * .7); ctx.fillStyle = '#fff'; ctx.fillText(f.sub.toUpperCase(), 0, fs * .7); }
      ctx.setTransform(R.DPR, 0, 0, R.DPR, 0, 0);
      return true;
    }
    if (f.kind === 'confetti') {
      if (k > 2.2) return false;
      if (Math.random() < .5) { const cols = [RP.M.kit[0].c1, RP.M.kit[1].c1, '#ffe08a', '#ffffff']; for (let i = 0; i < 3; i++) RP.parts.push({ x: Math.random() * R.W, y: R.hud || 0, vx: (Math.random() * 2 - 1) * 40, vy: 40 + Math.random() * 80, c: cols[i % 4], life: 1.6, r: 2 + Math.random() * 2, rot: Math.random() * 6 }); }
      return true;
    }
    return false;
  });
  // ralenti
  if (RP.slow) { ctx.globalAlpha = .85 + Math.sin(nowT / 160) * .15; ctx.font = "800 15px 'Saira Extra Condensed','Arial Narrow',Impact,sans-serif"; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#f0776b'; ctx.fillText('● RALENTI', 14, (R.hud || 0) + 52); }
  ctx.restore();
}
function loop(now) {
  if (!RP) return;
  const dt = Math.max(0, Math.min(.1, (now - RP.last) / 1000)); RP.last = now; // jamais de temps négatif (1re image)
  RP.slow = RP.play && !RP.drag && slowAt(RP.t);
  if (RP.play && !RP.drag) RP.t = Math.min(RP.n - 1, RP.t + dt * HZ * RP.speed * (RP.slow ? .4 : 1));
  if (RP.t >= RP.n - 1 && RP.play) { RP.play = false; SND.whistle(3); crowdStop(); const b = RP.el.querySelector('[data-r=play]'); if (b) b.textContent = '▶'; }
  const V = frameAt(RP.t);
  // temps forts franchis pendant la lecture (pas quand on saute dans la barre)
  const K = Math.floor(RP.t);
  if (K !== RP.lastK) {
    if (K > RP.lastK && K - RP.lastK <= 3 && !RP.drag) for (const e of RP.evs) if (e.k > RP.lastK && e.k <= K) fire(e, V);
    RP.lastK = K;
  }
  const B = RP.bn; if (B) { const bt = (now - B.t0) / 1000; if (bt > B.life) RP.bn = null; else V.bn = [0, B.text, B.sub, bt, B.life, B.team]; }
  for (const q of RP.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.rot += dt * 6; q.life -= dt; }
  RP.parts = RP.parts.filter(q => q.life > 0);
  if (RP.play) crowdLevel(1 - Math.min(V.b[1], FL - V.b[1]) / 30);
  RP.R.draw(V, RP.M, { me: 0, input: {}, parts: RP.parts, overlay: null, net: null });
  drawFx(V);
  const rng = RP.el.querySelector('input[type=range]'); if (rng && !RP.drag) rng.value = Math.round(RP.t / (RP.n - 1) * 1000);
  const s = Math.floor(RP.t / HZ), tt = RP.el.querySelector('.rp-time'); if (tt) tt.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  RP.raf = requestAnimationFrame(loop);
}
export function closeReplay() {
  if (RP) { cancelAnimationFrame(RP.raf); RP = null; crowdStop(); }
  const el = $('#replay'); el.hidden = true; el.innerHTML = '';
}
addEventListener('resize', () => { if (RP) RP.R.resize(); });
