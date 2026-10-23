/* Profils, amis, joueurs en ligne et défis entre amis */
import { sb } from './net.js';
import { TEAMS, KITS, CARDS, CARD_LIST, TRANK, TIER_NAME } from './data.js';
import { $, esc, shirtSVG, cardHTML } from './ui.js';

let H = null, ME = null, CH = null;
export const TITLES = ['Buteur né', 'Le Mur', 'Roi du dribble', 'Maître des packs', 'Chasseur de légendes', 'Capitaine', 'Pro de la retournée', 'Tacleur fou', 'Passeur de génie', 'Futur Ballon d\'Or', 'Supporter n°1', 'Débutant motivé'];
const ONLINE = new Map(); // uid -> {name, busy}
let FRIENDS = [], UNREAD = {}, CHAT = null, TRADES = [];
/** Messages rapides (pas de texte libre : pas d'insultes ni d'inconnus qui écrivent n'importe quoi) */
export const MSGS = ['Salut ! 👋', 'On joue ? ⚽', 'GG ! 👏', 'Revanche ? 😤', 'Bien joué !', 'Trop fort 🔥', 'J\'arrive !', 'Pas maintenant, plus tard',
  'T\'as eu quoi dans tes packs ?', 'J\'ai eu une légende !! 🤩', 'Merci !', 'Bonne nuit 😴', '😂', '👍', '⚽🔥', 'Viens dans ma salle !'];

const kitOf = p => {
  if (p.avatar) { const k = KITS.find(x => x.id === p.avatar); if (k) return k.k; }
  const t = TEAMS.find(x => x.short === p.fav_team); return t ? t.h : ['#5b6b63', '#eef3ea', 'solid'];
};
const errMsg = e => {
  const m = String(e?.message || e || '');
  return /not_found/.test(m) ? 'Aucun joueur avec ce pseudo.' : /self/.test(m) ? 'Tu ne peux pas t\'ajouter toi-même 🙂' : /too_many/.test(m) ? 'Tu as déjà trop d\'amis.'
    : /card_not_owned/.test(m) ? 'Cette carte n\'est pas dans ta collection.' : 'Impossible pour le moment. Vérifie ta connexion et réessaie.';
};
export const isOnline = id => ONLINE.has(id);

/** À appeler après la connexion : présence en ligne + réception des défis */
export function initSocial(h) {
  H = h; ME = h.me();
  if (CH) sb.removeChannel(CH);
  CH = sb.channel('online', { config: { presence: { key: ME.id }, broadcast: { self: false } } });
  CH.on('presence', { event: 'sync' }, () => {
    ONLINE.clear();
    for (const [k, arr] of Object.entries(CH.presenceState())) if (arr[0]) ONLINE.set(k, arr[0]);
    renderFriends();
  });
  CH.on('broadcast', { event: 'invite' }, ({ payload: p }) => { if (p?.to === ME.id) showInvite(p); });
  CH.on('broadcast', { event: 'invite-no' }, ({ payload: p }) => { if (p?.to === ME.id) H.toast(`${p.name} ne peut pas jouer maintenant.`); });
  CH.on('broadcast', { event: 'msg' }, ({ payload: p }) => { if (p?.to === ME.id) gotMsg(p); });
  CH.on('broadcast', { event: 'trade' }, async ({ payload: p }) => {
    if (p?.to !== ME.id) return;
    await loadTrades();
    if (p.kind === 'accepted') { await H.reloadCol?.(); notify(`🔄 ${p.name} a accepté ton échange !`, 'La carte est dans ta collection.', openTrades); }
    else if (p.kind === 'declined') notify(`${p.name} a refusé ton échange`, 'Tu peux proposer autre chose.', openTrades);
    else notify(`🔄 ${p.name} te propose un échange`, 'Regarde son offre dans Échanges.', openTrades);
  });
  CH.on('broadcast', { event: 'friend' }, ({ payload: p }) => {
    if (p?.to !== ME.id) return;
    loadFriends();
    notify(p.ok ? `${p.name} a accepté ta demande d'ami !` : `${p.name} veut être ton ami`, p.ok ? 'Vous pouvez maintenant vous défier.' : 'Accepte-le dans la liste Amis.', () => p.ok ? openChat(p.from) : openProfile(p.from));
  });
  CH.subscribe(async st => { if (st === 'SUBSCRIBED') await CH.track({ name: ME.display, at: Date.now() }); });
  loadFriends(true);
}
export function stopSocial() { if (CH) { sb.removeChannel(CH); CH = null; } ONLINE.clear(); }

