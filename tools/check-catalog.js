#!/usr/bin/env node
/**
 * Vérifie que le jeu se comporte EXACTEMENT pareil avec les questions de la base de données
 * (catalogue game_catalog simulé à partir des mêmes données que supabase/2-seed.sql) qu'avec les
 * questions intégrées (js/topics/*.js) :
 *   - mêmes thèmes, mêmes défis du jour, mêmes identifiants (liens « تحدّى صاحبك » déjà envoyés) ;
 *   - même correction des réponses écrites (niveau صعيب) ;
 *   - mise à jour à chaud : nouvelle question, thème trop petit caché, « خلطة » conservé,
 *     défi du jour inchangé dans la journée, signalements mis en file sans Internet.
 *
 *   node tools/check-catalog.js
 *
 * Utilise le vrai code du jeu (lang, config, data, answer, core) dans un bac à sable Node.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { build, topicFiles } = require('./export-seed');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://test-project.supabase.co';
const KEY = 'eyJ.test-anon-key.0123456789';
const CACHE_KEY = 'quizcards.catalog';
const QUEUE_KEY = 'quizcards.reports';

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
const dayOf = (offset) => new Date(Date.UTC(2026, 10, 22 + offset)).toISOString().slice(0, 10); // défi n°1 = 2026-11-22
const tick = (ms = 30) => new Promise((r) => { setTimeout(r, ms); });

// Même résultat que la fonction SQL game_catalog (mêmes filtres, même tri, mêmes champs)
function catalogOf(topicRows, questionRows, version) {
  const topics = topicRows.filter((t) => t.active !== false)
    .sort((a, b) => a.sort - b.sort || cmp(a.id, b.id))
    .map((t) => strip({
      id: t.id, name: t.name, emoji: t.emoji, description: t.description, colors: [t.color1, t.color2], type: t.type,
      image: t.image || null, featured: t.featured ? true : null, ribbon: t.ribbon || null,
    }));
  const active = new Set(topics.map((t) => t.id));
  const questions = questionRows
    .filter((q) => (q.status || 'published') === 'published' && active.has(q.topic_id))
    .sort((a, b) => cmp(a.topic_id, b.topic_id) || a.pos - b.pos || cmp(a.id, b.id))
    .map((q) => strip({
      id: q.id, topic: q.topic_id, q: q.question, a: q.answers || null, c: q.answers ? q.correct : null,
      f: q.fact || null, img: q.img || null, credit: q.credit || null,
      alt: q.accepted && q.accepted.length ? q.accepted : null,
      typable: q.typable === false ? false : null,
      since: q.since || '2026-11-01',
    }));
  return { version, topics, questions };
}

// Bac à sable « navigateur » minimal + scripts du jeu dans l'ordre de index.html
function sandbox({ configured, storage = {}, fetch = null }) {
  const store = new Map(Object.entries(storage));
  const context = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, TextEncoder, TextDecoder, btoa, atob,
    document: { querySelector: () => ({}), querySelectorAll: () => [], addEventListener() {}, visibilityState: 'visible' },
    navigator: { onLine: true },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    },
    location: { href: 'https://example.org/', hash: '' },
    fetch: fetch || (async () => { throw new Error('hors ligne'); }),
  };
  context.window = context;
  vm.createContext(context);
  ['js/lang.js', 'js/config.js', ...topicFiles(), 'js/data.js', 'js/answer.js', 'js/core.js'].forEach((file) => {
    let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (file === 'js/config.js' && configured) {
      src = src.replace("supabaseUrl: ''", `supabaseUrl: '${BASE}'`).replace("supabaseAnonKey: ''", `supabaseAnonKey: '${KEY}'`);
    }
    vm.runInContext(src, context, { filename: file });
  });
  const run = (code) => vm.runInContext(code, context);
  return { context, store, run };
}

const topicsSignature = (s) => s.run(`TOPICS.filter((t) => !t.mix).map((t) => [t.id, t.name, t.emoji, t.type,
  t.questions.length, t.colors.join(), !!t.featured, t.ribbon || '', t.image || '', t.description].join('|')).join('\\n')`);

const deckSignature = (s, key) => s.run(`(() => {
  const d = Core.dailyDeck(${JSON.stringify(key)});
  return JSON.stringify({ q: d.questions.map((q) => [q.id, q.answers.join('/'), q.correct]), l: d.layout });
})()`);

// Chaque question quiz retrouvée par son identifiant + correction de la réponse écrite
const questionsSignature = (s) => s.run(`(() => {
  const ids = TOPICS.filter((t) => t.type === 'quiz' && !t.mix)
    .flatMap((t) => t.questions.map((raw, i) => (raw && raw.id) || (t.id + '-' + i)));
  const out = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    while (chunk.length < 6) chunk.push(ids[0]);
    const deck = Core.deckFromIds(chunk, null);
    if (!deck) throw new Error('Identifiants introuvables : ' + chunk.join(', '));
    deck.questions.forEach((q) => {
      const good = q.answers[q.correct];
      const wrong = q.answers.filter((_, k) => k !== q.correct);
      out.push([q.id, q.question, good, wrong.slice().sort().join('/'), q.fact, q.img, q.credit,
        Answer.typable(q), Answer.check(good, q).ok, Answer.check(wrong[0], q).ok, Answer.accepted(q).join('/')].join('¦'));
    });
  }
  return out.join('\\n');
})()`);

async function main() {
  const { topicRows, questionRows } = build();
  const catalog = catalogOf(topicRows, questionRows, 1);
  const cached = { [CACHE_KEY]: JSON.stringify({ url: BASE, savedAt: 0, catalog }) };

  /* ---------- 1. Base de données = questions intégrées ---------- */
  const bundled = sandbox({ configured: false });
  const db = sandbox({ configured: true, storage: cached });
  assert.strictEqual(bundled.run('Data.source'), 'bundle');
  assert.strictEqual(db.run('Data.source'), 'cache', 'le catalogue mémorisé doit être utilisé au démarrage');
  assert.strictEqual(topicsSignature(db), topicsSignature(bundled), 'thèmes différents');
  assert.strictEqual(questionsSignature(db), questionsSignature(bundled), 'questions / correction différentes');
  console.log(`✅ Mêmes thèmes, mêmes ${questionRows.length} questions et identifiants, même correction à l'écrit`);

  /* ---------- 2. Défi du jour : identique, valide, sans répétition dans un cycle ---------- */
  const quizCount = questionRows.filter((q) => q.answers).length;
  const perCycle = Math.floor(quizCount / 10);
  const seen = new Set();
  for (let day = 0; day < 150; day++) {
    const key = dayOf(day);
    const sig = deckSignature(db, key);
    assert.strictEqual(sig, deckSignature(bundled, key), `défi du ${key} différent`);
    const ids = JSON.parse(sig).q.map((x) => x[0]);
    assert.strictEqual(new Set(ids).size, 10, `défi du ${key} : doublon`);
    assert.ok(new Set(ids.map((id) => id.replace(/-\d+$/, ''))).size >= 6, `défi du ${key} : moins de 6 thèmes`);
    if (day < perCycle) {
      ids.forEach((id) => { assert.ok(!seen.has(id), `défi du ${key} : ${id} déjà posée pendant le cycle`); seen.add(id); });
    }
  }
  console.log(`✅ Défi du jour identique sur 150 jours, ≥ 6 thèmes par jour, aucune répétition sur un cycle de ${perCycle} jours`);

  /* ---------- 3. Mise à jour à chaud depuis la base ---------- */
  const today = dayOf(5);
  const yesterday = dayOf(4);
  const added = {
    id: 'tunisie-95', topic_id: 'tunisie', pos: 95, question: 'سؤال تجربة: شنوّة عاصمة تونس؟',
    answers: ['تونس', 'صفاقس', 'سوسة'], correct: 0, accepted: ['Tunis'], since: yesterday,
  };
  const tiny = { id: 'test-mini', name: 'تجربة', emoji: '🧪', description: '', color1: '#123456', color2: '#654321',
    type: 'quiz', sort: 999 };
  const tinyQuestions = Array.from({ length: 9 }, (_, i) => ({
    id: `test-mini-${i}`, topic_id: 'test-mini', pos: i, question: `سؤال ${i} ؟`, answers: [`أ${i}`, `ب${i}`, `ج${i}`], correct: 0,
  }));
  const v2 = catalogOf([...topicRows, tiny], [...questionRows, added, ...tinyQuestions], 2);

  const calls = [];
  let reply = v2;
  let online = true;
  const live = sandbox({
    configured: true,
    storage: cached,
    fetch: async (url, opts) => {
      calls.push({ url, opts, body: JSON.parse(opts.body) });
      if (!online) throw new Error('hors ligne');
      const data = url.endsWith('/rpc/game_catalog') ? reply : true;
      return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    },
  });
  live.run(`TOPICS.push({ id: 'mix', name: 'خلطة', emoji: '🎲', colors: ['#000', '#111'], type: 'quiz', mix: true });
    globalThis.__changes = []; Data.onChange((info) => __changes.push(info));`);
  const deckBefore = deckSignature(live, today);

  assert.strictEqual(await live.run('Data.refresh({ force: true })'), true);
  const call = calls[0];
  assert.ok(call.url === `${BASE}/rest/v1/rpc/game_catalog` && call.opts.method === 'POST');
  assert.strictEqual(call.body.known, 1, 'la version déjà connue doit être envoyée');
  assert.strictEqual(call.opts.headers.apikey, KEY);
  assert.strictEqual(call.opts.headers.Authorization, `Bearer ${KEY}`);
  assert.strictEqual(live.run('Data.source'), 'remote');
  assert.strictEqual(live.run('Data.version'), 2);
  assert.strictEqual(live.run('JSON.stringify(__changes)'), JSON.stringify([{ added: 1 }]));
  assert.strictEqual(live.run("TOPICS.filter((t) => t.mix).length"), 1, '« خلطة » doit être conservé');
  assert.strictEqual(live.run("TOPICS.some((t) => t.id === 'test-mini')"), false, 'un thème de moins de 10 questions doit rester caché');
  assert.strictEqual(live.run("TOPICS.find((t) => t.id === 'tunisie').questions.length"), 96);
  assert.strictEqual(live.run(`(() => { const d = Core.deckFromIds(['tunisie-95','tunisie-1','tunisie-2','tunisie-3','tunisie-4','tunisie-5'], null);
    const q = d.questions[0]; return q.question + '|' + Answer.check('Tunis', q).ok; })()`), `${added.question}|true`,
  'la nouvelle question et sa variante acceptée doivent être utilisables tout de suite');
  assert.strictEqual(deckSignature(live, today), deckBefore, 'le défi du jour ne doit pas changer dans la journée');
  assert.ok(deckSignature(live, dayOf(60)).length > 0);
  assert.strictEqual(JSON.parse(live.store.get(CACHE_KEY)).catalog.version, 2, 'le nouveau catalogue doit être mémorisé');

  reply = { version: 2, unchanged: true };
  assert.strictEqual(await live.run('Data.refresh({ force: true })'), false);
  assert.strictEqual(calls[calls.length - 1].body.known, 2);
  assert.strictEqual(await live.run('Data.refresh()'), false, 'pas de nouvelle vérification avant 10 minutes');
  console.log('✅ Mise à jour à chaud : nouvelle question jouable, thème trop petit caché, خلطة conservé, défi du jour stable');

  /* ---------- 4. Signalements : file d'attente sans Internet ---------- */
  online = false;
  assert.strictEqual(live.run("Data.report('tunisie-12', 'Medjerdah')"), true);
  await tick();
  assert.strictEqual(JSON.parse(live.store.get(QUEUE_KEY)).length, 1, 'le signalement doit attendre dans la file');
  online = true;
  const before = calls.length;
  await live.run('Data.refresh({ force: true })');
  await tick();
  const sent = calls.slice(before).find((c) => c.url.endsWith('/rpc/report_answer'));
  assert.ok(sent, 'le signalement doit partir au retour d\'Internet');
  assert.deepStrictEqual(sent.body, { p_question: 'tunisie-12', p_typed: 'Medjerdah' });
  assert.strictEqual(JSON.parse(live.store.get(QUEUE_KEY)).length, 0, 'la file doit être vidée');
  assert.strictEqual(bundled.run("Data.report('tunisie-12', 'x')"), false, 'sans base : partage par message comme avant');
  console.log('✅ Signalements : envoyés à la base, mis en attente sans Internet puis envoyés');

  /* ---------- 5. Catalogue abîmé ou vide : on garde les questions actuelles ---------- */
  reply = { version: 3, topics: [], questions: [] };
  assert.strictEqual(await live.run('Data.refresh({ force: true })'), false);
  assert.strictEqual(live.run('Data.version'), 2);
  assert.strictEqual(live.run("TOPICS.find((t) => t.id === 'tunisie').questions.length"), 96);
  console.log('✅ Catalogue vide ou abîmé ignoré : le jeu garde ses questions');

  console.log('\n🎉 Tout est bon.');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  });
}

module.exports = { catalogOf };


