#!/usr/bin/env node
/**
 * Génère supabase/2-seed.sql à partir des questions intégrées au jeu
 * (js/topics/*.js + js/topics/_answers.js, dans l'ordre de index.html).
 *
 *   node tools/export-seed.js
 *
 * Les identifiants restent « theme-position » (ex. tunisie-12) : les liens « تحدّى صاحبك » déjà envoyés
 * et les réponses acceptées retrouvent exactement les mêmes questions dans la base.
 * Le fichier produit est ré-exécutable : il n'écrase jamais une question déjà présente dans la base.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'supabase', '2-seed.sql');
const SEED_DATE = '2025-01-01T00:00:00Z'; // date de publication des questions d'origine (ancienne : pas des nouveautés ✨)
const TAG = '$seed$';                     // délimiteur SQL : aucune échappatoire à gérer

// Mêmes fichiers, dans le même ordre que les balises <script> de index.html
function topicFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script\s+src="(js\/topics\/[^"]+\.js)"\s*><\/script>/g)].map((m) => m[1]);
}

// Exécute les fichiers de thèmes comme le navigateur (portée globale partagée).
// Aller-retour JSON : des objets ordinaires de Node (et non ceux du bac à sable vm).
function loadBundled() {
  const context = vm.createContext({});
  topicFiles().forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  });
  return JSON.parse(vm.runInContext(
    'JSON.stringify({ topics: TOPICS, answers: typeof ANSWERS === "undefined" ? {} : ANSWERS })', context,
  ));
}

const isText = (s, min = 1, max = Infinity) => typeof s === 'string' && s.trim().length >= min && s.length <= max;
const isColor = (c) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);

function build() {
  const { topics, answers } = loadBundled();
  const problems = [];
  const ids = new Set();

  const topicRows = topics.map((t, i) => {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) problems.push(`Thème « ${t.id} » : identifiant invalide`);
    if (!isText(t.name, 1, 40)) problems.push(`Thème « ${t.id} » : nom vide ou trop long`);
    if (!Array.isArray(t.colors) || !isColor(t.colors[0]) || !isColor(t.colors[1])) problems.push(`Thème « ${t.id} » : couleurs invalides`);
    return {
      id: t.id,
      name: t.name,
      emoji: t.emoji || '❓',
      description: t.description || '',
      color1: t.colors[0],
      color2: t.colors[1],
      type: t.type,
      image: t.image || null,
      featured: !!t.featured,
      ribbon: t.ribbon || null,
      sort: (i + 1) * 10,
      next_pos: t.questions.length,
    };
  });

  const questionRows = [];
  topics.forEach((t) => t.questions.forEach((raw, pos) => {
    const id = `${t.id}-${pos}`;
    ids.add(id);
    if (t.type === 'love') {
      if (!isText(raw, 3, 300)) problems.push(`${id} : question vide ou de plus de 300 caractères`);
      questionRows.push({ id, topic_id: t.id, pos, question: raw });
      return;
    }
    if (!isText(raw.q, 3, 300)) problems.push(`${id} : question vide ou de plus de 300 caractères`);
    if (!Array.isArray(raw.a) || raw.a.length !== 3 || !raw.a.every((a) => isText(a))) problems.push(`${id} : il faut exactement 3 réponses`);
    if (![0, 1, 2].includes(raw.c)) problems.push(`${id} : index de bonne réponse invalide`);
    const extra = answers[id];
    questionRows.push({
      id,
      topic_id: t.id,
      pos,
      question: raw.q,
      answers: raw.a,
      correct: raw.c,
      fact: raw.f || null,
      img: raw.img || null,
      credit: raw.credit || null,
      accepted: Array.isArray(extra) ? extra : [],
      typable: extra !== false,
    });
  }));

  Object.keys(answers).forEach((id) => {
    if (!ids.has(id)) problems.push(`_answers.js : « ${id} » ne correspond à aucune question`);
  });
  return { topicRows, questionRows, problems };
}

// Une ligne JSON par enregistrement (diffs lisibles)
const rows = (list) => `[\n${list.map((r) => JSON.stringify(r)).join(',\n')}\n]`;

function sql(topicRows, questionRows) {
  return `-- =====================================================================
--  قلّب الكارطة — Questions d'origine du jeu : ${questionRows.length} questions, ${topicRows.length} thèmes
--
--  ⚠️ Fichier GÉNÉRÉ par « node tools/export-seed.js » depuis js/topics/*.js : ne pas modifier à la main.
--  À exécuter APRÈS 1-schema.sql : SQL Editor → New query → coller tout le fichier → Run.
--  Ré-exécutable : les thèmes et les questions déjà présents dans la base ne sont pas modifiés.
-- =====================================================================
begin;

insert into public.topics (id, name, emoji, description, color1, color2, type, image, featured, ribbon,
                           sort, next_pos, created_at)
select x.id, x.name, x.emoji, x.description, x.color1, x.color2, x.type, x.image, x.featured, x.ribbon,
       x.sort, x.next_pos, timestamptz '${SEED_DATE}'
from jsonb_to_recordset(${TAG}
${rows(topicRows)}
${TAG}::jsonb) as x(id text, name text, emoji text, description text, color1 text, color2 text, type text,
                    image text, featured boolean, ribbon text, sort integer, next_pos integer)
on conflict (id) do nothing;

insert into public.questions (id, topic_id, pos, question, answers, correct, fact, img, credit, accepted, typable,
                              status, published_at, created_at, updated_at)
select x.id, x.topic_id, x.pos, x.question,
       case when x.answers is null then null
            else array(select e.v from jsonb_array_elements_text(x.answers) with ordinality as e(v, n) order by e.n)
       end,
       x.correct, x.fact, x.img, x.credit,
       array(select e.v from jsonb_array_elements_text(coalesce(x.accepted, '[]'::jsonb)) with ordinality as e(v, n)
             order by e.n),
       coalesce(x.typable, true), 'published',
       timestamptz '${SEED_DATE}', timestamptz '${SEED_DATE}', timestamptz '${SEED_DATE}'
from jsonb_to_recordset(${TAG}
${rows(questionRows)}
${TAG}::jsonb) as x(id text, topic_id text, pos integer, question text, answers jsonb, correct smallint,
                    fact text, img text, credit text, accepted jsonb, typable boolean)
on conflict (id) do nothing;

commit;

-- Vérification : nombre de questions par thème
select t.id, t.name, count(q.id) as questions
from public.topics t
left join public.questions q on q.topic_id = t.id
group by t.id, t.name, t.sort
order by t.sort;
`;
}

function main() {
  const { topicRows, questionRows, problems } = build();
  if (problems.length) {
    console.error(`❌ ${problems.length} problème(s) à corriger avant l'export :`);
    problems.forEach((p) => console.error(`   - ${p}`));
    process.exit(1);
  }
  const out = sql(topicRows, questionRows);
  if (out.split(TAG).length !== 5) {
    console.error(`❌ Une question contient « ${TAG} » : change la constante TAG.`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out, 'utf8');

  const variants = questionRows.reduce((n, q) => n + (q.accepted ? q.accepted.length : 0), 0);
  console.log(`✅ ${path.relative(ROOT, OUT)} : ${topicRows.length} thèmes, ${questionRows.length} questions, `
    + `${variants} réponses acceptées, ${(Buffer.byteLength(out) / 1024).toFixed(0)} Ko`);
  topicRows.forEach((t) => console.log(`   ${t.emoji}  ${t.id.padEnd(16)} ${String(t.next_pos).padStart(4)} questions`));
}

if (require.main === module) main();

module.exports = { build, loadBundled, topicFiles, SEED_DATE };



