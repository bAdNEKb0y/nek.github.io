/* Achat de pièces payé en vrai (en main propre à Hector) + panel admin en direct */
import { sb } from './net.js';
import { $, esc } from './ui.js';
import { sendPush } from './push.js';
import { isOnline, openProfile } from './social.js';

export const OFFERS = [500, 1000, 2500, 5000];
export const euros = c => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const priceOf = coins => euros(coins / 10); // 10 centimes les 100 pièces
const ST = { pending: '⏳ En attente', approved: '✅ Validée', refused: '❌ Refusée', cancelled: 'Annulée' };
const ERR = { too_many_pending: 'Tu as déjà 2 demandes en attente. Attends qu\'Hector les valide.', weekly_limit: 'Limite atteinte : 10 000 pièces (10 €) maximum par semaine.', banned: 'Ton compte est suspendu.', bad_pack: 'Offre inconnue.' };
const errMsg = e => ERR[Object.keys(ERR).find(k => String(e?.message || '').includes(k))] || 'Demande impossible. Vérifie ta connexion.';
const ago = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? 'à l\'instant' : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : s < 86400 ? `il y a ${Math.floor(s / 3600)} h` : new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };

let H = null, ME = null, CH = null, MINE = [], AD = null, pollT = 0;

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
    if (ME.is_admin) { if (AD) loadAdmin(false); else refreshBadge(); }
    if (MINE.some(r => r.status === 'pending')) loadMine();
  }, 15000);
  const btn = $('#bAdmin'); if (btn) { btn.hidden = !ME.is_admin; btn.onclick = openAdmin; }
  if (ME.is_admin && new URLSearchParams(location.search).get('admin')) { history.replaceState(null, '', location.pathname); openAdmin(); }
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
      banner('💶', `${data?.display || 'Un joueur'} veut ${r.coins.toLocaleString('fr-FR')} pièces`, `${euros(r.cents)} à récupérer`, 'Voir', openAdmin);
    }
    if (AD) loadAdmin(false); else refreshBadge();
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

/* ---------- Panel admin ---------- */
async function refreshBadge() {
  const { count } = await sb.from('coin_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  setBadge(count || 0);
}
function setBadge(n) { const b = $('#adminBadge'); if (b) { b.textContent = n; b.hidden = !n; } }

export function openAdmin() {
  if (!ME?.is_admin) return;
  const el = $('#admin'); el.hidden = false;
  AD = { tab: AD?.tab || 'req', q: '', sort: 'recent', sel: null, req: null, users: null, stats: null, ann: null };
  el.innerHTML = `<div class="box setbox adbox"><div class="cardhead"><h2>🛠 Panel admin</h2><span class="ad-live" title="Mise à jour en direct">● EN DIRECT</span><button class="link" data-x="close">Fermer</button></div>
    <nav class="tabs adtabs">${[['req', 'Demandes'], ['users', 'Comptes'], ['stats', 'Stats'], ['ann', 'Annonce']].map(([k, l]) => `<button data-t="${k}">${l}${k === 'req' ? ' <span class="adb" id="adTabBadge" hidden></span>' : ''}</button>`).join('')}</nav>
    <div id="adBody"><p class="muted">Chargement…</p></div></div>`;
  el.querySelector('[data-x=close]').onclick = closeAdmin;
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { AD.tab = b.dataset.t; AD.sel = null; renderAdmin(); loadAdmin(false); });
  renderAdmin(); loadAdmin(true);
}
export function closeAdmin() { AD = null; const el = $('#admin'); el.hidden = true; el.innerHTML = ''; refreshBadge(); }

async function loadAdmin(all) {
  if (!AD) return;
  const t = AD.tab, jobs = [];
  if (all || t === 'req') jobs.push(sb.rpc('admin_requests').then(({ data }) => { if (data && AD) AD.req = data; }));
  if (all || t === 'users') jobs.push(sb.rpc('admin_users').then(({ data }) => { if (data && AD) AD.users = data; }));
  if (t === 'stats') jobs.push(sb.rpc('admin_stats').then(({ data }) => { if (data && AD) AD.stats = data; }));
  if (t === 'ann') jobs.push(sb.from('announcements').select('id,text,created_at').order('created_at', { ascending: false }).limit(15).then(({ data }) => { if (data && AD) AD.ann = data; }));
  await Promise.all(jobs);
  if (AD?.req) setBadge(AD.req.pending);
  renderAdmin();
}

