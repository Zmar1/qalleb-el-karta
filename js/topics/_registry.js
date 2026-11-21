/**
 * Registre des thèmes. Chaque fichier de js/topics/ ajoute son thème avec TOPICS.push({...}).
 *
 * Thème « quiz » (3 choix, modes Solo et 1 contre 1) :
 *   {
 *     id: 'mon-theme', name: 'إسم الموضوع', emoji: '🎯', description: 'وصف قصير',
 *     colors: ['#couleur1', '#couleur2'], type: 'quiz',
 *     image: 'img/....svg',   // (optionnel) remplace l'emoji dans le médaillon
 *     featured: true,         // (optionnel) affiché en premier, en grand, avec le ruban « جديد »
 *     questions: [ { q: 'السؤال؟', a: ['جواب 1', 'جواب 2', 'جواب 3'], c: 1 }, ... ]
 *   }
 *   → c = index (0, 1 ou 2) de la bonne réponse. Les réponses sont mélangées à chaque partie.
 *
 * Thème « love » (questions libres, à deux, écran normal) :
 *   { ..., type: 'love', questions: ['سؤال حرّ؟', ...] }
 *
 * Minimum 10 questions par thème. Pour ajouter un thème : crée un fichier
 * dans js/topics/ et ajoute la balise <script> correspondante dans index.html.
 */
const TOPICS = [];

