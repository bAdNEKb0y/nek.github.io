/* Partage : lien public d'un match (avec message), page « regarde ce match » + pub du jeu + tuto d'installation, QR code d'ami */
import { sb } from './net.js';
import { $, esc } from './ui.js';
import { openReplay } from './replay.js';
import { isIOS, isStandalone } from './push.js';

const APP = location.origin + location.pathname.replace(/[^/]*$/, '');
let H = null;
export function initShare(h) { H = h; }
export const matchLink = id => `${APP}?match=${id}`;
export const friendLink = name => `${APP}?ami=${encodeURIComponent(name)}`;

/* ---------- Partager un match ---------- */
/** id = replay déjà sauvegardé ; on le rend visible par lien puis on ouvre la feuille de partage */
export async function shareMatch(id, title) {
  const { error } = await sb.rpc('share_replay_public', { p_id: id });
  if (error) { H.toast('Partage impossible. Réessaie.'); return; }
  openShare(id, title);
}
function openShare(id, title) {
  const el = $('#shareov'), url = matchLink(id);
  const msg = `⚽ Regarde mon match sur Foot de Poche : ${title} ! 🔥`;
  el.hidden = false;
  el.innerHTML = `<div class="box shbox" role="dialog" aria-label="Partager le match">
    <div class="cardhead"><h2>📤 Partager le match</h2><button class="link" data-x="close">Fermer</button></div>
    <label class="lbl" for="shMsg">Ton message</label>
    <textarea id="shMsg" maxlength="200" rows="3">${esc(msg)}</textarea>
    <div class="shlink"><span>${esc(url)}</span></div>
    <div class="shbtns">
      ${navigator.share ? '<button class="btn primary" data-x="native">📤 Partager…</button>' : ''}
      <a class="btn" data-x="wa" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn" data-x="sms">SMS</a>
      <button class="btn" data-x="copy">🔗 Copier</button>
    </div>
    <p class="hint">Tout le monde peut regarder le match avec ce lien, même sans compte.</p></div>`;
  const ta = el.querySelector('#shMsg'), full = () => `${ta.value.trim()}\n${url}`;
  const upd = () => { el.querySelector('[data-x=wa]').href = `https://wa.me/?text=${encodeURIComponent(full())}`; el.querySelector('[data-x=sms]').href = `sms:${isIOS() ? '&' : '?'}body=${encodeURIComponent(full())}`; };
  ta.oninput = upd; upd();
  el.querySelector('[data-x=close]').onclick = closeShare;
  el.onclick = e => { if (e.target === el) closeShare(); };
  const nb = el.querySelector('[data-x=native]');
  if (nb) nb.onclick = async () => { try { await navigator.share({ title: 'Foot de Poche', text: ta.value.trim(), url }); } catch { } };
  el.querySelector('[data-x=copy]').onclick = async () => { try { await navigator.clipboard.writeText(full()); H.toast('Message et lien copiés ✓'); } catch { ta.select(); H.toast('Copie le texte à la main.'); } };
}
export function closeShare() { const el = $('#shareov'); el.hidden = true; el.innerHTML = ''; }

