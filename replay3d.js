/* Ralenti 3D des beaux buts (reprise, retournée, tête, frappe de loin, lob).
   Three.js n'est chargé qu'au début d'un match ; s'il ne charge pas, le jeu garde le ralenti 2D. */
import { FW, FL, GH, GD } from './engine.js';
import { lookFor } from './ui.js';

const URL3 = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
let THREE = null, loading = null;
export function preload3D() {
  if (!loading) loading = import(URL3).then(m => { THREE = m; return m; }).catch(() => { loading = null; return null; });
  return loading;
}
export const ready3D = () => !!THREE;

const GHT = 3.4, ZK = GHT / 2.4; // hauteur du but en 3D et échelle des hauteurs du ballon
const GK_COL = ['#2dd4a0', '#b07cff'];
const W2X = (wx, wy) => [wy - FL / 2, wx - FW / 2]; // monde (largeur, longueur) -> (X, Z)

function pitchTexture() {
  const M = 6, S = 10, c = document.createElement('canvas');
  c.width = (FL + 2 * M) * S; c.height = (FW + 2 * M) * S;
  const g = c.getContext('2d');
  g.fillStyle = '#1d6a3c'; g.fillRect(0, 0, c.width, c.height);
  for (let i = -1; i < 12; i++) { g.fillStyle = i % 2 ? '#247e4a' : '#1f7243'; g.fillRect((M + i * 10) * S, 0, 10 * S, c.height); }
  for (let n = 0; n < 9000; n++) { g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'; g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2); }
  const P = (wy, wx) => [(wy + M) * S, (wx + M) * S];
  g.strokeStyle = 'rgba(245,250,240,.92)'; g.lineWidth = 3.5; g.fillStyle = 'rgba(245,250,240,.92)';
  const [x0, y0] = P(0, 0); g.strokeRect(x0, y0, FL * S, FW * S);
  const [mx, my] = P(FL / 2, FW / 2);
  g.beginPath(); g.moveTo(mx, y0); g.lineTo(mx, y0 + FW * S); g.stroke();
  g.beginPath(); g.arc(mx, my, 9 * S, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.fill();
  const a = Math.asin(4 / 9);
  for (const left of [true, false]) {
    const ex = left ? x0 : x0 + FL * S, s = left ? 1 : -1;
    g.strokeRect(left ? ex : ex - 14 * S, my - 18 * S, 14 * S, 36 * S);
    g.strokeRect(left ? ex : ex - 5 * S, my - 10 * S, 5 * S, 20 * S);
    g.beginPath(); g.arc(ex + s * 10 * S, my, 5, 0, Math.PI * 2); g.fill();
    g.beginPath();
    if (left) g.arc(ex + 10 * S, my, 9 * S, -Math.PI / 2 + a, Math.PI / 2 - a); else g.arc(ex - 10 * S, my, 9 * S, Math.PI / 2 + a, Math.PI * 1.5 - a);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, w: FL + 2 * M, h: FW + 2 * M };
}
function crowdTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#121a17'; g.fillRect(0, 0, 1024, 256);
  const cols = ['#e8e2d6', '#f0776b', '#5ad1e6', '#ffc94a', '#2b2f3a', '#c9d3cf', '#ff4fa3', '#f1c9a5', '#3b82f6'];
  for (let r = 0; r < 16; r++) { g.fillStyle = r % 2 ? '#18221e' : '#141c19'; g.fillRect(0, r * 16, 1024, 16); for (let x = Math.random() * 6; x < 1024; x += 6 + Math.random() * 5) { g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.globalAlpha = .45 + Math.random() * .5; g.beginPath(); g.arc(x, r * 16 + 7, 2.6, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  return t;
}
function ballTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#f7f7f7'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1d2420';
  for (const [x, y] of [[32, 30], [96, 64], [160, 30], [224, 64], [32, 98], [160, 98], [96, 0], [224, 128]]) {
    g.beginPath(); for (let j = 0; j < 5; j++) { const a = j * 1.2566 - Math.PI / 2; g[j ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 15, y + Math.sin(a) * 15); } g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * Lance le ralenti 3D. frames = [{ at, V }] (V = état affiché), M = méta du match.
 * Renvoie { stop() } ; onEnd est appelé une seule fois à la fin (ou si on passe).
 */
export function play3D({ host, frames, M, scorer, title, onEnd }) {
  if (!THREE || !frames || frames.length < 6) return null;
  const T = THREE;
  const wrap = document.createElement('div'); wrap.className = 'r3d';
  wrap.innerHTML = `<div class="r3d-top"><span class="r3d-live">● RALENTI 3D</span><b>${title || 'BUT MAGNIFIQUE !'}</b></div>
    <button class="r3d-skip" type="button">Passer ⏭</button><div class="r3d-name">${scorer || ''}</div>`;
  host.appendChild(wrap);
  const cv = document.createElement('canvas'); wrap.prepend(cv);
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }); }
  catch { wrap.remove(); return null; }
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene(); scene.background = new T.Color('#0a120f'); scene.fog = new T.Fog('#0a120f', 70, 160);
  const cam = new T.PerspectiveCamera(42, 1, .1, 400);
  const resize = () => { const w = wrap.clientWidth || innerWidth, h = wrap.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  resize(); addEventListener('resize', resize);
  const disposables = [];
  const mat = (o, cls = T.MeshStandardMaterial) => { const m = new cls(o); disposables.push(m); return m; };
  const geo = g => { disposables.push(g); return g; };

  // Lumières de stade
  scene.add(new T.HemisphereLight('#dfe9ff', '#1b3a26', .75));
  const sun = new T.DirectionalLight('#fff6e0', 1.9); sun.position.set(-30, 60, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 45, bottom: -45, near: 10, far: 150 });
  scene.add(sun);
  const fill = new T.DirectionalLight('#bcd3ff', .5); fill.position.set(40, 30, -30); scene.add(fill);

  // Pelouse + abords
  const pt = pitchTexture(); disposables.push(pt.tex);
  const pitch = new T.Mesh(geo(new T.PlaneGeometry(pt.w, pt.h)), mat({ map: pt.tex, roughness: .95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
  const out = new T.Mesh(geo(new T.PlaneGeometry(220, 160)), mat({ color: '#143d25', roughness: 1 }));
  out.rotation.x = -Math.PI / 2; out.position.y = -.02; out.receiveShadow = true; scene.add(out);
  // Tribunes inclinées avec la foule
  const crowd = crowdTexture(); disposables.push(crowd);
  const standMat = mat({ map: crowd, roughness: 1 });
  const stand = (w, x, z, ry) => {
    const m = new T.Mesh(geo(new T.PlaneGeometry(w, 26)), standMat);
    m.position.set(x, 9, z); m.rotation.set(0, ry, 0); m.rotateX(-.62); scene.add(m);
  };
  stand(150, 0, -FW / 2 - 18, 0); stand(150, 0, FW / 2 + 18, Math.PI); stand(110, -FL / 2 - 20, 0, Math.PI / 2); stand(110, FL / 2 + 20, 0, -Math.PI / 2);
  // panneaux publicitaires
  const adMat = mat({ color: '#1f6f42', emissive: '#0d3a20', roughness: .6 });
  for (const s of [-1, 1]) { const ad = new T.Mesh(geo(new T.BoxGeometry(FL + 10, 1.1, .2)), adMat); ad.position.set(0, .55, s * (FW / 2 + 4)); scene.add(ad); }
  // projecteurs
  const lampMat = mat({ color: '#fffbe8', emissive: '#fffbe8', emissiveIntensity: 2 }, T.MeshStandardMaterial);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new T.Mesh(geo(new T.BoxGeometry(5, 2.4, .6)), lampMat); l.position.set(sx * (FL / 2 + 14), 30, sz * (FW / 2 + 22)); l.lookAt(0, 0, 0); scene.add(l); }

  // Buts : poteaux, barre, filet
  const postMat = mat({ color: '#ffffff', roughness: .35, metalness: .1 });
  const netMat = mat({ color: '#ffffff', wireframe: true, transparent: true, opacity: .35 }, T.MeshBasicMaterial);
  for (const side of [-1, 1]) {
    const X = side * FL / 2, g = new T.Group();
    const post = h => new T.Mesh(geo(new T.CylinderGeometry(.16, .16, h, 12)), postMat);
    for (const z of [-GH, GH]) { const p = post(GHT); p.position.set(X, GHT / 2, z); p.castShadow = true; g.add(p); }
    const bar = new T.Mesh(geo(new T.CylinderGeometry(.16, .16, GH * 2, 12)), postMat); bar.rotation.x = Math.PI / 2; bar.position.set(X, GHT, 0); bar.castShadow = true; g.add(bar);
    const back = new T.Mesh(geo(new T.PlaneGeometry(GH * 2, GHT, 22, 6)), netMat); back.position.set(X + side * GD, GHT / 2, 0); back.rotation.y = Math.PI / 2; g.add(back);
    const roof = new T.Mesh(geo(new T.PlaneGeometry(GD, GH * 2, 5, 22)), netMat); roof.rotation.x = -Math.PI / 2; roof.position.set(X + side * GD / 2, GHT, 0); g.add(roof);
    for (const z of [-GH, GH]) { const sd = new T.Mesh(geo(new T.PlaneGeometry(GD, GHT, 5, 6)), netMat); sd.position.set(X + side * GD / 2, GHT / 2, z); g.add(sd); }
    g.userData.back = back; g.userData.side = side; scene.add(g);
    (side < 0 ? (scene.userData.g0 = g) : (scene.userData.g1 = g));
  }

  // Joueurs : corps (maillot), short, tête, cheveux
  const bodyG = geo(new T.CapsuleGeometry(.6, 1.2, 4, 12)), shortG = geo(new T.CylinderGeometry(.62, .58, .55, 14)), headG = geo(new T.SphereGeometry(.38, 16, 12)), hairG = geo(new T.SphereGeometry(.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const players = M.players.map((m, i) => {
    const kit = M.kit[m.t], look = lookFor(m.name), g = new T.Group();
    const body = new T.Mesh(bodyG, mat({ color: m.gk ? GK_COL[m.t] : kit.c1, roughness: .7 })); body.position.y = 1.35; body.castShadow = true; g.add(body);
    const sh = new T.Mesh(shortG, mat({ color: m.gk ? '#1b1f1d' : kit.c2, roughness: .8 })); sh.position.y = .55; sh.castShadow = true; g.add(sh);
    const head = new T.Mesh(headG, mat({ color: look.skin, roughness: .8 })); head.position.y = 2.75; head.castShadow = true; g.add(head);
    if (look.hair) { const hr = new T.Mesh(hairG, mat({ color: look.hair, roughness: .9 })); hr.position.y = 2.8; hr.scale.setScalar(look.style === 10 || look.style === 2 ? 1.18 : 1); g.add(hr); }
    scene.add(g); return { g, body };
  });
  const btex = ballTexture(); disposables.push(btex);
  const ball = new T.Mesh(geo(new T.SphereGeometry(.42, 24, 16)), mat({ map: btex, roughness: .45 }));
  ball.castShadow = true; scene.add(ball);
  const trailPts = [];
  const trail = new T.Line(geo(new T.BufferGeometry()), mat({ color: '#ffe08a', transparent: true, opacity: .7 }, T.LineBasicMaterial)); scene.add(trail);

  // Temps du ralenti
  const t0 = frames[0].at, t1 = frames[frames.length - 1].at, span = t1 - t0;
  const SPEED = .42, DUR = Math.min(5600, span / SPEED);
  const lastB = frames[frames.length - 1].V.b, goalSide = lastB[1] < FL / 2 ? -1 : 1; // but visé (X = -50 ou +50)
  const firstB = frames[0].V.b;
  const pick = tt => { let i = 0; while (i < frames.length - 2 && frames[i + 1].at <= tt) i++; const A = frames[i], B = frames[i + 1] || A; const k = B.at > A.at ? Math.min(1, Math.max(0, (tt - A.at) / (B.at - A.at))) : 0; return [A.V, B.V, k]; };
  const L = (a, b, k) => a + (b - a) * k;
  const camPos = new T.Vector3(), camLook = new T.Vector3(), tmp = new T.Vector3();
  let first = true, start = performance.now(), raf = 0, done = false, spin = 0;

  function frame(now) {
    if (done) return;
    const el = now - start, k = Math.min(1, el / DUR);
    const tt = t0 + el * SPEED;
    const [A, B, f] = pick(Math.min(t1, tt));
    // joueurs
    A.p.forEach((pa, i) => {
      const pb = B.p[i] || pa, [X, Z] = W2X(L(pa[0], pb[0], f), L(pa[1], pb[1], f)), P = players[i];
      const moving = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > .001;
      P.g.position.set(X, moving ? Math.abs(Math.sin(now / 90 + i)) * .12 : 0, Z);
      const flip = pa[5] || 0; P.g.rotation.z = flip > 0 ? (.7 - flip) / .7 * Math.PI * 1.6 : 0;
    });
    // ballon
    const bx = L(A.b[0], B.b[0], f), by = L(A.b[1], B.b[1], f), bz = L(A.b[5] || 0, B.b[5] || 0, f);
    const [BX, BZ] = W2X(bx, by); ball.position.set(BX, .42 + bz * ZK, BZ);
    spin += (A.b[4] || 0) * .004; ball.rotation.set(spin, spin * .6, 0);
    trailPts.push(ball.position.clone()); if (trailPts.length > 26) trailPts.shift();
    trail.geometry.setFromPoints(trailPts);
    // filet qui se gonfle quand le ballon y entre
    for (const g of [scene.userData.g0, scene.userData.g1]) { const inside = g.userData.side * BX > FL / 2; g.userData.back.scale.z = 1; g.userData.back.position.x = g.userData.side * (FL / 2 + GD + (inside ? .9 : 0)); }
    // caméra de diffusion : derrière l'action puis elle tourne vers le côté du but
    const gx = goalSide * FL / 2, dirX = Math.sign(gx - BX) || goalSide;
    const ang = L(.15, 1.25, k * k * (3 - 2 * k)) * (firstB[0] > FW / 2 ? -1 : 1);
    const dist = L(19, 11, k), h = L(9, 3.4, k);
    tmp.set(BX - dirX * Math.cos(ang) * dist, h, BZ + Math.sin(ang) * dist * 1.1);
    const look = new T.Vector3(L(BX, gx, .25 + k * .3), L(1.2, .9 + bz * ZK * .5, k), BZ * .8);
    if (first) { camPos.copy(tmp); camLook.copy(look); first = false; }
    camPos.lerp(tmp, .08); camLook.lerp(look, .12);
    cam.position.copy(camPos); cam.lookAt(camLook);
    renderer.render(scene, cam);
    if (k >= 1) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (done) return; done = true; cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    wrap.classList.add('out');
    setTimeout(() => {
      try { disposables.forEach(d => d.dispose?.()); renderer.dispose(); renderer.forceContextLoss?.(); } catch { }
      wrap.remove();
    }, 260);
    onEnd?.();
  }
  wrap.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); stop(); });
  raf = requestAnimationFrame(frame);
  return { stop };
}
