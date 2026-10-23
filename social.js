/* Profils, amis, joueurs en ligne et défis entre amis */
import { sb } from './net.js';
import { TEAMS, KITS, CARDS, CARD_LIST, TRANK, TIER_NAME } from './data.js';
import { $, esc, shirtSVG, cardHTML } from './ui.js';
import { openReplay, encode } from './replay.js';
import { sendPush, enablePush } from './push.js';
import { sentence } from './chatdata.js'; // anciennes phrases construites (affichage seulement)

let H = null, ME = null, CH = null;
export const TITLES = ['Buteur né', 'Le Mur', 'Roi du dribble', 'Maître des packs', 'Chasseur de légendes', 'Capitaine', 'Pro de la retournée', 'Tacleur fou', 'Passeur de génie', 'Futur Ballon d\'Or', 'Supporter n°1', 'Débutant motivé'];
const ONLINE = new Map(); // uid -> {name, busy}
let FRIENDS = [], UNREAD = {}, CHAT = null, TRADES = [];
/** Messages rapides (pas de texte libre : pas d'insultes ni d'inconnus qui écrivent n'importe quoi) */
// index 28-31 réservés (31 = replay)
export const MSGS = ["Salut ! 👋", "On joue ? ⚽", "GG ! 👏", "Revanche ? 😤", "Bien joué !", "Trop fort 🔥", "J'arrive !", "Pas maintenant, plus tard", "T'as eu quoi dans tes packs ?", "J'ai eu une légende !! 🤩", "Merci !", "Bonne nuit 😴", "😂", "👍", "⚽🔥", "Viens dans ma salle !", "Quel but ! 😱", "Tu veux échanger des cartes ?", "Regarde mon replay 🎬", "Encore une ?", "J'ai trop la rage 😭", "Tu es trop fort 💪", "À tout à l'heure !", "Ok !", "❤️", "😎", "🏆", "🤝", null, null, null, null, "Prêt ?", "Je crée une salle", "C'est quoi le code ?", "Je suis dans la salle !", "On fait un 2 contre 2 ? 👥", "On joue tous ensemble contre l'ordi ?", "Un dernier match ?", "3 minutes ou 5 ?", "Je prends le PSG 😏", "Duel de packs ? 📦", "Ma connexion bug 😩", "J'ai trop lag 🐌", "Belle passe !", "Quelle retournée ! 🤯", "Arrête de tacler 😂", "Ton gardien dort 🧤😂", "Je t'ai eu !", "Match nul, revanche ?", "J'ai eu une Ultime !!! 🐐", "Il me manque quelques cartes", "T'as qui comme légende ?", "Regarde mon équipe 💪", "Échange équitable ?", "J'accepte ton échange ✅", "Non merci pour l'échange", "Pack gratuit dispo ! 🎁", "J'ai eu un pack bonus 🎁", "J'ai récupéré mon cadeau du jour", "Ça va ?", "Oui et toi ?", "Trop bien !", "Désolé 🙏", "Pas grave", "Attends 2 minutes", "Je dois y aller", "Demain ?", "Bravo ! 🎉", "Bien vu 👀", "Oui", "Non", "Peut-être 🤔", "Bon match ! 🤝", "🔥", "😭", "🤣", "😡", "🥶", "🐐", "👑", "💯", "🙏", "🎉", "🤯", "👀"];
export const MSG_CATS = [{"id": "salut", "n": "Salut", "m": [0, 10, 11, 22, 23, 24, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73]}, {"id": "match", "n": "Match", "m": [1, 2, 3, 4, 5, 6, 7, 15, 16, 19, 20, 21, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49]}, {"id": "cartes", "n": "Cartes", "m": [8, 9, 17, 18, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59]}, {"id": "emo", "n": "Émojis", "m": [12, 13, 14, 25, 26, 27, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85]}];
const QK = 'fdp-qtab', QR = 'fdp-qrecent';
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };

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
  CH.on('broadcast', { event: 'invite-no' }, ({ payload: p }) => {
    if (p?.to !== ME.id) return;
    H.toast(p.busy ? `${p.name} est déjà en match. Réessaie dans un moment.` : `${p.name} ne peut pas jouer maintenant.`);
    if (p.code) H.leaveIfAlone?.(p.code);
  });
  CH.on('broadcast', { event: 'invite-ok' }, ({ payload: p }) => { if (p?.to === ME.id) H.toast(`${p.name} a accepté : il arrive ! ⚽`); });
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
    + acc.map(f => row(f, `<button class="btn small fmsg" data-chat="${f.id}" aria-label="Messages avec ${esc(f.display)}">💬${UNREAD[f.id] ? `<i class="badge">${UNREAD[f.id]}</i>` : ''}</button><button class="btn small chal" data-chal="${f.id}">Défier</button>`)).join('')
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
  if (!isOnline(data.id)) sendPush({ kind: 'friend', to: data.id });
  await loadFriends(); return true;
}
async function respond(id, ok) {
  const { error } = await sb.rpc('friend_respond', { p_other: id, p_accept: ok });
  if (error) { H.toast(errMsg(error)); return; }
  if (ok) { CH?.send({ type: 'broadcast', event: 'friend', payload: { to: id, from: ME.id, name: ME.display, ok: true } }); if (!isOnline(id)) sendPush({ kind: 'friend', to: id }); }
  await loadFriends(); if (!$('#profile').hidden) openProfile(id);
}

