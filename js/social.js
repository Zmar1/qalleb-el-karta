/**
 * Interface des comptes et des classements (phase 2) :
 *  - rangée « 🏆 الترتيب · 👤 حسابي » de l'accueil ;
 *  - fenêtre du compte : e-mail + code à 6 chiffres (ou Google), puis pseudo / avatar / ولاية, XP et niveau ;
 *  - écran « 🏆 الترتيب » : défi du jour, semaine, ولايات ;
 *  - fin de partie (solo, défi du jour) : XP gagnée et rang, ou invitation à entrer au classement.
 * La logique (connexion, envoi des parties, file d'attente hors ligne) est dans js/account.js.
 */
const Social = (() => {
  'use strict';

  const { $, $$, store } = Core;
  const RESEND_DELAY = 60;            // secondes avant de pouvoir redemander un code
  const PENDING_TTL = 60 * 60 * 1000; // un code reçu par e-mail reste valable 1 h
  const LATE_PLAY = 15 * 60 * 1000;   // une partie finie avant de se connecter compte encore 15 min

  const el = {
    row: $('#social-row'),
    rankingLabel: $('#ranking-label'),
    rankingBtn: $('#ranking-btn'),
    accountBtn: $('#account-btn'),
    accountAvatar: $('#account-avatar'),
    accountLabel: $('#account-label'),
    accountLevel: $('#account-level'),
    sheet: $('#account'),
    close: $('#acc-close'),
    title: $('#acc-title'),
    views: $$('#account .acc-view'),
    lead: $('#acc-lead'),
    emailForm: $('#acc-email-form'),
    email: $('#acc-email'),
    send: $('#acc-send'),
    googleBox: $('#acc-google-box'),
    or: $('#acc-or'),
    google: $('#acc-google'),
    googleLabel: $('#acc-google-label'),
    codeLead: $('#acc-code-lead'),
    codeForm: $('#acc-code-form'),
    code: $('#acc-code'),
    verify: $('#acc-verify'),
    resend: $('#acc-resend'),
    change: $('#acc-change'),
    profileForm: $('#acc-profile-form'),
    pseudo: $('#acc-pseudo'),
    avatarLabel: $('#acc-avatar-label'),
    avatars: $('#acc-avatars'),
    govLabel: $('#acc-gov-label'),
    gov: $('#acc-gov'),
    save: $('#acc-save'),
    meAvatar: $('#acc-me-avatar'),
    mePseudo: $('#acc-me-pseudo'),
    meSub: $('#acc-me-sub'),
    level: $('#acc-level'),
    xp: $('#acc-xp'),
    xpBar: $('#acc-xp-bar'),
    next: $('#acc-next'),
    toRanking: $('#acc-ranking'),
    edit: $('#acc-edit'),
    signout: $('#acc-signout'),
    del: $('#acc-delete'),
    error: $('#acc-error'),
    back: $('#ranking-back'),
    rTitle: $('#ranking-title'),
    tabs: $$('#ranking-tabs button'),
    sub: $('#ranking-sub'),
    list: $('#ranking-list'),
    me: $('#ranking-me'),
    join: $('#ranking-join'),
    endScreen: $('#screen-end'),
    endRank: $('#end-rank'),
    endSocial: $('#end-social'),
  };

  let pendingEmail = '';
  let resendAt = 0;
  let resendTimer = null;
  let avatar = L.avatars[0];
  let tab = 'daily';
  let back = 'screen-home';
  let loadId = 0;
  let unsent = null; // partie solo finie sans compte : comptée si on se connecte dans la foulée
  let verifying = false; // code en cours de vérification (la suite est gérée par le formulaire)

  const span = (cls, text) => {
    const s = document.createElement('span');
    s.className = cls;
    if (text !== undefined) s.textContent = text;
    return s;
  };

  function busy(btn, on) {
    btn.disabled = on;
    btn.setAttribute('aria-busy', String(on));
  }

  function showError(e) {
    el.error.textContent = L.account.errors[Account.errorKey(e)] || L.account.errors.generic;
  }

  /* ---------- Accueil ---------- */
  function renderHome() {
    const st = Account.state();
    el.row.hidden = !st.enabled;
    if (!st.enabled) return;
    const p = st.profile;
    el.rankingLabel.textContent = L.ranking.btn;
    el.accountAvatar.textContent = p ? p.avatar : '👤';
    el.accountLabel.textContent = p ? p.pseudo : st.signedIn ? L.account.btnFinish : L.account.btn;
    el.accountLevel.textContent = p ? `${st.level.icon} ${st.level.name}` : '';
  }

  /* ---------- Fenêtre du compte ---------- */
  const visibleView = () => (el.views.find((v) => !v.hidden) || {}).dataset;

  function currentView() {
    const st = Account.state();
    if (!st.signedIn) return pendingEmail ? 'code' : 'signin';
    return st.profile ? 'me' : 'profile';
  }

  function showView(name) {
    el.views.forEach((v) => { v.hidden = v.dataset.view !== name; });
    el.error.textContent = '';
    el.title.textContent = {
      signin: L.account.titleSignin, code: L.account.titleCode, profile: L.account.titleProfile, me: L.account.titleMe,
    }[name];
    if (name === 'signin') el.googleBox.hidden = !Account.state().google;
    if (name === 'code') {
      el.codeLead.textContent = L.account.leadCode(pendingEmail);
      el.code.value = '';
      tickResend();
    }
    if (name === 'profile') renderProfileForm();
    if (name === 'me') renderMe();
  }

  function openAccount(view = null) {
    if (!Account.enabled) return;
    showView(view || currentView());
    el.sheet.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('open')));
  }

  function closeAccount() {
    el.sheet.classList.remove('open');
    clearInterval(resendTimer);
    setTimeout(() => { el.sheet.hidden = true; }, 250);
  }

  function setPending(email) {
    pendingEmail = email;
    store.set('pendingEmail', email ? { email, at: Date.now() } : null);
  }

  function tickResend() {
    clearInterval(resendTimer);
    const update = () => {
      const left = Math.ceil((resendAt - Date.now()) / 1000);
      el.resend.disabled = left > 0;
      el.resend.textContent = left > 0 ? L.account.resendIn(left) : L.account.resend;
      if (left <= 0) clearInterval(resendTimer);
    };
    update();
    resendTimer = setInterval(update, 1000);
  }

  function renderProfileForm() {
    const st = Account.state();
    const p = st.profile;
    el.pseudo.placeholder = L.account.pseudoPh;
    if (p) el.pseudo.value = p.pseudo;
    if (p) avatar = p.avatar;
    el.avatars.innerHTML = '';
    L.avatars.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'avatar-opt';
      b.textContent = a;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(a === avatar));
      b.addEventListener('click', () => {
        avatar = a;
        $$('.avatar-opt', el.avatars).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      });
      el.avatars.appendChild(b);
    });
    // ولايات par ordre alphabétique, « برّا تونس » à la fin
    el.gov.innerHTML = '';
    el.gov.add(new Option(L.account.governorateNone, ''));
    Object.entries(L.governorates)
      .filter(([id]) => id !== 'abroad')
      .sort((a, b) => a[1].localeCompare(b[1], 'ar'))
      .concat([['abroad', L.governorates.abroad]])
      .forEach(([id, name]) => el.gov.add(new Option(name, id)));
    el.gov.value = p && p.governorate ? p.governorate : '';
  }

  function renderMe() {
    const st = Account.state();
    const p = st.profile;
    if (!p) return;
    el.meAvatar.textContent = p.avatar;
    el.mePseudo.textContent = p.pseudo;
    el.meSub.textContent = [p.governorate ? `📍 ${L.governorates[p.governorate]}` : '', st.email].filter(Boolean).join(' · ');
    el.level.textContent = `${st.level.icon} ${st.level.name}`;
    el.xp.textContent = L.account.xp(p.xp);
    el.xpBar.style.width = `${Math.round(st.level.progress * 100)}%`;
    el.next.textContent = st.level.next ? L.account.next(st.level.next.xp - p.xp, st.level.next) : L.account.maxLevel;
  }

  // Juste après la connexion / création du profil : la partie et le défi du jour déjà joués comptent
  function afterSignIn() {
    syncDaily();
    if (unsent && Date.now() - unsent.at < LATE_PLAY && Account.state().profile) {
      const play = unsent.play;
      unsent = null;
      if (el.endScreen.classList.contains('active')) afterGame(play);
      else Account.record(play);
    }
  }

  el.emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.error.textContent = ''; // l'ancien message disparaît dès qu'on réessaie
    const email = el.email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      el.error.textContent = L.account.errors.email;
      return;
    }
    busy(el.send, true);
    try {
      await Account.sendCode(email);
      setPending(email);
      resendAt = Date.now() + RESEND_DELAY * 1000;
      showView('code');
      el.code.focus();
    } catch (err) {
      showError(err);
    } finally {
      busy(el.send, false);
    }
  });

  el.codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.error.textContent = '';
    const code = el.code.value.replace(/\D/g, '');
    if (code.length < 6) {
      el.error.textContent = L.account.errors.code;
      return;
    }
    busy(el.verify, true);
    verifying = true;
    try {
      const st = await Account.verifyCode(pendingEmail, code);
      setPending('');
      if (st.profile) {
        Core.toast(L.account.welcome(st.profile.pseudo));
        showView('me');
        afterSignIn();
      } else {
        showView('profile');
        el.pseudo.focus();
      }
    } catch (err) {
      showError(err);
    } finally {
      verifying = false;
      busy(el.verify, false);
    }
  });

  el.resend.addEventListener('click', async () => {
    el.error.textContent = '';
    busy(el.resend, true);
    try {
      await Account.sendCode(pendingEmail);
      setPending(pendingEmail);
      resendAt = Date.now() + RESEND_DELAY * 1000;
    } catch (err) {
      showError(err);
    } finally {
      busy(el.resend, false);
      tickResend();
    }
  });

  el.change.addEventListener('click', () => {
    setPending('');
    showView('signin');
    el.email.focus();
  });

  el.google.addEventListener('click', () => {
    busy(el.google, true);
    Account.signInWithGoogle();
  });

  el.profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.error.textContent = '';
    const pseudo = el.pseudo.value.replace(/\s+/g, ' ').trim();
    if (pseudo.length < 2 || pseudo.length > 16) {
      el.error.textContent = L.account.errors.pseudoInvalid;
      return;
    }
    const first = !Account.state().profile;
    busy(el.save, true);
    try {
      const p = await Account.saveProfile({ pseudo, avatar, governorate: el.gov.value });
      Core.toast(first ? L.account.welcome(p.pseudo) : L.account.saved);
      showView('me');
      afterSignIn();
    } catch (err) {
      showError(err);
    } finally {
      busy(el.save, false);
    }
  });

  el.toRanking.addEventListener('click', () => {
    closeAccount();
    openRanking();
  });
  el.edit.addEventListener('click', () => showView('profile'));
  el.signout.addEventListener('click', async () => {
    await Account.signOut();
    Core.toast(L.account.signedOut);
    closeAccount();
  });
  el.del.addEventListener('click', async () => {
    if (!confirm(L.account.confirmDelete)) return;
    el.error.textContent = '';
    busy(el.del, true);
    try {
      await Account.deleteAccount();
      Core.toast(L.account.deleted);
      closeAccount();
    } catch (err) {
      showError(err);
    } finally {
      busy(el.del, false);
    }
  });

  el.close.addEventListener('click', closeAccount);
  el.sheet.addEventListener('click', (e) => { if (e.target === el.sheet) closeAccount(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.sheet.hidden) closeAccount();
  });
  el.accountBtn.addEventListener('click', () => {
    Sound.play('pick');
    openAccount();
  });

  /* ---------- Écran « 🏆 الترتيب » ---------- */
  const medal = (rank) => ['🥇', '🥈', '🥉'][rank - 1] || String(rank);

  function openRanking(which = tab) {
    if (!Account.enabled) return;
    const active = $('.screen.active');
    back = active && active.id !== 'screen-ranking' ? active.id : back;
    tab = which;
    Core.showScreen('screen-ranking');
    loadRanking();
  }

  function message(text, retry = false) {
    const li = document.createElement('li');
    li.className = 'ranking-msg';
    li.textContent = text;
    if (retry) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'link-btn';
      b.textContent = L.ranking.retry;
      b.addEventListener('click', loadRanking);
      li.appendChild(b);
    }
    return li;
  }

  async function loadRanking() {
    const id = ++loadId;
    const key = Core.dayKey();
    el.tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    el.sub.textContent = tab === 'daily' ? L.ranking.sub.daily(Core.dayNumber(key)) : L.ranking.sub[tab];
    el.list.replaceChildren(message(L.ranking.loading));
    el.me.hidden = true;
    el.join.hidden = true;
    try {
      const data = await Account.leaderboard(tab, key);
      if (id === loadId) renderRanking(data || {});
    } catch (_) {
      if (id === loadId) el.list.replaceChildren(message(L.ranking.error, true));
    }
  }

  function row(x, { mine, who, sub, points, small }) {
    const li = document.createElement('li');
    li.className = ['ranking-row', mine && 'me', x.rank <= 3 && `top${x.rank}`].filter(Boolean).join(' ');
    const id = span('id');
    id.append(span('name', who));
    if (sub) id.append(span('gov', sub));
    const person = span('who');
    if (x.avatar) person.append(span('av', x.avatar));
    person.append(id);
    const pts = span('pts');
    pts.append(span('val', L.points(points)));
    if (small) pts.append(span('small', small));
    li.append(span('rank', medal(x.rank)), person, pts);
    return li;
  }

  function renderRanking(data) {
    const st = Account.state();
    const top = Array.isArray(data.top) ? data.top : [];
    const gov = (g) => (g ? L.governorates[g] || g : '');
    el.list.replaceChildren(...(top.length ? top.map((x) => (tab === 'gov'
      ? row(x, {
        mine: x.governorate === data.mine, who: gov(x.governorate), points: x.points, small: L.ranking.players(x.players),
      })
      : row(x, {
        mine: !!x.me,
        who: x.pseudo,
        sub: gov(x.governorate),
        points: tab === 'daily' ? x.score : x.points,
        small: tab === 'daily' ? '' : L.ranking.games(x.games),
      }))) : [message(L.ranking.empty[tab])]));

    let me = '';
    if (st.profile && tab === 'gov') {
      const mine = top.find((x) => x.governorate === data.mine);
      me = !data.mine ? L.ranking.noGov : mine ? L.ranking.meGov(mine.rank, gov(data.mine)) : L.ranking.notRanked;
    } else if (st.profile) {
      me = data.me ? L.ranking.me(data.me.rank, data.players) : L.ranking.notRanked;
    }
    el.me.textContent = me;
    el.me.hidden = !me;
    el.join.textContent = L.ranking.join;
    el.join.hidden = !!st.profile;
  }

  el.tabs.forEach((b) => b.addEventListener('click', () => {
    if (tab === b.dataset.tab) return;
    tab = b.dataset.tab;
    Sound.play('pick');
    loadRanking();
  }));
  el.back.addEventListener('click', () => {
    if (back === 'screen-home' || !$(`#${back}`)) App.home();
    else Core.showScreen(back);
  });
  el.join.addEventListener('click', () => openAccount());
  el.rankingBtn.addEventListener('click', () => {
    Sound.play('pick');
    openRanking('daily');
  });

  /* ---------- Fin de partie ---------- */
  function clearEnd() {
    el.endRank.hidden = true;
    el.endRank.textContent = '';
    el.endSocial.hidden = true;
    el.endSocial.onclick = null;
  }

  // play : partie à compter (solo / défi du jour) ; null = résultat déjà affiché (défi du jour déjà joué)
  function afterGame(play, hint = play && play.kind) {
    clearEnd();
    if (!Account.enabled) return;
    const st = Account.state();
    el.endSocial.hidden = false;
    if (!st.profile) {
      el.endSocial.textContent = L.endRank.join;
      el.endSocial.onclick = () => openAccount();
      if (play && play.kind === 'solo') unsent = { play, at: Date.now() };
      return;
    }
    el.endSocial.textContent = L.endRank.view;
    el.endSocial.onclick = () => openRanking(hint === 'daily' ? 'daily' : 'week');
    if (!play) return;
    el.endRank.hidden = false;
    el.endRank.textContent = L.endRank.sending;
    Account.record(play).then((r) => {
      if (!el.endScreen.classList.contains('active')) return;
      if (!r || r.status === 'duplicate') {
        el.endRank.hidden = true;
        return;
      }
      if (r.status === 'pending') {
        el.endRank.textContent = L.endRank.pending;
        return;
      }
      if (r.status === 'refused') {
        el.endRank.textContent = L.endRank.refused;
        return;
      }
      const res = r.result || {};
      const level = Account.state().level;
      el.endRank.textContent = play.kind === 'daily' && res.rank
        ? (res.inserted ? L.endRank.daily(res.rank, res.players, play.score) : L.endRank.already(res.rank, res.players))
        : L.endRank.solo(play.score, level);
      if (res.levelUp) {
        Core.toast(L.levelUp(res.levelUp));
        Core.launchConfetti();
      }
    });
  }

  // Défis du jour finis sur ce téléphone (aujourd'hui et hier) : envoyés une fois au classement
  function syncDaily() {
    if (!Account.state().profile) return;
    const days = [Core.dayKey(), Core.dayKey(new Date(Date.now() - 864e5))];
    Account.syncDaily(days.map((day) => ({ day, result: store.get(`daily.${day}`, null) })).filter((x) => x.result));
  }

  /* ---------- Démarrage ---------- */
  async function init() {
    el.lead.textContent = L.account.leadSignin;
    el.email.placeholder = L.account.emailPh;
    el.send.textContent = L.account.send;
    el.or.textContent = L.account.or;
    el.googleLabel.textContent = L.account.google;
    el.code.placeholder = L.account.codePh;
    el.verify.textContent = L.account.verify;
    el.change.textContent = L.account.changeEmail;
    el.avatarLabel.textContent = L.account.avatar;
    el.govLabel.textContent = L.account.governorate;
    el.save.textContent = L.account.save;
    el.toRanking.textContent = L.account.ranking;
    el.edit.textContent = L.account.edit;
    el.signout.textContent = L.account.signout;
    el.del.textContent = L.account.delete;
    el.rTitle.textContent = L.ranking.title;
    el.back.textContent = L.ranking.back;
    el.tabs.forEach((b) => { $('b', b).textContent = L.ranking.tabs[b.dataset.tab]; });

    const pending = store.get('pendingEmail', null);
    if (pending && pending.email && Date.now() - pending.at < PENDING_TTL) {
      pendingEmail = pending.email;
      resendAt = pending.at + RESEND_DELAY * 1000;
    }

    Account.onChange((st) => {
      renderHome();
      if (el.sheet.hidden) return;
      const v = (visibleView() || {}).view;
      if (v === 'me') {
        if (st.profile) renderMe();
        else showView(currentView());
      } else if ((v === 'signin' || v === 'code') && st.signedIn && !verifying) {
        // Connecté en cliquant sur le lien de l'e-mail (souvent dans un autre onglet) : on passe à la suite
        setPending('');
        showView(currentView());
        if (st.profile) afterSignIn();
      }
    });
    renderHome();
    if (!Account.enabled) return;

    // Parties en attente : envoyées dès que le réseau revient
    window.addEventListener('online', () => Account.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Account.flush();
    });

    const redirect = await Account.init(); // lit d'abord le retour de Google dans l'adresse
    renderHome();
    if (redirect && redirect.error) {
      Core.toast(L.account.errors.google);
    } else if (redirect && redirect.signedIn) {
      const st = Account.state();
      if (st.profile) {
        Core.toast(L.account.welcome(st.profile.pseudo));
        afterSignIn();
      } else {
        openAccount('profile');
      }
    } else {
      syncDaily();
    }
  }

  return { init, renderHome, openAccount, openRanking, afterGame, clearEnd, syncDaily };
})();





