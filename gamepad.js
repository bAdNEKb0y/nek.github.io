/* Manette (Xbox, PlayStation, Switch Pro, manettes Bluetooth/USB) via l'API Gamepad.
   Détection automatique : dès qu'on appuie sur un bouton, la manette est reconnue.
   En match : stick gauche / croix = déplacement, A = passe (appui long = en l'air), X = passe en l'air,
   B = tir / tacle, LB/Y = changer de joueur, Start = menu.
   Dans les menus : stick / croix pour se déplacer, A pour valider, B pour revenir. */

const DZ = .2;
const S = { idx: -1, prev: [], navT: 0, navDir: '', name: '', last: 0 };
let H = null; // callbacks fournis par app.js

export const PAD = { on: false, x: 0, y: 0, name: '', type: 'xbox' };

function kind(id) {
  const s = id.toLowerCase();
  if (/xbox|xinput|045e/.test(s)) return 'xbox';
  if (/054c|playstation|dualsense|dualshock|wireless controller/.test(s)) return 'ps';
  if (/057e|nintendo|switch|pro controller|joy-con/.test(s)) return 'nin';
  return 'xbox';
}
/** Libellés des boutons selon la marque de la manette */
export function padLabels() {
  return PAD.type === 'ps' ? { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', ST: 'OPTIONS' }
    : PAD.type === 'nin' ? { A: 'B', B: 'A', X: 'Y', Y: 'X', LB: 'L', ST: '+' }
      : { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', ST: 'START' };
}

export function rumble(ms = 80, strong = .6, weak = .4) {
  try {
    const gp = navigator.getGamepads?.()[S.idx];
    gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch?.(() => { });
  } catch { }
}

export function initPad(handlers) {
  H = handlers;
  addEventListener('gamepadconnected', e => { pick(e.gamepad); });
  addEventListener('gamepaddisconnected', e => {
    if (e.gamepad.index !== S.idx) return;
    S.idx = -1; PAD.on = false; PAD.x = PAD.y = 0; S.prev = [];
    document.documentElement.classList.remove('pad');
    H?.onLeave?.();
  });
}
function pick(gp) {
  if (!gp || S.idx === gp.index) return;
  S.idx = gp.index; S.prev = gp.buttons.map(b => b.pressed);
  PAD.on = true; PAD.name = gp.id; PAD.type = kind(gp.id);
  document.documentElement.classList.add('pad');
  H?.onJoin?.(PAD);
  rumble(120, .5, .5);
}

const pressed = (gp, i) => !!gp.buttons[i]?.pressed;

/** À appeler à chaque image */
export function pollPad(now) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = S.idx >= 0 ? list[S.idx] : null;
  if (!gp) { // première manette où un bouton est appuyé
    for (const g of list) if (g && g.connected && g.buttons.some(b => b.pressed)) { pick(g); gp = g; break; }
    if (!gp) return;
  }
  if (!gp.connected) return;
  // Stick gauche avec zone morte radiale + croix directionnelle
  let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
  const m = Math.hypot(x, y);
  if (m < DZ) { x = 0; y = 0; } else { const k = Math.min(1, (m - DZ) / (1 - DZ)) / m; x *= k; y *= k; }
  if (pressed(gp, 14)) x = -1; if (pressed(gp, 15)) x = 1;
  if (pressed(gp, 12)) y = -1; if (pressed(gp, 13)) y = 1;
  const mm = Math.hypot(x, y); if (mm > 1) { x /= mm; y /= mm; }
  PAD.x = x; PAD.y = y;

  const cur = gp.buttons.map(b => b.pressed);
  const down = i => cur[i] && !S.prev[i], up = i => !cur[i] && S.prev[i];
  if (cur.some((c, i) => c !== S.prev[i])) S.last = now;
  const inGame = H?.inGame?.();
  if (inGame) {
    if (down(0)) H.aDown(); if (up(0)) H.aUp();
    if (down(1) || down(7)) H.bDown(); if ((up(1) && !cur[7]) || (up(7) && !cur[1])) H.bUp();
    if (down(2)) H.lob();
    if (down(3) || down(4)) H.swap();
    if (down(9) || down(8)) H.menu();
  } else {
    // Navigation dans les menus
    const dir = Math.abs(x) > .5 || Math.abs(y) > .5 ? (Math.abs(x) > Math.abs(y) ? (x > 0 ? 'r' : 'l') : (y > 0 ? 'd' : 'u')) : '';
    if (dir && (dir !== S.navDir || now - S.navT > (S.navRep ? 140 : 380))) { S.navRep = dir === S.navDir; S.navDir = dir; S.navT = now; navigate(dir); }
    if (!dir) { S.navDir = ''; S.navRep = false; }
    if (down(0)) activate();
    if (down(1)) H?.back?.();
    if (down(9)) H?.start?.();
  }
  S.prev = cur;
}

/* ---------- Navigation au focus dans les écrans HTML ---------- */
const SEL = 'button:not([disabled]),input:not([disabled]),[data-card],[tabindex]:not([tabindex="-1"]),a[href]';
function visible(el) {
  if (el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
  const st = getComputedStyle(el); return st.visibility !== 'hidden' && st.display !== 'none';
}
function scope() {
  // un calque ouvert (pack, sélection de joueur, tuto, menu) a la priorité
  for (const id of ['replay', 'trade', 'chat', 'profile', 'settings', 'ach', 'daily', 'shareov', 'qrov', 'tuto', 'pack', 'picker', 'menu']) { const o = document.getElementById(id); if (o && !o.hidden) return o; }
  return document.querySelector('.screen:not([hidden])') || document.body;
}
function items() { return [...scope().querySelectorAll(SEL)].filter(visible); }
function navigate(dir) {
  const list = items(); if (!list.length) return;
  let cur = document.activeElement;
  if (!list.includes(cur)) { focus(list[0]); return; }
  if (cur.type === 'range' && (dir === 'l' || dir === 'r')) { // curseur : gauche/droite change la valeur
    cur.value = +cur.value + (dir === 'r' ? 1 : -1) * (+cur.step || 1); cur.dispatchEvent(new Event('input', { bubbles: true })); return;
  }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    const main = dir === 'r' ? dx : dir === 'l' ? -dx : dir === 'd' ? dy : -dy;
    const side = dir === 'r' || dir === 'l' ? Math.abs(dy) : Math.abs(dx);
    if (main <= 4) continue;
    const s = main + side * 2.2;
    if (s < bs) { bs = s; best = el; }
  }
  if (best) focus(best);
}
function focus(el) {
  try { el.focus({ preventScroll: true }); } catch { el.focus(); }
  el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
}
function activate() {
  const el = document.activeElement;
  const l = items();
  if (!l.length) { scope().click(); return; } // ex. ouverture de pack : on touche l'écran
  if (!el || el === document.body || !l.includes(el)) { focus(l[0]); return; }
  if (el.tagName === 'INPUT') { el.blur(); el.focus(); return; }
  el.click();
}
