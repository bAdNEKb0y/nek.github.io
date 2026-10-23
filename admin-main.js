/* Page admin séparée : connexion, puis panel en direct */
import { sb } from './net.js';
import { $ } from './ui.js';
import { registerSW, enablePush, pushState } from './push.js';
import { startAdmin } from './admin.js';

const emailOf = u => `${u.toLowerCase()}@joueurs.footdepoche.app`;
let toastT = 0;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
let AC = null;
function ding() {
  try {
    AC ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime;
    for (const [f, d] of [[880, 0], [1320, .12]]) { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; o.type = 'triangle'; g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.25, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .3); o.connect(g).connect(AC.destination); o.start(t + d); o.stop(t + d + .32); }
  } catch { }
  navigator.vibrate?.([60, 40, 60]);
}
addEventListener('pointerdown', () => { try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); AC.resume(); } catch { } }, { once: true });

async function showLogin(msg) { $('#admin').hidden = true; $('#adLogin').hidden = false; $('#aErr').textContent = msg || ''; }
async function boot() {
  registerSW();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return showLogin();
  const { data: me } = await sb.from('profiles').select('id,display,is_admin').eq('id', session.user.id).single();
  if (!me?.is_admin) { await sb.auth.signOut(); return showLogin('Ce compte n\'est pas admin.'); }
  $('#adLogin').hidden = true; $('#admin').hidden = false;
  startAdmin({
    me, toast, alert: m => { ding(); toast(m, 6000); },
    logout: async () => { await sb.auth.signOut(); location.reload(); },
    push: async () => {
      const r = await enablePush();
      toast({ on: '🔔 Notifications activées : tu seras prévenu de chaque demande.', 'ios-home': 'Sur iPhone : Partager ⬆️ → « Sur l\'écran d\'accueil », puis ouvre FdP Admin depuis l\'icône.', denied: 'Notifications bloquées : autorise-les dans les réglages.', unsupported: 'Ce navigateur ne gère pas les notifications.' }[r] || 'Impossible d\'activer les notifications.', 5000);
    },
  });
  if (await pushState() === 'on') { /* déjà activé */ }
}
$('#adForm').addEventListener('submit', async e => {
  e.preventDefault();
  const u = $('#aName').value.trim(), p = $('#aPass').value;
  if (!u || !p) { $('#aErr').textContent = 'Remplis le pseudo et le mot de passe.'; return; }
  $('#aGo').disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: emailOf(u), password: p });
  $('#aGo').disabled = false;
  if (error) { $('#aErr').textContent = 'Pseudo ou mot de passe incorrect.'; return; }
  boot();
});
boot();
