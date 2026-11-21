/**
 * Textes de l'interface en derja tunisienne (arabe tunisien, écriture arabe, RTL).
 * Toutes les phrases affichées par le jeu sont ici : modifie-les sans toucher à la logique.
 */

// Isole un nom (latin ou arabe) dans une phrase arabe → évite les inversions d'affichage RTL
const bidi = (s) => `\u2068${s}\u2069`;
// Force un fragment numérique à s'afficher de gauche à droite (ex. « 3 / 10 », « +1 »)
const ltr = (s) => `\u2066${s}\u2069`;

const L = {
  letters: ['أ', 'ب', 'ج'],

  /* ---------- Général ---------- */
  card: (n) => `كارطة ${n}`,
  soundOn: 'شغّل الصوت',
  soundOff: 'قصّ الصوت',
  confirmQuit: 'متأكّد تحبّ تخرج من اللعبة؟',
  timer: (s) => `⏱ ${s}`,

  /* ---------- Accueil ---------- */
  questionsBadge: (n, best) => `🎯 ${n} سؤال${best !== null ? ` · 🏅 ${ltr(`${best}/10`)}` : ''}`,
  loveBadge: '💬 أجوبة حرّة · لزوز',
  mix: { name: 'خلطة', description: 'شويّة من كل موضوع' },

  /* ---------- Configuration ---------- */
  modes: {
    solo: {
      desc: '👤 جاوب وحدك على 10 كارطات و حاول تفوت أحسن نتيجة متاعك.',
      start: 'إبدا وحدك',
      p1: 'إسمك',
    },
    duel: {
      desc: '⚔️ وجه لوجه: واحد يقرا السؤال و لاخر يختار الجواب. الأدوار تتبدّل في كل كارطة.',
      start: 'هيّا للماتش ⚔️',
      p1: 'إسمك (لوطا)',
      p2: 'اللي قدّامك (الفوق)',
    },
    love: {
      desc: '💬 كل واحد بدورو: قلّبو كارطة و جاوبو بالصوت العالي. أعطيو 💖 لأحلى جواب!',
      start: 'هيّا نبداو 💕',
      p1: 'إسمك',
      p2: 'إسم حبيبك / حبيبتك',
    },
  },
  defaultNames: { p1: 'لاعب 1', p2: 'لاعب 2', loveP1: 'أنا', loveP2: 'عمري' },

  /* ---------- En jeu ---------- */
  bravo: ['برافو عليك! 🎉', 'يعطيك الصحّة! 🔥', 'مريقل! ✨', 'خطير! 💪', 'صحّة ليك! 👏'],
  plusOne: ltr('+1'),
  wrong: '❌ غلطت! الجواب الصحيح بالأخضر',
  timeUp: '⏰ الوقت وفى!',

  /* ---------- 1 contre 1 ---------- */
  duel: {
    roleAnswer: '🎯 دورك تجاوب',
    roleAsk: '📢 إنتي اللي تسأل',
    roleEnd: 'الماتش وفى',
    choosing: (n) => `${bidi(n)} قاعد يختار في كارطة…`,
    listening: (n) => `👂 ${bidi(n)} قاعد يقرالك في السؤال…`,
    found: (n) => `✅ ${bidi(n)} لقاها!`,
    missed: (n) => `❌ ${bidi(n)} غلط`,
    noAnswer: (n) => `⏰ ${bidi(n)} ما جاوبش`,
    oppScore: (n, s) => `${bidi(n)}: ${s}`,
    tie: 'تعادل!',
    win: 'ربحت!',
    lose: 'خسرت…',
    finalScore: (me, ms, opp, os) => `${bidi(me)} ${ms} – ${os} ${bidi(opp)}`,
  },

  /* ---------- Solo & Amoureux ---------- */
  single: {
    remaining: (n) => (n > 1 ? `باقي ${n} كارطات` : n === 1 ? 'آخر كارطة!' : 'وفات اللعبة'),
    soloScore: (s, total) => ltr(`${s} / ${total}`),
    loveTurn: (n) => `💬 السؤال لـ${bidi(n)}`,
    loveDone: 'وفات اللعبة 💞',
    loveFor: (n) => `لـ${bidi(n)} · جاوب بالصوت العالي 💬`,
    heartFor: (n) => `💖 قلب لـ${bidi(n)}!`,
  },

  /* ---------- Fin de partie ---------- */
  end: {
    soloTitle: (s) => (s >= 8 ? 'خطير!' : s >= 5 ? 'موش خايب!' : 'المرّة الجاية خير!'),
    soloSub: (n, s, total) => `${bidi(n)}، جاوبت صحيح على ${s} من ${total}`,
    score: 'النتيجة',
    best: '🏅 أحسن نتيجة',
    newRecord: '🎉 ريكور جديد!',
    replay: '🔁 عاود',
    loveTitle: 'ربّي يخلّيكم لبعضكم',
    loveSub: (t) => (t ? `عطيتو لبعضكم ${t} 💖` : 'المرّة الجاية زيدو شويّة حنان 😘'),
    loveReplay: '💕 أسئلة جدد',
  },
};

