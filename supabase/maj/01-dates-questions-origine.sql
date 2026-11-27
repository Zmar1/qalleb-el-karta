-- =====================================================================
--  Mise à jour n°1 — à exécuter UNE fois si ta base a été créée avec l'ancien 2-seed.sql (avant le 27/11/2026).
--  SQL Editor → New query → coller → Run. Sans risque, ré-exécutable.
--
--  Les 738 questions d'origine avaient la date de publication du 01/11/2026 : le jeu les prenait toutes pour
--  des nouveautés ✨ (moins de 30 jours) → badge « جديد » partout et les vraies nouveautés noyées dans la masse.
--  On leur donne une date ancienne. Le défi du jour n'est pas modifié.
-- =====================================================================
update public.questions
set published_at = timestamptz '2025-01-01T00:00:00Z'
where published_at = timestamptz '2026-11-01T00:00:00Z';

-- Vérification : les nouveautés restantes (publiées depuis moins de 30 jours) — normalement tes ajouts uniquement
select id, question, published_at
from public.questions
where status = 'published' and published_at > now() - interval '30 days'
order by published_at desc;

