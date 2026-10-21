/* Tutoriel pour les nouveaux joueurs : quelques écrans illustrés, affichés au premier lancement
   et accessibles à tout moment depuis l'accueil (« Comment jouer ? »). */
const KEY = 'fdp-tuto-v1';
const Y = '#ffc94a', C = '#5ad1e6', W = '#eef3ea', G1 = '#1f7144', G2 = '#24804e', K = '#0b1411';

const pitch = inner => `<svg viewBox="0 0 320 170" aria-hidden="true">
  <rect width="320" height="170" rx="14" fill="${G1}"/>${[0, 2, 4, 6].map(i => `<rect x="${i * 40 + 40}" width="40" height="170" fill="${G2}"/>`).join('')}
  <rect x="10" y="10" width="300" height="150" rx="2" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2"/>
  <line x1="160" y1="10" x2="160" y2="160" stroke="rgba(255,255,255,.6)" stroke-width="2"/>
  <circle cx="160" cy="85" r="26" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/>${inner}</svg>`;
const player = (x, y, n, col = Y, ring = false) => `${ring ? `<circle cx="${x}" cy="${y}" r="16" fill="none" stroke="${col}" stroke-width="3"/>` : ''}<circle cx="${x}" cy="${y}" r="10" fill="${col === Y ? '#ff4fa3' : '#2b6cb0'}" stroke="${K}" stroke-width="1.5"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="sans-serif">${n}</text>`;
const ball = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${K}" stroke-width="1"/>`;
const btn = (x, y, r, label, col = W, fill = 'rgba(6,12,10,.5)') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${col}" stroke-width="3"/><text x="${x}" y="${y + 5}" text-anchor="middle" font-size="${r * .42}" font-weight="800" fill="${col}" font-family="sans-serif">${label}</text>`;
const finger = (x, y) => `<g transform="translate(${x} ${y})"><circle r="13" fill="rgba(255,255,255,.25)"><animate attributeName="r" values="10;16;10" dur="1.2s" repeatCount="indefinite"/></circle><circle r="6" fill="#fff"/></g>`;

