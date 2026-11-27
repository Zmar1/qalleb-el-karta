/**
 * Registre des thèmes. Chaque fichier de js/topics/ ajoute son thème avec TOPICS.push({...}).
 *
 * 🗄️ Avec la base de données (js/config.js rempli), ces fichiers ne servent qu'au tout premier lancement
 *    et sans Internet : les thèmes et questions se gèrent dans admin.html, et js/data.js remplace TOPICS
 *    par le catalogue de la base (même format, avec en plus un « id » et une date « since » par question).
 *
 * Thème « quiz » (3 choix, modes Solo, Groupe et Face à face) :
 *   {
 *     id: 'mon-theme', name: 'إسم الموضوع', emoji: '🎯', description: 'وصف قصير',
 *     colors: ['#couleur1', '#couleur2'], type: 'quiz',
 *     image: 'img/....svg',   // (optionnel) remplace l'emoji dans le médaillon
 *     featured: true,         // (optionnel) affiché en premier, en grand
 *     ribbon: 'جديد ✨',       // (optionnel) ruban sur la tuile
 *     questions: [ { q: 'السؤال؟', a: ['جواب 1', 'جواب 2', 'جواب 3'], c: 1, f: 'معلومة' }, ... ]
 *   }
 *   → c = index (0, 1 ou 2) de la bonne réponse. Les réponses sont mélangées à chaque partie.
 *   → f = (optionnel) anecdote « 💡 » affichée après la réponse.
 *
 * Thème « love » (questions libres, à deux, écran normal) :
 *   { ..., type: 'love', questions: ['سؤال حرّ؟', ...] }
 *
 * Minimum 10 questions par thème. Pour ajouter un thème : crée un fichier
 * dans js/topics/ et ajoute la balise <script> correspondante dans index.html.
 *
 * ⚠️ Ajoute toujours les nouvelles questions À LA FIN de la liste : les liens « تحدّى صاحبك »
 *    et le défi du jour repèrent les questions par leur position (ex. « tunisie-12 »).
 */
const TOPICS = [];


