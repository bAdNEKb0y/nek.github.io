/* Récompenses : cadeau du jour (série de 7 jours), succès à débloquer, pack bonus tous les 20 packs */
import { sb } from './net.js';
import { $, esc } from './ui.js';

export const BONUS_EVERY = 20;
const DAYS = [150, 200, 300, 400, 500, 700, 'bonus'];
let H = null, ACH = null;

export function initRewards(h) { H = h; }
const col = () => H?.col();
const fmt = n => n.toLocaleString('fr-FR');

/** Tuiles de l'accueil (cadeau du jour + succès) */
export function renderRewardTiles() {
  const c = col(); if (!c) return;
  const d = c.daily || { ready: false, next: 1 };
  const g = $('#bDaily');
  if (g) {
    g.classList.toggle('ready', !!d.ready);
    g.querySelector('span').textContent = d.ready ? `Jour ${d.next} : ${DAYS[d.next - 1] === 'bonus' ? 'pack bonus !' : `+${DAYS[d.next - 1]} pièces`}` : `Reviens demain (jour ${d.next})`;
    g.querySelector('.rdot').hidden = !d.ready;
  }
  const a = $('#bAch');
  if (a) {
    const n = ACH ? ACH.filter(x => x.done && !x.claimed).length : 0, got = ACH ? ACH.filter(x => x.claimed).length : 0;
    a.querySelector('span').textContent = ACH ? (n ? `${n} récompense${n > 1 ? 's' : ''} à récupérer !` : `${got} / ${ACH.length} débloqués`) : 'Objectifs et récompenses';
    a.querySelector('.rdot').hidden = !n; a.classList.toggle('ready', n > 0);
  }
}
export async function loadAchievements() {
  const { data } = await sb.rpc('my_achievements');
  if (Array.isArray(data)) ACH = data;
  renderRewardTiles();
  if (!$('#ach').hidden) renderAch();
  return ACH;
}

/* ---------- Cadeau du jour ---------- */
export function openDaily() {
  const c = col(); if (!c) return;
  const d = c.daily || { ready: false, next: 1, streak: 0 };
  const el = $('#daily'); el.hidden = false;
  const cur = d.next; // jour qu'on peut récupérer (ou le prochain)
  el.innerHTML = `<div class="box dbox" role="dialog" aria-label="Cadeau du jour">
    <div class="cardhead"><h2>🎁 Cadeau du jour</h2><button class="link" data-x="close">Fermer</button></div>
    <p class="hint">Reviens chaque jour : la récompense grandit. Le 7<sup>e</sup> jour, un <b>pack bonus</b> ! Si tu rates un jour, la série repart à zéro.</p>
    <ol class="days">${DAYS.map((v, i) => { const n = i + 1, past = n < cur, now = n === cur;
      return `<li class="${past ? 'past' : ''} ${now ? (d.ready ? 'now' : 'next') : ''}"><small>Jour ${n}</small><b>${v === 'bonus' ? '🎁' : `<span class="coins">${v}</span>`}</b>${v === 'bonus' ? '<i>Pack bonus</i>' : ''}${past ? '<em>✓</em>' : ''}</li>`; }).join('')}</ol>
    ${d.ready ? '<button class="btn primary big" data-x="claim">Récupérer</button>' : '<p class="dwait">Déjà récupéré aujourd\'hui. Reviens demain !</p>'}
    <p class="hint">Série actuelle : <b>${d.streak || 0} jour${(d.streak || 0) > 1 ? 's' : ''}</b></p></div>`;
  el.querySelector('[data-x=close]').onclick = closeDaily;
  const b = el.querySelector('[data-x=claim]');
  if (b) b.onclick = async () => {
    b.disabled = true;
    const { data, error } = await sb.rpc('claim_daily');
    if (error) { H.toast(/already/.test(error.message) ? 'Déjà récupéré aujourd\'hui.' : 'Impossible pour l\'instant. Vérifie ta connexion.'); await H.reload(); openDaily(); return; }
    c.coins = data.total; c.bonus = data.bonus_packs;
    c.daily = { ready: false, streak: data.streak, next: data.day % 7 + 1 };
    H.sound?.();
    H.toast(data.bonus ? `🎁 Jour 7 : +${data.coins} pièces et un PACK BONUS !` : `+${data.coins} pièces ! Reviens demain pour le jour ${data.day % 7 + 1}.`);
    H.changed?.(); closeDaily(); loadAchievements();
  };
}
export function closeDaily() { const el = $('#daily'); el.hidden = true; el.innerHTML = ''; }

/* ---------- Succès ---------- */
export function openAch() { const el = $('#ach'); el.hidden = false; renderAch(); loadAchievements(); }
export function closeAch() { const el = $('#ach'); el.hidden = true; el.innerHTML = ''; }
function renderAch() {
  const el = $('#ach'); if (el.hidden) return;
  const list = ACH || [];
  const ready = list.filter(x => x.done && !x.claimed), rest = list.filter(x => !(x.done && !x.claimed)).sort((a, b) => a.claimed - b.claimed || (b.cur / b.goal) - (a.cur / a.goal));
  const row = x => `<li class="ach ${x.claimed ? 'claimed' : x.done ? 'ready' : ''}">
    <div class="ai">${x.claimed ? '✅' : x.done ? '🏆' : '🔒'}</div>
    <div class="at"><b>${esc(x.name)}</b><small>${esc(x.txt)}</small>
      <div class="abar"><i style="width:${Math.round(x.cur / x.goal * 100)}%"></i></div><small class="anum">${fmt(x.cur)} / ${fmt(x.goal)}</small></div>
    <div class="ar">${x.bonus ? '<span class="rbonus">🎁 Pack bonus</span>' : `<span class="coins">${fmt(x.coins)}</span>`}
      ${x.done && !x.claimed ? `<button class="btn small primary" data-claim="${x.id}">Récupérer</button>` : ''}</div></li>`;
  el.innerHTML = `<div class="box setbox"><div class="cardhead"><h2>🏆 Succès</h2><button class="link" data-x="close">Fermer</button></div>
    ${!ACH ? '<p class="muted">Chargement…</p>' : `
    ${ready.length ? `<section class="setsec"><h3>À récupérer</h3><ul class="achs">${ready.map(row).join('')}</ul></section>` : ''}
    <section class="setsec"><h3>Objectifs</h3><ul class="achs">${rest.map(row).join('')}</ul></section>`}</div>`;
  el.querySelector('[data-x=close]').onclick = closeAch;
  el.querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { data, error } = await sb.rpc('claim_achievement', { p_id: b.dataset.claim });
    if (error) { H.toast('Impossible de récupérer cette récompense.'); await loadAchievements(); return; }
    const c = col(); if (c) { c.coins = data.coins; c.bonus = data.bonus_packs; }
    H.sound?.(); H.toast(data.got_bonus ? '🎁 Pack bonus gagné ! Va dans Packs pour l\'ouvrir.' : `+${fmt(data.got_coins)} pièces !`);
    H.changed?.(); await loadAchievements();
  });
}
