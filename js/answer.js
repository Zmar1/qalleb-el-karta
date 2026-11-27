/**
 * Correction des réponses écrites (niveau صعيب).
 *
 * Fiabilité :
 *  - normalisation arabe (hamza, ة/ه, ى/ي, voyelles, chadda, « ال », ڨ/ڤ) et française (accents, articles) ;
 *  - chiffres arabes ٠-٩ acceptés ; un nombre doit être EXACT (1956 ≠ 1957), l'unité est facultative ;
 *  - aucune faute tolérée jusqu'à 3 lettres, 1 faute de 4 à 6 lettres, 2 fautes au-delà ;
 *  - garde-fou : une saisie aussi proche d'un mauvais choix que de la bonne réponse est refusée ;
 *  - une question n'est posée à l'écrit que si ses mauvais choix ne peuvent pas passer pour la bonne réponse.
 * Réponses acceptées en plus (français, variantes) : ANSWERS dans js/topics/_answers.js.
 */
const Answer = (() => {
  'use strict';

  const STOP = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux', 'et', 'en', 'the', 'and', 'و', 'في']);
  const MAX_TYPABLE = 20; // réponse plus longue (sans variante courte) → pas proposée à l'écrit

  const digit = (zero) => (d) => String(d.charCodeAt(0) - zero);

  function tokens(text, keepArticle = false) {
    return String(text)
      .toLowerCase()
      .replace(/[\u0660-\u0669]/g, digit(0x0660))
      .replace(/[\u06F0-\u06F9]/g, digit(0x06F0))
      .replace(/[\u2080-\u2089]/g, digit(0x2080))
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')                 // accents latins
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')     // voyelles, chadda, hamza, tatweel
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // آ أ إ ٱ → ا
      .replace(/\u0649/g, '\u064A')                     // ى → ي
      .replace(/\u0629/g, '\u0647')                     // ة → ه
      .replace(/\u0624/g, '\u0648')                     // ؤ → و
      .replace(/\u0626/g, '\u064A')                     // ئ → ي
      .replace(/\u06A8/g, '\u0642')                     // ڨ → ق
      .replace(/\u06A4/g, '\u0641')                     // ڤ → ف
      .replace(/\u06AF/g, '\u0643')                     // گ → ك
      .replace(/\u067E/g, '\u0628')                     // پ → ب
      .replace(/\u0686/g, '\u062C')                     // چ → ج
      .replace(/œ/g, 'oe')
      .replace(/(\d)[,\u066B](\d)/g, '$1.$2')           // 42,195 → 42.195
      .split(/[^0-9a-z.+\-\u0621-\u064A]+/)
      .map((t) => t.replace(/^[-.]+(?!\d)|[-.]+$/g, '')) // « O- » → « o », mais « -10 » reste négatif
      .map((t) => (!keepArticle && t.length > 3 && t.startsWith('\u0627\u0644') ? t.slice(2) : t)) // « ال »
      .filter((t) => t && !STOP.has(t));
  }

  const isNum = (t) => /^-?\d+(\.\d+)?$/.test(t);
  const keyOf = (text) => tokens(text).join('');
  const fullKeyOf = (text) => tokens(text, true).join(''); // avec « ال » (fautes sur des mots courts)
  const setOf = (text) => tokens(text).sort().join(' ');
  const numbersOf = (text) => tokens(text).filter(isNum).join(' ');
  const wordsOf = (text) => tokens(text).filter((t) => !isNum(t));
  const tolerance = (key) => (key.length <= 2 ? 0 : key.length <= 4 ? 1 : key.length <= 8 ? 2 : 3);

  /* ---------- Sens identique en arabe et en français : comparaison phonétique ---------- */
  // « Kairouan » ↔ « القيروان », « Carthage » ↔ « قرطاج » : on compare le squelette des consonnes
  const AR = {
    ب: 'b', ت: 't', ث: 't', ج: 'j', خ: 'k', د: 'd', ذ: 'd', ر: 'r', ز: 'z', س: 's', ش: 'c',
    ص: 's', ض: 'd', ط: 't', ظ: 'd', غ: 'k', ف: 'f', ق: 'k', ك: 'k', ل: 'l', م: 'm', ن: 'n',
  };
  const LAT = [[/dj/g, 'j'], [/(ch|sh)/g, 'c'], [/(kh|gh)/g, 'k'], [/th/g, 't'], [/ph/g, 'f'],
    [/(qu|ck|q)/g, 'k'], [/x/g, 'ks'], [/c(?=[eiy])/g, 's'], [/g(?=[eiy])/g, 'j'], [/[cg]/g, 'k'],
    [/v/g, 'f'], [/p/g, 'b'], [/[aeiouyhw]/g, '']];
  const isArabic = (text) => /[\u0621-\u064A]/.test(text);
  function skeleton(text) {
    let s = keyOf(text);
    if (isArabic(s)) s = [...s].map((ch) => AR[ch] || (/[a-z]/.test(ch) ? ch : '')).join('');
    else LAT.forEach(([re, to]) => { s = s.replace(re, to); });
    return s.replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
  }
  function phonetic(input, answer) {
    const i = skeleton(input);
    if (i.length < 4) return Infinity; // 3 consonnes ou moins : trop de mots se ressemblent
    const all = tokens(answer);
    const parts = [answer, ...(all.length > 1 ? all.filter((t) => t.length >= 4 && !GENERIC.has(t)) : [])];
    return Math.min(Infinity, ...parts.map((p) => {
      const a = skeleton(p);
      if (a.length < 4) return Infinity;
      const d = distance(i, a);
      return d <= (a.length <= 6 ? 1 : 2) ? d + 0.5 : Infinity; // toujours « approximatif » → garde dictionnaire
    }));
  }

  // La réponse figure telle quelle (mot à mot) dans une courte phrase : « هو بورقيبة », « c'est Carthage »
  function inPhrase(input, answer) {
    const a = tokens(answer).join(' ');
    return keyOf(answer).length >= 4 && ` ${tokens(input).join(' ')} `.includes(` ${a} `)
      && keyOf(input).length - keyOf(answer).length <= 6;
  }

  // Un mot distinctif d'une réponse en plusieurs mots suffit (« هوغو » pour « فيكتور هوغو »)
  const GENERIC = new Set(['كبير', 'اكبر', 'عظيم', 'دولي', 'وطني', 'عملاق', 'عملاقه', 'قدامي', 'جامع', 'جبل', 'وادي',
    'بحر', 'بحيره', 'مدينه', 'جزيره', 'قناه', 'مضيق', 'مهرجان', 'طبقه', 'سلم', 'عظمه', 'حرف', 'عاصمه',
    'احمر', 'ابيض', 'اسود', 'ازرق', 'اخضر', 'اصفر', 'ثاني']);
  const WHOLE_PHRASE = /^amthal-/; // proverbes : il faut la fin entière, pas un seul mot
  function tokenGap(input, answer, q) {
    const all = tokens(answer);
    if (all.length < 2 || (q && WHOLE_PHRASE.test(q.id))) return Infinity;
    const i = keyOf(input);
    return Math.min(Infinity, ...all.filter((t) => t.length >= 4 && !GENERIC.has(t) && !isNum(t))
      .map((t) => { const d = distance(i, t); return d <= tolerance(t) ? d : Infinity; }));
  }

  function distance(a, b) { // Levenshtein + inversion de 2 lettres voisines = 1 faute (Damerau, OSA)
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  // « الكاهنة (ديهيا) » → la forme complète, « الكاهنة » et « ديهيا »
  function variants(text) {
    const out = [text];
    const m = String(text).match(/^(.*?)\s*\((.+)\)\s*$/);
    if (m) out.push(m[1], m[2]);
    return out.filter((v) => keyOf(v));
  }

  // Écart entre une saisie et une réponse (0 = identique ; Infinity = incompatible)
  function gap(input, answer, q = null) {
    const a = keyOf(answer);
    const i = keyOf(input);
    if (!a || !i) return Infinity;
    const num = numbersOf(answer);
    if (num) {
      if (numbersOf(input) !== num) return Infinity;
      const extra = wordsOf(input);
      const ref = wordsOf(answer);
      if (!extra.length || !ref.length) return 0; // le nombre seul suffit (unité libre si la réponse n'en a pas)…
      // …l'unité écrite doit correspondre ; sinon, doute (1)
      return extra.every((t) => ref.some((r) => distance(t, r) <= tolerance(r))) ? 0 : 1;
    }
    if (i === a || setOf(input) === setOf(answer)) return 0;
    if (isArabic(input) !== isArabic(answer)) return phonetic(input, answer); // arabe ↔ français
    if (inPhrase(input, answer)) return 0; // « هو بورقيبة »
    return Math.min(distance(i, a), distance(fullKeyOf(input), fullKeyOf(answer)), tokenGap(input, answer, q));
  }

  const accepts = (input, answer, q = null) => gap(input, answer, q) <= tolerance(keyOf(answer));

  /* ---------- Réponses d'une question ---------- */
  const extraOf = (q) => (typeof ANSWERS !== 'undefined' && Array.isArray(ANSWERS[q.id]) ? ANSWERS[q.id] : []);
  const accepted = (q) => [...variants(q.answers[q.correct]), ...extraOf(q).flatMap(variants)];
  const wrongOnes = (q) => q.answers.filter((_, i) => i !== q.correct).flatMap(variants);

  // Proposable à l'écrit ? (aucun mauvais choix ne doit pouvoir passer pour la bonne réponse)
  const cache = new Map();
  function typable(q) {
    if (!q || !Array.isArray(q.answers)) return false;
    if (cache.has(q.id)) return cache.get(q.id);
    const good = accepted(q);
    const ok = !(typeof ANSWERS !== 'undefined' && ANSWERS[q.id] === false)
      && good.some((v) => keyOf(v).length <= MAX_TYPABLE || numbersOf(v))
      && !wrongOnes(q).some((w) => good.some((v) => accepts(w, v, q) || accepts(v, w, q)));
    cache.set(q.id, ok);
    return ok;
  }

  // Indice affiché sous le champ : 'digits' | 'both' (arabe ou français) | 'arabic'
  function hint(q) {
    const main = q.answers[q.correct];
    if (numbersOf(main) && !wordsOf(main).length) return 'digits';
    return accepted(q).some((v) => /[a-z]/i.test(v)) ? 'both' : 'arabic';
  }

  // Garde « dictionnaire » : toutes les réponses connues du jeu (bonnes et mauvaises, toutes questions)
  const HEDGE = new Set(['ولا', 'او', 'ou', 'or']);
  let known = null;
  function knownKeys() {
    if (!known) {
      known = new Set();
      const add = (t) => variants(t).forEach((v) => known.add(keyOf(v)));
      if (typeof TOPICS !== 'undefined') TOPICS.forEach((t) => (t.questions || []).forEach((x) => x && Array.isArray(x.a) && x.a.forEach(add)));
      if (typeof ANSWERS !== 'undefined') Object.values(ANSWERS).forEach((list) => Array.isArray(list) && list.forEach(add));
    }
    return known;
  }

  // { ok, close } — close : la saisie était presque bonne (pour « قريب برشا ! »)
  function check(input, q) {
    if (!keyOf(input)) return { ok: false, close: false };
    const good = accepted(q).map((v) => ({ g: gap(input, v, q), t: tolerance(keyOf(v)), k: keyOf(v) }));
    const best = Math.min(...good.map((x) => x.g - x.t));
    const nearest = Math.min(...good.map((x) => x.g));
    const trap = Math.min(...wrongOnes(q).map((w) => gap(input, w, q)));
    // Une saisie approximative qui est exactement UNE AUTRE réponse connue (ex. « طيّارة » ≠ « سيّارة ») est refusée
    const k = keyOf(input);
    const otherWord = nearest > 0 && knownKeys().has(k) && !good.some((x) => x.k === k);
    // « X ولا Y » / « X ou Y » : répondre deux choses à la fois ne compte pas
    const hedge = tokens(input).some((t) => HEDGE.has(t)) && !accepted(q).some((v) => tokens(v).some((t) => HEDGE.has(t)));
    const ok = best <= 0 && nearest < trap && !otherWord && !hedge;
    return { ok, close: !ok && Number.isFinite(best) && best <= 2 };
  }

  // Le catalogue a changé (js/data.js) : les caches calculés sur les anciennes questions sont vidés
  function reset() {
    cache.clear();
    known = null;
  }
  if (typeof Data !== 'undefined') Data.onChange(reset);

  return { check, typable, hint, accepted, keyOf, distance, reset };
})();