/* ---------- Amis ---------- */
export async function loadFriends(first) {
  const [{ data, error }, { data: un }] = await Promise.all([sb.rpc('my_friends'), sb.rpc('unread_msgs')]);
  if (!error && Array.isArray(data)) FRIENDS = data;
  if (un && typeof un === 'object') UNREAD = un;
  await loadTrades();
  if (first) {
    const n = Object.values(UNREAD).reduce((a, b) => a + b, 0), req = FRIENDS.filter(f => f.status === 'pending' && f.incoming).length;
    if (n) H.toast(`💬 Tu as ${n} nouveau${n > 1 ? 'x' : ''} message${n > 1 ? 's' : ''} de tes amis.`);
    else if (req) H.toast(`👋 ${req} demande${req > 1 ? 's' : ''} d'ami en attente.`);
    else if (incTrades()) H.toast(`🔄 Tu as ${incTrades()} proposition${incTrades() > 1 ? 's' : ''} d'échange.`);
  }
}
export function renderFriends() {
  const el = $('#friends'); if (!el || !ME) return;
  const acc = FRIENDS.filter(f => f.status === 'accepted').sort((a, b) => isOnline(b.id) - isOnline(a.id) || b.rating - a.rating);
  const inc = FRIENDS.filter(f => f.status === 'pending' && f.incoming), out = FRIENDS.filter(f => f.status === 'pending' && !f.incoming);
  const on = acc.filter(f => isOnline(f.id)).length;
  $('#friendsCount').textContent = acc.length ? `${on} en ligne · ${acc.length} ami${acc.length > 1 ? 's' : ''}` : '';
  const row = (f, extra) => `<li class="frow"><button class="fmain" data-prof="${f.id}"><span class="fav">${shirtSVG(kitOf(f))}<i class="dot ${isOnline(f.id) ? 'on' : ''}"></i></span>
    <span class="fnm"><b>${esc(f.display)}</b><small>${isOnline(f.id) ? 'En ligne' : 'Hors ligne'} · ${f.rating} pts</small></span></button>${extra || ''}</li>`;
  el.innerHTML = (inc.length ? `<li class="fsec">Demandes reçues</li>${inc.map(f => row(f, `<span class="facts"><button class="btn small primary" data-acc="${f.id}">Accepter</button><button class="btn small" data-ref="${f.id}">Non</button></span>`)).join('')}` : '')
    + acc.map(f => row(f, `<button class="btn small fmsg" data-chat="${f.id}" aria-label="Messages avec ${esc(f.display)}">💬${UNREAD[f.id] ? `<i class="badge">${UNREAD[f.id]}</i>` : ''}</button>${isOnline(f.id) ? `<button class="btn small chal" data-chal="${f.id}">Défier</button>` : ''}`)).join('')
    + (out.length ? `<li class="fsec">Demandes envoyées</li>${out.map(f => row(f, `<button class="link" data-ref="${f.id}">Annuler</button>`)).join('')}` : '')
    || '<li class="muted">Ajoute tes potes avec leur pseudo pour les défier en un clic.</li>';
  el.querySelectorAll('[data-prof]').forEach(b => b.onclick = () => openProfile(b.dataset.prof));
  el.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => respond(b.dataset.acc, true));
  el.querySelectorAll('[data-ref]').forEach(b => b.onclick = () => respond(b.dataset.ref, false));
  el.querySelectorAll('[data-chal]').forEach(b => b.onclick = () => challenge(FRIENDS.find(f => f.id === b.dataset.chal)));
  el.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => openChat(b.dataset.chat));
  const tot = Object.values(UNREAD).reduce((a, b) => a + b, 0) + inc.length + incTrades();
  const tb = $('#tradesBadge'); if (tb) { tb.textContent = incTrades() || ''; tb.hidden = !incTrades(); }
  const hb = $('#friendsBadge'); if (hb) { hb.textContent = tot || ''; hb.hidden = !tot; }
}
export async function addFriend(name) {
  const { data, error } = await sb.rpc('friend_request', { p_name: name });
  if (error) { H.toast(errMsg(error)); return false; }
  H.toast(data.status === 'accepted' ? 'Vous êtes maintenant amis !' : 'Demande d\'ami envoyée.');
  CH?.send({ type: 'broadcast', event: 'friend', payload: { to: data.id, from: ME.id, name: ME.display, ok: data.status === 'accepted' } });
  await loadFriends(); return true;
}
async function respond(id, ok) {
  const { error } = await sb.rpc('friend_respond', { p_other: id, p_accept: ok });
  if (error) { H.toast(errMsg(error)); return; }
  if (ok) CH?.send({ type: 'broadcast', event: 'friend', payload: { to: id, from: ME.id, name: ME.display, ok: true } });
  await loadFriends(); if (!$('#profile').hidden) openProfile(id);
}

