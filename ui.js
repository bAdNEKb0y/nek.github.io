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

/* Portrait en silhouette (pas de photo, pas de teint de peau) : coiffure, barbe et maillot uniques et stables pour chaque joueur */
function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
let faceN = 0;
export function faceSVG(c) {
  const h = hash(c.id + c.name);
  const skin = 'currentColor', hair = 'currentColor', style = (h >>> 9) % 7, beard = (h >>> 13) % 4;
  const k = Array.isArray(c.kit) ? { c1: c.kit[0], c2: c.kit[1], p: c.kit[2] } : c.kit;
  const id = 'fc' + (faceN++);
  let pat = '';
  if (k.p === 'stripes') for (let x = 8; x < 52; x += 9) pat += `<rect x="${x}" y="38" width="4.5" height="20" fill="${k.c2}"/>`;
  if (k.p === 'band') pat = `<rect x="21" y="38" width="10" height="20" fill="${k.c2}"/>`;
  if (k.p === 'diag') pat = `<path d="M8 58 L44 38 L52 38 L52 58 Z" fill="${k.c2}"/>`;
  if (k.p === 'sleeves') pat = `<rect x="0" y="38" width="11" height="20" fill="${k.c2}"/><rect x="41" y="38" width="11" height="20" fill="${k.c2}"/>`;
  const shoulders = 'M2 58 C2 46 10 40 20 38 L32 38 C42 40 50 46 50 58 Z';
  const hairShapes = [
    `<path d="M13 21 C12 10 19 5 26 5 C33 5 40 10 39 21 C37 15 33 12 26 12 C19 12 15 15 13 21 Z" fill="${hair}"/>`,
    `<path d="M14 18 C14 10 19 7 26 7 C33 7 38 10 38 18 C35 14 31 13 26 13 C21 13 17 14 14 18 Z" fill="${hair}" opacity=".9"/>`,
    `<circle cx="26" cy="13" r="12" fill="${hair}"/><circle cx="16" cy="17" r="6" fill="${hair}"/><circle cx="36" cy="17" r="6" fill="${hair}"/>`,
    `<path d="M12 24 C10 9 18 4 26 4 C34 4 42 9 40 24 L38 30 C38 18 33 13 26 13 C19 13 14 18 14 30 Z" fill="${hair}"/>`,
    `<path d="M15 16 C17 9 22 7 26 7 C31 7 36 9 37 16 C33 12 30 12 26 12 C22 12 19 12 15 16 Z" fill="${hair}" opacity=".55"/>`,
    `<path d="M13 20 C13 9 20 5 27 6 C35 6 40 12 39 20 C34 13 22 11 13 20 Z" fill="${hair}"/><path d="M30 6 C34 2 40 4 39 9" fill="none" stroke="${hair}" stroke-width="3"/>`,
    `<path d="M14 19 C13 11 18 6 26 6 C34 6 39 11 38 19 L36 15 L33 18 L30 14 L27 18 L24 14 L21 18 L18 14 L16 18 Z" fill="${hair}"/>`,
  ];
  const beards = ['', `<path d="M17 28 C18 36 22 39 26 39 C30 39 34 36 35 28 C33 33 30 35 26 35 C22 35 19 33 17 28 Z" fill="${hair}" opacity=".85"/>`,
    `<path d="M21 33 C23 35 29 35 31 33 L30 36 C28 38 24 38 22 36 Z" fill="${hair}" opacity=".85"/>`, `<path d="M17 27 C18 35 22 38.5 26 38.5 C30 38.5 34 35 35 27 L35 29 C33 35 30 37 26 37 C22 37 19 35 17 29 Z" fill="${hair}" opacity=".45"/>`];
  return `<svg viewBox="0 0 52 58" aria-hidden="true"><defs><clipPath id="${id}"><path d="${shoulders}"/></clipPath></defs>
    <path d="${shoulders}" fill="${k.c1}"/><g clip-path="url(#${id})">${pat}</g><path d="${shoulders}" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/>
    <path d="M21 38 L26 44 L31 38" fill="none" stroke="${k.p === 'solid' ? k.c2 : '#fff'}" stroke-width="2"/>
    <g opacity=".5"><rect x="21.5" y="31" width="9" height="9" rx="3" fill="${skin}"/>
    <ellipse cx="13.6" cy="23.5" rx="2.4" ry="3.4" fill="${skin}"/><ellipse cx="38.4" cy="23.5" rx="2.4" ry="3.4" fill="${skin}"/>
    <ellipse cx="26" cy="22.5" rx="12.3" ry="14.6" fill="${skin}"/></g>
    <g opacity=".9">${beards[beard]}${hairShapes[style]}</g>
  </svg>`;
}

