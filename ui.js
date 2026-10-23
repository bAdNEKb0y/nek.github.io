/* Éléments d'interface partagés : maillots, cartes joueurs, animation d'ouverture de pack */
import { KIT, CARDS, TIER_NAME, TRANK, PACKS } from './data.js';

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let shirtN = 0;
export function shirtSVG(k) {
  if (Array.isArray(k)) k = KIT(k);
  const id = 'sh' + (shirtN++);
  const path = 'M14 4 L22 4 Q26 9 30 4 L38 4 L50 14 L44 24 L39 20 L39 50 L13 50 L13 20 L8 24 L2 14 Z';
  let pat = '';
  if (k.p === 'stripes') for (let x = 10; x < 44; x += 10) pat += `<rect x="${x}" y="0" width="5" height="52" fill="${k.c2}"/>`;
  if (k.p === 'band') pat = `<rect x="20" y="0" width="12" height="52" fill="${k.c2}"/><rect x="18.5" width="1.5" height="52" fill="#fff"/><rect x="32" width="1.5" height="52" fill="#fff"/>`;
  if (k.p === 'diag') pat = `<path d="M0 52 L52 0 L52 52 Z" fill="${k.c2}"/>`;
  if (k.p === 'sleeves') pat = `<rect width="13" height="52" fill="${k.c2}"/><rect x="39" width="13" height="52" fill="${k.c2}"/>`;
  const trim = k.p === 'solid' ? k.c2 : 'rgba(0,0,0,.35)';
  return `<svg viewBox="0 0 52 54" aria-hidden="true"><defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><path d="${path}" fill="${k.c1}"/><g clip-path="url(#${id})">${pat}</g><path d="${path}" fill="none" stroke="${trim}" stroke-width="2.2" stroke-linejoin="round"/><path d="M22 4 Q26 9 30 4" fill="none" stroke="${k.p === 'solid' ? k.c2 : '#fff'}" stroke-width="2.4"/></svg>`;
}

