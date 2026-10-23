/* Achat de pièces payé en vrai (en main propre à Hector) + panel admin en direct */
import { sb } from './net.js';
import { $, esc } from './ui.js';
import { sendPush } from './push.js';

export const OFFERS = [500, 1000, 2500, 5000];
export const euros = c => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const priceOf = coins => euros(coins / 10); // 10 centimes les 100 pièces
const ST = { pending: '⏳ En attente', approved: '✅ Validée', refused: '❌ Refusée', cancelled: 'Annulée' };
const ERR = { too_many_pending: 'Tu as déjà 2 demandes en attente. Attends qu\'Hector les valide.', weekly_limit: 'Limite atteinte : 10 000 pièces (10 €) maximum par semaine.', banned: 'Ton compte est suspendu.', bad_pack: 'Offre inconnue.' };
const errMsg = e => ERR[Object.keys(ERR).find(k => String(e?.message || '').includes(k))] || 'Demande impossible. Vérifie ta connexion.';
const ago = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? 'à l\'instant' : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : s < 86400 ? `il y a ${Math.floor(s / 3600)} h` : new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };

let H = null, ME = null, CH = null, MINE = [], pollT = 0;

export function initBank(h) {
  H = h; ME = h.me();
  stopBank();
  // Temps réel : chaque changement de demande arrive tout de suite (le joueur ne voit que les siennes, l'admin voit tout)
  CH = sb.channel('bank-' + ME.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_requests' }, ({ new: r, old: o, eventType }) => onReq(r, o, eventType))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, ({ new: a }) => showAnnounce(a))
    .subscribe();
  loadMine();
  if (ME.is_admin) { refreshBadge(); }
  // filet de sécurité si le temps réel coupe (réseau mobile) : petite vérification régulière
  pollT = setInterval(() => {
    if (document.hidden) return;
    if (ME.is_admin) refreshBadge();
    if (MINE.some(r => r.status === 'pending')) loadMine();
  }, 15000);
  const btn = $('#bAdmin'); if (btn) { btn.hidden = !ME.is_admin; btn.onclick = openAdmin; }
}
export function stopBank() { if (CH) { sb.removeChannel(CH); CH = null; } clearInterval(pollT); }

async function onReq(r, o, type) {
  if (!r?.id && !o?.id) return;
  const mine = r?.user_id === ME.id;
  if (mine) {
    const before = MINE.find(x => x.id === r.id);
    if (type === 'UPDATE' && before?.status === 'pending' && r.status === 'approved') { await H.reloadCol(); H.sound?.(); banner('🪙', `+${r.coins.toLocaleString('fr-FR')} pièces !`, 'Ton achat est validé. Bon pack opening !', 'Packs', () => H.openShop?.()); }
    else if (type === 'UPDATE' && before?.status === 'pending' && r.status === 'refused') banner('❌', 'Demande refusée', `Ta demande de ${r.coins} pièces a été refusée.`);
    loadMine();
  }
  if (ME.is_admin) {
    if (type === 'INSERT' && r.status === 'pending' && !mine) {
      H.sound?.();
      const { data } = await sb.from('profiles').select('display').eq('id', r.user_id).maybeSingle();
      banner('💶', `${data?.display || 'Un joueur'} veut ${r.coins.toLocaleString('fr-FR')} pièces`, `${euros(r.cents)} à récupérer`, 'Ouvrir le panel', openAdmin);
    }
    refreshBadge();
  }
}

/* ---------- Bandeau de notification dans le jeu ---------- */
let banT = 0;
function banner(icon, title, sub, act, fn) {
  document.querySelector('.invite.bank')?.remove(); clearTimeout(banT);
  const d = document.createElement('div'); d.className = 'invite bank'; d.setAttribute('role', 'status');
  d.innerHTML = `<span class="ib">${icon}</span><div><b>${esc(title)}</b><small>${esc(sub)}</small></div>${act ? `<button class="btn small primary" data-b="go">${esc(act)}</button>` : ''}<button class="btn small" data-b="x" aria-label="Fermer">✕</button>`;
  ($('#app') || document.body).appendChild(d);
  const close = () => { clearTimeout(banT); d.remove(); };
  d.querySelector('[data-b=x]').onclick = close;
  const g = d.querySelector('[data-b=go]'); if (g) g.onclick = () => { close(); fn?.(); };
  banT = setTimeout(close, 9000);
}
function showAnnounce(a) {
  if (!a?.text) return;
  H.sound?.(true);
  banner('📣', 'Annonce', a.text);
}

/* ---------- Côté joueur : onglet « Pièces » de la boutique ---------- */
async function loadMine() {
  const { data } = await sb.from('coin_requests').select('id,coins,cents,status,created_at,decided_at').eq('user_id', ME.id).order('created_at', { ascending: false }).limit(20);
  if (Array.isArray(data)) MINE = data;
  const el = $('#coinShop'); if (el) renderCoinShop(el.parentElement);
}
let PICK = 0;
export function renderCoinShop(body) {
  const pend = MINE.filter(r => r.status === 'pending');
  const week = MINE.filter(r => (r.status === 'approved' || r.status === 'pending') && Date.now() - Date.parse(r.created_at) < 7 * 864e5).reduce((s, r) => s + r.coins, 0);
  body.innerHTML = `<div id="coinShop" class="cshop">
    <div class="cs-how"><b>💶 Acheter des pièces avec de vrais sous</b>
      <ol><li>Choisis ton offre et envoie la demande.</li><li>Donne l'argent <b>en main propre à Hector</b>.</li><li>Il valide sur son panel : les pièces arrivent <b>direct</b> dans ton jeu.</li></ol>
      <small>10 centimes les 100 pièces · 10 € maximum par semaine · demande à tes parents avant d'acheter.</small></div>
    ${PICK ? `<div class="cs-confirm" role="dialog" aria-label="Confirmer la demande">
        <p>Demander <b>${PICK.toLocaleString('fr-FR')} pièces</b> pour <b>${priceOf(PICK)}</b> ?</p>
        <small>Tu devras donner ${priceOf(PICK)} à Hector. Tant qu'il n'a pas validé, tu peux annuler.</small>
        <div class="row"><button class="btn primary" data-cs="send">Envoyer la demande</button><button class="btn" data-cs="no">Retour</button></div></div>`
      : `<div class="cs-offers">${OFFERS.map(c => `<button class="cs-off" data-c="${c}" ${pend.length >= 2 || week + c > 10000 ? 'disabled' : ''}>
        <span class="coins">${c.toLocaleString('fr-FR')}</span><b>${priceOf(c)}</b>${c === 2500 ? '<i>Populaire</i>' : c === 5000 ? '<i>Max</i>' : ''}</button>`).join('')}</div>
        ${pend.length >= 2 ? '<p class="hint">Tu as 2 demandes en attente : attends qu\'elles soient validées.</p>' : week >= 10000 ? '<p class="hint">Tu as atteint la limite de la semaine.</p>' : ''}`}
    <section class="setsec"><h3>Mes demandes</h3><ul class="cs-list">${MINE.map(r => `<li class="cs-row ${r.status}"><div><b>${r.coins.toLocaleString('fr-FR')} pièces · ${euros(r.cents)}</b><small>${ago(r.created_at)}</small></div>
      <span class="cs-st">${ST[r.status] || r.status}</span>${r.status === 'pending' ? `<button class="btn small" data-cancel="${r.id}">Annuler</button>` : ''}</li>`).join('') || '<li class="muted">Aucune demande pour l\'instant.</li>'}</ul></section></div>`;
  body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { PICK = +b.dataset.c; renderCoinShop(body); });
  const no = body.querySelector('[data-cs=no]'); if (no) no.onclick = () => { PICK = 0; renderCoinShop(body); };
  const go = body.querySelector('[data-cs=send]');
  if (go) go.onclick = async () => {
    go.disabled = true;
    const { data, error } = await sb.rpc('request_coins', { p_coins: PICK });
    if (error) { H.toast(errMsg(error)); PICK = 0; await loadMine(); return; }
    H.toast(`Demande envoyée ! Donne ${priceOf(PICK)} à Hector pour recevoir tes pièces.`);
    sendPush({ kind: 'coinreq', id: data.id });
    PICK = 0; await loadMine();
  };
  body.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { b.disabled = true; await sb.rpc('cancel_coin_request', { p_id: +b.dataset.cancel }); loadMine(); });
}
export const refreshCoinShop = () => loadMine();

/* ---------- Admin : le panel est une page à part (/admin) ---------- */
async function refreshBadge() {
  const { count } = await sb.from('coin_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  const b = $('#adminBadge'); if (b) { b.textContent = count || 0; b.hidden = !count; }
}
export function openAdmin() { if (ME?.is_admin) window.open('admin.html', 'fdp-admin'); }
export function closeAdmin() { }
