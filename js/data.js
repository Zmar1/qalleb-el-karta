/**
 * Source des questions : base de données Supabase, avec repli sur les questions intégrées.
 *
 *  1. Au démarrage (synchrone, avant le moteur) : le jeu prend le dernier catalogue téléchargé, mémorisé
 *     sur le téléphone ; sinon les questions intégrées (js/topics/*.js) → démarrage instantané, même hors ligne.
 *  2. Data.refresh() demande à Supabase si le catalogue a changé (game_catalog) : si oui, il le télécharge,
 *     le mémorise et l'applique aussitôt (les parties en cours gardent leurs cartes).
 *  3. Data.report() envoie une réponse écrite refusée à l'admin (page admin → Signalements).
 *     Sans Internet, le signalement attend dans une file et part au prochain lancement.
 *
 * Sans configuration (js/config.js vide), rien ne change : questions intégrées uniquement.
 *
 * Format d'une question reçue (voir game_catalog dans supabase/1-schema.sql) :
 *   { id, topic, q, a: [3 choix], c, f, img, credit, alt: [réponses acceptées], typable: false, since: 'AAAA-MM-JJ' }
 */
const Data = (() => {
  'use strict';

  const CACHE_KEY = 'quizcards.catalog';
  const QUEUE_KEY = 'quizcards.reports';
  const IMG_CACHE = 'qalleb-img';             // photos hébergées dans Supabase (servies hors ligne par sw.js)
  const MIN_QUESTIONS = 10;                   // un thème avec moins de questions publiées reste caché
  const CHECK_EVERY = 10 * 60 * 1000;         // nouvelle vérification au plus toutes les 10 min
  const TIMEOUT = 10000;
  const FALLBACK_COLORS = ['#0E5AA7', '#083D77'];

  const conf = typeof CONFIG === 'object' && CONFIG ? CONFIG : {};
  const base = apiUrl(conf.supabaseUrl);
  const key = String(conf.supabasePublishableKey || conf.supabaseAnonKey || '').trim();
  const secret = isSecretKey(key);
  const enabled = !secret && /^https:\/\/[^\s/]+$/.test(base) && key.length > 20;
  if (secret) {
    console.error('⛔ js/config.js contient une clé SECRÈTE : base de données désactivée. '
      + 'Mets la « Publishable key » (sb_publishable_…) et supprime cette clé secrète dans Supabase si elle a été publiée.');
  }

  const listeners = [];
  let current = { source: 'bundle', version: null, count: 0 };
  let lastCheck = 0;
  let checking = null;
  let flushing = null;

  /* ---------- Configuration ---------- */
  // Adresse de l'API : accepte aussi l'adresse du tableau de bord (supabase.com/dashboard/project/<id>/…)
  function apiUrl(url) {
    const u = String(url || '').trim().replace(/\/+$/, '');
    const dashboard = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
    return dashboard ? `https://${dashboard[1]}.supabase.co` : u.replace(/\/(rest|auth|storage)\/v1(\/.*)?$/i, '');
  }

  // Clé secrète (sb_secret_…) ou ancienne clé service_role : elle ne doit JAMAIS être dans le jeu
  function isSecretKey(k) {
    if (/^sb_secret_/i.test(k)) return true;
    try {
      const payload = (k.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload)).role === 'service_role';
    } catch (_) { return false; }
  }

  /* ---------- Stockage local ---------- */
  function read(k, fallback) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : JSON.parse(v);
    } catch (_) { return fallback; }
  }
  function write(k, value) {
    try {
      localStorage.setItem(k, JSON.stringify(value));
      return true;
    } catch (_) { return false; } // mémoire pleine : le catalogue reste utilisable pendant la session
  }

  /* ---------- API REST de Supabase ---------- */
  function headers() {
    const h = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`; // clé « anon » (JWT) ; inutile pour sb_publishable_…
    return h;
  }

  async function rpc(name, body) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body || {}),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!res.ok) throw new Error(`Supabase ${name} : HTTP ${res.status}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* ---------- Catalogue → thèmes au format du jeu (voir js/topics/_registry.js) ---------- */
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const isColor = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);
  const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

  function build(cat) {
    if (!cat || !Array.isArray(cat.topics) || !Array.isArray(cat.questions)) return null;
    const byId = new Map();
    const answers = {};

    cat.topics.forEach((t) => {
      if (!t || !str(t.id) || !str(t.name) || (t.type !== 'quiz' && t.type !== 'love')) return;
      const ok = Array.isArray(t.colors) && t.colors.length === 2 && t.colors.every(isColor);
      const topic = {
        id: str(t.id),
        name: str(t.name),
        emoji: str(t.emoji) || '❓',
        description: str(t.description),
        colors: ok ? t.colors : FALLBACK_COLORS,
        type: t.type,
        questions: [],
      };
      if (str(t.image)) topic.image = str(t.image);
      if (t.featured) topic.featured = true;
      if (str(t.ribbon)) topic.ribbon = str(t.ribbon);
      byId.set(topic.id, topic);
    });

    cat.questions.forEach((x) => {
      const topic = x && byId.get(x.topic);
      const id = str(x && x.id);
      const q = str(x && x.q);
      if (!topic || !id || !q) return;
      const since = isDay(x.since) ? x.since : null;
      if (topic.type === 'love') {
        topic.questions.push({ id, q, since });
        return;
      }
      const a = Array.isArray(x.a) ? x.a.map(str) : [];
      if (a.length !== 3 || a.some((s) => !s) || ![0, 1, 2].includes(x.c)) return; // question incomplète : ignorée
      topic.questions.push({
        id, q, a, c: x.c, f: str(x.f), img: str(x.img) || null, credit: str(x.credit), since,
      });
      if (x.typable === false) answers[id] = false;
      else if (Array.isArray(x.alt) && x.alt.length) answers[id] = x.alt.map(str).filter(Boolean);
    });

    const topics = [...byId.values()].filter((t) => t.questions.length >= MIN_QUESTIONS);
    if (!topics.some((t) => t.type === 'quiz')) return null; // catalogue vide ou abîmé : on garde l'actuel
    return { topics, answers, count: countOf(topics) };
  }

  const countOf = (topics) => topics.reduce((n, t) => n + (t.mix ? 0 : (t.questions || []).length), 0);

  // Remplace le contenu de TOPICS et ANSWERS (les thèmes virtuels comme « خلطة » sont conservés)
  function apply(built) {
    const virtual = TOPICS.filter((t) => t.mix);
    TOPICS.splice(0, TOPICS.length, ...built.topics, ...virtual);
    if (typeof ANSWERS === 'object' && ANSWERS) {
      Object.keys(ANSWERS).forEach((k) => { delete ANSWERS[k]; });
      Object.assign(ANSWERS, built.answers);
    }
  }

  /* ---------- Démarrage : dernier catalogue mémorisé ---------- */
  current.count = countOf(TOPICS);
  if (enabled) {
    const saved = read(CACHE_KEY, null);
    const built = saved && saved.url === base ? build(saved.catalog) : null;
    if (built) {
      apply(built);
      current = { source: 'cache', version: saved.catalog.version, count: built.count };
    }
  }

  /* ---------- Mise à jour depuis la base ---------- */
  function notify(info) {
    listeners.forEach((fn) => {
      try { fn(info); } catch (e) { console.error(e); }
    });
  }

  // force : ignore le délai minimal entre deux vérifications
  function refresh({ force = false } = {}) {
    if (!enabled || navigator.onLine === false) return Promise.resolve(false);
    if (checking) return checking;
    if (!force && Date.now() - lastCheck < CHECK_EVERY) return Promise.resolve(false);
    lastCheck = Date.now();
    checking = (async () => {
      try {
        const cat = await rpc('game_catalog', { known: current.version });
        const built = cat && !cat.unchanged ? build(cat) : null;
        if (!built) return false;
        const before = current.count;
        write(CACHE_KEY, { url: base, savedAt: Date.now(), catalog: cat });
        apply(built);
        current = { source: 'remote', version: cat.version, count: built.count };
        notify({ added: built.count - before });
        prefetchImages(built.topics);
        return true;
      } catch (_) {
        return false; // hors ligne ou base indisponible : on garde les questions actuelles
      } finally {
        checking = null;
        flushReports();
      }
    })();
    return checking;
  }

  // Photos hébergées dans la base (Supabase Storage) : téléchargées à l'avance pour jouer hors ligne
  // (sw.js les sert ensuite depuis ce cache)
  async function prefetchImages(topics) {
    if (typeof caches === 'undefined') return;
    const urls = [...new Set(topics.flatMap((t) => t.questions.map((q) => q.img))
      .filter((u) => typeof u === 'string' && /^https:\/\/.+\/storage\/v1\/object\/public\//.test(u)))];
    if (!urls.length) return;
    try {
      const cache = await caches.open(IMG_CACHE);
      for (const url of urls) {
        if (await cache.match(url)) continue;
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await cache.put(url, res);
        } catch (_) { /* réessayée à la prochaine mise à jour */ }
      }
    } catch (_) { /* Cache Storage indisponible */ }
  }

  /* ---------- Signalements « 📮 جوابي صحيح؟ » ---------- */
  function flushReports() {
    if (!enabled || flushing || navigator.onLine === false) return flushing;
    const queue = read(QUEUE_KEY, []);
    if (!Array.isArray(queue) || !queue.length) return null;
    flushing = (async () => {
      const left = [];
      for (const r of queue) {
        try {
          await rpc('report_answer', { p_question: r.q, p_typed: r.t });
        } catch (_) {
          left.push(r); // pas de réseau : on réessaiera
        }
      }
      // Des signalements ont pu être ajoutés pendant l'envoi
      const added = read(QUEUE_KEY, []).slice(queue.length);
      write(QUEUE_KEY, [...left, ...added].slice(-50));
    })().finally(() => { flushing = null; });
    return flushing;
  }

  // true = pris en charge (envoyé tout de suite ou dès que possible) ; false = pas de base configurée
  function report(questionId, typed) {
    const text = String(typed || '').trim().slice(0, 80);
    if (!enabled || !questionId || !text) return false;
    const queue = read(QUEUE_KEY, []);
    write(QUEUE_KEY, [...(Array.isArray(queue) ? queue : []), { q: questionId, t: text }].slice(-50));
    if (flushing) flushing.then(flushReports);
    else flushReports();
    return true;
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  return {
    enabled,
    refresh,
    report,
    onChange,
    get source() { return current.source; },   // 'bundle' | 'cache' | 'remote'
    get version() { return current.version; },
    get api() { return enabled ? { base, key } : null; }, // pour js/account.js
  };
})();



