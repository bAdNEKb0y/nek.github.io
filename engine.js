/* Moteur de match 5 contre 5. Tourne uniquement chez l'hôte (ou en solo contre l'ordi).
   Coordonnées terrain : largeur FW (x), longueur FL (y). L'équipe 0 attaque vers y=0, l'équipe 1 vers y=FL. */
import { TEAMS, KIT } from './data.js';

export const FW = 64, FL = 100, GH = 9, GD = 4, PR = 1.7, BR = 0.85, CX = 32;
const KICKOFF = [[32, 96.5], [18, 79], [46, 79], [22, 56], [42, 56]];
const FORM = [[32, 96.5], [19, 80], [45, 80], [21, 60], [43, 60]];
export const DIFF = [
  { name: 'Facile', react: .62, speed: .86, tack: .65, gk: -.14, shoot: .85 },
  { name: 'Normal', react: .38, speed: .95, tack: 1, gk: 0, shoot: 1 },
  { name: 'Costaud', react: .22, speed: 1.04, tack: 1.3, gk: .07, shoot: 1.15 },
];
const MATE_AI = { react: .35, speed: .97, tack: .85, gk: 0, shoot: 1 };

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;
const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const dirOf = t => t === 0 ? -1 : 1;
const atkY = t => t === 0 ? 0 : FL;
const ownY = t => t === 0 ? FL : 0;
const mir = (t, p) => t === 0 ? [p[0], p[1]] : [FW - p[0], FL - p[1]];
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixHex(a, b) { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => Math.round((v + y[i]) / 2).toString(16).padStart(2, '0')).join(''); }
const kitTone = k => k.p === 'stripes' || k.p === 'diag' ? mixHex(k.c1, k.c2) : k.c1;
const colDist = (a, b) => { const x = hexRgb(a), y = hexRgb(b); return hyp(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

/** Choisit les maillots pour éviter que les deux équipes se ressemblent. */
export function pickKits(A, B) {
  const kA = KIT(A.h);
  let kB = KIT(B.h);
  if (colDist(kitTone(kA), kitTone(kB)) < 150) kB = KIT(B.a);
  if (colDist(kitTone(kA), kitTone(kB)) < 150) kB = { c1: '#2b2f3a', c2: '#f5f5f5', p: 'solid' };
  return [kA, kB];
}

export const blankInput = () => ({ jx: 0, jy: 0, mag: 0, a: false, lob: false, b: false, bDown: false, rel: false, relCharge: 0 });

/**
 * cfg: { teams: [équipe0, équipe1] (ou t0, t1 = index dans TEAMS), dur (s), humans: [bool,bool], diff (0..2) }
 */
export function createMatch(cfg) {
  const team = cfg.teams || [TEAMS[cfg.t0], TEAMS[cfg.t1]];
  const G = {
    cfg, team, kit: pickKits(team[0], team[1]),
    ai: [cfg.humans[0] ? MATE_AI : DIFF[cfg.diff ?? 1], cfg.humans[1] ? MATE_AI : DIFF[cfg.diff ?? 1]],
    players: [], byTeam: [[], []],
    ball: { x: CX, y: 50, z: 0, vx: 0, vy: 0, vz: 0, owner: null, last: null, protect: 0, spin: 0, cross: false },
    score: [0, 0], time: 0, dur: cfg.dur, half: 1, state: 'kickoff', stateT: 0, nextKick: 0,
    ctrl: [null, null], chaser: [null, null], cover: [null, null], preview: [null, null], charge: [0, 0],
    stats: { shots: [0, 0], onT: [0, 0], poss: [0, 0] }, scorers: [],
    passTarget: null, passT: 0, events: [], evSeq: 0, banner: null, ended: false, land: null, hold: [false, false],
  };
  for (let t = 0; t < 2; t++) for (let i = 0; i < 5; i++) {
    const sq = team[t].sq[i];
    const p = { t, i, gk: i === 0, num: sq[1], name: sq[0], r: sq[2], st: { but: 0, tir: 0, pas: 0, vol: 0, arr: 0 },
      x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: dirOf(t), kcd: 0, tcd: 0, stun: 0, holdT: 0, aiT: Math.random() * .4, ox: 0, oy: 0, offT: 0 };
    G.players.push(p); G.byTeam[t].push(p);
  }
  setupKickoff(G, 0, true);
  return G;
}

function ev(G, type, data) { G.events.push({ s: ++G.evSeq, type, ...data }); if (G.events.length > 24) G.events.shift(); }
function banner(G, text, sub, life, team) { G.banner = { id: G.evSeq + 1, text, sub: sub || '', life: life || 1.6, t: 0, team: team ?? -1 }; ev(G, 'banner', {}); }

function setupKickoff(G, kt, first) {
  for (const p of G.players) {
    const pos = mir(p.t, KICKOFF[p.i]); p.x = pos[0]; p.y = pos[1]; p.vx = p.vy = 0; p.fx = 0; p.fy = dirOf(p.t);
    p.stun = 0; p.kcd = 0; p.tcd = 0; p.holdT = 0;
  }
  const k = G.byTeam[kt][3]; k.x = CX; k.y = 50 - dirOf(kt) * (PR + BR + .25);
  const b = G.ball; b.x = CX; b.y = 50; b.vx = b.vy = 0; b.z = b.vz = 0; b.owner = null;
  giveBall(G, k);
  for (let t = 0; t < 2; t++) if (G.cfg.humans[t]) G.ctrl[t] = t === kt ? k : nearestToBall(G, t, null);
  G.passTarget = null; G.charge = [0, 0];
  G.state = 'kickoff'; G.stateT = first ? 2.2 : 1.3;
  if (first) banner(G, "COUP D'ENVOI", G.half === 2 ? 'Deuxième mi-temps' : `${G.team[0].short} contre ${G.team[1].short}`, 2);
}

const T = (G, p) => G.team[p.t];
const isCtrl = (G, p) => !!G.cfg.humans[p.t] && G.ctrl[p.t] === p;
const pb = (G, p) => p.r - T(G, p).ovr;

function nearestToBall(G, t, except) {
  let best = null, bd = 1e9; const b = G.ball;
  for (const p of G.byTeam[t]) { if (p.gk || p === except) continue; const d = hyp(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = p; } }
  return best;
}
function maxSp(G, p) {
  let s = 13 + (T(G, p).vit - 60) * .22 + pb(G, p) * .12;
  if (!isCtrl(G, p)) s *= G.ai[p.t].speed;
  if (p.gk) s *= .95;
  if (G.ball.owner === p) s *= .9;
  return s;
}
function steer(p, vx, vy, dt, acc) { const k = Math.min(1, dt * (acc || 9)); p.vx += (vx - p.vx) * k; p.vy += (vy - p.vy) * k; }
function moveTo(G, p, tx, ty, u, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
  if (d < .35) { steer(p, 0, 0, dt); return; }
  const sp = maxSp(G, p) * u * Math.min(1, d / 2.2); steer(p, dx / d * sp, dy / d * sp, dt);
}
function giveBall(G, p) {
  const b = G.ball;
  b.owner = p; b.vx = b.vy = 0; b.z = b.vz = 0; b.cross = false; b.last = p; b.protect = .7; G.passTarget = null; G.passPt = null;
  if (G.cfg.humans[p.t] && !p.gk) G.ctrl[p.t] = p;
  if (p.gk) p.holdT = 1.0;
}
function kick(G, p, vx, vy, power, vz = 0) {
  const b = G.ball; b.owner = null; b.vx = vx; b.vy = vy; b.vz = vz; b.z = vz ? .2 : 0; b.lift = vz > 4 ? .16 : 0; b.cross = false; p.kcd = .32; b.last = p; p.holdT = 0;
  b.kx = p.x; b.ky = p.y; b.spec = ''; b.maxz = 0; // pour reconnaître les beaux buts
  ev(G, 'kick', { pw: power });
}
const GRAV = 30;
const toGoalOf = (t, y) => Math.abs(atkY(t) - y);
const inBox = (t, x, y) => Math.abs(x - CX) < 14 && toGoalOf(t, y) < 20;
function passTo(G, p, m, opt = {}) {
  if (!m) return;
  const b = G.ball, dx = m.x - p.x, dy = m.y - p.y, dd = hyp(dx, dy);
  const acc = 1 - (T(G, p).pas + pb(G, p)) / 100;
  // Centre : passeur sur un côté dans le dernier tiers, receveur dans la surface. Ballon long : très longue passe.
  const isCross = opt.cross ?? (Math.abs(p.x - CX) > 11 && toGoalOf(p.t, p.y) < 34 && inBox(p.t, m.x, m.y) && !m.gk);
  const loft = isCross || opt.loft || dd > 34;
  p.st.pas++;
  if (loft) {
    const sp = clamp(15 + dd * .55, 19, 34);
    let t = dd / sp;
    // point de chute devant le receveur (il continue sa course)
    const lead = isCross ? .9 : .6;
    let tx = m.x + m.vx * t * lead, ty = m.y + m.vy * t * lead;
    if (isCross) { tx = clamp(tx, CX - 10, CX + 10); ty = clamp(ty, Math.min(atkY(p.t), atkY(p.t) - dirOf(p.t) * 6), Math.max(atkY(p.t), atkY(p.t) - dirOf(p.t) * 6)); ty = p.t === 0 ? clamp(ty, 5, 20) : clamp(ty, FL - 20, FL - 5); }
    const d2 = hyp(tx - b.x, ty - b.y); t = d2 / sp;
    const a = Math.atan2(ty - b.y, tx - b.x) + gauss() * acc * .12;
    // hauteur : le ballon redescend à hauteur de tête (≈1,7) au point de chute
    const vz = (1.7 + GRAV * t * t / 2) / t;
    kick(G, p, Math.cos(a) * sp, Math.sin(a) * sp, isCross ? .9 : .8, Math.min(vz, 22));
    b.cross = isCross;
    // le receveur = le coéquipier le mieux placé pour le point de chute réel (évite les changements de joueur en vol)
    const L = landing(b);
    if (L[0] >= 0) { let best = m, bd = hyp(m.x - L[0], m.y - L[1]); for (const q of G.byTeam[p.t]) { if (q === p || q.gk) continue; const dq = hyp(q.x - L[0], q.y - L[1]); if (dq < bd - 2) { bd = dq; best = q; } } m = best; }
    G.passTarget = m; G.passPt = [tx, ty]; G.passT = t + 1.2;
    if (isCross) ev(G, 'cross', {});
  } else {
    const sp = clamp(19 + dd * .95, 22, 50), t = dd / sp * 1.15;
    // passe en profondeur : on joue dans la course du receveur
    const run = (m.vx * dx + m.vy * dy) / (dd || 1);
    const lead = opt.through || (m.vy * dirOf(p.t) > 6) ? 1.1 : .7;
    const tx = m.x + m.vx * t * lead, ty = m.y + m.vy * t * lead;
    const a = Math.atan2(ty - b.y, tx - b.x) + gauss() * acc * .16;
    kick(G, p, Math.cos(a) * sp, Math.sin(a) * sp, .7);
    G.passTarget = m; G.passPt = [tx, ty]; G.passT = dd / sp + .9;
  }
  if (G.cfg.humans[p.t] && !m.gk) G.ctrl[p.t] = m;
}
/** Reprise de volée directe (joueurs notés 90 et plus) : le receveur frappe sans contrôle */
function canVolley(G, p) {
  const b = G.ball;
  if (p.r < 90 || p.gk || b.z < .25 || b.z > 2.2) return false;
  if (toGoalOf(p.t, p.y) > 30 || Math.abs(p.x - CX) > 22) return false;
  return isCtrl(G, p) ? G.hold[p.t] : Math.random() < .45;
}
function volley(G, p) {
  const b = G.ball, gy = atkY(p.t), tm = T(G, p), gk = G.byTeam[1 - p.t][0];
  const aimX = CX + (gk.x > CX ? -1 : 1) * rnd(2.5, GH - 1);
  const a = Math.atan2(gy - b.y, aimX - b.x) + gauss() * (1.12 - (tm.att + pb(G, p)) / 100) * .26;
  const sp = 36 + (p.r - 90) * 1.4 + rnd(0, 6);
  p.kcd = .4; p.st.tir++; G.stats.shots[p.t]++;
  kick(G, p, Math.cos(a) * sp, Math.sin(a) * sp, 1.4, rnd(0, 2));
  const vy = Math.sin(a) * sp; if (vy) { const tt = (gy - b.y) / vy; if (tt > 0 && Math.abs(b.x + Math.cos(a) * sp * tt - CX) < GH) G.stats.onT[p.t]++; }
  b.spec = 'volley'; ev(G, 'volley', {}); banner(G, 'REPRISE DE VOLÉE !', p.name, 1, p.t); G.passTarget = null;
}
/** Tête : vers le but si on attaque, dégagement sinon */
function header(G, p) {
  const b = G.ball, gy = atkY(p.t), d = dirOf(p.t);
  const attacking = toGoalOf(p.t, p.y) < 24 && Math.abs(p.x - CX) < 17;
  p.kcd = .4;
  // Retournée acrobatique : réservée aux joueurs notés 92 et plus
  const human = isCtrl(G, p);
  if (attacking && p.r >= 92 && b.z > 1.1 && (human ? G.hold[p.t] : Math.random() < .4)) {
    const tm = T(G, p), gk = G.byTeam[1 - p.t][0];
    const aimX = CX + (gk.x > CX ? -1 : 1) * rnd(3, GH - 1);
    const a = Math.atan2(gy - b.y, aimX - b.x) + gauss() * (1.12 - (tm.att + pb(G, p)) / 100) * .32;
    const sp = 38 + (p.r - 92) * 1.5 + rnd(0, 6);
    p.st.tir++; G.stats.shots[p.t]++;
    kick(G, p, Math.cos(a) * sp, Math.sin(a) * sp, 1.5, rnd(0, 2.5));
    const vy = Math.sin(a) * sp; if (vy) { const tt = (gy - b.y) / vy; if (tt > 0 && Math.abs(b.x + Math.cos(a) * sp * tt - CX) < GH) G.stats.onT[p.t]++; }
    p.flip = .7; b.spec = 'bicycle'; ev(G, 'bicycle', {}); banner(G, 'RETOURNÉE !', p.name, 1.1, p.t); G.passTarget = null;
    return;
  }
  if (attacking) {
    const tm = T(G, p), gk = G.byTeam[1 - p.t][0];
    const aimX = CX + (gk.x > CX ? -1 : 1) * rnd(2, GH - 1.2);
    let a = Math.atan2(gy - b.y, aimX - b.x) + gauss() * (1.15 - (tm.att + pb(G, p)) / 100) * .3;
    const sp = 24 + (tm.att - 70) * .25 + rnd(0, 6);
    p.st.tir++; G.stats.shots[p.t]++;
    kick(G, p, Math.cos(a) * sp, Math.sin(a) * sp, 1.1, rnd(-1, 3));
    const vy = Math.sin(a) * sp; if (vy) { const tt = (gy - b.y) / vy; if (tt > 0 && Math.abs(b.x + Math.cos(a) * sp * tt - CX) < GH) G.stats.onT[p.t]++; }
    b.spec = 'header'; ev(G, 'header', {}); G.passTarget = null;
  } else {
    const a = Math.atan2(d, (b.x - CX) / 40) + gauss() * .5;
    kick(G, p, Math.cos(a) * 26, Math.sin(a) * 26, 1, 9);
    ev(G, 'header', {});
  }
}
function shoot(G, p, power, aim) {
  const tm = T(G, p), gy = atkY(p.t), b = G.ball;
  const tx = CX + clamp(aim, -1, 1) * (GH - 1.1);
  let a = Math.atan2(gy - b.y, tx - b.x);
  a += gauss() * (1.1 - (tm.att + pb(G, p)) / 100) * .2 * (.35 + power);
  const sp = 32 + power * 36 + (tm.att - 75) * .25 + pb(G, p) * .3;
  const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
  p.st.tir++;
  kick(G, p, vx, vy, 1.3);
  G.stats.shots[p.t]++;
  if (vy !== 0) { const tt = (gy - b.y) / vy; if (tt > 0) { const xl = b.x + vx * tt; if (Math.abs(xl - CX) < GH) G.stats.onT[p.t]++; } }
  G.passTarget = null;
}
function tackle(G, p) {
  if (p.tcd > 0 || p.stun > 0) return;
  p.tcd = .6;
  const b = G.ball, o = b.owner, dx = b.x - p.x, dy = b.y - p.y, d = hyp(dx, dy) || 1;
  p.vx += dx / d * 9; p.vy += dy / d * 9;
  if (o && o.t !== p.t && !o.gk && d < 3.8 && b.protect <= 0) {
    const ch = .3 + (T(G, p).def + pb(G, p) - T(G, o).pas - pb(G, o)) / 120 + (isCtrl(G, p) ? .05 : 0);
    if (Math.random() < ch) { p.st.vol++; giveBall(G, p); ev(G, 'steal', { t: p.t }); }
    else p.stun = .5;
  } else if (!o && d < 3.4) giveBall(G, p);
  else if (!o || o.t !== p.t) p.stun = .25;
}
function switchPlayer(G, t) {
  const c = G.ctrl[t], b = G.ball;
  const list = G.byTeam[t].filter(p => !p.gk && p !== c).sort((a, q) => hyp(a.x - b.x, a.y - b.y) - hyp(q.x - b.x, q.y - b.y));
  if (list[0]) G.ctrl[t] = list[0];
}
function choosePass(G, p, dx, dy) {
  let best = null, bc = 1e9, fb = null, fc = 1e9;
  for (const m of G.byTeam[p.t]) {
    if (m === p) continue;
    const vx = m.x - p.x, vy = m.y - p.y, d = hyp(vx, vy); if (d < 3) continue;
    const ang = Math.acos(clamp((vx * dx + vy * dy) / d, -1, 1));
    const cost = ang * 1.6 + d / 45 + (m.gk ? .9 : 0);
    if (ang < 1.25 && cost < bc) { bc = cost; best = m; }
    if (cost < fc) { fc = cost; fb = m; }
  }
  return best || fb;
}
/** Passe longue : partenaire loin dans la direction visée */
function chooseLongPass(G, p, dx, dy) {
  let best = null, bs = -1e9;
  for (const m of G.byTeam[p.t]) {
    if (m === p || m.gk) continue;
    const vx = m.x - p.x, vy = m.y - p.y, d = hyp(vx, vy); if (d < 8) continue;
    const ang = Math.acos(clamp((vx * dx + vy * dy) / d, -1, 1));
    const s = -ang * 2.2 + Math.min(d, 55) / 14 + (inBox(p.t, m.x, m.y) ? .6 : 0);
    if (ang < 1.3 && s > bs) { bs = s; best = m; }
  }
  return best || choosePass(G, p, dx, dy);
}
function bestPassTarget(G, p, allowBack) {
  let best = null, bs = -1e9; const d = dirOf(p.t), opp = G.byTeam[1 - p.t];
  for (const m of G.byTeam[p.t]) {
    if (m === p || m.gk) continue;
    const dd = dist(p, m); if (dd < 5 || dd > 48) continue;
    let open = 99;
    for (const q of opp) open = Math.min(open, segDist(q.x, q.y, p.x, p.y, m.x, m.y), dist(q, m) * .8);
    if (open < 2.2) continue;
    const fwd = (m.y - p.y) * d;
    if (!allowBack && fwd < -4) continue;
    const s = fwd * .5 + Math.min(open, 10) * 1.3 - dd * .08 + (inBox(p.t, m.x, m.y) ? 4 : 0) + rnd(0, 3);
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1); return hyp(px - ax - dx * t, py - ay - dy * t); }

/* ---------- Joueur humain ---------- */
function humanControl(G, t, I, dt) {
  const b = G.ball, own = b.owner;
  G.hold[t] = !!I.bDown;
  let c = G.ctrl[t];
  if (own && own.t === t && !own.gk && own !== c) c = G.ctrl[t] = own;
  if (!c || c.gk) c = G.ctrl[t] = nearestToBall(G, t, null);
  const mag = Math.min(1, I.mag);
  if (c.stun > 0) steer(c, 0, 0, dt, 4);
  else if (mag > .12) { const sp = maxSp(G, c) * (.5 + .5 * mag); steer(c, I.jx / I.mag * sp, I.jy / I.mag * sp, dt); }
  else if (!own && (G.passTarget === c || G.land)) { const q = G.land || [b.x + b.vx * .25, b.y + b.vy * .25]; moveTo(G, c, q[0], q[1], 1, dt); } // sans joystick, il va au point de chute
  else steer(c, 0, 0, dt);

  if (own === c) {
    const dx = mag > .3 ? I.jx / I.mag : c.fx, dy = mag > .3 ? I.jy / I.mag : c.fy;
    G.preview[t] = choosePass(G, c, dx, dy);
    if (I.lob) { passTo(G, c, chooseLongPass(G, c, dx, dy), { loft: true }); G.charge[t] = 0; G.preview[t] = null; }
    else if (I.a) { passTo(G, c, G.preview[t]); G.charge[t] = 0; G.preview[t] = null; }
    else {
      if (I.bDown) G.charge[t] = Math.min(1, G.charge[t] + dt / .85);
      if (I.rel) {
        const pw = Math.max(.18, I.relCharge || G.charge[t]);
        const aim = mag > .25 ? clamp(I.jx / I.mag * 1.25, -1, 1) : clamp((CX - c.x) / CX * .6, -.6, .6);
        shoot(G, c, pw, aim); G.charge[t] = 0; G.preview[t] = null;
      }
    }
  } else {
    G.preview[t] = null; G.charge[t] = 0;
    if (own && own.gk && own.t === t && (I.a || I.lob)) {
      const dx = mag > .3 ? I.jx / I.mag : 0, dy = mag > .3 ? I.jy / I.mag : dirOf(t);
      if (I.lob) passTo(G, own, chooseLongPass(G, own, dx, dy), { loft: true }); else passTo(G, own, choosePass(G, own, dx, dy));
    } else if (I.a) switchPlayer(G, t);
    if (I.b && !(G.land && !own)) tackle(G, c); // ballon en l'air : TIR sert à préparer la reprise, pas à tacler
  }
}

/* ---------- IA ---------- */
/* Rôles : i=1 latéral gauche, i=2 latéral droit, i=3 ailier/attaquant gauche, i=4 ailier/attaquant droit (vu de l'équipe 0). */
const sideOf = p => (p.i === 1 || p.i === 3) ? (p.t === 0 ? -1 : 1) : (p.t === 0 ? 1 : -1); // -1 = côté x petit
function oppMarked(G, p) { // adversaire suivi en phase défensive
  const opp = G.byTeam[1 - p.t];
  return p.i === 1 ? opp[4] : p.i === 2 ? opp[3] : p.i === 3 ? opp[2] : opp[1];
}
function homeTarget(G, p, possess) {
  const b = G.ball, d = dirOf(p.t), gy = atkY(p.t), oy = ownY(p.t), atk = p.i >= 3, side = sideOf(p);
  const prog = 1 - toGoalOf(p.t, b.y) / FL; // 0 = près de notre but, 1 = près du but adverse
  const ballSide = b.x < CX ? -1 : 1;
  let tx, ty;
  if (possess) {
    const o = b.owner;
    if (atk) {
      const mate = G.byTeam[p.t][p.i === 3 ? 4 : 3];
      const striker = o === mate ? true : (side !== ballSide); // l'attaquant côté opposé au ballon attaque la surface
      if (prog > .45 && striker) { // appel dans la surface (premier ou second poteau)
        tx = CX + side * (Math.abs(b.x - CX) > 12 ? rnd(1, 5) : 7); ty = gy - d * (Math.abs(b.x - CX) > 12 ? rnd(7, 11) : 13);
      } else if (prog > .45) { // soutien : en retrait pour une remise ou un centre en retrait
        tx = CX + side * 9; ty = gy - d * 21;
      } else { // construction : il s'écarte et propose plus haut
        tx = CX + side * 20; ty = b.y + d * 20;
      }
    } else {
      // latéraux : montent avec le jeu ; celui du côté du ballon dédouble quand on attaque
      const overlap = prog > .5 && side === ballSide && o && o.i >= 3 && Math.abs(b.x - CX) > 10;
      if (overlap) { tx = CX + side * 26; ty = b.y + d * 9; }
      else { tx = CX + side * 15; ty = clamp(b.y - d * 14, Math.min(oy, CX + 18), Math.max(oy, CX + 18)); ty = p.t === 0 ? clamp(b.y + 14, 34, 86) : clamp(b.y - 14, 14, 66); }
    }
  } else {
    // sans ballon : marquage côté but de l'adversaire de référence, bloc compact
    const m = oppMarked(G, p);
    if (!atk) {
      const k = 2.6 / (hyp(oy - m.y, CX - m.x) || 1);
      tx = m.x + (CX - m.x) * k * .6 + (b.x - m.x) * .12; ty = m.y + (oy - m.y) * k * 3;
      // ne pas monter plus haut que le ballon
      ty = p.t === 0 ? Math.max(ty, b.y + 3) : Math.min(ty, b.y - 3);
    } else {
      // attaquants : coupent la ligne de passe vers le défenseur adverse, sans trop redescendre
      tx = m.x * .55 + b.x * .45; ty = (m.y + b.y) / 2;
      ty = p.t === 0 ? clamp(ty, 30, 70) : clamp(ty, 30, 70);
    }
  }
  return [clamp(tx + p.ox * .4, 4, FW - 4), clamp(ty + p.oy * .4, 4, FL - 4)];
}
function boxRunner(G, p) {
  let best = null, bs = -1e9; const opp = G.byTeam[1 - p.t];
  for (const m of G.byTeam[p.t]) {
    if (m === p || m.gk || !inBox(p.t, m.x, m.y)) continue;
    let open = 99; for (const q of opp) if (!q.gk) open = Math.min(open, dist(q, m));
    const s = open * 1.2 - Math.abs(m.x - CX) * .3 + rnd(0, 2);
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
function aiOwner(G, p, dt) {
  const A = G.ai[p.t], gy = atkY(p.t), d = dirOf(p.t);
  const tg = toGoalOf(p.t, p.y), wide = Math.abs(p.x - CX);
  let near = null, nd = 99;
  for (const q of G.byTeam[1 - p.t]) { const dd = dist(q, p); if (dd < nd) { nd = dd; near = q; } }
  p.aiT -= dt;
  if (p.aiT <= 0 && G.ball.protect <= .2) {
    p.aiT = A.react * rnd(.55, 1.05);
    const gk = G.byTeam[1 - p.t][0];
    // 1. Frappe : plus on est proche et axial, plus on tente
    const angleOk = wide < 6 + tg * .55;
    const range = 23 * A.shoot;
    if (tg < range && angleOk && Math.random() < .25 + (range - tg) / range * .7 - (nd < 2.5 ? .15 : 0)) {
      const side = gk.x > CX ? -1 : 1; shoot(G, p, rnd(.55, 1), side * rnd(.35, .9)); return;
    }
    // 2. Centre depuis le côté
    if (wide > 11 && tg < 32) {
      const m = boxRunner(G, p);
      if (m && Math.random() < (tg < 18 ? .8 : .45)) { passTo(G, p, m, { cross: true }); return; }
      // centre en retrait si on est au fond
      if (tg < 9) { const back = bestPassTarget(G, p, true); if (back) { passTo(G, p, back); return; } }
    }
    // 3. Sous pression : on donne (même en retrait)
    if (nd < 4 && Math.random() < .7) { const m = bestPassTarget(G, p, true); if (m) { passTo(G, p, m); return; } }
    // 4. Passe qui fait avancer le jeu (dans la course d'un partenaire)
    if (Math.random() < .22) { const m = bestPassTarget(G, p, false); if (m && (m.y - p.y) * d > 8) { passTo(G, p, m, { through: m.vy * d > 6 }); return; } }
  }
  // Conduite : un ailier remonte son couloir, un axial va vers le but en évitant le défenseur
  let tx, ty = gy;
  if (wide > 12 && tg > 14) { tx = CX + Math.sign(p.x - CX) * Math.min(26, wide + 2); ty = p.y + d * 20; }
  else tx = CX + (p.x - CX) * .6;
  if (near && nd < 8 && (near.y - p.y) * d > 0) tx = p.x + (p.x >= near.x ? 1 : -1) * 10;
  moveTo(G, p, clamp(tx, 3, FW - 3), clamp(ty, 2, FL - 2), 1, dt);
}
function aiGK(G, p, dt) {
  const b = G.ball, gy = ownY(p.t), d = dirOf(p.t);
  if (b.owner === p) {
    steer(p, 0, 0, dt); p.fx = 0; p.fy = d; p.holdT -= dt;
    if (p.holdT <= 0 && !(G.cfg.humans[p.t] && p.holdT > -1.2)) {
      let m = Math.random() < .7 ? bestPassTarget(G, p, true) : null; if (!m) m = G.byTeam[p.t][Math.random() < .5 ? 1 + (Math.random() * 2 | 0) : 3 + (Math.random() * 2 | 0)]; passTo(G, p, m);
    }
    return;
  }
  const lineY = gy + d * 2.4;
  let tx = CX + clamp((b.x - CX) * .35, -GH + 1.5, GH - 1.5), ty = lineY, u = .9;
  const sp = hyp(b.vx, b.vy);
  const inBox = Math.abs(b.x - CX) < 18 && Math.abs(b.y - gy) < 14;
  if (!b.owner && sp > 12 && Math.sign(gy - b.y) === Math.sign(b.vy)) {
    const tt = (lineY - b.y) / b.vy;
    if (tt > 0 && tt < 1.6) { tx = clamp(b.x + b.vx * tt, CX - GH + .5, CX + GH - .5); u = 1.3; }
  } else if (!b.owner && inBox && sp < 20) {
    let closest = true; for (const q of G.players) { if (q !== p && dist(q, b) < dist(p, b) - 1) { closest = false; break; } }
    if (closest) { tx = b.x; ty = b.y; u = 1.15; }
  } else if (b.owner && b.owner.t !== p.t && inBox) { tx = CX + (b.x - CX) * .5; ty = gy + (b.y - gy) * .3; }
  moveTo(G, p, tx, ty, u, dt);
}
function aiField(G, p, dt) {
  const b = G.ball, own = b.owner, A = G.ai[p.t];
  p.offT -= dt; if (p.offT <= 0) { p.offT = rnd(1.5, 3); p.ox = rnd(-4, 4); p.oy = rnd(-3, 3); }
  if (!own && G.passTarget === p) { const q = G.land || [b.x + b.vx * .3, b.y + b.vy * .3]; moveTo(G, p, q[0], q[1], 1, dt); return; }
  const possess = own && own.t === p.t;
  if (possess) { const h = homeTarget(G, p, true); moveTo(G, p, h[0], h[1], .85, dt); return; }
  const gkHas = own && own.gk;
  if (!own && b.cross && G.passPt && G.passTarget && G.passTarget.t !== p.t && !p.gk && p.i <= 2 && G.cover[p.t] !== p) { moveTo(G, p, G.passPt[0], G.passPt[1], 1, dt); return; }
  const ourLob = G.land && G.passTarget && G.passTarget.t === p.t && G.passTarget !== p; // notre passe en l'air : seul le receveur y va
  if (!gkHas && G.chaser[p.t] === p && !ourLob) {
    const q = G.land || [b.x + b.vx * .3, b.y + b.vy * .3];
    moveTo(G, p, q[0], q[1], G.land ? 1 : G.cfg.humans[p.t] ? .85 : 1, dt);
    if (own && dist(p, b) < 3.3) { p.aiT -= dt; if (p.aiT <= 0) { p.aiT = A.react * rnd(.8, 1.6); if (Math.random() < .32 * A.tack) tackle(G, p); } }
    return;
  }
  if (!gkHas && G.cover[p.t] === p && !ourLob) { const gy = ownY(p.t); moveTo(G, p, b.x * .7 + CX * .3, b.y + (gy - b.y) * .35, .9, dt); return; }
  const h = homeTarget(G, p, false); moveTo(G, p, h[0], h[1], .8, dt);
}
function aiPlayer(G, p, dt) {
  if (p.stun > 0) { steer(p, 0, 0, dt, 4); return; }
  if (p.gk) return aiGK(G, p, dt);
  if (G.ball.owner === p) return aiOwner(G, p, dt);
  aiField(G, p, dt);
}

/* ---------- Ballon ---------- */
function ballUpdate(G, dt) {
  if (G.ball.z > (G.ball.maxz || 0)) G.ball.maxz = G.ball.z;
  const b = G.ball;
  if (b.owner) {
    const o = b.owner, off = PR + BR + .15;
    b.x = clamp(o.x + o.fx * off, BR, FW - BR); b.y = clamp(o.y + o.fy * off, .3, FL - .3); b.vx = o.vx; b.vy = o.vy;
    b.spin += hyp(o.vx, o.vy) * dt * .6;
    b.protect -= dt;
    return;
  }
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.z > 0 || b.vz > 0) {
    b.vz -= GRAV * dt; b.z += b.vz * dt;
    if (b.z <= 0) { b.z = 0; if (b.vz < -5) { b.vz = -b.vz * .32; b.vx *= .75; b.vy *= .75; } else { b.vz = 0; b.cross = false; } }
  }
  const f = Math.exp(-(b.z > 0 ? .12 : .9) * dt); b.vx *= f; b.vy *= f;
  const sp = hyp(b.vx, b.vy); b.spin += sp * dt * .6;
  if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) * .6; }
  if (b.x > FW - BR) { b.x = FW - BR; b.vx = -Math.abs(b.vx) * .6; }
  for (const py of [0, FL]) for (const px of [CX - GH, CX + GH]) {
    const dx = b.x - px, dy = b.y - py, d = hyp(dx, dy);
    if (d < BR + .4 && d > 0) { const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 1.7 * dot * nx; b.vy -= 1.7 * dot * ny; b.x = px + nx * (BR + .41); b.y = py + ny * (BR + .41); ev(G, 'post', {}); } }
  }
  if (b.y < 0 || b.y > FL) {
    const top = b.y < 0;
    if (Math.abs(b.x - CX) < GH - BR * .3 && b.z < 2.4) goalScored(G, top ? 0 : 1);
    else goalKick(G, top ? 1 : 0);
    return;
  }
  if (b.lift > 0) { b.lift -= dt; return; } // le ballon décolle : personne ne peut le toucher
  let cand = null, cd = 1e9;
  for (const p of G.players) {
    if (p.kcd > 0 || p.stun > 0) continue;
    const box = p.gk && Math.abs(p.y - ownY(p.t)) < 15 && Math.abs(p.x - CX) < 19;
    if (b.z > (box ? 3.2 : 2.5)) continue; // trop haut
    const reach = PR + BR + .5 + (box ? 1.6 : 0);
    const d = hyp(p.x - b.x, p.y - b.y);
    if (d < reach && d < cd) { cd = d; cand = p; }
  }
  if (cand) {
    const p = cand;
    const box = p.gk && Math.abs(p.y - ownY(p.t)) < 15 && Math.abs(p.x - CX) < 19;
    if (!box && b.z > .25 && b.last && b.last.t === p.t && canVolley(G, p) && !(p.r >= 92 && b.z > 1.1 && isCtrl(G, p))) { volley(G, p); return; }
    if (b.z > .9 && !box) {
      // un coéquipier contrôle de la poitrine ; dans la surface adverse sur un centre, on reprend de la tête
      const mate = b.last && b.last.t === p.t, shotZone = toGoalOf(p.t, p.y) < 22 && Math.abs(p.x - CX) < 16;
      if (mate && !(shotZone && (b.cross || p.r >= 92))) { giveBall(G, p); ev(G, 'control', {}); return; }
      header(G, p); return;
    }
    if (box && b.z > .9) { if (Math.random() < .8 + G.ai[p.t].gk) { p.st.arr++; giveBall(G, p); ev(G, 'save', {}); } else { p.kcd = .5; b.vx = -b.vx * .3 + rnd(-8, 8); b.vy = -b.vy * .3; b.vz = 4; } return; }
    if (box && sp > 14) {
      const ch = clamp(.84 - (sp - 28) / 45 + (T(G, p).def - 75) / 120 + G.ai[p.t].gk, .15, .96);
      if (Math.random() < ch + (p.r - 84) / 100) { p.st.arr++; giveBall(G, p); ev(G, 'save', {}); }
      else if (Math.random() < .55) { p.kcd = .6; b.vx *= .85; b.vy *= .85; b.vx += rnd(-4, 4); }
      else { p.kcd = .5; b.vx = -b.vx * .3 + rnd(-9, 9); b.vy = -b.vy * .35; ev(G, 'post', {}); }
    } else {
      const ch = p === G.passTarget || sp < 30 ? 1 : clamp(1.4 - sp / 55, .3, 1);
      if (Math.random() < ch) giveBall(G, p);
      else { p.kcd = .25; b.vx *= .7; b.vy *= .7; }
    }
  }
}
export const clockMin = G => Math.min(90, Math.floor(G.time / G.dur * 90));
function goalScored(G, t) {
  const b = G.ball;
  G.score[t]++;
  const own = b.last && b.last.t !== t, sc = b.last;
  if (sc && !own) sc.st.but++;
  G.scorers.push({ t, name: sc ? sc.name : '', num: sc ? sc.num : 0, min: clockMin(G), own });
  // Beau but : reprise, retournée, tête, frappe de loin ou lob -> pause plus longue pour le ralenti 3D
  const dist = b.ky == null ? 0 : (t === 0 ? b.ky : FL - b.ky);
  const beau = !own && !!sc && (['volley', 'bicycle', 'header'].includes(b.spec) || dist >= 24 || (b.maxz || 0) > 2.8);
  G.state = 'goal'; G.stateT = 2.8; G.nextKick = 1 - t; G.passTarget = null;
  ev(G, 'goal', { t });
  if (beau) ev(G, 'beau', { n: b.spec === 'bicycle' ? 3 : b.spec === 'volley' ? 2 : 1 });
  banner(G, 'BUT !', own ? `Contre son camp · ${sc ? sc.name : ''}` : `${sc ? sc.name : G.team[t].name} · ${clockMin(G)}'`, 2.6, t);
}
function goalKick(G, t) {
  const gk = G.byTeam[t][0];
  gk.x = CX; gk.y = t === 0 ? FL - 4.5 : 4.5; gk.vx = gk.vy = 0; G.ball.z = G.ball.vz = 0;
  giveBall(G, gk); gk.holdT = 1.4;
  banner(G, 'SORTIE', 'Six mètres', 1);
}

