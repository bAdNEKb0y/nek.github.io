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
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

/**
 * Une salle de match à deux. role: 'host' | 'guest'
 * Événements : 'peer' (infos adversaire ou null), 'msg' (type, data), 'link' (état réseau), 'full'
 */
export class Room {
  constructor(code, me, role, opt = {}) {
    this.code = code; this.me = me; this.role = role;
    this.max = opt.max || 2; this.prefix = opt.prefix || 'match:'; this.peers = []; // salle à plusieurs : jusqu'à max joueurs, tout passe par le relais
    this.handlers = {}; this.peer = null; this.state = { team: me.fav ?? 0, ready: false };
    this.pc = null; this.fast = null; this.rel = null; this.mode = 'relay';
    this.rtt = 0; this.lastRecv = 0; this.closed = false; this.pendingIce = [];
  }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this; }
  emit(ev, ...a) { (this.handlers[ev] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }

  async join() {
    const ch = sb.channel(this.prefix + this.code, { config: { broadcast: { self: false, ack: false }, presence: { key: this.me.uid } } });
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
    if (this.max > 2) return this.onPresenceMulti();
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

  onPresenceMulti() {
    const all = Object.values(this.ch.presenceState()).map(a => a[0]).filter(Boolean).sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1));
    const seen = new Set(), list = all.filter(p => !seen.has(p.uid) && seen.add(p.uid));
    const i = list.findIndex(p => p.uid === this.me.uid);
    if (i >= this.max) { this.emit('full'); return; }
    const inRoom = list.slice(0, this.max), others = inRoom.filter(p => p.uid !== this.me.uid);
    this.peers = others;
    // pour l'invité, « peer » = l'hôte ; pour l'hôte = n'importe quel autre joueur
    this.peer = this.role === 'guest' ? others.find(p => p.role === 'host') || null : others[0] || null;
    this.emit('peers', inRoom);
    this.emit('peer', this.peer);
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

/** Partie rapide : apparie les joueurs qui attendent. Résout {code, role}.
 *  Poignée de main : le plus ancien des deux envoie une offre, l'autre l'accepte. Les « fantômes »
 *  (onglet fermé, réseau coupé) qui ne répondent pas sont ignorés pendant 20 s. */
export function quickMatch(me, onWaiting) {
  let ch, done = false, offerT = 0, waitT = 0, waitFor = null, pendingTo = null;
  const myCode = newCode(), at = Date.now(), ignore = new Map();
  const p = new Promise((resolve, reject) => {
    const finish = res => { if (done) return; done = true; clearTimeout(offerT); clearTimeout(waitT); setTimeout(() => { sb.removeChannel(ch); resolve(res); }, 300); };
    const pick = () => {
      if (done || pendingTo) return;
      const now = Date.now();
      const all = Object.values(ch.presenceState()).map(a => a[0]).filter(x => x && x.uid && !(ignore.get(x.uid) > now))
        .sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1));
      const i = all.findIndex(x => x.uid === me.uid);
      onWaiting?.(all.length);
      if (i < 0) return;
      const partner = i % 2 === 0 ? all[i + 1] : all[i - 1];
      if (!partner) return;
      if (i % 2 === 1) { // le plus ancien de la paire fait l'offre ; s'il ne répond jamais, c'est un fantôme
        if (waitFor !== partner.uid) { clearTimeout(waitT); waitFor = partner.uid; waitT = setTimeout(() => { if (done) return; ignore.set(waitFor, Date.now() + 20000); waitFor = null; pick(); }, 5000); }
        return;
      }
      pendingTo = partner.uid;
      ch.send({ type: 'broadcast', event: 'offer', payload: { from: me.uid, to: partner.uid, code: myCode } });
      offerT = setTimeout(() => { ignore.set(pendingTo, Date.now() + 20000); pendingTo = null; pick(); }, 3500);
    };
    ch = sb.channel('quick', { config: { presence: { key: me.uid }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, pick);
    ch.on('broadcast', { event: 'offer' }, ({ payload: o }) => {
      if (done || !o || o.to !== me.uid) return;
      if (pendingTo && pendingTo !== o.from) { clearTimeout(offerT); pendingTo = null; } // l'autre est plus ancien : on accepte son offre
      ch.send({ type: 'broadcast', event: 'accept', payload: { from: me.uid, to: o.from } });
      finish({ code: o.code, role: 'guest' });
    });
    ch.on('broadcast', { event: 'accept' }, ({ payload: a }) => {
      if (done || !a || a.to !== me.uid || a.from !== pendingTo) return;
      finish({ code: myCode, role: 'host' });
    });
    ch.subscribe(async st => {
      if (st === 'SUBSCRIBED') await ch.track({ uid: me.uid, code: myCode, at, name: me.name });
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { if (!done) reject(new Error(st)); }
    });
  });
  p.cancel = () => { done = true; clearTimeout(offerT); clearTimeout(waitT); if (ch) sb.removeChannel(ch); };
  return p;
}
