/* Rendu du match en paysage. Chaque joueur voit son équipe attaquer vers la droite. */
import { FW, FL, GH, GD, PR, BR, CX } from './engine.js';

const FD = "'Saira Extra Condensed','Arial Narrow',Impact,sans-serif";
const CHALK = '#eef3ea';
export const SIDE_COL = ['#ffc94a', '#5ad1e6'];
const GK_COL = ['#2dd4a0', '#b07cff'];

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function pickText(h) { const [r, g, b] = hexRgb(h); return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0b1411' : '#ffffff'; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const R = { W: 0, H: 0, DPR: 1, S: 5, OX: 0, OY: 0, me: 0, hud: 46 };

  // Monde -> écran (rotation de 90°, sens selon le camp du joueur)
  const sx = (x, y) => R.me === 0 ? R.OX + (FL - y) * R.S : R.OX + y * R.S;
  const sy = (x, y) => R.me === 0 ? R.OY + x * R.S : R.OY + (FW - x) * R.S;
  const sdir = (dx, dy) => R.me === 0 ? [-dy, dx] : [dy, -dx];
  /** Direction écran (joystick) -> direction terrain */
  R.toWorld = (u, v) => R.me === 0 ? [v, -u] : [-v, u];

  R.resize = () => {
    const r = canvas.getBoundingClientRect();
    R.W = Math.max(200, r.width); R.H = Math.max(160, r.height);
    R.DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(R.W * R.DPR); canvas.height = Math.round(R.H * R.DPR);
    R.hud = R.H < 420 ? 40 : 52;
    const availH = R.H - R.hud - 10, availW = R.W - 20;
    const fit = Math.min(availH / (FW + 5), availW / (FL + 2 * GD + 4));
    // Téléphone : on zoome (largeur du terrain remplie) et la caméra suit le ballon
    R.S = Math.max(fit, Math.min(availW / (FL + 2 * GD + 4), availH / (FW * .72)));
    R.OX = (R.W - FL * R.S) / 2;
    R.viewH = R.H - R.hud; R.follow = (FW + 6) * R.S > R.viewH;
    R.OY = R.hud + 4 + (availH - FW * R.S) / 2; R.camLat = FW / 2;
    const u = Math.min(R.W, R.H * 1.9);
    R.ctrl = {
      jx: Math.max(90, R.W * .12), jy: R.H - Math.max(86, R.H * .24), jr: clamp(u * .075, 44, 82),
      bx: R.W - Math.max(70, R.W * .075), by: R.H - Math.max(100, R.H * .3), br: clamp(u * .052, 34, 60),
      ax: R.W - Math.max(150, R.W * .16), ay: R.H - Math.max(56, R.H * .14), ar: clamp(u * .043, 28, 50),
    };
  };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  /* Terrain + stade pré-dessinés une fois (rapide), puis copiés à chaque image */
  let PC = null, PCkey = '';
  function rnd32(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function buildPitch() {
    const S = R.S, STAND = 16; // profondeur des tribunes (unités terrain)
    const OY0 = (STAND + 3) * S, Hc = (FW + 2 * STAND + 6) * S, Wc = R.W;
    const cv = PC?.cv || document.createElement('canvas');
    cv.width = Math.round(Wc * R.DPR); cv.height = Math.round(Hc * R.DPR);
    const g = cv.getContext('2d'); g.setTransform(R.DPR, 0, 0, R.DPR, 0, 0);
    const rand = rnd32(7);
    // Tribunes : gradins + foule
    g.fillStyle = '#0d1512'; g.fillRect(0, 0, Wc, Hc);
    const top0 = 0, top1 = OY0 - 3 * S, bot0 = OY0 + (FW + 3) * S, bot1 = Hc;
    for (const [y0, y1, up] of [[top0, top1, true], [bot0, bot1, false]]) {
      const rows = Math.max(6, Math.floor((y1 - y0) / Math.max(5, S * 1.4)));
      const rh = (y1 - y0) / rows;
      for (let r = 0; r < rows; r++) {
        const yy = y0 + r * rh, shade = up ? r / rows : 1 - r / rows;
        g.fillStyle = `rgb(${18 + shade * 14},${26 + shade * 18},${24 + shade * 14})`; g.fillRect(0, yy, Wc, rh);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, yy + rh - 1, Wc, 1);
        const cols = ['#e8e2d6', '#f0776b', '#5ad1e6', '#ffc94a', '#2b2f3a', '#c9d3cf', '#8a5634', '#f1c9a5', '#1b1714'];
        for (let x = rand() * 4; x < Wc; x += Math.max(3, rh * .7) * (.8 + rand() * .6)) {
          if (rand() < .12) continue;
          g.fillStyle = cols[(rand() * cols.length) | 0]; g.globalAlpha = .35 + shade * .45;
          g.beginPath(); g.arc(x, yy + rh * .45, Math.max(1.1, rh * .26), 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
      }
    }
    // Projecteurs dans les angles du stade
    for (const lx of [R.OX - 8 * S, R.OX + (FL + 8) * S]) for (const ly of [top0 + (top1 - top0) * .3, bot0 + (bot1 - bot0) * .7]) {
      const gl = g.createRadialGradient(lx, ly, 1, lx, ly, 26 * S);
      gl.addColorStop(0, 'rgba(255,252,230,.55)'); gl.addColorStop(.12, 'rgba(255,248,215,.18)'); gl.addColorStop(1, 'rgba(255,248,215,0)');
      g.fillStyle = gl; g.fillRect(lx - 26 * S, ly - 26 * S, 52 * S, 52 * S);
      g.fillStyle = '#fffdf2'; for (let a = -1; a <= 1; a++) for (let b2 = 0; b2 < 2; b2++) { g.beginPath(); g.arc(lx + a * S * .9, ly + (b2 - .5) * S * .9, S * .35, 0, Math.PI * 2); g.fill(); }
    }
    // Panneaux publicitaires le long des touches
    const adH = Math.max(5, S * 1.3), ads = ['FOOT DE POCHE', 'PACK OPENING', 'EN DIRECT', 'MON ÉQUIPE'];
    for (const yb of [top1 - adH, bot0]) {
      let x = R.OX - (GD + 2) * S, k = 0; const seg = Math.max(120, S * 22);
      while (x < R.OX + (FL + GD + 2) * S) {
        g.fillStyle = k % 2 ? '#13201a' : '#1f6f42'; g.fillRect(x, yb, seg - 2, adH);
        g.fillStyle = k % 2 ? '#ffc94a' : '#eef3ea'; g.font = `800 ${adH * .72}px ${FD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(ads[k % ads.length], x + seg / 2, yb + adH / 2 + .5); x += seg; k++;
      }
    }
    // Pelouse : bandes de tonte + damier léger + bruit
    const x0 = R.OX - (GD + 2) * S, y0 = OY0 - 3 * S, w = (FL + 2 * GD + 4) * S, h = (FW + 6) * S;
    g.fillStyle = '#1b5c33'; g.fillRect(x0, y0, w, h);
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    for (let i = -1; i < 11; i++) { g.fillStyle = i % 2 ? '#24804e' : '#1f7144'; g.fillRect(R.OX + i * 10 * S, y0, 10 * S, h); }
    for (let j = 0; j < 7; j++) { g.fillStyle = j % 2 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.03)'; g.fillRect(x0, OY0 + (j * FW / 7) * S, w, FW / 7 * S); }
    for (let n = 0; n < w * h / 60; n++) { g.fillStyle = rand() < .5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; g.fillRect(x0 + rand() * w, y0 + rand() * h, 1.2, 1.2); }
    // éclairage des projecteurs
    const lg = g.createRadialGradient(R.OX + 50 * S, OY0 + CX * S, 10, R.OX + 50 * S, OY0 + CX * S, w * .62);
    lg.addColorStop(0, 'rgba(255,250,220,.08)'); lg.addColorStop(.6, 'rgba(0,0,0,.04)'); lg.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = lg; g.fillRect(x0, y0, w, h);
    g.restore();
    // Lignes
    g.strokeStyle = 'rgba(240,248,236,.85)'; g.lineWidth = Math.max(1.2, S * .3);
    g.strokeRect(R.OX, OY0, FL * S, FW * S);
    const mx = R.OX + 50 * S, my = OY0 + CX * S;
    g.beginPath(); g.moveTo(mx, OY0); g.lineTo(mx, OY0 + FW * S); g.stroke();
    g.beginPath(); g.arc(mx, my, 9 * S, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(240,248,236,.85)'; g.beginPath(); g.arc(mx, my, S * .6, 0, Math.PI * 2); g.fill();
    // coins
    for (const cx of [R.OX, R.OX + FL * S]) for (const cy of [OY0, OY0 + FW * S]) {
      g.beginPath(); g.arc(cx, cy, 1.6 * S, cy === OY0 ? (cx === R.OX ? 0 : Math.PI / 2) : (cx === R.OX ? -Math.PI / 2 : Math.PI), (cy === OY0 ? (cx === R.OX ? Math.PI / 2 : Math.PI) : (cx === R.OX ? 0 : -Math.PI / 2))); g.stroke();
      g.fillStyle = '#ffc94a'; g.fillRect(cx - 1, cy - 1.2 * S, 2, 1.2 * S); g.fillStyle = 'rgba(240,248,236,.85)';
    }
    const a = Math.asin(4 / 9);
    for (const left of [true, false]) {
      const ex = left ? R.OX : R.OX + FL * S, s = left ? 1 : -1;
      g.strokeRect(left ? ex : ex - 14 * S, my - 18 * S, 14 * S, 36 * S);
      g.strokeRect(left ? ex : ex - 5 * S, my - 10 * S, 5 * S, 20 * S);
      g.beginPath(); g.arc(ex + s * 10 * S, my, S * .5, 0, Math.PI * 2); g.fill();
      g.beginPath();
      if (left) g.arc(ex + 10 * S, my, 9 * S, -Math.PI / 2 + a, Math.PI / 2 - a);
      else g.arc(ex - 10 * S, my, 9 * S, Math.PI / 2 + a, Math.PI * 1.5 - a);
      g.stroke();
      // but
      const gx = left ? ex - GD * S : ex, gw = GD * S;
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(gx, my - GH * S, gw, 2 * GH * S);
      g.save(); g.beginPath(); g.rect(gx, my - GH * S, gw, 2 * GH * S); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1;
      for (let i = -gw; i < 2 * GH * S + gw; i += 1.1 * S) { g.beginPath(); g.moveTo(gx, my - GH * S + i); g.lineTo(gx + gw, my - GH * S + i + gw); g.stroke(); g.beginPath(); g.moveTo(gx + gw, my - GH * S + i); g.lineTo(gx, my - GH * S + i + gw); g.stroke(); }
      g.restore();
      g.strokeStyle = '#fff'; g.lineWidth = Math.max(2, S * .5); g.lineJoin = 'round';
      g.beginPath();
      if (left) { g.moveTo(ex, my - GH * S); g.lineTo(gx, my - GH * S); g.lineTo(gx, my + GH * S); g.lineTo(ex, my + GH * S); }
      else { g.moveTo(ex, my - GH * S); g.lineTo(ex + gw, my - GH * S); g.lineTo(ex + gw, my + GH * S); g.lineTo(ex, my + GH * S); }
      g.stroke();
      // poteaux en relief + ombre de la barre
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(left ? gx : ex, my + GH * S + S * .3, gw, S * .6);
      for (const py of [my - GH * S, my + GH * S]) {
        const pg = g.createRadialGradient(ex - S * .2, py - S * .2, 0, ex, py, S * .8);
        pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#b8c2bd');
        g.fillStyle = pg; g.beginPath(); g.arc(ex, py, Math.max(2, S * .55), 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = 'rgba(240,248,236,.82)'; g.lineWidth = Math.max(1.2, S * .3);
      g.fillStyle = 'rgba(240,248,236,.85)';
    }
      PC = { cv, OY0, Hc, Wc };
  }
  function drawPitch() {
    const key = [R.W, R.H, R.S, R.OX, R.DPR].join();
    if (key !== PCkey || !PC) { buildPitch(); PCkey = key; }
    // copie 1:1 en pixels écran, uniquement la partie visible
    const top = PC.OY0 - R.OY, D = R.DPR;
    const sy0 = Math.max(0, top), dy0 = Math.max(0, -top), hh = Math.min(R.H - dy0, PC.Hc - sy0);
    if (dy0 > 0 || hh < R.H) { ctx.fillStyle = '#0d1512'; ctx.fillRect(0, 0, R.W, R.H); }
    if (hh > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(PC.cv, 0, Math.round(sy0 * D), PC.cv.width, Math.round(hh * D), 0, Math.round(dy0 * D), PC.cv.width, Math.round(hh * D)); ctx.setTransform(D, 0, 0, D, 0, 0); }
  }

  function drawPlayer(V, M, i) {
    const pd = V.p[i], meta = M.players[i], t = meta.t;
    const x = sx(pd[0], pd[1]), y = sy(pd[0], pd[1]), r = PR * R.S * 1.08, kit = M.kit[t];
    const [fx, fy] = sdir(pd[2], pd[3]);
    const ctrl = V.c[t] === i && M.humans[t];
    // animation de course (phase selon la distance parcourue à l'écran)
    const an = ANIM[i] || (ANIM[i] = { x, y, ph: 0, sp: 0 });
    const mv = Math.hypot(x - an.x, y - an.y); an.x = x; an.y = y;
    an.sp += (Math.min(mv / Math.max(1, r * .35), 1) - an.sp) * .25; an.ph += mv / Math.max(1, r * .9);
    const ang = Math.atan2(fy, fx);
    // ombre douce
    ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(x + r * .3, y + r * .42, r * 1.08, r * .82, 0, 0, Math.PI * 2); ctx.fill();
    // joueur contrôlé : anneau au sol qui pulse
    if (ctrl) {
      const c = SIDE_COL[t], pulse = 1 + Math.sin(performance.now() / 160) * .05;
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, R.S * .4);
      ctx.beginPath(); ctx.arc(x, y, r * 1.62 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = .16; ctx.fillStyle = c; ctx.fill(); ctx.restore();
    }
    if (V.pv[t] === i && t === R.me) {
      ctx.save(); ctx.setLineDash([R.S * .8, R.S * .6]); ctx.strokeStyle = SIDE_COL[t]; ctx.lineWidth = Math.max(1.5, R.S * .3);
      ctx.beginPath(); ctx.arc(x, y, r * 1.58, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    const gk = meta.gk, body = gk ? GK_COL[t] : kit.c1, trim = gk ? '#0b1411' : kit.c2;
    const patt = !gk && kit.p !== 'solid';
    const flip = pd[5] || 0;
    if (flip > 0) { // retournée : cercles de mouvement et jeton qui bascule
      ctx.save(); ctx.strokeStyle = 'rgba(255,224,138,.8)'; ctx.lineWidth = Math.max(2, r * .25);
      for (let k = 0; k < 3; k++) { ctx.globalAlpha = flip * (1 - k * .3); ctx.beginPath(); ctx.arc(x, y, r * (1.5 + k * .45 + (.7 - flip)), 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(Math.max(.15, Math.cos((.7 - flip) / .7 * Math.PI * 2) * .5 + .5), 1); ctx.rotate(-ang); ctx.translate(-x, -y);
    }
    ctx.globalAlpha = pd[4] ? .6 : 1;
    // crampons qui dépassent pendant la course
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    const sw = Math.sin(an.ph) * r * .5 * an.sp;
    ctx.fillStyle = '#101312';
    ctx.beginPath(); ctx.ellipse(r * .42 + sw, -r * .44, r * .27, r * .2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * .42 - sw, r * .44, r * .27, r * .2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // jeton : maillot + motif
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = body; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    if (patt) {
      ctx.fillStyle = kit.c2;
      if (kit.p === 'stripes') for (const k of [-.66, 0, .66]) ctx.fillRect(x + k * r - r * .17, y - r, r * .34, 2 * r);
      else if (kit.p === 'band') { ctx.fillStyle = '#fff'; ctx.fillRect(x - r * .38, y - r, r * .76, 2 * r); ctx.fillStyle = kit.c2; ctx.fillRect(x - r * .3, y - r, r * .6, 2 * r); }
      else if (kit.p === 'diag') { ctx.beginPath(); ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r, y + r); ctx.closePath(); ctx.fill(); }
      else if (kit.p === 'sleeves') { ctx.fillRect(x - r, y - r, r * .42, 2 * r); ctx.fillRect(x + r * .58, y - r, r * .42, 2 * r); }
    }
    // relief : éclat en haut à gauche, ombre en bas à droite (effet bouton bombé)
    const sh = ctx.createRadialGradient(x - r * .38, y - r * .42, r * .05, x, y, r * 1.08);
    sh.addColorStop(0, 'rgba(255,255,255,.42)'); sh.addColorStop(.35, 'rgba(255,255,255,.08)'); sh.addColorStop(.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.32)');
    ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
    // double liseré : couleur secondaire puis contour sombre
    ctx.lineWidth = Math.max(1.4, r * .16); ctx.strokeStyle = patt || gk ? 'rgba(255,255,255,.75)' : trim;
    ctx.beginPath(); ctx.arc(x, y, r * .9, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * .1); ctx.strokeStyle = 'rgba(6,10,8,.7)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    // chevron de direction sur le bord
    const cx1 = x + fx * r * 1.08, cy1 = y + fy * r * 1.08;
    ctx.fillStyle = gk ? '#0b1411' : (patt ? '#fff' : trim); ctx.strokeStyle = 'rgba(6,10,8,.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + fx * r * 1.5, y + fy * r * 1.5); ctx.lineTo(cx1 - fy * r * .4, cy1 + fx * r * .4); ctx.lineTo(cx1 + fy * r * .4, cy1 - fx * r * .4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // numéro bien lisible
    const fz = Math.max(9, r * 1.02), txt = pickText(body);
    ctx.font = `800 ${fz}px ${FD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const light = patt ? '#fff' : txt, edge = light === '#ffffff' || light === '#fff' ? 'rgba(6,10,8,.85)' : 'rgba(255,255,255,.75)';
    ctx.lineWidth = Math.max(2, fz * .22); ctx.strokeStyle = edge; ctx.strokeText(meta.num, x, y + r * .07);
    ctx.fillStyle = light; ctx.fillText(meta.num, x, y + r * .07);
    if (flip > 0) ctx.restore();
    ctx.globalAlpha = 1;
    if (ctrl) { // flèche au-dessus du joueur contrôlé
      const c = SIDE_COL[t], ay = y - r * 2.05 + Math.sin(performance.now() / 180) * r * .12;
      ctx.fillStyle = c; ctx.strokeStyle = 'rgba(8,12,10,.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - r * .5, ay - r * .5); ctx.lineTo(x + r * .5, ay - r * .5); ctx.lineTo(x, ay + r * .1); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (ctrl || V.b[3] === i) LABELS.push([i, x, y, r, ctrl]);
  }
  /** Étiquettes nom + jauge de tir, dessinées après tous les joueurs pour rester lisibles */
  const LABELS = [];
  function drawLabel(V, M, [i, x, y, r, ctrl]) {
    const meta = M.players[i], t = meta.t;
    {
      const nm = `${meta.num} · ${meta.name.toUpperCase()}`, fz = Math.max(9, r * .8);
      ctx.font = `700 ${fz}px ${FD}`; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      const w = ctx.measureText(nm).width, ly = ctrl ? y + r * 1.5 : y - r * 2.1 - fz - 4; // porteur adverse : étiquette au-dessus
      ctx.fillStyle = 'rgba(6,12,10,.75)'; rr(x - w / 2 - 5, ly, w + 10, fz + 4, 3); ctx.fill();
      ctx.fillStyle = ctrl ? SIDE_COL[t] : M.kit[t].c1 === '#ffffff' ? CHALK : CHALK; ctx.fillRect(x - w / 2 - 5, ly, 2.5, fz + 4);
      ctx.fillStyle = ctrl ? SIDE_COL[t] : CHALK; ctx.fillText(nm, x + 1, ly + 2);
      if (ctrl && V.b[3] === i && V.ch[t] > 0) {
        const bw = r * 4, bh = Math.max(4, r * .45), by = ly + fz + 7;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(x - bw / 2 - 1, by - 1, bw + 2, bh + 2, 2); ctx.fill();
        const gr = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0); gr.addColorStop(0, '#7fd99a'); gr.addColorStop(.7, '#ffe08a'); gr.addColorStop(1, '#f0776b');
        ctx.fillStyle = gr; ctx.fillRect(x - bw / 2, by, bw * V.ch[t], bh);
      }
    }
  }

  const trail = [], ANIM = [];
  /** Cible au sol : où le ballon en l'air va retomber */
  function drawLanding(V) {
    const lx = V.b[6], ly = V.b[7], tl = V.b[8];
    if (lx == null || lx < 0 || !(V.b[5] > .3)) return;
    const x = sx(lx, ly), y = sy(lx, ly), base = Math.max(7, R.S * 2.2);
    const pulse = 1 + Math.sin(performance.now() / 110) * .12;
    const rr2 = base * (1 + Math.min(1.2, tl) * .6) * pulse; // se resserre à l'approche
    const col = V.b[3] < 0 ? '#ffe08a' : '#ffffff';
    ctx.save();
    ctx.strokeStyle = col; ctx.globalAlpha = .9; ctx.lineWidth = Math.max(2, R.S * .35);
    ctx.setLineDash([R.S * 1.1, R.S * .7]); ctx.lineDashOffset = -performance.now() / 40;
    ctx.beginPath(); ctx.arc(x, y, rr2, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = .35; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, base * .55, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .95; ctx.lineWidth = Math.max(1.5, R.S * .25);
    const c = base * .5;
    ctx.beginPath(); ctx.moveTo(x - c, y); ctx.lineTo(x + c, y); ctx.moveTo(x, y - c); ctx.lineTo(x, y + c); ctx.stroke();
    // trajectoire en pointillés entre l'ombre du ballon et la cible
    const bx = sx(V.b[0], V.b[1]), by = sy(V.b[0], V.b[1]);
    ctx.globalAlpha = .4; ctx.setLineDash([R.S * .5, R.S * .8]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
    ctx.restore();
  }
  function drawBall(V) {
    const gx = sx(V.b[0], V.b[1]), gy = sy(V.b[0], V.b[1]), z = V.b[5] || 0;
    const r = Math.max(3.5, BR * R.S * 1.2) * (1 + z * .07), x = gx, y = gy - z * R.S * .9;
    if (V.b[3] < 0 && V.b[4] > 30) { trail.push([x, y]); if (trail.length > 12) trail.shift(); } else if (trail.length) trail.shift();
    trail.forEach((q, i) => { ctx.fillStyle = `rgba(255,255,255,${.04 + i / trail.length * .16})`; ctx.beginPath(); ctx.arc(q[0], q[1], r * (.5 + i / trail.length * .5), 0, Math.PI * 2); ctx.fill(); });
    const sr = Math.max(3.5, BR * R.S * 1.2);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(.12, .35 - z * .05)})`; ctx.beginPath(); ctx.ellipse(gx + sr * .35 + z * R.S * .25, gy + sr * .5, sr * (1 + z * .05), sr * .75, 0, 0, Math.PI * 2); ctx.fill();
    const bg = ctx.createRadialGradient(x - r * .4, y - r * .45, r * .1, x, y, r * 1.05);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(.6, '#eef0f2'); bg.addColorStop(1, '#9aa3ab');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1d2420';
    const sp = V.b[2];
    for (let k = 0; k < 5; k++) { // panneaux qui tournent avec le ballon
      const a = sp + k * 1.2566, d = r * (.62 + .18 * Math.sin(sp * .7 + k)), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      ctx.beginPath(); for (let j = 0; j < 5; j++) { const b2 = a + j * 1.2566; ctx[j ? 'lineTo' : 'moveTo'](px + Math.cos(b2) * r * .24, py + Math.sin(b2) * r * .24); } ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); for (let j = 0; j < 5; j++) { const b2 = sp * .5 + j * 1.2566; ctx[j ? 'lineTo' : 'moveTo'](x + Math.cos(b2) * r * .26, y + Math.sin(b2) * r * .26); } ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(x - r * .38, y - r * .4, r * .22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }

  function drawHUD(V, M, ui) {
    const h = R.hud, me = R.me, op = 1 - me;
    const bgr = ctx.createLinearGradient(0, 0, 0, h);
    bgr.addColorStop(0, 'rgba(10,18,15,.96)'); bgr.addColorStop(1, 'rgba(4,8,7,.9)');
    ctx.fillStyle = bgr; ctx.fillRect(0, 0, R.W, h);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, h - 1, R.W, 1);
    const fs = h < 46 ? 21 : 27, mid = R.W / 2, y = h / 2, bh = h - 12, by = 6;
    ctx.textBaseline = 'middle';
    // Tableau de score façon diffusion TV : [club | score | club]
    ctx.font = `800 ${fs}px ${FD}`;
    const nL = M.team[me].short, nR = M.team[op].short;
    const scW = Math.max(ctx.measureText('0 – 0').width, ctx.measureText(`${V.sc[me]} – ${V.sc[op]}`).width) + 22;
    const tw = Math.max(ctx.measureText(nL).width, ctx.measureText(nR).width) + 26;
    const L0 = mid - scW / 2 - tw, R0 = mid + scW / 2;
    const chip = (x0, k, name, side) => {
      ctx.fillStyle = 'rgba(255,255,255,.07)'; rr(x0, by, tw, bh, 4); ctx.fill();
      ctx.fillStyle = k.c1; ctx.fillRect(side ? x0 + tw - 6 : x0, by, 6, bh);
      ctx.fillStyle = k.c2; ctx.fillRect(side ? x0 + tw - 6 : x0 + 4, by, 2, bh);
      ctx.fillStyle = CHALK; ctx.textAlign = 'center'; ctx.fillText(name, x0 + tw / 2 + (side ? -3 : 3), y);
    };
    chip(L0, M.kit[me], nL, 0); chip(R0, M.kit[op], nR, 1);
    const sg = ctx.createLinearGradient(0, by, 0, by + bh); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#d9e2dc');
    ctx.fillStyle = sg; rr(mid - scW / 2, by - 1, scW, bh + 2, 4); ctx.fill();
    ctx.fillStyle = '#0b1411'; ctx.textAlign = 'center'; ctx.fillText(`${V.sc[me]} – ${V.sc[op]}`, mid, y);
    // pseudos
    ctx.font = `600 ${Math.round(fs * .55)}px ${FD}`; ctx.fillStyle = 'rgba(238,243,234,.62)';
    if (L0 > 160) { ctx.textAlign = 'right'; ctx.fillText((M.names[me] || '').toUpperCase(), L0 - 10, y); }
    if (R.W - (R0 + tw) > 120) { ctx.textAlign = 'left'; ctx.fillText((M.names[op] || '').toUpperCase(), R0 + tw + 10, y); }
    // horloge MM:SS (90 minutes)
    const tot = Math.min(90 * 60, Math.floor(V.tm / M.dur * 90 * 60)), mm = Math.floor(tot / 60), ss = tot % 60;
    const cl = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    ctx.font = `800 ${fs * .78}px ${FD}`;
    const cw = ctx.measureText('00:00').width + 16, cx0 = 10 + (ui.safeL || 0);
    ctx.fillStyle = SIDE_COL[me]; rr(cx0, by + 2, cw, bh - 4, 4); ctx.fill();
    ctx.fillStyle = '#0b1411'; ctx.textAlign = 'center'; ctx.fillText(cl, cx0 + cw / 2, y);
    // réseau
    if (ui.net && cx0 + cw + 90 < L0) {
      ctx.font = `600 ${fs * .5}px ${FD}`; ctx.fillStyle = ui.net.ok ? 'rgba(127,217,154,.9)' : '#f0776b'; ctx.textAlign = 'left';
      ctx.fillText(ui.net.label, cx0 + cw + 10, y);
    }
    // bouton menu
    const mx = R.W - 28 - (ui.safeR || 0);
    ctx.fillStyle = 'rgba(238,243,234,.75)'; rr(mx - 7, y - 8, 5, 16, 1.5); ctx.fill(); rr(mx + 2, y - 8, 5, 16, 1.5); ctx.fill();
    R.menuBtn = { x: mx, y, r: 24 };
  }

  function drawControls(V, M, ui) {
    if (!M.humans[R.me]) return;
    const g = R.ctrl, I = ui.input;
    if (ui.pad) { drawPadHints(V, M, ui); return; }
    const jx = I.joyOn ? I.jox : g.jx, jy = I.joyOn ? I.joy : g.jy;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(jx, jy, g.jr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = I.joyOn ? SIDE_COL[R.me] : 'rgba(238,243,234,.35)';
    ctx.beginPath(); ctx.arc(jx + (I.joyOn ? I.klx : 0), jy + (I.joyOn ? I.kly : 0), g.jr * .45, 0, Math.PI * 2); ctx.fill();
    const me = R.me, c = V.c[me], own = V.b[3], has = own >= 0 && own === c;
    const gkHas = own >= 0 && M.players[own].gk && M.players[own].t === me;
    const held = I.aDown ? Math.min(1, (performance.now() - I.aT) / 320) : 0;
    drawBtn(g.ax, g.ay, g.ar, held >= 1 ? 'EN L\'AIR' : has ? 'PASSE' : gkHas ? 'RELANCE' : 'CHANGER', I.aFlash > 0 || held >= 1, held >= 1 ? '#ffe08a' : '#e9f1e6', held);
    let inRange = false;
    if (!has && c >= 0 && own >= 0 && M.players[own].t !== me && !M.players[own].gk) {
      const pc = V.p[c]; inRange = Math.hypot(pc[0] - V.b[0], pc[1] - V.b[1]) < 3.8;
    }
    if (inRange) { ctx.strokeStyle = 'rgba(240,119,107,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(g.bx, g.by, g.br + 7 + Math.sin(performance.now() / 90) * 2, 0, Math.PI * 2); ctx.stroke(); }
    drawBtn(g.bx, g.by, g.br, has ? 'TIR' : 'VOLER', I.bDown || inRange, has ? SIDE_COL[me] : '#f0776b', has ? ui.localCharge : 0);
  }
  /** Manette branchée : pas de boutons tactiles, juste un rappel discret des touches */
  function drawPadHints(V, M, ui) {
    const L = ui.pad, I = ui.input, me = R.me, c = V.c[me], own = V.b[3], has = own >= 0 && own === c;
    const gkHas = own >= 0 && M.players[own].gk && M.players[own].t === me;
    const held = I.aDown ? Math.min(1, (performance.now() - I.aT) / 320) : 0;
    const items = has || gkHas
      ? [[L.A, held >= 1 ? 'EN L\'AIR' : 'PASSE', '#7fd99a', held], [L.X, 'EN L\'AIR', '#5ad1e6', 0], [L.B, 'TIR', '#f0776b', has ? ui.localCharge : 0]]
      : [[L.A, 'CHANGER', '#7fd99a', 0], [L.B, 'VOLER', '#f0776b', 0], [L.LB, 'CHANGER', '#ffe08a', 0]];
    const fz = R.H < 420 ? 12 : 14, rad = fz * .95;
    ctx.font = `700 ${fz}px ${FD}`; ctx.textBaseline = 'middle';
    let x = R.W - 12 - (ui.safeR || 0); const y = R.H - 18 - rad;
    for (let k = items.length - 1; k >= 0; k--) {
      const [key, lab, col, ch] = items[k];
      const w = ctx.measureText(lab).width;
      x -= w; ctx.fillStyle = 'rgba(6,12,10,.6)'; rr(x - rad * 2 - 12, y - rad - 4, w + rad * 2 + 18, rad * 2 + 8, rad + 4); ctx.fill();
      ctx.fillStyle = CHALK; ctx.textAlign = 'left'; ctx.fillText(lab, x, y + 1);
      const bx = x - rad - 6;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx, y, rad, 0, Math.PI * 2); ctx.fill();
      if (ch > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, y, rad + 3, -Math.PI / 2, -Math.PI / 2 + ch * Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#0b1411'; ctx.textAlign = 'center'; ctx.font = `800 ${key.length > 2 ? fz * .62 : fz}px ${FD}`; ctx.fillText(key, bx, y + 1);
      ctx.font = `700 ${fz}px ${FD}`;
      x = bx - rad - 18;
    }
  }
  /** Ralenti : bandes cinéma + pastille « RALENTI » */
  function drawReplay(V) {
    const k = Math.max(0, Math.min(1, V.rp ?? 1)), bh = Math.round(R.H * .07 * k);
    ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(0, R.hud, R.W, bh); ctx.fillRect(0, R.H - bh, R.W, bh);
    ctx.globalAlpha = k;
    const fz = Math.max(14, Math.min(22, R.H * .045)), x = 16, y = R.hud + bh + 12;
    ctx.font = `800 ${fz}px ${FD}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const w = ctx.measureText('RALENTI').width + fz * 1.6;
    ctx.fillStyle = '#f0776b'; rr(x, y, w, fz * 1.5, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + fz * .55, y + fz * .75, fz * .22, 0, Math.PI * 2); ctx.fill();
    ctx.fillText('RALENTI', x + fz * 1.05, y + fz * .78);
    ctx.font = `600 ${fz * .7}px ${FD}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(238,243,234,.75)';
    ctx.fillText('Touche l\'écran pour passer', R.W / 2, R.H - bh / 2);
    ctx.globalAlpha = 1;
  }
  function drawBtn(x, y, r, label, on, col, charge) {
    ctx.fillStyle = on ? col : 'rgba(6,12,10,.35)'; ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (charge > 0) { ctx.strokeStyle = label === 'EN L\'AIR' ? '#ffe08a' : charge > .85 ? '#f0776b' : '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = on ? '#0b1411' : col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fz = Math.min(r * .5, 24); ctx.font = `800 ${fz}px ${FD}`;
    const tw = ctx.measureText(label).width; if (tw > r * 1.62) { fz *= r * 1.62 / tw; ctx.font = `800 ${fz}px ${FD}`; }
    ctx.fillText(label, x, y + 1);
  }

  function drawBanner(V, M) {
    const B = V.bn; if (!B) return;
    const [, text, sub, t, life, team] = B;
    const k = t < .25 ? t / .25 : t > life - .3 ? Math.max(0, (life - t) / .3) : 1;
    const big = text === 'BUT !';
    const cx = R.W / 2, cy = R.hud + (R.H - R.hud) * .42; // centré sur ce qu'on voit
    ctx.save(); ctx.globalAlpha = k;
    const vh = R.H - R.hud, fs = Math.min(vh * (big ? .2 : .1), R.W * (big ? .11 : .06), big ? 110 : 52);
    const bandH = fs * (sub ? 1.6 : 1.2);
    ctx.fillStyle = big && team >= 0 ? M.kit[team].c1 : 'rgba(8,14,12,.84)';
    ctx.fillRect(0, cy - bandH / 2, R.W, bandH);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, cy + bandH / 2 - 3, R.W, 3);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, cy - bandH / 2, R.W, 2);
    ctx.fillStyle = big && team >= 0 ? pickText(M.kit[team].c1) : CHALK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${fs}px ${FD}`;
    const sc = t < .25 && big ? 1 + (1 - t / .25) * .4 : 1;
    ctx.save(); ctx.translate(cx, cy + (sub ? -fs * .2 : fs * .04)); ctx.scale(sc, sc); ctx.fillText(text, 0, 0); ctx.restore();
    if (sub) { ctx.font = `600 ${Math.max(13, fs * .3)}px ${FD}`; ctx.globalAlpha = k * .85; ctx.fillText(sub.toUpperCase(), cx, cy + fs * .5); }
    ctx.restore();
  }

  function camera(V) {
    if (!R.follow) return;
    const lat = R.me === 0 ? V.b[0] : FW - V.b[0];
    R.camLat += (lat - R.camLat) * .12;
    const want = R.hud + R.viewH / 2 - R.camLat * R.S;
    const lo = R.H - (FW + 3) * R.S, hi = R.hud + 3 * R.S;
    R.OY = clamp(want, lo, hi);
  }
  /** Filet qui se gonfle quand le ballon y rentre */
  function drawNet() {
    const N = R.net; if (!N) return;
    const k = (performance.now() - N.t) / 1100; if (k > 1) { R.net = null; return; }
    const bulge = Math.sin(Math.min(1, k * 2.2) * Math.PI) * (1 - k) * GD * R.S * .9 + (1 - k) * GD * R.S * .25;
    const ex = N.side ? R.OX + FL * R.S : R.OX, dir = N.side ? 1 : -1, my = R.OY + CX * R.S, gh = GH * R.S;
    ctx.save(); ctx.globalAlpha = .75 * (1 - k); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, R.S * .18);
    for (let j = -3; j <= 3; j++) {
      const yy = my + j / 3 * gh * .92, depth = GD * R.S + bulge * (1 - (j / 3) ** 2);
      ctx.beginPath(); ctx.moveTo(ex, yy); ctx.quadraticCurveTo(ex + dir * depth * 1.15, yy, ex + dir * depth, yy + (j ? 0 : .1)); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(ex + dir * GD * R.S, my - gh);
    ctx.quadraticCurveTo(ex + dir * (GD * R.S + bulge * 1.6), my, ex + dir * GD * R.S, my + gh); ctx.stroke();
    ctx.restore();
  }
  R.shk = 0; let shkT = 0;
  R.draw = (V, M, ui) => {
    R.me = ui.me;
    const nowT = performance.now(), dtS = Math.min(.1, (nowT - (shkT || nowT)) / 1000); shkT = nowT;
    if (R.shk > 0) { R.shk = Math.max(0, R.shk - dtS); const a = R.shk * 14; canvas.style.transform = R.shk ? `translate(${(Math.random() * 2 - 1) * a}px,${(Math.random() * 2 - 1) * a}px)` : ''; }
    if (V) camera(V);
    ctx.setTransform(R.DPR, 0, 0, R.DPR, 0, 0);
    if (!V || !R.ctrl) { ctx.fillStyle = '#0b1411'; ctx.fillRect(0, 0, R.W, R.H); return; }
    drawPitch();
    drawNet();
    const order = V.p.map((p, i) => i).sort((a, b) => sy(V.p[a][0], V.p[a][1]) - sy(V.p[b][0], V.p[b][1]));
    drawLanding(V);
    LABELS.length = 0;
    for (const i of order) drawPlayer(V, M, i);
    drawBall(V);
    for (const L of LABELS) drawLabel(V, M, L);
    for (const q of ui.parts || []) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, q.life); ctx.fillStyle = q.c; ctx.fillRect(-q.r, -q.r / 2, q.r * 2, q.r); ctx.restore(); }
    drawBanner(V, M);
    if (ui.replay) drawReplay(V);
    drawHUD(V, M, ui);
    if (!ui.replay) drawControls(V, M, ui);
    if (ui.overlay) {
      ctx.fillStyle = 'rgba(6,12,10,.7)'; ctx.fillRect(0, R.hud, R.W, R.H - R.hud);
      ctx.fillStyle = CHALK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.min(42, R.W * .05)}px ${FD}`;
      ctx.fillText(ui.overlay, R.W / 2, R.H / 2);
    }
  };
  R.burstAt = (V, M) => {
    const x = sx(V.b[0], V.b[1]), y = sy(V.b[0], V.b[1]), out = [];
    for (let i = 0; i < 36; i++) out.push({ x, y, vx: (Math.random() * 2 - 1) * 260, vy: (Math.random() * 2 - 1) * 200 - 60, c: i % 3 ? '#ffe08a' : '#ffffff', life: .6 + Math.random() * .6, r: 1.5 + Math.random() * 2, rot: Math.random() * 6 });
    return out;
  };
  R.grassAt = V => {
    const x = sx(V.b[0], V.b[1]), y = sy(V.b[0], V.b[1]), out = [], cols = ['#3f9d5f', '#2e7d4a', '#6cc47f', '#d9cfa3'];
    for (let i = 0; i < 14; i++) out.push({ x, y, vx: (Math.random() * 2 - 1) * 120, vy: -40 - Math.random() * 120, c: cols[i % 4], life: .35 + Math.random() * .3, r: 1 + Math.random() * 1.4, rot: Math.random() * 6 });
    return out;
  };
  R.goalBurst = (team, M) => {
    R.shk = .45; R.net = { side: team === R.me ? 1 : 0, t: performance.now() };
    const left = (team === R.me) ? false : true; // on marque à droite
    const gx = left ? R.OX : R.OX + FL * R.S, gy = R.OY + CX * R.S, out = [];
    for (let i = 0; i < 70; i++) out.push({ x: gx, y: gy + (Math.random() * 2 - 1) * GH * R.S, vx: (Math.random() * 2 - 1) * 220, vy: (Math.random() * 2 - 1) * 160, c: Math.random() < .5 ? M.kit[team].c1 : M.kit[team].c2, life: 1 + Math.random(), r: 2 + Math.random() * 2, rot: Math.random() * 6 });
    return out;
  };
  return R;
}
