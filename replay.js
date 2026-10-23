/* Replays de match : enregistrement compact (10 images/s), sauvegarde, lecture avec pause, vitesse et barre de temps */
import { createRenderer } from './render.js';
import { $, esc } from './ui.js';

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
    </div>
    <p class="rp-load">Chargement du replay…</p>`;
  let F;
  try { F = await decode(data); } catch { el.querySelector('.rp-load').textContent = 'Ce replay est illisible.'; bind(el, null); return; }
  el.querySelector('.rp-load')?.remove();
  const n = Math.floor(F.length / STRIDE);
  if (n < 2) { el.insertAdjacentHTML('beforeend', '<p class="rp-load">Replay vide.</p>'); bind(el, null); return; }
  const cv = el.querySelector('.rp-cv'), R = createRenderer(cv);
  const M = { ...meta, humans: [false, false], kit: meta.kit, team: meta.team, players: meta.players, names: meta.names || ['', ''], dur: meta.dur || 180 };
  RP = { F, n, R, M, t: 0, speed: 1, play: true, last: performance.now(), raf: 0, el, parts: [] };
  // buts : repérés par le changement de score
  const goals = [];
  for (let k = 1; k < n; k++) { const a = F[(k - 1) * STRIDE + NP * 2 + 4] + F[(k - 1) * STRIDE + NP * 2 + 5], b = F[k * STRIDE + NP * 2 + 4] + F[k * STRIDE + NP * 2 + 5]; if (b > a) goals.push(k); }
  el.querySelector('.rp-goals').innerHTML = goals.map(k => `<button class="rp-g" style="left:${k / (n - 1) * 100}%" data-g="${k}" title="Revoir ce but">BUT</button>`).join('');
  R.resize(); requestAnimationFrame(() => R.resize());
  bind(el, goals);
  RP.raf = requestAnimationFrame(loop);
}
function bind(el, goals) {
  el.querySelector('[data-r=close]').onclick = closeReplay;
  if (!RP) return;
  const rng = el.querySelector('input[type=range]');
  el.querySelector('[data-r=play]').onclick = e => { RP.play = !RP.play; if (RP.play && RP.t >= RP.n - 1) RP.t = 0; e.currentTarget.textContent = RP.play ? '❚❚' : '▶'; };
  el.querySelector('[data-r=back]').onclick = () => { RP.t = Math.max(0, RP.t - 5 * HZ); };
  el.querySelector('[data-r=speed]').onclick = e => { const S = [1, 2, 4, .5]; RP.speed = S[(S.indexOf(RP.speed) + 1) % S.length]; e.currentTarget.textContent = (RP.speed === .5 ? '½' : RP.speed) + '×'; };
  rng.oninput = () => { RP.t = rng.value / 1000 * (RP.n - 1); RP.drag = true; };
  rng.onchange = () => { RP.drag = false; };
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { RP.t = Math.max(0, +b.dataset.g - 4 * HZ); RP.play = true; el.querySelector('[data-r=play]').textContent = '❚❚'; });
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
function loop(now) {
  if (!RP) return;
  const dt = Math.max(0, Math.min(.1, (now - RP.last) / 1000)); RP.last = now; // jamais de temps négatif (1re image)
  if (RP.play && !RP.drag) RP.t = Math.min(RP.n - 1, RP.t + dt * HZ * RP.speed);
  if (RP.t >= RP.n - 1 && RP.play) { RP.play = false; const b = RP.el.querySelector('[data-r=play]'); if (b) b.textContent = '▶'; }
  const V = frameAt(RP.t);
  RP.R.draw(V, RP.M, { me: 0, input: {}, parts: RP.parts, overlay: null, net: null });
  const rng = RP.el.querySelector('input[type=range]'); if (rng && !RP.drag) rng.value = Math.round(RP.t / (RP.n - 1) * 1000);
  const s = Math.floor(RP.t / HZ), tt = RP.el.querySelector('.rp-time'); if (tt) tt.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  RP.raf = requestAnimationFrame(loop);
}
export function closeReplay() {
  if (RP) { cancelAnimationFrame(RP.raf); RP = null; }
  const el = $('#replay'); el.hidden = true; el.innerHTML = '';
}
addEventListener('resize', () => { if (RP) RP.R.resize(); });
