/**
 * Outils partagés par tous les modes de jeu.
 */
const Core = (() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- Aléatoire ---------- */
  function shuffle(arr) { // Fisher–Yates (non biaisé)
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
  const used = new Map(); // topicId -> Set(questionId) déjà jouées

  function questionsOf(topic) {
    if (topic.mix) {
      return TOPICS.filter((t) => t.type === 'quiz' && !t.mix).flatMap(questionsOf);
    }
    return topic.questions.map((q, i) => (topic.type === 'love'
      ? { id: `${topic.id}-${i}`, question: q, topic: topic.name, emoji: topic.emoji }
      : { id: `${topic.id}-${i}`, question: q.q, answers: q.a, correct: q.c, topic: topic.name, emoji: topic.emoji }));
  }

  function shuffleAnswers(q) {
    const order = shuffle([0, 1, 2]);
    return { ...q, answers: order.map((i) => q.answers[i]), correct: order.indexOf(q.correct) };
  }

  // Tire n questions en privilégiant celles pas encore jouées dans ce thème
  function draw(topic, n) {
    const all = questionsOf(topic);
    let seen = used.get(topic.id) || new Set();
    let pool = all.filter((q) => !seen.has(q.id));
    if (pool.length < n) {
      seen = new Set();
      pool = all;
    }
    const chosen = shuffle(pool).slice(0, n);
    chosen.forEach((q) => seen.add(q.id));
    used.set(topic.id, seen);
    return chosen.map((q) => (q.answers ? shuffleAnswers(q) : q));
  }

  const countQuestions = (topic) => questionsOf(topic).length;

  /* ---------- Cartes ---------- */
  const createCards = (questions) => questions.map((q, index) => ({ index, q, played: false, el: null }));

  function renderBoard(container, cards, onPick) {
    container.innerHTML = '';
    cards.forEach((card) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.style.animationDelay = `${card.index * 60}ms`;
      btn.setAttribute('aria-label', L.card(card.index + 1));
      btn.innerHTML = `
        <div class="card-inner">
          <div class="face front"><span class="num">${card.index + 1}</span></div>
          <div class="face back"><span class="result">?</span><span class="by"></span></div>
        </div>`;
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
    $, $$, shuffle, pickRandom, vibrate, restartAnim, showScreen, fillMedal, store,
    later, clearLater, keepAwake, releaseWake,
    draw, countQuestions, createCards, renderBoard, markCard, makeOption, createTimer,
    launchConfetti, clearConfetti, updateSoundButtons,
  };
})();