function renderAdmin() {
  if (!AD) return;
  const el = $('#admin'), body = el.querySelector('#adBody'); if (!body) return;
  el.querySelectorAll('.adtabs [data-t]').forEach(b => b.setAttribute('aria-selected', b.dataset.t === AD.tab));
  const tb = el.querySelector('#adTabBadge'); if (tb && AD.req) { tb.textContent = AD.req.pending; tb.hidden = !AD.req.pending; }
  // on garde ce que l'admin est en train d'écrire
  const keep = body.querySelector('input:focus, textarea:focus');
  if (keep && AD.tab !== 'req') return;
  if (AD.tab === 'req') body.innerHTML = reqHTML();
  else if (AD.tab === 'users') body.innerHTML = AD.sel ? userHTML(AD.users?.find(u => u.id === AD.sel)) : usersHTML();
  else if (AD.tab === 'stats') body.innerHTML = statsHTML();
  else body.innerHTML = annHTML();
  bindAdmin(body);
}

function reqHTML() {
  const R = AD.req; if (!R) return '<p class="muted">Chargement…</p>';
  const pend = R.list.filter(r => r.status === 'pending'), old = R.list.filter(r => r.status !== 'pending');
  const row = r => `<li class="ad-req ${r.status}"><div class="ad-who"><b><span class="dot ${isOnline(r.user_id) ? 'on' : ''}"></span>${esc(r.name)}</b><small>${ago(r.created_at)}${r.decided_at && r.status !== 'pending' ? ' · traité ' + ago(r.decided_at) : ''}</small></div>
    <div class="ad-amt"><span class="coins">${r.coins.toLocaleString('fr-FR')}</span><b>${euros(r.cents)}</b></div>
    ${r.status === 'pending' ? `<div class="ad-acts"><button class="btn small primary" data-ok="${r.id}">✓ Payé, valider</button><button class="btn small danger" data-no="${r.id}">Refuser</button></div>` : `<span class="cs-st">${ST[r.status]}</span>`}</li>`;
  return `<div class="ad-kpis"><div><small>En attente</small><b>${R.pending}</b></div><div><small>Encaissé aujourd'hui</small><b>${euros(R.today)}</b></div><div><small>Encaissé au total</small><b>${euros(R.total)}</b></div></div>
    <p class="hint">Valide seulement quand tu as <b>reçu l'argent</b>. Les pièces arrivent tout de suite chez le joueur.</p>
    <section class="setsec"><h3>À valider</h3><ul class="ad-list">${pend.map(row).join('') || '<li class="muted">Rien en attente. Les nouvelles demandes apparaissent ici en direct.</li>'}</ul></section>
    ${old.length ? `<section class="setsec"><h3>Historique</h3><ul class="ad-list">${old.map(row).join('')}</ul></section>` : ''}`;
}

