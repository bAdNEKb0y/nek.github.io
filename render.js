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

  function drawPitch() {
    const S = R.S, x0 = R.OX - (GD + 2) * S, y0 = R.OY - 3 * S, w = (FL + 2 * GD + 4) * S, h = (FW + 6) * S;
    ctx.fillStyle = '#1b5c33'; rr(x0, y0, w, h, 10); ctx.fill();
    ctx.save(); rr(x0, y0, w, h, 10); ctx.clip();
    for (let i = -1; i < 11; i++) { ctx.fillStyle = i % 2 ? '#22794a' : '#1f6f42'; ctx.fillRect(R.OX + i * 10 * S, y0, 10 * S, h); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(240,248,236,.82)'; ctx.lineWidth = Math.max(1.2, S * .3);
    ctx.strokeRect(R.OX, R.OY, FL * S, FW * S);
    const mx = R.OX + 50 * S, my = R.OY + CX * S;
    ctx.beginPath(); ctx.moveTo(mx, R.OY); ctx.lineTo(mx, R.OY + FW * S); ctx.stroke();
    ctx.beginPath(); ctx.arc(mx, my, 9 * S, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(240,248,236,.85)'; ctx.beginPath(); ctx.arc(mx, my, S * .6, 0, Math.PI * 2); ctx.fill();
    const a = Math.asin(4 / 9);
    for (const left of [true, false]) {
      const ex = left ? R.OX : R.OX + FL * S, s = left ? 1 : -1;
      ctx.strokeRect(left ? ex : ex - 14 * S, my - 18 * S, 14 * S, 36 * S);
      ctx.strokeRect(left ? ex : ex - 5 * S, my - 10 * S, 5 * S, 20 * S);
      ctx.beginPath(); ctx.arc(ex + s * 10 * S, my, S * .5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      if (left) ctx.arc(ex + 10 * S, my, 9 * S, -Math.PI / 2 + a, Math.PI / 2 - a);
      else ctx.arc(ex - 10 * S, my, 9 * S, Math.PI / 2 + a, Math.PI * 1.5 - a);
      ctx.stroke();
      // but
      const gx = left ? ex - GD * S : ex, gw = GD * S;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(gx, my - GH * S, gw, 2 * GH * S);
      ctx.save(); ctx.beginPath(); ctx.rect(gx, my - GH * S, gw, 2 * GH * S); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
      for (let i = -gw; i < 2 * GH * S + gw; i += 1.1 * S) { ctx.beginPath(); ctx.moveTo(gx, my - GH * S + i); ctx.lineTo(gx + gw, my - GH * S + i + gw); ctx.stroke(); ctx.beginPath(); ctx.moveTo(gx + gw, my - GH * S + i); ctx.lineTo(gx, my - GH * S + i + gw); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, S * .5); ctx.lineJoin = 'round';
      ctx.beginPath();
      if (left) { ctx.moveTo(ex, my - GH * S); ctx.lineTo(gx, my - GH * S); ctx.lineTo(gx, my + GH * S); ctx.lineTo(ex, my + GH * S); }
      else { ctx.moveTo(ex, my - GH * S); ctx.lineTo(ex + gw, my - GH * S); ctx.lineTo(ex + gw, my + GH * S); ctx.lineTo(ex, my + GH * S); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240,248,236,.82)'; ctx.lineWidth = Math.max(1.2, S * .3);
      ctx.fillStyle = 'rgba(240,248,236,.85)';
    }
  }

  function drawPlayer(V, M, i) {
    const pd = V.p[i], meta = M.players[i], t = meta.t;
    const x = sx(pd[0], pd[1]), y = sy(pd[0], pd[1]), r = PR * R.S, kit = M.kit[t];
    const [fx, fy] = sdir(pd[2], pd[3]);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x + r * .25, y + r * .35, r * 1.05, r * .8, 0, 0, Math.PI * 2); ctx.fill();
    const ctrl = V.c[t] === i && M.humans[t];
    if (ctrl) {
      const c = SIDE_COL[t];
      ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, R.S * .4);
      ctx.beginPath(); ctx.arc(x, y, r * 1.65, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - r * .45, y - r * 2.5); ctx.lineTo(x + r * .45, y - r * 2.5); ctx.lineTo(x, y - r * 1.95); ctx.closePath(); ctx.fill();
    }
    if (V.pv[t] === i && t === R.me) {
      ctx.save(); ctx.setLineDash([R.S * .8, R.S * .6]); ctx.strokeStyle = SIDE_COL[t]; ctx.lineWidth = Math.max(1.5, R.S * .3);
      ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    const body = meta.gk ? GK_COL[t] : kit.c1, trim = meta.gk ? '#0b1411' : kit.c2;
    const patt = !meta.gk && kit.p !== 'solid';
    ctx.globalAlpha = pd[4] ? .6 : 1;
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = body; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    if (patt) {
      ctx.fillStyle = kit.c2;
      if (kit.p === 'stripes') for (const k of [-.66, 0, .66]) ctx.fillRect(x + k * r - r * .17, y - r, r * .34, 2 * r);
      else if (kit.p === 'band') { ctx.fillStyle = '#fff'; ctx.fillRect(x - r * .38, y - r, r * .76, 2 * r); ctx.fillStyle = kit.c2; ctx.fillRect(x - r * .3, y - r, r * .6, 2 * r); }
      else if (kit.p === 'diag') { ctx.beginPath(); ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r, y + r); ctx.closePath(); ctx.fill(); }
      else if (kit.p === 'sleeves') { ctx.fillRect(x - r, y - r, r * .42, 2 * r); ctx.fillRect(x + r * .58, y - r, r * .42, 2 * r); }
    }
    ctx.restore();
    ctx.strokeStyle = patt ? 'rgba(0,0,0,.5)' : trim; ctx.lineWidth = Math.max(1.5, r * .22); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = patt ? '#0b1411' : trim; ctx.beginPath(); ctx.arc(x + fx * r * .72, y + fy * r * .72, r * .24, 0, Math.PI * 2); ctx.fill();
    ctx.font = `800 ${Math.max(9, r * 1.05)}px ${FD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (patt) { ctx.lineWidth = Math.max(2, r * .28); ctx.strokeStyle = '#0b1411'; ctx.lineJoin = 'round'; ctx.strokeText(meta.num, x, y + r * .06); ctx.fillStyle = '#fff'; }
    else ctx.fillStyle = pickText(body);
    ctx.fillText(meta.num, x, y + r * .06);
    ctx.globalAlpha = 1;
    if (ctrl || V.b[3] === i) {
      const nm = meta.name.toUpperCase(), fz = Math.max(9, r * .8);
      ctx.font = `700 ${fz}px ${FD}`; ctx.textBaseline = 'top';
      const w = ctx.measureText(nm).width;
      ctx.fillStyle = 'rgba(6,12,10,.72)'; ctx.fillRect(x - w / 2 - 3, y + r * 1.25, w + 6, fz + 3);
      ctx.fillStyle = ctrl ? SIDE_COL[t] : CHALK; ctx.fillText(nm, x, y + r * 1.25 + 1.5);
      if (ctrl && V.b[3] === i && V.ch[t] > 0) {
        const bw = r * 4, bh = Math.max(4, r * .45), by = y + r * 1.25 + fz + 6;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - bw / 2, by, bw, bh);
        ctx.fillStyle = V.ch[t] > .85 ? '#f0776b' : SIDE_COL[t]; ctx.fillRect(x - bw / 2, by, bw * V.ch[t], bh);
      }
    }
  }

  const trail = [];
  function drawBall(V) {
    const x = sx(V.b[0], V.b[1]), y = sy(V.b[0], V.b[1]), r = Math.max(3.5, BR * R.S * 1.2);
    if (V.b[3] < 0 && V.b[4] > 30) { trail.push([x, y]); if (trail.length > 12) trail.shift(); } else if (trail.length) trail.shift();
    trail.forEach((q, i) => { ctx.fillStyle = `rgba(255,255,255,${.04 + i / trail.length * .16})`; ctx.beginPath(); ctx.arc(q[0], q[1], r * (.5 + i / trail.length * .5), 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x + r * .35, y + r * .5, r, r * .75, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2420';
    for (let k = 0; k < 3; k++) { const a = V.b[2] + k * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .5, r * .28, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }

  function drawHUD(V, M, ui) {
    const h = R.hud, me = R.me, op = 1 - me;
    ctx.fillStyle = 'rgba(6,12,10,.92)'; ctx.fillRect(0, 0, R.W, h);
    ctx.fillStyle = M.kit[me].c1; ctx.fillRect(0, h - 3, R.W / 2, 3);
    ctx.fillStyle = M.kit[op].c1; ctx.fillRect(R.W / 2, h - 3, R.W / 2, 3);
    const fs = h < 46 ? 22 : 28, mid = R.W / 2, y = h / 2;
    ctx.textBaseline = 'middle'; ctx.font = `800 ${fs}px ${FD}`;
    // Score centre : mon équipe à gauche
    const scoreTxt = `${V.sc[me]} – ${V.sc[op]}`;
    const sw = ctx.measureText(scoreTxt).width + 24;
    ctx.fillStyle = CHALK; ctx.fillRect(mid - sw / 2, 5, sw, h - 12);
    ctx.fillStyle = '#0b1411'; ctx.textAlign = 'center'; ctx.fillText(scoreTxt, mid, y - 1);
    ctx.fillStyle = SIDE_COL[me]; ctx.textAlign = 'right'; ctx.fillText(M.team[me].short, mid - sw / 2 - 10, y);
    ctx.fillStyle = SIDE_COL[op]; ctx.textAlign = 'left'; ctx.fillText(M.team[op].short, mid + sw / 2 + 10, y);
    const wl = ctx.measureText(M.team[me].short).width, wr = ctx.measureText(M.team[op].short).width;
    ctx.font = `600 ${Math.round(fs * .6)}px ${FD}`; ctx.fillStyle = 'rgba(238,243,234,.7)';
    ctx.textAlign = 'right'; ctx.fillText((M.names[me] || '').toUpperCase(), mid - sw / 2 - 20 - wl, y);
    ctx.textAlign = 'left'; ctx.fillText((M.names[op] || '').toUpperCase(), mid + sw / 2 + 20 + wr, y);
    // horloge
    const min = Math.min(90, Math.floor(V.tm / M.dur * 90));
    ctx.font = `800 ${fs * .8}px ${FD}`; ctx.textAlign = 'left'; ctx.fillStyle = SIDE_COL[me];
    ctx.fillText(`${min}'`, 14 + (ui.safeL || 0), y);
    // réseau
    if (ui.net) {
      ctx.font = `600 ${fs * .5}px ${FD}`; ctx.fillStyle = ui.net.ok ? 'rgba(127,217,154,.9)' : '#f0776b';
      ctx.fillText(ui.net.label, 14 + (ui.safeL || 0) + fs * 1.6, y);
    }
    // bouton menu
    const mx = R.W - 28 - (ui.safeR || 0);
    ctx.fillStyle = 'rgba(238,243,234,.7)'; ctx.fillRect(mx - 6, y - 8, 4, 16); ctx.fillRect(mx + 2, y - 8, 4, 16);
    R.menuBtn = { x: mx, y, r: 24 };
  }

  function drawControls(V, M, ui) {
    if (!M.humans[R.me]) return;
    const g = R.ctrl, I = ui.input;
    const jx = I.joyOn ? I.jox : g.jx, jy = I.joyOn ? I.joy : g.jy;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(jx, jy, g.jr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = I.joyOn ? SIDE_COL[R.me] : 'rgba(238,243,234,.35)';
    ctx.beginPath(); ctx.arc(jx + (I.joyOn ? I.klx : 0), jy + (I.joyOn ? I.kly : 0), g.jr * .45, 0, Math.PI * 2); ctx.fill();
    const me = R.me, c = V.c[me], own = V.b[3], has = own >= 0 && own === c;
    const gkHas = own >= 0 && M.players[own].gk && M.players[own].t === me;
    drawBtn(g.ax, g.ay, g.ar, has ? 'PASSE' : gkHas ? 'RELANCE' : 'CHANGER', I.aFlash > 0, '#e9f1e6', 0);
    let inRange = false;
    if (!has && c >= 0 && own >= 0 && M.players[own].t !== me && !M.players[own].gk) {
      const pc = V.p[c]; inRange = Math.hypot(pc[0] - V.b[0], pc[1] - V.b[1]) < 3.8;
    }
    if (inRange) { ctx.strokeStyle = 'rgba(240,119,107,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(g.bx, g.by, g.br + 7 + Math.sin(performance.now() / 90) * 2, 0, Math.PI * 2); ctx.stroke(); }
    drawBtn(g.bx, g.by, g.br, has ? 'TIR' : 'VOLER', I.bDown || inRange, has ? SIDE_COL[me] : '#f0776b', has ? ui.localCharge : 0);
  }
  function drawBtn(x, y, r, label, on, col, charge) {
    ctx.fillStyle = on ? col : 'rgba(6,12,10,.35)'; ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (charge > 0) { ctx.strokeStyle = charge > .85 ? '#f0776b' : '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = on ? '#0b1411' : col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.min(r * .5, label.length > 6 ? r * .4 : 24)}px ${FD}`; ctx.fillText(label, x, y + 1);
  }

  function drawBanner(V, M) {
    const B = V.bn; if (!B) return;
    const [, text, sub, t, life, team] = B;
    const k = t < .25 ? t / .25 : t > life - .3 ? Math.max(0, (life - t) / .3) : 1;
    const big = text === 'BUT !';
    const cx = R.OX + FL * R.S / 2, cy = R.OY + FW * R.S / 2;
    ctx.save(); ctx.globalAlpha = k;
    const fs = Math.min(FW * R.S * (big ? .5 : .22), big ? 150 : 64);
    const bandH = fs * (sub ? 1.5 : 1.15);
    ctx.fillStyle = big && team >= 0 ? M.kit[team].c1 : 'rgba(8,14,12,.84)';
    ctx.fillRect(R.OX - 4 * R.S, cy - bandH / 2, FL * R.S + 8 * R.S, bandH);
    ctx.fillStyle = big && team >= 0 ? pickText(M.kit[team].c1) : CHALK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${fs}px ${FD}`;
    const sc = t < .25 && big ? 1 + (1 - t / .25) * .4 : 1;
    ctx.save(); ctx.translate(cx, cy + (sub ? -fs * .2 : fs * .04)); ctx.scale(sc, sc); ctx.fillText(text, 0, 0); ctx.restore();
    if (sub) { ctx.font = `600 ${Math.max(13, fs * .26)}px ${FD}`; ctx.globalAlpha = k * .85; ctx.fillText(sub.toUpperCase(), cx, cy + fs * .48); }
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
  R.draw = (V, M, ui) => {
    R.me = ui.me;
    if (V) camera(V);
    ctx.setTransform(R.DPR, 0, 0, R.DPR, 0, 0);
    ctx.fillStyle = '#0b1411'; ctx.fillRect(0, 0, R.W, R.H);
    if (!V || !R.ctrl) return;
    drawPitch();
    const order = V.p.map((p, i) => i).sort((a, b) => sy(V.p[a][0], V.p[a][1]) - sy(V.p[b][0], V.p[b][1]));
    for (const i of order) drawPlayer(V, M, i);
    drawBall(V);
    for (const q of ui.parts || []) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, q.life); ctx.fillStyle = q.c; ctx.fillRect(-q.r, -q.r / 2, q.r * 2, q.r); ctx.restore(); }
    drawBanner(V, M);
    drawHUD(V, M, ui);
    drawControls(V, M, ui);
    if (ui.overlay) {
      ctx.fillStyle = 'rgba(6,12,10,.7)'; ctx.fillRect(0, R.hud, R.W, R.H - R.hud);
      ctx.fillStyle = CHALK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.min(42, R.W * .05)}px ${FD}`;
      ctx.fillText(ui.overlay, R.W / 2, R.H / 2);
    }
  };
  R.goalBurst = (team, M) => {
    const left = (team === R.me) ? false : true; // on marque à droite
    const gx = left ? R.OX : R.OX + FL * R.S, gy = R.OY + CX * R.S, out = [];
    for (let i = 0; i < 70; i++) out.push({ x: gx, y: gy + (Math.random() * 2 - 1) * GH * R.S, vx: (Math.random() * 2 - 1) * 220, vy: (Math.random() * 2 - 1) * 160, c: Math.random() < .5 ? M.kit[team].c1 : M.kit[team].c2, life: 1 + Math.random(), r: 2 + Math.random() * 2, rot: Math.random() * 6 });
    return out;
  };
  return R;
}