/* ---------- Défis ---------- */
function challenge(f) {
  if (!f || !CH) return;
  const code = H.createRoom();
  CH.send({ type: 'broadcast', event: 'invite', payload: { to: f.id, from: ME.id, name: ME.display, code } });
  H.toast(`Défi envoyé à ${f.display}. Il arrive dans ta salle…`);
  closeProfile();
}
let invT = null;
function showInvite(p) {
  if (H.busy()) { CH?.send({ type: 'broadcast', event: 'invite-no', payload: { to: p.from, name: ME.display } }); return; }
  document.querySelector('.invite')?.remove(); clearTimeout(invT);
  const d = document.createElement('div'); d.className = 'invite'; d.setAttribute('role', 'alertdialog');
  d.innerHTML = `<span class="ib">⚽</span><div><b>${esc(p.name)} te défie !</b><small>Match en ligne · salle ${esc(p.code)}</small></div>
    <button class="btn small primary" data-i="go">Jouer</button><button class="btn small" data-i="no">Non</button>`;
  $('#app').appendChild(d); H.sound?.();
  const close = () => { clearTimeout(invT); d.remove(); };
  d.querySelector('[data-i=go]').onclick = () => { close(); H.joinRoom(p.code); };
  d.querySelector('[data-i=no]').onclick = () => { close(); CH?.send({ type: 'broadcast', event: 'invite-no', payload: { to: p.from, name: ME.display } }); };
  invT = setTimeout(close, 30000);
}