/* Portrait illustré (pas de photo) : teint, cheveux, coiffure et barbe propres à chaque joueur, maillot du club */
function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
let faceN = 0;
/* Apparence de chaque joueur : teint (1 clair → 6 foncé), cheveux (k noir, b brun, l châtain, o blond, r roux, n aucun), coiffure, barbe */
const LOOK = {'PSG-0':'1b03','PSG-1':'2k01','PSG-2':'3k03','PSG-3':'6k43','PSG-4':'1b33','OM-0':'1b01','OM-1':'2k13','OM-2':'3k41','OM-3':'4k20','OM-4':'5k42','OL-0':'1b00','OL-1':'6k41','OL-2':'1b11','OL-3':'5k23','OL-4':'6k40','ASM-0':'1l00','ASM-1':'2k01','ASM-2':'4k40','ASM-3':'1l03','ASM-4':'3k20','LOSC-0':'2k03','LOSC-1':'3k41','LOSC-2':'1b01','LOSC-3':'1o00','LOSC-4':'1b11','RCL-0':'1l00','RCL-1':'1b01','RCL-2':'1k03','RCL-3':'1b13','RCL-4':'5k20','RMA-0':'1b10','RMA-1':'6k41','RMA-2':'1b10','RMA-3':'5k40','RMA-4':'5k80','BAR-0':'1b00','BAR-1':'1b00','BAR-2':'5k20','BAR-3':'4k20','BAR-4':'1b00','ATM-0':'1b13','ATM-1':'1k01','ATM-2':'1b01','ATM-3':'1l73','ATM-4':'1b00','MCI-0':'2k03','MCI-1':'2k11','MCI-2':'1b03','MCI-3':'1o70','MCI-4':'1b00','MUN-0':'1b00','MUN-1':'1o00','MUN-2':'1b03','MUN-3':'2k13','MUN-4':'6k40','LIV-0':'1b11','LIV-1':'4k41','LIV-2':'6k41','LIV-3':'3kA1','LIV-4':'5k23','ARS-0':'1b01','ARS-1':'5k40','ARS-2':'4k01','ARS-3':'6k40','ARS-4':'1b11','CHE-0':'2k03','CHE-1':'4k20','CHE-2':'6k41','CHE-3':'1r00','CHE-4':'5k40','BAY-0':'1o00','BAY-1':'6k40','BAY-2':'2k10','BAY-3':'1l03','BAY-4':'6k20','BVB-0':'1b01','BVB-1':'1o01','BVB-2':'1b01','BVB-3':'6k41','BVB-4':'5k80','JUV-0':'1b01','JUV-1':'4k41','JUV-2':'5k40','JUV-3':'2k10','JUV-4':'1b31','INT-0':'1b00','INT-1':'1b13','INT-2':'1n93','INT-3':'2k01','INT-4':'5k40','MIL-0':'6k41','MIL-1':'5k40','MIL-2':'1b03','MIL-3':'1b00','MIL-4':'5k80','STAR-0':'2k53','STAR-1':'3k41','STAR-2':'1r10','STAR-3':'1l30','STAR-4':'2k10','STAR-5':'6o40','STAR-6':'5k40','STAR-7':'1b01','STAR-8':'5k40','STAR-9':'1k00','STAR-10':'3k50','STAR-11':'1k00','STAR-12':'1b10','STAR-13':'2b20','STAR-14':'2b20','STAR-15':'5k20','STAR-16':'5k80','STAR-17':'1b10','STAR-18':'1l20','STAR-19':'4k20','STAR-20':'1b10','STAR-21':'1b13','STAR-22':'1b00','STAR-23':'1b10','STAR-24':'2k10','STAR-25':'4k40','STAR-26':'1k03','STAR-27':'2k01','STAR-28':'6k20','LEG-0':'6k40','LEG-1':'2k20','LEG-2':'2b40','LEG-3':'3k40','LEG-4':'1b30','LEG-5':'5n90','LEG-6':'4k30','LEG-7':'1b20','LEG-8':'1b00','LEG-9':'1b00','LEG-10':'1b30','LEG-11':'1l10','LEG-12':'1k00','LEG-13':'1bA0','LEG-14':'6k40','LEG-15':'1k10','LEG-16':'1b30','LEG-17':'1n90','ULT-0':'1b01','ULT-1':'2k50',
  'NAP-0':'1b31','NAP-1':'1b01','NAP-2':'1b10','NAP-3':'1l00','NAP-4':'1o00','TOT-0':'1b01','TOT-1':'2k01','TOT-2':'1l00','TOT-3':'6k00','TOT-4':'4k40',
  'NEW-0':'1b00','NEW-1':'1b10','NEW-2':'1b40','NEW-3':'1l00','NEW-4':'1b00','AVL-0':'2k01','AVL-1':'5k40','AVL-2':'1b00','AVL-3':'1b00','AVL-4':'6k41',
  'B04-0':'1b40','B04-1':'6k40','B04-2':'1b11','B04-3':'1b00','B04-4':'1b41','SLB-0':'1l10','SLB-1':'2k00','SLB-2':'2k41','SLB-3':'1b01','SLB-4':'1l00',
  'SCP-0':'1b31','SCP-1':'6k40','SCP-2':'1b10','SCP-3':'2k01','SCP-4':'3k41',
  /* joueurs présents seulement en sélection (clé = nom) */
  'Diogo Costa':'1b01','Nuno Mendes':'5k40','Unai Simón':'1b01','Pickford':'1l00','Guéhi':'6k40','Stones':'1b00','Ter Stegen':'1o00','Tah':'6k40',
  'Calafiori':'1b13','Retegui':'2k01','Verbruggen':'1b00','Gakpo':'5k00','Simons':'4k20','Faes':'4k40','Castagne':'1b00','Doku':'6k20','Bounou':'3k41',
  'Brahim Díaz':'2k01','En-Nesyri':'4k41','Livaković':'1b31','Šutalo':'1b00','Kramarić':'1b01','L. Martínez':'2k41'};