/* ---------- Page d'un match partagé (sans compte) ---------- */
export async function showWatch(id, { loggedIn, onPlay }) {
  const el = $('#watch');
  el.innerHTML = `<div class="wwrap"><header class="topbar"><div class="logo">FOOT <span>DE POCHE</span></div></header><p class="muted">Chargement du match…</p></div>`;
  const { data } = await sb.rpc('public_replay', { p_id: id });
  const ok = data && data.data;
  el.innerHTML = `<div class="wwrap">
    <header class="topbar"><div class="logo">FOOT <span>DE POCHE</span></div><button class="btn small primary" data-x="play">${loggedIn ? 'Ouvrir le jeu' : 'Jouer gratuitement'}</button></header>
    <section class="wmatch card">${ok ? `<small class="kicker">Match partagé par ${esc(data.by || 'un joueur')}</small><h1 class="wtitle">${esc(data.title)}</h1>
      <small class="muted">${new Date(data.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</small>
      <button class="btn primary big" data-x="watch">▶ Regarder le match</button>` : '<h1 class="wtitle">Match introuvable</h1><p class="muted">Ce lien ne marche plus : le replay a peut-être été supprimé.</p>'}</section>
    <section class="wpub" aria-label="Publicité Foot de Poche">
      <span class="wad">PUB</span>
      <div class="wpub-in"><b>⚽ Foot de Poche</b><p>Le foot 5 contre 5 à jouer en ligne avec tes potes, sur téléphone et tablette. <b>Gratuit</b>, sans rien télécharger.</p>
        <ul><li>🏆 Matchs en ligne, classement et défis entre amis</li><li>🃏 Packs de cartes, légendes et ultimes à collectionner</li><li>👥 Jusqu'à 8 joueurs : 2 contre 2, 3 contre 3…</li><li>🎁 Cadeau chaque jour et réactions animées à débloquer</li></ul>
        <button class="btn primary" data-x="play2">${loggedIn ? 'Ouvrir le jeu' : 'Créer mon compte'}</button></div>
    </section>
    ${installHTML()}
  </div>`;
  if (ok) el.querySelector('[data-x=watch]').onclick = () => openReplay({ data: data.data, meta: data.meta, title: data.title });
  el.querySelector('[data-x=play]').onclick = onPlay; el.querySelector('[data-x=play2]').onclick = onPlay;
  bindInstall(el);
}

/* ---------- Tuto : installer le jeu comme une appli ---------- */
export function installHTML() {
  const tab = isIOS() ? 'ios' : 'android';
  return `<section class="winstall card" aria-label="Installer l'appli">
    <h2>📲 Installer Foot de Poche comme une appli</h2>
    ${isStandalone() ? '<p class="okinst">✅ C\'est déjà installé sur cet appareil !</p>' : ''}
    <div class="seg itabs" role="tablist"><button role="tab" data-it="ios" aria-selected="${tab === 'ios'}">iPhone / iPad</button><button role="tab" data-it="android" aria-selected="${tab === 'android'}">Android</button></div>
    <ol class="isteps" data-is="ios" ${tab === 'ios' ? '' : 'hidden'}>
      <li><span class="ino">1</span><div>Ouvre ce lien dans <b>Safari</b> (pas dans WhatsApp ou Instagram : touche « Ouvrir dans Safari »).</div></li>
      <li><span class="ino">2</span><div>Touche le bouton <b>Partager</b> <span class="iico">⬆️</span> en bas de l'écran (en haut sur iPad).</div></li>
      <li><span class="ino">3</span><div>Fais défiler et touche <b>« Sur l'écran d'accueil »</b> <span class="iico">➕</span>.</div></li>
      <li><span class="ino">4</span><div>Touche <b>Ajouter</b>. L'icône Foot de Poche apparaît avec tes applis : ouvre le jeu depuis l'icône, en plein écran, avec les notifications.</div></li>
    </ol>
    <ol class="isteps" data-is="android" ${tab === 'android' ? '' : 'hidden'}>
      <li><span class="ino">1</span><div>Ouvre ce lien dans <b>Chrome</b>.</div></li>
      <li><span class="ino">2</span><div>Touche le menu <b>⋮</b> en haut à droite.</div></li>
      <li><span class="ino">3</span><div>Touche <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</div></li>
      <li><span class="ino">4</span><div>Confirme : l'icône Foot de Poche apparaît avec tes applis.</div></li>
    </ol>
    ${DEFER ? '<button class="btn primary" data-x="pwa">📲 Installer maintenant</button>' : ''}
  </section>`;
}
let DEFER = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); DEFER = e; });
export function bindInstall(root) {
  root.querySelectorAll('[data-it]').forEach(b => b.onclick = () => {
    root.querySelectorAll('[data-it]').forEach(x => x.setAttribute('aria-selected', x === b));
    root.querySelectorAll('[data-is]').forEach(x => x.hidden = x.dataset.is !== b.dataset.it);
  });
  const p = root.querySelector('[data-x=pwa]'); if (p) p.onclick = async () => { DEFER?.prompt(); DEFER = null; p.remove(); };
}

