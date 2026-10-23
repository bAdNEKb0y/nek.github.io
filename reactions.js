/* Réactions pendant le match : un rond avec des émojis, à débloquer avec les succès (quêtes) */
import { $ } from './ui.js';

// q = succès (quête) qui débloque la réaction (null = offerte) ; r = rareté ; a = animation (mascotte Pocho)
export const RARITY = { c: 'Commune', r: 'Rare', e: 'Épique', l: 'Légendaire', u: 'Ultra-rare' };
export const EMOTES = [
  { e: '👍', q: null, r: 'c' }, { e: '😂', q: null, r: 'c' }, { e: '😱', q: null, r: 'c' }, { e: '🔥', q: null, r: 'c' }, { e: '👏', q: null, r: 'c' }, { e: '😭', q: null, r: 'c' },
  { e: '🎁', q: 'packs10', r: 'c' }, { e: '🃏', q: 'cards25', r: 'c' }, { e: '🤝', q: 'friend3', r: 'c' }, { e: '🔄', q: 'trade1', r: 'c' }, { e: '🏆', q: 'win1', r: 'c' }, { e: '🤩', q: 'leg1', r: 'c' },
  { a: 'rire', n: 'Pocho mort de rire', q: 'play25', r: 'r' },
  { a: 'pleure', n: 'Pocho en larmes', q: 'packs50', r: 'r' },
  { a: 'danse', n: 'Pocho danse', q: 'cards75', r: 'e' },
  { a: 'feu', n: 'Pocho en feu', q: 'win10', r: 'e' },
  { a: 'coeur', n: 'Pocho amoureux', q: 'daily7', r: 'e' },
  { a: 'roi', n: 'Pocho le roi', q: 'leg10', r: 'l' },
  { a: 'eclair', n: 'Pocho électrique', q: 'elo1200', r: 'l' },
  { a: 'trophee', n: 'Trophée en or', q: 'cards150', r: 'l' },
  { a: 'goat', n: 'Le GOAT', q: 'goat1', r: 'u' },
  { a: 'galaxie', n: 'Pocho galactique', q: 'win50', r: 'u' },
  { a: 'legende', n: 'Pocho légendaire', q: 'packs100', r: 'u' },
  { a: 'arcenciel', n: 'Pocho arc-en-ciel', q: 'cardsall', r: 'u' },
];
/* Pocho : la mascotte ballon (dessin original) */
const PENT = '<path d="M50 20l7 5-3 8h-8l-3-8z" fill="#1b2420"/><path d="M14 46l7-3 5 6-3 8-8-1z" fill="#1b2420"/><path d="M86 46l-7-3-5 6 3 8 8-1z" fill="#1b2420"/>';
const BALL = (fill = '#fff', stroke = '#1b2420') => `<circle cx="50" cy="52" r="36" fill="${fill}" stroke="${stroke}" stroke-width="4"/>${PENT}`;
const FACES = {
  rire: '<path d="M33 50q5-6 10 0M57 50q5-6 10 0" stroke="#1b2420" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M36 60q14 16 28 0z" fill="#1b2420"/><path d="M42 66q8 5 16 0" fill="#e5484d"/><g class="tear"><path d="M27 54q-4 8 0 10 4-2 0-10z" fill="#5ad1e6"/></g><g class="tear t2"><path d="M73 54q-4 8 0 10 4-2 0-10z" fill="#5ad1e6"/></g>',
  pleure: '<path d="M33 48l10 4M67 48l-10 4" stroke="#1b2420" stroke-width="4" stroke-linecap="round"/><circle cx="39" cy="55" r="3.5" fill="#1b2420"/><circle cx="61" cy="55" r="3.5" fill="#1b2420"/><path d="M40 72q10-9 20 0" stroke="#1b2420" stroke-width="4" fill="none" stroke-linecap="round"/><g class="flow"><rect x="36" y="58" width="6" height="30" rx="3" fill="#5ad1e6"/><rect x="58" y="58" width="6" height="30" rx="3" fill="#5ad1e6"/></g>',
  danse: '<rect x="28" y="46" width="44" height="11" rx="5" fill="#1b2420"/><path d="M40 66q10 8 20 0" stroke="#1b2420" stroke-width="4" fill="none" stroke-linecap="round"/>',
  feu: '<path d="M32 46l12 5M68 46l-12 5" stroke="#1b2420" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="56" r="4" fill="#1b2420"/><circle cx="60" cy="56" r="4" fill="#1b2420"/><path d="M38 68h24" stroke="#1b2420" stroke-width="4" stroke-linecap="round"/>',
  coeur: '<g class="hearteye"><path d="M33 53c-6-5 0-12 5-7 5-5 11 2 5 7l-5 5z" fill="#e5484d"/><path d="M57 53c-6-5 0-12 5-7 5-5 11 2 5 7l-5 5z" fill="#e5484d"/></g><path d="M40 66q10 9 20 0" stroke="#1b2420" stroke-width="4" fill="none" stroke-linecap="round"/>',
  roi: '<path d="M34 54q5-4 10 0M56 54q5-4 10 0" stroke="#1b2420" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M40 66q12 6 22-2" stroke="#1b2420" stroke-width="4" fill="none" stroke-linecap="round"/>',
  eclair: '<circle cx="39" cy="53" r="6" fill="#fff" stroke="#1b2420" stroke-width="3"/><circle cx="61" cy="53" r="6" fill="#fff" stroke="#1b2420" stroke-width="3"/><circle cx="39" cy="53" r="2.5" fill="#1b2420"/><circle cx="61" cy="53" r="2.5" fill="#1b2420"/><ellipse cx="50" cy="69" rx="6" ry="7" fill="#1b2420"/>',
  galaxie: '<circle cx="39" cy="53" r="4" fill="#fff"/><circle cx="61" cy="53" r="4" fill="#fff"/><path d="M40 66q10 7 20 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>',
  legende: '<path d="M33 52l5-5 5 5M57 52l5-5 5 5" stroke="#3b2a06" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 63q12 12 24 0z" fill="#3b2a06"/>',
  arcenciel: '<path d="M33 50q5-6 10 0M57 50q5-6 10 0" stroke="#1b2420" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M38 62q12 12 24 0z" fill="#1b2420"/>',
};
const SVG = (inner, cls = '') => `<svg viewBox="0 0 100 100" class="${cls}" aria-hidden="true">${inner}</svg>`;
function animInner(k) {
  switch (k) {
    case 'rire': return SVG(`<g class="body bounce">${BALL()}${FACES.rire}</g>`);
    case 'pleure': return SVG(`<g class="body shiver">${BALL()}${FACES.pleure}</g>`);
    case 'danse': return SVG(`<g class="body wiggle">${BALL()}${FACES.danse}</g><text class="note n1" x="8" y="30">♪</text><text class="note n2" x="80" y="24">♫</text>`);
    case 'feu': return SVG(`<g class="flames"><path d="M20 70q-6-30 12-46 0 14 8 18 2-22 18-32-2 18 10 26 4-10 12-12-4 20 4 46z" fill="#ff7a1a"/><path d="M30 72q-2-20 10-30 0 10 6 12 4-14 12-20 0 14 8 20 4-6 8-6-2 14 2 24z" fill="#ffd23f"/></g><g class="body">${BALL()}${FACES.feu}</g>`);
    case 'coeur': return SVG(`<g class="body pulse">${BALL()}${FACES.coeur}</g><path class="fh h1" d="M14 30c-4-3 0-8 3-5 3-3 7 2 3 5l-3 3z" fill="#e5484d"/><path class="fh h2" d="M80 22c-4-3 0-8 3-5 3-3 7 2 3 5l-3 3z" fill="#e5484d"/>`);
    case 'roi': return SVG(`<g class="body">${BALL()}${FACES.roi}<path class="crown" d="M30 22l6-16 8 10 6-12 6 12 8-10 6 16z" fill="#f3d27a" stroke="#9a7424" stroke-width="2"/></g><path class="spark s1" d="M14 20l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff3c4"/><path class="spark s2" d="M86 70l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff3c4"/>`);
    case 'eclair': return SVG(`<g class="body zap">${BALL('#e8fbff', '#0e5a6b')}${FACES.eclair}</g><path class="bolt b1" d="M10 18l12 0-6 12h8l-14 20 4-14h-7z" fill="#5ad1e6"/><path class="bolt b2" d="M80 50l12 0-6 12h8l-14 20 4-14h-7z" fill="#ffe08a"/>`);
    case 'trophee': return SVG(`<g class="body bounce"><path d="M30 18h40v14q0 22-20 26-20-4-20-26z" fill="#f3d27a" stroke="#9a7424" stroke-width="3"/><path d="M30 24h-10q0 16 14 18M70 24h10q0 16-14 18" stroke="#9a7424" stroke-width="4" fill="none"/><rect x="44" y="58" width="12" height="12" fill="#c9962e"/><rect x="32" y="70" width="36" height="10" rx="2" fill="#9a7424"/><rect class="shine" x="34" y="16" width="8" height="40" fill="#fff" opacity=".6"/></g><g class="confetti"><rect x="14" y="10" width="5" height="9" fill="#e5484d"/><rect x="82" y="16" width="5" height="9" fill="#5ad1e6"/><rect x="24" y="4" width="5" height="9" fill="#7fd99a"/><rect x="70" y="2" width="5" height="9" fill="#ffd23f"/></g>`);
    case 'galaxie': return SVG(`<g class="orbit"><circle cx="50" cy="8" r="5" fill="#ffd23f"/><circle cx="50" cy="96" r="4" fill="#5ad1e6"/></g><g class="body">${`<circle cx="50" cy="52" r="36" fill="#2b1650" stroke="#a78bfa" stroke-width="4"/><circle cx="34" cy="34" r="2" fill="#fff"/><circle cx="68" cy="40" r="1.6" fill="#fff"/><circle cx="62" cy="78" r="2" fill="#fff"/><circle cx="28" cy="70" r="1.4" fill="#fff"/>`}${FACES.galaxie}</g>`);
    case 'legende': return SVG(`<g class="rays"><path d="M50 50L46 0h8zM50 50L100 46v8zM50 50L54 100h-8zM50 50L0 54v-8zM50 50L82 10l6 6zM50 50L90 82l-6 6zM50 50L18 90l-6-6zM50 50L10 18l6-6z" fill="#ffe08a" opacity=".55"/></g><g class="body pulse">${BALL('#f3d27a', '#9a7424')}${FACES.legende}</g>`);
    case 'arcenciel': return SVG(`<defs><linearGradient id="rbw" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ff5f6d"/><stop offset=".25" stop-color="#ffc371"/><stop offset=".5" stop-color="#7fd99a"/><stop offset=".75" stop-color="#5ad1e6"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs><g class="body bounce"><circle cx="50" cy="52" r="36" fill="url(#rbw)" stroke="#1b2420" stroke-width="4"/>${PENT}${FACES.arcenciel}</g>`);
    case 'goat': return `<span class="goat-rays"></span><span class="goat-e">🐐</span><span class="goat-t">GOAT</span>`;
  }
  return '';
}
/** HTML d'une réaction (émoji simple ou animation), size en px */
export function emoteHTML(i, size = 56) {
  const m = EMOTES[i]; if (!m) return '';
  if (!m.a) return `<span class="emo r-${m.r}" style="--s:${size}px"><span class="emo-e">${m.e}</span></span>`;
  return `<span class="emo anim r-${m.r} a-${m.a}" style="--s:${size}px">${animInner(m.a)}</span>`;
}
export const emoteName = i => { const m = EMOTES[i]; return m ? (m.n || m.e) : ''; };
export const MAX_EQUIP = 8, COOLDOWN = 4000;
export const emoteFor = q => EMOTES.findIndex(x => x.q === q);