const SKIN = ['#f1c9a5', '#f1c9a5', '#dcaa80', '#c68e62', '#a8714a', '#8a5634', '#5f3a22'];
const HAIR = { k: '#1b1714', b: '#3a2718', l: '#7a5532', o: '#d6b05a', r: '#b5652d', g: '#9a9a9a', n: '#1b1714' };
/** Apparence d'un joueur pour le rendu du match (teint, cheveux, coiffure) */
const BYNAME = {}, LOOKC = {};
export function lookFor(name) {
  if (LOOKC[name]) return LOOKC[name];
  if (!BYNAME.__ok) { for (const id in CARDS) BYNAME[CARDS[id].name] ??= id; BYNAME.__ok = 1; }
  const id = BYNAME[name] || name, h = hash(id + name), R = n => (h >>> n);
  const L = LOOK[id] || `${1 + R(1) % 6}k${R(6) % 9}${R(11) % 4}`;
  const style = parseInt(L[2], 16);
  return (LOOKC[name] = { skin: SKIN[+L[0]] || SKIN[2], hair: L[1] === 'n' || style === 9 ? null : HAIR[L[1]] || HAIR.k, style, boot: ['#15171a', '#f4f4f4', '#d7ff2f', '#ff4fa3', '#2f7cf6', '#ff7a1a', '#15171a'][R(9) % 7] });
}
export function faceSVG(c) {
  const h = hash(c.id + c.name), R = n => (h >>> n);
  const k = Array.isArray(c.kit) ? { c1: c.kit[0], c2: c.kit[1], p: c.kit[2] } : c.kit;
  const id = 'fc' + (faceN++);
  const L = LOOK[c.id] || `${1 + R(1) % 6}k${R(6) % 9}${R(11) % 4}`;
  const skin = SKIN[+L[0]] || SKIN[2], hairC = HAIR[L[1]] || HAIR.k, style = parseInt(L[2], 16), beard = +L[3];
  const dark = +L[0] >= 5;
  const shape = R(3) % 3, brow = R(15) % 3, mouth = R(18) % 3, eye = R(21) % 2;
  // Visage (3 morphologies) — coordonnées dans une boîte 100 x 112
  const jaw = ['M30 44 C30 24 40 16 50 16 C60 16 70 24 70 44 C70 60 64 72 50 76 C36 72 30 60 30 44 Z',
    'M29 44 C29 23 39 15 50 15 C61 15 71 23 71 44 C71 58 67 70 58 75 L42 75 C33 70 29 58 29 44 Z',
    'M31 43 C31 24 40 17 50 17 C60 17 69 24 69 43 C69 61 62 74 50 77 C38 74 31 61 31 43 Z'][shape];
  const ink = dark ? '#120a05' : 'rgba(40,20,10,.8)', soft = dark ? 'rgba(0,0,0,.35)' : 'rgba(90,45,20,.28)';
  let pat = '';
  if (k.p === 'stripes') for (let x = 6; x < 100; x += 14) pat += `<rect x="${x}" y="78" width="7" height="34" fill="${k.c2}"/>`;
  if (k.p === 'band') pat = `<rect x="40" y="78" width="20" height="34" fill="${k.c2}"/>`;
  if (k.p === 'diag') pat = `<path d="M10 112 L80 78 L100 78 L100 112 Z" fill="${k.c2}"/>`;
  if (k.p === 'sleeves') pat = `<rect x="0" y="78" width="20" height="34" fill="${k.c2}"/><rect x="80" y="78" width="20" height="34" fill="${k.c2}"/>`;
  const torso = 'M4 112 C4 94 16 84 36 80 L64 80 C84 84 96 94 96 112 Z';
  const hairs = [
    // court dégradé
    `<path d="M30 40 C28 20 38 11 50 11 C62 11 72 20 70 40 C68 30 62 24 50 24 C38 24 32 30 30 40 Z"/>`,
    // raie sur le côté
    `<path d="M29 42 C26 18 38 9 52 10 C65 11 73 21 71 40 C66 28 58 22 46 24 C40 25 34 31 29 42 Z"/><path d="M44 12 C48 17 56 21 66 22" fill="none" stroke="${soft}" stroke-width="1.5"/>`,
    // boucles
    `<g><circle cx="50" cy="20" r="12"/><circle cx="37" cy="24" r="9"/><circle cx="63" cy="24" r="9"/><circle cx="32" cy="34" r="6"/><circle cx="68" cy="34" r="6"/><circle cx="44" cy="15" r="8"/><circle cx="57" cy="15" r="8"/></g>`,
    // mi-long
    `<path d="M27 52 C22 20 36 9 50 9 C64 9 78 20 73 52 L70 60 C70 40 66 26 50 25 C34 26 30 40 30 60 Z"/>`,
    // crâne rasé (ombre)
    `<path d="M31 36 C31 21 40 14 50 14 C60 14 69 21 69 36 C64 27 58 24 50 24 C42 24 36 27 31 36 Z" opacity=".75"/>`,
    // houppe
    `<path d="M30 40 C29 20 38 12 50 12 C62 12 71 20 70 40 C66 28 58 24 48 25 C40 26 34 31 30 40 Z"/><path d="M42 14 C46 4 60 2 66 10 C60 8 54 10 50 16 Z"/>`,
    // pointes
    `<path d="M30 40 C29 22 38 13 50 13 C62 13 71 22 70 40 L67 30 L62 35 L58 27 L53 33 L49 25 L45 33 L41 27 L37 34 L33 29 Z"/>`,
    // chignon / man bun
    `<path d="M30 40 C29 21 38 13 50 13 C62 13 71 21 70 40 C67 28 60 24 50 24 C40 24 33 28 30 40 Z"/><circle cx="50" cy="8" r="6"/>`,
    // tresses
    `<path d="M30 40 C29 20 38 12 50 12 C62 12 71 20 70 40 C67 28 60 24 50 24 C40 24 33 28 30 40 Z"/><path d="M38 16 L36 36 M46 13 L45 30 M54 13 L55 30 M62 16 L64 36" stroke="${soft}" stroke-width="1.6"/>`,
    // chauve (9)
    ``,
    // afro / grosses boucles (10)
    `<g><circle cx="50" cy="16" r="15"/><circle cx="34" cy="22" r="11"/><circle cx="66" cy="22" r="11"/><circle cx="29" cy="36" r="7"/><circle cx="71" cy="36" r="7"/></g>`,
  ];
  const beards = ['',
    `<path d="M33 54 C35 68 42 75 50 75 C58 75 65 68 67 54 C63 64 57 67 50 67 C43 67 37 64 33 54 Z"/>`,
    `<path d="M42 64 C45 61 55 61 58 64 C57 67 54 69 50 69 C46 69 43 67 42 64 Z M47 70 C48 74 52 74 53 70 Z"/>`,
    `<path d="M33 52 C35 68 42 75 50 75 C58 75 65 68 67 52 C65 62 58 70 50 70 C42 70 35 62 33 52 Z" opacity=".5"/>`,
    `<path d="M41 61 C45 59 55 59 59 61 C56 62 53 61.5 50 62.5 C47 61.5 44 62 41 61 Z"/>`];
  const brows = [['M37 38 L45 37', 'M55 37 L63 38'], ['M37 39 L45 36.5', 'M55 36.5 L63 39'], ['M37 37 C40 35 43 35 45 36.5', 'M55 36.5 C57 35 60 35 63 37']][brow];
  const mouths = ['M44 63 C47 64.5 53 64.5 56 63', 'M44 62.5 C47 66 53 66 56 62.5', 'M45 63.5 L55 63.5'][mouth];
  const eyes = eye ? `<ellipse cx="41.5" cy="45" rx="3" ry="2.1" fill="${ink}"/><ellipse cx="58.5" cy="45" rx="3" ry="2.1" fill="${ink}"/>`
    : `<path d="M38 45.5 C40 43 43.5 43 45 45.5 C43.5 46.8 40 46.8 38 45.5 Z M55 45.5 C56.5 43 60 43 62 45.5 C60 46.8 56.5 46.8 55 45.5 Z" fill="${ink}"/>`;
  return `<svg viewBox="0 0 100 112" aria-hidden="true"><defs>
    <clipPath id="${id}t"><path d="${torso}"/></clipPath><clipPath id="${id}f"><path d="${jaw}"/></clipPath>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
    <path d="${torso}" fill="${k.c1}"/><g clip-path="url(#${id}t)">${pat}<path d="M0 78 H100 V112 H0 Z" fill="url(#${id}g)"/></g>
    <path d="${torso}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/>
    <path d="M40 72 L42 84 C46 88 54 88 58 84 L60 72 Z" fill="${skin}"/><path d="M41 74 C46 79 54 79 59 74 L59 78 C54 82 46 82 41 78 Z" fill="${soft}"/>
    <path d="M38 81 L50 92 L62 81" fill="none" stroke="${k.p === 'solid' ? k.c2 : '#fff'}" stroke-width="3" stroke-linejoin="round"/>
    <g fill="${skin}"><ellipse cx="29.5" cy="47" rx="4" ry="6.5"/><ellipse cx="70.5" cy="47" rx="4" ry="6.5"/></g>
    <path d="M28.5 44 C30 46 30 49 29 51 M71.5 44 C70 46 70 49 71 51" fill="none" stroke="${soft}" stroke-width="1.2"/>
    <path d="${jaw}" fill="${skin}"/>
    <g clip-path="url(#${id}f)"><path d="M50 10 C64 14 74 30 72 50 C70 66 62 76 50 80 L80 80 L80 10 Z" fill="rgba(0,0,0,.14)"/><ellipse cx="40" cy="34" rx="9" ry="6" fill="#fff" opacity=".18"/></g>
    <g fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round">${brows.map(d => `<path d="${d}"/>`).join('')}</g>
    ${eyes}<circle cx="42.6" cy="44.4" r=".8" fill="#fff" opacity=".8"/><circle cx="59.6" cy="44.4" r=".8" fill="#fff" opacity=".8"/>
    <path d="M50 46 L48 55 C49 56.5 52 56.5 53 55.5" fill="none" stroke="${soft}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${mouths}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <g fill="${hairC}" opacity="${beard === 3 ? .7 : .95}">${beards[beard]}</g>
    <g fill="${hairC}">${hairs[style] ?? ''}</g>${L[1] !== 'n' && style !== 9 && style !== 4 ? `<path d="M40 16 C46 13 54 13 58 15" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2.5" stroke-linecap="round"/>` : ''}
  </svg>`;
}

/** Carte joueur façon FUT */
export function cardHTML(c, opt = {}) {
  if (!c) return '';
  const t = c.tier;
  return `<div class="fc t-${t}${opt.small ? ' sm' : ''}"><div class="r">${c.r}</div><div class="ps">${c.pos}</div><div class="tl">${TIER_NAME[t]}</div>
    <div class="face">${faceSVG(c)}</div><div class="n${c.name.length > 13 ? ' xl' : c.name.length > 9 ? ' l' : ''}">${esc(c.name)}</div><div class="c">${esc(c.club)} · ${c.num}</div></div>`;
}
export function lockedHTML(c) {
  return `<div class="fc lock"><div class="r">?</div><div class="ps">${c.pos}</div><div class="sh" style="opacity:.25">${shirtSVG(c.kit)}</div><div class="n">???</div><div class="c">${c.goat ? 'Ultime' : c.leg ? 'Légende' : esc(c.club)}</div></div>`;
}

/* ---------- Animation d'ouverture de pack ---------- */
let PK = null, sfx = { tone() { }, cheer() { }, buzz() { } };
export function setPackSounds(s) { sfx = s; }
const TCOL = { or: '#f3dc8c', rare: '#ffb52e', elite: '#a78bfa', leg: '#fff3c4', goat: '#ff5ad1' };
const rnd = (a, b) => a + Math.random() * (b - a);

/** ids : cartes obtenues ; onClose(action) appelé à la fermeture ('team' | null) */
export function showPack(type, ids, onClose, title, opt = {}) {
  const res = ids.map(id => CARDS[id]).filter(Boolean).sort((a, b) => TRANK[a.tier] - TRANK[b.tier] || a.r - b.r);
  if (!res.length) return;
  PK = { type, res, stage: 'pack', i: 0, busy: false, duel: !!opt.duel, onClose, title: title || (PACKS[type]?.n ?? 'Pack') };
  const el = $('#pack'); el.hidden = false; render();
}
function flash(col) { const f = document.createElement('div'); f.className = 'pk-flash'; f.style.setProperty('--fl', col); document.body.appendChild(f); setTimeout(() => f.remove(), 800); }
function confetti(cols, n = 60) { for (let i = 0; i < n; i++) { const c = document.createElement('div'); c.className = 'confetti'; c.style.left = Math.random() * 100 + 'vw'; c.style.background = cols[i % cols.length]; c.style.animationDuration = rnd(1.6, 3.2) + 's'; c.style.animationDelay = rnd(0, .5) + 's'; document.body.appendChild(c); setTimeout(() => c.remove(), 4000); } }
function packArt(type, count) {
  const P = PACKS[type] || { n: 'Pack de bienvenue' };
  return `<div class="pk-pack p-${type}"><small>Foot de Poche</small><b>${esc(P.n.replace('Pack ', ''))}</b><span>${count} carte${count > 1 ? 's' : ''}</span></div>`;
}
function render() {
  const el = $('#pack'), best = PK.res[PK.res.length - 1], bt = best.tier;
  if (PK.stage === 'pack') {
    el.innerHTML = `<div class="pk-stage"><div class="pk-count">${esc(PK.title)}</div>${packArt(PK.type, PK.res.length)}<p class="pk-hint">Touche le pack pour l'ouvrir</p></div>`;
    el.querySelector('.pk-pack').classList.add('idle');
  } else if (PK.stage === 'card') {
    const c = PK.res[PK.i], t = c.tier, hi = TRANK[t] >= 2;
    el.innerHTML = `${hi ? `<div class="rays" style="--ray:${t === 'goat' ? 'rgba(255,90,209,.3)' : t === 'leg' ? 'rgba(255,224,138,.28)' : 'rgba(167,139,250,.22)'}"></div>` : ''}<div class="pk-stage"><div class="pk-count">Carte ${PK.i + 1} / ${PK.res.length} · ${TIER_NAME[t]}</div>
      <div class="pk-card">${cardHTML(c)}</div>${PK.duel ? `<span class="pk-tag">+${c.r + ({ or: 0, rare: 3, elite: 10, leg: 25, goat: 60 }[c.tier] || 0)} pts</span>` : '<span class="pk-tag new">Nouvelle carte</span>'}
      <p class="pk-hint">${PK.i < PK.res.length - 1 ? 'Touche pour la carte suivante' : 'Touche pour voir le résumé'}</p></div>`;
  } else if (PK.stage === 'walk') {
    const leg = TRANK[bt] >= 3, k = PK.w;
    const inner = k === 0 ? `<div class="lab">${bt === 'goat' ? 'CARTE ULTIME !!!' : leg ? 'Une légende arrive' : 'Un joueur élite arrive'}</div><div class="big">${best.pos === 'GB' ? 'Gardien' : best.pos === 'DEF' ? 'Défenseur' : best.pos === 'MIL' ? 'Milieu' : 'Attaquant'}</div>`
      : k === 1 ? `<div class="lab">${esc(best.club)}</div><div class="wface">${faceSVG(best)}</div>` : `<div class="lab">Note</div><div class="big">${best.r}</div>`;
    el.innerHTML = `<div class="rays" style="--ray:${bt === 'goat' ? 'rgba(255,90,209,.32)' : leg ? 'rgba(255,224,138,.3)' : 'rgba(167,139,250,.25)'}"></div><div class="pk-stage"><div class="walk${leg ? ' leg' : ''}${bt === 'goat' ? ' goat' : ''}">${inner}</div></div>`;
  } else {
    const n = PK.res.length;
    el.innerHTML = `<div class="pk-stage wide"><div class="pk-count">${esc(PK.title)} · ${PK.duel ? `${n} carte${n > 1 ? 's' : ''}` : `${n} nouvelle${n > 1 ? 's' : ''} carte${n > 1 ? 's' : ''}`}</div>
      <div class="cgrid">${PK.res.slice().reverse().map(c => cardHTML(c)).join('')}</div>
      <div class="actions">${PK.duel ? '<button class="btn primary" data-a="close">Continuer le duel</button>' : '<button class="btn primary" data-a="team">Mettre dans mon équipe</button><button class="btn" data-a="close">Fermer</button>'}</div></div>`;
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = e => { e.stopPropagation(); close(b.dataset.a === 'team' ? 'team' : null); });
  }
}
function close(action) { document.querySelectorAll('.confetti,.pk-flash').forEach(x => x.remove()); const cb = PK?.onClose; $('#pack').hidden = true; $('#pack').innerHTML = ''; PK = null; cb?.(action); }
function reveal() {
  const t = PK.res[PK.i].tier;
  flash(TCOL[t]); sfx.tone(500 + TRANK[t] * 180, .18, 'triangle', .14, 900 + TRANK[t] * 200);
  if (t === 'goat') { sfx.cheer(); setTimeout(() => sfx.cheer(), 700); confetti(['#ff5ad1', '#5ad1e6', '#ffe08a', '#ffffff', '#a78bfa'], 120); sfx.buzz([120, 60, 120, 60, 300]); }
  else if (t === 'leg') { sfx.cheer(); confetti(['#fff3c4', '#f3d27a', '#ffffff', '#d5b463']); sfx.buzz([80, 40, 160]); }
  else if (t === 'elite') { confetti(['#a78bfa', '#f3d27a', '#ffffff']); sfx.buzz(60); }
  PK.stage = 'card'; render();
}
function walkout() {
  PK.busy = true; PK.stage = 'walk'; PK.w = 0; render(); sfx.tone(220, .3, 'sine', .12, 330);
  const next = () => { if (!PK) return; PK.w++; if (PK.w < 3) { render(); sfx.tone(260 + PK.w * 90, .3, 'sine', .12, 400 + PK.w * 90); setTimeout(next, 950); } else { PK.busy = false; reveal(); } };
  setTimeout(next, 950);
}
export function initPackOverlay() {
  $('#pack').addEventListener('click', e => {
    if (!PK || PK.busy || e.target.closest('button')) return;
    const last = PK.res.length - 1, bt = PK.res[last].tier;
    if (PK.stage === 'pack') {
      PK.busy = true; const pk = $('#pack .pk-pack'); pk.classList.remove('idle'); pk.classList.add('shake');
      for (let i = 0; i < 6; i++) sfx.tone(140 + i * 30, .08, 'square', .05, null, i * .13);
      setTimeout(() => { if (!PK) return; PK.busy = false; PK.i = 0; if (last === 0 && TRANK[bt] >= 2) walkout(); else reveal(); }, 900);
    } else if (PK.stage === 'card') {
      if (PK.i < last) { PK.i++; if (PK.i === last && TRANK[bt] >= 2) walkout(); else reveal(); }
      else { PK.stage = 'sum'; render(); }
    }
  });
}
