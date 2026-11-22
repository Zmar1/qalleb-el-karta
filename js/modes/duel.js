/**
 * Mode « وجه لوجه » — écran partagé, joueurs face à face.
 * Le répondeur choisit une carte et voit uniquement les choix (cliquables),
 * le questionneur voit la question + les choix (non cliquables) et lit à voix haute.
 */
const Duel = (() => {
  'use strict';

  const { $, $$ } = Core;
  const CARD_COUNT = 10;
  const PICK_DELAY = 500;
  const FLIP_DELAY = 300;
  const SPECIAL_DELAY = 420;
  const ANSWER_UNLOCK = 1100;

  const el = {
    timerTrack: $('#duel-timer-track'),
    timerBar: $('#duel-timer-bar'),
    quitBtn: $('#duel-quit'),
    tpl: $('#zone-tpl'),
  };

  // zones[0] = joueur 1 en bas ; zones[1] = joueur 2 en haut (tourné à 180°)
  const zones = [$('#zone-p1'), $('#zone-p2')].map((host) => {
    host.appendChild(el.tpl.content.cloneNode(true));
    return {
      host,
      name: $('.name', host),
      role: $('.role', host),
      scoreMe: $('.score-me', host),
      scoreOpp: $('.score-opp', host),
      boardSlot: $('.view-board', host),
      waitText: $('.wait-text', host),
      qcard: $('.qcard', host),
      num: $('.qcard .num', host),
      category: $('.category', host),
      qText: $('.q-text', host),
      choices: $('.choices', host),
      listen: $('.listen', host),
      answers: $('.answers', host),
      timers: $$('.q-timer', host),
      banners: $$('.special-banner', host),
      feedback: $('.feedback', host),
      fact: $('.fact', host),
      next: $('.next', host),
      endEmoji: $('.end-emoji', host),
      endTitle: $('.end-title', host),
      endScore: $('.end-score', host),
      replay: $('.replay', host),
      menu: $('.menu', host),
    };
  });

  // Plateau unique, déplacé dans la moitié du répondeur à chaque tour
  const board = document.createElement('div');
  board.className = 'board board-duel';

  const state = {
    topic: null,
    players: [],      // [{ name, score, streak }] — 0 = bas, 1 = haut
    current: 0,       // index du RÉPONDEUR
    cards: [],
    activeCard: null,
    phase: 'idle',    // idle | pick | picking | question | result | end
    timeLimit: 30,
  };

  const timer = Core.createTimer({
    onTick(ratio, sec) {
      const low = ratio < 0.3;
      el.timerBar.style.width = `${ratio * 100}%`;
      el.timerBar.classList.toggle('low', low);
      zones.forEach((z) => z.timers.forEach((t) => {
        t.textContent = L.timer(sec);
        t.classList.toggle('low', low);
      }));
    },
    onEnd: () => answer(-1),
  });

  /* ---------- Affichage ---------- */
  const setView = (i, view) => { zones[i].host.dataset.view = view; };

  function updateHeads() {
    zones.forEach((z, i) => {
      const me = state.players[i];
      const opp = state.players[1 - i];
      const answering = i === state.current && state.phase !== 'end';

      z.name.textContent = me.name;
      const roleText = state.phase === 'end'
        ? L.duel.roleEnd
        : answering ? L.duel.roleAnswer : L.duel.roleAsk;
      if (z.role.textContent !== roleText) {
        z.role.textContent = roleText;
        Core.restartAnim(z.role, 'pulse');
      }
      z.host.classList.toggle('is-answer', answering);

      if (z.scoreMe.textContent !== String(me.score)) {
        z.scoreMe.textContent = me.score;
        Core.restartAnim(z.scoreMe, 'bump');
      }
      z.scoreOpp.textContent = L.duel.oppScore(opp.name, opp.score);
    });
  }

  function setBanners(text = '', cls = '') {
    zones.forEach((z) => z.banners.forEach((b) => {
      b.textContent = text;
      b.className = `special-banner ${cls}`.trim();
    }));
  }

  function clearResult() {
    zones.forEach((z) => {
      z.feedback.textContent = '';
      z.feedback.className = 'feedback';
      z.fact.textContent = '';
      z.next.hidden = true;
    });
  }

  function resetTimerDisplay() {
    const hasTimer = state.timeLimit > 0;
    el.timerTrack.classList.toggle('off', !hasTimer);
    el.timerBar.style.width = '100%';
    el.timerBar.classList.remove('low');
    zones.forEach((z) => z.timers.forEach((t) => {
      t.textContent = hasTimer ? L.timer(state.timeLimit) : '';
      t.classList.remove('low');
    }));
  }

  /* ---------- Déroulement ---------- */
  function start({ topic, names, timeLimit }) {
    state.topic = topic;
    state.timeLimit = timeLimit;
    state.players = names.map((name) => ({ name, score: 0, streak: 0 }));
    newGame();
  }

  function newGame() {
    Core.clearLater();
    Core.clearConfetti();
    timer.stop();
    state.players.forEach((p) => { p.score = 0; p.streak = 0; });
    zones.forEach((z) => { z.scoreMe.textContent = '0'; });
    const questions = Core.draw(state.topic, CARD_COUNT);
    state.cards = Core.createCards(questions, Core.randomLayout(questions.length));
    state.current = Math.random() < 0.5 ? 0 : 1;

    Core.renderBoard(board, state.cards, pickCard, { showTopic: !!state.topic.mix });
    Core.showScreen('screen-duel');
    Core.keepAwake();
    enterPickPhase();
  }

  function stop() {
    timer.stop();
    state.phase = 'idle';
  }

  // Phase 1 : le répondeur choisit une carte, le questionneur attend
  function enterPickPhase() {
    state.phase = 'pick';
    state.activeCard = null;
    const a = state.current;
    const q = 1 - a;

    zones[a].boardSlot.appendChild(board);
    setView(a, 'board');
    zones[q].waitText.textContent = L.duel.choosing(state.players[a].name);
    setView(q, 'wait');

    // Vide les contenus du tour précédent (vues masquées)
    zones.forEach((z) => {
      z.qText.textContent = '';
      z.choices.innerHTML = '';
      z.answers.innerHTML = '';
    });

    setBanners();
    clearResult();
    resetTimerDisplay();
    updateHeads();
  }

  function pickCard(card) {
    if (state.phase !== 'pick' || card.played) return;
    state.phase = 'picking';
    state.activeCard = card;
    card.el.classList.add('picked');
    Sound.play('pick');
    Core.vibrate(15);
    Core.later(() => showQuestion(card), PICK_DELAY);
  }

  // Phase 2 : question chez le questionneur, choix cliquables chez le répondeur
  function showQuestion(card) {
    state.phase = 'question';
    const { q } = card;
    const a = state.current;
    const qz = zones[1 - a];
    const az = zones[a];

    qz.num.textContent = card.index + 1;
    qz.category.textContent = `${q.emoji} ${q.topic}`;
    qz.qText.textContent = q.question;
    qz.choices.innerHTML = '';
    q.answers.forEach((text, i) => qz.choices.appendChild(Core.makeOption('li', i, text)));
    qz.qcard.classList.toggle('hot', card.special === 'hot');
    qz.qcard.classList.remove('flipped');
    setView(1 - a, 'ask');

    az.listen.textContent = L.duel.listening(state.players[1 - a].name);
    az.answers.innerHTML = '';
    az.answers.classList.add('locked');
    q.answers.forEach((text, i) => {
      const b = Core.makeOption('button', i, text);
      b.disabled = true;
      b.addEventListener('click', () => answer(i));
      az.answers.appendChild(b);
    });
    setView(a, 'answer');

    setBanners();
    resetTimerDisplay();

    Core.later(() => {
      qz.qcard.classList.add('flipped');
      Sound.play('flip');
    }, FLIP_DELAY);

    if (card.special) {
      Core.later(() => {
        setBanners(L.special.short[card.special], card.special);
        Sound.play('special');
      }, FLIP_DELAY + SPECIAL_DELAY);
    }

    Core.later(() => {
      az.answers.classList.remove('locked');
      $$('.opt', az.answers).forEach((b) => { b.disabled = false; });
      timer.start(state.timeLimit);
    }, ANSWER_UNLOCK);
  }

  function answer(choice) {
    if (state.phase !== 'question') return;

    const card = state.activeCard;
    const { q } = card;
    const a = state.current;
    const az = zones[a];
    const qz = zones[1 - a];
    const answerer = state.players[a];
    const isCorrect = choice === q.correct;
    const timedOut = choice === -1;
    const lists = [qz.choices, az.answers];

    // 🧿 Khamsa : la 1ʳᵉ erreur est pardonnée, le minuteur continue
    if (!isCorrect && !timedOut && card.special === 'khamsa' && !card.chanceUsed) {
      card.chanceUsed = true;
      lists.forEach((list) => {
        const node = list.children[choice];
        node.classList.add('wrong');
        if (node.tagName === 'BUTTON') node.disabled = true;
      });
      az.feedback.textContent = L.special.khamsaSave;
      qz.feedback.textContent = L.special.khamsaOpp(answerer.name);
      [az, qz].forEach((z) => { z.feedback.className = 'feedback lucky'; });
      Sound.play('special');
      Core.vibrate([30, 40, 30]);
      return;
    }

    state.phase = 'result';
    timer.stop();

    lists.forEach((list) => {
      [...list.children].forEach((node, i) => {
        if (node.tagName === 'BUTTON') node.disabled = true;
        if (i === q.correct) node.classList.add('correct');
        else if (i === choice) node.classList.add('wrong');
        else if (!node.classList.contains('wrong')) node.classList.add('dim');
      });
    });

    if (isCorrect) {
      const points = Core.pointsFor(card);
      answerer.score += points;
      answerer.streak += 1;
      az.feedback.textContent = Core.praise(points, answerer.streak);
      qz.feedback.textContent = L.duel.found(answerer.name, points);
      Sound.play('correct');
      Core.vibrate(40);
    } else {
      answerer.streak = 0;
      az.feedback.textContent = timedOut ? L.timeUp : L.wrong;
      qz.feedback.textContent = timedOut ? L.duel.noAnswer(answerer.name) : L.duel.missed(answerer.name);
      Sound.play(timedOut ? 'timeout' : 'wrong');
      Core.vibrate([60, 40, 60]);
    }
    [az, qz].forEach((z) => { z.feedback.className = `feedback ${isCorrect ? 'ok' : 'ko'}`; });
    // Place libérée pour le bouton « كمّل » ; l'anecdote va au questionneur, qui la lit à voix haute
    setBanners();
    qz.fact.textContent = q.fact ? L.fact(q.fact) : '';

    card.played = true;
    card.correct = isCorrect;
    card.by = a;

    updateHeads();
    az.next.hidden = false;
  }

  // Phase 3 : tour suivant, rôles inversés
  function finishTurn() {
    if (state.phase !== 'result') return;
    const card = state.activeCard;
    Core.markCard(card, card.correct ? '✓' : '✗', state.players[card.by].name,
      [`by-p${card.by + 1}`, card.correct ? 'is-correct' : 'is-wrong']);
    clearResult();

    if (state.cards.every((c) => c.played)) {
      endGame();
      return;
    }
    state.current = 1 - state.current;
    enterPickPhase();
    Sound.play('swap');
  }

  function endGame() {
    state.phase = 'end';
    timer.stop();
    setBanners();
    const [p1, p2] = state.players;
    const tie = p1.score === p2.score;
    const winner = tie ? -1 : p1.score > p2.score ? 0 : 1;

    zones.forEach((z, i) => {
      const me = state.players[i];
      const opp = state.players[1 - i];
      z.endEmoji.textContent = tie ? '🤝' : i === winner ? '🏆' : '😅';
      z.endTitle.textContent = tie ? L.duel.tie : i === winner ? L.duel.win : L.duel.lose;
      z.endScore.textContent = L.duel.finalScore(me.name, me.score, opp.name, opp.score);
      setView(i, 'end');
    });

    resetTimerDisplay();
    updateHeads();
    Sound.play(tie ? 'tie' : 'win');
    if (!tie) Core.launchConfetti();
  }

  /* ---------- Événements ---------- */
  zones.forEach((z) => {
    z.next.addEventListener('click', finishTurn);
    z.replay.addEventListener('click', () => { Sound.unlock(); newGame(); });
    z.menu.addEventListener('click', () => App.home());
  });

  el.quitBtn.addEventListener('click', () => {
    if (state.phase === 'end' || confirm(L.confirmQuit)) App.home();
  });

  return { start, stop };
})();




