/**
 * Connexion à la base de données Supabase (questions, signalements, page admin).
 *
 * Laisse vide → le jeu fonctionne comme avant, uniquement avec les questions intégrées (js/topics/*.js).
 * Valeurs à copier depuis Supabase : Project Settings → API (ou « API Keys »).
 *
 * La clé « anon » / « publishable » est PUBLIQUE par conception : elle peut être publiée sur GitHub.
 * La sécurité est assurée par les règles RLS de supabase/1-schema.sql.
 * ⛔ Ne mets JAMAIS ici la clé « service_role » / « secret » : elle donne tous les droits sur la base.
 */
const CONFIG = {
  supabaseUrl: '',     // ex. 'https://abcdefghijklmnop.supabase.co'
  supabaseAnonKey: '', // ex. 'eyJhbGciOi…' (anon public) ou 'sb_publishable_…'
};

