import { TEAMS, KIT, POS, CARDS, CARD_LIST, KITS, PACKS, TIER_NAME, TRANK, customTeam } from './data.js';
import { predictOwn } from './predict.js';
import { openTuto, tutoSeen } from './tuto.js';
import { PAD, initPad, pollPad, rumble, padLabels } from './gamepad.js';
import { SET, onSetting, resetSettings } from './settings.js';
import { audio, tone, cheer, S as SND, crowdStart, crowdStop, crowdLevel, soundOn, setSound } from './sound.js';
import { $, esc, shirtSVG, cardHTML, lockedHTML, showPack, initPackOverlay, setPackSounds } from './ui.js';
import { createMatch, step, snapshot, summary, blankInput, pickKits, FL, FW } from './engine.js';
import { createRenderer, pickText, SIDE_COL } from './render.js';
import { initSocial, stopSocial, renderFriends, addFriend, openProfile, closeProfile, openChat, closeChat, openTrades, closeTrade, kitOf, saveReplay, shareReplayPicker, friendsList, inviteToRoom, isOnline } from './social.js';
import { createRecorder, openReplay, closeReplay, encode } from './replay.js';
import { registerSW, pushState, enablePush, disablePush, isIOS } from './push.js';
import { initBank, stopBank, renderCoinShop, refreshCoinShop, openAdmin, closeAdmin } from './bank.js';
import { sb, SUPABASE_URL, SUPABASE_KEY, Room, newCode, cleanCode, quickMatch } from './net.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };
const teamIdx = short => Math.max(0, TEAMS.findIndex(t => t.short === short));

