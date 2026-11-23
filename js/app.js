/**
 * Navigation : accueil (défi du jour, partie rapide, thèmes) → configuration (mode + joueurs) → partie.
 * Gère aussi les liens partagés : « #daily » (défi du jour) et « #c=… » (défi d'un ami).
 */
const App = (() => {
  'use strict';

  const { $, $$, store } = Core;
  const MAX_PLAYERS = 6;
  const DAILY_TIME = 30;
  const TIMES = [0, 20, 30, 45];
  const MODES = ['solo', 'group', 'duel'];

  // Thème virtuel « خلطة » (toutes les questions des thèmes quiz)
  const MIX = {
    id: 'mix',
    name: L.mix.name,
    emoji: '🎲',
    description: L.mix.description,
    colors: ['#C98B4B', '#8C5A2B'],
    type: 'quiz',
    mix: true,
  };
  TOPICS.push(MIX);

  const el = {
    home: $('#screen-home'),
    grid: $('#topic-grid'),
    dailyBtn: $('#daily-btn'),
    dailyTitle: $('#daily-title'),
    dailyStatus: $('#daily-status'),
    dailyStreak: $('#daily-streak'),
    quickBtn: $('#quick-btn'),
    installBtn: $('#install-btn'),
    helpBtn: $('#help-btn'),
    help: $('#help'),
    helpTitle: $('#help-title'),
    helpSteps: $('#help-steps'),
    helpClose: $('#help-close'),
    panel: $('#setup-panel'),
    back: $('#setup-back'),
    medal: $('#setup-medal'),
    name: $('#setup-name'),
    desc: $('#setup-desc'),
    modeSwitch: $('#mode-switch'),
    modeBtns: $$('#mode-switch button'),
    modeDesc: $('#mode-desc'),
    form: $('#setup-form'),
    fields: $('#name-fields'),
    addPlayer: $('#add-player'),
    timerField: $('#timer-field'),
    timerSelect: $('#timer-select'),
    tip: $('#setup-tip'),
    startBtn: $('#start-btn'),
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || min));

  let topic = null;     // thème joué
  let special = null;   // null | { kind: 'daily' | 'challenge', context, timeLimit, hero }
  let mode = MODES.includes(store.get('mode', 'duel')) ? store.get('mode', 'duel') : 'duel';
  let groupSize = clamp(store.get('groupSize', 3), 2, MAX_PLAYERS);
  let draft = [];       // noms en cours de saisie (conservés quand on change de mode)

  const currentMode = () => {
    if (special) return 'solo';
    return topic && topic.type === 'love' ? 'love' : mode;
  };
  const savedTimer = () => {
    const t = store.get('timer', 30);
    return TIMES.includes(t) ? t : 30;
  };

  /* ---------- Accueil ---------- */
  function renderTopics() {
    el.grid.innerHTML = '';
    const quiz = TOPICS.filter((t) => t.type === 'quiz' && !t.mix);
    const ordered = [
      ...quiz.filter((t) => t.featured),
      ...quiz.filter((t) => !t.featured),
      ...TOPICS.filter((t) => t.mix),
      ...TOPICS.filter((t) => t.type === 'love'),
    ];

    ordered.forEach((t, i) => {
      const wide = t.featured || t.mix || t.type === 'love';
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = ['tile', wide && 'wide', t.featured && 'featured', t.type === 'love' && 'love']
        .filter(Boolean).join(' ');
      if (t.ribbon) tile.dataset.ribbon = t.ribbon;
      tile.style.setProperty('--c1', t.colors[0]);
      tile.style.setProperty('--c2', t.colors[1]);
      tile.style.animationDelay = `${i * 70}ms`;

      const medal = document.createElement('span');
      medal.className = 'tile-medal';
      Core.fillMedal(medal, t);

      const text = document.createElement('span');
      text.className = 'tile-text';
      const name = document.createElement('span');
      name.className = 'tile-name';
      name.textContent = t.name;
      const desc = document.createElement('span');
      desc.className = 'tile-desc';
      desc.textContent = t.description;
      const badge = document.createElement('span');
      badge.className = 'tile-badge';
      badge.textContent = t.type === 'love'
        ? L.loveBadge(Core.countQuestions(t))
        : L.questionsBadge(Core.countQuestions(t), store.get(`best.${t.id}`, null));
      text.append(name, desc, badge);
      tile.append(medal, text);

      tile.addEventListener('click', () => {
        Sound.unlock();
        Sound.play('pick');
        openSetup(t);
      });
      el.grid.appendChild(tile);
    });
  }

  function renderDaily() {
    const key = Core.dayKey();
    const done = store.get(`daily.${key}`, null);
    const streak = Core.dailyStreak();
    el.dailyTitle.textContent = L.daily.title(Core.dayNumber(key));
    el.dailyStatus.textContent = done ? L.daily.done(done.score) : L.daily.todo;
    el.dailyStreak.textContent = streak ? L.daily.streak(streak) : '';
    el.dailyBtn.classList.toggle('done', !!done);
  }

  function home() {
    Duel.stop();
    Single.stop();
    Core.clearLater();
    Core.clearConfetti();
    Core.releaseWake();
    special = null;
    renderTopics();
    renderDaily();
    Core.showScreen('screen-home');
  }

  /* ---------- Défi du jour ---------- */
  function openDaily() {
    const key = Core.dayKey();
    const num = Core.dayNumber(key);
    const done = store.get(`daily.${key}`, null);
    if (done) {
      Single.showDaily(done, num);
      return;
    }
    const dailyTopic = {
      id: 'daily',
      name: L.daily.title(num),
      emoji: '🗓️',
      description: L.daily.desc,
      colors: ['#F7A43B', '#C2410C'],
      type: 'quiz',
      mix: true,
    };
    openSetup(dailyTopic, {
      kind: 'daily',
      timeLimit: DAILY_TIME,
      context: { kind: 'daily', key, num, deck: Core.dailyDeck(key) },
    });
  }

  /* ---------- Défi reçu par lien ---------- */
  function openChallenge(code) {
    const data = Core.decode(code);
    const deck = data && typeof data === 'object' ? Core.deckFromIds(data.q, { hot: data.h, khamsa: data.k }) : null;
    if (!deck) {
      Core.toast(L.challenge.invalid);
      return;
    }
    const real = TOPICS.find((t) => t.id === data.t && t.type === 'quiz') || MIX;
    const from = {
      name: String(data.n || '').trim().slice(0, 14) || L.defaultNames.p(1),
      score: Math.max(0, parseInt(data.s, 10) || 0),
    };
    openSetup(real, {
      kind: 'challenge',
      timeLimit: TIMES.includes(data.l) ? data.l : 30,
      context: { kind: 'challenge', from, deck },
      hero: { emoji: '🤝', name: L.challenge.title(from.name), desc: L.challenge.desc(from.score, real.name) },
    });
  }

  /* ---------- Configuration ---------- */
  function loadNames(love) {
    if (love) {
      const n = store.get('loveNames', {});
      return [n.p1 || '', n.p2 || ''];
    }
    const list = store.get('playerNames', null);
    if (Array.isArray(list)) return list.slice(0, MAX_PLAYERS).map((n) => String(n || ''));
    const n = store.get('names', {}); // ancien format
    return [n.p1 || '', n.p2 || ''];
  }

  function saveNames(love, raw) {
    if (love) {
      store.set('loveNames', { p1: raw[0], p2: raw[1] });
      return;
    }
    const list = loadNames(false);
    raw.forEach((r, i) => { list[i] = r; });
    store.set('playerNames', list);
  }

  const defaultName = (m, i) => (m === 'love' ? L.defaultNames.love[i] : L.defaultNames.p(i + 1));

  // Deux joueurs ne peuvent pas avoir le même nom
  function uniqueNames(list) {
    const seen = new Set();
    return list.map((n) => {
      let name = n;
      let k = 2;
      while (seen.has(name.toLowerCase())) name = `${n} ${k++}`;
      seen.add(name.toLowerCase());
      return name;
    });
  }

  function openSetup(t, sp = null) {
    topic = t;
    special = sp;
    const hero = (sp && sp.hero) || { name: t.name, desc: t.description };

    el.panel.style.setProperty('--c1', t.colors[0]);
    el.panel.style.setProperty('--c2', t.colors[1]);
    if (hero.emoji) el.medal.textContent = hero.emoji;
    else Core.fillMedal(el.medal, t);
    el.name.textContent = hero.name;
    el.desc.textContent = hero.desc;

    const love = t.type === 'love';
    el.modeSwitch.hidden = love || !!sp;
    el.timerField.hidden = love || !!sp;
    el.panel.classList.toggle('theme-love', love);

    draft = loadNames(love);
    applyMode();
    Core.showScreen('screen-setup');
  }

  function applyMode() {
    const m = currentMode();
    const info = L.modes[m];
    el.form.dataset.mode = m;
    el.modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    el.modeDesc.textContent = info.desc;
    el.modeDesc.hidden = !!special;
    el.tip.hidden = m !== 'duel';
    el.startBtn.textContent = special ? L[special.kind].start : info.start;
    renderFields();
  }

  function renderFields() {
    const m = currentMode();
    const count = m === 'solo' ? 1 : m === 'group' ? groupSize : 2;
    el.fields.innerHTML = '';

    for (let i = 0; i < count; i++) {
      const field = document.createElement('div');
      field.className = `field p${i + 1}`;
      const dot = document.createElement('span');
      dot.className = 'dot';
      const input = document.createElement('input');
      input.maxLength = 14;
      input.value = draft[i] || '';
      input.placeholder = L.modes[m].p(i);
      input.enterKeyHint = i === count - 1 ? 'go' : 'next';
      input.setAttribute('aria-label', L.playerLabel(i + 1));
      input.addEventListener('input', () => { draft[i] = input.value; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && i < count - 1) { // « Entrée » → champ suivant
          e.preventDefault();
          $$('input', el.fields)[i + 1].focus();
        }
      });
      field.append(dot, input);

      if (m === 'duel') {
        const seat = document.createElement('span');
        seat.className = 'seat';
        seat.textContent = L.seats[i];
        field.appendChild(seat);
      }
      if (m === 'group' && count > 2) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove';
        remove.textContent = '✕';
        remove.setAttribute('aria-label', L.removePlayer);
        remove.addEventListener('click', () => {
          draft.splice(i, 1);
          groupSize -= 1;
          store.set('groupSize', groupSize);
          renderFields();
        });
        field.appendChild(remove);
      }
      el.fields.appendChild(field);
    }
    el.addPlayer.hidden = !(m === 'group' && count < MAX_PLAYERS);
  }

  el.addPlayer.addEventListener('click', () => {
    if (groupSize >= MAX_PLAYERS) return;
    groupSize += 1;
    store.set('groupSize', groupSize);
    Sound.play('pick');
    renderFields();
    const inputs = $$('input', el.fields);
    inputs[inputs.length - 1].focus();
  });

  el.modeBtns.forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    store.set('mode', mode);
    Sound.play('pick');
    applyMode();
  }));

  el.back.addEventListener('click', home);

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    Sound.unlock();

    const m = currentMode();
    const raw = $$('input', el.fields).map((input) => input.value.trim());
    const names = uniqueNames(raw.map((r, i) => r || defaultName(m, i)));
    saveNames(m === 'love', raw);

    if (special) {
      Single.start({ mode: 'solo', topic, names, timeLimit: special.timeLimit, context: special.context });
      return;
    }
    const timeLimit = parseInt(el.timerSelect.value, 10) || 0;
    store.set('timer', timeLimit);

    if (m === 'love') Single.start({ mode: 'love', topic, names });
    else if (m === 'duel') Duel.start({ topic, names, timeLimit });
    else Single.start({ mode: m, topic, names, timeLimit });
  });

  /* ---------- Raccourcis de l'accueil ---------- */
  el.dailyBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('pick');
    openDaily();
  });

  // ⚡ Une partie en un seul toucher : solo, « خلطة », dernier nom utilisé
  el.quickBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.play('pick');
    const name = (loadNames(false)[0] || '').trim() || L.defaultNames.p(1);
    Single.start({ mode: 'solo', topic: MIX, names: [name], timeLimit: savedTimer() });
  });

  /* ---------- Aide ---------- */
  function renderHelp() {
    el.helpTitle.textContent = L.help.title;
    el.helpClose.textContent = L.help.ok;
    el.helpSteps.innerHTML = '';
    L.help.steps.forEach((s) => {
      const li = document.createElement('li');
      const ico = document.createElement('span');
      ico.className = 'ico';
      ico.textContent = s.icon;
      const body = document.createElement('div');
      const title = document.createElement('b');
      title.textContent = s.title;
      const text = document.createElement('p');
      text.textContent = s.text;
      body.append(title, text);
      li.append(ico, body);
      el.helpSteps.appendChild(li);
    });
  }

  function openHelp() {
    el.help.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.help.classList.add('open')));
  }

  function closeHelp() {
    store.set('helpSeen', true);
    el.help.classList.remove('open');
    setTimeout(() => { el.help.hidden = true; }, 250);
  }

  el.helpBtn.addEventListener('click', () => {
    Sound.play('pick');
    openHelp();
  });
  el.helpClose.addEventListener('click', closeHelp);
  el.help.addEventListener('click', (e) => { if (e.target === el.help) closeHelp(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.help.hidden) closeHelp();
  });

  /* ---------- Installation (Android / Chrome) ---------- */
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    el.installBtn.hidden = false;
  });
  el.installBtn.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (_) { /* ignoré */ }
    installPrompt = null;
    el.installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { el.installBtn.hidden = true; });

  // Hors ligne : le service worker garde le jeu en cache
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignoré */ });
    });
  }

  /* ---------- Liens partagés ---------- */
  function handleLink() {
    const { hash } = location;
    if (!hash || hash.length < 2) return false;
    history.replaceState(null, '', location.href.split('#')[0]);
    if (hash === '#daily') {
      openDaily();
      return true;
    }
    if (hash.startsWith('#c=')) {
      openChallenge(hash.slice(3));
      return true;
    }
    return false;
  }

  /* ---------- Initialisation ---------- */
  el.timerSelect.value = String(savedTimer());
  renderTopics();
  renderDaily();
  renderHelp();
  Core.updateSoundButtons();

  const linked = handleLink();
  if (!linked && !store.get('helpSeen', false)) openHelp();

  // La tuile du jour se met à jour quand on revient dans l'appli (ex. après minuit)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && el.home.classList.contains('active')) renderDaily();
  });

  return { home };
})();


