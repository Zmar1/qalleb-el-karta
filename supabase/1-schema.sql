-- =====================================================================
--  قلّب الكارطة — Base de données (Supabase / PostgreSQL) · Phase 1
--
--  À exécuter dans Supabase : SQL Editor → New query → coller TOUT ce fichier → Run.
--  Ré-exécutable sans risque : aucune donnée n'est supprimée, fonctions et règles sont mises à jour.
--  Ensuite : 2-seed.sql (questions actuelles du jeu), puis 3-admin.sql (ton compte admin).
--
--  Sécurité : le jeu et la page admin utilisent la clé PUBLIQUE (anon / publishable).
--  Ce sont les règles RLS ci-dessous qui protègent les données :
--    - tout le monde peut LIRE les thèmes actifs et les questions publiées ;
--    - les joueurs peuvent SIGNALER une réponse refusée (fonction report_answer, rien d'autre) ;
--    - seuls les comptes listés dans la table admins peuvent MODIFIER.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Thèmes (المواضيع)
-- ---------------------------------------------------------------------
create table if not exists public.topics (
  id          text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (char_length(name) between 1 and 40),
  emoji       text not null default '❓',
  description text not null default '',
  color1      text not null default '#0E5AA7' check (color1 ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'),
  color2      text not null default '#083D77' check (color2 ~* '^#([0-9a-f]{3}|[0-9a-f]{6})$'),
  type        text not null default 'quiz' check (type in ('quiz', 'love')),
  image       text,                       -- remplace l'emoji du médaillon (ex. img/flag-tn.svg)
  featured    boolean not null default false,
  ribbon      text,                       -- ruban sur la tuile (ex. « جديد ✨ »)
  sort        integer not null default 100,
  active      boolean not null default true,
  next_pos    integer not null default 0, -- compteur interne : position de la prochaine question
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- Questions
--   id       : identifiant STABLE « theme-position » (ex. tunisie-12), attribué automatiquement et
--              jamais réutilisé. Les liens « تحدّى صاحبك » et le défi du jour s'en servent.
--   answers  : les 3 choix (thème quiz) ; NULL pour une question libre (thème love)
--   correct  : index (0, 1 ou 2) de la bonne réponse
--   accepted : réponses acceptées EN PLUS à l'écrit (niveau صعيب), ex. {Bourguiba, Habib Bourguiba}
--   typable  : false = jamais posée à l'écrit (réponse trop descriptive)
--   status   : draft (brouillon) · published (dans le jeu) · archived (retirée du jeu)
--   published_at : date de (re)publication → une question n'entre dans le défi du jour que 2 jours après
-- ---------------------------------------------------------------------
create table if not exists public.questions (
  id           text primary key,
  topic_id     text not null references public.topics (id) on update cascade on delete restrict,
  pos          integer not null,
  question     text not null check (char_length(question) between 3 and 300),
  answers      text[],
  correct      smallint,
  fact         text,
  img          text,
  credit       text,
  accepted     text[] not null default '{}',
  typable      boolean not null default true,
  status       text not null default 'published' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint questions_choices check (
    (answers is null and correct is null)
    or (cardinality(answers) = 3 and correct between 0 and 2)
  )
);
create index if not exists questions_topic_pos_idx on public.questions (topic_id, pos);


-- ---------------------------------------------------------------------
-- Signalements : réponse écrite refusée par le jeu et signalée par un joueur (« 📮 بلّغ الأدمين »).
-- Le même texte signalé plusieurs fois incrémente « hits » (priorité dans la page admin).
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  question_id text not null references public.questions (id) on update cascade on delete cascade,
  typed       text not null check (char_length(typed) between 1 and 80),
  typed_key   text generated always as (lower(typed)) stored,
  hits        integer not null default 1,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at  timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  unique (question_id, typed_key)
);
create index if not exists reports_status_idx on public.reports (status, last_at desc);


-- ---------------------------------------------------------------------
-- Administrateurs (comptes Supabase Auth autorisés à modifier) — voir 3-admin.sql
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- Version du catalogue : augmente à chaque modification des thèmes ou des questions.
-- Le jeu la compare à celle qu'il a déjà → il ne retélécharge les questions que si elles ont changé.
-- ---------------------------------------------------------------------
create table if not exists public.app_meta (
  id         smallint primary key default 1 check (id = 1),
  version    bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.app_meta (id) values (1) on conflict (id) do nothing;


-- =====================================================================
--  Fonctions & triggers
-- =====================================================================

-- Le compte connecté est-il admin ?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Questions : identifiant « theme-position » automatique, date de publication, date de modification
create or replace function public.questions_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p integer;
begin
  if tg_op = 'INSERT' then
    if new.pos is null then
      update public.topics set next_pos = next_pos + 1
        where id = new.topic_id
        returning next_pos - 1 into p;
      if p is null then
        raise exception 'Thème inconnu : %', new.topic_id;
      end if;
      new.pos := p;
    else
      update public.topics set next_pos = new.pos + 1
        where id = new.topic_id and next_pos <= new.pos;
    end if;
    if new.id is null or btrim(new.id) = '' then
      new.id := new.topic_id || '-' || new.pos;
    end if;
    if new.status = 'published' and new.published_at is null then
      new.published_at := now();
    end if;
  else
    new.updated_at := now();
    if new.status = 'published' and old.status is distinct from 'published' then
      new.published_at := now();
    end if;
  end if;
  return new;
end $$;

create or replace function public.bump_catalog_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_meta set version = version + 1, updated_at = now() where id = 1;
  return null;
end $$;

drop trigger if exists questions_before_write on public.questions;
create trigger questions_before_write
  before insert or update on public.questions
  for each row execute function public.questions_before_write();

drop trigger if exists topics_touch on public.topics;
create trigger topics_touch
  before update on public.topics
  for each row execute function public.touch_updated_at();

drop trigger if exists questions_bump on public.questions;
create trigger questions_bump
  after insert or update or delete on public.questions
  for each statement execute function public.bump_catalog_version();

drop trigger if exists topics_bump on public.topics;
create trigger topics_bump
  after insert or update or delete on public.topics
  for each statement execute function public.bump_catalog_version();


-- ---------------------------------------------------------------------
-- Catalogue du jeu : UN seul appel au démarrage (POST /rest/v1/rpc/game_catalog).
--   known = version déjà présente sur le téléphone → réponse minuscule { unchanged: true } si rien n'a changé.
--   Format des questions : voir js/data.js.
-- ---------------------------------------------------------------------
create or replace function public.game_catalog(known bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  select version into v from public.app_meta where id = 1;
  if known is not null and known = v then
    return jsonb_build_object('version', v, 'unchanged', true);
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'version', v,
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'emoji', t.emoji,
        'description', t.description,
        'colors', jsonb_build_array(t.color1, t.color2),
        'type', t.type,
        'image', nullif(t.image, ''),
        'featured', case when t.featured then true end,
        'ribbon', nullif(t.ribbon, '')
      ) order by t.sort, t.id)
      from public.topics t
      where t.active
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'topic', q.topic_id,
        'q', q.question,
        'a', to_jsonb(q.answers),
        'c', q.correct,
        'f', nullif(q.fact, ''),
        'img', nullif(q.img, ''),
        'credit', nullif(q.credit, ''),
        'alt', case when cardinality(q.accepted) > 0 then to_jsonb(q.accepted) end,
        'typable', case when not q.typable then false end,
        'since', to_char(coalesce(q.published_at, q.created_at) at time zone 'UTC', 'YYYY-MM-DD')
      ) order by q.topic_id, q.pos, q.id)
      from public.questions q
      join public.topics t on t.id = q.topic_id
      where q.status = 'published' and t.active
    ), '[]'::jsonb)
  ));