/* ---------- Profil ---------- */
let PROF = null, EDIT = false;
export async function openProfile(id) {
  const el = $('#profile');
  el.hidden = false; EDIT = false;
  el.innerHTML = `<div class="box setbox profbox"><div class="cardhead"><h2>Profil</h2><button class="link" data-x="close">Fermer</button></div><p class="muted" style="padding:20px 0">Chargement…</p></div>`;
  el.querySelector('[data-x=close]').onclick = closeProfile;
  const { data, error } = await sb.rpc('get_profile', { p_id: id });
  if (el.hidden) return;
  if (error || !data) { el.querySelector('.profbox p').textContent = 'Profil introuvable.'; return; }
  PROF = data; renderProfile();
}
export function closeProfile() { const el = $('#profile'); el.hidden = true; el.innerHTML = ''; PROF = null; }
function renderProfile() {
  const p = PROF, el = $('#profile'), mine = p.id === ME.id, col = H.col();
  const pct = p.played ? Math.round(p.wins / p.played * 100) : 0, k = kitOf(p);
  const fav = p.fav_card && CARDS[p.fav_card], best = (p.best || []).map(id => CARDS[id]).filter(Boolean);
  const since = p.since ? new Date(p.since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';
  const fr = p.friend, inc = p.incoming;
  let act = '';
  if (mine) act = `<button class="btn" data-x="edit">${EDIT ? 'Terminé' : 'Modifier mon profil'}</button>`;
  else if (fr === 'accepted') act = `${isOnline(p.id) ? `<button class="btn primary" data-x="chal">Défier</button>` : ''}<button class="btn" data-x="msg">💬 Message</button><button class="btn" data-x="trade">🔄 Échanger</button><button class="btn" data-x="unfriend">Retirer des amis</button>`;
  else if (fr === 'pending' && inc) act = `<button class="btn primary" data-x="accept">Accepter en ami</button><button class="btn" data-x="refuse">Refuser</button>`;
  else if (fr === 'pending') act = `<button class="btn" disabled>Demande envoyée</button>`;
  else act = `<button class="btn primary" data-x="add">Ajouter en ami</button>`;
  const stat = (v, l) => `<div class="pstat"><b>${v}</b><span>${l}</span></div>`;
  const recent = (p.recent || []).map(m => {
    const home = m.home === p.id, my = home ? m.home_score : m.away_score, op = home ? m.away_score : m.home_score, r = my > op ? 'w' : my < op ? 'l' : 'd';
    return `<li><span class="res ${r}">${r === 'w' ? 'V' : r === 'l' ? 'D' : 'N'}</span><span>contre <b>${esc(m.opp || 'Joueur supprimé')}</b></span><span class="sc">${my} – ${op}</span></li>`;
  }).join('');
  el.innerHTML = `<div class="box setbox profbox"><div class="cardhead"><h2>${mine ? 'Mon profil' : 'Profil'}</h2><button class="link" data-x="close">Fermer</button></div>
    <div class="phero" style="--k1:${k[0]};--k2:${k[1]}">
      <div class="pav">${shirtSVG(k)}<i class="dot ${mine || isOnline(p.id) ? 'on' : ''}"></i></div>
      <div class="pid">${p.title ? `<em class="ptitle">${esc(p.title)}</em>` : ''}<b>${esc(p.display)}</b><span>#${p.rank} au classement · ${since ? 'joue depuis ' + since : ''}</span></div>
      <div class="pelo"><b>${p.rating}</b><span>points</span></div>
    </div>
    <div class="pacts">${act}</div>
    ${EDIT ? editHTML(p, col) : ''}
    <section class="setsec"><h3>Statistiques</h3>
      <div class="pstats">${stat(p.played, 'matchs')}${stat(p.wins, 'victoires')}${stat(p.draws, 'nuls')}${stat(p.losses, 'défaites')}${stat(pct + ' %', 'de victoires')}${stat(p.goals_for, 'buts marqués')}${stat(p.goals_against, 'buts encaissés')}${stat(p.played ? (p.goals_for / p.played).toFixed(1) : '0', 'buts / match')}</div>
      <div class="pbar" title="Victoires, nuls, défaites"><i class="w" style="flex:${p.wins || 0}"></i><i class="d" style="flex:${p.draws || 0}"></i><i class="l" style="flex:${p.losses || 0}"></i>${p.played ? '' : '<i class="e" style="flex:1"></i>'}</div>
    </section>
    <section class="setsec"><h3>Collection</h3>
      <div class="pstats">${stat(`${p.cards}<small>/${CARD_LIST.length}</small>`, 'cartes')}${stat(p.packs, 'packs ouverts')}${p.team_name ? stat(esc(p.team_name), 'son équipe') : ''}</div>
      <div class="pcards">${fav ? `<div class="pcard"><small>Carte favorite</small>${cardHTML(fav, { small: true })}</div>` : ''}${best.map((c, i) => `<div class="pcard"><small>${i ? 'Top ' + (i + 1) : 'Meilleure carte'}</small>${cardHTML(c, { small: true })}</div>`).join('')}${!fav && !best.length ? '<p class="muted">Pas encore de cartes.</p>' : ''}</div>
    </section>
    <section class="setsec"><h3>Derniers matchs en ligne</h3><ul class="recent">${recent || '<li class="muted">Aucun match en ligne pour l\'instant.</li>'}</ul></section>
  </div>`;
  const on = (x, f) => { const b = el.querySelector(`[data-x=${x}]`); if (b) b.onclick = f; };
  on('close', closeProfile);
  on('edit', () => { EDIT = !EDIT; renderProfile(); });
  on('add', async () => { if (await addFriend(p.display)) openProfile(p.id); });
  on('accept', () => respond(p.id, true));
  on('refuse', () => respond(p.id, false));
  on('unfriend', () => respond(p.id, false));
  on('chal', () => challenge({ id: p.id, display: p.display }));
  on('msg', () => { closeProfile(); openChat(p.id); });
  on('trade', () => { closeProfile(); openTradeWith(p.id, p.display); });
  if (EDIT) {
    el.querySelectorAll('[data-av]').forEach(b => b.onclick = () => saveProfile({ avatar: b.dataset.av }));
    el.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => saveProfile({ fav_card: b.dataset.fc || null }));
    el.querySelectorAll('[data-tt]').forEach(b => b.onclick = () => saveProfile({ title: b.dataset.tt || null }));
  }
}
function editHTML(p, col) {
  const cards = (col?.cards || []).map(id => CARDS[id]).filter(Boolean).sort((a, b) => b.r - a.r).slice(0, 40);
  return `<section class="setsec pedit"><h3>Mon titre</h3><div class="chips">${['', ...TITLES].map(t => `<button class="chip" data-tt="${esc(t)}" aria-pressed="${(p.title || '') === t}">${t ? esc(t) : 'Aucun'}</button>`).join('')}</div>
    <h3>Mon maillot</h3><div class="pkits">${KITS.map(x => `<button class="pkit" data-av="${x.id}" aria-pressed="${p.avatar === x.id}" title="${x.id}">${shirtSVG(x.k)}</button>`).join('')}</div>
    <h3>Ma carte favorite</h3><div class="pfcs">${cards.map(c => `<button class="pfc" data-fc="${c.id}" aria-pressed="${p.fav_card === c.id}">${cardHTML(c, { small: true })}</button>`).join('') || '<p class="muted">Ouvre des packs pour avoir des cartes.</p>'}</div></section>`;
}
async function saveProfile(ch) {
  const nx = { avatar: PROF.avatar, fav_card: PROF.fav_card, title: PROF.title, ...ch };
  const { error } = await sb.rpc('set_profile', { p_avatar: nx.avatar || null, p_fav_card: nx.fav_card || null, p_title: nx.title || null });
  if (error) { H.toast(errMsg(error)); return; }
  Object.assign(PROF, nx); Object.assign(ME, nx);
  const sc = $('#profile .setbox')?.scrollTop || 0; renderProfile(); const b = $('#profile .setbox'); if (b) b.scrollTop = sc;
  H.onMeChange?.();
}