const STEPS = [
  { t: 'Bienvenue dans Foot de Poche', d: 'Des matchs de 5 contre 5 en ligne, chacun sur son téléphone. Un match dure quelques minutes. Tourne ton écran en paysage pour jouer.',
    art: `<svg viewBox="0 0 320 170" aria-hidden="true"><rect width="320" height="170" rx="14" fill="#13201a"/>
      <g transform="translate(160 85)"><rect x="-38" y="-62" width="76" height="124" rx="12" fill="none" stroke="${W}" stroke-width="5"><animateTransform attributeName="transform" type="rotate" values="0;0;-90;-90;0" keyTimes="0;.3;.5;.85;1" dur="3s" repeatCount="indefinite"/></rect></g>
      <text x="160" y="160" text-anchor="middle" font-size="14" font-weight="800" fill="${Y}" font-family="sans-serif">PAYSAGE</text></svg>` },
  { t: 'Se déplacer', d: 'Pose ton pouce n\'importe où sur la moitié gauche de l\'écran et fais-le glisser : c\'est ton joystick. Tu contrôles le joueur entouré.',
    art: pitch(`${player(190, 90, 10, Y, true)}${ball(204, 90)}<circle cx="70" cy="120" r="30" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.35)" stroke-width="2"/>
      <circle cx="84" cy="112" r="13" fill="${Y}"><animate attributeName="cx" values="70;88;70" dur="1.6s" repeatCount="indefinite"/><animate attributeName="cy" values="120;108;120" dur="1.6s" repeatCount="indefinite"/></circle>
      <path d="M210 90 h40" stroke="${Y}" stroke-width="3" stroke-dasharray="5 5" marker-end="url(#ar)"/><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${Y}"/></marker></defs>`) },
  { t: 'Passe courte', d: 'Appuie brièvement sur PASSE : le ballon part à ras de terre vers le coéquipier dans la direction de ton joystick (il est entouré en pointillés).',
    art: pitch(`${player(120, 100, 10, Y, true)}<circle cx="215" cy="60" r="16" fill="none" stroke="${Y}" stroke-width="2.5" stroke-dasharray="4 4"/>${player(215, 60, 7)}
      <circle r="5" fill="#fff" stroke="${K}"><animateMotion dur="1.4s" repeatCount="indefinite" path="M134 98 L206 64"/></circle>${btn(275, 125, 26, 'PASSE')}${finger(275, 125)}`) },
  { t: 'Passe en l\'air', d: 'Garde le doigt sur PASSE : le bouton devient « EN L\'AIR ». Relâche, et le ballon part en hauteur vers un coéquipier loin devant. Une cible au sol montre où il va tomber : tes joueurs y courent.',
    art: pitch(`${player(70, 120, 4, Y, true)}${player(240, 50, 9)}
      <g><circle cx="244" cy="54" r="15" fill="none" stroke="#ffe08a" stroke-width="2.5" stroke-dasharray="4 3"/><path d="M237 54 h14 M244 47 v14" stroke="#ffe08a" stroke-width="2"/></g>
      <path d="M80 116 Q160 -10 240 54" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-dasharray="5 6"/>
      <circle r="6" fill="#fff" stroke="${K}"><animateMotion dur="1.6s" repeatCount="indefinite" path="M80 116 Q160 -10 240 54"/></circle>${btn(280, 128, 24, 'EN L\'AIR', '#ffe08a')}`) },
  { t: 'Tirer', d: 'Maintiens TIR pour charger ta frappe, puis relâche. Oriente le joystick pour viser un côté du but. Si la jauge devient rouge, c\'est trop fort : le ballon risque de partir au-dessus.',
    art: pitch(`<rect x="300" y="62" width="10" height="46" fill="rgba(255,255,255,.2)" stroke="#fff" stroke-width="2"/>${player(220, 85, 10, Y, true)}
      <circle r="5" fill="#fff" stroke="${K}"><animateMotion dur="1s" repeatCount="indefinite" path="M234 85 L304 72"/></circle>
      <circle cx="80" cy="120" r="26" fill="${Y}" opacity=".9"/><text x="80" y="126" text-anchor="middle" font-size="13" font-weight="800" fill="${K}" font-family="sans-serif">TIR</text>
      <circle cx="80" cy="120" r="32" fill="none" stroke="#f0776b" stroke-width="5" stroke-dasharray="200" stroke-dashoffset="200"><animate attributeName="stroke-dashoffset" values="200;0;0" keyTimes="0;.8;1" dur="1.4s" repeatCount="indefinite"/></circle>`) },
  { t: 'Défendre', d: 'Sans le ballon, le bouton rouge devient VOLER : approche-toi du porteur et appuie pour tacler. CHANGER te fait prendre le joueur le plus proche du ballon.',
    art: pitch(`${player(150, 85, 3, Y, true)}${player(185, 85, 9, C)}${ball(172, 85)}${btn(250, 60, 24, 'VOLER', '#f0776b')}${btn(270, 125, 22, 'CHANGER')}${finger(250, 60)}`) },
  { t: 'Têtes et retournées', d: 'Sur un centre, ton joueur reprend de la tête tout seul. Garde TIR appuyé pendant que le ballon arrive en l\'air : un joueur noté 90+ tente une reprise de volée, un 92+ peut tenter une retournée !',
    art: pitch(`<rect x="300" y="62" width="10" height="46" fill="rgba(255,255,255,.2)" stroke="#fff" stroke-width="2"/>
      <g transform="translate(250 85)"><circle r="22" fill="none" stroke="#ffe08a" stroke-width="2" opacity=".7"><animate attributeName="r" values="14;26;14" dur="1s" repeatCount="indefinite"/></circle>
      <g><animateTransform attributeName="transform" type="scale" values="1 1;.2 1;1 1" dur="1s" repeatCount="indefinite"/><circle r="11" fill="#ff4fa3" stroke="${K}" stroke-width="1.5"/><text y="4" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="sans-serif">7</text></g></g>
      <text x="120" y="50" font-size="22" font-weight="900" fill="#ffe08a" font-family="sans-serif">RETOURNÉE !</text><text x="120" y="70" font-size="12" font-weight="700" fill="${W}" font-family="sans-serif">joueurs notés 92+</text>`) },
  { t: 'Packs et équipe', d: 'Chaque match te rapporte des pièces. Ouvre des packs pour trouver des stars et des légendes, puis crée ton équipe dans « Mon équipe ». Tu peux aussi défier un ami en duel de packs.',
    art: `<svg viewBox="0 0 320 170" aria-hidden="true"><rect width="320" height="170" rx="14" fill="#13201a"/>
      ${[[70, '#f3dc8c', '85'], [160, '#3b2f63', '91'], [250, '#fff3c4', '96']].map(([x, c, n], i) => `<g transform="translate(${x} 88)"><rect x="-34" y="-58" width="68" height="100" rx="10" fill="${c}" stroke="${i === 2 ? '#e6c25a' : 'rgba(255,255,255,.4)'}" stroke-width="2"><animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="${1.4 + i * .2}s" repeatCount="indefinite"/></rect><text x="-22" y="-34" font-size="18" font-weight="900" fill="${i === 1 ? '#f3d27a' : '#2a1d05'}" font-family="sans-serif">${n}</text></g>`).join('')}
      <text x="160" y="160" text-anchor="middle" font-size="13" font-weight="800" fill="${Y}" font-family="sans-serif">PACKS · COLLECTION · DUELS</text></svg>` },
];

let i = 0, onDone = null;
export const tutoSeen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
function render() {
  const el = document.getElementById('tuto'), s = STEPS[i], last = i === STEPS.length - 1;
  el.innerHTML = `<div class="tbox" role="dialog" aria-modal="true" aria-labelledby="tutoT">
    <div class="thead"><span>Comment jouer · ${i + 1}/${STEPS.length}</span><button class="link" data-t="skip">Passer</button></div>
    <div class="tart">${s.art}</div>
    <h2 id="tutoT">${s.t}</h2><p>${s.d}</p>
    <div class="tdots">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="tnav"><button class="btn" data-t="prev" ${i === 0 ? 'disabled' : ''}>Précédent</button><button class="btn primary" data-t="next">${last ? 'C\'est parti !' : 'Suivant'}</button></div></div>`;
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
    const a = b.dataset.t;
    if (a === 'prev' && i > 0) { i--; render(); }
    else if (a === 'next' && !last) { i++; render(); }
    else if (a === 'next' || a === 'skip') close();
  });
}
function close() { try { localStorage.setItem(KEY, '1'); } catch { } const el = document.getElementById('tuto'); el.hidden = true; el.innerHTML = ''; const cb = onDone; onDone = null; cb?.(); }
export function openTuto(cb) { i = 0; onDone = cb || null; document.getElementById('tuto').hidden = false; render(); }
document.addEventListener('keydown', e => {
  const el = document.getElementById('tuto'); if (!el || el.hidden) return;
  if (e.key === 'ArrowRight' && i < STEPS.length - 1) { i++; render(); }
  else if (e.key === 'ArrowLeft' && i > 0) { i--; render(); }
  else if (e.key === 'Escape') close();
});
