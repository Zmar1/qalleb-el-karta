-- =====================================================================
--  Mise à jour n°2 — Comptes joueurs, profils, XP et classements (phase 2)
--  SQL Editor → New query → coller TOUT le fichier → Run. Sans risque, ré-exécutable.
--
--  Réglages à faire aussi dans Supabase (voir README, section « 👤 Comptes & 🏆 classements ») :
--    - Authentication → URL Configuration : Site URL + Redirect URLs (adresse du jeu) ;
--    - e-mails : sans SMTP personnalisé, l'e-mail contient un LIEN (géré par le jeu) ; avec un SMTP personnalisé,
--      modèles « Magic Link » et « Confirm signup » avec le CODE {{ .Token }} (supabase/email-code.html) ;
--    - (Google) Authentication → Sign In / Providers → Google.
--
--  Principes :
--    - les joueurs ne peuvent RIEN écrire directement : tout passe par les fonctions ci-dessous,
--      qui vérifient chaque partie (score possible, une seule participation au défi du jour, 40 parties / 24 h) ;
--    - les classements ne montrent que pseudo, avatar, ولاية et points (jamais l'e-mail) ;
--    - un admin peut bannir un joueur (il disparaît des classements) depuis la page admin → 👥 Joueurs.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Profils des joueurs (un par compte)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  pseudo      text not null check (char_length(pseudo) between 2 and 16),
  avatar      text not null default '🙂' check (char_length(avatar) between 1 and 8),
  governorate text check (governorate in (
    'tunis', 'ariana', 'ben-arous', 'manouba', 'nabeul', 'zaghouan', 'bizerte', 'beja', 'jendouba', 'kef',
    'siliana', 'sousse', 'monastir', 'mahdia', 'sfax', 'kairouan', 'kasserine', 'sidi-bouzid', 'gabes',
    'medenine', 'tataouine', 'gafsa', 'tozeur', 'kebili', 'abroad')),
  xp          integer not null default 0 check (xp >= 0),
  banned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists profiles_pseudo_idx on public.profiles (lower(pseudo));

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();


-- ---------------------------------------------------------------------
-- Parties comptées pour l'XP et les classements : « solo » et « daily » (défi du jour)
--   day : date du joueur (clé du défi du jour) ; une seule participation au défi par jour et par compte
-- ---------------------------------------------------------------------
create table if not exists public.plays (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('daily', 'solo')),
  topic_id   text,
  day        date not null,
  score      smallint not null check (score between 0 and 90),
  correct    smallint not null check (correct between 0 and 12),
  total      smallint not null check (total between 1 and 12),
  level      text not null check (level in ('easy', 'medium', 'hard')),
  grid       text check (char_length(grid) <= 120),
  created_at timestamptz not null default now()
);
create unique index if not exists plays_daily_once_idx on public.plays (user_id, day) where kind = 'daily';
create index if not exists plays_created_idx on public.plays (created_at);
create index if not exists plays_user_idx on public.plays (user_id, created_at desc);
create index if not exists plays_daily_idx on public.plays (day, score desc, correct desc, created_at) where kind = 'daily';


-- =====================================================================
--  Fonctions appelées par le jeu
-- =====================================================================

-- Mon profil (null si pas encore créé)
create or replace function public.my_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('pseudo', pseudo, 'avatar', avatar, 'governorate', governorate, 'xp', xp, 'banned', banned)
  from public.profiles
  where id = auth.uid();
$$;