/** Carte joueur façon FUT */
export function cardHTML(c, opt = {}) {
  if (!c) return '';
  const t = c.tier;
  return `<div class="fc t-${t}${opt.small ? ' sm' : ''}"><div class="r">${c.r}</div><div class="ps">${c.pos}</div><div class="tl">${TIER_NAME[t]}</div>
    <div class="face">${faceSVG(c)}</div><div class="n">${esc(c.name)}</div><div class="c">${esc(c.club)} · ${c.num}</div></div>`;
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
export function showPack(type, ids, onClose, title) {
  const res = ids.map(id => CARDS[id]).filter(Boolean).sort((a, b) => TRANK[a.tier] - TRANK[b.tier] || a.r - b.r);
  if (!res.length) return;
  PK = { type, res, stage: 'pack', i: 0, busy: false, onClose, title: title || (PACKS[type]?.n ?? 'Pack') };
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
      <div class="pk-card">${cardHTML(c)}</div><span class="pk-tag new">Nouvelle carte</span>
      <p class="pk-hint">${PK.i < PK.res.length - 1 ? 'Touche pour la carte suivante' : 'Touche pour voir le résumé'}</p></div>`;
  } else if (PK.stage === 'walk') {
    const leg = TRANK[bt] >= 3, k = PK.w;
    const inner = k === 0 ? `<div class="lab">${bt === 'goat' ? 'CARTE ULTIME !!!' : leg ? 'Une légende arrive' : 'Un joueur élite arrive'}</div><div class="big">${best.pos === 'GB' ? 'Gardien' : best.pos === 'DEF' ? 'Défenseur' : best.pos === 'MIL' ? 'Milieu' : 'Attaquant'}</div>`
      : k === 1 ? `<div class="lab">${esc(best.club)}</div><div class="wface">${faceSVG(best)}</div>` : `<div class="lab">Note</div><div class="big">${best.r}</div>`;
    el.innerHTML = `<div class="rays" style="--ray:${bt === 'goat' ? 'rgba(255,90,209,.32)' : leg ? 'rgba(255,224,138,.3)' : 'rgba(167,139,250,.25)'}"></div><div class="pk-stage"><div class="walk${leg ? ' leg' : ''}${bt === 'goat' ? ' goat' : ''}">${inner}</div></div>`;
  } else {
    const n = PK.res.length;
    el.innerHTML = `<div class="pk-stage wide"><div class="pk-count">${esc(PK.title)} · ${n} nouvelle${n > 1 ? 's' : ''} carte${n > 1 ? 's' : ''}</div>
      <div class="cgrid">${PK.res.slice().reverse().map(c => cardHTML(c)).join('')}</div>
      <div class="actions"><button class="btn primary" data-a="team">Mettre dans mon équipe</button><button class="btn" data-a="close">Fermer</button></div></div>`;
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = e => { e.stopPropagation(); close(b.dataset.a === 'team' ? 'team' : null); });
  }
}
function close(action) { const cb = PK?.onClose; $('#pack').hidden = true; $('#pack').innerHTML = ''; PK = null; cb?.(action); }
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
