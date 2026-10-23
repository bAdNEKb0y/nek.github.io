/* Vraies notifications (iPhone, Android, ordinateur) via Web Push */
import { sb } from './net.js';

const VAPID = 'BA9L8QxFM4oWYBIh-Q0dxo18lcbcUqjLpcHllYjOFiOFMXOPfZYLwC8fLDyLZLbpu6hDrrHDwrShYpBp2GANUT8';
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

let REG = null;
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try { REG = await navigator.serviceWorker.register('sw.js', { scope: './' }); } catch { REG = null; }
  return REG;
}
/** État affiché dans les paramètres */
export async function pushState() {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-home' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = REG || await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}
const b64u = s => { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
/** À appeler depuis un appui sur un bouton (obligatoire sur iPhone) */
export async function enablePush() {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-home' : 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = REG || await registerSW() || await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID) });
  const j = sub.toJSON();
  const { error } = await sb.rpc('save_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  return error ? 'error' : 'on';
}
export async function disablePush() {
  const reg = REG || await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  if (sub) await sub.unsubscribe();
  return 'off';
}
/** Demande au serveur d'envoyer une notification (le serveur vérifie tout et écrit le texte lui-même) */
export function sendPush(body) { sb.functions.invoke('push', { body }).catch(() => { }); }