let ACH = () => [], ON_PICK = null, coolUntil = 0;
const KEY = 'fdp-emotes2';
const lsGet = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const lsSet = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { } };

export function initReactions({ achievements, onPick }) { ACH = achievements; ON_PICK = onPick; build(); }
export const isUnlocked = i => { const q = EMOTES[i]?.q; return !q || (ACH() || []).some(a => a.id === q && a.claimed); };
export function equipped() {
  const unl = EMOTES.map((_, i) => i).filter(isUnlocked);
  const saved = (lsGet() || []).filter(i => isUnlocked(i));
  const list = saved.length ? saved : unl;
  return list.slice(0, MAX_EQUIP);
}
export function toggleEquip(i) {
  if (!isUnlocked(i)) return false;
  let cur = equipped();
  if (cur.includes(i)) { if (cur.length <= 1) return false; cur = cur.filter(x => x !== i); }
  else { if (cur.length >= MAX_EQUIP) cur = cur.slice(1); cur = [...cur, i]; }
  lsSet(cur); return true;
}

/* ---------- Bouton + roue dans l'écran de match ---------- */
function build() {
  const game = $('#game'); if (!game || $('#emoBtn')) return;
  game.insertAdjacentHTML('beforeend', `<button class="emo-btn" id="emoBtn" aria-label="Réactions" hidden><span>😀</span><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16"/></svg></button><div class="emo-wheel" id="emoWheel" hidden></div>`);
  const btn = $('#emoBtn'), wheel = $('#emoWheel');
  const stop = e => { e.stopPropagation(); };
  for (const ev of ['pointerdown', 'pointerup', 'touchstart']) { btn.addEventListener(ev, stop); wheel.addEventListener(ev, stop); }
  btn.addEventListener('click', e => { e.preventDefault(); if (Date.now() < coolUntil) return; wheel.hidden ? openWheel() : closeWheel(); });
  wheel.addEventListener('click', e => {
    const b = e.target.closest('[data-emo]');
    if (b) pick(+b.dataset.emo);
  });
}
let wheelT = 0;
/* La roue s'ouvre en arc à côté du bouton : le reste de l'écran reste jouable (joystick, passes, tirs) */
function openWheel() {
  const wheel = $('#emoWheel'), btn = $('#emoBtn'), list = equipped(), n = list.length;
  const r = btn.getBoundingClientRect(), g = $('#game').getBoundingClientRect();
  const cx = r.left - g.left + r.width / 2, cy = r.top - g.top + r.height / 2;
  const small = g.height < 440, R = small ? 96 : 112, a0 = Math.PI * .5, a1 = Math.PI * 1.05; // arc vers la gauche et le bas
  wheel.style.setProperty('--cx', cx + 'px'); wheel.style.setProperty('--cy', cy + 'px');
  wheel.innerHTML = list.map((i, k) => {
    const rad = n > 1 ? a0 + (a1 - a0) * k / (n - 1) : a0, ring = k % 2 ? R * .62 : R; // deux rangées pour que tout tienne
    return `<button class="emo-it r-${EMOTES[i].r}" data-emo="${i}" aria-label="${emoteName(i)}" style="--x:${Math.round(Math.cos(rad) * ring)}px;--y:${Math.round(Math.sin(rad) * ring)}px;--d:${k * 20}ms">${emoteHTML(i, small ? 36 : 42)}</button>`;
  }).join('');
  wheel.hidden = false; btn.classList.add('open');
  clearTimeout(wheelT); wheelT = setTimeout(closeWheel, 5000); // se referme tout seul
}
export function closeWheel() { clearTimeout(wheelT); const w = $('#emoWheel'); if (w) { w.hidden = true; w.innerHTML = ''; } $('#emoBtn')?.classList.remove('open'); }
function pick(i) {
  if (!isUnlocked(i) || Date.now() < coolUntil) return;
  closeWheel();
  coolUntil = Date.now() + COOLDOWN;
  const btn = $('#emoBtn');
  btn.querySelector('span').innerHTML = EMOTES[i].a ? emoteHTML(i, 30) : EMOTES[i].e;
  btn.classList.remove('cool'); void btn.offsetWidth; btn.classList.add('cool'); // le bouton se rétrécit puis se recharge
  setTimeout(() => { btn.classList.remove('cool'); btn.querySelector('span').textContent = '😀'; }, COOLDOWN);
  ON_PICK?.(i);
}
/** Affiche ou cache le bouton (seulement pendant un match) */
export function showReactBtn(on) { const b = $('#emoBtn'); if (b) b.hidden = !on; if (!on) closeWheel(); }
