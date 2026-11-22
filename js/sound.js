/**
 * Effets sonores synthétisés avec la Web Audio API (aucun fichier audio nécessaire).
 * Sons disponibles : pick, flip, tick, correct, wrong, timeout, swap, win, tie, heart, special
 *
 * Compatibilité mobile :
 *  - le contexte audio est (re)débloqué à CHAQUE geste de l'utilisateur (touchend / click / keydown),
 *    y compris après un appel, une mise en arrière-plan ou un verrouillage de l'écran ;
 *  - iPhone : on passe la session audio en mode « lecture » (API audioSession d'iOS 17+, sinon
 *    un audio HTML silencieux en boucle) pour que le son passe même avec le bouton silencieux ;
 *  - un compresseur permet un volume plus fort sur les haut-parleurs de téléphone sans saturer.
 */
const Sound = (() => {
  'use strict';

  const STORAGE_KEY = 'quizcards.muted';
  const MAX_DELAY = 400; // ms : un son qui n'a pas pu partir à temps est abandonné (pas de rafale tardive)

  let ctx = null;
  let master = null;
  let muted = false;
  let primed = false;      // buffer silencieux déjà joué pendant un geste
  let keepAlive = null;    // <audio> silencieux (fallback iOS < 17)

  try { muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { /* ignoré */ }

  const hasAudioSession = () => 'audioSession' in navigator;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS se présente comme un Mac

  /* ---------- iOS : session audio « lecture » ---------- */
  function setPlaybackSession() {
    try { if (hasAudioSession()) navigator.audioSession.type = 'playback'; } catch (_) { /* ignoré */ }
  }

  // Génère un petit fichier WAV silencieux (0,5 s) sans aucun fichier externe
  function silentWavUrl() {
    const rate = 8000;
    const samples = 4000;
    const buf = new ArrayBuffer(44 + samples);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + samples, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, samples, true);
    for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128); // 128 = silence en PCM 8 bits
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  // Fallback iOS < 17 : un <audio> silencieux en lecture fait passer la page en catégorie « lecture »
  function startKeepAlive() {
    if (!isIOS || hasAudioSession() || muted) return;
    try {
      if (!keepAlive) {
        keepAlive = new Audio(silentWavUrl());
        keepAlive.loop = true;
        keepAlive.setAttribute('playsinline', '');
        keepAlive.setAttribute('x-webkit-airplay', 'deny');
      }
      if (keepAlive.paused) {
        const p = keepAlive.play();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (_) { /* ignoré */ }
  }

  function stopKeepAlive() {
    try { if (keepAlive && !keepAlive.paused) keepAlive.pause(); } catch (_) { /* ignoré */ }
  }

  /* ---------- Contexte Web Audio ---------- */
  function createContext() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  }

  // À appeler pendant un geste utilisateur : crée / relance l'audio
  function unlock() {
    setPlaybackSession();
    if (!ctx && !createContext()) return null;

    if (ctx.state !== 'running') {
      try { ctx.resume().catch(() => {}); } catch (_) { /* ignoré */ }
    }
    if (!primed) {
      // Joue un buffer vide pendant le geste (nécessaire sur certains iOS / Android)
      try {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
        primed = true;
      } catch (_) { /* ignoré */ }
    }
    startKeepAlive();
    return ctx;
  }

  // Débloque l'audio à chaque interaction (indispensable après un appel / l'écran verrouillé)
  ['touchend', 'click', 'keydown'].forEach((type) => {
    document.addEventListener(type, () => { if (!muted) unlock(); }, { capture: true, passive: true });
  });

  // Économise la batterie en arrière-plan ; reprise au prochain toucher
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopKeepAlive();
      try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (_) { /* ignoré */ }
    }
  });

  /* ---------- Synthèse ---------- */
  function tone(freq, start, dur, { type = 'sine', vol = 0.3, slideTo = null } = {}) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  const SOUNDS = {
    pick(t) {
      tone(660, t, 0.09, { type: 'triangle', vol: 0.3 });
    },
    flip(t) {
      tone(260, t, 0.2, { type: 'sine', vol: 0.35, slideTo: 980 });
    },
    tick(t) {
      tone(1250, t, 0.05, { type: 'square', vol: 0.12 });
    },
    correct(t) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.08, 0.28, { type: 'triangle', vol: 0.4 }));
      tone(2093, t + 0.34, 0.35, { type: 'sine', vol: 0.12 });
    },
    wrong(t) {
      tone(220, t, 0.22, { type: 'sawtooth', vol: 0.2, slideTo: 160 });
      tone(150, t + 0.22, 0.45, { type: 'sawtooth', vol: 0.2, slideTo: 80 });
    },
    timeout(t) {
      tone(880, t, 0.1, { type: 'square', vol: 0.14 });
      tone(880, t + 0.15, 0.1, { type: 'square', vol: 0.14 });
      SOUNDS.wrong(t + 0.32);
    },
    swap(t) {
      tone(420, t, 0.14, { type: 'sine', vol: 0.2, slideTo: 760 });
    },
    win(t) {
      const notes = [392, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
      const times = [0, 0.12, 0.24, 0.36, 0.52, 0.64, 0.8];
      notes.forEach((f, i) => tone(f, t + times[i], i === notes.length - 1 ? 0.7 : 0.18, { type: 'triangle', vol: 0.4 }));
    },
    tie(t) {
      tone(523.25, t, 0.25, { type: 'triangle', vol: 0.35 });
      tone(523.25, t + 0.3, 0.4, { type: 'triangle', vol: 0.35 });
    },
    heart(t) {
      tone(880, t, 0.35, { type: 'sine', vol: 0.3 });
      tone(1318.5, t + 0.12, 0.5, { type: 'sine', vol: 0.26 });
      tone(1760, t + 0.24, 0.6, { type: 'sine', vol: 0.12 });
    },
    // Carte spéciale révélée (🌶️ / 🧿) : petite cascade scintillante
    special(t) {
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.22, { type: 'sine', vol: 0.22 }));
      tone(2637, t + 0.26, 0.4, { type: 'triangle', vol: 0.08 });
    },
  };

  function play(name) {
    if (muted || !SOUNDS[name]) return;
    if (!ctx && !unlock()) return;

    const requested = performance.now();
    const run = () => {
      if (performance.now() - requested > MAX_DELAY) return;
      try { SOUNDS[name](ctx.currentTime + 0.02); } catch (_) { /* ignoré */ }
    };

    if (ctx.state === 'running') {
      run();
    } else {
      try { ctx.resume().then(run).catch(() => {}); } catch (_) { /* ignoré */ }
    }
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch (_) { /* ignoré */ }
    if (muted) {
      stopKeepAlive();
    } else {
      unlock();
      play('pick');
    }
    return muted;
  }

  return { unlock, play, toggle, isMuted: () => muted };
})();