/* ---------- Écrans ---------- */
const SCREENS = ['auth', 'home', 'club', 'shop', 'lobby', 'tlobby', 'pduel', 'game', 'end'];
function show(id) { SCREENS.forEach(s => { $('#' + s).hidden = s !== id; }); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- Son ---------- */
const buzz = ms => { if (!SET.vib) return; try { navigator.vibrate?.(ms); } catch { } if (PAD.on) { const t = Array.isArray(ms) ? ms.reduce((a, b) => a + b, 0) : ms; rumble(Math.max(40, t), t > 100 ? 1 : .55, .5); } };
setPackSounds({ tone, cheer, buzz });
initPackOverlay();
function playEvent(type, val) {
  if (type === 'kick') { if (GAME?.localKickAt && performance.now() - GAME.localKickAt < 350) return; SND.kick(val || 1); }
  else if (type === 'goal') { SND.goal(); buzz([60, 40, 120]); }
  else if (type === 'whistle') SND.whistle(val || 1);
  else if (type === 'post') SND.post();
  else if (type === 'save') SND.save();
  else if (type === 'steal') SND.steal();
  else if (type === 'header') SND.header();
  else if (type === 'volley') { SND.volley(); buzz([25, 20, 40]); }
  else if (type === 'bicycle') { SND.bicycle(); buzz([30, 30, 60]); }
  else if (type === 'cross') SND.cross();
}
// petit clic sur les boutons des menus
document.addEventListener('click', e => { if (e.target.closest('button') && !e.target.closest('#game')) { audio(); SND.click(); } }, true);
/** Invité : le son de frappe part tout de suite au doigt, sans attendre le retour de l'hôte */
function localKick(p) { if (GAME?.online && !GAME.host && myBall()) { SND.kick(p); GAME.localKickAt = performance.now(); } }

/* ---------- Compte ---------- */
let ME = null; // profil
const emailOf = u => `${u.toLowerCase()}@joueurs.footdepoche.app`;
let authMode = 'login';
document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  authMode = b.dataset.mode;
  document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', x === b));
  $('#authGo').textContent = authMode === 'login' ? 'Se connecter' : 'Créer mon compte';
  $('#uPass').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
  $('#authHint').textContent = authMode === 'login' ? 'Ton compte reste connecté sur ce téléphone.' : 'Retiens bien ton mot de passe : il n\'y a pas d\'e-mail pour le récupérer.';
  $('#authErr').textContent = '';
}));
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault(); audio();
  const u = $('#uName').value.trim(), p = $('#uPass').value;
  const err = $('#authErr'); err.textContent = '';
  if (!/^[A-Za-z0-9_]{3,16}$/.test(u)) { err.textContent = 'Le pseudo doit faire 3 à 16 caractères : lettres, chiffres ou _.'; return; }
  if (p.length < 6) { err.textContent = 'Le mot de passe doit faire au moins 6 caractères.'; return; }
  const btn = $('#authGo'); btn.disabled = true; const label = btn.textContent; btn.textContent = '…';
  try {
    if (authMode === 'signup') {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/signup`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify({ username: u, password: p }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) throw new Error('Ce pseudo est déjà pris. Choisis-en un autre.');
      if (!r.ok) throw new Error('Inscription impossible pour le moment. Réessaie dans un instant.');
    }
    const { error } = await sb.auth.signInWithPassword({ email: emailOf(u), password: p });
    if (error) throw new Error(authMode === 'login' ? 'Pseudo ou mot de passe incorrect.' : 'Compte créé, mais la connexion a échoué. Essaie de te connecter.');
    $('#uPass').value = '';
    await afterLogin();
  } catch (ex) { err.textContent = ex.message || 'Erreur de connexion.'; }
  finally { btn.disabled = false; btn.textContent = label; }
});

async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  return data;
}
async function afterLogin() {
  ME = await loadProfile();
  if (!ME) { show('auth'); return; }
  if (ME.banned) { await sb.auth.signOut(); ME = null; show('auth'); $('#authErr').textContent = 'Ton compte est suspendu. Parle à Hector.'; return; }
  await loadCollection();
  renderHome(); show('home');
  registerSW().then(async () => {
    // une seule fois : on propose d'activer les notifications
    let asked = false; try { asked = localStorage.getItem('fdp-push-asked') === '1'; } catch { }
    const st = await pushState();
    if (!asked && (st === 'off' || st === 'ios-home')) { try { localStorage.setItem('fdp-push-asked', '1'); } catch { } setTimeout(() => toast(st === 'ios-home' ? '🔔 Pour recevoir les notifs de tes amis : Partager ⬆️ → « Sur l\'écran d\'accueil ». Détails dans ⚙️ Paramètres.' : '🔔 Active les notifications dans ⚙️ Paramètres pour savoir quand tes amis t\'écrivent.'), 4500); }
  });
  initSocial({ me: () => ME, col: () => COL, toast, busy: () => !!GAME || !!ROOM, sound: soft => { audio(); SND.coin(); buzz(soft ? 30 : [40, 30, 40]); }, inMatch: () => !!GAME && !GAME.done,
    createRoom: () => { const c = newCode(); enterRoom(c, 'host'); return c; }, joinRoom: c => joinAny(cleanCode(c)), onMeChange: () => renderMe(),
    reloadCol: async () => { await loadCollection(); renderMe(); }, alone: code => !!ROOM && LOB?.code === code && (LOB.multi ? !ROOM.peers.length : !LOB.peer), leaveIfAlone: code => { if (ROOM && LOB?.code === code && !(LOB.multi ? ROOM.peers.length : LOB.peer) && !GAME) leaveRoom(); },
    playing: () => (!!GAME && !GAME.done) || (!!DUEL && !DUEL.done) || (!!ROOM && !!LOB?.peer) });
  initBank({ me: () => ME, toast, sound: soft => { audio(); SND.coin(); buzz(soft ? 30 : [40, 30, 40]); },
    reloadCol: async () => { await loadCollection(); renderMe(); if (!$('#shop').hidden) renderShop(); }, openShop: () => { if (!GAME) { SHOP_TAB = 'packs'; openShop(); } } });
  if (COL?.welcome?.length) showPack('welcome', COL.welcome, a => { if (!tutoSeen()) openTuto(() => { if (a === 'team') openClub(); }); else if (a === 'team') openClub(); }, 'Pack de bienvenue');
  else if (!tutoSeen()) openTuto();
  const q = new URLSearchParams(location.search).get('salle');
  if (q) { history.replaceState(null, '', location.pathname); joinAny(cleanCode(q)); }
}
$('#bLogout').addEventListener('click', async () => { stopSocial(); stopBank(); closeAdmin(); await sb.auth.signOut(); ME = null; show('auth'); });

/* ---------- Accueil ---------- */
function renderMe() {
  renderCoins();
  if (COL) {
    const t = customTeam(COL.team), n = COL.cards.length;
    $('#clubTxt').textContent = `${t.name} · note ${t.ovr}`;
    $('#shopTxt').textContent = `${n} / ${CARD_LIST.length} cartes · ${freeReady() ? 'pack gratuit dispo !' : 'pack gratuit dans ' + freeLeft()}`;
  }
  const k = ME.avatar ? kitOf(ME) : ME.fav_team === 'PERSO' && COL ? customTeam(COL.team).h : TEAMS[teamIdx(ME.fav_team)].h;
  $('#meCard').innerHTML = `<div class="av">${shirtSVG(k)}</div><div><b>${esc(ME.display)}</b><small>${ME.title ? esc(ME.title) : `${ME.wins} V · ${ME.draws} N · ${ME.losses} D`}</small></div><div class="elo" title="Classement Elo">${ME.rating}</div>`;
}
async function renderHome() {
  renderMe();
  $('#homeErr').textContent = '';
  const [{ data: top }, { data: mine }] = await Promise.all([
    sb.from('profiles').select('id,display,rating,wins,draws,losses,avatar,fav_team,title').order('rating', { ascending: false }).limit(20),
    sb.from('matches').select('home,away,home_team,away_team,home_score,away_score,created_at,hp:profiles!matches_home_fkey(display),ap:profiles!matches_away_fkey(display)')
      .or(`home.eq.${ME.id},away.eq.${ME.id}`).order('created_at', { ascending: false }).limit(8),
  ]);
  $('#board').innerHTML = (top || []).map(p => `<li class="${p.id === ME.id ? 'mine' : ''}" data-prof="${p.id}" tabindex="0" role="button" aria-label="Voir le profil de ${esc(p.display)}"><span class="bav">${shirtSVG(kitOf(p))}</span><span class="nm">${esc(p.display)}${p.title ? `<small>${esc(p.title)}</small>` : ''}</span><span class="rec">${p.wins}V ${p.draws}N ${p.losses}D</span><span class="pts">${p.rating}</span></li>`).join('') || '<li class="muted">Personne pour l\'instant. Joue le premier match !</li>';
  $('#board').querySelectorAll('[data-prof]').forEach(li => { li.onclick = () => openProfile(li.dataset.prof); li.onkeydown = e => { if (e.key === 'Enter') openProfile(li.dataset.prof); }; });
  renderFriends();
  $('#recent').innerHTML = (mine || []).map(m => {
    const home = m.home === ME.id, my = home ? m.home_score : m.away_score, op = home ? m.away_score : m.home_score;
    const r = my > op ? 'w' : my < op ? 'l' : 'd', opName = (home ? m.ap : m.hp)?.display || 'Joueur supprimé';
    return `<li><span class="res ${r}">${r === 'w' ? 'V' : r === 'l' ? 'D' : 'N'}</span><span>${esc(home ? m.home_team : m.away_team)} contre <b>${esc(opName)}</b> (${esc(home ? m.away_team : m.home_team)})</span><span class="sc">${my} – ${op}</span></li>`;
  }).join('') || '<li class="muted">Aucun match en ligne pour l\'instant.</li>';
}
$('#bRefresh').addEventListener('click', async () => { ME = await loadProfile() || ME; renderHome(); });

let QM = null;
$('#bQuick').addEventListener('click', async () => {
  audio();
  const tile = $('#bQuick');
  if (QM) { QM.cancel(); QM = null; tile.classList.remove('searching'); $('#quickTxt').textContent = 'Trouve un adversaire au hasard'; return; }
  tile.classList.add('searching'); $('#quickTxt').textContent = 'Recherche d\'un adversaire… (touche pour annuler)';
  QM = quickMatch({ uid: ME.id, name: ME.display });
  try {
    const r = await QM; QM = null; tile.classList.remove('searching'); $('#quickTxt').textContent = 'Trouve un adversaire au hasard';
    enterRoom(r.code, r.role);
  } catch { QM = null; tile.classList.remove('searching'); $('#homeErr').textContent = 'Impossible de rejoindre la recherche. Vérifie ta connexion.'; }
});
$('#bCreate').addEventListener('click', () => { audio(); enterRoom(newCode(), 'host'); });
$('#joinForm').addEventListener('submit', e => {
  e.preventDefault(); audio();
  const c = cleanCode($('#joinCode').value);
  if (c.length < 4) { $('#homeErr').textContent = 'Le code d\'une salle fait 4 ou 5 caractères.'; return; }
  $('#joinCode').value = ''; joinAny(c);
});
/** Code à 4 caractères = salle 1 contre 1, à 5 = salle à plusieurs */
function joinAny(c) { if (c.length === 5) enterTeamRoom(c, 'guest'); else if (c.length === 4) enterRoom(c, 'guest'); }
$('#bTeam').addEventListener('click', () => { audio(); enterTeamRoom(newCode() + newCode()[0], 'host'); });
$('#bSolo').addEventListener('click', () => { audio(); if (!tutoSeen()) openTuto(startSolo); else startSolo(); });
$('#bTuto').addEventListener('click', () => openTuto());
$('#meCard').addEventListener('click', () => ME && openProfile(ME.id));
$('#friendAdd').addEventListener('submit', async e => { e.preventDefault(); const i = $('#friendName'), v = i.value.trim(); if (v.length < 3) { toast('Écris le pseudo de ton ami (3 lettres minimum).'); return; } if (await addFriend(v)) i.value = ''; });
$('#profile').addEventListener('click', e => { if (e.target.id === 'profile') closeProfile(); });
$('#chat').addEventListener('click', e => { if (e.target.id === 'chat') closeChat(); });
$('#trade').addEventListener('click', e => { if (e.target.id === 'trade') closeTrade(); });
$('#bTrades').addEventListener('click', openTrades);

/* ---------- Paramètres ---------- */
onSetting(k => { if (['saver', 'cam', 'btn', 'lefty'].includes(k) && GAME) R.resize(); });
const SETUI = [
  ['Son', [
    ['vol', 'Volume des effets', 'range'],
    ['crowd', 'Bruit de la foule', 'range'],
  ]],
  ['Jeu', [
    ['diff', 'Niveau de l\'ordi', [[0, 'Facile'], [1, 'Normal'], [2, 'Costaud']]],
    ['soloDur', 'Durée contre l\'ordi', [[120, '2 min'], [180, '3 min'], [300, '5 min']]],
    ['replay', 'Ralenti après les buts', [[true, 'Oui'], [false, 'Non']]],
  ]],
  ['Commandes', [
    ['lefty', 'Main', [[false, 'Droitier'], [true, 'Gaucher']], 'Gaucher : joystick à droite, boutons à gauche'],
    ['btn', 'Taille des boutons', [[.85, 'Petits'], [1, 'Normaux'], [1.2, 'Grands']]],
    ['vib', 'Vibrations', [[true, 'Oui'], [false, 'Non']]],
  ]],
  ['Affichage', [
    ['cam', 'Caméra', [['near', 'Proche'], ['wide', 'Tout le terrain']]],
    ['labels', 'Noms des joueurs', [[true, 'Oui'], [false, 'Non']]],
    ['aim', 'Cible des ballons en l\'air', [[true, 'Oui'], [false, 'Non']]],
    ['shake', 'Écran qui tremble sur les buts', [[true, 'Oui'], [false, 'Non']]],
    ['saver', 'Économie de batterie', [[false, 'Non'], [true, 'Oui']], '30 images/s et moins de pixels : la batterie dure plus longtemps'],
    ['fps', 'Afficher les images/s', [[false, 'Non'], [true, 'Oui']]],
  ]],
];
function renderSettings() {
  const el = $('#settings');
  el.innerHTML = `<div class="box setbox"><div class="cardhead"><h2>Paramètres</h2><button class="link" data-x="close">Fermer</button></div>
    ${SETUI.map(([sec, rows]) => `<section class="setsec"><h3>${sec}</h3>${rows.map(([k, lab, opt, hint]) => `<div class="setrow"><div class="setlab">${lab}${hint ? `<small>${hint}</small>` : ''}</div>${opt === 'range'
      ? `<div class="setrange"><input type="range" min="0" max="100" step="5" value="${SET[k]}" data-k="${k}" aria-label="${lab}"><b>${SET[k] === 0 ? 'Coupé' : SET[k] + ' %'}</b></div>`
      : `<div class="chips">${opt.map(([v, t]) => `<button class="chip" data-k="${k}" data-v='${JSON.stringify(v)}' aria-pressed="${SET[k] === v}">${t}</button>`).join('')}</div>`}</div>`).join('')}</section>`).join('')}
    <section class="setsec"><h3>Notifications</h3><div id="pushRow" class="pushrow"><span class="muted">…</span></div></section>
    <section class="setsec"><h3>Autres</h3><div class="setbtns"><button class="btn" data-x="tuto">Revoir le tuto</button><button class="btn" data-x="reset">Remettre par défaut</button></div>
    <p class="hint">Les paramètres sont gardés sur cet appareil.</p></section></div>`;
  el.querySelectorAll('.chip[data-k]').forEach(b => b.onclick = () => { SET[b.dataset.k] = JSON.parse(b.dataset.v); renderSettings(); el.querySelector(`[data-k="${b.dataset.k}"][aria-pressed="true"]`)?.focus({ preventScroll: true }); });
  el.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { SET[r.dataset.k] = +r.value; r.nextElementSibling.textContent = +r.value === 0 ? 'Coupé' : r.value + ' %'; if (r.dataset.k === 'vol') { audio(); SND.click(); } });
  el.querySelector('[data-x=close]').onclick = closeSettings;
  el.querySelector('[data-x=reset]').onclick = () => { resetSettings(); renderSettings(); toast('Paramètres remis par défaut.'); };
  el.querySelector('[data-x=tuto]').onclick = () => { closeSettings(); openTuto(); };
  renderPushRow();
}
async function renderPushRow() {
  const el = $('#pushRow'); if (!el) return;
  const st = await pushState();
  const T = {
    on: ['✅ Activées', 'Tu reçois une notification quand un ami t\'écrit, te défie, t\'ajoute ou te propose un échange, même jeu fermé.', 'Désactiver'],
    off: ['Désactivées', 'Reçois une vraie notification sur ton téléphone quand un ami t\'écrit ou te défie.', 'Activer les notifications'],
    denied: ['Bloquées', 'Tu as refusé les notifications. Pour les remettre : Réglages du téléphone > Notifications > Foot de Poche.', ''],
    'ios-home': ['Il faut installer le jeu', 'Sur iPhone, les notifications ne marchent que si le jeu est sur l\'écran d\'accueil : touche <b>Partager</b> ⬆️ dans Safari, puis <b>« Sur l\'écran d\'accueil »</b>, et ouvre le jeu depuis la nouvelle icône. Reviens ensuite ici.', ''],
    unsupported: ['Pas disponible', 'Ce navigateur ne gère pas les notifications. Sur iPhone, mets à jour iOS (16.4 minimum) et installe le jeu sur l\'écran d\'accueil.', ''],
  }[st] || ['', '', ''];
  el.innerHTML = `<div class="setlab">${T[0]}<small>${T[1]}</small></div>${T[2] ? `<button class="btn ${st === 'on' ? '' : 'primary'} small" id="pushBtn">${T[2]}</button>` : ''}`;
  const b = $('#pushBtn');
  if (b) b.onclick = async () => {
    b.disabled = true;
    const r = st === 'on' ? await disablePush() : await enablePush();
    if (r === 'on') { toast('🔔 Notifications activées !'); buzz([30, 30, 30]); }
    else if (r === 'error') toast('Impossible d\'activer les notifications. Réessaie.');
    renderPushRow();
  };
}
function openSettings() { renderSettings(); $('#settings').hidden = false; $('#settings').querySelector('.chip,input')?.focus({ preventScroll: true }); }
function closeSettings() { $('#settings').hidden = true; soundLabel(); }
$('#settings').addEventListener('click', e => { if (e.target.id === 'settings') closeSettings(); });
$('#bSettings').addEventListener('click', openSettings);
$('#bSettings2')?.addEventListener('click', openSettings);

/* ---------- Collection, packs et équipe perso ---------- */
let COL = null, clockOffset = 0;
async function loadCollection() {
  const { data, error } = await sb.rpc('my_collection');
  if (error || !data) return null;
  COL = data; clockOffset = Date.parse(data.now) - Date.now();
  return COL;
}
function renderCoins() { const v = COL ? COL.coins.toLocaleString('fr-FR') : '…'; ['#coinsHome', '#coinsClub', '#coinsShop'].forEach(id => { const el = $(id); if (el) el.textContent = v; }); }
const FREE_MS = 4 * 3600 * 1000;
const freeWait = () => COL?.last_free ? Math.max(0, Date.parse(COL.last_free) + FREE_MS - (Date.now() + clockOffset)) : 0;
const freeReady = () => freeWait() <= 0;
function freeLeft() { const s = Math.ceil(freeWait() / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`; }
document.querySelectorAll('[data-home]').forEach(b => b.addEventListener('click', () => { renderHome(); show('home'); }));
$('#bClub').addEventListener('click', () => { audio(); openClub(); });
$('#bShop').addEventListener('click', () => { audio(); openShop(); });

/* Mon équipe */
let DRAFT = null;
function openClub() {
  if (!COL) return;
  DRAFT = { name: COL.team.name, kit: COL.team.kit, slots: COL.team.slots.slice() };
  $('#tName').value = DRAFT.name; $('#clubErr').textContent = '';
  renderClub(); show('club');
}
function renderClub() {
  renderCoins();
  $('#kitList').innerHTML = KITS.map(k => `<button data-kit="${k.id}" aria-pressed="${DRAFT.kit === k.id}" aria-label="Maillot ${k.id}">${shirtSVG(k.k)}</button>`).join('');
  $('#kitList').querySelectorAll('[data-kit]').forEach(b => b.onclick = () => { DRAFT.kit = b.dataset.kit; const y = $('#kitList').scrollLeft; renderClub(); $('#kitList').scrollLeft = y; });
  const t = customTeam(DRAFT);
  $('#tSum').innerHTML = `<span>Note <b>${t.ovr}</b></span><span>ATT <b>${t.att}</b></span><span>DEF <b>${t.def}</b></span><span>PAS <b>${t.pas}</b></span><span>VIT <b>${t.vit}</b></span>`;
  const slot = i => { const c = CARDS[DRAFT.slots[i]]; const lab = i === 0 ? 'GB' : i < 3 ? 'DEF' : 'ATT';
    return `<button class="slot2 cbtn" data-slot="${i}" aria-label="Poste ${lab}">${c ? cardHTML(c) : `<div class="empty">${lab}<small>Choisir</small></div>`}</button>`; };
  $('#pitch').innerHTML = `<div class="line">${slot(0)}</div><div class="line">${slot(1)}${slot(2)}</div><div class="line">${slot(3)}${slot(4)}</div>`;
  $('#pitch').querySelectorAll('[data-slot]').forEach(b => b.onclick = () => openPicker(+b.dataset.slot));
}
$('#tName').addEventListener('input', () => { if (DRAFT) DRAFT.name = $('#tName').value; });
function openPicker(i) {
  const gk = i === 0, used = new Set(DRAFT.slots.filter((x, j) => x && j !== i));
  const list = COL.cards.map(id => CARDS[id]).filter(c => c && (gk ? c.pos === 'GB' : c.pos !== 'GB'))
    .sort((a, b) => (i >= 3 ? (b.pos === 'ATT') - (a.pos === 'ATT') : i >= 1 ? (b.pos === 'DEF') - (a.pos === 'DEF') : 0) || b.r - a.r);
  const el = $('#picker');
  el.innerHTML = `<div class="box"><div class="cardhead"><h3>${gk ? 'Gardien' : i < 3 ? 'Défenseur' : 'Attaquant'}</h3><button class="link" id="pkClose">Fermer</button></div>
    ${list.length ? `<div class="cgrid">${list.map(c => `<button class="cbtn" data-cid="${c.id}" ${used.has(c.id) ? 'disabled' : ''}>${cardHTML(c)}</button>`).join('')}</div>`
      : `<p class="hint">Tu n'as pas encore de ${gk ? 'gardien' : 'joueur de champ'} disponible. Ouvre des packs pour en trouver.</p>`}
    ${DRAFT.slots[i] ? '<button class="btn" id="pkClear">Laisser le poste au remplaçant</button>' : ''}</div>`;
  el.hidden = false;
  el.onclick = e => { if (e.target === el) el.hidden = true; };
  $('#pkClose').onclick = () => el.hidden = true;
  const clr = $('#pkClear'); if (clr) clr.onclick = () => { DRAFT.slots[i] = null; el.hidden = true; renderClub(); };
  el.querySelectorAll('[data-cid]').forEach(b => b.onclick = () => { DRAFT.slots[i] = b.dataset.cid; el.hidden = true; renderClub(); });
}
$('#bSaveTeam').addEventListener('click', async () => {
  const err = $('#clubErr'); err.textContent = '';
  const name = $('#tName').value.trim();
  if (name.length < 3) { err.textContent = 'Le nom de l\'équipe doit faire au moins 3 caractères.'; return; }
  const btn = $('#bSaveTeam'); btn.disabled = true;
  const { error } = await sb.rpc('save_team', { p_name: name, p_kit: DRAFT.kit, p_slots: DRAFT.slots });
  btn.disabled = false;
  if (error) { err.textContent = 'Enregistrement impossible. Vérifie ta connexion et réessaie.'; return; }
  COL.team = { name, kit: DRAFT.kit, slots: DRAFT.slots.slice() };
  ME.fav_team = 'PERSO'; sb.from('profiles').update({ fav_team: 'PERSO' }).eq('id', ME.id).then(() => { });
  toast('Équipe enregistrée. Elle est sélectionnée pour tes prochains matchs.');
});

/* Packs */
let SHOP_TAB = 'packs', FILTER = 'all', BUSY = false;
function openShop() { renderShop(); show('shop'); }
const ODD_ORDER = ['or', 'rare', 'elite', 'leg', 'goat'];
function renderShop() {
  renderCoins();
  const have = new Set(COL.cards), n = COL.cards.length, legs = COL.cards.filter(id => CARDS[id]?.tier === 'leg').length, ult = COL.cards.filter(id => CARDS[id]?.tier === 'goat').length;
  $('#prog').innerHTML = `<div class="pg-top"><span><b>${n}</b> / ${CARD_LIST.length} cartes</span><span><b>${legs}</b> / 18 légendes</span><span><b>${ult}</b> / 2 ultimes</span><span><b>${COL.packs}</b> packs ouverts</span></div><div class="pg-bar"><i style="width:${Math.round(n / CARD_LIST.length * 100)}%"></i></div>`;
  document.querySelectorAll('#shopTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === SHOP_TAB));
  const body = $('#shopBody');
  if (SHOP_TAB === 'coins') { renderCoinShop(body); refreshCoinShop(); return; }
  if (SHOP_TAB === 'packs') {
    body.innerHTML = `<div class="packs">${['free', 'or', 'stars', 'leg', 'icon'].map(k => {
      const P = PACKS[k], odds = ODD_ORDER.filter(t => P.odds[t] > 0).map(t => `<span class="od od-${t}">${TIER_NAME[t]} ${String(P.odds[t]).replace('.', ',')} %</span>`).join('');
      let btn;
      if (n >= CARD_LIST.length) btn = '<button class="buy" disabled>Collection complète</button>';
      else if (k === 'free') btn = freeReady() ? '<button class="buy go" data-pack="free">Ouvrir gratuitement</button>' : `<button class="buy" disabled id="freeBtn">Dans ${freeLeft()}</button>`;
      else btn = `<button class="buy" data-pack="${k}" ${COL.coins < P.price ? 'disabled' : ''}><span class="coins">${P.price.toLocaleString('fr-FR')}</span></button>`;
      return `<div class="pshop"><div class="pk-pack p-${k}"><small>Pack</small><b>${esc(P.n.replace('Pack ', ''))}</b><span>${P.count} carte${P.count > 1 ? 's' : ''}</span></div>
        <div style="min-width:0"><h3>${esc(P.n)}</h3><p>${esc(P.txt)}</p><div class="odds">${odds}</div>${btn}</div></div>`;
    }).join('')}</div>
    <p class="hint">Jamais de doublon : un pack ne te donne que des cartes que tu n'as pas encore. Tu gagnes des pièces à chaque match en ligne : victoire 500, nul 250, défaite 120, plus 60 par but.</p>`;
    body.querySelectorAll('[data-pack]').forEach(b => b.onclick = () => buyPack(b.dataset.pack));
  } else {
    const list = CARD_LIST.filter(c => FILTER === 'all' || (FILTER === 'miss' ? !have.has(c.id) : FILTER === 'mine' ? have.has(c.id) : c.tier === FILTER))
      .sort((a, b) => (have.has(b.id) - have.has(a.id)) || TRANK[b.tier] - TRANK[a.tier] || b.r - a.r);
    body.innerHTML = `<div class="filters">${[['all', 'Toutes'], ['mine', 'Les miennes'], ['goat', 'Ultimes'], ['leg', 'Légendes'], ['elite', 'Élite'], ['rare', 'Rare'], ['or', 'Or'], ['miss', 'Manquantes']].map(([k, l]) => `<button class="chip" data-f="${k}" aria-pressed="${FILTER === k}">${l}</button>`).join('')}</div>
      <div class="cgrid">${list.map(c => have.has(c.id) ? cardHTML(c) : lockedHTML(c)).join('')}</div>`;
    body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { FILTER = b.dataset.f; renderShop(); });
  }
}
document.querySelectorAll('#shopTabs button').forEach(b => b.addEventListener('click', () => { SHOP_TAB = b.dataset.tab; renderShop(); }));
const PACK_ERR = { not_enough_coins: 'Tu n\'as pas assez de pièces pour ce pack.', free_not_ready: 'Le pack gratuit n\'est pas encore disponible.', nothing_left: 'Il ne reste plus de carte à gagner dans ce pack.' };
async function buyPack(type) {
  if (BUSY) return; BUSY = true; audio();
  const { data, error } = await sb.rpc('open_pack', { p_type: type });
  BUSY = false;
  if (error) { const k = Object.keys(PACK_ERR).find(k => (error.message || '').includes(k)); toast(PACK_ERR[k] || 'Ouverture impossible. Vérifie ta connexion.'); await loadCollection(); renderShop(); return; }
  COL.cards = COL.cards.concat(data.cards); COL.coins = data.coins; COL.packs++;
  if (type === 'free') COL.last_free = new Date(Date.now() + clockOffset).toISOString();
  renderShop();
  showPack(type, data.cards, a => { if (a === 'team') openClub(); else renderShop(); });
}
setInterval(() => {
  const b = $('#freeBtn'); if (b && !$('#shop').hidden) { if (freeReady()) renderShop(); else b.textContent = `Dans ${freeLeft()}`; }
}, 1000);

