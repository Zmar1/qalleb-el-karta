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
  points: (p) => `⭐ ${p}`,
  plus: (p) => ltr(`+${p}`),
  fact: (f) => `💡 ${f}`,
  streak: (n) => `🔥 ${n} متتاليين!`,
  // Thème de la carte (+ badge si la question vient d'être ajoutée)
  category: (q, isNew) => `${q.emoji} ${q.topic}${isNew ? ' · ✨ جديد' : ''}`,

  /* ---------- Accueil ---------- */
  questionsBadge: (n, best) => `🎯 ${n} سؤال${best !== null ? ` · 🏅 ${best}` : ''}`,
  loveBadge: (n) => `💬 ${n} سؤال · لزوز`,
  tileCount: (n) => `🎯 ${n} سؤال`,
  tileBest: (b) => `🏅 ${b}`,
  tileSeen: (s, n) => `شفت ${s} من ${n} سؤال`,
  mix: { name: 'خلطة', description: 'شويّة من كل موضوع' },

  /* ---------- Aide (affichée à la 1ʳᵉ visite et via le bouton ؟) ---------- */
  help: {
    title: 'كيفاش نلعبو؟ 🃏',
    ok: 'فهمت، هيّا نلعبو! ✓',
    steps: [
      { icon: '🃏', title: 'قلّب كارطة', text: 'كل كارطة مخبّية سؤال. جاوب قبل ما يوفى الوقت!' },
      { icon: '🎚️', title: '3 مستويات', text: 'ساهل (زوز إختيارات)، متوسّط (3) و صعيب: تكتب الجواب بالعربي ولا بالفرنسي. كل ما يصعب، النقاط تكبر!' },
      { icon: '🌶️', title: 'الكارطات الحارّة', text: 'الكارطة اللي عليها 🌶️ تعطيك النقاط بزوز كان جاوبت صحيح. شكون يلحقها الأوّل؟' },
      { icon: '🧿', title: 'الخمسة المخبّية', text: 'في كل لعبة كارطة وحدة فيها خمسة: كان غلطت فيها، عندك فرصة ثانية!' },
      { icon: '🗓️', title: 'تحدّي اليوم', text: 'كل نهار 10 أسئلة جدد، نفسهم لكل الناس. شارك نتيجتك و ما تقطعش السلسلة 🔥' },
      { icon: '🤝', title: 'تحدّى صحابك', text: 'كمّل لعبة وحدك و إبعث رابط لصاحبك: يلعب نفس الأسئلة و تشوفو شكون الأقوى.' },
      { icon: '👥', title: 'مع العايلة و الصحاب', text: 'من 2 لـ 6 على نفس التليفون، ولا وجه لوجه ⚔️. في الصعيب، الجماعة ولا اللي قدّامك يحكم على الجواب ⚖️' },
      { icon: '📲', title: 'نزّلها كيف التطبيق', text: 'من قائمة المتصفّح إختار «Ajouter à l\'écran d\'accueil»: تخدم حتى بلاش إنترنت!' },
    ],
  },

  /* ---------- Configuration ---------- */
  modes: {
    solo: {
      desc: '👤 جاوب وحدك على 10 كارطات و كسّر الريكور متاعك. من بعد تحدّى صحابك بنفس الأسئلة 🤝',
      start: 'إبدا وحدك',
      p: () => 'إسمك',
    },
    group: {
      desc: '👥 من 2 لـ 6 لاعبين على نفس التليفون: كل واحد بدورو يقلّب كارطة و يجاوب. اللي يلمّ أكثر نقاط يربح!',
      start: 'هيّا نبداو 👥',
      p: (i) => `إسم اللاعب ${i + 1}`,
    },
    duel: {
      desc: '⚔️ وجه لوجه و التليفون على الطاولة: واحد يقرا السؤال و لاخر يختار الجواب. الأدوار تتبدّل في كل كارطة.',
      start: 'هيّا للماتش ⚔️',
      p: (i) => ['إسمك (لوطا)', 'اللي قدّامك (الفوق)'][i],
    },
    love: {
      desc: '💬 كل واحد بدورو: قلّبو كارطة و جاوبو بالصوت العالي. أعطيو 💖 لأحلى جواب!',
      start: 'هيّا نبداو 💕',
      p: (i) => ['إسمك', 'إسم حبيبك / حبيبتك'][i],
    },
  },
  seats: ['⬇️ لوطا', '⬆️ الفوق'],
  removePlayer: 'نحّي اللاعب',
  playerLabel: (i) => `إسم اللاعب ${i}`,
  defaultNames: { p: (i) => `لاعب ${i}`, love: ['أنا', 'عمري'] },

  /* ---------- Cartes spéciales ---------- */
  special: {
    hot: '🌶️ كارطة حارّة: كان جاوبت صحيح، النقاط بزوز!',
    khamsa: '🧿 خمسة و خميس! كان تغلط، عندك فرصة ثانية',
    khamsaSave: '🧿 الخمسة حمتك! جرّب مرّة أخرى',
    khamsaOpp: (n) => `🧿 ${bidi(n)} عندو فرصة ثانية…`,
    hotLabel: 'كارطة حارّة 🌶️',
    legend: '🌶️ النقاط بزوز · 🧿 خمسة مخبّية = فرصة ثانية',
    // Versions courtes pour l'écran partagé (face à face)
    short: { hot: '🌶️ كارطة حارّة: النقاط بزوز!', khamsa: '🧿 خمسة و خميس: فرصة ثانية!' },
  },

  /* ---------- Niveaux ---------- */
  levels: {
    easy: { emoji: '🟢', label: 'ساهل', desc: '🟢 زوز إختيارات برك · الجواب الصحيح بنقطة' },
    medium: { emoji: '🟡', label: 'متوسّط', desc: '🟡 3 إختيارات · الجواب الصحيح بزوز نقاط' },
    hard: {
      emoji: '🔴',
      label: 'صعيب',
      desc: '🔴 بلا إختيارات: أكتب الجواب بالعربي ولا بالفرنسي (نقبلو غلطة ولا زوز) · 3 نقاط',
      duel: '🔴 بلا إختيارات: جاوب بالصوت، و اللي قدّامك هو الحكم ⚖️ · 3 نقاط',
    },
  },

  /* ---------- Réponse écrite (صعيب) ---------- */
  typed: {
    placeholder: '✍️ أكتب الجواب هنا…',
    submit: 'تأكيد ✓',
    hint: {
      both: 'بالعربي ولا بالفرنسي · نقبلو غلطة ولا زوز',
      arabic: 'بالعربي (بالتونسي) · نقبلو غلطة ولا زوز',
      digits: 'أكتب الرقم',
    },
    wrote: (s) => `✍️ كتبت: «${bidi(s)}»`,
    answer: (s) => `✅ الجواب: ${s}`,
    wrong: '❌ موش هو!',
    close: '😅 قريب برشا، أمّا موش هو!',
    appeal: '⚖️ الجماعة تحكم: الجواب هذا صحيح؟',
    accept: '✅ نقبلوه',
    accepted: '⚖️ الجماعة قبلت الجواب!',
    report: '📮 جوابي صحيح؟ بلّغ الأدمين',
    reported: '📮 وصل للأدمين، يعطيك الصحّة! 🙏',
    // Sans base de données : message à partager, l'admin ajoute la variante dans la page admin
    reportText: (id, question, typed, good) => `📮 قلّب الكارطة · جواب مرفوض\n🆔 ${id}\n❓ ${question}\n✍️ ${typed}\n✅ ${good}`,
  },

  /* ---------- Base de données (js/data.js) ---------- */
  data: {
    fresh: (n) => `✨ أسئلة جديدة وصلت: ${ltr(`+${n}`)}`,
  },

  /* ---------- Arbitre (صعيب en face à face) ---------- */
  judge: {
    role: '⚖️ إنتي الحكم',
    say: '🎤 جاوب بالصوت العالي! اللي قدّامك هو الحكم ⚖️',
    listen: (n) => `🎤 ${bidi(n)} يجاوب بالصوت… إحكم إنتي!`,
    answer: (s) => `✅ الجواب الصحيح: ${s}`,
    right: '✅ صحيح',
    wrong: '❌ غالط',
  },

  /* ---------- En jeu ---------- */
  bravo: ['برافو عليك! 🎉', 'يعطيك الصحّة! 🔥', 'مريقل! ✨', 'خطير! 💪', 'صحّة ليك! 👏'],
  wrong: '❌ غلطت! الجواب الصحيح بالأخضر',
  timeUp: '⏰ الوقت وفى!',

  /* ---------- Face à face ---------- */
  duel: {
    roleAnswer: '🎯 دورك تجاوب',
    roleAsk: '📢 إنتي اللي تسأل',
    roleEnd: 'الماتش وفى',
    hint: '📢 اقرا السؤال و الإختيارات بالصوت العالي',
    hintOral: '📢 اقرا السؤال بالصوت العالي (بلا إختيارات) و إحكم على الجواب ⚖️',
    choosing: (n) => `${bidi(n)} قاعد يختار في كارطة…`,
    listening: (n) => `👂 ${bidi(n)} قاعد يقرالك في السؤال…`,
    found: (n, p) => `✅ ${bidi(n)} لقاها! ${ltr(`+${p}`)}`,
    missed: (n) => `❌ ${bidi(n)} غلط`,
    noAnswer: (n) => `⏰ ${bidi(n)} ما جاوبش`,
    oppScore: (n, s) => `${bidi(n)}: ${s}`,
    tie: 'تعادل!',
    win: 'ربحت!',
    lose: 'خسرت…',
    finalScore: (me, ms, opp, os) => `${bidi(me)} ${ms} – ${os} ${bidi(opp)}`,
  },

  /* ---------- Groupe (2 à 6 sur le même téléphone) ---------- */
  group: {
    turn: (n) => `🎯 دور ${bidi(n)}`,
    for: (n) => `🎯 السؤال لـ${bidi(n)}`,
    winTitle: (n) => `${bidi(n)} ربح! 🏆`,
    tieTitle: 'تعادل في القمّة! 🤝',
    sub: (n) => `كل واحد قلّب ${n} كارطات`,
  },

  /* ---------- Solo & Amoureux ---------- */
  single: {
    remaining: (n) => (n > 1 ? `باقي ${n} كارطات` : n === 1 ? 'آخر كارطة!' : 'وفات اللعبة'),
    ratio: (s, total) => ltr(`${s} / ${total}`),
    loveTurn: (n) => `💬 السؤال لـ${bidi(n)}`,
    loveDone: 'وفات اللعبة 💞',
    loveFor: (n) => `لـ${bidi(n)} · جاوب بالصوت العالي 💬`,
    heartFor: (n) => `💖 قلب لـ${bidi(n)}!`,
  },

  /* ---------- Défi du jour ---------- */
  daily: {
    title: (num) => `تحدّي اليوم ${ltr(`#${num}`)}`,
    todo: 'نفس الـ10 أسئلة لكل الناس · محاولة وحدة',
    done: (s) => `✅ جبت ⭐ ${s} · شارك نتيجتك`,
    streak: (n) => `🔥 ${n}`,
    streakLabel: '🔥 أيّام ورا بعضهم',
    desc: 'نفس الـ10 أسئلة لكل التوانسة اليوم، من كل المواضيع. عندك محاولة وحدة: ركّز!',
    start: 'إبدا التحدّي 🗓️',
    doneTitle: 'كمّلت تحدّي اليوم ✅',
    next: (t) => `⏳ التحدّي الجاي بعد ${ltr(t)}`,
    shareBtn: '📤 شارك نتيجتك',
    // Texte partagé (WhatsApp, Messenger…) : pas de caractères de contrôle bidi
    shareText: (num, s, c, total, streak, grid) => [
      `قلّب الكارطة 🇹🇳 · تحدّي اليوم #${num}`,
      `⭐ ${s} · ✅ ${c}/${total}${streak > 1 ? ` · 🔥 ${streak}` : ''}`,
      grid,
      'تنجّم تعمل خير منّي؟ 👇',
    ].join('\n'),
  },

  /* ---------- Défi entre amis (lien) ---------- */
  challenge: {
    title: (n) => `${bidi(n)} يتحدّاك!`,
    desc: (s, topic, lvl) => `جاب ⭐ ${s} في «${topic}» (${lvl}). نفس الأسئلة و نفس الوقت: تنجّم تغلبو؟`,
    start: 'قبلت التحدّي 💪',
    invalid: '😕 الرابط هذا ما عادش يخدم',
    target: (n) => `🎯 ${bidi(n)}`,
    win: (n) => `غلبت ${bidi(n)}! 😎`,
    lose: (n) => `${bidi(n)} غلبك هالمرّة…`,
    tie: 'تعادل! 🤝',
    shareBtn: '🤝 تحدّى صاحبك',
    replyBtn: '🔁 ردّ عليه بتحدّي',
    shareText: (s, topic, lvl) => `🤝 جبت ⭐ ${s} في «${topic}» (${lvl}) على قلّب الكارطة 🇹🇳\nنفس الأسئلة، تنجّم تغلبني؟ 😏👇`,
    replyText: (opp, os, ms, topic) => `🤝 ${opp}: ⭐ ${os} — أنا: ⭐ ${ms} في «${topic}»\nقلّب الكارطة 🇹🇳 · نعاودو؟ 😏👇`,
  },

  share: {
    copied: '📋 الرابط تنسخ! حطّو في واتساب ولا مسنجر',
  },

  /* ---------- Fin de partie ---------- */
  end: {
    soloTitle: (c) => (c >= 8 ? 'خطير!' : c >= 5 ? 'موش خايب!' : 'المرّة الجاية خير!'),
    perfect: 'شكبّة! 🃏 10 على 10',
    soloSub: (n, c, total) => `${bidi(n)}، جاوبت صحيح على ${c} من ${total}`,
    score: '⭐ النقاط',
    correct: '✅ أجوبة صحيحة',
    best: '🏅 أحسن نتيجة',
    newRecord: '🎉 ريكور جديد!',
    replay: '🔁 عاود',
    newGame: '🎲 لعبة جديدة',
    menu: '🏠 بدّل الموضوع',
    home: '🏠 الصفحة الأولى',
    quote: (p) => `🗣️ «${p}»`,
    loveTitle: 'ربّي يخلّيكم لبعضكم',
    loveSub: (t) => (t ? `عطيتو لبعضكم ${t} 💖` : 'المرّة الجاية زيدو شويّة حنان 😘'),
    loveReplay: '💕 أسئلة جدد',
  },

  /* ---------- Compte joueur (js/account.js, js/social.js) ---------- */
  account: {
    btn: 'حسابي',
    btnFinish: 'كمّل حسابك',
    titleSignin: '👤 أدخل لحسابك',
    leadSignin: 'أدخل باش تدخل للترتيب، تجمع النقاط و تطلع في المستوى. اللعب يبقى بلاش، حتّى بلا حساب.',
    emailPh: 'الإيمايل متاعك',
    send: '📧 إبعثلي كود',
    or: 'ولا',
    google: 'كمّل بـ Google',
    titleCode: '📧 الكود متاعك',
    leadCode: (email) => `بعثنالك كود من 6 أرقام على ${bidi(email)}. ما لقيتوش؟ شوف في الـ Spam.`,
    codePh: '123456',
    verify: '✅ تأكيد',
    resend: '🔁 عاود إبعث الكود',
    resendIn: (s) => `🔁 تنجّم تعاود تبعث بعد ${ltr(s)} ث`,
    changeEmail: '✏️ بدّل الإيمايل',
    titleProfile: '😎 كيفاش يعرفوك في الترتيب؟',
    pseudoPh: 'إسمك في الترتيب (2 حتّى 16 حرف)',
    avatar: 'إختار صورتك',
    governorate: '📍 ولايتك',
    governorateNone: '— إختار —',
    save: '💾 سجّل',
    titleMe: '👤 حسابي',
    xp: (xp) => `${ltr(xp)} XP`,
    next: (n, lvl) => `باقيلك ${ltr(n)} XP باش تولّي ${lvl.icon} ${lvl.name}`,
    maxLevel: '👑 وصلت لأعلى مستوى!',
    ranking: '🏆 الترتيب',
    edit: '✏️ بدّل البروفيل',
    signout: '🚪 أخرج من الحساب',
    delete: '🗑️ فسّخ حسابي',
    confirmDelete: 'متأكّد تحبّ تفسّخ حسابك؟ النقاط و الترتيب يمشيو نهائيا.',
    deleted: '🗑️ تفسّخ الحساب',
    welcome: (p) => `🎉 مرحبا بيك ${bidi(p)}!`,
    saved: '✅ تسجّل!',
    signedOut: '👋 خرجت من الحساب',
    errors: {
      offline: '📡 ما فماش إنترنت، عاود بعد شويّة.',
      email: '✉️ الإيمايل هذا موش صحيح.',
      rate: '⏳ برشا محاولات: إستنّى شويّة و عاود.',
      code: '❌ الكود غالط ولا وفى وقتو. عاود إبعث كود جديد.',
      pseudoTaken: '😅 الإسم هذا مستعمل، إختار إسم آخر.',
      pseudoInvalid: '✏️ الإسم لازم بين 2 و 16 حرف: حروف، أرقام، فراغ.',
      banned: '🚫 الحساب هذا موقوف.',
      google: '❌ الدخول بـ Google ما مشاش. عاود ولا إستعمل الإيمايل.',
      generic: '😕 صارت مشكلة، عاود بعد شويّة.',
    },
  },

  // Niveaux selon l'XP (= total des points ⭐ des parties comptées)
  levelsXp: [
    { xp: 0, icon: '🌱', name: 'مبتدئ' },
    { xp: 100, icon: '📘', name: 'تلميذ' },
    { xp: 300, icon: '✏️', name: 'شاطر' },
    { xp: 700, icon: '🧠', name: 'فهّام' },
    { xp: 1500, icon: '🎓', name: 'خبير' },
    { xp: 3000, icon: '🏅', name: 'أستاذ' },
    { xp: 6000, icon: '🦅', name: 'بطل' },
    { xp: 12000, icon: '👑', name: 'أسطورة' },
  ],
  levelUp: (lvl) => `🎉 مبروك! ولّيت ${lvl.icon} ${lvl.name}`,

  // Identifiants = ceux de la base (supabase/maj/02-comptes-classements.sql)
  governorates: {
    tunis: 'تونس', ariana: 'أريانة', 'ben-arous': 'بن عروس', manouba: 'منّوبة', nabeul: 'نابل',
    zaghouan: 'زغوان', bizerte: 'بنزرت', beja: 'باجة', jendouba: 'جندوبة', kef: 'الكاف', siliana: 'سليانة',
    sousse: 'سوسة', monastir: 'المنستير', mahdia: 'المهدية', sfax: 'صفاقس', kairouan: 'القيروان',
    kasserine: 'القصرين', 'sidi-bouzid': 'سيدي بوزيد', gabes: 'قابس', medenine: 'مدنين', tataouine: 'تطاوين',
    gafsa: 'قفصة', tozeur: 'توزر', kebili: 'قبلي', abroad: '🌍 برّا تونس',
  },
  avatars: ['🐪', '🌴', '🫒', '🌶️', '🐟', '🧿', '🌙', '⭐', '🦅', '🦁', '🐬', '🍊', '🏺', '⚽', '🌸', '☕'],

  /* ---------- Classements ---------- */
  ranking: {
    btn: 'الترتيب',
    title: '🏆 الترتيب',
    back: '→ الرجوع',
    tabs: { daily: 'اليوم', week: 'الجمعة', gov: 'الولايات' },
    sub: {
      daily: (num) => `🗓️ تحدّي اليوم ${ltr(`#${num}`)}: نفس الـ10 أسئلة للكل`,
      week: '📅 نقاط الجمعة هاذي (من نهار الإثنين): وحدي + تحدّي اليوم',
      gov: '🇹🇳 كل لاعب يزيد نقاطو لولايتو: شكون أقوى ولاية الجمعة هاذي؟',
    },
    loading: '⏳ لحظة…',
    error: '📡 ما نجّمناش نجيبو الترتيب. ثبّت في الإنترنت و عاود.',
    retry: '🔁 عاود',
    empty: {
      daily: 'مازال حتّى حدّ ما كمّل تحدّي اليوم. كون الأوّل! 💪',
      week: 'مازال حتّى نقاط الجمعة هاذي. إلعب و كون الأوّل! 💪',
      gov: 'مازال حتّى ولاية ما جابت نقاط الجمعة هاذي. 💪',
    },
    me: (rank, total) => `🎯 إنتي في المرتبة ${ltr(rank)} من ${ltr(total)}`,
    meGov: (rank, name) => `📍 ${name} في المرتبة ${ltr(rank)}`,
    noGov: '📍 زيد ولايتك في حسابك باش تجيبلها النقاط 💪',
    notRanked: '🎮 مازلت ما دخلتش للترتيب هذا: إلعب باش تطلع!',
    players: (n) => `👥 ${ltr(n)}`,
    games: (n) => `${ltr(n)} طرح`,
    join: '🏆 أدخل للترتيب',
  },
  endRank: {
    sending: '⏳ نبعثو في النتيجة للترتيب…',
    daily: (rank, total, xp) => `🏆 ترتيبك اليوم: ${ltr(rank)} من ${ltr(total)} · ⭐ ${ltr(`+${xp}`)} XP`,
    already: (rank, total) => `🏆 ترتيبك اليوم: ${ltr(rank)} من ${ltr(total)}`,
    solo: (xp, lvl) => `⭐ ${ltr(`+${xp}`)} XP · ${lvl.icon} ${lvl.name}`,
    pending: '📮 النتيجة تتبعث للترتيب كي ترجع للإنترنت',
    refused: '⚠️ النتيجة هاذي ما تحسبتش في الترتيب',
    view: '🏆 شوف الترتيب',
    join: '🏆 أدخل للترتيب و إجمع النقاط',
  },
};
