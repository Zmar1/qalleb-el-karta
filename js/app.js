/**
 * Navigation : accueil (choix du thème) → configuration (mode + joueurs) → partie.
 */
const App = (() => {
  'use strict';

  const { $, $$, store } = Core;

  // Thème virtuel « خلطة » (toutes les questions des thèmes quiz)
  TOPICS.push({
    id: 'mix',
    name: L.mix.name,
    emoji: '🎲',
    description: L.mix.description,
    colors: ['#C98B4B', '#8C5A2B'],
    type: 'quiz',
    mix: true,
  });

  const el = {
    grid: $('#topic-grid'),
    panel: $('#setup-panel'),
    back: $('#setup-back'),
    medal: $('#setup-medal'),
    name: $('#setup-name'),
    desc: $('#setup-desc'),
    modeSwitch: $('#mode-switch'),
    modeBtns: $$('#mode-switch button'),
    modeDesc: $('#mode-desc'),
    form: $('#setup-form'),
    nameP1: $('#name-p1'),
    nameP2: $('#name-p2'),
    fieldP2: $('#field-p2'),
    timerField: $('#timer-field'),
    timerSelect: $('#timer-select'),
    tip: $('#setup-tip'),
    startBtn: $('#start-btn'),
  };

  let topic = null;
  let mode = store.get('mode', 'duel'); // solo | duel (pour les thèmes quiz)

  const currentMode = () => (topic && topic.type === 'love' ? 'love' : mode);

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
        ? L.loveBadge
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

  function home() {
    Duel.stop();
    Single.stop();
    Core.clearLater();
    Core.clearConfetti();
    Core.releaseWake();
    renderTopics();
    Core.showScreen('screen-home');
  }

  /* ---------- Configuration ---------- */
  function openSetup(t) {
    topic = t;
    el.panel.style.setProperty('--c1', t.colors[0]);
    el.panel.style.setProperty('--c2', t.colors[1]);
    Core.fillMedal(el.medal, t);
    el.name.textContent = t.name;
    el.desc.textContent = t.description;

    const love = t.type === 'love';
    el.modeSwitch.hidden = love;
    el.timerField.hidden = love;
    el.panel.classList.toggle('theme-love', love);

    const names = store.get(love ? 'loveNames' : 'names', {});
    el.nameP1.value = names.p1 || '';
    el.nameP2.value = names.p2 || '';

    applyMode();
    Core.showScreen('screen-setup');
  }

  function applyMode() {
    const m = currentMode();
    const info = L.modes[m];
    el.form.dataset.mode = m;
    el.modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    el.modeDesc.textContent = info.desc;
    el.fieldP2.hidden = m === 'solo';
    el.tip.hidden = m !== 'duel';
    el.nameP1.placeholder = info.p1;
    el.nameP2.placeholder = info.p2 || '';
    el.startBtn.textContent = info.start;
  }

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
    const d = L.defaultNames;
    const raw1 = el.nameP1.value.trim();
    const raw2 = el.nameP2.value.trim();
    const p1 = raw1 || (m === 'love' ? d.loveP1 : d.p1);
    let p2 = raw2 || (m === 'love' ? d.loveP2 : d.p2);
    if (p1.toLowerCase() === p2.toLowerCase()) p2 = `${p2} 2`;

    store.set(m === 'love' ? 'loveNames' : 'names', { p1: raw1, p2: raw2 });
    const timeLimit = parseInt(el.timerSelect.value, 10) || 0;
    store.set('timer', timeLimit);

    if (m === 'love') Single.start({ mode: 'love', topic, names: [p1, p2] });
    else if (m === 'solo') Single.start({ mode: 'solo', topic, names: [p1], timeLimit });
    else Duel.start({ topic, names: [p1, p2], timeLimit });
  });

  /* ---------- Initialisation ---------- */
  const savedTimer = store.get('timer', null);
  if (savedTimer !== null && el.timerSelect.querySelector(`option[value="${savedTimer}"]`)) {
    el.timerSelect.value = String(savedTimer);
  }
  renderTopics();
  Core.updateSoundButtons();

  return { home };
})();