/* Équipes des adversaires (lues depuis la base, pour éviter la triche) */
const TEAM_CACHE = new Map();
async function fetchCustomTeam(uid) {
  if (TEAM_CACHE.has(uid)) return TEAM_CACHE.get(uid);
  const { data } = await sb.from('collections').select('team_name,team_kit,team_slots').eq('user_id', uid).maybeSingle();
  const t = customTeam(data ? { name: data.team_name, kit: data.team_kit, slots: data.team_slots } : null);
  TEAM_CACHE.set(uid, t); return t;
}
const myTeamObj = idx => idx === -1 && COL ? customTeam(COL.team) : TEAMS[Math.max(0, idx)];

/* ---------- Salle ---------- */
let ROOM = null, LOB = null;
async function enterRoom(code, role) {
  if (ROOM) await ROOM.leave();
  LOB = { code, role, team: ME.fav_team === 'PERSO' && COL ? -1 : teamIdx(ME.fav_team), ready: false, dur: 180, mode: 'match', dpack: 'stars', drounds: 5, matchNo: 0, peer: null };
  const room = new Room(code, { uid: ME.id, name: ME.display, rating: ME.rating, fav: LOB.team }, role);
  ROOM = room;
  Object.assign(room.state, { dur: LOB.dur, mode: LOB.mode, dpack: LOB.dpack, drounds: LOB.drounds });
  room.on('peer', p => { LOB.peer = p; renderLobby(); maybeStart(); if (DUEL && !DUEL.done && !p) { toast('Ton adversaire s\'est déconnecté.'); endDuel('quit'); } if (GAME && GAME.online) GAME.peerSeen = p ? performance.now() : GAME.peerSeen; if (GAME && GAME.online && !p) GAME.peerGoneAt ||= performance.now(); if (GAME && p) GAME.peerGoneAt = 0; });
  room.on('link', l => { renderNet(l); if (GAME) GAME.net = l; });
  room.on('full', () => { toast('Cette salle est déjà complète.'); leaveRoom(); });
  room.on('msg', onRoomMsg);
  $('#roomCode').textContent = code;
  renderLobby(); show('lobby');
  try { await room.join(); renderNet(room.linkInfo()); }
  catch { if (ROOM === room) { toast('Connexion à la salle impossible. Vérifie ta connexion.'); leaveRoom(); } return; }
  // invité arrivé dans une salle vide : le créateur est sûrement parti
  if (role === 'guest') setTimeout(() => { if (ROOM === room && !LOB?.peer && !GAME) toast('Personne dans cette salle… ton ami est peut-être parti. Tu peux quitter et le défier à ton tour.'); }, 15000);
}
async function leaveRoom() {
  const r = ROOM; ROOM = null; LOB = null;
  if (r) await r.leave();
  ME = await loadProfile() || ME; await loadCollection(); renderHome(); show('home');
}
$('#bLeave').addEventListener('click', leaveRoom);

