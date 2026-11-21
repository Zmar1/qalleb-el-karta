/**
 * Modes en écran normal (non partagé) :
 *  - 'solo' : un joueur, questions à 3 choix, score sur 10 + record
 *  - 'love' : deux amoureux, questions libres répondues à voix haute, chacun son tour
 */
const Single = (() => {
  'use strict';

  const { $, $$ } = Core;
  const CARD_COUNT = 10;
  const PICK_DELAY = 450;
  const FLIP_DELAY = 400;
  const UNLOCK_DELAY = 1000;

  const el = {
    screen: $('#screen-single'),
    topic: $('#single-topic'),
    sub: $('#single-sub'),
    players: $('#single-players'),
    board: $('#single-board'),
    quit: $('#single-quit'),
    modal: $('#modal'),
    bigCard: $('#big-card'),
    num: $('#big-card .front .num'),
    chip: $('#m-chip'),
    timerText: $('#m-timer'),
    timerTrack: $('#m-timer-track'),
    timerBar: $('#m-timer-bar'),
    forWho: $('#m-for'),
    question: $('#m-question'),
    answers: $('#m-answers'),
    feedback: $('#m-feedback'),
    loveActions: $('#m-love-actions'),
    heartBtn: $('#m-heart'),
    skipBtn: $('#m-skip'),
    next: $('#m-next'),
    end: {
      emoji: $('#end-emoji'),
      title: $('#end-title'),
      sub: $('#end-sub'),
      scores: $('#end-scores'),
      replay: $('#end-replay'),
      menu: $('#end-menu'),
    },
  };

  const state = {
    mode: 'solo',
    topic: null,
    players: [],      // [{ name, score }] (score = points en solo, cœurs en love)
    current: 0,       // joueur qui répond
    cards: [],
    activeCard: null,
    phase: 'idle',    // idle | pick | picking | question | result | closing | end
    timeLimit: 0,
  };

  const isLove = () => state.mode === 'love';

  const timer = Core.createTimer({
    onTick(ratio, sec) {
      const low = ratio < 0.3;
      el.timerBar.style.width = `${ratio * 100}%`;
      el.timerBar.classList.toggle('low', low);
      el.timerText.textContent = L.timer(sec);
      el.timerText.classList.toggle('low', low);
    },
    onEnd: () => answer(-1),
  });

  /* ---------- Affichage ---------- */
  function updateHeader() {
    const remaining = state.cards.filter((c) => !c.played).length;
    const turn = state.players[state.current];

    if (isLove()) {
      el.sub.textContent = remaining ? L.single.loveTurn(turn.name) : L.single.loveDone;
    } else {
      el.sub.textContent = L.single.remaining(remaining);
    }
    el.screen.dataset.turn = `p${state.current + 1}`;

    el.players.innerHTML = '';
    state.players.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = `pchip p${i + 1}`;
      if (isLove() && i === state.current && remaining) chip.classList.add('active');
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = p.name;
      const s = document.createElement('span');
      s.className = 's';
      s.textContent = isLove() ? `💖 ${p.score}` : L.single.soloScore(p.score, CARD_COUNT);
      chip.append(n, s);
      el.players.appendChild(chip);
    });
  }

  function hideModal() {
    el.modal.classList.remove('open');
    el.modal.hidden = true;
    el.bigCard.classList.remove('flipped');
  }

  /* ---------- Déroulement ---------- */
  function start({ mode, topic, names, timeLimit = 0 }) {
    state.mode = mode;
    state.topic = topic;
    state.timeLimit = mode === 'love' ? 0 : timeLimit;
    state.players = names.map((name) => ({ name, score: 0 }));
    newGame();
  }

  function newGame() {
    Core.clearLater();
    Core.clearConfetti();
    timer.stop();
    hideModal();

    state.players.forEach((p) => { p.score = 0; });
    state.cards = Core.createCards(Core.draw(state.topic, CARD_COUNT));
    state.current = isLove() ? (Math.random() < 0.5 ? 0 : 1) : 0;
    state.activeCard = null;
    state.phase = 'pick';

    el.screen.classList.toggle('theme-love', isLove());
    el.modal.classList.toggle('theme-love', isLove());
    el.topic.textContent = `${state.topic.emoji} ${state.topic.name}`;
    Core.renderBoard(el.board, state.cards, pickCard);
    updateHeader();
    Core.showScreen('screen-single');
    Core.keepAwake();
  }

  function stop() {
    timer.stop();
    hideModal();
    state.phase = 'idle';
  }

  function pickCard(card) {
    if (state.phase !== 'pick' || card.played) return;
    state.phase = 'picking';
    state.activeCard = card;
    card.el.classList.add('picked');
    Sound.play('pick');
    Core.vibrate(15);
    Core.later(() => openCard(card), PICK_DELAY);
  }

  function openCard(card) {
    const { q } = card;
    state.phase = 'question';

    el.modal.dataset.mode = state.mode;
    el.modal.dataset.player = `p${state.current + 1}`;
    el.num.textContent = card.index + 1;
    el.chip.textContent = `${q.emoji} ${q.topic}`;
    el.question.textContent = q.question;
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
    el.next.hidden = true;
    el.answers.innerHTML = '';

    if (isLove()) {
      el.forWho.textContent = L.single.loveFor(state.players[state.current].name);
      el.loveActions.hidden = false;
      setLoveButtons(false);
      el.timerTrack.hidden = true;
      el.timerText.textContent = '';
    } else {
      el.forWho.textContent = '';
      el.loveActions.hidden = true;
      el.answers.classList.add('locked');
      q.answers.forEach((text, i) => {
        const b = Core.makeOption('button', i, text);
        b.disabled = true;
        b.addEventListener('click', () => answer(i));
        el.answers.appendChild(b);
      });
      const hasTimer = state.timeLimit > 0;
      el.timerTrack.hidden = !hasTimer;
      el.timerBar.style.width = '100%';
      el.timerBar.classList.remove('low');
      el.timerText.textContent = hasTimer ? L.timer(state.timeLimit) : '';
      el.timerText.classList.remove('low');
    }

    el.bigCard.classList.remove('flipped');
    el.modal.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.modal.classList.add('open')));

    Core.later(() => {
      el.bigCard.classList.add('flipped');
      Sound.play('flip');
    }, FLIP_DELAY);

    Core.later(() => {
      if (isLove()) {
        setLoveButtons(true);
      } else {
        el.answers.classList.remove('locked');
        $$('.opt', el.answers).forEach((b) => { b.disabled = false; });
        timer.start(state.timeLimit);
      }
    }, UNLOCK_DELAY);
  }

  /* ---------- Solo : réponse à choix ---------- */
  function answer(choice) {
    if (state.phase !== 'question' || isLove()) return;
    state.phase = 'result';
    timer.stop();

    const card = state.activeCard;
    const { q } = card;
    const isCorrect = choice === q.correct;
    const timedOut = choice === -1;

    [...el.answers.children].forEach((b, i) => {
      b.disabled = true;
      if (i === q.correct) b.classList.add('correct');
      else if (i === choice) b.classList.add('wrong');
      else b.classList.add('dim');
    });

    if (isCorrect) {
      state.players[0].score += 1;
      el.feedback.textContent = Core.pickRandom(L.bravo);
      el.feedback.classList.add('ok');
      Sound.play('correct');
      Core.vibrate(40);
    } else {
      el.feedback.textContent = timedOut ? L.timeUp : L.wrong;
      el.feedback.classList.add('ko');
      Sound.play(timedOut ? 'timeout' : 'wrong');
      Core.vibrate([60, 40, 60]);
    }

    card.played = true;
    card.correct = isCorrect;
    updateHeader();
    el.next.hidden = false;
  }

  /* ---------- Amoureux : réponse libre ---------- */
  function setLoveButtons(enabled) {
    el.heartBtn.disabled = !enabled;
    el.skipBtn.disabled = !enabled;
  }

  function loveDone(liked) {
    if (state.phase !== 'question' || !isLove()) return;
    state.phase = 'result';
    setLoveButtons(false);

    const card = state.activeCard;
    const player = state.players[state.current];
    card.played = true;
    card.liked = liked;
    card.by = state.current;

    if (liked) {
      player.score += 1;
      el.feedback.textContent = L.single.heartFor(player.name);
      el.feedback.classList.add('love');
      Sound.play('heart');
      Core.vibrate(30);
      updateHeader();
      Core.later(closeCard, 900);
    } else {
      closeCard();
    }
  }

  /* ---------- Fin de carte ---------- */
  function closeCard() {
    if (state.phase !== 'result') return;
    state.phase = 'closing';
    const card = state.activeCard;
    el.modal.classList.remove('open');

    Core.later(() => {
      el.modal.hidden = true;
      el.bigCard.classList.remove('flipped');

      if (isLove()) {
        Core.markCard(card, card.liked ? '💖' : '💬', state.players[card.by].name, [`by-p${card.by + 1}`]);
      } else {
        Core.markCard(card, card.correct ? '✓' : '✗', '', ['by-p1', card.correct ? 'is-correct' : 'is-wrong']);
      }
      state.activeCard = null;

      if (state.cards.every((c) => c.played)) {
        state.phase = 'end';
        updateHeader();
        Core.later(endGame, 600);
        return;
      }
      if (isLove()) {
        state.current = 1 - state.current;
        Sound.play('swap');
      }
      state.phase = 'pick';
      updateHeader();
    }, 300);
  }

  /* ---------- Fin de partie ---------- */
  function addEndRow(cls, name, value) {
    const row = document.createElement('div');
    row.className = `end-row ${cls}`;
    const n = document.createElement('span');
    n.className = 'name';
    n.textContent = name;
    const s = document.createElement('span');
    s.className = 'score';
    s.textContent = value;
    row.append(n, s);
    el.end.scores.appendChild(row);
  }

  function endGame() {
    const e = el.end;
    e.scores.innerHTML = '';
    e.replay.textContent = L.end.replay;

    if (isLove()) {
      const total = state.players.reduce((sum, p) => sum + p.score, 0);
      e.emoji.textContent = '💞';
      e.title.textContent = L.end.loveTitle;
      e.sub.textContent = L.end.loveSub(total);
      state.players.forEach((p, i) => addEndRow(`p${i + 1}`, p.name, `💖 ${p.score}`));
      e.replay.textContent = L.end.loveReplay;
      Sound.play('heart');
      Core.launchConfetti({ hearts: true });
    } else {
      const p = state.players[0];
      const key = `best.${state.topic.id}`;
      const best = Core.store.get(key, 0);
      const isRecord = p.score > best;
      if (isRecord) Core.store.set(key, p.score);

      const great = p.score >= 8;
      const ok = p.score >= 5;
      e.emoji.textContent = great ? '🏆' : ok ? '👍' : '📚';
      e.title.textContent = L.end.soloTitle(p.score);
      e.sub.textContent = L.end.soloSub(p.name, p.score, CARD_COUNT);
      addEndRow('p1', L.end.score, L.single.soloScore(p.score, CARD_COUNT));
      addEndRow(isRecord ? 'p1 winner' : 'p1', isRecord ? L.end.newRecord : L.end.best,
        L.single.soloScore(Math.max(best, p.score), CARD_COUNT));
      Sound.play(ok ? 'win' : 'tie');
      if (great || isRecord) Core.launchConfetti();
    }

    Core.showScreen('screen-end');
  }

  /* ---------- Événements ---------- */
  el.next.addEventListener('click', closeCard);
  el.heartBtn.addEventListener('click', () => loveDone(true));
  el.skipBtn.addEventListener('click', () => loveDone(false));
  el.end.replay.addEventListener('click', () => { Sound.unlock(); newGame(); });
  el.end.menu.addEventListener('click', () => App.home());
  el.quit.addEventListener('click', () => {
    const started = state.cards.some((c) => c.played);
    if (!started || confirm(L.confirmQuit)) App.home();
  });

  return { start, stop };
})();

