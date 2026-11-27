#!/usr/bin/env node
/**
 * Diagnostic EN DIRECT de la base Supabase configurée dans js/config.js — lecture seule, rien n'est modifié.
 *
 *   node tools/check-live.js
 *
 *  1. le jeu (son vrai code : js/data.js, js/core.js…) télécharge le catalogue et l'accepte ;
 *  2. la vérification « rien de nouveau ? » renvoie une réponse minuscule ;
 *  3. sécurité : un visiteur anonyme ne voit ni les admins, ni les signalements, ni les brouillons ;
 *  4. le dossier public « images » (photos des questions) existe ;
 *  5. ce qui a changé depuis l'admin par rapport aux questions intégrées (ajoutées, modifiées, retirées) ;
 *  6. les questions récentes, jouables tout de suite mais pas encore dans le défi du jour.
 */
'use strict';

const { build } = require('./export-seed');
const { sandbox } = require('./check-catalog');

const CACHE_KEY = 'quizcards.catalog';
let failures = 0;
const ok = (msg) => console.log(`✅ ${msg}`);
const warn = (msg) => console.log(`⚠️  ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`❌ ${msg}`);
};

// Même règle que js/data.js
function apiUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  const dashboard = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  return dashboard ? `https://${dashboard[1]}.supabase.co` : u.replace(/\/(rest|auth|storage)\/v1(\/.*)?$/i, '');
}

function headers(key) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function call(url, options) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* pas du JSON */ }
    return { status: res.status, ok: res.ok, text, json, bytes: Buffer.byteLength(text) };
  } catch (e) {
    return { status: 0, ok: false, text: e.message, json: null, bytes: 0 };
  }
}

