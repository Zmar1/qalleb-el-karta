/**
 * Modes en écran normal (non partagé) :
 *  - 'solo'  : un joueur, questions à 3 choix, record par thème
 *              + variantes via state.context : « تحدّي اليوم » (daily) et « تحدّى صاحبك » (challenge)
 *  - 'group' : 2 à 6 joueurs sur le même téléphone, chacun son tour
 *  - 'love'  : deux amoureux, questions libres répondues à voix haute, chacun son tour
 */
const Single = (() => {
  'use strict';

  const { $, store } = Core;
  const PICK_DELAY = 450;
  const FLIP_DELAY = 400;
  const SPECIAL_DELAY = 420;
  const UNLOCK_DELAY = 1000;
  const GROUP_CARDS = { 2: 10, 3: 9, 4: 12, 5: 10, 6: 12 }; // chacun joue le même nombre de cartes

  const el = {
    screen: $('#screen-single'),
    topic: $('#single-topic'),
    sub: $('#single-sub'),
    players: $('#single-players'),
    legend: $('#single-legend'),
    board: $('#single-board'),
    quit: $('#single-quit'),
    modal: $('#modal'),
    bigCard: $('#big-card'),
    num: $('#big-card .front .num'),
    chip: $('#m-chip'),
    timerText: $('#m-timer'),
    timerTrack: $('#m-timer-track'),
    timerBar: $('#m-timer-bar'),
    special: $('#m-special'),
    forWho: $('#m-for'),
    question: $('#m-question'),
    answers: $('#m-answers'),
    feedback: $('#m-feedback'),
    fact: $('#m-fact'),
    loveActions: $('#m-love-actions'),
    heartBtn: $('#m-heart'),
    skipBtn: $('#m-skip'),
    next: $('#m-next'),
    end: {
      panel: $('#end-panel'),
      emoji: $('#end-emoji'),
      title: $('#end-title'),
      sub: $('#end-sub'),
      scores: $('#end-scores'),
      grid: $('#end-grid'),
      nextDaily: $('#end-next'),
      share: $('#end-share'),
      replay: $('#end-replay'),
      menu: $('#end-menu'),
      quote: $('#end-quote'),
    },
  };

  const state = {
    mode: 'solo',
    topic: null,
    context: null,    // null | { kind: 'daily', key, num, deck } | { kind: 'challenge', from: { name, score }, deck }
    players: [],      // [{ name, score, correct, streak }] (score = points ; cœurs en love)
    current: 0,       // joueur qui répond
    cards: [],
    activeCard: null,
    phase: 'idle',    // idle | pick | picking | question | result | closing | end
    timeLimit: 0,
  };
  let shareAction = null;

  const isLove = () => state.mode === 'love';
  const isGroup = () => state.mode === 'group';
  const isSolo = () => state.mode === 'solo';
  const kind = () => (state.context ? state.context.kind : null);

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
  function makeChip(cls, name, score) {
    const chip = document.createElement('div');
    chip.className = cls;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = name;
    const s = document.createElement('span');
    s.className = 's';
    s.textContent = score;
    chip.append(n, s);
    return chip;
  }

  function updateHeader() {
    const remaining = state.cards.filter((c) => !c.played).length;
    const turn = state.players[state.current];

    if (isLove()) el.sub.textContent = remaining ? L.single.loveTurn(turn.name) : L.single.loveDone;
    else if (isGroup() && remaining) el.sub.textContent = L.group.turn(turn.name);
    else el.sub.textContent = L.single.remaining(remaining);
    el.screen.dataset.turn = `p${state.current + 1}`;

    el.players.innerHTML = '';
    el.players.classList.toggle('many', state.players.length > 2);
    state.players.forEach((p, i) => {
      const active = !isSolo() && i === state.current && remaining > 0;
      el.players.appendChild(makeChip(`pchip p${i + 1}${active ? ' active' : ''}`, p.name,
        isLove() ? `💖 ${p.score}` : L.points(p.score)));
    });
    // Défi : le score à battre reste affiché
    if (kind() === 'challenge') {
      const { from } = state.context;
      el.players.appendChild(makeChip('pchip ghost', L.challenge.target(from.name), L.points(from.score)));
    }
  }

  function hideModal() {
    el.modal.classList.remove('open');
    el.modal.hidden = true;
    el.bigCard.classList.remove('flipped');
  }

  /* ---------- Déroulement ---------- */
  function start({ mode, topic, names, timeLimit = 0, context = null }) {
    state.mode = mode;
    state.topic = topic;
    state.context = context;
    state.timeLimit = mode === 'love' ? 0 : timeLimit;
    state.players = names.map((name) => ({ name, score: 0, correct: 0, streak: 0 }));
    newGame();
  }

  function newGame() {
    Core.clearLater();
    Core.clearConfetti();
    timer.stop();
    hideModal();

    state.players.forEach((p) => Object.assign(p, { score: 0, correct: 0, streak: 0 }));
    const deck = state.context && state.context.deck;
    if (deck) {
      state.cards = Core.createCards(deck.questions, deck.layout);
    } else {
      const count = isGroup() ? GROUP_CARDS[state.players.length] || 10 : 10;
      const questions = Core.draw(state.topic, count);
      state.cards = Core.createCards(questions, isLove() ? null : Core.randomLayout(questions.length));
    }
    state.current = isSolo() ? 0 : Math.floor(Math.random() * state.players.length);
    state.activeCard = null;
    state.phase = 'pick';

    el.screen.classList.toggle('theme-love', isLove());
    el.screen.classList.toggle('turns', !isSolo());
    el.modal.classList.toggle('theme-love', isLove());
    el.topic.textContent = `${state.topic.emoji} ${state.topic.name}`;
    el.legend.textContent = L.special.legend;
    el.legend.hidden = isLove();
    Core.renderBoard(el.board, state.cards, pickCard, { showTopic: !!state.topic.mix });
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
    const player = state.players[state.current];
    state.phase = 'question';

    el.modal.dataset.mode = state.mode;
    el.modal.dataset.player = `p${state.current + 1}`;
    el.bigCard.classList.toggle('hot', card.special === 'hot');
    el.num.textContent = card.index + 1;
    el.chip.textContent = `${q.emoji} ${q.topic}`;
    el.question.textContent = q.question;
    el.special.textContent = '';
    el.special.className = 'special-banner';
    el.feedback.textContent = '';
    el.feedback.className = 'feedback';
    el.fact.textContent = '';
    el.next.hidden = true;
    el.answers.innerHTML = '';

    if (isLove()) {
      el.forWho.textContent = L.single.loveFor(player.name);
      el.loveActions.hidden = false;
      setLoveButtons(false);
      el.timerTrack.hidden = true;
      el.timerText.textContent = '';
    } else {
      el.forWho.textContent = isGroup() ? L.group.for(player.name) : '';
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

    if (card.special) {
      Core.later(() => {
        el.special.textContent = L.special[card.special];
        el.special.classList.add(card.special);
        Sound.play('special');
      }, FLIP_DELAY + SPECIAL_DELAY);
    }

    Core.later(() => {
      if (isLove()) {
        setLoveButtons(true);
      } else {
        el.answers.classList.remove('locked');
        [...el.answers.children].forEach((b) => { b.disabled = false; });
        timer.start(state.timeLimit);
      }
    }, UNLOCK_DELAY);
  }

  /* ---------- Quiz : réponse à choix ---------- */
  function answer(choice) {
    if (state.phase !== 'question' || isLove()) return;

    const card = state.activeCard;
    const { q } = card;
    const player = state.players[state.current];
    const isCorrect = choice === q.correct;
    const timedOut = choice === -1;
    const buttons = [...el.answers.children];

    // 🧿 Khamsa : la 1ʳᵉ erreur est pardonnée, le minuteur continue
    if (!isCorrect && !timedOut && card.special === 'khamsa' && !card.chanceUsed) {
      card.chanceUsed = true;
      buttons[choice].classList.add('wrong');
      buttons[choice].disabled = true;
      el.feedback.textContent = L.special.khamsaSave;
      el.feedback.className = 'feedback lucky';
      Sound.play('special');
      Core.vibrate([30, 40, 30]);
      return;
    }

    state.phase = 'result';
    timer.stop();

    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === q.correct) b.classList.add('correct');
      else if (i === choice) b.classList.add('wrong');
      else if (!b.classList.contains('wrong')) b.classList.add('dim');
    });

    if (isCorrect) {
      const points = Core.pointsFor(card);
      player.score += points;
      player.correct += 1;
      player.streak += 1;
      el.feedback.textContent = Core.praise(points, player.streak);
      el.feedback.className = 'feedback ok';
      Sound.play('correct');
      Core.vibrate(40);
    } else {
      player.streak = 0;
      el.feedback.textContent = timedOut ? L.timeUp : L.wrong;
      el.feedback.className = 'feedback ko';
      Sound.play(timedOut ? 'timeout' : 'wrong');
      Core.vibrate([60, 40, 60]);
    }
    el.special.textContent = '';
    el.special.className = 'special-banner';
    el.fact.textContent = q.fact ? L.fact(q.fact) : '';

    card.played = true;
    card.correct = isCorrect;
    card.by = state.current;
    updateHeader();
    el.next.hidden = false;
    // Petits écrans : le bouton « كمّل » reste visible même avec l'anecdote
    if (el.next.scrollIntoView) el.next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

      const by = state.players[card.by];
      if (isLove()) {
        Core.markCard(card, card.liked ? '💖' : '💬', by.name, [`by-p${card.by + 1}`]);
      } else {
        Core.markCard(card, card.correct ? '✓' : '✗', isGroup() ? by.name : '',
          [`by-p${card.by + 1}`, card.correct ? 'is-correct' : 'is-wrong']);
      }
      state.activeCard = null;

      if (state.cards.every((c) => c.played)) {
        state.phase = 'end';
        updateHeader();
        Core.later(endGame, 600);
        return;
      }
      if (!isSolo()) {
        state.current = (state.current + 1) % state.players.length;
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

  function resetEnd() {
    const e = el.end;
    e.scores.innerHTML = '';
    e.grid.hidden = true;
    e.nextDaily.hidden = true;
    e.share.hidden = true;
    e.replay.hidden = false;
    e.replay.textContent = L.end.replay;
    e.menu.textContent = L.end.menu;
    e.quote.innerHTML = '';
    e.panel.classList.toggle('theme-love', isLove());
    shareAction = null;
  }

  function showShare(label, action) {
    el.end.share.textContent = label;
    el.end.share.hidden = false;
    shareAction = action;
  }

  // Un proverbe tunisien en fin de partie (thème « كمّل المثل »)
  function showQuote() {
    if (isLove() || typeof PROVERBS === 'undefined' || !PROVERBS.length) return;
    const p = Core.pickRandom(PROVERBS);
    const text = document.createElement('span');
    text.textContent = L.end.quote(`${p.start} ${p.end}`);
    const meaning = document.createElement('small');
    meaning.textContent = p.meaning;
    el.end.quote.append(text, meaning);
  }

  function headline(p, total) {
    const e = el.end;
    const ok = p.correct >= 5;
    e.emoji.textContent = p.correct === total ? '🃏' : p.correct >= 8 ? '🏆' : ok ? '👍' : '📚';
    e.title.textContent = p.correct === total ? L.end.perfect : L.end.soloTitle(p.correct);
    e.sub.textContent = L.end.soloSub(p.name, p.correct, total);
    Sound.play(ok ? 'win' : 'tie');
  }

  function saveBest(score) {
    const key = `best.${state.topic.id}`;
    const best = store.get(key, 0);
    if (score > best) store.set(key, score);
    return best;
  }

  function endSolo() {
    const p = state.players[0];
    const total = state.cards.length;
    const best = saveBest(p.score);
    const isRecord = p.score > best;

    headline(p, total);
    addEndRow('p1', L.end.score, L.points(p.score));
    addEndRow(isRecord ? 'p1 winner' : 'p1', isRecord ? L.end.newRecord : L.end.best, L.points(Math.max(best, p.score)));
    showShare(L.challenge.shareBtn, () => shareChallenge());
    if (isRecord || p.correct >= 8) Core.launchConfetti();
  }

  function endChallenge() {
    const e = el.end;
    const p = state.players[0];
    const { from } = state.context;
    const diff = p.score - from.score;
    saveBest(p.score);

    e.emoji.textContent = diff > 0 ? '😎' : diff < 0 ? '😅' : '🤝';
    e.title.textContent = diff > 0 ? L.challenge.win(from.name) : diff < 0 ? L.challenge.lose(from.name) : L.challenge.tie;
    e.sub.textContent = L.end.soloSub(p.name, p.correct, state.cards.length);
    addEndRow(diff > 0 ? 'p1 winner' : 'p1', p.name, L.points(p.score));
    addEndRow(diff < 0 ? 'p2 winner' : 'p2', from.name, L.points(from.score));
    showShare(L.challenge.replyBtn, () => shareChallenge(from));
    e.replay.textContent = L.end.newGame;
    Sound.play(diff >= 0 ? 'win' : 'tie');
    if (diff > 0) Core.launchConfetti();
  }

  // Lien qui permet à un ami de jouer EXACTEMENT les mêmes cartes
  function shareChallenge(replyTo = null) {
    const p = state.players[0];
    const layout = Core.layoutOf(state.cards);
    const code = Core.encode({
      v: 1,
      t: state.topic.id,
      q: state.cards.map((c) => c.q.id),
      h: layout.hot,
      k: layout.khamsa,
      n: p.name,
      s: p.score,
      l: state.timeLimit,
    });
    const text = replyTo
      ? L.challenge.replyText(replyTo.name, replyTo.score, p.score, state.topic.name)
      : L.challenge.shareText(p.score, state.topic.name);
    Core.share(text, Core.link(`c=${code}`));
  }

  function renderDaily(result, num, streak) {
    const e = el.end;
    addEndRow('p1 winner', L.daily.title(num), L.points(result.score));
    addEndRow('p1', L.end.correct, L.single.ratio(result.correct, result.total));
    if (streak) addEndRow('p1', L.daily.streakLabel, L.daily.streak(streak));
    e.grid.textContent = result.grid;
    e.grid.hidden = false;
    e.nextDaily.textContent = L.daily.next(Core.timeToMidnight());
    e.nextDaily.hidden = false;
    e.replay.hidden = true;
    e.menu.textContent = L.end.home;
    showShare(L.daily.shareBtn, () => Core.share(
      L.daily.shareText(num, result.score, result.correct, result.total, streak, result.grid),
      Core.link('daily'),
    ));
  }

  function endDaily() {
    const p = state.players[0];
    const { key, num } = state.context;
    const result = {
      name: p.name, score: p.score, correct: p.correct, total: state.cards.length, grid: Core.gridOf(state.cards),
    };
    const streak = Core.saveDaily(key, result);
    headline(p, result.total);
    renderDaily(result, num, streak);
    if (p.correct >= 8) Core.launchConfetti();
  }

  // Défi du jour déjà joué : on réaffiche le résultat (et le bouton de partage)
  function showDaily(result, num) {
    state.mode = 'solo';
    state.context = null;
    resetEnd();
    el.end.emoji.textContent = '🗓️';
    el.end.title.textContent = L.daily.doneTitle;
    el.end.sub.textContent = L.end.soloSub(result.name, result.correct, result.total);
    renderDaily(result, num, Core.dailyStreak());
    showQuote();
    Core.showScreen('screen-end');
  }

  function endGroup() {
    const e = el.end;
    const ranked = state.players
      .map((p, i) => ({ ...p, i }))
      .sort((a, b) => b.score - a.score || b.correct - a.correct);
    const top = ranked[0].score;
    const winners = ranked.filter((p) => p.score === top);
    const medals = ['🥇', '🥈', '🥉'];

    e.emoji.textContent = winners.length > 1 ? '🤝' : '🏆';
    e.title.textContent = winners.length > 1 ? L.group.tieTitle : L.group.winTitle(winners[0].name);
    e.sub.textContent = L.group.sub(state.cards.length / state.players.length);
    ranked.forEach((p) => {
      const rank = 1 + ranked.filter((o) => o.score > p.score).length;
      addEndRow(`p${p.i + 1}${p.score === top ? ' winner' : ''}`, `${medals[rank - 1] || '🎖️'} ${p.name}`, L.points(p.score));
    });
    Sound.play(winners.length > 1 ? 'tie' : 'win');
    if (winners.length === 1) Core.launchConfetti();
  }

  function endLove() {
    const e = el.end;
    const total = state.players.reduce((sum, p) => sum + p.score, 0);
    e.emoji.textContent = '💞';
    e.title.textContent = L.end.loveTitle;
    e.sub.textContent = L.end.loveSub(total);
    state.players.forEach((p, i) => addEndRow(`p${i + 1}`, p.name, `💖 ${p.score}`));
    e.replay.textContent = L.end.loveReplay;
    Sound.play('heart');
    Core.launchConfetti({ hearts: true });
  }

  function endGame() {
    resetEnd();
    if (isLove()) endLove();
    else if (isGroup()) endGroup();
    else if (kind() === 'daily') endDaily();
    else if (kind() === 'challenge') endChallenge();
    else endSolo();
    showQuote();
    Core.showScreen('screen-end');
  }

  /* ---------- Événements ---------- */
  el.next.addEventListener('click', closeCard);
  el.heartBtn.addEventListener('click', () => loveDone(true));
  el.skipBtn.addEventListener('click', () => loveDone(false));
  el.end.share.addEventListener('click', () => { if (shareAction) shareAction(); });
  el.end.replay.addEventListener('click', () => {
    Sound.unlock();
    state.context = null; // après un défi : nouvelle partie normale sur le même thème
    newGame();
  });
  el.end.menu.addEventListener('click', () => App.home());
  el.quit.addEventListener('click', () => {
    const started = state.cards.some((c) => c.played);
    if (!started || confirm(L.confirmQuit)) App.home();
  });

  return { start, stop, showDaily };
})();