/** Avance la simulation de dt secondes. inputs[t] = entrées du joueur humain t (coordonnées terrain). */
export function step(G, inputs, dt) {
  if (G.ended) return;
  G.stateT -= dt;
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.life) G.banner = null; }
  const st = G.state;
  if (st === 'kickoff') { if (G.stateT <= 0) { G.state = 'play'; ev(G, 'whistle', { n: 1 }); } return; }
  if (st === 'goal') {
    const b = G.ball; b.x += b.vx * dt; b.y += b.vy * dt; const f = Math.exp(-3 * dt); b.vx *= f; b.vy *= f; b.z = Math.max(0, b.z - dt * 3);
    b.y = clamp(b.y, -GD + BR, FL + GD - BR); if (b.y < 0 || b.y > FL) b.x = clamp(b.x, CX - GH + BR, CX + GH - BR);
    for (const p of G.players) { steer(p, 0, 0, dt, 3); p.x += p.vx * dt; p.y += p.vy * dt; }
    if (G.stateT <= 0) setupKickoff(G, G.nextKick);
    return;
  }
  if (st === 'half') { if (G.stateT <= 0) { G.half = 2; setupKickoff(G, 1, true); } return; }
  if (st === 'end') { if (G.stateT <= 0) G.ended = true; return; }

  G.time += dt;
  if (G.half === 1 && G.time >= G.dur / 2) { G.time = G.dur / 2; G.state = 'half'; G.stateT = 2.6; banner(G, 'MI-TEMPS', `${G.team[0].short} ${G.score[0]} – ${G.score[1]} ${G.team[1].short}`, 2.5); ev(G, 'whistle', { n: 2 }); return; }
  if (G.time >= G.dur) { G.time = G.dur; G.state = 'end'; G.stateT = 2.8; banner(G, 'FIN DU MATCH', `${G.team[0].short} ${G.score[0]} – ${G.score[1]} ${G.team[1].short}`, 2.8); ev(G, 'whistle', { n: 3 }); return; }

  const b = G.ball;
  if (b.owner) G.stats.poss[b.owner.t] += dt;
  if (G.passT > 0) { G.passT -= dt; if (G.passT <= 0) G.passTarget = null; }
  const L = landing(b); G.land = L[0] >= 0 && L[1] > 0 && L[1] < FL ? [L[0], L[1]] : null;
  const px = G.land ? G.land[0] : b.x + b.vx * .3, py = G.land ? G.land[1] : b.y + b.vy * .3;
  for (let t = 0; t < 2; t++) {
    const cand = G.byTeam[t].filter(p => !p.gk && !isCtrl(G, p)).sort((a, q) => hyp(a.x - px, a.y - py) - hyp(q.x - px, q.y - py));
    G.chaser[t] = cand[0] || null; G.cover[t] = cand[1] || null;
  }
  for (let t = 0; t < 2; t++) if (G.cfg.humans[t]) humanControl(G, t, inputs[t] || blankInput(), dt);
  for (const p of G.players) if (!isCtrl(G, p)) aiPlayer(G, p, dt);

  for (const p of G.players) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = clamp(p.x, 1.5, FW - 1.5); p.y = clamp(p.y, 1.5, FL - 1.5);
    if (p.gk) { p.y = p.t === 0 ? Math.max(p.y, FL - 16) : Math.min(p.y, 16); p.x = clamp(p.x, CX - 20, CX + 20); }
    const sp = hyp(p.vx, p.vy);
    if (sp > 1.2) { const k = Math.min(1, dt * (b.owner === p ? 7 : 12)); p.fx += (p.vx / sp - p.fx) * k; p.fy += (p.vy / sp - p.fy) * k; const l = hyp(p.fx, p.fy) || 1; p.fx /= l; p.fy /= l; }
    if (p.kcd > 0) p.kcd -= dt; if (p.tcd > 0) p.tcd -= dt; if (p.stun > 0) p.stun -= dt; if (p.flip > 0) p.flip -= dt;
  }
  const P = G.players;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], q = P[j], dx = q.x - a.x, dy = q.y - a.y, d = hyp(dx, dy);
    if (d < PR * 2 && d > 0) { const o = (PR * 2 - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; q.x += nx * o; q.y += ny * o; }
  }
  ballUpdate(G, dt);
}