const kb = (n) => `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} Ko`;
const pad = (n) => String(n).padStart(2, '0');
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftDay = (key, delta) => {
  const [y, m, d] = key.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + delta));
};
const short = (s, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function main() {
  const game = sandbox({ configured: 'real', fetch: (...args) => fetch(...args) });
  const conf = JSON.parse(game.run('JSON.stringify(typeof CONFIG === "object" && CONFIG ? CONFIG : {})'));
  const base = apiUrl(conf.supabaseUrl);
  const key = String(conf.supabasePublishableKey || conf.supabaseAnonKey || '').trim();
  if (game.logs.some((l) => l.includes('SECRÈTE'))) {
    fail('js/config.js contient une clé SECRÈTE : remplace-la par la « Publishable key » (sb_publishable_…).');
    return;
  }
  if (!game.run('Data.enabled')) {
    fail('js/config.js est vide ou incomplet : il faut supabaseUrl et supabasePublishableKey.');
    return;
  }
  console.log(`🔌 ${base}\n`);

  /* ---------- 1. Le jeu charge le catalogue ---------- */
  const t0 = Date.now();
  const loaded = await game.run('Data.refresh({ force: true })');
  const ms = Date.now() - t0;
  if (!loaded || game.run('Data.source') !== 'remote') {
    const r = await call(`${base}/rest/v1/rpc/game_catalog`, { method: 'POST', headers: headers(key), body: '{"known":null}' });
    fail(`Le jeu n'a pas pu charger les questions : ${r.status ? `HTTP ${r.status} ${short(r.text, 200)}` : r.text}`);
    console.log('   → Vérifie l\'URL et la clé de js/config.js, puis que supabase/1-schema.sql et 2-seed.sql ont bien été exécutés.');
    return;
  }
  const raw = game.store.get(CACHE_KEY);
  const { catalog } = JSON.parse(raw);
  ok(`Le jeu charge le catalogue : version ${catalog.version}, ${kb(Buffer.byteLength(raw))}, ${ms} ms`);
  const topics = JSON.parse(game.run(`JSON.stringify(TOPICS.filter((t) => !t.mix)
    .map((t) => ({ id: t.id, emoji: t.emoji, type: t.type, n: t.questions.length })))`));
  topics.forEach((t) => console.log(`     ${t.emoji}  ${t.id.padEnd(16)} ${String(t.n).padStart(4)} ${t.type === 'love' ? 'questions libres' : 'questions'}`));
  catalog.topics.filter((t) => !topics.some((x) => x.id === t.id))
    .forEach((t) => warn(`Thème « ${t.id} » caché dans le jeu : moins de 10 questions publiées`));

  /* ---------- 2. « Rien de nouveau ? » ---------- */
  const again = await call(`${base}/rest/v1/rpc/game_catalog`, {
    method: 'POST', headers: headers(key), body: JSON.stringify({ known: catalog.version }),
  });
  if (again.json && again.json.unchanged) ok(`« Rien de nouveau ? » : ${again.bytes} octets au lieu de tout retélécharger`);
  else fail(`La vérification de version ne répond pas « unchanged » (HTTP ${again.status})`);

  /* ---------- 3. Sécurité : ce qu'un visiteur anonyme peut voir ---------- */
  const peek = async (label, path) => {
    const r = await call(`${base}/rest/v1/${path}`, { headers: headers(key) });
    if (r.status >= 400) ok(`${label} : accès refusé`);
    else if (Array.isArray(r.json) && !r.json.length) ok(`${label} : invisible`);
    else fail(`${label} : VISIBLE par n'importe qui ! Ré-exécute supabase/1-schema.sql (règles RLS).`);
  };
  await peek('Liste des admins, pour un visiteur anonyme', 'admins?select=user_id&limit=1');
  await peek('Signalements, pour un visiteur anonyme', 'reports?select=id&limit=1');
  await peek('Brouillons et questions archivées, pour un visiteur anonyme', 'questions?select=id&status=neq.published&limit=1');

  /* ---------- 4. Photos ---------- */
  const photo = await call(`${base}/storage/v1/object/public/images/__diagnostic__.jpg`, {});
  if (/bucket not found/i.test(photo.text)) fail('Dossier « images » introuvable : ré-exécute la fin de supabase/1-schema.sql.');
  else if (/not.?found/i.test(photo.text)) ok('Dossier public « images » prêt pour les photos');
  else warn(`Dossier « images » : réponse inattendue (HTTP ${photo.status}) ${short(photo.text, 120)}`);

  /* ---------- 5. Changements faits dans l'admin ---------- */
  const shape = (x) => JSON.stringify([x.q, x.a || null, x.a ? x.c : null, x.f || '', x.img || '', x.credit || '',
    x.alt && x.alt.length ? x.alt : [], x.typable !== false]);
  const { questionRows } = build();
  const bundle = new Map(questionRows.map((b) => [b.id, shape({
    q: b.question, a: b.answers, c: b.correct, f: b.fact, img: b.img, credit: b.credit, alt: b.accepted, typable: b.typable,
  })]));
  const remote = new Set(catalog.questions.map((q) => q.id));
  const added = catalog.questions.filter((q) => !bundle.has(q.id));
  const changed = catalog.questions.filter((q) => bundle.has(q.id) && bundle.get(q.id) !== shape(q));
  const removed = questionRows.filter((b) => !remote.has(b.id));
  console.log(`\n📝 Changements depuis l'admin : ${added.length} ajoutée(s), ${changed.length} modifiée(s), `
    + `${removed.length} retirée(s) du jeu (archivées ou brouillons)`);
  // Niveau صعيب : la question peut-elle être corrigée de façon fiable à l'écrit ?
  const note = (q) => (q.a && !game.run(`Answer.typable(Core.questionById(${JSON.stringify(q.id)}))`)
    ? '   (✍️ jamais posée au niveau صعيب)' : '');
  added.slice(0, 8).forEach((q) => console.log(`     + ${q.id.padEnd(16)} ${short(q.q)}${note(q)}`));
  changed.slice(0, 8).forEach((q) => console.log(`     ~ ${q.id.padEnd(16)} ${short(q.q)}${note(q)}`));
  removed.slice(0, 8).forEach((b) => console.log(`     - ${b.id.padEnd(16)} ${short(b.question)}`));
  const fresh = catalog.questions.filter((q) => game.run(`Core.isNew(Core.questionById(${JSON.stringify(q.id)}) || {})`));
  if (fresh.length) {
    console.log(`✨ ${fresh.length} nouveauté(s) : elles sortent en premier chez chaque joueur qui ne les a pas encore vues `
      + '(pendant 30 jours après leur publication), avec le badge « ✨ جديد » sur la carte.');
  }

  /* ---------- 6. Défi du jour ---------- */
  const minus1 = shiftDay(localDay(new Date()), -1);
  const recent = catalog.questions.filter((q) => q.a && q.since && !(q.since < minus1));
  if (recent.length) {
    const last = recent.map((q) => q.since).sort().pop();
    console.log(`🗓️  ${recent.length} question(s) publiée(s) récemment : déjà jouables partout, et dans le défi du jour `
      + `2 jours après leur publication (la plus récente à partir du ${shiftDay(last, 2)}).`);
  }

  console.log(failures ? `\n❌ ${failures} problème(s) à corriger.` : '\n🎉 Ta base est prête : le jeu reçoit bien tes questions.');
}

main()
  .catch((e) => fail(e.message))
  .finally(() => { process.exitCode = failures ? 1 : 0; });


