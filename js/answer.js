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
  const tolerance = (key) => (key.length <= 3 ? 0 : key.length <= 6 ? 1 : 2);

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
  function gap(input, answer) {
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
    return Math.min(distance(i, a), distance(fullKeyOf(input), fullKeyOf(answer)));
  }

  const accepts = (input, answer) => gap(input, answer) <= tolerance(keyOf(answer));

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
      && !wrongOnes(q).some((w) => good.some((v) => accepts(w, v) || accepts(v, w)));
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
    const good = accepted(q).map((v) => ({ g: gap(input, v), t: tolerance(keyOf(v)), k: keyOf(v) }));
    const best = Math.min(...good.map((x) => x.g - x.t));
    const nearest = Math.min(...good.map((x) => x.g));
    const trap = Math.min(...wrongOnes(q).map((w) => gap(input, w)));
    // Une saisie approximative qui est exactement UNE AUTRE réponse connue (ex. « طيّارة » ≠ « سيّارة ») est refusée
    const k = keyOf(input);
    const otherWord = nearest > 0 && knownKeys().has(k) && !good.some((x) => x.k === k);
    const ok = best <= 0 && nearest < trap && !otherWord;
    return { ok, close: !ok && Number.isFinite(best) && best <= 2 };
  }

  return { check, typable, hint, accepted, keyOf, distance };
})();