-- Créer / modifier mon profil (pseudo unique, sans tenir compte des majuscules)
create or replace function public.save_profile(p_pseudo text, p_avatar text, p_governorate text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_pseudo text := btrim(regexp_replace(coalesce(p_pseudo, ''), '\s+', ' ', 'g'));
  v_avatar text := coalesce(nullif(btrim(coalesce(p_avatar, '')), ''), '🙂');
  v_gov text := nullif(btrim(coalesce(p_governorate, '')), '');
  r public.profiles;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  if char_length(v_pseudo) not between 2 and 16
     or v_pseudo !~ '^[A-Za-z0-9\u00C0-\u024F\u0600-\u06FF_. -]+$'
     or v_pseudo !~ '[A-Za-z0-9\u00C0-\u024F\u0621-\u064A\u0660-\u0669]' then
    raise exception 'pseudo_invalid';
  end if;
  if char_length(v_avatar) > 8 or v_avatar ~ '[A-Za-z0-9\u0600-\u06FF<>]' then
    raise exception 'avatar_invalid';
  end if;
  if exists (select 1 from public.profiles where lower(pseudo) = lower(v_pseudo) and id <> uid) then
    raise exception 'pseudo_taken';
  end if;

  insert into public.profiles (id, pseudo, avatar, governorate)
  values (uid, v_pseudo, v_avatar, v_gov)
  on conflict (id) do update
    set pseudo = excluded.pseudo, avatar = excluded.avatar, governorate = excluded.governorate
  returning * into r;

  return jsonb_build_object('pseudo', r.pseudo, 'avatar', r.avatar, 'governorate', r.governorate, 'xp', r.xp,
    'banned', r.banned);
exception
  when unique_violation then
    raise exception 'pseudo_taken';
  when check_violation then
    raise exception 'profile_invalid';
end $$;

-- Enregistrer une partie : contrôles anti-triche, XP, et rang au défi du jour
--   score possible : entre (bonnes réponses × points du niveau) et le double pour les cartes 🌶️ (2 ou 3 par partie)
create or replace function public.submit_play(
  p_kind text, p_topic text, p_day date, p_score integer, p_correct integer, p_total integer,
  p_level text, p_grid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.profiles;
  mine public.plays;
  lp integer := case p_level when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 end;
  hot integer := case when p_total >= 12 then 3 when p_total >= 6 then 2 else 0 end;
  today date := (now() at time zone 'utc')::date;
  new_id bigint;
  v_xp integer;
  v_rank integer;
  v_players integer;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  select * into me from public.profiles where id = uid;
  if not found then
    raise exception 'no_profile';
  end if;
  if me.banned then
    raise exception 'banned';
  end if;
  if p_kind is null or p_kind not in ('daily', 'solo') or lp is null
     or p_total is null or p_total not between 1 and 12
     or p_correct is null or p_correct not between 0 and p_total
     or p_score is null or p_score < p_correct * lp or p_score > (p_correct + least(p_correct, hot)) * lp
     or p_day is null or p_day not between today - 1 and today + 1
     or (p_kind = 'daily' and (p_level <> 'medium' or p_total > 10)) then
    raise exception 'invalid_play';
  end if;
  if (select count(*) from public.plays where user_id = uid and created_at > now() - interval '1 day') >= 40 then
    raise exception 'too_many_plays';
  end if;

  insert into public.plays (user_id, kind, topic_id, day, score, correct, total, level, grid)
  values (uid, p_kind, left(p_topic, 40), p_day, p_score, p_correct, p_total, p_level, left(p_grid, 120))
  on conflict do nothing
  returning id into new_id;

  if new_id is not null then
    update public.profiles set xp = xp + p_score where id = uid returning xp into v_xp;
  else
    v_xp := me.xp; -- défi du jour déjà envoyé : rien ne change
  end if;

  if p_kind = 'daily' then
    select * into mine from public.plays where user_id = uid and kind = 'daily' and day = p_day;
    select count(*) + 1 into v_rank
    from public.plays p
    join public.profiles pr on pr.id = p.user_id
    where p.kind = 'daily' and p.day = p_day and not pr.banned
      and (p.score > mine.score
        or (p.score = mine.score and (p.correct > mine.correct
          or (p.correct = mine.correct and (p.created_at, p.id) < (mine.created_at, mine.id)))));
    select count(*) into v_players
    from public.plays p
    join public.profiles pr on pr.id = p.user_id
    where p.kind = 'daily' and p.day = p_day and not pr.banned;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'inserted', new_id is not null, 'xp', v_xp, 'rank', v_rank, 'players', v_players));
end $$;