/* ---------- QR code d'ami ---------- */
let QRLIB = null, JSQR = null, SCAN = null;
async function qrSVG(text) {
  QRLIB ||= (await import('./vendor/qrcode.js')).default;
  const q = QRLIB(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#0b1411"/></svg>`;
}
export async function openQR(me) {
  const el = $('#qrov'), name = me.username || me.display, url = friendLink(name);
  el.hidden = false;
  el.innerHTML = `<div class="box qrbox" role="dialog" aria-label="QR code d'ami">
    <div class="cardhead"><h2>📷 Ajouter avec un QR code</h2><button class="link" data-x="close">Fermer</button></div>
    <div class="qrtabs seg"><button data-q="mine" aria-selected="true">Mon QR code</button><button data-q="scan" aria-selected="false">Scanner</button></div>
    <div class="qrpane" data-p="mine"><div class="qrimg"><p class="muted">Création du QR code…</p></div>
      <p class="qrname">${esc(me.display)}</p>
      <p class="hint">Ton ami le scanne avec l'appareil photo de son téléphone (ou le bouton « Scanner » du jeu) : il t'envoie une demande d'ami.</p>
      <div class="shbtns">${navigator.share ? '<button class="btn" data-x="sharelink">📤 Envoyer mon lien</button>' : ''}<button class="btn" data-x="copylink">🔗 Copier mon lien</button></div></div>
    <div class="qrpane" data-p="scan" hidden><div class="qrcam"><video playsinline muted></video><div class="qrframe"></div></div>
      <p class="hint qrstatus">Vise le QR code de ton ami.</p></div></div>`;
  el.querySelector('[data-x=close]').onclick = closeQR;
  el.onclick = e => { if (e.target === el) closeQR(); };
  el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    el.querySelectorAll('[data-q]').forEach(x => x.setAttribute('aria-selected', x === b));
    el.querySelectorAll('[data-p]').forEach(x => x.hidden = x.dataset.p !== b.dataset.q);
    if (b.dataset.q === 'scan') startScan(el); else stopScan();
  });
  const sl = el.querySelector('[data-x=sharelink]'); if (sl) sl.onclick = async () => { try { await navigator.share({ title: 'Foot de Poche', text: `Ajoute-moi en ami sur Foot de Poche : ${me.display} ⚽`, url }); } catch { } };
  el.querySelector('[data-x=copylink]').onclick = async () => { try { await navigator.clipboard.writeText(url); H.toast('Lien copié ✓'); } catch { H.toast(url); } };
  try { el.querySelector('.qrimg').innerHTML = await qrSVG(url); } catch { el.querySelector('.qrimg').innerHTML = `<p class="hint">QR code indisponible (pas de connexion ?). Envoie plutôt ton lien.</p>`; }
}
export function closeQR() { stopScan(); const el = $('#qrov'); el.hidden = true; el.innerHTML = ''; }
async function startScan(el) {
  const st = el.querySelector('.qrstatus'), video = el.querySelector('video');
  if (!navigator.mediaDevices?.getUserMedia) { st.textContent = 'La caméra n\'est pas disponible ici. Utilise l\'appareil photo du téléphone.'; return; }
  try {
    JSQR ||= (await import('./vendor/jsqr.js')).default;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream; await video.play();
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d', { willReadFrequently: true });
    SCAN = { stream, raf: 0 };
    const tick = () => {
      if (!SCAN) return;
      if (video.videoWidth) {
        const w = 320, h = Math.round(video.videoHeight / video.videoWidth * w); cv.width = w; cv.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const code = JSQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        const name = code?.data && friendFromUrl(code.data);
        if (name) { stopScan(); closeQR(); H.onFriendCode(name); return; }
        if (code?.data) st.textContent = 'Ce QR code n\'est pas un code d\'ami Foot de Poche.';
      }
      SCAN.raf = requestAnimationFrame(tick);
    };
    tick();
  } catch { st.textContent = 'Caméra refusée. Autorise la caméra dans les réglages, ou scanne avec l\'appareil photo du téléphone.'; }
}
function stopScan() { if (!SCAN) return; cancelAnimationFrame(SCAN.raf); SCAN.stream.getTracks().forEach(t => t.stop()); SCAN = null; }
/** Lit le pseudo dans un lien d'ami (…?ami=Pseudo) */
export function friendFromUrl(u) { try { const x = new URL(u); return x.searchParams.get('ami') || null; } catch { return null; } }