function usersHTML() {
  const U = AD.users; if (!U) return '<p class="muted">Chargement…</p>';
  const q = AD.q.trim().toLowerCase();
  const S = { recent: (a, b) => b.created_at.localeCompare(a.created_at), coins: (a, b) => b.coins - a.coins, elo: (a, b) => b.rating - a.rating, spent: (a, b) => b.spent - a.spent, online: (a, b) => isOnline(b.id) - isOnline(a.id) };
  const list = U.filter(u => !q || u.display.toLowerCase().includes(q)).sort(S[AD.sort] || S.recent);
  const on = U.filter(u => isOnline(u.id)).length;
  return `<div class="ad-tools"><input id="adQ" type="search" placeholder="Chercher un pseudo" value="${esc(AD.q)}" aria-label="Chercher un compte" autocomplete="off" spellcheck="false">
    <select id="adSort" aria-label="Trier">${[['recent', 'Récents'], ['online', 'En ligne'], ['coins', 'Pièces'], ['elo', 'Elo'], ['spent', 'Dépensé']].map(([k, l]) => `<option value="${k}" ${AD.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <p class="hint">${U.length} comptes · ${on} en ligne maintenant</p>
    <ul class="ad-list">${list.map(u => `<li><button class="ad-user ${u.banned ? 'banned' : ''}" data-u="${u.id}"><span class="dot ${isOnline(u.id) ? 'on' : ''}"></span>
      <div class="ad-who"><b>${esc(u.display)}${u.is_admin ? ' <i class="tag">admin</i>' : ''}${u.banned ? ' <i class="tag red">suspendu</i>' : ''}</b><small>Elo ${u.rating} · ${u.wins}V ${u.draws}N ${u.losses}D · ${u.cards} cartes</small></div>
      <div class="ad-amt"><span class="coins">${u.coins.toLocaleString('fr-FR')}</span>${u.spent ? `<b>${euros(u.spent)}</b>` : ''}</div></button></li>`).join('') || '<li class="muted">Aucun compte trouvé.</li>'}</ul>`;
}

function userHTML(u) {
  if (!u) return '<p class="muted">Compte introuvable.</p>';
  return `<button class="link" data-back>← Tous les comptes</button>
    <div class="ad-card"><h3><span class="dot ${isOnline(u.id) ? 'on' : ''}"></span>${esc(u.display)}${u.banned ? ' <i class="tag red">suspendu</i>' : ''}</h3>
      <div class="ad-kpis"><div><small>Pièces</small><b>${u.coins.toLocaleString('fr-FR')}</b></div><div><small>Elo</small><b>${u.rating}</b></div><div><small>Payé en vrai</small><b>${euros(u.spent)}</b></div>
        <div><small>Matchs</small><b>${u.played}</b></div><div><small>Cartes</small><b>${u.cards}</b></div><div><small>Packs ouverts</small><b>${u.packs}</b></div></div>
      <small class="muted">Inscrit ${ago(u.created_at)}${u.last_seen ? ' · dernière activité ' + ago(u.last_seen) : ''}${u.ban_reason ? ' · raison : ' + esc(u.ban_reason) : ''}</small>
      <button class="btn small" data-prof="${u.id}">Voir son profil</button></div>
    <section class="setsec"><h3>Donner ou retirer des pièces</h3>
      <div class="ad-quick">${[100, 500, 1000, -100, -500, -1000].map(n => `<button class="chip" data-add="${n}">${n > 0 ? '+' : ''}${n}</button>`).join('')}</div>
      <div class="ad-tools"><input id="adAmt" type="number" inputmode="numeric" placeholder="Montant (ex. 250 ou -250)" aria-label="Montant"><input id="adNote" maxlength="80" placeholder="Raison (facultatif)" aria-label="Raison"><button class="btn small primary" data-addc>OK</button></div></section>
    ${u.is_admin ? '' : `<section class="setsec"><h3>Sanction</h3>${u.banned ? `<button class="btn" data-ban="0">Lever la suspension</button>`
      : `<div class="ad-tools"><input id="adWhy" maxlength="80" placeholder="Raison de la suspension" aria-label="Raison"><button class="btn danger" data-ban="1">Suspendre le compte</button></div><small class="muted">Un compte suspendu ne peut plus se connecter au jeu.</small>`}</section>`}`;
}

function statsHTML() {
  const S = AD.stats; if (!S) return '<p class="muted">Chargement…</p>';
  const on = AD.users ? AD.users.filter(u => isOnline(u.id)).length : '–';
  const k = (l, v) => `<div><small>${l}</small><b>${v}</b></div>`;
  const A = { coins: '🪙 Pièces', ban: '⛔ Suspension', unban: '✅ Suspension levée', announce: '📣 Annonce', approve: '💶 Achat validé', refuse: '❌ Achat refusé' };
  return `<div class="ad-kpis big">${k('Comptes', S.accounts)}${k('En ligne', on)}${k('Nouveaux (7 j)', S.new7)}${k('Matchs', S.matches)}${k('Matchs aujourd\'hui', S.matches_today)}
    ${k('Encaissé (7 j)', euros(S.cents_week))}${k('Encaissé total', euros(S.cents_total))}${k('En attente', S.pending)}${k('Pièces en jeu', S.coins.toLocaleString('fr-FR'))}
    ${k('Packs ouverts', S.packs)}${k('Échanges', S.trades)}${k('Messages', S.messages)}${k('Suspendus', S.banned)}</div>
    <section class="setsec"><h3>Journal</h3><ul class="ad-list log">${S.log.map(l => `<li><b>${A[l.action] || esc(l.action)}${l.amount ? ` ${l.amount > 0 && l.action === 'coins' ? '+' : ''}${l.amount}` : ''}</b>${l.name ? ` · ${esc(l.name)}` : ''}${l.note ? ` · <i>${esc(l.note)}</i>` : ''}<small>${ago(l.created_at)}</small></li>`).join('') || '<li class="muted">Rien pour l\'instant.</li>'}</ul></section>`;
}

function annHTML() {
  return `<p class="hint">Ton message s'affiche tout de suite chez tous les joueurs connectés, et en notification chez ceux qui les ont activées.</p>
    <textarea id="adAnn" maxlength="160" rows="3" placeholder="Ex. : Tournoi ce soir à 20 h ! 🏆" aria-label="Annonce"></textarea>
    <div class="row"><small class="muted" id="adAnnN">0 / 160</small><button class="btn primary" data-ann>📣 Envoyer à tout le monde</button></div>
    <section class="setsec"><h3>Dernières annonces</h3><ul class="ad-list log">${(AD.ann || []).map(a => `<li>${esc(a.text)}<small>${ago(a.created_at)}</small></li>`).join('') || '<li class="muted">Aucune annonce.</li>'}</ul></section>`;
}

function bindAdmin(b) {
  const busy = async (btn, fn) => { btn.disabled = true; try { await fn(); } finally { btn.disabled = false; } };
  b.querySelectorAll('[data-ok],[data-no]').forEach(x => x.onclick = () => busy(x, async () => {
    const id = +(x.dataset.ok || x.dataset.no), ok = !!x.dataset.ok;
    const { error } = await sb.rpc('admin_decide', { p_id: id, p_approve: ok });
    if (error) H.toast(/not_pending/.test(error.message) ? 'Déjà traitée (ou annulée par le joueur).' : 'Erreur. Réessaie.');
    else { H.toast(ok ? 'Validé : les pièces sont arrivées chez le joueur ✅' : 'Demande refusée.'); sendPush({ kind: 'coinok', id }); }
    loadAdmin(true);
  }));
  const q = b.querySelector('#adQ');
  if (q) q.oninput = () => { AD.q = q.value; const pos = q.selectionStart; renderUsersKeepFocus(pos); };
  const s = b.querySelector('#adSort'); if (s) s.onchange = () => { AD.sort = s.value; renderAdmin(); };
  b.querySelectorAll('[data-u]').forEach(x => x.onclick = () => { AD.sel = x.dataset.u; renderAdmin(); b.scrollTop = 0; $('#admin .adbox').scrollTop = 0; });
  const back = b.querySelector('[data-back]'); if (back) back.onclick = () => { AD.sel = null; renderAdmin(); };
  const pr = b.querySelector('[data-prof]'); if (pr) pr.onclick = () => openProfile(pr.dataset.prof);
  const give = async (n, note, btn) => {
    if (!n || !Number.isFinite(n)) { H.toast('Mets un montant (ex. 250 ou -250).'); return; }
    await busy(btn, async () => {
      const { data, error } = await sb.rpc('admin_coins', { p_user: AD.sel, p_delta: Math.round(n), p_note: note || null });
      if (error) { H.toast('Impossible de modifier les pièces.'); return; }
      H.toast(`${n > 0 ? '+' : ''}${n} pièces → solde ${data.coins.toLocaleString('fr-FR')}`);
      if (AD.sel === ME.id) H.reloadCol();
      await loadAdmin(true);
    });
  };
  b.querySelectorAll('[data-add]').forEach(x => x.onclick = () => give(+x.dataset.add, '', x));
  const ac = b.querySelector('[data-addc]'); if (ac) ac.onclick = () => give(+b.querySelector('#adAmt').value, b.querySelector('#adNote').value.trim(), ac);
  const bn = b.querySelector('[data-ban]');
  if (bn) bn.onclick = () => busy(bn, async () => {
    const ban = bn.dataset.ban === '1';
    const { error } = await sb.rpc('admin_ban', { p_user: AD.sel, p_ban: ban, p_reason: b.querySelector('#adWhy')?.value.trim() || null });
    H.toast(error ? 'Action impossible.' : ban ? 'Compte suspendu.' : 'Suspension levée.');
    await loadAdmin(true);
  });
  const ta = b.querySelector('#adAnn');
  if (ta) ta.oninput = () => { b.querySelector('#adAnnN').textContent = `${ta.value.length} / 160`; };
  const an = b.querySelector('[data-ann]');
  if (an) an.onclick = () => busy(an, async () => {
    const t = ta.value.trim(); if (!t) { H.toast('Écris un message d\'abord.'); return; }
    const { error } = await sb.rpc('admin_announce', { p_text: t });
    if (error) { H.toast('Annonce impossible.'); return; }
    sendPush({ kind: 'announce' }); ta.value = ''; ta.blur(); H.toast('Annonce envoyée à tout le monde 📣');
    await loadAdmin(false);
  });
}
function renderUsersKeepFocus(pos) {
  const body = $('#adBody'); body.innerHTML = usersHTML(); bindAdmin(body);
  const q = body.querySelector('#adQ'); q.focus(); try { q.setSelectionRange(pos, pos); } catch { }
}
