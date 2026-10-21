/* Réseau : salle Supabase Realtime (présence + signalisation) et lien direct WebRTC entre les deux téléphones.
   Si le lien direct échoue (certains réseaux mobiles), les messages passent par le relais Supabase. */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const SUPABASE_URL = 'https://znymskryqowborlkwpua.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_6Zl1ix3ThDaqJGKWZrKrLg_QP55hyja';
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fdp-online-auth' },
  realtime: { params: { eventsPerSecond: 80 } },
});

const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.random() * CODE_CHARS.length | 0]).join('');
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

/**
 * Une salle de match à deux. role: 'host' | 'guest'
 * Événements : 'peer' (infos adversaire ou null), 'msg' (type, data), 'link' (état réseau), 'full'
 */
export class Room {
  constructor(code, me, role) {
    this.code = code; this.me = me; this.role = role;
    this.handlers = {}; this.peer = null; this.state = { team: me.fav ?? 0, ready: false };
    this.pc = null; this.fast = null; this.rel = null; this.mode = 'relay';
    this.rtt = 0; this.lastRecv = 0; this.closed = false; this.pendingIce = [];
  }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { (this.handlers[ev] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }

  async join() {
    const ch = sb.channel('match:' + this.code, { config: { broadcast: { self: false, ack: false }, presence: { key: this.me.uid } } });
    this.ch = ch;
    ch.on('presence', { event: 'sync' }, () => this.onPresence());
    ch.on('broadcast', { event: 'sig' }, ({ payload }) => this.onSignal(payload));
    ch.on('broadcast', { event: 'g' }, ({ payload }) => this.recv(payload));
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('timeout')), 12000);
      ch.subscribe(st => {
        if (st === 'SUBSCRIBED') { clearTimeout(to); res(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error(st)); }
      });
    });
    await this.track();
    this.pingT = setInterval(() => this.send('ping', { t: performance.now() }), 1000);
  }
  track() {
    return this.ch.track({ ...this.state, uid: this.me.uid, name: this.me.name, rating: this.me.rating, role: this.role, at: this.joinedAt ||= Date.now() });
  }
  setState(patch) { Object.assign(this.state, patch); return this.track(); }

  onPresence() {
    const all = Object.values(this.ch.presenceState()).map(a => a[0]).filter(Boolean);
    const others = all.filter(p => p.uid !== this.me.uid);
    // Deux personnes maximum : les premiers arrivés gardent la place
    if (others.length && all.length > 2) {
      const sorted = all.slice().sort((a, b) => a.at - b.at);
      if (sorted.indexOf(sorted.find(p => p.uid === this.me.uid)) >= 2) { this.emit('full'); return; }
    }
    const peer = others.sort((a, b) => a.at - b.at)[0] || null;
    const changedPeer = (peer?.uid || null) !== (this.peer?.uid || null);
    this.peer = peer;
    this.emit('peer', peer);
    if (changedPeer) {
      this.resetRTC();
      if (peer && this.role === 'host') this.startRTC();
    }
  }

  /* ----- WebRTC ----- */
  resetRTC() {
    try { this.fast?.close(); this.rel?.close(); this.pc?.close(); } catch { }
    this.pc = this.fast = this.rel = null; this.setMode('relay'); this.pendingIce = [];
  }
  makePC() {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onicecandidate = e => { if (e.candidate) this.signal({ c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) this.setMode('relay'); };
    pc.ondatachannel = e => this.wireDC(e.channel);
    this.pc = pc; return pc;
  }
  wireDC(dc) {
    if (dc.label === 'fast') this.fast = dc; else this.rel = dc;
    dc.onopen = () => { if (this.fast?.readyState === 'open' && this.rel?.readyState === 'open') this.setMode('p2p'); };
    dc.onclose = () => this.setMode('relay');
    dc.onmessage = e => { try { this.recv(JSON.parse(e.data)); } catch { } };
  }
  async startRTC() {
    if (typeof RTCPeerConnection === 'undefined') return;
    const pc = this.makePC();
    this.wireDC(pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }));
    this.wireDC(pc.createDataChannel('rel', { ordered: true }));
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    this.signal({ d: pc.localDescription.toJSON() });
  }
  signal(data) { this.ch?.send({ type: 'broadcast', event: 'sig', payload: { from: this.me.uid, to: this.peer?.uid, ...data } }); }
  async onSignal(p) {
    if (p.to !== this.me.uid || !this.peer || p.from !== this.peer.uid) return;
    try {
      if (p.d) {
        if (p.d.type === 'offer') {
          if (this.role !== 'guest') return;
          this.resetRTC();
          const pc = this.makePC();
          await pc.setRemoteDescription(p.d);
          for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c);
          const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
          this.signal({ d: pc.localDescription.toJSON() });
        } else if (p.d.type === 'answer' && this.pc) {
          await this.pc.setRemoteDescription(p.d);
          for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c);
        }
      } else if (p.c) {
        if (this.pc && this.pc.remoteDescription) await this.pc.addIceCandidate(p.c);
        else this.pendingIce.push(p.c);
      }
    } catch (e) { console.warn('rtc', e); }
  }
  setMode(m) { if (this.mode !== m) { this.mode = m; this.emit('link', this.linkInfo()); } }
  linkInfo() { return { mode: this.mode, rtt: Math.round(this.rtt), ok: this.mode === 'p2p' || this.rtt < 160 }; }

  /* ----- Messages ----- */
  // fast = peut se perdre (état du jeu, entrées) ; sinon fiable
  send(k, d, fast) {
    const msg = { k, d };
    const dc = fast ? this.fast : this.rel;
    if (this.mode === 'p2p' && dc && dc.readyState === 'open') {
      try { dc.send(JSON.stringify(msg)); return; } catch { }
    }
    this.ch?.send({ type: 'broadcast', event: 'g', payload: msg });
  }
  recv(msg) {
    if (!msg || typeof msg.k !== 'string') return;
    this.lastRecv = performance.now();
    if (msg.k === 'ping') { this.send('pong', msg.d, true); return; }
    if (msg.k === 'pong') {
      const r = performance.now() - (msg.d?.t || 0);
      if (r >= 0 && r < 5000) { this.rtt = this.rtt ? this.rtt * .7 + r * .3 : r; this.emit('link', this.linkInfo()); }
      return;
    }
    this.emit('msg', msg.k, msg.d);
  }
  async leave() {
    this.closed = true; clearInterval(this.pingT);
    this.resetRTC();
    if (this.ch) { try { await this.ch.untrack(); } catch { } sb.removeChannel(this.ch); this.ch = null; }
  }
}

/** Partie rapide : apparie les joueurs qui attendent. Résout {code, role}. */
export function quickMatch(me, onWaiting) {
  let ch, done = false;
  const myCode = newCode(), at = Date.now();
  const p = new Promise((resolve, reject) => {
    ch = sb.channel('quick', { config: { presence: { key: me.uid } } });
    ch.on('presence', { event: 'sync' }, () => {
      if (done) return;
      const all = Object.values(ch.presenceState()).map(a => a[0]).filter(Boolean).sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1));
      const i = all.findIndex(x => x.uid === me.uid);
      if (i < 0) return;
      const partner = i % 2 === 0 ? all[i + 1] : all[i - 1];
      onWaiting?.(all.length);
      if (!partner) return;
      done = true;
      const res = i % 2 === 0 ? { code: myCode, role: 'host' } : { code: partner.code, role: 'guest' };
      setTimeout(() => { sb.removeChannel(ch); resolve(res); }, 400);
    });
    ch.subscribe(async st => {
      if (st === 'SUBSCRIBED') await ch.track({ uid: me.uid, code: myCode, at, name: me.name });
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') reject(new Error(st));
    });
  });
  p.cancel = () => { done = true; if (ch) sb.removeChannel(ch); };
  return p;
}
