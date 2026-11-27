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
  supabaseUrl: 'https://wkzeeaukdiltpujrmjey.supabase.co',            // ex. 'https://abcdefghijklmnop.supabase.co'
  supabasePublishableKey: 'sb_publishable_mwQVE9zFXkECYU_1KTpQdA_grzzAjsD', // ex. 'sb_publishable_AbCdEf123…'
  // Bouton « كمّل بـ Google » : mets true seulement APRÈS avoir activé Google dans Supabase (voir README)
  googleLogin: false,
};