/* ---------- Salle à plusieurs (plusieurs humains dans la même équipe) ---------- */
const TMAX = 8, SIDE_MAX = 4; // 4 joueurs de champ par équipe (le gardien reste à l'ordi)
const SIDE_NAME = ['Équipe A', 'Équipe B'];
async function enterTeamRoom(code, role) {
  if (ROOM) await ROOM.leave();
  const fav = teamIdx(ME.fav_team);
  LOB = { code, role, multi: true, side: role === 'host' ? 0 : 1, ready: role === 'host', ca: fav, cb: (fav + 7) % TEAMS.length, dur: 180, matchNo: 0, members: [], picked: role === 'host', peer: null };
  const room = new Room(code, { uid: ME.id, name: ME.display, rating: ME.rating }, role, { max: TMAX, prefix: 'team:' });
  ROOM = room;
  Object.assign(room.state, { side: LOB.side, ready: LOB.ready, ca: LOB.ca, cb: LOB.cb, dur: LOB.dur });
  room.on('peers', list => {
    LOB.members = list;
    if (!LOB.picked && list.some(p => p.uid === ME.id) && list.some(p => p.role === 'host')) { // un invité se met dans l'équipe la moins remplie
      LOB.picked = true;
      const n = [0, 1].map(t => list.filter(p => p.uid !== ME.id && p.side === t).length);
      const side = n[0] <= n[1] ? 0 : 1;
      if (side !== LOB.side) { LOB.side = side; room.setState({ side }); }
    }
    renderTLobby();
  });
  room.on('peer', p => { LOB.peer = p; renderTNet(); if (GAME && GAME.multi && !GAME.host) { GAME.peerSeen = p ? performance.now() : GAME.peerSeen; } });
  room.on('link', l => { if (GAME) GAME.net = l; renderTNet(); });
  room.on('full', () => { toast('Cette salle est complète (8 joueurs maximum).'); leaveRoom(); });
  room.on('msg', onRoomMsg);
  $('#tCode').textContent = code;
  renderTLobby(); show('tlobby');
  try { await room.join(); renderTNet(); }
  catch { if (ROOM === room) { toast('Connexion à la salle impossible. Vérifie ta connexion.'); leaveRoom(); } return; }
  if (role === 'guest') setTimeout(() => { if (ROOM === room && !LOB?.peer && !GAME) toast('Personne n\'a créé cette salle… vérifie le code avec ton pote.'); }, 12000);
}
function renderTNet() {
  const el = $('#tNet'); if (!el || !LOB?.multi) return;
  const n = (LOB.members || []).length || 1;
  el.textContent = `${n} / ${TMAX} joueur${n > 1 ? 's' : ''}`; el.className = 'netpill' + (n > 1 ? ' ok' : '');
}
function tState() {
  // l'hôte décide des clubs et de la durée ; tout le monde lit son état
  const host = LOB.role === 'host' ? { ...ROOM.state, uid: ME.id } : (LOB.members || []).find(p => p.role === 'host');
  return { ca: host?.ca ?? LOB.ca, cb: host?.cb ?? LOB.cb, dur: host?.dur ?? LOB.dur };
}
function renderTLobby() {
  if (!LOB?.multi) return;
  const host = LOB.role === 'host', st = tState();
  const members = (LOB.members?.length ? LOB.members : [{ uid: ME.id, name: ME.display, rating: ME.rating, role: LOB.role, ...ROOM?.state }])
    .map(p => p.uid === ME.id ? { ...p, side: LOB.side, ready: LOB.ready } : p);
  const side = t => members.filter(p => (p.side ?? 1) === t);
  const col = t => {
    const tm = TEAMS[t === 0 ? st.ca : st.cb] || TEAMS[0], list = side(t), bots = Math.max(0, 4 - list.length);
    return `<div class="tside s${t}">
      <div class="tsh">${shirtSVG(tm.h)}<div><small>${SIDE_NAME[t]}</small><b>${esc(tm.name)}</b></div>
        ${host ? `<select class="tsel" data-club="${t}" aria-label="Club de l'${SIDE_NAME[t]}">${TEAMS.map((x, i) => `<option value="${i}" ${i === (t === 0 ? st.ca : st.cb) ? 'selected' : ''}>${esc(x.short)} · ${esc(x.name)}</option>`).join('')}</select>` : ''}</div>
      <ul class="tplist">${list.map(p => `<li class="${p.uid === ME.id ? 'me' : ''}"><span class="tdot ${p.ready || p.role === 'host' ? 'on' : ''}"></span><b>${esc(p.name)}</b>${p.role === 'host' ? '<i class="tag">hôte</i>' : ''}<small>${p.role === 'host' ? 'lance le match' : p.ready ? 'prêt ✓' : 'pas prêt'}</small></li>`).join('')}
        ${bots ? `<li class="bot"><small>${list.length ? `+ ${bots} joueur${bots > 1 ? 's' : ''} ordi` : `${bots} joueurs ordi`} et le gardien</small></li>` : '<li class="bot"><small>+ le gardien (ordi)</small></li>'}</ul>
      ${LOB.side !== t ? `<button class="btn small" data-side="${t}" ${list.length >= SIDE_MAX || (LOB.ready && !host) ? 'disabled' : ''}>→ ${SIDE_NAME[t]}</button>` : '<span class="tyou">Tu es ici</span>'}
    </div>`;
  };
  $('#tSides').innerHTML = col(0) + '<div class="vsx">VS</div>' + col(1);
  $('#tSides').querySelectorAll('[data-side]').forEach(b => b.onclick = () => { LOB.side = +b.dataset.side; ROOM.setState({ side: LOB.side }); renderTLobby(); });
  $('#tSides').querySelectorAll('[data-club]').forEach(sel => sel.onchange = () => { const k = sel.dataset.club === '0' ? 'ca' : 'cb'; LOB[k] = +sel.value; ROOM.setState({ [k]: LOB[k] }); renderTLobby(); });
  $('#tDur').innerHTML = [[120, '2 min'], [180, '3 min'], [300, '5 min']].map(([v, l]) => `<button class="chip" data-tdur="${v}" aria-pressed="${st.dur === v}" ${host ? '' : 'disabled'}>${l}</button>`).join('');
  $('#tDur').querySelectorAll('[data-tdur]').forEach(b => b.onclick = () => { LOB.dur = +b.dataset.tdur; ROOM.setState({ dur: LOB.dur }); renderTLobby(); });
  const others = members.filter(p => p.uid !== ME.id), notReady = others.filter(p => !p.ready);
  const full = [0, 1].some(t => side(t).length > SIDE_MAX);
  $('#tReady').hidden = host; $('#tStart').hidden = !host;
  $('#tReady').textContent = LOB.ready ? 'Annuler' : 'Je suis prêt'; $('#tReady').classList.toggle('primary', !LOB.ready);
  const canStart = others.length >= 1 && !notReady.length && !full;
  $('#tStart').disabled = !canStart; $('#tStart').classList.toggle('primary', canStart);
  $('#tHint').textContent = host
    ? (!others.length ? `Invite tes potes (à droite) ou donne-leur le code ${LOB.code}. Ils le tapent dans « Rejoindre ».` : notReady.length ? `En attente : ${notReady.map(p => p.name).join(', ')}` : full ? 'Maximum 4 joueurs par équipe.' : 'Tout le monde est prêt : lance le match !')
    : LOB.ready ? 'Prêt ! L\'hôte va lancer le match.' : 'Choisis ton équipe puis touche « Je suis prêt ». Vous pouvez tous être dans la même équipe contre l\'ordi !';
  // amis à inviter
  const fl = friendsList(), inRoom = new Set(members.map(p => p.uid));
  $('#tFriends').innerHTML = fl.length ? fl.map(f => `<li class="friend"><span class="tdot ${isOnline(f.id) ? 'on' : ''}"></span><b>${esc(f.display)}</b>
    ${inRoom.has(f.id) ? '<small class="muted">dans la salle</small>' : `<button class="btn small" data-inv="${f.id}">${isOnline(f.id) ? 'Inviter' : 'Notifier'}</button>`}</li>`).join('') : '<li class="muted">Ajoute des amis depuis l\'accueil pour les inviter ici.</li>';
  $('#tFriends').querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { const f = fl.find(x => x.id === b.dataset.inv); inviteToRoom(f, LOB.code); b.disabled = true; b.textContent = 'Invité ✓'; });
  renderTNet();
}
$('#tLeave').addEventListener('click', leaveRoom);
$('#tCode').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?salle=${LOB.code}`;
  try { await navigator.clipboard.writeText(url); toast('Lien d\'invitation copié'); } catch { toast(`Code de la salle : ${LOB.code}`); }
});
$('#tReady').addEventListener('click', () => { audio(); LOB.ready = !LOB.ready; ROOM.setState({ ready: LOB.ready, side: LOB.side }); renderTLobby(); });
$('#tStart').addEventListener('click', () => {
  if (!LOB?.multi || LOB.role !== 'host' || GAME) return;
  audio(); goFull();
  const others = (LOB.members || []).filter(p => p.uid !== ME.id && p.ready);
  const members = [{ uid: ME.id, name: ME.display, side: LOB.side }, ...others.map(p => ({ uid: p.uid, name: p.name, side: p.side ?? 1 }))];
  if ([0, 1].some(t => members.filter(p => p.side === t).length > SIDE_MAX)) { toast('Maximum 4 joueurs par équipe.'); return; }
  const st = tState(), teams = [TEAMS[st.ca], TEAMS[st.cb]];
  const nm = t => members.filter(p => p.side === t).map(p => p.name).join(' · ') || 'Ordi';
  LOB.matchNo++;
  const cfg = { multi: true, teams, dur: st.dur, n: LOB.matchNo, mid: `${LOB.code}-${Math.random().toString(36).slice(2, 7)}`, diff: 1,
    slots: members.map(p => p.side), uids: members.map(p => p.uid), pn: members.map(p => p.name), names: [nm(0), nm(1)] };
  ROOM.send('tstart', cfg); setTimeout(() => ROOM?.send('tstart', cfg), 500); // envoyé deux fois au cas où
  startMulti(cfg, 0);
});
// notification touchée alors que le jeu est déjà ouvert
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type !== 'open' || !ME) return;
  let u; try { u = new URL(e.data.url); } catch { return; }
  const salle = cleanCode(u.searchParams.get('salle'));
  if (salle.length >= 4) {
    if ((GAME && !GAME.done) || (DUEL && !DUEL.done)) { toast('Termine ton match d\'abord.'); return; }
    if (LOB?.code !== salle) joinAny(salle);
  } else if (u.searchParams.get('admin') && ME.is_admin) openAdmin();
});
$('#roomCode').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?salle=${LOB.code}`;
  try { await navigator.clipboard.writeText(url); toast('Lien d\'invitation copié'); }
  catch { toast(`Code de la salle : ${LOB.code}`); }
});
function renderNet(l) {
  const el = $('#netPill');
  if (!LOB?.peer) { el.textContent = 'En attente d\'un adversaire'; el.className = 'netpill'; return; }
  el.textContent = l.mode === 'p2p' ? `Direct · ${l.rtt || '…'} ms` : `Relais · ${l.rtt || '…'} ms`;
  el.className = 'netpill ' + (l.ok ? 'ok' : 'bad');
}
function slotHTML(p, side, mine) {
  if (!p) return `<div class="shirt">${shirtSVG(['#2a3d33', '#2a3d33', 'solid'])}</div><b>En attente…</b><small>Partage le code <b>${esc(LOB.code)}</b></small>`;
  let t;
  if (mine) t = myTeamObj(p.team);
  else if (p.team === -1) { t = TEAM_CACHE.get(p.uid); if (!t) { fetchCustomTeam(p.uid).then(() => renderLobby()); t = customTeam(null); } }
  else t = TEAMS[p.team ?? 0];
  return `<div class="shirt">${shirtSVG(t.h)}</div><b>${esc(p.name)}${mine ? ' (toi)' : ''}</b><small>${p.rating} pts</small><span class="team">${esc(t.name)} · ${t.ovr}</span><span class="tag">${p.ready ? 'Prêt' : LOB.mode === 'duel' ? 'Pas encore prêt' : 'Choisit son équipe…'}</span>`;
}
function renderLobby() {
  if (!LOB) return;
  const meP = { name: ME.display, rating: ME.rating, team: LOB.team, ready: LOB.ready };
  const mySide = LOB.role === 'host' ? 0 : 1;
  const sMe = $('#slotMe'), sOp = $('#slotOp');
  sMe.className = `slot s${mySide}${LOB.ready ? ' ready' : ''}`; sMe.innerHTML = slotHTML(meP, mySide, true);
  sOp.className = `slot s${1 - mySide}${LOB.peer?.ready ? ' ready' : ''}${LOB.peer ? '' : ' empty'}`; sOp.innerHTML = slotHTML(LOB.peer, 1 - mySide, false);
  const host = LOB.role === 'host', src = host ? LOB : (LOB.peer || LOB);
  const mode = src.mode || 'match', dur = src.dur || 180, dpack = src.dpack || 'stars', drounds = src.drounds || 5;
  if (!host) { LOB.mode = mode; LOB.dpack = dpack; LOB.drounds = drounds; }
  const chips = (sel, items, cur, key) => { const el = $(sel); el.innerHTML = items.map(([v, l]) => `<button class="chip" data-v="${v}" aria-pressed="${cur == v}" ${host ? '' : 'disabled'}>${l}</button>`).join('');
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { if (!host) return; const v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; LOB[key] = v; ROOM.setState({ [key]: v }); renderLobby(); }); };
  chips('#modeChips', [['match', 'Match'], ['duel', 'Duel de packs']], mode, 'mode');
  chips('#dpChips', [['or', 'Or'], ['stars', 'Stars'], ['leg', 'Légende'], ['icon', 'Icône']], dpack, 'dpack');
  chips('#drChips', [[3, '3'], [5, '5'], [10, '10']], drounds, 'drounds');
  const duel = mode === 'duel';
  ['#durLbl', '#durChips'].forEach(x => $(x).hidden = duel); ['#dpLbl', '#dpChips', '#drLbl', '#drChips'].forEach(x => $(x).hidden = !duel);
  $('#teamGrid').closest('.card').hidden = duel;
  $('#durChips').innerHTML = [[120, '2 min'], [180, '3 min'], [300, '5 min']].map(([v, l]) => `<button class="chip" data-dur="${v}" aria-pressed="${dur === v}" ${LOB.role !== 'host' ? 'disabled' : ''}>${l}</button>`).join('');
  $('#durChips').querySelectorAll('[data-dur]').forEach(b => b.onclick = () => { if (LOB.role !== 'host') return; LOB.dur = +b.dataset.dur; ROOM.setState({ dur: LOB.dur }); renderLobby(); });
  const g = $('#teamGrid');
  const mine = COL ? customTeam(COL.team) : null;
  g.innerHTML = (mine ? `<button class="tm mine" data-t="-1" aria-pressed="${LOB.team === -1}" ${LOB.ready ? 'disabled' : ''}>${shirtSVG(mine.h)}<b>${esc(mine.short)}</b><small>${esc(mine.name)}</small><span class="o">${mine.ovr}</span></button>` : '')
    + TEAMS.map((t, i) => `${i === 0 || TEAMS[i - 1].g !== t.g ? `<h4 class="tgrp">${t.g === 'Nations' ? 'Sélections nationales' : t.g === 'France' ? 'Ligue 1' : 'Clubs européens'}</h4>` : ''}<button class="tm" data-t="${i}" aria-pressed="${LOB.team === i}" ${LOB.ready ? 'disabled' : ''}>${shirtSVG(t.h)}<b>${esc(t.short)}</b><small>${esc(t.name)}</small><span class="o">${t.ovr}</span></button>`).join('');
  g.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { LOB.team = +b.dataset.t; ROOM.setState({ team: LOB.team }); renderLobby(); });
  const rb = $('#bReady');
  rb.textContent = LOB.ready ? 'Annuler' : 'Je suis prêt';
  rb.classList.toggle('primary', !LOB.ready);
  $('#lobbyHint').textContent = !LOB.peer ? `Donne le code ${LOB.code} à ton adversaire, ou touche le code pour copier le lien.`
    : LOB.ready && !LOB.peer.ready ? `En attente de ${LOB.peer.name}…` : LOB.ready && LOB.peer.ready ? 'C\'est parti !' : duel ? 'Duel de packs : chacun ouvre un pack à chaque manche, le meilleur pack gagne. Touche « Je suis prêt ».' : 'Choisis ton équipe puis touche « Je suis prêt ».';
}
$('#bReady').addEventListener('click', () => {
  audio(); goFull();
  LOB.ready = !LOB.ready; ROOM.setState({ ready: LOB.ready, team: LOB.team });
  if (LOB.ready) { ME.fav_team = LOB.team === -1 ? 'PERSO' : TEAMS[LOB.team].short; sb.from('profiles').update({ fav_team: ME.fav_team }).eq('id', ME.id).then(() => { }); }
  renderLobby(); maybeStart();
});
async function maybeStart() {
  if (!LOB || LOB.role !== 'host' || GAME || DUEL || LOB.starting || !LOB.ready || !LOB.peer?.ready) return;
  if (LOB.mode === 'duel') { startDuelHost(); return; }
  LOB.starting = true;
  const peer = LOB.peer;
  TEAM_CACHE.delete(peer.uid);
  const teams = [myTeamObj(LOB.team), peer.team === -1 ? await fetchCustomTeam(peer.uid) : TEAMS[peer.team ?? 0]];
  LOB.starting = false;
  if (!LOB || GAME || !LOB.ready || !LOB.peer?.ready) return;
  LOB.matchNo++;
  const cfg = { teams, dur: LOB.dur, n: LOB.matchNo, mid: `${LOB.code}-${Math.random().toString(36).slice(2, 8)}`, uids: [ME.id, LOB.peer.uid], names: [ME.display, LOB.peer.name] };
  ROOM.send('start', cfg);
  startOnline(cfg, 0);
}
function onRoomMsg(k, d) {
  if (k === 'start' && LOB?.role === 'guest' && !LOB.multi && !GAME) { LOB.matchNo = d.n; startOnline(d, 1); return; }
  if (k === 'tstart' && LOB?.multi && LOB.role === 'guest' && !GAME) {
    const s = (d.uids || []).indexOf(ME.id);
    if (s < 0) { toast('Le match a commencé sans toi (salle pleine ou tu n\'étais pas prêt).'); return; }
    LOB.matchNo = d.n; startMulti(d, s); return;
  }
  if (k.startsWith('d') && onDuelMsg(k, d)) return;
  if (!GAME) return;
  if (k === 's' && !GAME.host) GAME.onSnap(d);
  else if (k === 'i' && GAME.host) { const s = GAME.multi ? d.s : 1; if (s > 0 && s < GAME.slots.length) GAME.remotes[s] = d; }
  else if (k === 'end' && !GAME.host) GAME.onEnd(d);
  else if (k === 'quit') {
    if (!GAME.multi) GAME.forfeit(true, 'Ton adversaire a abandonné.');
    else if (d?.host) GAME.forfeit(false, 'L\'hôte a quitté le match.');
    else if (GAME.host && d?.s > 0) GAME.remotes[d.s] = null, (GAME.left ||= new Set()).add(d.s);
  }
}
/** Hôte d'un match à plusieurs : cet humain est parti ? (l'ordi reprend son joueur) */
function slotGone(g, s) {
  if (!g.multi) return false;
  if (g.left?.has(s)) return true;
  const uid = g.uids?.[s]; return !!uid && !!ROOM && !ROOM.peers.some(p => p.uid === uid);
}


