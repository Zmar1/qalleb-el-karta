/**
 * Outils partagés par tous les modes de jeu.
 */
const Core = (() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const CARD_COUNT = 10;

  /* ---------- Aléatoire ---------- */
  function shuffle(arr, rng = Math.random) { // Fisher–Yates (non biaisé)
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pickRandom = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

  // Graine (FNV-1a) + générateur reproductible (mulberry32) : même graine → même tirage pour tout le monde
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Divers ---------- */
  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* ignoré */ }
  }

  function restartAnim(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  function showScreen(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  // Médaillon d'un thème : image (ex. drapeau) si fournie, sinon emoji
  function fillMedal(node, topic) {
    node.innerHTML = '';
    if (topic.image) {
      const img = document.createElement('img');
      img.src = topic.image;
      img.alt = '';
      node.appendChild(img);
    } else {
      node.textContent = topic.emoji;
    }
  }

  // Petit message temporaire en bas de l'écran
  let toastId = null;
  function toast(msg) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = msg;
    node.classList.add('show');
    clearTimeout(toastId);
    toastId = setTimeout(() => node.classList.remove('show'), 2600);
  }

  /* ---------- Stockage local ---------- */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(`quizcards.${key}`);
        return v === null ? fallback : JSON.parse(v);
      } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(`quizcards.${key}`, JSON.stringify(value)); } catch (_) { /* ignoré */ }
    },
  };

  /* ---------- setTimeout annulables (quand on quitte une partie) ---------- */
  const pending = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => { pending.delete(id); fn(); }, ms);
    pending.add(id);
  }
  function clearLater() {
    pending.forEach(clearTimeout);
    pending.clear();
  }

  /* ---------- Écran toujours allumé ---------- */
  let wakeLock = null;
  let wantAwake = false;
  async function requestWake() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) { /* ignoré */ }
  }
  function keepAwake() { wantAwake = true; requestWake(); }
  function releaseWake() {
    wantAwake = false;
    try { if (wakeLock) wakeLock.release(); } catch (_) { /* ignoré */ }
    wakeLock = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wantAwake) requestWake();
  });

  /* ---------- Questions ---------- */

  // Identifiant stable « theme-position » (utilisé par les liens de défi et le défi du jour)
  function toQuestion(topic, raw, i) {
    const base = { id: `${topic.id}-${i}`, topic: topic.name, emoji: topic.emoji, image: topic.image || null };
    return topic.type === 'love'
      ? { ...base, question: raw }
      : { ...base, question: raw.q, answers: raw.a, correct: raw.c, fact: raw.f || '' };
  }

  const quizTopics = () => TOPICS.filter((t) => t.type === 'quiz' && !t.mix);

  function questionsOf(topic) {
    if (topic.mix) return quizTopics().flatMap(questionsOf);
    return topic.questions.map((raw, i) => toQuestion(topic, raw, i));
  }

  function questionById(id) {
    const cut = id.lastIndexOf('-');
    if (cut <= 0) return null;
    const topic = quizTopics().find((t) => t.id === id.slice(0, cut));
    const i = Number(id.slice(cut + 1));
    if (!topic || !Number.isInteger(i) || !topic.questions[i]) return null;
    return toQuestion(topic, topic.questions[i], i);
  }

  function shuffleAnswers(q, rng = Math.random) {
    const order = shuffle(q.answers.map((_, i) => i), rng);
    return { ...q, answers: order.map((i) => q.answers[i]), correct: order.indexOf(q.correct) };
  }

  /* ---------- Anti-répétition (mémorisée d'une ouverture du jeu à l'autre) ---------- */
  // Chaque question retournée reçoit un numéro croissant : plus il est petit, plus elle est ancienne.
  // Le tirage prend d'abord les questions jamais vues, puis les plus anciennes.
  const SEEN_MAX = 5000;
  let seenCache = null;
  const seenKey = (q) => hashString(q.question).toString(36); // indépendant de la position dans la liste

  function seenData() {
    if (!seenCache) {
      const d = store.get('seen', null);
      seenCache = d && typeof d === 'object' && d.m && typeof d.n === 'number' ? d : { n: 0, m: {} };
    }
    return seenCache;
  }

  // Appelée quand une carte est retournée
  function markSeen(q) {
    const d = seenData();
    d.n += 1;
    d.m[seenKey(q)] = d.n;
    const keys = Object.keys(d.m);
    if (keys.length > SEEN_MAX) {
      keys.sort((a, b) => d.m[a] - d.m[b]).slice(0, keys.length - SEEN_MAX).forEach((k) => { delete d.m[k]; });
    }
    store.set('seen', d);
  }

  // Jamais vues d'abord, puis les plus anciennes ; ordre aléatoire à égalité
  function freshest(list) {
    const { m } = seenData();
    return shuffle(list)
      .map((q) => ({ q, s: m[seenKey(q)] || 0 }))
      .sort((a, b) => a.s - b.s)
      .map((x) => x.q);
  }

  // Alterne les thèmes : t1, t2, t3… t1, t2… (sans doublon de texte)
  function interleave(queues, n = Infinity) {
    const out = [];
    const keys = new Set();
    while (out.length < n && queues.some((list) => list.length)) {
      queues.forEach((list) => {
        while (list.length && out.length < n) {
          const q = list.shift();
          const k = seenKey(q);
          if (!keys.has(k)) {
            keys.add(k);
            out.push(q);
            break;
          }
        }
      });
    }
    return out;
  }

  function draw(topic, n) {
    const chosen = topic.mix
      ? interleave(shuffle(quizTopics()).map((t) => freshest(questionsOf(t))), n)
      : freshest(questionsOf(topic)).slice(0, n);
    return shuffle(chosen).map((q) => (q.answers ? shuffleAnswers(q) : q));
  }

  const countQuestions = (topic) => questionsOf(topic).length;

  /* ---------- Cartes spéciales ---------- */
  // 🌶️ « حارّة » (visibles) : 2 points si bonne réponse ; 🧿 « خمسة » (cachée) : seconde chance
  function randomLayout(count, rng = Math.random) {
    if (count < 6) return { hot: [], khamsa: -1 };
    const order = shuffle([...Array(count).keys()], rng);
    const hotCount = count >= 12 ? 3 : 2;
    return { hot: order.slice(0, hotCount), khamsa: order[hotCount] };
  }

  function cleanLayout(layout, count) {
    const ok = (i) => Number.isInteger(i) && i >= 0 && i < count;
    const hot = layout && Array.isArray(layout.hot) ? [...new Set(layout.hot.filter(ok))].slice(0, 3) : [];
    const khamsa = layout && ok(layout.khamsa) && !hot.includes(layout.khamsa) ? layout.khamsa : -1;
    return { hot, khamsa };
  }

  const layoutOf = (cards) => ({
    hot: cards.filter((c) => c.special === 'hot').map((c) => c.index),
    khamsa: (cards.find((c) => c.special === 'khamsa') || { index: -1 }).index,
  });

  const pointsFor = (card) => (card.special === 'hot' ? 2 : 1);

  const praise = (points, streak) => [pickRandom(L.bravo), L.plus(points), streak >= 3 ? L.streak(streak) : '']
    .filter(Boolean).join(' ');

  // Grille d'emojis à partager (une case par carte)
  const gridOf = (cards) => cards
    .map((c) => (!c.correct ? '🟥' : c.special === 'hot' ? '🌶️' : c.chanceUsed ? '🧿' : '🟩'))
    .join('');

  /* ---------- Paquets prédéfinis : défi du jour & liens de défi ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function shiftKey(key, delta) {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d + delta));
  }
  const DAILY_EPOCH = Date.UTC(2026, 10, 22); // تحدّي #1
  function dayNumber(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Math.max(1, Math.floor((Date.UTC(y, m - 1, d) - DAILY_EPOCH) / 86400000) + 1);
  }
  function timeToMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const min = Math.max(0, Math.ceil((next - now) / 60000));
    return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  }

  // Les mêmes 10 questions (et cartes spéciales) pour tout le monde le même jour.
  // Toutes les questions sont rangées dans une suite où chaque thème est réparti régulièrement
  // (au prorata de sa taille) ; chaque jour prend les 10 suivantes → aucune répétition d'un jour
  // à l'autre tant que la suite n'est pas épuisée, et chaque jour mélange les thèmes.
  function dailyDeck(key) {
    const day = dayNumber(key) - 1;
    const topics = quizTopics();
    const total = topics.reduce((sum, t) => sum + t.questions.length, 0);
    const perCycle = Math.max(1, Math.floor(total / CARD_COUNT));
    const cycleRng = seededRandom(hashString(`qalleb:cycle:${Math.floor(day / perCycle)}`));
    const spread = [];
    shuffle(topics, cycleRng).forEach((t) => {
      const list = shuffle(questionsOf(t), cycleRng);
      const offset = cycleRng();
      list.forEach((q, i) => spread.push({ q, pos: (i + offset) / list.length }));
    });
    const keys = new Set();
    const sequence = spread
      .sort((a, b) => a.pos - b.pos)
      .map((x) => x.q)
      .filter((q) => !keys.has(seenKey(q)) && keys.add(seenKey(q)));
    const start = (day % perCycle) * CARD_COUNT;
    const rng = seededRandom(hashString(`qalleb:${key}`));
    const questions = shuffle(sequence.slice(start, start + CARD_COUNT), rng).map((q) => shuffleAnswers(q, rng));
    return { questions, layout: randomLayout(questions.length, rng) };
  }

  function deckFromIds(ids, layout) {
    if (!Array.isArray(ids) || ids.length < 6 || ids.length > 12) return null;
    const questions = ids.map((id) => questionById(String(id)));
    if (questions.some((q) => !q)) return null;
    return { questions: questions.map((q) => shuffleAnswers(q)), layout: cleanLayout(layout, questions.length) };
  }

  function saveDaily(key, result) {
    store.set(`daily.${key}`, result);
    const st = store.get('daily.streak', { last: null, count: 0 });
    if (st.last !== key) {
      st.count = st.last === shiftKey(key, -1) ? st.count + 1 : 1;
      st.last = key;
      store.set('daily.streak', st);
    }
    return st.count;
  }

  function dailyStreak() {
    const st = store.get('daily.streak', null);
    if (!st || !st.last) return 0;
    const today = dayKey();
    return st.last === today || st.last === shiftKey(today, -1) ? st.count : 0;
  }

  /* ---------- Liens & partage ---------- */
  function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(str) {
    try {
      const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    } catch (_) { return null; }
  }

  const link = (hash) => `${location.href.split('#')[0]}#${hash}`;

  // Partage natif (WhatsApp, Messenger…) → sinon copie → sinon WhatsApp Web
  async function share(text, url) {
    const full = url ? `${text}\n${url}` : text;
    if (navigator.share) {
      try {
        await navigator.share({ text: full });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(full);
      toast(L.share.copied);
    } catch (_) {
      window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, '_blank', 'noopener');
    }
  }

  /* ---------- Cartes ---------- */
  function createCards(questions, layout = null) {
    return questions.map((q, index) => {
      let special = null;
      if (layout && layout.hot.includes(index)) special = 'hot';
      else if (layout && layout.khamsa === index) special = 'khamsa';
      return { index, q, special, played: false, el: null };
    });
  }

  function makeTag(cls, content) {
    const tag = document.createElement('span');
    tag.className = `tag ${cls}`;
    tag.setAttribute('aria-hidden', 'true');
    fillMedal(tag, content);
    return tag;
  }

  function renderBoard(container, cards, onPick, { showTopic = false } = {}) {
    container.innerHTML = '';
    container.dataset.count = String(cards.length);
    cards.forEach((card) => {
      const hot = card.special === 'hot';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = hot ? 'card hot' : 'card';
      btn.style.animationDelay = `${card.index * 60}ms`;
      const label = [L.card(card.index + 1)];
      if (hot) label.push(L.special.hotLabel);
      if (showTopic) label.push(card.q.topic);
      btn.setAttribute('aria-label', label.join(' · '));
      btn.innerHTML = `
        <div class="card-inner">
          <div class="face front"><span class="num">${card.index + 1}</span></div>
          <div class="face back"><span class="result">?</span><span class="by"></span></div>
        </div>`;
      const front = $('.front', btn);
      if (hot) front.appendChild(makeTag('hot', { emoji: '🌶️' }));
      // En « خلطة » : le thème est visible sur la carte → le choix devient stratégique
      if (showTopic) front.appendChild(makeTag('topic', { emoji: card.q.emoji, image: card.q.image }));
      btn.addEventListener('click', () => onPick(card));
      card.el = btn;
      container.appendChild(btn);
    });
    container.classList.add('dealing');
    later(() => container.classList.remove('dealing'), 1400);
  }

  function markCard(card, symbol, label, classes = []) {
    const c = card.el;
    c.classList.remove('picked');
    c.classList.add('played', ...classes);
    if (card.special === 'khamsa') c.classList.add('khamsa');
    c.querySelector('.result').textContent = symbol;
    c.querySelector('.by').textContent = label || '';
    c.disabled = true;
  }

  function makeOption(tag, index, text) {
    const node = document.createElement(tag);
    node.className = 'opt';
    if (tag === 'button') node.type = 'button';
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = L.letters[index];
    const label = document.createElement('span');
    label.className = 'txt';
    label.textContent = text;
    node.append(letter, label);
    return node;
  }

  /* ---------- Minuteur ---------- */
  function createTimer({ onTick, onEnd }) {
    let id = null;
    let deadline = 0;
    let total = 0;
    let lastSec = null;

    function stop() {
      clearInterval(id);
      id = null;
    }
    function tick() {
      const left = Math.max(0, deadline - Date.now());
      const sec = Math.ceil(left / 1000);
      onTick(left / total, sec);
      if (sec !== lastSec) {
        lastSec = sec;
        if (sec > 0 && sec <= 5) Sound.play('tick');
      }
      if (left <= 0) {
        stop();
        onEnd();
      }
    }
    function start(seconds) {
      stop();
      if (!seconds) return;
      total = seconds * 1000;
      deadline = Date.now() + total;
      lastSec = null;
      tick();
      id = setInterval(tick, 100);
    }
    return { start, stop };
  }

  /* ---------- Confettis / cœurs ---------- */
  const confettiEl = $('#confetti');
  function clearConfetti() { confettiEl.innerHTML = ''; }
  function launchConfetti({ hearts = false } = {}) {
    const colors = ['#E70013', '#0E5AA7', '#F2C14E', '#1F8A5B', '#D6336C'];
    clearConfetti();
    for (let i = 0; i < (hearts ? 40 : 90); i++) {
      const piece = document.createElement('i');
      if (hearts) {
        piece.className = 'heart';
        piece.textContent = pickRandom(['💖', '💕', '💘', '❤️', '🌸']);
      } else {
        piece.style.background = colors[i % colors.length];
      }
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 1.2}s`;
      piece.style.animationDuration = `${2.5 + Math.random() * 2}s`;
      confettiEl.appendChild(piece);
    }
    later(clearConfetti, 5500);
  }

  /* ---------- Boutons son (tous les .sound-toggle) ---------- */
  function updateSoundButtons() {
    const muted = Sound.isMuted();
    $$('.sound-toggle').forEach((b) => {
      b.textContent = muted ? '🔇' : '🔊';
      b.setAttribute('aria-label', muted ? L.soundOn : L.soundOff);
    });
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('.sound-toggle')) {
      Sound.toggle();
      updateSoundButtons();
    }
  });

  return {
    $, $$, shuffle, pickRandom, vibrate, restartAnim, showScreen, fillMedal, toast, store,
    later, clearLater, keepAwake, releaseWake,
    draw, countQuestions, markSeen, createCards, renderBoard, markCard, makeOption, createTimer,
    randomLayout, layoutOf, pointsFor, praise, gridOf,
    dayKey, dayNumber, timeToMidnight, dailyDeck, deckFromIds, saveDaily, dailyStreak,
    encode, decode, link, share,
    launchConfetti, clearConfetti, updateSoundButtons,
  };
})();



