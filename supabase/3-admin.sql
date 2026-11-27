-- =====================================================================
--  قلّب الكارطة — Donner les droits d'administration à TON compte (une seule fois)
--
--  1. Supabase → Authentication → Users → Add user → Create new user
--     (ton e-mail + un mot de passe solide, coche « Auto Confirm User »).
--  2. Remplace l'e-mail ci-dessous par le tien → SQL Editor → Run.
--  3. Ouvre admin.html et connecte-toi avec cet e-mail et ce mot de passe.
-- =====================================================================
insert into public.admins (user_id)
select id from auth.users where email = 'ton-email@exemple.com'
on conflict (user_id) do nothing;

-- Vérification : ton e-mail doit apparaître ici
select u.email, a.created_at
from public.admins a
join auth.users u on u.id = a.user_id;

