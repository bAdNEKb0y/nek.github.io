/**
 * Prédiction côté invité : son joueur bouge tout de suite au doigt, sans attendre l'aller-retour réseau.
 * On simule localement le joueur contrôlé puis on le recolle en douceur à la position de l'hôte
 * (extrapolée de la latence). Le ballon suit s'il est dans ses pieds.
 */
export function predictOwn(g, mine, dt, now, rtt) {
  const L = g.snaps[g.snaps.length - 1], V = g.V;
  if (!L || !V || L.s.st !== 'play' || V.st !== 'play') { g.pred = null; return; }
  const ci = L.s.c[g.slot ?? 1] ?? -1;
  if (ci < 0 || L.s.p[ci][4]) { g.pred = null; return; }
  const src = L.s.p[ci];
  let P = g.pred;
  if (!P || P.i !== ci) {
    const iv = V.p[ci];
    P = g.pred = { i: ci, x: iv[0], y: iv[1], vx: 0, vy: 0 };
  }
  // Même physique que le moteur (vitesse max, accélération)
  const tm = g.M.team[g.side ?? 1], pl = g.M.players[ci];
  const own = L.s.b[3] === ci;
  let sp = 13 + ((tm.vit ?? 80) - 60) * .22 + ((pl?.r ?? 80) - (tm.ovr ?? pl?.r ?? 80)) * .12;
  if (own) sp *= .9;
  const mag = Math.min(1, mine.m || 0);
  let tvx = 0, tvy = 0;
  if (mag > .12) { const n = Math.hypot(mine.jx, mine.jy) || 1; const s = sp * (.5 + .5 * mag); tvx = mine.jx / n * s; tvy = mine.jy / n * s; }
  else { tvx = P.vx * .2; tvy = P.vy * .2; }
  const k = Math.min(1, dt * 9);
  P.vx += (tvx - P.vx) * k; P.vy += (tvy - P.vy) * k;
  P.x += P.vx * dt; P.y += P.vy * dt;
  // Recalage vers l'état de l'hôte (en avance de la latence)
  const lag = ((rtt || g.net?.rtt || 60) + (now - L.at)) / 1000;
  const tx = src[0] + P.vx * Math.min(.25, lag), ty = src[1] + P.vy * Math.min(.25, lag);
  const ex = tx - P.x, ey = ty - P.y, err = Math.hypot(ex, ey);
  if (err > 7) { P.x = tx; P.y = ty; }
  else { const c = Math.min(1, dt * (err > 2.5 ? 8 : 3.5)); P.x += ex * c; P.y += ey * c; }
  // Écrit la position prédite dans la vue (et le ballon s'il est collé au joueur)
  const iv = V.p[ci], dx = P.x - iv[0], dy = P.y - iv[1];
  const spd = Math.hypot(P.vx, P.vy);
  const p = V.p.slice(); p[ci] = [P.x, P.y, spd > 1.5 ? P.vx / spd : iv[2], spd > 1.5 ? P.vy / spd : iv[3], iv[4], iv[5] || 0];
  let b = V.b;
  if (V.b[3] === ci) b = [V.b[0] + dx, V.b[1] + dy, V.b[2], V.b[3], V.b[4], V.b[5] || 0, -1, -1, 0];
  g.V = { ...V, p, b };
}