end $$;

-- Signalement d'une réponse écrite refusée (seule écriture permise aux joueurs)
create or replace function public.report_answer(p_question text, p_typed text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_typed text := left(btrim(regexp_replace(coalesce(p_typed, ''), '\s+', ' ', 'g')), 80);
begin
  if v_typed = '' or not exists (
    select 1 from public.questions
    where id = p_question and status = 'published' and answers is not null
  ) then
    return false;
  end if;

  insert into public.reports as r (question_id, typed)
  values (p_question, v_typed)
  on conflict (question_id, typed_key) do update
    set hits = r.hits + 1, last_at = now();
  return true;
end $$;


-- =====================================================================
--  Règles d'accès (RLS)
-- =====================================================================
alter table public.topics    enable row level security;
alter table public.questions enable row level security;
alter table public.reports   enable row level security;
alter table public.admins    enable row level security;
alter table public.app_meta  enable row level security;

-- Lecture : thèmes actifs et questions publiées pour tous ; tout pour les admins
drop policy if exists topics_select on public.topics;
create policy topics_select on public.topics
  for select using (active or (select public.is_admin()));

drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select using (status = 'published' or (select public.is_admin()));

-- Écriture : admins uniquement
drop policy if exists topics_write on public.topics;
create policy topics_write on public.topics
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Chaque compte peut vérifier s'il est admin (la page admin s'en sert)
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists app_meta_select on public.app_meta;
create policy app_meta_select on public.app_meta
  for select using (true);

grant usage on schema public to anon, authenticated;
grant select on public.topics, public.questions, public.app_meta to anon, authenticated;
grant insert, update, delete on public.topics, public.questions to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select on public.admins to authenticated;
grant execute on function public.game_catalog(bigint) to anon, authenticated;
grant execute on function public.report_answer(text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;


-- =====================================================================
--  Photos des questions (Supabase Storage, dossier public « images »)
--  Envoi depuis la page admin (photo redimensionnée à 720 px) ; lecture publique.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists images_admin_select on storage.objects;
create policy images_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'images' and (select public.is_admin()));

drop policy if exists images_admin_insert on storage.objects;
create policy images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (select public.is_admin()));

drop policy if exists images_admin_update on storage.objects;
create policy images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and (select public.is_admin()));

drop policy if exists images_admin_delete on storage.objects;
create policy images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (select public.is_admin()));

