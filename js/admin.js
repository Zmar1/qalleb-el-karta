/**
 * Page d'administration — admin.html (Phase 1 : base de données Supabase).
 *
 *  📚 Questions     : liste, recherche, ajout, modification, archivage, photo (redimensionnée puis envoyée)
 *  📥 Import        : coller des lignes (ou un fichier CSV, Excel, Google Sheets) → vérification → import
 *  📮 Signalements  : réponses écrites refusées par le jeu et signalées par les joueurs → accepter / refuser
 *  🎨 Thèmes        : créer, renommer, couleurs, ordre, mise en avant, activer / masquer
 *
 * La sécurité est dans la base (règles RLS de supabase/1-schema.sql) : sans compte admin, rien n'est modifiable.
 * Les textes venant de la base sont toujours affichés en texte brut (jamais interprétés comme du HTML).
 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const conf = typeof CONFIG === 'object' && CONFIG ? CONFIG : {};
  const TABS = ['questions', 'import', 'reports', 'topics'];
  const STATUS = { published: '🟢 Publiée', draft: '📝 Brouillon', archived: '📦 Archivée' };
  const LETTERS = ['أ', 'ب', 'ج'];
  const MIN_QUESTIONS = 10;  // en dessous, le jeu cache le thème (voir js/data.js)
  const PAGE = 1000;         // lignes par requête (limite de l'API Supabase)
  const MAX_ROWS = 300;      // questions affichées à la fois
  const IMG_WIDTH = 720;     // largeur des photos envoyées (comme img/places/)
  const BUCKET = 'images';
  const TOPIC_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  let sb = null;
  let topics = [];
  let questions = [];
  let reports = [];
  let editing = null;      // question en cours de modification (null = nouvelle)
  let editingTopic = null; // thème en cours de modification (null = nouveau)
  let importRows = [];

  /* =====================================================================
     Outils
     ===================================================================== */

  // Crée un élément ; les textes sont insérés en texte brut (aucun risque d'injection HTML)
  function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : String(v));
    });
    children.flat(Infinity).forEach((c) => {
      if (c !== null && c !== undefined && c !== false) node.append(c instanceof Node ? c : String(c));
    });
    return node;
  }

  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  // Comparaison tolérante : accents, voyelles arabes, hamza, ة/ه, ى/ي, majuscules
  const norm = (s) => clean(s).normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .toLowerCase();
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const dateText = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const topicOf = (id) => topics.find((t) => t.id === id) || null;
  const questionOf = (id) => questions.find((q) => q.id === id) || null;
  const isQuiz = (topic) => !topic || topic.type !== 'love';

  function debounce(fn, ms) {
    let id = null;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...args), ms);
    };
  }

  let toastId = null;
  function toast(msg, kind = '') {
    const node = $('#toast');
    node.textContent = msg;
    node.className = `toast show ${kind}`;
    clearTimeout(toastId);
    toastId = setTimeout(() => { node.className = 'toast'; }, kind === 'error' ? 7000 : 3500);
  }

  function errorText(e) {
    const msg = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/row-level security|permission denied/i.test(msg)) return "Action refusée : ce compte n'a pas les droits admin.";
    if (/duplicate key/i.test(msg)) return 'Cet identifiant existe déjà.';
    if (/questions_choices/i.test(msg)) return 'Il faut exactement 3 réponses et une bonne réponse.';
    if (/char_length|check constraint/i.test(msg)) return `Valeur refusée par la base : ${msg}`;
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Pas de connexion à la base (Internet ?).';
    if (/Invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(msg)) return "E-mail pas encore confirmé (coche « Auto Confirm User » en créant l'utilisateur).";
    return msg;
  }

  function setBusy(sel, on) {
    const b = $(sel);
    b.disabled = on;
    b.classList.toggle('busy', on);
  }

  function show(view) {
    $$('main > .view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
  }

  function openTab(tab) {
    const name = TABS.includes(tab) ? tab : 'questions';
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    show(name);
    history.replaceState(null, '', `#${name}`);
  }

  // Questions par thème : { all, published }
  function counts() {
    const c = {};
    questions.forEach((q) => {
      const x = c[q.topic_id] || (c[q.topic_id] = { all: 0, published: 0 });
      x.all += 1;
      if (q.status === 'published') x.published += 1;
    });
    return c;
  }

  function putQuestion(row) {
    const i = questions.findIndex((q) => q.id === row.id);
    if (i >= 0) questions[i] = row;
    else questions.push(row);
  }

  function renderAll() {
    renderSelects();
    renderQuestions();
    renderTopics();
    renderReports();
  }

  /* =====================================================================
     Connexion
     ===================================================================== */
  // Adresse de l'API : accepte aussi l'adresse du tableau de bord (supabase.com/dashboard/project/<id>/…)
  function apiUrl(url) {
    const u = String(url || '').trim().replace(/\/+$/, '');
    const dashboard = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
    return dashboard ? `https://${dashboard[1]}.supabase.co` : u.replace(/\/(rest|auth|storage)\/v1(\/.*)?$/i, '');
  }

  // Clé secrète (sb_secret_…) ou ancienne clé service_role : elle ne doit JAMAIS être dans config.js
  function isSecretKey(k) {
    if (/^sb_secret_/i.test(k)) return true;
    try {
      const payload = (k.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload)).role === 'service_role';
    } catch (_) { return false; }
  }

  async function init() {
    const url = apiUrl(conf.supabaseUrl);
    const key = String(conf.supabasePublishableKey || conf.supabaseAnonKey || '').trim();
    if (isSecretKey(key)) {
      $('#setup-error').textContent = '⛔ js/config.js contient une clé SECRÈTE (« Secret key » sb_secret_… ou service_role) : '
        + "elle donnerait tous les droits sur ta base à n'importe qui. Remplace-la par la « Publishable key » "
        + '(sb_publishable_…). Si la clé secrète a déjà été publiée sur GitHub, supprime-la dans Supabase → API Keys.';
      show('setup');
      return;
    }
    if (!/^https:\/\/[^\s/]+$/.test(url) || key.length < 20) {
      if (url || key) $('#setup-error').textContent = "js/config.js : l'URL (https://<Project ID>.supabase.co) ou la clé semble incomplète.";
      show('setup');
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      $('#setup-error').textContent = "La bibliothèque Supabase n'a pas pu être chargée (connexion Internet ?).";
      show('setup');
      return;
    }
    sb = window.supabase.createClient(url, key);
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setTimeout(() => enter(null), 0);
    });
    try {
      const { data } = await sb.auth.getSession();
      await enter(data.session);
    } catch (e) {
      $('#login-error').textContent = errorText(e);
      show('login');
    }
  }

  async function enter(session) {
    const user = session && session.user;
    $('#tabs').hidden = true;
    $('#me').hidden = !user;
    if (!user) {
      show('login');
      return;
    }
    $('#me-email').textContent = user.email || '';
    show('loading');
    const { data, error } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error || !data) {
      $('#denied-sql').textContent = `insert into public.admins (user_id) values ('${user.id}');`;
      $('#denied-error').textContent = error
        ? `Détail : ${errorText(error)} — as-tu bien exécuté supabase/1-schema.sql ?`
        : '';
      show('denied');
      return;
    }
    $('#tabs').hidden = false;
    await loadAll();
    openTab(location.hash.slice(1));
  }

  async function login(e) {
    e.preventDefault();
    $('#login-error').textContent = '';
    setBusy('#login-btn', true);
    const { data, error } = await sb.auth.signInWithPassword({
      email: $('#login-email').value.trim(),
      password: $('#login-password').value,
    });
    setBusy('#login-btn', false);
    if (error) {
      $('#login-error').textContent = errorText(error);
      return;
    }
    $('#login-password').value = '';
    await enter(data.session);
  }

  /* =====================================================================
     Chargement
     ===================================================================== */
  async function fetchAll(table, order) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      let query = sb.from(table).select('*');
      order.forEach((col) => { query = query.order(col, { ascending: true }); });
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }

  async function loadAll() {
    try {
      [topics, questions] = await Promise.all([
        fetchAll('topics', ['sort', 'id']),
        fetchAll('questions', ['topic_id', 'pos', 'id']),
      ]);
    } catch (e) {
      toast(errorText(e), 'error');
    }
    renderAll();
    await loadReports();
  }

  /* =====================================================================
     📚 Questions
     ===================================================================== */
  function renderSelects() {
    const c = counts();
    const filter = $('#q-topic');
    const keep = filter.value;
    filter.replaceChildren(
      h('option', { value: '' }, `Tous les thèmes (${questions.length})`),
      ...topics.map((t) => h('option', { value: t.id }, `${t.emoji} ${t.name} (${(c[t.id] || {}).all || 0})`)),
    );
    filter.value = topicOf(keep) ? keep : '';

    ['#f-topic', '#imp-topic'].forEach((sel) => {
      const node = $(sel);
      const value = node.value;
      node.replaceChildren(...topics.map((t) => h('option', { value: t.id },
        `${t.emoji} ${t.name}${t.type === 'love' ? ' · 💕 questions libres' : ''}${t.active ? '' : ' (inactif)'}`)));
      if (topicOf(value)) node.value = value;
    });
  }

  const haystack = (q) => q._hay || (q._hay = norm([
    q.id, q.question, ...(q.answers || []), q.fact, q.credit, ...(q.accepted || []),
  ].join(' ')));

  function renderQuestions() {
    const topicId = $('#q-topic').value;
    const status = $('#q-status').value;
    const terms = norm($('#q-search').value).split(' ').filter(Boolean);
    const rank = new Map(topics.map((t, i) => [t.id, i]));
    const list = questions
      .filter((q) => (!topicId || q.topic_id === topicId) && (!status || q.status === status)
        && terms.every((t) => haystack(q).includes(t)))
      // par thème, les plus récentes d'abord
      .sort((a, b) => ((rank.get(a.topic_id) ?? 999) - (rank.get(b.topic_id) ?? 999)) || b.pos - a.pos);

    let note = '';
    const topic = topicOf(topicId);
    if (topic) {
      const n = (counts()[topic.id] || { published: 0 }).published;
      if (!topic.active) note = ' · 🙈 thème inactif : invisible dans le jeu';
      else if (n < MIN_QUESTIONS) note = ` · ⚠️ thème caché dans le jeu tant qu'il a moins de ${MIN_QUESTIONS} questions publiées (${n}/${MIN_QUESTIONS})`;
    }
    const more = list.length > MAX_ROWS ? ` — les ${MAX_ROWS} premières sont affichées, affine la recherche` : '';
    $('#q-summary').textContent = `${plural(list.length, 'question')}${more}${note}`;

    $('#q-list').replaceChildren(...(list.length
      ? list.slice(0, MAX_ROWS).map((q) => questionRow(q, !topicId))
      : [h('p', { class: 'empty' }, questions.length ? 'Aucune question ne correspond.' : 'Aucune question pour le moment.')]));
  }

  function questionRow(q, withTopic) {
    const topic = topicOf(q.topic_id);
    const good = q.answers ? q.answers[q.correct] : null;
    return h('button', { type: 'button', class: `qrow ${q.status}`, onclick: () => openEditor(q) },
      h('span', { class: 'qrow-head' },
        h('code', {}, q.id),
        h('span', { class: `chip ${q.status}` }, STATUS[q.status] || q.status),
        withTopic && topic ? h('span', { class: 'chip' }, `${topic.emoji} ${topic.name}`) : null,
        q.img ? h('span', { class: 'chip', title: 'Photo' }, '📷') : null,
        q.fact ? h('span', { class: 'chip', title: 'Anecdote' }, '💡') : null,
        q.accepted && q.accepted.length ? h('span', { class: 'chip', title: 'Réponses acceptées à l\'écrit' }, `✍️ ${q.accepted.length}`) : null,
        q.typable === false ? h('span', { class: 'chip', title: 'Jamais posée à l\'écrit' }, '🚫✍️') : null),
      h('span', { class: 'qrow-q', dir: 'auto' }, q.question),
      good !== null
        ? h('span', { class: 'qrow-a', dir: 'auto' }, `✅ ${good}`,
          h('small', {}, `  ·  ${q.answers.filter((_, i) => i !== q.correct).join('  ·  ')}`))
        : null);
  }

  /* ---------- Éditeur de question ---------- */
  function openEditor(q = null, presetTopic = '') {
    editing = q;
    const topicId = q ? q.topic_id : (topicOf(presetTopic) ? presetTopic : (topics[0] || {}).id);
    const type = (topicOf(topicId) || {}).type;
    // Une question existante ne change pas de type (quiz ↔ questions libres)
    $$('#f-topic option').forEach((o) => { o.disabled = !!q && (topicOf(o.value) || {}).type !== type; });

    $('#f-title').textContent = q ? '✏️ Modifier la question' : '➕ Nouvelle question';
    $('#f-id').textContent = q ? `🆔 ${q.id}` : '';
    $('#f-topic').value = topicId || '';
    $('#f-status').value = q ? q.status : 'published';
    $('#f-question').value = q ? q.question : '';
    [0, 1, 2].forEach((i) => { $(`#f-a${i}`).value = q && q.answers ? q.answers[i] || '' : ''; });
    const correct = q && Number.isInteger(q.correct) ? q.correct : 0;
    $$('input[name="f-correct"]').forEach((r) => { r.checked = Number(r.value) === correct; });
    $('#f-fact').value = (q && q.fact) || '';
    $('#f-img').value = (q && q.img) || '';
    $('#f-credit').value = (q && q.credit) || '';
    $('#f-accepted').value = ((q && q.accepted) || []).join('\n');
    $('#f-never').checked = !!q && q.typable === false;
    $('#f-photo-box').open = !!(q && q.img);
    $('#f-typed-box').open = !!(q && ((q.accepted || []).length || q.typable === false));
    $('#f-photo-status').textContent = '';
    $('#f-error').textContent = '';
    $('#f-archive').hidden = !q;
    $('#f-archive').textContent = q && q.status === 'archived' ? '♻️ Remettre dans le jeu' : '📦 Archiver';
    updateEditorType();
    $('#editor').showModal();
    $('#f-question').focus();
  }

  function updateEditorType() {
    $('#q-form .quiz-only').hidden = !isQuiz(topicOf($('#f-topic').value));
    renderPreview();
  }

  // Variantes acceptées : une par ligne (ou séparées par ;), sans doublon
  function variantsOf(text) {
    const out = [];
    String(text || '').split(/[\n;؛]/).map(clean).filter(Boolean).forEach((v) => {
      if (!out.some((x) => norm(x) === norm(v))) out.push(v);
    });
    return out;
  }

  function readEditor() {
    const topic = topicOf($('#f-topic').value);
    const quiz = isQuiz(topic);
    const checked = $('input[name="f-correct"]:checked');
    const row = {
      topic_id: topic ? topic.id : null,
      status: $('#f-status').value,
      question: clean($('#f-question').value),
      answers: quiz ? [0, 1, 2].map((i) => clean($(`#f-a${i}`).value)) : null,
      correct: quiz ? Number(checked ? checked.value : 0) : null,
      fact: quiz ? clean($('#f-fact').value) || null : null,
      img: quiz ? $('#f-img').value.trim() || null : null,
      credit: quiz ? clean($('#f-credit').value) || null : null,
      accepted: quiz ? variantsOf($('#f-accepted').value) : [],
      typable: quiz ? !$('#f-never').checked : true,
    };
    return { row, topic };
  }

  function problemsOf(row, topic) {
    const errors = [];
    if (!topic) errors.push('Choisis un thème.');
    if (row.question.length < 3) errors.push('Écris la question.');
    else if (row.question.length > 300) errors.push('Question trop longue (300 caractères au maximum).');
    if (topic && topic.type === 'quiz') {
      if (!row.answers || row.answers.some((a) => !a)) errors.push('Remplis les 3 réponses.');
      else if (new Set(row.answers.map(norm)).size < 3) errors.push('Les 3 réponses doivent être différentes.');
      else if (row.answers.some((a) => a.length > 120)) errors.push('Réponse trop longue (120 caractères au maximum).');
    }
    return errors;
  }

  // Même question avec la même bonne réponse dans le même thème ? (les questions photo partagent leur texte)
  function duplicateOf(row, exceptId = null, pool = questions) {
    const text = norm(row.question);
    const good = row.answers ? norm(row.answers[row.correct]) : '';
    return pool.find((q) => q.id !== exceptId && q.status !== 'archived' && q.topic_id === row.topic_id
      && norm(q.question) === text && (q.answers ? norm(q.answers[q.correct]) : '') === good) || null;
  }

  function renderPreview() {
    const { row, topic } = readEditor();
    const parts = [];
    if (topic) parts.push(h('span', { class: 'pv-chip' }, `${topic.emoji} ${topic.name}`));
    if (row.img) parts.push(h('img', { class: 'pv-img', src: row.img, alt: '' }));
    parts.push(h('p', { class: 'pv-q' }, row.question || '…'));
    if (row.answers) {
      parts.push(h('ol', { class: 'pv-choices' }, row.answers.map((a, i) => h('li', { class: i === row.correct ? 'ok' : '' },
        h('b', {}, LETTERS[i]), h('span', { dir: 'auto' }, a || '…')))));
      if (row.fact) parts.push(h('p', { class: 'pv-fact' }, `💡 ${row.fact}`));
      if (row.img && row.credit) parts.push(h('p', { class: 'muted small' }, `📷 ${row.credit}`));
    }
    $('#f-preview').replaceChildren(...parts);
  }

  async function saveQuestion(e) {
    e.preventDefault();
    const { row, topic } = readEditor();
    const errors = problemsOf(row, topic);
    if (errors.length) {
      $('#f-error').textContent = errors.join(' ');
      return;
    }
    const dup = duplicateOf(row, editing && editing.id);
    if (dup && !confirm(`Cette question existe déjà (${dup.id}) :\n« ${dup.question} »\n\nEnregistrer quand même ?`)) return;
    if (row.img && /^https?:/i.test(row.img) && !row.credit
      && !confirm('La photo n\'a pas de crédit (auteur · licence). Enregistrer quand même ?')) return;

    setBusy('#f-save', true);
    const query = editing
      ? sb.from('questions').update(row).eq('id', editing.id)
      : sb.from('questions').insert(row);
    const { data, error } = await query.select().single();
    setBusy('#f-save', false);
    if (error) {
      $('#f-error').textContent = errorText(error);
      return;
    }
    const created = !editing;
    putQuestion(data);
    $('#editor').close();
    toast(created ? `✅ Question ajoutée : ${data.id}` : `✅ ${data.id} enregistrée`);
    renderAll();
  }

  async function toggleArchive() {
    if (!editing) return;
    const status = editing.status === 'archived' ? 'published' : 'archived';
    if (status === 'archived' && !confirm('Retirer cette question du jeu ? Tu pourras la remettre plus tard.')) return;
    setBusy('#f-archive', true);
    const { data, error } = await sb.from('questions').update({ status }).eq('id', editing.id).select().single();
    setBusy('#f-archive', false);
    if (error) {
      $('#f-error').textContent = errorText(error);
      return;
    }
    putQuestion(data);
    $('#editor').close();
    toast(status === 'archived' ? `📦 ${data.id} archivée` : `♻️ ${data.id} remise dans le jeu`);
    renderAll();
  }

  /* ---------- Photo : redimensionnée (720 px, JPEG) puis envoyée dans Supabase Storage ---------- */
  const slug = (name) => String(name).replace(/\.[^.]*$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';

  function resizeImage(file, maxWidth) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxWidth / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // fond blanc pour les images transparentes
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image illisible.'))), 'image/jpeg', 0.82);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Ce fichier n'est pas une image lisible par le navigateur."));
      };
      img.src = url;
    });
  }

  async function uploadPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const status = $('#f-photo-status');
    status.className = 'muted small';
    status.textContent = '⏳ Redimensionnement et envoi…';
    try {
      const blob = await resizeImage(file, IMG_WIDTH);
      const path = `questions/${Date.now().toString(36)}-${slug(file.name)}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
        contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
      });
      if (error) throw error;
      $('#f-img').value = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      status.textContent = `✅ Photo envoyée (${Math.round(blob.size / 1024)} Ko). Pense au crédit si elle n'est pas à toi.`;
      renderPreview();
    } catch (err) {
      status.className = 'error';
      status.textContent = errorText(err);
    }
  }

  /* =====================================================================
     📥 Import en masse
     ===================================================================== */
  const unquote = (s) => {
    const t = String(s).trim();
    return /^"[\s\S]*"$/.test(t) ? t.slice(1, -1).replace(/""/g, '"') : t;
  };

  // Zone de texte : une question par ligne, colonnes séparées par « | » ou par des tabulations (Excel)
  const splitLines = (text) => text.split(/\r?\n/).filter((l) => l.trim())
    .map((l) => (l.includes('\t') ? l.split('\t') : l.split('|')).map(unquote));

  // Fichier CSV (guillemets, retours à la ligne dans une cellule) ; séparateur détecté : tab ; | ,
  function parseCSV(text) {
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delim = ['\t', ';', '|', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"' && !cell.trim()) {
        quoted = true;
        cell = '';
      } else if (ch === delim) {
        row.push(cell);
        cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += ch;
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim()));
  }

  // UTF-8, sinon Windows-1256 (CSV arabe enregistré par Excel)
  async function readTextFile(file) {
    const buf = await file.arrayBuffer();
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (_) {
      return new TextDecoder('windows-1256').decode(buf);
    }
  }

  async function loadImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rows = parseCSV(await readTextFile(file));
      $('#imp-text').value = rows.map((cells) => cells.map((c) => clean(c).replace(/\|/g, '/')).join(' | ')).join('\n');
      buildImport();
      toast(`📄 ${file.name} : ${plural(rows.length, 'ligne')} lue${rows.length > 1 ? 's' : ''}`);
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  const HEADERS = ['question', norm('السؤال'), norm('سؤال')];

  function buildImport() {
    const topic = topicOf($('#imp-topic').value);
    const status = $('#imp-status').value;
    const love = topic && topic.type === 'love';
    const kept = []; // lignes valides déjà vues (doublons à l'intérieur du collage)
    importRows = splitLines($('#imp-text').value).map((cells, i) => {
      if (i === 0 && HEADERS.includes(norm(cells[0]))) return null; // ligne d'en-tête
      const row = love
        ? { topic_id: topic.id, status, question: clean(cells[0]), answers: null, correct: null }
        : {
          topic_id: topic ? topic.id : null,
          status,
          question: clean(cells[0]),
          answers: [clean(cells[1]), clean(cells[2]), clean(cells[3])],
          correct: 0,
          fact: clean(cells[4]) || null,
          accepted: variantsOf(cells[5]),
        };
      const errors = problemsOf(row, topic);
      const extra = cells.slice(love ? 1 : 6).filter((c) => clean(c));
      if (extra.length) errors.push(`Colonnes en trop (${love ? '1' : '6'} au maximum) : un « | » de trop ?`);
      const dup = errors.length ? null : duplicateOf(row) || duplicateOf(row, null, kept);
      if (!errors.length && !dup) kept.push(row);
      return { line: i + 1, row, errors, dup };
    }).filter(Boolean);
    renderImport();
  }

  function renderImport() {
    const ok = importRows.filter((r) => !r.errors.length && !r.dup);
    const bad = importRows.filter((r) => r.errors.length).length;
    const dups = importRows.filter((r) => r.dup).length;
    $('#imp-summary').textContent = importRows.length
      ? `✅ ${plural(ok.length, 'question')} prête${ok.length > 1 ? 's' : ''} · ⚠️ ${plural(dups, 'doublon')} ignoré${dups > 1 ? 's' : ''} · ❌ ${plural(bad, 'ligne')} à corriger`
      : '';
    $('#imp-go').disabled = !ok.length;
    $('#imp-go').textContent = ok.length ? `📥 Importer ${plural(ok.length, 'question')}` : '📥 Importer';
    $('#imp-preview').replaceChildren(...importRows.map((r) => h('div', { class: `irow ${r.errors.length ? 'bad' : r.dup ? 'dup' : 'ok'}` },
      h('span', { class: 'irow-line' }, `L${r.line}`),
      h('div', { class: 'grow' },
        h('div', { class: 'qrow-q', dir: 'auto' }, r.row.question || '—'),
        r.row.answers
          ? h('div', { class: 'qrow-a', dir: 'auto' }, `✅ ${r.row.answers[0] || '—'}`,
            h('small', {}, `  ·  ${r.row.answers.slice(1).map((a) => a || '—').join('  ·  ')}`))
          : null,
        r.row.fact ? h('div', { class: 'muted small', dir: 'auto' }, `💡 ${r.row.fact}`) : null,
        r.row.accepted && r.row.accepted.length ? h('div', { class: 'muted small', dir: 'auto' }, `✍️ ${r.row.accepted.join(' · ')}`) : null,
        r.errors.length ? h('div', { class: 'error' }, r.errors.join(' ')) : null,
        r.dup ? h('div', { class: 'warn' }, `Déjà présente (${r.dup.id || 'ligne précédente'}) : ignorée.`) : null))));
  }

  async function runImport() {
    const rows = importRows.filter((r) => !r.errors.length && !r.dup).map((r) => r.row);
    const topic = rows.length && topicOf(rows[0].topic_id);
    if (!topic || !confirm(`Importer ${plural(rows.length, 'question')} dans « ${topic.name} » ?`)) return;
    setBusy('#imp-go', true);
    let done = 0;
    try {
      for (let i = 0; i < rows.length; i += 100) {
        const { data, error } = await sb.from('questions').insert(rows.slice(i, i + 100)).select();
        if (error) throw error;
        data.forEach(putQuestion);
        done += data.length;
      }
      toast(`✅ ${plural(done, 'question')} importée${done > 1 ? 's' : ''} dans « ${topic.name} »`);
      $('#imp-text').value = '';
      importRows = [];
    } catch (err) {
      toast(`${done} importée(s), puis erreur : ${errorText(err)}`, 'error');
      buildImport(); // les lignes déjà importées apparaissent maintenant comme doublons
    } finally {
      setBusy('#imp-go', false);
      renderImport();
      renderAll();
    }
  }

  /* =====================================================================
     📮 Signalements
     ===================================================================== */
  async function loadReports() {
    const status = $('#r-status').value;
    const [list, pending] = await Promise.all([
      sb.from('reports').select('*').eq('status', status)
        .order('hits', { ascending: false }).order('last_at', { ascending: false }).limit(300),
      sb.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    if (list.error) toast(errorText(list.error), 'error');
    reports = list.data || [];
    const n = pending.count || 0;
    $('#reports-badge').textContent = String(n);
    $('#reports-badge').hidden = !n;
    renderReports();
  }

  function renderReports() {
    const pending = $('#r-status').value === 'pending';
    $('#r-list').replaceChildren(...(reports.length
      ? reports.map(reportRow)
      : [h('p', { class: 'empty' }, pending ? '🎉 Aucun signalement à traiter.' : 'Rien pour le moment.')]));
  }

  function reportRow(r) {
    const q = questionOf(r.question_id);
    const pending = r.status === 'pending';
    return h('div', { class: 'rrow' },
      h('div', { class: 'grow' },
        h('div', { class: 'qrow-head' },
          h('code', {}, r.question_id),
          h('span', { class: 'chip' }, `👥 ${plural(r.hits, 'joueur')}`),
          h('span', { class: 'muted small' }, dateText(r.last_at))),
        h('div', { class: 'qrow-q', dir: 'auto' }, q ? q.question : '(question introuvable)'),
        q && q.answers
          ? h('div', { class: 'qrow-a', dir: 'auto' }, `✅ ${q.answers[q.correct]}`,
            q.accepted && q.accepted.length ? h('small', {}, `  ·  déjà acceptées : ${q.accepted.join(' · ')}`) : null)
          : null,
        h('div', { class: 'typed', dir: 'auto' }, '✍️ ', h('b', {}, r.typed))),
      h('div', { class: 'ractions' },
        pending ? h('button', { type: 'button', class: 'btn ok', onclick: () => acceptReport(r) }, '✅ Accepter') : null,
        pending
          ? h('button', { type: 'button', class: 'btn ghost', onclick: () => setReport(r, 'rejected', '❌ Signalement refusé') }, '❌ Refuser')
          : h('button', { type: 'button', class: 'btn ghost', onclick: () => setReport(r, 'pending', '↩️ Remis à traiter') }, '↩️ Remettre à traiter'),
        q ? h('button', { type: 'button', class: 'btn ghost', onclick: () => openEditor(q) }, '✏️ Question') : null));
  }

  async function setReport(r, status, message) {
    const { error } = await sb.from('reports').update({ status }).eq('id', r.id);
    if (error) {
      toast(errorText(error), 'error');
      return;
    }
    toast(message);
    await loadReports();
  }

  // La réponse signalée devient une variante acceptée de la question, pour tout le monde
  async function acceptReport(r) {
    const q = questionOf(r.question_id);
    if (!q) return;
    const accepted = [...(q.accepted || [])];
    if (!accepted.some((a) => norm(a) === norm(r.typed))) accepted.push(clean(r.typed));
    const { data, error } = await sb.from('questions').update({ accepted }).eq('id', q.id).select().single();
    if (error) {
      toast(errorText(error), 'error');
      return;
    }
    putQuestion(data);
    renderQuestions();
    await setReport(r, 'accepted', `✅ « ${r.typed} » est maintenant acceptée pour ${q.id}`);
  }

  /* =====================================================================
     🎨 Thèmes
     ===================================================================== */
  function medal(t) {
    return h('span', { class: 'medal' }, t.image ? h('img', { src: t.image, alt: '' }) : t.emoji || '❓');
  }

  function tileArt(t) {
    return h('div', { class: 'tile-art', dir: 'rtl', style: `--c1:${t.color1};--c2:${t.color2}` },
      t.ribbon ? h('span', { class: 'ribbon' }, t.ribbon) : null,
      medal(t),
      h('b', {}, t.name || '…'),
      h('small', {}, t.description || ''));
  }

  function renderTopics() {
    const c = counts();
    $('#t-list').replaceChildren(...(topics.length ? topics.map((t) => {
      const n = c[t.id] || { all: 0, published: 0 };
      const visible = t.active && n.published >= MIN_QUESTIONS;
      return h('div', { class: `tcard${visible ? '' : ' off'}` },
        tileArt(t),
        h('div', { class: 'tcard-meta' },
          h('code', {}, t.id),
          h('span', { class: 'chip' }, t.type === 'love' ? '💕 questions libres' : '🎯 quiz'),
          h('span', { class: 'chip' }, `${n.published} publiée${n.published > 1 ? 's' : ''} / ${n.all}`),
          t.featured ? h('span', { class: 'chip' }, '⭐ en avant') : null,
          !t.active
            ? h('span', { class: 'chip warn' }, '🙈 inactif')
            : n.published < MIN_QUESTIONS
              ? h('span', { class: 'chip warn' }, `⚠️ caché : ${n.published}/${MIN_QUESTIONS}`)
              : h('span', { class: 'chip ok' }, '👀 visible')),
        h('div', { class: 'tcard-actions' },
          h('button', { type: 'button', class: 'btn small', onclick: () => openTopicEditor(t) }, '✏️ Modifier'),
          h('button', {
            type: 'button',
            class: 'btn small',
            onclick: () => {
              $('#q-topic').value = t.id;
              renderQuestions();
              openTab('questions');
            },
          }, '📚 Questions'),
          h('button', { type: 'button', class: 'btn small primary', onclick: () => openEditor(null, t.id) }, '➕ Question')));
    }) : [h('p', { class: 'empty' }, 'Aucun thème : exécute supabase/2-seed.sql ou crée un thème.')]));
  }

  // <input type="color"> veut « #rrggbb »
  const fullColor = (c) => {
    const s = String(c || '').toLowerCase();
    return /^#[0-9a-f]{3}$/.test(s) ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : /^#[0-9a-f]{6}$/.test(s) ? s : '#0e5aa7';
  };

  function openTopicEditor(t = null) {
    editingTopic = t;
    $('#t-title').textContent = t ? `✏️ Thème « ${t.name} »` : '➕ Nouveau thème';
    $('#t-id').value = t ? t.id : '';
    $('#t-id').disabled = !!t;
    $('#t-type').value = t ? t.type : 'quiz';
    $('#t-type').disabled = !!t;
    $('#t-emoji').value = t ? t.emoji : '🎯';
    $('#t-name').value = t ? t.name : '';
    $('#t-description').value = t ? t.description : '';
    $('#t-color1').value = fullColor(t ? t.color1 : '#0E5AA7');
    $('#t-color2').value = fullColor(t ? t.color2 : '#083D77');
    $('#t-sort').value = t ? t.sort : Math.max(0, ...topics.map((x) => x.sort)) + 10;
    $('#t-ribbon').value = (t && t.ribbon) || '';
    $('#t-image').value = (t && t.image) || '';
    $('#t-featured').checked = !!(t && t.featured);
    $('#t-active').checked = t ? t.active : true;
    $('#t-error').textContent = '';
    renderTopicPreview();
    $('#topic-editor').showModal();
    (t ? $('#t-name') : $('#t-id')).focus();
  }

  function readTopic() {
    return {
      name: clean($('#t-name').value),
      emoji: clean($('#t-emoji').value) || '❓',
      description: clean($('#t-description').value),
      color1: $('#t-color1').value,
      color2: $('#t-color2').value,
      sort: parseInt($('#t-sort').value, 10) || 100,
      ribbon: clean($('#t-ribbon').value) || null,
      image: clean($('#t-image').value) || null,
      featured: $('#t-featured').checked,
      active: $('#t-active').checked,
    };
  }

  function renderTopicPreview() {
    $('#t-preview').replaceChildren(tileArt(readTopic()));
  }

  async function saveTopic(e) {
    e.preventDefault();
    const row = readTopic();
    const errors = [];
    if (!editingTopic) {
      row.id = clean($('#t-id').value).toLowerCase();
      row.type = $('#t-type').value;
      if (!TOPIC_ID.test(row.id)) errors.push('Identifiant : lettres minuscules sans accent, chiffres et tirets (ex. cuisine-tunisienne).');
      else if (topicOf(row.id)) errors.push('Cet identifiant existe déjà.');
    }
    if (!row.name) errors.push('Donne un nom au thème.');
    if (errors.length) {
      $('#t-error').textContent = errors.join(' ');
      return;
    }
    setBusy('#t-save', true);
    const query = editingTopic
      ? sb.from('topics').update(row).eq('id', editingTopic.id)
      : sb.from('topics').insert(row);
    const { data, error } = await query.select().single();
    setBusy('#t-save', false);
    if (error) {
      $('#t-error').textContent = errorText(error);
      return;
    }
    const created = !editingTopic;
    const i = topics.findIndex((t) => t.id === data.id);
    if (i >= 0) topics[i] = data;
    else topics.push(data);
    topics.sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : 1));
    $('#topic-editor').close();
    toast(created
      ? `✅ Thème « ${data.name} » créé : ajoute-lui au moins ${MIN_QUESTIONS} questions pour qu'il apparaisse dans le jeu`
      : `✅ Thème « ${data.name} » enregistré`);
    renderAll();
  }

  /* =====================================================================
     Événements
     ===================================================================== */
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));
  $('#login-form').addEventListener('submit', login);
  $('#logout').addEventListener('click', async () => {
    await sb.auth.signOut();
    enter(null);
  });

  $('#q-topic').addEventListener('change', renderQuestions);
  $('#q-status').addEventListener('change', renderQuestions);
  $('#q-search').addEventListener('input', debounce(renderQuestions, 150));
  $('#q-new').addEventListener('click', () => openEditor(null, $('#q-topic').value));

  $('#q-form').addEventListener('submit', saveQuestion);
  $('#q-form').addEventListener('input', renderPreview);
  $('#f-topic').addEventListener('change', updateEditorType);
  $('#f-archive').addEventListener('click', toggleArchive);
  $('#f-file').addEventListener('change', uploadPhoto);

  $('#imp-check').addEventListener('click', buildImport);
  $('#imp-go').addEventListener('click', runImport);
  $('#imp-file').addEventListener('change', loadImportFile);
  $('#imp-text').addEventListener('input', () => {
    importRows = [];
    renderImport();
  });
  ['#imp-topic', '#imp-status'].forEach((sel) => $(sel).addEventListener('change', () => {
    if (importRows.length) buildImport();
  }));

  $('#r-status').addEventListener('change', loadReports);
  $('#r-reload').addEventListener('click', loadReports);

  $('#t-new').addEventListener('click', () => openTopicEditor(null));
  $('#t-form').addEventListener('submit', saveTopic);
  $('#t-form').addEventListener('input', renderTopicPreview);

  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  init();
})();




