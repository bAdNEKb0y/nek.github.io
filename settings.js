/* Paramètres du joueur, gardés sur l'appareil (localStorage) */
const KEY = 'fdp-settings-v1';
export const DEF = {
  vol: 80,          // volume des effets (0-100)
  crowd: 60,        // volume de la foule (0-100)
  vib: true,        // vibrations (téléphone + manette)
  diff: 1,          // ordi : 0 facile, 1 normal, 2 costaud
  soloDur: 180,     // durée des matchs contre l'ordi (s)
  replay: true,     // ralenti après les buts
  lefty: false,     // gaucher : joystick à droite, boutons à gauche
  btn: 1,           // taille des boutons : .85 / 1 / 1.2
  cam: 'near',      // caméra : 'near' (zoomée) ou 'wide' (tout le terrain)
  labels: true,     // noms des joueurs
  aim: true,        // cible de chute du ballon en l'air
  shake: true,      // tremblement de l'écran sur les buts
  saver: false,     // économie de batterie (30 images/s, moins de pixels)
  fps: false,       // afficher les images/s
};
let S = { ...DEF };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { }
const subs = new Set();
export const SET = new Proxy(S, { set(t, k, v) { t[k] = v; try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { } subs.forEach(f => f(k, v)); return true; } });
export const onSetting = f => subs.add(f);
export function resetSettings() { for (const k in DEF) SET[k] = DEF[k]; }
