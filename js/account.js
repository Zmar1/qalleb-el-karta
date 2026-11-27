/**
 * Comptes joueurs (phase 2) : connexion par e-mail (code à 6 chiffres) ou Google, profil, XP et classements.
 *
 * Parle directement à l'API REST de Supabase : Auth (/auth/v1/…) et les fonctions SQL de
 * supabase/maj/02-comptes-classements.sql (my_profile, save_profile, submit_play, leaderboard_*,
 * delete_my_account). Aucun affichage ici : l'interface est dans js/social.js.
 *
 *  - La session (jetons) et le profil sont gardés sur le téléphone : on reste connecté, même hors ligne.
 *  - Les parties à compter (solo, défi du jour) passent par une file d'attente : sans Internet,
 *    elles partent au retour du réseau. Le serveur vérifie chaque partie (scores possibles, une seule
 *    participation au défi du jour, 40 parties par 24 h).
 */
const Account = (() => {
  'use strict';

  const SESSION_KEY = 'quizcards.session';
  const PROFILE_KEY = 'quizcards.profile';
  const QUEUE_KEY = 'quizcards.plays';
  const SENT_KEY = 'quizcards.dailySent'; // défis du jour déjà envoyés depuis ce téléphone (tous comptes)
  const TIMEOUT = 12000;

  const api = typeof Data !== 'undefined' ? Data.api : null; // { base, key } ou null sans base de données
  const enabled = !!api;
  const conf = typeof CONFIG === 'object' && CONFIG ? CONFIG : {};
  const google = enabled && conf.googleLogin === true;

  const listeners = [];
  let refreshing = null;
  let flushing = null;

  /* ---------- Stockage local ---------- */
  function read(k, fallback) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : JSON.parse(v);
    } catch (_) { return fallback; }
  }
  function write(k, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(value));
    } catch (_) { /* mémoire pleine : ignoré */ }
  }
  const nowSec = () => Math.floor(Date.now() / 1000);

  /* ---------- Appels HTTP ---------- */
  async function request(path, { method = 'POST', body, token = null } = {}) {
    const headers = { apikey: api.key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (api.key.startsWith('eyJ')) headers.Authorization = `Bearer ${api.key}`;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), TIMEOUT);
    let res;
    try {
      res = await fetch(`${api.base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (_) {
      const err = new Error('offline');
      err.offline = true;
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
      const info = data && typeof data === 'object' ? data : {};
      const err = new Error(info.message || info.msg || info.error_description || info.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = info.error_code || info.code || '';
      throw err;
    }
    return data;
  }

  // Erreur → clé de texte (L.account.errors)
  function errorKey(e) {
    if (!e) return 'generic';
    if (e.offline) return 'offline';
    const m = `${e.code || ''} ${e.message || ''}`.toLowerCase();
    if (m.includes('pseudo_taken')) return 'pseudoTaken';
    if (m.includes('pseudo_invalid')) return 'pseudoInvalid';
    if (m.includes('banned')) return 'banned';
    if (e.status === 429 || /rate.?limit/.test(m)) return 'rate';
    if (/otp_expired|token has expired|invalid.*(otp|token)|token.*invalid/.test(m)) return 'code';
    if (m.includes('email') && (e.status === 400 || e.status === 422)) return 'email';
    return 'generic';
  }

  /* ---------- Session ---------- */
  function b64json(part) {
    const bin = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent([...bin].map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')));
  }
  function userOf(token) {
    try {
      const p = b64json(token.split('.')[1]);
      return p && p.sub ? { id: p.sub, email: p.email || '' } : null;
    } catch (_) { return null; }
  }

  function session() {
    const s = read(SESSION_KEY, null);
    return s && s.access_token && s.refresh_token && s.user && s.user.id ? s : null;
  }

  function saveSession(s, user = null) {
    if (!s || !s.access_token || !s.refresh_token) return null;
    const prev = read(SESSION_KEY, null);
    const u = user || (s.user && s.user.id ? { id: s.user.id, email: s.user.email || '' } : null)
      || userOf(s.access_token) || (prev && prev.user) || null;
    if (!u) return null;
    const value = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: Number(s.expires_at) || nowSec() + (Number(s.expires_in) || 3600),
      user: u,
    };
    write(SESSION_KEY, value);
    return value;
  }

  function clearLocal() {
    write(SESSION_KEY, null);
    write(PROFILE_KEY, null);
    write(QUEUE_KEY, null);
  }

  // Jeton d'accès valide (renouvelé automatiquement) ; null si déconnecté ou hors ligne
  async function accessToken() {
    const s = session();
    if (!s) return null;
    if (s.expires_at - 60 > nowSec()) return s.access_token;
    if (!refreshing) {
      refreshing = request('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } })
        .then((r) => saveSession(r, s.user))
        .catch((e) => {
          // Jeton révoqué ou compte supprimé (mais pas : hors ligne, ni trop de requêtes)
          if (!e.offline && e.status >= 400 && e.status < 500 && e.status !== 429) {
            clearLocal();
            notify();
          }
          return null;
        })
        .finally(() => { refreshing = null; });
    }
    const fresh = await refreshing;
    return fresh ? fresh.access_token : null;
  }

  async function rpc(name, body = {}) {
    const token = await accessToken();
    if (!token) {
      const err = new Error(session() ? 'offline' : 'not_signed_in');
      err.offline = !!session();
      err.signedOut = !session();
      throw err;
    }
    return request(`/rest/v1/rpc/${name}`, { body, token });
  }

  /* ---------- Profil & niveaux ---------- */
  function profile() {
    const s = session();
    const p = read(PROFILE_KEY, null);
    return s && p && p.user === s.user.id ? p : null;
  }

  function storeProfile(p) {
    const s = session();
    write(PROFILE_KEY, p && s ? { ...p, user: s.user.id } : null);
  }

  function levelOf(xp = 0) {
    const levels = L.levelsXp;
    let index = 0;
    levels.forEach((lvl, i) => { if (xp >= lvl.xp) index = i; });
    const cur = levels[index];
    const next = levels[index + 1] || null;
    return {
      index,
      icon: cur.icon,
      name: cur.name,
      next,
      progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
    };
  }

  async function loadProfile() {
    const p = await rpc('my_profile');
    storeProfile(p || null);
    return p || null;
  }

  async function saveProfile({ pseudo, avatar, governorate }) {
    const p = await rpc('save_profile', {
      p_pseudo: String(pseudo || '').trim(), p_avatar: avatar, p_governorate: governorate || null,
    });
    storeProfile(p);
    notify();
    flush();
    return p;
  }

  /* ---------- Connexion ---------- */
  const cleanEmail = (email) => String(email || '').trim().toLowerCase();
  const here = () => `${location.origin}${location.pathname}`;

  // L'e-mail contient un code à 6 chiffres (modèle personnalisé, SMTP perso) et/ou un lien de connexion
  // (modèle par défaut de Supabase) : le lien ramène ici avec #access_token=… (voir takeRedirect)
  async function sendCode(email) {
    await request(`/auth/v1/otp?redirect_to=${encodeURIComponent(here())}`, {
      body: { email: cleanEmail(email), create_user: true },
    });
  }

  async function verifyCode(email, code) {
    const r = await request('/auth/v1/verify', {
      body: { type: 'email', email: cleanEmail(email), token: String(code || '').replace(/\D/g, '') },
    });
    if (!saveSession(r)) throw new Error('generic');
    await afterSignIn();
    return state();
  }

  function signInWithGoogle() {
    location.assign(`${api.base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(here())}`);
  }

  // Retour de Google (ou d'un lien reçu par e-mail) : #access_token=…&refresh_token=… dans l'adresse
  function takeRedirect() {
    const hash = location.hash || '';
    const query = location.search || '';
    const fromHash = /(^#|&)(access_token|error)=/.test(hash);
    const fromQuery = /(^\?|&)error=/.test(query) && /error_description=/.test(query);
    if (!fromHash && !fromQuery) return null;
    const p = new URLSearchParams(fromHash ? hash.slice(1) : query.slice(1));
    history.replaceState(null, '', `${location.origin}${location.pathname}`);
    if (p.get('error')) return { error: p.get('error_description') || p.get('error') };
    const s = saveSession({
      access_token: p.get('access_token'),
      refresh_token: p.get('refresh_token'),
      expires_at: p.get('expires_at'),
      expires_in: p.get('expires_in'),
    });
    return s ? { signedIn: true } : { error: 'session' };
  }

  async function afterSignIn() {
    try {
      const u = await request('/auth/v1/user', { method: 'GET', token: session().access_token });
      if (u && u.id) saveSession(session(), { id: u.id, email: u.email || '' });
    } catch (_) { /* l'e-mail s'affichera plus tard */ }
    try { await loadProfile(); } catch (_) { /* hors ligne : réessayé au prochain lancement */ }
    notify();
    flush();
  }

  async function signOut() {
    const s = session();
    clearLocal();
    notify();
    if (s) request('/auth/v1/logout?scope=local', { token: s.access_token }).catch(() => {});
  }

  async function deleteAccount() {
    await rpc('delete_my_account');
    clearLocal();
    notify();
  }

  /* ---------- Parties comptées pour l'XP et les classements ---------- */
  const sentDays = () => read(SENT_KEY, {});
  function markSent(day) {
    const sent = sentDays();
    sent[day] = 1;
    Object.keys(sent).sort().slice(0, -14).forEach((k) => { delete sent[k]; });
    write(SENT_KEY, sent);
  }

  // play : { kind: 'solo' | 'daily', topic, day, score, correct, total, level, grid }
  // → Promise : { status: 'sent', result } | { status: 'pending' } | { status: 'refused', error } | null (pas de compte)
  function record(play) {
    const s = session();
    if (!enabled || !s || !profile()) return Promise.resolve(null);
    if (play.kind === 'daily' && sentDays()[play.day]) return Promise.resolve({ status: 'duplicate' });
    const queue = read(QUEUE_KEY, []).filter((x) => x.user === s.user.id);
    if (play.kind === 'daily' && queue.some((x) => x.kind === 'daily' && x.day === play.day)) {
      return flush().then(() => ({ status: 'pending' }));
    }
    const item = { ...play, user: s.user.id, at: Date.now() + Math.random() };
    write(QUEUE_KEY, [...queue, item].slice(-100));
    return flush().then((results) => {
      const mine = results.find((r) => r.item.at === item.at);
      if (!mine) return { status: 'pending' };
      return mine.error ? { status: 'refused', error: mine.error } : { status: 'sent', result: mine.result };
    });
  }

  function removeFromQueue(item) {
    write(QUEUE_KEY, read(QUEUE_KEY, []).filter((x) => x.at !== item.at));
  }

  function flush() {
    if (!enabled || !session() || !profile()) return Promise.resolve([]);
    if (flushing) return flushing.then(() => flush());
    flushing = (async () => {
      const results = [];
      const uid = session().user.id;
      for (const item of read(QUEUE_KEY, [])) {
        if (item.user !== uid) {
          removeFromQueue(item);
          continue;
        }
        try {
          const r = await rpc('submit_play', {
            p_kind: item.kind,
            p_topic: item.topic || null,
            p_day: item.day,
            p_score: item.score,
            p_correct: item.correct,
            p_total: item.total,
            p_level: item.level,
            p_grid: item.grid || null,
          });
          removeFromQueue(item);
          if (item.kind === 'daily') markSent(item.day);
          const before = profile();
          const result = { ...r };
          if (before && typeof r.xp === 'number') {
            const was = levelOf(before.xp);
            storeProfile({ ...before, xp: r.xp });
            const now = levelOf(r.xp);
            if (now.index > was.index) result.levelUp = now;
          }
          results.push({ item, result });
        } catch (e) {
          if (e.offline || e.signedOut) break; // pas de réseau / session perdue : on réessaiera
          removeFromQueue(item); // refusée par le serveur : abandonnée
          if (item.kind === 'daily') markSent(item.day);
          results.push({ item, error: e });
        }
      }
      if (results.length) notify();
      return results;
    })().finally(() => { flushing = null; });
    return flushing;
  }

  // Défis du jour joués sur ce téléphone (même avant de se connecter) : chacun compte une seule fois
  function syncDaily(list) {
    list.forEach(({ day, result }) => {
      if (!result || sentDays()[day]) return;
      record({
        kind: 'daily', topic: null, day, score: result.score, correct: result.correct, total: result.total,
        level: 'medium', grid: result.grid || null,
      });
    });
  }

  /* ---------- Classements (visibles sans compte) ---------- */
  async function leaderboard(tab, day) {
    const name = { daily: 'leaderboard_daily', week: 'leaderboard_week', gov: 'leaderboard_governorates' }[tab];
    const token = session() ? await accessToken() : null;
    return request(`/rest/v1/rpc/${name}`, { body: tab === 'daily' ? { p_day: day } : {}, token });
  }

  /* ---------- État & événements ---------- */
  function state() {
    const s = session();
    const p = profile();
    return {
      enabled,
      google,
      signedIn: !!s,
      email: s ? s.user.email : '',
      profile: p,
      level: p ? levelOf(p.xp) : null,
    };
  }

  function notify() {
    const st = state();
    listeners.forEach((fn) => {
      try { fn(st); } catch (e) { console.error(e); }
    });
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  // Au lancement : retour de Google, profil à jour (XP gagnée sur un autre téléphone), envoi des parties en attente
  async function init() {
    if (!enabled) return null;
    const redirect = takeRedirect();
    if (redirect && redirect.signedIn) await afterSignIn();
    else if (session()) {
      loadProfile().then(notify).catch(() => {});
      flush();
    }
    return redirect;
  }

  if (enabled && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    // Connexion / déconnexion dans un autre onglet
    window.addEventListener('storage', (e) => {
      if (e.key === SESSION_KEY || e.key === PROFILE_KEY) notify();
    });
  }

  return {
    enabled,
    init,
    state,
    onChange,
    sendCode,
    verifyCode,
    signInWithGoogle,
    signOut,
    deleteAccount,
    saveProfile,
    loadProfile,
    record,
    flush,
    syncDaily,
    leaderboard,
    levelOf,
    errorKey,
  };
})();