/* ---------- Duel de packs en ligne ----------
   L'hôte tire les cartes des deux joueurs (jamais deux fois la même carte pendant le duel)
   et les envoie ; chacun ouvre son pack avec l'animation, puis on compare. Les cartes du duel
   ne vont pas dans la collection. */
let DUEL = null;
const BONUS = { or: 0, rare: 3, elite: 10, leg: 25, goat: 60 };
const packPts = ids => ids.reduce((a, id) => a + CARDS[id].r + BONUS[CARDS[id].tier], 0);
function rollTierJS(odds) { const ks = ['or', 'rare', 'elite', 'leg', 'goat']; let tot = ks.reduce((a, k) => a + (odds[k] || 0), 0), x = Math.random() * tot; for (const k of ks) { const v = odds[k] || 0; if (v > 0 && x < v) return k; x -= v; } return 'or'; }
function drawPack(type, used) {
  const P = PACKS[type], got = [];
  for (let i = 0; i < P.count; i++) {
    let t = rollTierJS(P.odds);
    if (type === 'stars' && i === 0 && t === 'or') t = 'rare';
    if (type === 'leg' && i === 0 && t !== 'goat') t = Math.random() < .35 ? 'leg' : 'elite';
    const free = c => !used.has(c.id) && !got.includes(c.id);
    let pool = CARD_LIST.filter(c => free(c) && c.tier === t);
    if (!pool.length) { const cand = CARD_LIST.filter(c => free(c) && (t === 'goat' || c.tier !== 'goat')); const best = Math.min(...cand.map(c => Math.abs(TRANK[c.tier] - TRANK[t]))); pool = cand.filter(c => Math.abs(TRANK[c.tier] - TRANK[t]) === best); }
    if (type === 'icon') pool = pool.filter(c => c.tier === 'leg' || c.tier === 'goat');
    if (!pool.length) break;
    got.push(pool[Math.random() * pool.length | 0].id);
  }
  got.forEach(id => used.add(id));
  return got;
}
function startDuelHost() {
  const d = { type: LOB.dpack, rounds: LOB.drounds, names: [ME.display, LOB.peer.name] };
  ROOM.send('dstart', d); beginDuel(d, 0); nextDuelRound();
}
function beginDuel(d, side) {
  DUEL = { ...d, side, r: 0, sc: [0, 0], hist: [], cur: null, opened: [false, false], used: new Set(), done: false };
  renderDuel(); show('pduel');
}
function nextDuelRound() {
  const D = DUEL; if (!D || D.side !== 0) return;
  const packs = [drawPack(D.type, D.used), drawPack(D.type, D.used)];
  if (!packs[0].length || !packs[1].length) { ROOM.send('dend', { reason: 'cards' }); endDuel('cards'); return; }
  const msg = { r: D.r + 1, packs };
  ROOM.send('dround', msg); duelRound(msg);
}
function duelRound(m) {
  const D = DUEL; if (!D || m.r <= D.r) return;
  D.r = m.r; D.cur = m.packs; D.opened = [false, false];
  renderDuel();
  showPack(D.type, m.packs[D.side], () => { D.opened[D.side] = true; ROOM?.send('dopen', { r: D.r }); settleDuelRound(); }, `Manche ${D.r} · ${PACKS[D.type].n}`, { duel: true });
}
function settleDuelRound() {
  const D = DUEL; if (!D) return;
  if (D.opened[0] && D.opened[1] && D.cur && !D.cur.settled) {
    D.cur.settled = true;
    const s = [packPts(D.cur[0]), packPts(D.cur[1])], w = s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1;
    if (w >= 0) D.sc[w]++;
    D.hist.unshift({ r: D.r, s, w, packs: D.cur });
    tone(w === D.side ? 880 : 330, .2, 'triangle', .12, w === D.side ? 1320 : 220);
    const need = Math.floor(D.rounds / 2) + 1;
    if (D.r >= D.rounds || D.sc[0] >= need || D.sc[1] >= need) { D.done = true; cheer(); }
  }
  renderDuel();
}
function endDuel(reason) { if (!DUEL) return; DUEL.done = true; DUEL.reason = reason; renderDuel(); }
function onDuelMsg(k, d) {
  if (k === 'dstart' && LOB?.role === 'guest') { beginDuel(d, 1); return true; }
  if (!DUEL) return false;
  if (k === 'dround' && DUEL.side === 1) duelRound(d);
  else if (k === 'dopen' && d.r === DUEL.r) { DUEL.opened[1 - DUEL.side] = true; settleDuelRound(); }
  else if (k === 'dnext' && DUEL.side === 1) { /* l'hôte relance */ }
  else if (k === 'dend') endDuel(d.reason || 'stop');
  else if (k === 'dquit') { toast('Ton adversaire a quitté le duel.'); endDuel('quit'); }
  else return false;
  return true;
}
function renderDuel() {
  const D = DUEL; if (!D) return;
  const me = D.side, op = 1 - me;
  $('#dBoard').innerHTML = `<div class="dp p${me}"><small>${me === 0 ? 'J1' : 'J2'} · toi</small><b>${esc(D.names[me])}</b></div>
    <div class="dsc"><span class="nums">${D.sc[me]}<i>–</i>${D.sc[op]}</span><small>${D.done ? 'Terminé' : `Manche ${D.r} / ${D.rounds}`} · ${esc(PACKS[D.type].n)}</small></div>
    <div class="dp p${op}"><small>${op === 0 ? 'J1' : 'J2'}</small><b>${esc(D.names[op])}</b></div>`;
  const last = D.hist[0], showing = D.cur && D.cur.settled ? last : null;
  const side = i => {
    const ids = D.cur ? D.cur[i] : [];
    const visible = D.cur && (i === me ? D.opened[me] : D.cur.settled);
    const win = showing && showing.w === i;
    return `<div class="dside s${i}${win ? ' win' : ''}"><h3>${esc(D.names[i])}${i === me ? ' (toi)' : ''}</h3>${visible
      ? `<div class="cards">${ids.map(id => cardHTML(CARDS[id])).join('')}</div><div class="pts">${packPts(ids)} pts</div>`
      : `<div class="wait">${!D.cur ? 'Préparation…' : i === me ? 'Ouvre ton pack !' : 'Ouvre son pack…'}</div>`}</div>`;
  };
  $('#dRound').innerHTML = side(me) + '<div class="dvs">VS</div>' + side(op);
  const acts = $('#dActions'); acts.innerHTML = '';
  const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = txt; b.onclick = fn; acts.appendChild(b); return b; };
  if (D.done) {
    const w = D.sc[me] > D.sc[op] ? me : D.sc[op] > D.sc[me] ? op : -1;
    acts.insertAdjacentHTML('beforeend', `<div class="winner"><small>${w < 0 ? 'Égalité' : w === me ? 'Tu gagnes le duel !' : 'Vainqueur du duel'}</small><b>${w < 0 ? 'Match nul' : esc(D.names[w])}</b><span>${D.sc[me]} – ${D.sc[op]}${D.reason === 'cards' ? ' · plus assez de cartes' : D.reason === 'quit' ? ' · abandon' : ''}</span></div>`);
    mk('Retour à la salle', 'primary', () => { DUEL = null; if (LOB) { LOB.ready = false; ROOM?.setState({ ready: false }); renderLobby(); show('lobby'); } else { renderHome(); show('home'); } });
  } else if (D.cur?.settled) {
    if (me === 0) mk('Manche suivante', 'primary', () => nextDuelRound());
    else acts.insertAdjacentHTML('beforeend', `<p class="hint">${esc(D.names[0])} lance la manche suivante…</p>`);
  } else if (D.cur && !D.opened[me]) mk('Ouvrir mon pack', 'primary', () => showPack(D.type, D.cur[me], () => { D.opened[me] = true; ROOM?.send('dopen', { r: D.r }); settleDuelRound(); }, `Manche ${D.r} · ${PACKS[D.type].n}`, { duel: true }));
  if (!D.done) mk('Quitter le duel', '', () => { ROOM?.send('dquit', {}); DUEL = null; if (LOB) { LOB.ready = false; ROOM?.setState({ ready: false }); renderLobby(); show('lobby'); } });
  $('#dHist').innerHTML = D.hist.length ? `<h3>Manches</h3>${D.hist.map(h => `<div class="hrow"><span class="${h.w === me ? 'win' : ''}">${esc(D.names[me])} <b>${h.s[me]}</b></span><small>M${h.r}</small><span class="${h.w === op ? 'win' : ''}"><b>${h.s[op]}</b> ${esc(D.names[op])}</span></div>`).join('')}` : '';
}