/* ---------- Messages entre amis ---------- */
function friendOf(id) { return FRIENDS.find(f => f.id === id); }
export async function openChat(id) {
  const f = friendOf(id); if (!f) return;
  CHAT = { id, list: [] };
  const el = $('#chat'); el.hidden = false; renderChat(true);
  const { data } = await sb.rpc('my_msgs', { p_with: id });
  if (!CHAT || CHAT.id !== id) return;
  CHAT.list = Array.isArray(data) ? data : []; delete UNREAD[id]; renderFriends(); renderChat();
}
export function closeChat() { CHAT = null; const el = $('#chat'); el.hidden = true; el.innerHTML = ''; }
function renderChat(loading) {
  const el = $('#chat'), f = friendOf(CHAT.id), on = isOnline(f.id);
  const canNotif = 'Notification' in window && Notification.permission === 'default';
  el.innerHTML = `<div class="box setbox chatbox"><div class="cardhead"><button class="fmain" data-x="prof"><span class="fav">${shirtSVG(kitOf(f))}<i class="dot ${on ? 'on' : ''}"></i></span><span class="fnm"><b>${esc(f.display)}</b><small>${on ? 'En ligne' : 'Hors ligne · il verra ton message plus tard'}</small></span></button>
      ${on ? '<button class="btn small chal" data-x="chal">Défier</button>' : ''}<button class="link" data-x="close">Fermer</button></div>
    <div class="msgs" id="msgs">${loading ? '<p class="muted">Chargement…</p>' : CHAT.list.length ? CHAT.list.map(m => `<div class="bub ${m.mine ? 'me' : ''}"><span>${esc(MSGS[m.msg] ?? '…')}</span><time>${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time></div>`).join('') : '<p class="muted">Pas encore de message. Dis-lui bonjour !</p>'}</div>
    <div class="qmsgs">${MSGS.map((t, i) => `<button class="chip" data-m="${i}">${esc(t)}</button>`).join('')}</div>
    <p class="hint">Messages rapides seulement, pour que ça reste sympa entre joueurs.${canNotif ? ' <button class="link" data-x="notif">Activer les notifications</button>' : ''}</p></div>`;
  const box = el.querySelector('#msgs'); box.scrollTop = box.scrollHeight;
  el.querySelector('[data-x=close]').onclick = closeChat;
  el.querySelector('[data-x=prof]').onclick = () => { const id = f.id; closeChat(); openProfile(id); };
  const c = el.querySelector('[data-x=chal]'); if (c) c.onclick = () => { closeChat(); challenge(f); };
  const n = el.querySelector('[data-x=notif]'); if (n) n.onclick = () => Notification.requestPermission().then(() => renderChat());
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => sendMsg(f.id, +b.dataset.m));
}
async function sendMsg(to, m) {
  const { data, error } = await sb.rpc('send_msg', { p_to: to, p_msg: m });
  if (error) { H.toast(/too_fast/.test(error.message) ? 'Doucement ! Attends un peu avant de renvoyer un message.' : /not_friends/.test(error.message) ? 'Vous n\'êtes plus amis.' : 'Message non envoyé. Réessaie.'); return; }
  CH?.send({ type: 'broadcast', event: 'msg', payload: { to, from: ME.id, name: ME.display, m, id: data.id } });
  if (CHAT && CHAT.id === to) { CHAT.list.push({ id: data.id, mine: true, msg: m, created_at: data.at || new Date().toISOString() }); renderChat(); }
}
function gotMsg(p) {
  if (!friendOf(p.from)) { loadFriends(); }
  if (CHAT && CHAT.id === p.from) {
    CHAT.list.push({ id: p.id, mine: false, msg: p.m, created_at: new Date().toISOString() }); renderChat();
    sb.rpc('my_msgs', { p_with: p.from }); // marque comme lu
    H.sound?.(true); return;
  }
  UNREAD[p.from] = (UNREAD[p.from] || 0) + 1; renderFriends();
  notify(`💬 ${p.name}`, MSGS[p.m] ?? '', () => openChat(p.from));
}
/** Notification dans le jeu (+ notification du téléphone si l'appli est en arrière-plan et que c'est autorisé) */
let notT = null;
function notify(title, body, onOpen) {
  if (H.inMatch?.()) { H.toast(`${title} : ${body}`); return; }
  document.querySelector('.notif')?.remove(); clearTimeout(notT);
  const d = document.createElement('button'); d.className = 'notif'; d.type = 'button';
  d.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}</span>`;
  d.onclick = () => { d.remove(); onOpen?.(); };
  $('#app').appendChild(d); H.sound?.(true);
  notT = setTimeout(() => d.remove(), 6000);
  try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') { const n = new Notification(title, { body, icon: 'icon.svg', tag: 'fdp' }); n.onclick = () => { window.focus(); onOpen?.(); n.close(); }; } } catch { }
}

/* ---------- Échanges de cartes ---------- */
const incTrades = () => TRADES.filter(t => t.status === 'pending' && !t.mine).length;
export async function loadTrades() {
  const { data } = await sb.rpc('my_trades');
  if (Array.isArray(data)) TRADES = data;
  renderFriends();
  if (!$('#trade').hidden && $('#trade').dataset.mode === 'list') renderTrades();
}
const tradeErr = e => {
  const m = String(e?.message || '');
  return /they_have_it/.test(m) ? 'Ton ami a déjà cette carte.' : /you_have_it/.test(m) ? 'Tu as déjà cette carte.' : /not_owned|they_dont_own|invalid/.test(m) ? 'Une des cartes n\'est plus disponible.'
    : /too_many/.test(m) ? 'Tu as déjà 10 offres en attente.' : /already/.test(m) ? 'Tu as déjà proposé cet échange.' : /not_friends/.test(m) ? 'Vous devez être amis.' : 'Échange impossible. Réessaie.';
};
const mini = (id, extra = '') => { const c = CARDS[id]; return c ? `<div class="tcard ${extra}">${cardHTML(c, { small: true })}</div>` : '<div class="tcard gone">?</div>'; };
export function openTrades() { const el = $('#trade'); el.hidden = false; el.dataset.mode = 'list'; renderTrades(); loadTrades(); }
function renderTrades() {
  const el = $('#trade');
  const st = { pending: 'En attente', accepted: 'Accepté ✓', declined: 'Refusé', cancelled: 'Annulé', expired: 'Plus possible' };
  const row = t => `<li class="trow"><div class="tinfo"><b>${t.mine ? `Ta proposition à ${esc(t.name)}` : `${esc(t.name)} te propose`}</b><small class="tst ${t.status}">${st[t.status] || t.status}</small></div>
    <div class="tswap">${mini(t.mine ? t.give : t.want)}<span class="tarrow">⇄</span>${mini(t.mine ? t.want : t.give)}</div>
    <div class="tlab"><span>${t.mine ? 'Tu donnes' : 'Tu donnes'}</span><span>Tu reçois</span></div>
    ${t.status === 'pending' ? (t.mine ? `<div class="tacts"><button class="btn small" data-tc="${t.id}">Annuler</button></div>` : `<div class="tacts"><button class="btn small primary" data-ta="${t.id}">Accepter</button><button class="btn small" data-td="${t.id}">Refuser</button></div>`) : ''}</li>`;
  const pend = TRADES.filter(t => t.status === 'pending'), old = TRADES.filter(t => t.status !== 'pending');
  el.innerHTML = `<div class="box setbox"><div class="cardhead"><h2>Échanges</h2><button class="link" data-x="close">Fermer</button></div>
    <p class="hint" style="padding-top:10px">Pour échanger, ouvre le profil d'un ami et touche « 🔄 Échanger ». Chaque carte part contre une autre, et les deux doivent être d'accord.</p>
    <section class="setsec"><h3>En cours</h3><ul class="trades">${pend.map(row).join('') || '<li class="muted">Aucun échange en cours.</li>'}</ul></section>
    ${old.length ? `<section class="setsec"><h3>Derniers jours</h3><ul class="trades">${old.map(row).join('')}</ul></section>` : ''}</div>`;
  el.querySelector('[data-x=close]').onclick = closeTrade;
  el.querySelectorAll('[data-ta]').forEach(b => b.onclick = () => respondTrade(+b.dataset.ta, true, b));
  el.querySelectorAll('[data-td]').forEach(b => b.onclick = () => respondTrade(+b.dataset.td, false, b));
  el.querySelectorAll('[data-tc]').forEach(b => b.onclick = async () => { b.disabled = true; await sb.rpc('trade_cancel', { p_id: +b.dataset.tc }); loadTrades(); });
}
async function respondTrade(id, ok, btn) {
  btn.disabled = true;
  const t = TRADES.find(x => x.id === id);
  const { error } = await sb.rpc('trade_respond', { p_id: id, p_accept: ok });
  if (error) { H.toast(tradeErr(error)); await loadTrades(); return; }
  if (t) CH?.send({ type: 'broadcast', event: 'trade', payload: { to: t.other, name: ME.display, kind: ok ? 'accepted' : 'declined' } });
  if (ok) { await H.reloadCol?.(); H.toast(`Échange réussi ! ${CARDS[t?.give]?.name || 'La carte'} est dans ta collection.`); H.sound?.(); }
  await loadTrades();
}
export function closeTrade() { const el = $('#trade'); el.hidden = true; el.innerHTML = ''; }
let TW = null;
async function openTradeWith(id, name) {
  const el = $('#trade'); el.hidden = false; el.dataset.mode = 'new';
  el.innerHTML = `<div class="box setbox"><div class="cardhead"><h2>Échange avec ${esc(name)}</h2><button class="link" data-x="close">Fermer</button></div><p class="muted" style="padding:20px 0">Chargement des cartes…</p></div>`;
  el.querySelector('[data-x=close]').onclick = closeTrade;
  await H.reloadCol?.();
  const { data } = await sb.from('collections').select('cards').eq('user_id', id).maybeSingle();
  const mine = new Set(H.col()?.cards || []), theirs = new Set(data?.cards || []);
  const by = (a, b) => b.r - a.r || a.name.localeCompare(b.name);
  TW = { id, name, give: null, want: null,
    gives: [...mine].filter(c => !theirs.has(c)).map(c => CARDS[c]).filter(Boolean).sort(by),
    wants: [...theirs].filter(c => !mine.has(c)).map(c => CARDS[c]).filter(Boolean).sort(by) };
  if (!el.hidden) renderTradeNew();
}
function renderTradeNew() {
  const el = $('#trade'), g = TW.give && CARDS[TW.give], w = TW.want && CARDS[TW.want];
  const gap = g && w ? TRANK[w.tier] - TRANK[g.tier] : 0;
  const grid = (list, key) => list.length ? `<div class="pfcs tgrid">${list.map(c => `<button class="pfc" data-${key}="${c.id}" aria-pressed="${TW[key] === c.id}">${cardHTML(c, { small: true })}</button>`).join('')}</div>`
    : `<p class="muted">${key === 'give' ? 'Tu n\'as aucune carte que ton ami n\'a pas déjà.' : 'Ton ami n\'a aucune carte que tu n\'as pas déjà.'}</p>`;
  el.innerHTML = `<div class="box setbox"><div class="cardhead"><h2>Échange avec ${esc(TW.name)}</h2><button class="link" data-x="close">Fermer</button></div>
    <div class="tsum"><div>${g ? mini(g.id) : '<div class="tcard empty">Choisis<br>ta carte</div>'}<small>Tu donnes</small></div><span class="tarrow">⇄</span><div>${w ? mini(w.id) : '<div class="tcard empty">Choisis<br>sa carte</div>'}<small>Tu reçois</small></div></div>
    ${gap >= 2 ? `<p class="twarn">⚠️ Échange déséquilibré : tu demandes une carte ${TIER_NAME[w.tier]} contre une ${TIER_NAME[g.tier]}. Ton ami risque de refuser.</p>` : gap <= -2 ? `<p class="twarn">⚠️ Attention : tu donnes une carte ${TIER_NAME[g.tier]} contre une ${TIER_NAME[w.tier]}. Tu es sûr ?</p>` : ''}
    <button class="btn primary" data-x="send" ${g && w ? '' : 'disabled'}>Proposer l'échange</button>
    <section class="setsec"><h3>1. La carte que tu donnes (${TW.gives.length})</h3>${grid(TW.gives, 'give')}</section>
    <section class="setsec"><h3>2. La carte que tu veux (${TW.wants.length})</h3>${grid(TW.wants, 'want')}</section></div>`;
  el.querySelector('[data-x=close]').onclick = closeTrade;
  el.querySelectorAll('[data-give]').forEach(b => b.onclick = () => { TW.give = b.dataset.give; keepScroll(renderTradeNew); });
  el.querySelectorAll('[data-want]').forEach(b => b.onclick = () => { TW.want = b.dataset.want; keepScroll(renderTradeNew); });
  el.querySelector('[data-x=send]').onclick = async e => {
    e.target.disabled = true;
    const { error } = await sb.rpc('trade_offer', { p_to: TW.id, p_give: TW.give, p_want: TW.want });
    if (error) { H.toast(tradeErr(error)); e.target.disabled = false; return; }
    CH?.send({ type: 'broadcast', event: 'trade', payload: { to: TW.id, name: ME.display, kind: 'offer' } });
    H.toast(`Proposition envoyée à ${TW.name} !`); await loadTrades(); openTrades();
  };
}
function keepScroll(f) { const b = $('#trade .setbox'), y = b?.scrollTop || 0; f(); const n = $('#trade .setbox'); if (n) n.scrollTop = y; }
export { kitOf };