-- Classement du défi du jour : à score égal, plus de bonnes réponses, puis le premier arrivé
create or replace function public.leaderboard_daily(p_day date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select p.user_id, pr.pseudo, pr.avatar, pr.governorate, p.score, p.correct, p.total, p.grid,
      row_number() over (order by p.score desc, p.correct desc, p.created_at, p.id) as rank
    from public.plays p
    join public.profiles pr on pr.id = p.user_id
    where p.kind = 'daily' and p.day = p_day and not pr.banned
  )
  select jsonb_build_object(
    'players', (select count(*) from ranked),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', rank, 'pseudo', pseudo, 'avatar', avatar, 'governorate', governorate, 'score', score,
        'correct', correct, 'total', total, 'grid', grid, 'me', coalesce(user_id = auth.uid(), false)
      ) order by rank)
      from ranked where rank <= 50
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object('rank', rank, 'pseudo', pseudo, 'avatar', avatar, 'governorate', governorate,
        'score', score, 'correct', correct, 'total', total, 'grid', grid)
      from ranked where user_id = auth.uid()
    )
  );
$$;

-- Début de la semaine (lundi 00:00, heure de Tunis)
create or replace function public.week_start()
returns timestamptz
language sql
stable
as $$
  select date_trunc('week', now() at time zone 'Africa/Tunis') at time zone 'Africa/Tunis';
$$;

-- Classement de la semaine : points de toutes les parties comptées depuis lundi
create or replace function public.leaderboard_week()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select p.user_id, sum(p.score)::integer as points, count(*)::integer as games
    from public.plays p
    where p.created_at >= public.week_start()
    group by p.user_id
  ),
  ranked as (
    select t.user_id, t.points, t.games, pr.pseudo, pr.avatar, pr.governorate, pr.xp,
      rank() over (order by t.points desc) as rank
    from totals t
    join public.profiles pr on pr.id = t.user_id
    where not pr.banned
  )
  select jsonb_build_object(
    'since', to_char(public.week_start() at time zone 'Africa/Tunis', 'YYYY-MM-DD'),
    'players', (select count(*) from ranked),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', rank, 'pseudo', pseudo, 'avatar', avatar, 'governorate', governorate, 'points', points,
        'games', games, 'xp', xp, 'me', coalesce(user_id = auth.uid(), false)
      ) order by rank, pseudo)
      from ranked where rank <= 50
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object('rank', rank, 'pseudo', pseudo, 'avatar', avatar, 'governorate', governorate,
        'points', points, 'games', games, 'xp', xp)
      from ranked where user_id = auth.uid()
    )
  );
$$;

-- Classement des ولايات : points de la semaine de leurs joueurs
create or replace function public.leaderboard_governorates()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select pr.governorate, sum(p.score)::integer as points, count(distinct p.user_id)::integer as players
    from public.plays p
    join public.profiles pr on pr.id = p.user_id
    where p.created_at >= public.week_start() and pr.governorate is not null and not pr.banned
    group by pr.governorate
  ),
  ranked as (
    select t.*, rank() over (order by t.points desc) as rank from totals t
  )
  select jsonb_build_object(
    'since', to_char(public.week_start() at time zone 'Africa/Tunis', 'YYYY-MM-DD'),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('rank', rank, 'governorate', governorate, 'points', points,
        'players', players) order by rank, governorate)
      from ranked
    ), '[]'::jsonb),
    'mine', (select governorate from public.profiles where id = auth.uid())
  );
$$;

-- Supprimer mon compte (profil, parties et connexion) — exigé par les stores
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;


-- =====================================================================
--  Règles d'accès (RLS) : lecture de ses propres données ; modération réservée aux admins
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.plays    enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists plays_select on public.plays;
create policy plays_select on public.plays
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists plays_admin on public.plays;
create policy plays_admin on public.plays
  for delete to authenticated
  using ((select public.is_admin()));

grant select, update on public.profiles to authenticated;
grant select, delete on public.plays to authenticated;

revoke execute on function public.my_profile() from public, anon;
revoke execute on function public.save_profile(text, text, text) from public, anon;
revoke execute on function public.submit_play(text, text, date, integer, integer, integer, text, text) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.save_profile(text, text, text) to authenticated;
grant execute on function public.submit_play(text, text, date, integer, integer, integer, text, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.leaderboard_daily(date) to anon, authenticated;
grant execute on function public.leaderboard_week() to anon, authenticated;
grant execute on function public.leaderboard_governorates() to anon, authenticated;
grant execute on function public.week_start() to anon, authenticated;