/* ---------- Plein écran ---------- */
function goFull() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => { })).catch(() => { });
}
let wake = null;
async function keepAwake() { try { wake = await navigator.wakeLock?.request('screen'); } catch { } }

/* ---------- Commandes ---------- */
const cv = $('#cv');
const R = createRenderer(cv);
const LI = { tx: 0, ty: 0, joyOn: false, jox: 0, joy: 0, jlx: 0, jly: 0, klx: 0, kly: 0, a: 0, l: 0, b: 0, rel: 0, relCharge: 0, bDown: false, aFlash: 0, aDown: false, aT: 0 };
const LOB_MS = 320; // appui long sur PASSE = ballon en l'air
/** PASSE : sans ballon on agit tout de suite (changer de joueur) ; avec le ballon on attend le relâchement (court = passe, long = en l'air) */
function myBall() { const V = GAME?.V; if (!V) return false; const own = V.b[3], me = GAME.side; return own >= 0 && (own === V.c[GAME.slot] || (GAME.M.players[own].gk && GAME.M.players[own].t === me)); }
function aPress() { if (myBall()) { LI.aDown = true; LI.aT = performance.now(); } else { LI.a++; LI.aFlash = .15; buzz(8); } }
function aRelease() { if (!LI.aDown) return; LI.aDown = false; localKick(.8); if (performance.now() - LI.aT >= LOB_MS) { LI.l++; buzz([10, 30, 18]); } else { LI.a++; buzz(8); } LI.aFlash = .15; }
const ptrs = new Map();
function hit(x, y) {
  const g = R.ctrl;
  if (R.menuBtn && Math.hypot(x - R.menuBtn.x, y - R.menuBtn.y) < R.menuBtn.r) return 'M';
  if (Math.hypot(x - g.bx, y - g.by) < g.br * 1.45) return 'B';
  if (Math.hypot(x - g.ax, y - g.ay) < g.ar * 1.5) return 'A';
  if ((SET.lefty ? x > R.W * .5 : x < R.W * .5) && y > R.hud) return 'J';
  return null;
}
function updJoy() {
  const g = R.ctrl, Rr = g.jr;
  let dx = LI.jlx - LI.jox, dy = LI.jly - LI.joy; const d = Math.hypot(dx, dy);
  if (d > Rr) { LI.jox = LI.jlx - dx / d * Rr; LI.joy = LI.jly - dy / d * Rr; dx = dx / d * Rr; dy = dy / d * Rr; }
  LI.klx = dx; LI.kly = dy; LI.tx = dx / Rr; LI.ty = dy / Rr;
}
function xy(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); audio();
  if (!document.fullscreenElement && matchMedia('(pointer:coarse)').matches) goFull();
  if (GAME?.replay && performance.now() >= GAME.replay.start) { stopReplay(GAME); return; }
  const [x, y] = xy(e), k = hit(x, y);
  if (!k) return;
  if (k === 'M') { openMenu(); return; }
  ptrs.set(e.pointerId, k);
  try { cv.setPointerCapture(e.pointerId); } catch { }
  if (k === 'B') { LI.bDown = true; LI.b++; }
  else if (k === 'A') aPress();
  else { LI.joyOn = true; LI.jox = LI.jlx = x; LI.joy = LI.jly = y; updJoy(); }
});
cv.addEventListener('pointermove', e => { if (ptrs.get(e.pointerId) !== 'J') return; e.preventDefault(); const [x, y] = xy(e); LI.jlx = x; LI.jly = y; updJoy(); });
function up(e) {
  const k = ptrs.get(e.pointerId); if (!k) return; ptrs.delete(e.pointerId);
  if (k === 'J') { LI.joyOn = false; LI.tx = LI.ty = 0; LI.klx = LI.kly = 0; }
  else if (k === 'B') bRelease();
  else if (k === 'A') aRelease();
}
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
const KEYS = {};
addEventListener('keydown', e => {
  if (!GAME || $('#game').hidden) return;
  if (e.repeat) { e.preventDefault(); return; }
  KEYS[e.code] = true; audio();
  if ((e.code === 'KeyJ' || e.code === 'KeyF') && !e.repeat) aPress();
  if (e.code === 'KeyK' || e.code === 'KeyG' || e.code === 'Space') { LI.bDown = true; LI.b++; }
  if (e.code === 'Escape') { if ($('#menu').hidden) openMenu(); else $('#menu').hidden = true; }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => {
  KEYS[e.code] = false;
  if (e.code === 'KeyJ' || e.code === 'KeyF') aRelease();
  if ((e.code === 'KeyK' || e.code === 'KeyG' || e.code === 'Space') && LI.bDown) bRelease();
});
/* Manette */
function bPress() { if (LI.bDown) return; LI.bDown = true; LI.b++; }
function bRelease() { if (!LI.bDown) return; localKick(1.3); LI.bDown = false; LI.relCharge = GAME?.localCharge || 0; LI.rel++; }
function closeTop() {
  if (!$('#replay').hidden) { closeReplay(); return true; }
  if (!$('#trade').hidden) { closeTrade(); return true; }
  if (!$('#chat').hidden) { closeChat(); return true; }
  if (!$('#profile').hidden) { closeProfile(); return true; }
  if (!$('#settings').hidden) { closeSettings(); return true; }
  if (!$('#menu').hidden) { $('#menu').hidden = true; return true; }
  for (const id of ['tuto', 'pack', 'picker']) {
    const o = $('#' + id); if (o.hidden) continue;
    const b = o.querySelector('[data-t="skip"],[data-a="close"],#pkClose');
    if (b) b.click(); else if (id !== 'pack') o.hidden = true;
    return true;
  }
  return false;
}
initPad({
  inGame: () => !!GAME && !GAME.done && !$('#game').hidden && $('#menu').hidden && $('#settings').hidden,
  aDown: () => { audio(); if (GAME?.replay && performance.now() >= GAME.replay.start) { stopReplay(GAME); return; } aPress(); }, aUp: () => aRelease(),
  bDown: () => { audio(); bPress(); }, bUp: () => bRelease(),
  lob: () => { audio(); if (myBall()) { LI.l++; LI.aFlash = .15; buzz([10, 30, 18]); } else { LI.a++; LI.aFlash = .15; } },
  swap: () => { if (!myBall()) { LI.a++; LI.aFlash = .15; } },
  menu: () => openMenu(),
  back: () => { if (closeTop()) return; const h = document.querySelector('.screen:not([hidden]) [data-home]'); if (h) h.click(); },
  start: () => { if (!$('#menu').hidden) $('#menu').hidden = true; },
  onJoin: p => { const L = padLabels(); toast(`🎮 Manette détectée · ${L.A} passe · ${L.X} en l'air · ${L.B} tir · ${L.LB} changer`); },
  onLeave: () => toast('Manette déconnectée'),
});
/** Entrée locale en coordonnées terrain */
function localWorldInput() {
  let u = LI.tx + PAD.x + ((KEYS.KeyD || KEYS.ArrowRight) ? 1 : 0) - ((KEYS.KeyA || KEYS.ArrowLeft) ? 1 : 0);
  let v = LI.ty + PAD.y + ((KEYS.KeyS || KEYS.ArrowDown) ? 1 : 0) - ((KEYS.KeyW || KEYS.ArrowUp) ? 1 : 0);
  const m = Math.hypot(u, v); if (m > 1) { u /= m; v /= m; }
  const [jx, jy] = R.toWorld(u, v);
  return { jx, jy, m: Math.min(1, m), a: LI.a, l: LI.l, b: LI.b, d: LI.bDown, r: LI.rel, rc: LI.relCharge };
}
/** Transforme un état d'entrée (compteurs) en fronts pour le moteur */
function toEngine(raw, prev) {
  if (!raw) return blankInput();
  const I = { jx: raw.jx || 0, jy: raw.jy || 0, mag: clamp(raw.m || 0, 0, 1), bDown: !!raw.d, relCharge: clamp(raw.rc || 0, 0, 1),
    a: raw.a > prev.a, lob: (raw.l || 0) > (prev.l || 0), b: raw.b > prev.b, rel: raw.r > prev.r };
  if (I.mag > 0 && Math.hypot(I.jx, I.jy) > 0) { const n = Math.hypot(I.jx, I.jy); I.jx = I.jx / n * I.mag; I.jy = I.jy / n * I.mag; }
  prev.a = raw.a; prev.l = raw.l || 0; prev.b = raw.b; prev.r = raw.r;
  return I;
}

/* ---------- Match ---------- */
let GAME = null;
function metaOf(cfg, humans, names) {
  const team = cfg.teams || [TEAMS[cfg.t0], TEAMS[cfg.t1]];
  const players = [];
  for (let t = 0; t < 2; t++) team[t].sq.forEach((q, i) => players.push({ t, i, gk: i === 0, num: q[1], name: q[0], r: q[2] }));
  return { team, kit: pickKits(team[0], team[1]), players, humans, names, dur: cfg.dur, coop: !!cfg.multi, pn: cfg.pn || null };
}
function resetLocalInput() { Object.assign(LI, { tx: 0, ty: 0, joyOn: false, a: 0, l: 0, b: 0, rel: 0, relCharge: 0, bDown: false, aDown: false }); ptrs.clear(); }

function startSolo() {
  const custom = ME?.fav_team === 'PERSO' && COL;
  const t0 = teamIdx(ME?.fav_team || 'PSG'); let t1 = Math.floor(Math.random() * TEAMS.length); if (!custom && t1 === t0) t1 = (t1 + 1) % TEAMS.length;
  const cfg = { teams: [custom ? customTeam(COL.team) : TEAMS[t0], TEAMS[t1]], dur: SET.soloDur || 180, diff: SET.diff ?? 1 };
  beginGame({ cfg, side: 0, online: false, names: [ME?.display || 'Toi', 'Ordi'] });
}
function startOnline(cfg, side) {
  beginGame({ cfg, side, online: true, names: cfg.names, uids: cfg.uids });
}
/** Match à plusieurs : slot = quel humain je suis, side = mon équipe */
function startMulti(cfg, slot) {
  beginGame({ cfg, side: cfg.slots[slot], slot, host: slot === 0, online: true, multi: true, names: cfg.names, uids: cfg.uids });
}
function beginGame({ cfg, side, online, names, uids, slot = side, host = side === 0, multi = false }) {
  resetLocalInput();
  const slots = multi ? cfg.slots : online ? [0, 1] : [0];
  const humans = multi ? slots.map(() => true) : [true, online];
  const M = metaOf(cfg, humans, names);
  const g = {
    cfg, side, slot, host, multi, slots, online, M, names, uids, V: null, parts: [], lastEv: 0, localCharge: 0, net: ROOM?.linkInfo(),
    remotes: [], prevs: slots.map(() => ({ a: 0, l: 0, b: 0, r: 0 })), prevL: { a: 0, l: 0, b: 0, r: 0 }, snaps: [], lastSnapAt: performance.now(),
    acc: 0, tick: 0, sentAt: 0, lastSent: '', done: false, peerGoneAt: 0, endData: null,
  };
  if (host) g.G = createMatch({ teams: M.team, dur: cfg.dur, humans, slots, diff: cfg.diff ?? 1 });
  g.onSnap = d => { const now = performance.now(); const dtA = now - g.lastSnapAt; if (dtA > 0 && dtA < 400) { g.ia = g.ia ? g.ia * .9 + dtA * .1 : dtA; g.jit = (g.jit || 0) * .9 + Math.abs(dtA - g.ia) * .1; } g.lastSnapAt = now; if (g.snaps.length && d.q <= g.snaps[g.snaps.length - 1].q) return; g.snaps.push({ at: now, q: d.q, s: d.s }); if (g.snaps.length > 30) g.snaps.shift(); };
  g.onEnd = d => { if (!g.done) finishGame(d); };
  g.forfeit = (iWin, msg) => {
    if (g.done) return;
    if (multi) { finishGame({ forfeit: true, msg, score: g.V?.sc || [0, 0] }); return; } // à plusieurs : on garde le score
    const sc = iWin ? [3, 0] : [0, 3]; finishGame({ forfeit: true, msg, score: side === 0 ? sc : [sc[1], sc[0]] });
  };
  g.rec = createRecorder();
  GAME = g; R.me = side; R.slot = slot; audio(); crowdStart();
  show('game'); $('#menu').hidden = true;
  R.resize(); requestAnimationFrame(() => R.resize());
  keepAwake();
}
addEventListener('resize', () => { if (GAME) R.resize(); });
screen.orientation?.addEventListener?.('change', () => setTimeout(() => GAME && R.resize(), 200));

function interp(snaps, now) {
  if (!snaps.length) return null;
  // délai d'interpolation adaptatif : juste ce qu'il faut selon la régularité du réseau (moins de latence)
  const base = GAME.net?.mode === 'p2p' ? 33 : 50, delay = Math.max(34, Math.min(130, (GAME.ia || base) * 1.15 + (GAME.jit || 8) * 2.2 + 6));
  const t = now - delay;
  let a = null, b = null;
  for (let i = snaps.length - 1; i >= 0; i--) { if (snaps[i].at <= t) { a = snaps[i]; b = snaps[i + 1]; break; } }
  if (!a) return snaps[0].s;
  if (!b) return a.s;
  const k = clamp((t - a.at) / (b.at - a.at || 1), 0, 1), A = a.s, B = b.s;
  const lerp = (x, y) => x + (y - x) * k;
  return { ...B, p: B.p.map((p, i) => [lerp(A.p[i][0], p[0]), lerp(A.p[i][1], p[1]), p[2], p[3], p[4], p[5] || 0]),
    b: [lerp(A.b[0], B.b[0]), lerp(A.b[1], B.b[1]), B.b[2], B.b[3], B.b[4], lerp(A.b[5] || 0, B.b[5] || 0), B.b[6] ?? -1, B.b[7] ?? -1, B.b[8] ?? 0], tm: lerp(A.tm, B.tm) };
}

/* Ralenti du but : on garde les ~2,3 s avant le but et on les rejoue pendant la pause (2,8 s + coup d'envoi) */
const RP_DELAY = 900, RP_SPEED = .62;
function startReplay(g, now) {
  if (!SET.replay) return;
  const fr = (g.hist || []).filter(h => now - h.at <= 2300);
  if (fr.length < 8) return;
  g.replay = { frames: fr.slice(), t0: fr[0].at, goalAt: now, start: now + RP_DELAY, dur: (fr[fr.length - 1].at - fr[0].at) / RP_SPEED };
}
function stopReplay(g) { if (g) g.replay = null; }
function replayFrame(g, now) {
  const r = g.replay; if (!r) return null;
  if (now < r.start) return null;
  const k = now - r.start;
  if (k > r.dur || (g.V && g.V.st === 'play')) { g.replay = null; return null; }
  const t = r.t0 + k * RP_SPEED, F = r.frames;
  let i = 0; while (i < F.length - 1 && F[i + 1].at <= t) i++;
  const V = F[i].V;
  return { ...V, sc: g.V?.sc || V.sc, ev: [], bn: null, rp: Math.min(1, k / 250, (r.dur - k) / 250) };
}
let last = performance.now();
const STEP = 1 / 60;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  pollPad(now);
  const g = GAME;
  if (g && !g.done) {
    LI.aFlash = Math.max(0, LI.aFlash - dt);
    const mine = localWorldInput();
    const paused = !$('#menu').hidden && !g.online;
    if (g.host) {
      // Hôte (ou solo) : fait tourner la simulation
      const peerMissing = g.online && !g.multi && !ROOM?.peer;
      if (peerMissing) { g.peerGoneAt ||= now; if (now - g.peerGoneAt > 15000) g.forfeit(true, 'Ton adversaire s\'est déconnecté.'); }
      else g.peerGoneAt = 0;
      if (!paused && !peerMissing) {
        g.acc += dt;
        while (g.acc >= STEP) {
          step(g.G, g.slots.map((t, s) => s === g.slot ? toEngine(mine, g.prevL) : slotGone(g, s) ? { off: true } : toEngine(g.remotes[s], g.prevs[s])), STEP);
          g.acc -= STEP; g.tick++;
          if (g.online && g.tick % (ROOM.mode === 'p2p' ? 2 : 3) === 0) ROOM.send('s', { q: g.tick, s: snapshot(g.G) }, true);
        }
      }
      g.V = snapshot(g.G);
      if (g.G.ended && !g.done) {
        const sum = summary(g.G);
        if (g.online) { ROOM.send('end', sum); setTimeout(() => ROOM?.send('end', sum), 400); }
        finishGame(sum);
      }
    } else {
      // Invité : envoie ses entrées, affiche l'état reçu
      const key = JSON.stringify([+mine.jx.toFixed(2), +mine.jy.toFixed(2), +mine.m.toFixed(2), mine.a, mine.l, mine.b, mine.d, mine.r]);
      if (key !== g.lastSent || now - g.sentAt > 60) { ROOM?.send('i', { ...mine, s: g.slot }, true); g.lastSent = key; g.sentAt = now; }
      g.V = interp(g.snaps, now) || g.V;
      predictOwn(g, mine, dt, now, ROOM?.rtt);
      if (now - g.lastSnapAt > 15000 && !ROOM?.peer) g.forfeit(true, g.multi ? 'L\'hôte s\'est déconnecté : match arrêté.' : 'Ton adversaire s\'est déconnecté.');
      if (g.V?.end && !g.endTimer) g.endTimer = setTimeout(() => { if (!g.done) finishGame({ score: g.V.sc, partial: true }); }, 3000);
    }
    if (g.V) g.rec?.push(g.V, now); // enregistrement du replay
    // Historique des 3 dernières secondes (pour le ralenti des buts)
    if (g.V) { (g.hist ||= []).push({ at: now, V: g.V }); while (g.hist.length && now - g.hist[0].at > 4200) g.hist.shift(); }
    // Ambiance : la foule monte quand le ballon approche d'un but
    if (g.V) crowdLevel(1 - Math.min(g.V.b[1], FL - g.V.b[1]) / 30);
    // Charge du tir affichée localement
    if (g.V) {
      const hasBall = g.V.b[3] >= 0 && g.V.b[3] === g.V.c[g.slot];
      g.localCharge = LI.bDown && hasBall ? Math.min(1, g.localCharge + dt / .85) : LI.bDown ? g.localCharge : 0;
      // Sons et effets à partir des événements
      for (const [s, type, val] of g.V.ev || []) {
        if (s <= g.lastEv) continue;
        g.lastEv = s; playEvent(type, val);
        if (type === 'goal') { g.parts.push(...R.goalBurst(val, g.M)); startReplay(g, now); }
        if (type === 'bicycle' || type === 'volley') g.parts.push(...R.burstAt(g.V, g.M));
        if (type === 'kick' && val >= 1.1) g.parts.push(...R.grassAt(g.V));
      }
    }
    for (const q of g.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; q.rot += dt * 6; q.life -= dt; }
    g.parts = g.parts.filter(q => q.life > 0);
    let overlay = null;
    if (g.online && !g.host && now - g.lastSnapAt > 2500) overlay = 'Connexion perdue… reconnexion';
    if (g.online && !g.multi && g.host && !ROOM?.peer) overlay = `${g.names[1]} s'est déconnecté… ${Math.max(0, 15 - Math.floor((now - g.peerGoneAt) / 1000))} s`;
    if (g.online && !g.host && !ROOM?.peer && g.V) overlay = g.multi ? `${g.cfg.pn?.[0] || 'L\'hôte'} s'est déconnecté…` : `${g.names[0]} s'est déconnecté…`;
    const net = g.online && g.net ? { ok: g.net.ok, label: g.net.mode === 'p2p' ? `DIRECT ${g.net.rtt || ''}ms` : `RELAIS ${g.net.rtt || ''}ms` } : null;
    const rp = replayFrame(g, now);
    if (SET.saver && (g.fr = (g.fr || 0) + 1) % 2) { requestAnimationFrame(frame); return; } // économie : 30 images/s
    R.draw(rp || g.V, g.M, { me: g.side, slot: g.slot, replay: !!rp, input: LI, pad: PAD.on ? padLabels() : null, localCharge: g.localCharge, parts: g.parts, overlay, net });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* Menu pendant le match */
function soundLabel() { const b = $('#bSound'); if (b) b.textContent = soundOn() ? 'Son : activé' : 'Son : coupé'; }
$('#bSound')?.addEventListener('click', () => { setSound(!soundOn()); soundLabel(); });
function openMenu() { soundLabel(); $('#menu').hidden = false; $('#bQuit').textContent = GAME?.online ? 'Abandonner le match' : 'Quitter l\'entraînement'; }
$('#bResume').addEventListener('click', () => { $('#menu').hidden = true; });
$('#bFull').addEventListener('click', () => { goFull(); $('#menu').hidden = true; });
$('#bQuit').addEventListener('click', () => {
  $('#menu').hidden = true;
  if (!GAME) return;
  if (GAME.online) { ROOM?.send('quit', { host: GAME.host, s: GAME.slot }); GAME.forfeit(false, GAME.multi ? 'Tu as quitté le match.' : 'Tu as abandonné le match.'); }
  else { stopReplay(GAME); crowdStop(); GAME = null; renderHome(); show('home'); }
});

/* ---------- Fin du match ---------- */
function noteOf(p, score) {
  const t = p.t, gf = score[t], ga = score[1 - t];
  let n = 6.1 + p.st.but * 1.1 + p.st.vol * .35 + p.st.tir * .12 + p.st.pas * .04 + (gf > ga ? .4 : gf < ga ? -.25 : 0);
  if (p.gk) n += p.st.arr * .45 - ga * .35 + (ga === 0 ? .6 : 0);
  return clamp(Math.round(n * 10) / 10, 3.5, 10);
}
async function finishGame(sum) {
  const g = GAME; if (!g || g.done) return;
  g.done = true; clearTimeout(g.endTimer); stopReplay(g); crowdStop();
  try { wake?.release(); } catch { }
  if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  const me = g.side, op = 1 - me, M = g.M, sc = sum.score || [0, 0];
  const myS = sc[me], opS = sc[op];
  // Enregistrement du résultat (chacun enregistre le sien)
  let rating = null;
  if (g.multi && ME) {
    // match à plusieurs : pas de classement, des pièces comme contre l'ordi
    if (!sum.forfeit || g.host) { const { data, error } = await sb.rpc('reward_solo', { p_my_score: myS, p_opp_score: opS }); if (!error && data) { g.solo = data.reward; if (COL) COL.coins = data.coins; } else if (error && /too_soon/.test(error.message || '')) g.solo = -1; }
  } else if (g.online && g.uids && ME) {
    const { data, error } = await sb.rpc('report_match', {
      p_room: String(g.cfg.mid || `${LOB?.code}-${Date.now() % 1e6}`).slice(0, 12), p_opponent: g.uids[op],
      p_my_team: M.team[me].short, p_opp_team: M.team[op].short, p_my_score: myS, p_opp_score: opS, p_is_home: me === 0,
    });
    if (!error && data) { rating = { before: ME.rating, after: data.rating, coins: myS > opS ? 500 : myS === opS ? 250 : 120 }; rating.coins += 60 * Math.min(myS, 10); ME = data; loadCollection(); }
  } else if (!g.online && ME && !sum.forfeit) {
    // Entraînement contre l'ordi : petite récompense en pièces (moins qu'en ligne)
    const { data, error } = await sb.rpc('reward_solo', { p_my_score: myS, p_opp_score: opS });
    if (!error && data) { g.solo = data.reward; if (COL) COL.coins = data.coins; }
    else if (error && /too_soon/.test(error.message || '')) g.solo = -1;
  }
  renderEnd(g, sum, rating);
  GAME = null;
  if (LOB) { LOB.ready = false; ROOM?.setState({ ready: false }); }
  show('end');
}
function renderEnd(g, sum, rating) {
  const me = g.side, op = 1 - me, M = g.M, sc = sum.score || [0, 0];
  const myS = sc[me], opS = sc[op], res = myS > opS ? 'w' : myS < opS ? 'l' : 'd';
  const goals = t => { const l = (sum.scorers || []).filter(x => x.t === t); return l.length ? l.map(x => `<li><b>${esc(x.name)}</b>${x.own ? ' (csc)' : ''} <span>${x.min}'</span></li>`).join('') : '<li class="muted">—</li>'; };
  $('#endBoard').innerHTML = `<div class="sboard" style="--k0:${M.kit[me].c1};--k1:${M.kit[op].c1}">
    <div class="sb-top"><span>${g.multi ? 'Match à plusieurs' : g.online ? 'Match en ligne' : 'Entraînement'}</span><b>${sum.forfeit ? 'Abandon' : "Terminé · 90'"}</b></div>
    <div class="sb-row">
      <div class="side"><div class="shirt">${shirtSVG(M.kit[me])}</div><b>${esc(M.team[me].name)}</b><small>${esc(g.names[me])}</small></div>
      <div class="sc">${myS}<i>–</i>${opS}</div>
      <div class="side"><div class="shirt">${shirtSVG(M.kit[op])}</div><b>${esc(M.team[op].name)}</b><small>${esc(g.names[op])}</small></div>
    </div>
    ${sum.players && sum.scorers?.length ? `<div class="sb-goals"><ul>${goals(me)}</ul><ul>${goals(op)}</ul></div>` : ''}
  </div>
  <div class="verdict ${res}">${res === 'w' ? 'Victoire !' : res === 'l' ? 'Défaite' : 'Match nul'}</div>${sum.msg ? `<p class="hint">${esc(sum.msg)}</p>` : ''}`;
  $('#endRating').innerHTML = rating ? `<div class="rating"><span>Classement</span><b>${rating.after}</b><span class="d ${rating.after >= rating.before ? 'up' : 'down'}">${rating.after >= rating.before ? '+' : ''}${rating.after - rating.before}</span><span class="coins" style="margin-left:auto">+${rating.coins}</span></div>` : g.online && !g.multi ? '' : g.solo > 0 ? `<div class="rating"><span>${g.multi ? 'Match à plusieurs' : 'Entraînement'}</span><b style="font-size:1rem">Pièces gagnées</b><span class="coins" style="margin-left:auto">+${g.solo}</span></div><p class="hint">${g.multi ? 'Les matchs à plusieurs rapportent des pièces mais ne comptent pas au classement.' : 'Contre l\'ordi : moins de pièces qu\'en ligne, et le classement ne bouge pas.'}</p>` : g.solo === -1 ? '<p class="hint">Match trop court pour gagner des pièces. Contre l\'ordi, les pièces arrivent après un vrai match.</p>' : '<p class="hint">Les matchs d\'entraînement ne comptent pas au classement.</p>';
  if (sum.players) {
    const P = sum.players.map(p => ({ ...p, n: noteOf(p, sc) }));
    const mvp = P.slice().sort((a, b) => b.n - a.n)[0], mc = mvp.gk ? '#2dd4a0' : M.kit[mvp.t].c1;
    $('#endMvp').innerHTML = `<div class="mvp"><div class="mvp-tag">Homme du match</div><div class="mvp-body"><div class="mvp-no" style="background:${mc};color:${pickText(mc)}">${mvp.num}</div><div style="min-width:0"><b>${esc(mvp.name)}</b><span>${esc(M.team[mvp.t].name)} · ${POS[mvp.i]} · ${mvp.st.but} but${mvp.st.but > 1 ? 's' : ''}</span></div><div class="mvp-note">${mvp.n.toFixed(1)}</div></div></div>`;
    const S = sum.stats, pt = S.poss[0] + S.poss[1] || 1, poss = [Math.round(S.poss[0] / pt * 100), 0]; poss[1] = 100 - poss[0];
    const tot = (t, k) => P.filter(p => p.t === t).reduce((a, p) => a + p.st[k], 0);
    const row = (lab, a, b) => { const s = a + b || 1; return `<div class="srow"><span>${a}</span><div class="mid">${lab}<i><b style="width:${a / s * 100}%;background:${M.kit[me].c1}"></b><b style="width:${b / s * 100}%;background:${M.kit[op].c1}"></b></i></div><span>${b}</span></div>`; };
    $('#endStats').innerHTML = row('Possession %', poss[me], poss[op]) + row('Tirs', S.shots[me], S.shots[op]) + row('Tirs cadrés', S.onT[me], S.onT[op]) + row('Passes', tot(me, 'pas'), tot(op, 'pas')) + row('Ballons volés', tot(me, 'vol'), tot(op, 'vol'));
    $('#endLineups').innerHTML = [me, op].map(t => `<div class="lu"><h3>${esc(M.team[t].short)}</h3>${P.filter(p => p.t === t).map(p => { const c = p.gk ? '#2dd4a0' : M.kit[t].c1; return `<div class="pl"><span class="no" style="background:${c};color:${pickText(c)}">${p.num}</span><span class="pn">${esc(p.name)} <small>${POS[p.i]}${p.st.but ? ' · ' + p.st.but + ' but' + (p.st.but > 1 ? 's' : '') : ''}</small></span><b class="note ${p.n >= 8 ? 'hi' : p.n < 5.5 ? 'lo' : ''}">${p.n.toFixed(1)}</b></div>`; }).join('')}</div>`).join('');
    $('#endStats').hidden = false;
  } else { $('#endMvp').innerHTML = ''; $('#endStats').hidden = true; $('#endLineups').innerHTML = ''; }
  const acts = $('#endActions'); acts.innerHTML = '';
  const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = txt; b.onclick = fn; acts.appendChild(b); return b; };
  if (g.online && ROOM && !sum.forfeit) mk(g.multi ? 'Retour à la salle' : 'Revanche', 'primary', () => { if (LOB?.multi) { renderTLobby(); show('tlobby'); } else { renderLobby(); show('lobby'); } });
  if (!g.online) mk('Rejouer', 'primary', () => startSolo());
  if (g.online) mk('Ouvrir des packs', '', async () => { if (ROOM) { const r = ROOM; ROOM = null; LOB = null; await r.leave(); } await loadCollection(); openShop(); });
  mk('Retour à l\'accueil', '', async () => { if (ROOM) await leaveRoom(); else { ME = await loadProfile() || ME; renderHome(); show('home'); } });
  // Replay du match : revoir, sauvegarder, envoyer à un ami
  const rec = g.rec;
  if (rec && rec.frames > 30) {
    const title = `${M.team[0].short} ${sc[0]}–${sc[1]} ${M.team[1].short}${g.online ? '' : ' (ordi)'}`.slice(0, 80);
    const meta = { team: M.team.map(t => ({ name: t.name, short: t.short, h: t.h, c1: t.c1, c2: t.c2 })), kit: M.kit, players: M.players.map(p => ({ t: p.t, i: p.i, gk: p.gk, num: p.num, name: p.name })), names: g.names, dur: M.dur, score: sc };
    mk('▶ Revoir le match', '', async () => openReplay({ data: await encode(rec.data()), meta, title }));
    const sv = mk('💾 Sauvegarder le replay', '', async () => {
      sv.disabled = true; sv.textContent = 'Sauvegarde…';
      const r = await saveReplay(rec, meta, title);
      if (!r) { sv.disabled = false; sv.textContent = '💾 Sauvegarder le replay'; return; }
      sv.textContent = '✓ Replay sauvegardé';
      if (friendsList().length) { const sh = mk('📤 Envoyer à un ami', '', () => shareReplayPicker(r.id, title, sh)); }
    });
  }
}

/* ---------- Démarrage ---------- */
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await afterLogin(); else show('auth');
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { ME = null; show('auth'); } });
})();
window.__fdp = { get GAME() { return GAME; }, startSolo };