/* ---------- Réseau : état compact envoyé par l'hôte ---------- */
const r2 = v => Math.round(v * 100) / 100;
/** Point de chute du ballon en l'air (même physique que ballUpdate) : [x, y, temps restant] ou [-1, -1, 0] */
function landing(b) {
  if (b.owner || b.z < .3) return [-1, -1, 0];
  const t = (b.vz + Math.sqrt(b.vz * b.vz + 2 * GRAV * b.z)) / GRAV, k = (1 - Math.exp(-.12 * t)) / .12;
  let x = b.x + b.vx * k; if (x < BR) x = 2 * BR - x; if (x > FW - BR) x = 2 * (FW - BR) - x; // rebond sur la touche
  return [r2(clamp(x, BR, FW - BR)), r2(clamp(b.y + b.vy * k, -GD, FL + GD)), r2(t)];
}
export function snapshot(G) {
  const b = G.ball;
  return {
    p: G.players.map(p => [r2(p.x), r2(p.y), r2(p.fx), r2(p.fy), p.stun > 0 ? 1 : 0, p.flip > 0 ? r2(p.flip) : 0]),
    b: [r2(b.x), r2(b.y), r2(b.spin), b.owner ? G.players.indexOf(b.owner) : -1, r2(Math.hypot(b.vx, b.vy)), r2(b.z), ...landing(b)],
    sc: G.score, tm: r2(G.time), st: G.state, h: G.half,
    c: G.ctrl.map(p => p ? G.players.indexOf(p) : -1),
    pv: G.preview.map(p => p ? G.players.indexOf(p) : -1),
    ch: G.charge.map(r2),
    bn: G.banner ? [G.banner.id, G.banner.text, G.banner.sub, r2(G.banner.t), G.banner.life, G.banner.team] : null,
    ev: G.events.slice(-10).map(e => [e.s, e.type, e.t ?? e.n ?? e.pw ?? 0]),
    end: G.ended ? 1 : 0,
  };
}
/** Résumé de fin de match (stats + joueurs), envoyé une fois en fiable. */
export function summary(G) {
  return {
    score: G.score, stats: G.stats, scorers: G.scorers,
    players: G.players.map(p => ({ t: p.t, i: p.i, name: p.name, num: p.num, r: p.r, gk: p.gk, st: p.st })),
  };
}
