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

/** Carte joueur façon FUT */
export function cardHTML(c, opt = {}) {
  if (!c) return '';
  const t = c.tier;
  return `<div class="fc t-${t}${opt.small ? ' sm' : ''}"><div class="r">${c.r}</div><div class="ps">${c.pos}</div><div class="tl">${TIER_NAME[t]}</div>
    <div class="sh">${shirtSVG(c.kit)}</div><div class="n">${esc(c.name)}</div><div class="c">${esc(c.club)} · ${c.num}</div></div>`;
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
      : k === 1 ? `<div class="lab">${esc(best.club)}</div>${shirtSVG(best.kit)}` : `<div class="lab">Note</div><div class="big">${best.r}</div>`;
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