/* ---------- Défis ---------- */
function challenge(f) {
  if (!f || !CH) return;
  if (H.playing?.()) { H.toast('Termine ton match avant de défier un ami.'); return; }
  const code = H.createRoom(), on = isOnline(f.id);
  CH.send({ type: 'broadcast', event: 'invite', payload: { to: f.id, from: ME.id, name: ME.display, code, at: Date.now() } });
  if (!on) sendPush({ kind: 'invite', to: f.id, code });
  H.toast(on ? `Défi envoyé à ${f.display}. Il arrive dans ta salle…` : `${f.display} n'est pas en ligne : il reçoit une notification. Attends-le dans la salle.`);
  setTimeout(() => { if (H.alone?.(code)) H.toast(`${f.display} n'a pas encore répondu. Tu peux l'attendre ou quitter la salle.`); }, 45000);
  closeProfile();
}
/** Invite un ami dans une salle déjà ouverte (salle à plusieurs) */
export function inviteToRoom(f, code) {
  if (!f || !CH) return;
  const on = isOnline(f.id);
  CH.send({ type: 'broadcast', event: 'invite', payload: { to: f.id, from: ME.id, name: ME.display, code, at: Date.now() } });
  if (!on) sendPush({ kind: 'invite', to: f.id, code });
  H.toast(on ? `Invitation envoyée à ${f.display}` : `${f.display} n'est pas en ligne : il reçoit une notification.`);
}
let invT = null;
function showInvite(p) {
  if (!p?.code || (p.at && Math.abs(Date.now() - p.at) > 90000)) return; // défi trop vieux
  if (H.playing ? H.playing() : H.busy()) { CH?.send({ type: 'broadcast', event: 'invite-no', payload: { to: p.from, name: ME.display, code: p.code, busy: true } }); return; }
  document.querySelector('.invite')?.remove(); clearTimeout(invT);
  const d = document.createElement('div'); d.className = 'invite'; d.setAttribute('role', 'alertdialog');
  d.innerHTML = `<span class="ib">${p.code.length === 5 ? '👥' : '⚽'}</span><div><b>${esc(p.name)} ${p.code.length === 5 ? 't\'invite à jouer !' : 'te défie !'}</b><small>${p.code.length === 5 ? 'Match à plusieurs' : 'Match en ligne'} · salle ${esc(p.code)}</small></div>
    <button class="btn small primary" data-i="go">Jouer</button><button class="btn small" data-i="no">Non</button>`;
  $('#app').appendChild(d); H.sound?.();
  const close = () => { clearTimeout(invT); d.remove(); };
  d.querySelector('[data-i=go]').onclick = () => { close(); closeProfile(); closeChat(); closeTrade(); CH?.send({ type: 'broadcast', event: 'invite-ok', payload: { to: p.from, name: ME.display } }); H.joinRoom(p.code); };
  d.querySelector('[data-i=no]').onclick = () => { close(); CH?.send({ type: 'broadcast', event: 'invite-no', payload: { to: p.from, name: ME.display, code: p.code } }); };
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
  else if (fr === 'accepted') act = `<button class="btn primary" data-x="chal">Défier</button><button class="btn" data-x="msg">💬 Message</button><button class="btn" data-x="trade">🔄 Échanger</button><button class="btn" data-x="unfriend">Retirer des amis</button>`;
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
    <section class="setsec"><h3>Replays</h3><ul class="rplist" id="profRp"><li class="muted">Chargement…</li></ul></section>
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
  renderProfReplays(p);
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
export function closeChat() { if (REC) stopRec(false); if (PLAY) { PLAY.a.pause(); PLAY = null; } CHAT = null; const el = $('#chat'); el.hidden = true; el.innerHTML = ''; }
function renderChat(loading) {
  const el = $('#chat'), f = friendOf(CHAT.id), on = isOnline(f.id);
  const canNotif = 'Notification' in window && Notification.permission === 'default';
  el.innerHTML = `<div class="box setbox chatbox"><div class="cardhead"><button class="fmain" data-x="prof"><span class="fav">${shirtSVG(kitOf(f))}<i class="dot ${on ? 'on' : ''}"></i></span><span class="fnm"><b>${esc(f.display)}</b><small>${on ? 'En ligne' : 'Hors ligne · il verra ton message plus tard'}</small></span></button>
      <button class="btn small chal" data-x="chal">Défier</button><button class="link" data-x="close">Fermer</button></div>
    <div class="msgs" id="msgs">${loading ? '<p class="muted">Chargement…</p>' : CHAT.list.length ? CHAT.list.map((m, i, a) => {
      const day = new Date(m.created_at).toDateString(), prev = i ? new Date(a[i - 1].created_at).toDateString() : '';
      const sep = day !== prev ? `<div class="msep">${new Date(m.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>` : '';
      const lastMine = m.mine && !a.slice(i + 1).some(x => x.mine);
      const body = m.msg === 29 ? `<span>${esc(m.body || '')}</span>` : m.msg === 28 ? voiceHTML(m) : m.msg === 30 ? `<span>${esc(sentence(m.parts))}</span>` : m.msg === 31 ? (m.replay ? `<button class="rpmsg" data-rp="${m.replay}">🎬 <b>Replay</b><small>${esc(m.replay_title || 'Match')}</small><em>▶ Voir</em></button>` : '<span class="muted">🎬 Replay supprimé</span>') : `<span>${esc(MSGS[m.msg] ?? '…')}</span>`;
      return `${sep}<div class="bub ${m.mine ? 'me' : ''} ${m.msg === 31 ? 'rp' : ''}">${body}<time>${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${lastMine && m.read ? ' · Vu ✓✓' : ''}</time></div>`;
    }).join('') : '<p class="muted">Pas encore de message. Dis-lui bonjour !</p>'}</div>
    ${CHAT.quick ? `<div class="qwrap">${quickHTML()}</div>` : ''}
    ${REC ? `<div class="ctext rec"><span class="recdot"></span><b class="rectime">0:00</b><span class="muted">Enregistrement… (30 s max)</span><button class="btn small" data-x="recno">Annuler</button><button class="btn small primary" data-x="recok">Envoyer 🎤</button></div>`
      : `<form class="ctext" data-x="form"><button type="button" class="cbtn${CHAT.quick ? ' on' : ''}" data-x="quick" aria-label="Messages rapides">⚡</button><input id="ctin" maxlength="200" placeholder="Écris un message…" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" aria-label="Message">
      <button type="button" class="cbtn" data-x="mic" aria-label="Message vocal">🎤</button><button class="cbtn send" type="submit" aria-label="Envoyer">➤</button></form>`}
    <p class="hint">Les gros mots, les liens et les numéros sont masqués automatiquement.${canNotif ? ' <button class="link" data-x="notif">Activer les notifications</button>' : ''}</p></div>`;
  const box = el.querySelector('#msgs'); box.scrollTop = box.scrollHeight;
  el.querySelector('[data-x=close]').onclick = closeChat;
  el.querySelector('[data-x=prof]').onclick = () => { const id = f.id; closeChat(); openProfile(id); };
  const c = el.querySelector('[data-x=chal]'); if (c) c.onclick = () => { closeChat(); challenge(f); };
  const n = el.querySelector('[data-x=notif]'); if (n) n.onclick = async () => { const r = await enablePush(); H.toast(r === 'on' ? '🔔 Notifications activées !' : r === 'ios-home' ? 'Sur iPhone : Partager ⬆️ → « Sur l\'écran d\'accueil », puis ouvre le jeu depuis l\'icône.' : 'Notifications non activées.'); renderChat(); };
  el.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => playReplay(b.dataset.rp));
  el.querySelectorAll('[data-voice]').forEach(b => b.onclick = () => playVoice(b));
  if (CHAT.quick) bindQuick(f);
  const form = el.querySelector('[data-x=form]');
  if (form) {
    const inp = form.querySelector('#ctin'); inp.value = CHAT.draft || '';
    inp.oninput = () => { CHAT.draft = inp.value; };
    if (CHAT.focus) { CHAT.focus = false; inp.focus(); }
    form.onsubmit = e => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; CHAT.draft = ''; CHAT.focus = true; sendText(f.id, t); };
    form.querySelector('[data-x=quick]').onclick = () => { CHAT.quick = !CHAT.quick; renderChat(); };
    form.querySelector('[data-x=mic]').onclick = () => startRec(f);
  }
  const rok = el.querySelector('[data-x=recok]'); if (rok) rok.onclick = () => stopRec(true);
  const rno = el.querySelector('[data-x=recno]'); if (rno) rno.onclick = () => stopRec(false);
}
/* Messages rapides rangés par onglets (Récents, Salut, Match, Cartes, Émojis) */
function quickHTML() {
  const rec = lsGet(QR, []).filter(i => MSGS[i]);
  const tabs = [...(rec.length ? [{ id: 'rec', n: '⭐ Récents', m: rec }] : []), ...MSG_CATS];
  let cur = lsGet(QK, rec.length ? 'rec' : 'salut'); if (!tabs.some(t => t.id === cur)) cur = tabs[0].id;
  const tab = tabs.find(t => t.id === cur);
  const head = `<div class="qtabs" role="tablist">${tabs.map(t => `<button role="tab" class="qtab" data-qt="${t.id}" aria-selected="${t.id === cur}">${esc(t.n)}</button>`).join('')}</div>`;
  return `${head}
    <div class="qmsgs">${tab.m.map(i => `<button class="chip" data-m="${i}">${esc(MSGS[i])}</button>`).join('')}<button class="chip rpchip" data-x="rpsend">🎬 Envoyer un replay</button></div>`;
}
/* ---------- Texte libre (filtré par le serveur) ---------- */
async function sendText(to, text) {
  const { data, error } = await sb.rpc('send_text', { p_to: to, p_body: text.slice(0, 200) });
  if (error) { H.toast(/too_fast/.test(error.message) ? 'Doucement ! Attends un peu avant de renvoyer un message.' : /not_friends/.test(error.message) ? 'Vous n\'êtes plus amis.' : 'Message non envoyé. Réessaie.'); if (CHAT) { CHAT.draft = text; renderChat(); } return; }
  CH?.send({ type: 'broadcast', event: 'msg', payload: { to, from: ME.id, name: ME.display, m: 29, id: data.id } });
  if (!isOnline(to)) sendPush({ kind: 'msg', id: data.id });
  if (CHAT && CHAT.id === to) { CHAT.list.push({ id: data.id, mine: true, msg: 29, body: data.body, created_at: data.at || new Date().toISOString() }); renderChat(); }
}
/* ---------- Messages vocaux (30 s max, écoutables seulement par toi et ton ami) ---------- */
let REC = null;
const fmtS = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function voiceHTML(m) { const s = m.parts?.[0] || 1; return `<button class="vmsg" data-voice="${esc(m.body || '')}" aria-label="Écouter le message vocal"><i>▶</i><span class="vwave"></span><b>${fmtS(s)}</b></button>`; }
async function startRec(f) {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { H.toast('Les messages vocaux ne marchent pas sur ce navigateur.'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { H.toast('Micro refusé. Autorise le micro dans les réglages du téléphone pour envoyer un vocal.'); return; }
  const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
  const mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
  const chunks = [];
  REC = { mr, stream, chunks, f, t0: Date.now(), send: false };
  mr.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
  mr.onstop = () => finishRec();
  mr.start(250);
  REC.timer = setInterval(() => { const s = Math.floor((Date.now() - REC.t0) / 1000), el = $('#chat .rectime'); if (el) el.textContent = fmtS(s); if (s >= 30) stopRec(true); }, 250);
  renderChat();
}
function stopRec(send) { if (!REC) return; REC.send = send; clearInterval(REC.timer); try { REC.mr.state !== 'inactive' ? REC.mr.stop() : finishRec(); } catch { finishRec(); } }
async function finishRec() {
  const r = REC; if (!r) return; REC = null;
  r.stream.getTracks().forEach(t => t.stop());
  if (CHAT) renderChat();
  const secs = Math.max(1, Math.min(30, Math.round((Date.now() - r.t0) / 1000)));
  if (!r.send) return;
  if (Date.now() - r.t0 < 700) { H.toast('Trop court ! Parle un peu plus longtemps.'); return; }
  const type = (r.mr.mimeType || 'audio/webm').split(';')[0], blob = new Blob(r.chunks, { type });
  if (blob.size > 1000000) { H.toast('Vocal trop lourd. Fais-le plus court.'); return; }
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
  const path = `${ME.id}/${Date.now()}.${ext}`;
  H.toast('Envoi du vocal…');
  const up = await sb.storage.from('voice').upload(path, blob, { contentType: type, upsert: false });
  if (up.error) { H.toast('Vocal non envoyé. Vérifie ta connexion.'); return; }
  const { data, error } = await sb.rpc('send_voice', { p_to: r.f.id, p_path: path, p_secs: secs });
  if (error) { H.toast(/too_fast/.test(error.message) ? 'Doucement ! Attends un peu.' : 'Vocal non envoyé. Réessaie.'); return; }
  CH?.send({ type: 'broadcast', event: 'msg', payload: { to: r.f.id, from: ME.id, name: ME.display, m: 28, id: data.id } });
  if (!isOnline(r.f.id)) sendPush({ kind: 'msg', id: data.id });
  if (CHAT && CHAT.id === r.f.id) { CHAT.list.push({ id: data.id, mine: true, msg: 28, body: path, parts: [secs], created_at: data.at || new Date().toISOString() }); renderChat(); }
}
let PLAY = null;
async function playVoice(btn) {
  const path = btn.dataset.voice;
  if (PLAY) { PLAY.a.pause(); const same = PLAY.path === path; PLAY.btn.classList.remove('playing'); PLAY.btn.querySelector('i').textContent = '▶'; PLAY = null; if (same) return; }
  const { data, error } = await sb.storage.from('voice').createSignedUrl(path, 600);
  if (error || !data?.signedUrl) { H.toast('Ce vocal n\'est plus disponible.'); return; }
  const a = new Audio(data.signedUrl);
  PLAY = { a, path, btn }; btn.classList.add('playing'); btn.querySelector('i').textContent = '❚❚';
  a.onended = a.onerror = () => { btn.classList.remove('playing'); btn.querySelector('i').textContent = '▶'; if (PLAY?.a === a) PLAY = null; };
  a.play().catch(() => { H.toast('Impossible de lire ce vocal sur ce téléphone.'); a.onended(); });
}
function bindQuick(f) {
  const w = $('#chat .qwrap'); if (!w) return;
  w.querySelectorAll('[data-qt]').forEach(b => b.onclick = () => { lsSet(QK, b.dataset.qt); w.innerHTML = quickHTML(); bindQuick(f); });
  w.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const m = +b.dataset.m; lsSet(QR, [m, ...lsGet(QR, []).filter(x => x !== m)].slice(0, 10));
    sendMsg(f.id, m);
  });
  const rs = w.querySelector('[data-x=rpsend]'); if (rs) rs.onclick = () => pickReplay(f);
}
async function pickReplay(f) {
  const list = await listReplays(ME.id);
  const el = $('#chat .qmsgs');
  if (!list.length) { H.toast('Tu n\'as pas encore de replay. Sauvegarde-en un à la fin d\'un match.'); return; }
  el.innerHTML = `<p class="hint" style="width:100%">Quel replay envoyer à ${esc(f.display)} ?</p>${list.map(r => `<button class="chip" data-sr="${r.id}">🎬 ${esc(r.title)}</button>`).join('')}<button class="chip" data-x="rpback">Annuler</button>`;
  el.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => sendReplay(f.id, b.dataset.sr, b.textContent.replace('🎬 ', '')));
  el.querySelector('[data-x=rpback]').onclick = () => renderChat();
}
export async function sendReplay(to, id, title) {
  const { data, error } = await sb.rpc('send_replay', { p_to: to, p_replay: id });
  if (error) { H.toast(/too_fast/.test(error.message) ? 'Doucement ! Attends un peu.' : 'Replay non envoyé. Réessaie.'); return false; }
  CH?.send({ type: 'broadcast', event: 'msg', payload: { to, from: ME.id, name: ME.display, m: 31, id: data.id, replay: id, title } });
  if (!isOnline(to)) sendPush({ kind: 'msg', id: data.id });
  if (CHAT && CHAT.id === to) { CHAT.list.push({ id: data.id, mine: true, msg: 31, replay: id, replay_title: title, created_at: data.at || new Date().toISOString() }); renderChat(); }
  else H.toast('Replay envoyé !');
  return true;
}
async function sendMsg(to, m) {
  const { data, error } = await sb.rpc('send_msg', { p_to: to, p_msg: m });
  if (error) { H.toast(/too_fast/.test(error.message) ? 'Doucement ! Attends un peu avant de renvoyer un message.' : /not_friends/.test(error.message) ? 'Vous n\'êtes plus amis.' : 'Message non envoyé. Réessaie.'); return; }
  CH?.send({ type: 'broadcast', event: 'msg', payload: { to, from: ME.id, name: ME.display, m, id: data.id } });
  if (!isOnline(to)) sendPush({ kind: 'msg', id: data.id });
  if (CHAT && CHAT.id === to) { CHAT.list.push({ id: data.id, mine: true, msg: m, created_at: data.at || new Date().toISOString() }); renderChat(); }
}
function gotMsg(p) {
  if (!friendOf(p.from)) { loadFriends(); }
  if (CHAT && CHAT.id === p.from) {
    if (p.m === 29 || p.m === 28 || p.m === 30) { // texte libre / vocal : on relit depuis le serveur (texte filtré)
      sb.rpc('my_msgs', { p_with: p.from }).then(({ data }) => { if (CHAT && CHAT.id === p.from && Array.isArray(data) && !REC) { CHAT.list = data; renderChat(); } });
    } else {
      CHAT.list.push({ id: p.id, mine: false, msg: p.m, replay: p.replay, replay_title: p.title, created_at: new Date().toISOString() }); renderChat();
      sb.rpc('my_msgs', { p_with: p.from }); // marque comme lu
    }
    H.sound?.(true); return;
  }
  UNREAD[p.from] = (UNREAD[p.from] || 0) + 1; renderFriends();
  notify(`💬 ${p.name}`, p.m === 31 ? `🎬 t'a envoyé un replay : ${p.title || ''}` : p.m === 29 ? '✉️ Nouveau message' : p.m === 28 ? '🎤 Message vocal' : p.m === 30 ? sentence(p.parts) : MSGS[p.m] ?? '', () => openChat(p.from));
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
  if (t) { CH?.send({ type: 'broadcast', event: 'trade', payload: { to: t.other, name: ME.display, kind: ok ? 'accepted' : 'declined' } }); if (!isOnline(t.other)) sendPush({ kind: 'trade', id }); }
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
    const { data, error } = await sb.rpc('trade_offer', { p_to: TW.id, p_give: TW.give, p_want: TW.want });
    if (error) { H.toast(tradeErr(error)); e.target.disabled = false; return; }
    CH?.send({ type: 'broadcast', event: 'trade', payload: { to: TW.id, name: ME.display, kind: 'offer' } });
    if (!isOnline(TW.id)) sendPush({ kind: 'trade', id: data.id });
    H.toast(`Proposition envoyée à ${TW.name} !`); await loadTrades(); openTrades();
  };
}
function keepScroll(f) { const b = $('#trade .setbox'), y = b?.scrollTop || 0; f(); const n = $('#trade .setbox'); if (n) n.scrollTop = y; }

