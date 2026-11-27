/**
 * Connexion à la base de données Supabase (questions, signalements, page admin).
 * Laisse vide → le jeu fonctionne comme avant, uniquement avec les questions intégrées (js/topics/*.js).
 *
 * Où trouver les deux valeurs dans Supabase :
 *  - supabaseUrl            → https://<Project ID>.supabase.co
 *                             Project ID : Project Settings → General, ou dans l'adresse du tableau de bord
 *                             (supabase.com/dashboard/project/<Project ID>/…).
 *  - supabasePublishableKey → Project Settings → API Keys → « Publishable key » (commence par sb_publishable_)
 *                             (onglet « Legacy API Keys » : la clé « anon public » marche aussi).
 *
 * Cette clé est PUBLIQUE par conception : elle peut être publiée sur GitHub.
 * La sécurité est assurée par les règles RLS de supabase/1-schema.sql.
 * ⛔ Ne mets JAMAIS ici une « Secret key » (sb_secret_…) ni la clé « service_role » : elles donnent TOUS les
 *    droits sur la base à n'importe qui. Le jeu et la page admin refusent de s'en servir.
 */
const CONFIG = {
  supabaseUrl: '',            // ex. 'https://abcdefghijklmnop.supabase.co'
  supabasePublishableKey: '', // ex. 'sb_publishable_AbCdEf123…'
};