/* ---------- Replays ---------- */
export async function listReplays(owner) {
  const { data } = await sb.from('replays').select('id,title,created_at,size').eq('owner', owner).order('created_at', { ascending: false }).limit(10);
  return Array.isArray(data) ? data : [];
}
async function renderProfReplays(p) {
  const list = await listReplays(p.id), el = $('#profRp'); if (!el || PROF?.id !== p.id) return;
  const mine = p.id === ME.id, friends = FRIENDS.filter(f => f.status === 'accepted');
  el.innerHTML = list.map(r => `<li class="rprow"><button class="rpplay" data-rp="${r.id}">▶</button><span class="rpt"><b>${esc(r.title)}</b><small>${new Date(r.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span>
    ${mine ? `${friends.length ? `<button class="btn small" data-share="${r.id}" data-t="${esc(r.title)}">📤</button>` : ''}<button class="btn small" data-del="${r.id}" aria-label="Supprimer">🗑</button>` : ''}</li>`).join('')
    || `<li class="muted">${mine ? 'Aucun replay. À la fin d\'un match, touche « 💾 Sauvegarder le replay ».' : 'Aucun replay partagé.'}</li>`;
  el.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => playReplay(b.dataset.rp));
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { b.disabled = true; await sb.rpc('remove_replay', { p_id: b.dataset.del }); renderProfReplays(p); });
  el.querySelectorAll('[data-share]').forEach(b => b.onclick = () => shareReplayPicker(b.dataset.share, b.dataset.t, b.closest('li')));
}
/** Petite liste d'amis sous un replay pour l'envoyer */
export function shareReplayPicker(id, title, anchor) {
  const friends = FRIENDS.filter(f => f.status === 'accepted');
  document.querySelector('.rpshare')?.remove();
  if (!friends.length) { H.toast('Ajoute d\'abord des amis pour partager tes replays.'); return; }
  const d = document.createElement('div'); d.className = 'rpshare';
  d.innerHTML = `<small>Envoyer à :</small>${friends.map(f => `<button class="chip" data-to="${f.id}">${esc(f.display)}</button>`).join('')}`;
  anchor.after(d);
  d.querySelectorAll('[data-to]').forEach(b => b.onclick = async () => { b.disabled = true; if (await sendReplay(b.dataset.to, id, title)) d.remove(); else b.disabled = false; });
}
export async function playReplay(id) {
  H.toast('Chargement du replay…');
  const { data, error } = await sb.from('replays').select('title,meta,data').eq('id', id).maybeSingle();
  if (error || !data || !data.data) { H.toast('Ce replay n\'existe plus.'); return; }
  openReplay({ data: data.data, meta: data.meta, title: data.title });
}
export async function saveReplay(rec, meta, title) {
  const data = await encode(rec.data());
  const { data: r, error } = await sb.rpc('save_replay', { p_title: title, p_meta: meta, p_data: data });
  if (error) { H.toast(/too_big/.test(error.message) ? 'Replay trop long pour être sauvegardé.' : /too_fast/.test(error.message) ? 'Attends un peu avant de sauvegarder un autre replay.' : 'Sauvegarde impossible. Réessaie.'); return null; }
  return { id: r.id, data };
}
export const friendsList = () => FRIENDS.filter(f => f.status === 'accepted');
export { kitOf };
