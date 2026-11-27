# 🇹🇳 قلّب الكارطة — Qalleb el Karta

Jeu de cartes-quiz **100 % tunisien**, entièrement en **derja (arabe tunisien)**, jouable sur smartphone :
des cartes face cachée, on en touche une, elle se retourne et révèle une question.

## 🌟 Ce qui le rend unique

| Nouveauté | Pourquoi les joueurs le préfèrent |
|---|---|
| 🗓️ **تحدّي اليوم** — défi du jour | Les **mêmes 10 questions pour tout le monde** chaque jour, une seule tentative, **série de jours 🔥**, résultat partageable en grille d'emojis (style Wordle) : `🟩🟩🟥🌶️🟩🧿…` |
| 🤝 **تحدّى صاحبك** — défi par lien | Après une partie solo, un lien WhatsApp/Messenger fait rejouer **exactement les mêmes cartes** à un ami, avec ton score à battre affiché. Aucun compte, aucun serveur. |
| 🌶️ **Cartes حارّة** | 2 cartes (3 sur 12) sont visibles en orange : **2 points** si bonne réponse → le choix de la carte devient stratégique. |
| 🧿 **Carte خمسة** cachée | Une carte porte-bonheur révélée au retournement : **seconde chance** après une erreur. |
| 🎲 **Thème visible en « خلطة »** | Chaque carte montre son thème : on choisit sa catégorie forte. |
| 👥 **جماعة** — 2 à 6 joueurs | Sur un seul téléphone, chacun son tour (veillées, Ramadan, famille), classement 🥇🥈🥉. |
| 🗣️ **كمّل المثل** | Nouveau thème : compléter des **proverbes tunisiens**, avec leur sens expliqué. |
| 💡 **تعرفشي؟** | Une anecdote s'affiche après la réponse (thème Tunisie, proverbes). |
| 🔥 **Séries** | « 🔥 3 متتاليين! » après 3 bonnes réponses d'affilée ; « شكبّة! 🃏 » pour un 10/10. |
| ❓ **Aide intégrée** | Explication illustrée à la 1ʳᵉ visite (et via le bouton ؟). |
| 📴 **Hors ligne** | Installable comme une appli, **fonctionne sans Internet** (service worker). |

## 🎨 Design tunisien

- **Dos des cartes** = portes bleues cloutées en arc de **Sidi Bou Saïd** (numéro dans un médaillon doré)
- **Face des cartes** = mur blanchi à la chaux avec bordure en **zellige de Nabeul**
- **Frises de céramique**, motif d'étoiles à 8 branches en fond, rouge du **drapeau** pour les boutons
- Thème **للمحبّين** en rose bougainvillier 🌸, cartes **حارّة** couleur harissa 🌶️
- Polices arabes : **Reem Kufi** (titres, style coufique) et **Cairo** (textes) — interface **RTL**

## 🗂️ Thèmes (المواضيع) — 738 questions

| Thème | Questions | Type | Modes |
|---|---|---|---|
| 🇹🇳 **تونس** (mis en avant) | 95 dont 21 photos + anecdotes | Histoire, lieux, cuisine, traditions, culture, derja | وحدي · جماعة · وجه لوجه |
| 🕌 **ديني** (nouveau) | 123 + explications | Piliers, prière, ablutions, jeûne, zakat, hajj, Coran, prophètes, invocations du quotidien (sommeil, voyage, pluie, colère…), bonnes habitudes et comportement | وحدي · جماعة · وجه لوجه |
| 🗣️ **كمّل المثل** | 38 + sens | Compléter un proverbe tunisien | وحدي · جماعة · وجه لوجه |
| 🧠 ثقافة عامّة | 63 | Littérature, art, histoire, maths, monde moderne | وحدي · جماعة · وجه لوجه |
| 🌍 جغرافيا | 70 | Capitales, records, fleuves, drapeaux, monuments | وحدي · جماعة · وجه لوجه |
| 🔬 علوم و طبيعة | 64 | Espace, chimie, corps humain, animaux, plantes | وحدي · جماعة · وجه لوجه |
| 🎬 سينما و مزيكة | 70 | Tunisie & monde arabe, films, dessins animés, musique | وحدي · جماعة · وجه لوجه |
| ⚽ رياضة (nouveau) | 37 | Football, JO, champions tunisiens | وحدي · جماعة · وجه لوجه |
| 🧩 ألغاز (nouveau) | 30 | Devinettes en derja | وحدي · جماعة · وجه لوجه |
| 🎲 خلطة | toutes | Mélange qui **alterne les thèmes** | وحدي · جماعة · وجه لوجه |
| 💕 للمحبّين | 148 | Souvenirs, fous rires, « تحبّ… ولا… ؟ », rêves, phrases à compléter, petits défis 🎯, « تعرفني مليح ؟ », touche tunisienne | À deux, écran normal |

## 🎚️ 3 niveaux de difficulté (choisis à la configuration, mémorisés)

| Niveau | Comment on répond | Points (×2 sur une carte 🌶️) |
|---|---|---|
| 🟢 **ساهل** | 2 choix seulement (la bonne réponse + 1 piège) | 1 |
| 🟡 **متوسّط** | 3 choix | 2 |
| 🔴 **صعيب** | **Aucun choix** : on écrit la réponse, en **arabe ou en français** (temps +50 %) | 3 |

Le **défi du jour** est toujours en 🟡 (résultats comparables pour tous). Un lien « تحدّى صاحبك » garde le niveau :
l'ami joue au même niveau que toi.

### ✍️ Correction de la réponse écrite (fiable)
`js/answer.js` compare la saisie à la bonne réponse et à ses variantes (`js/topics/_answers.js`) :
- **normalisation** : hamza (أ إ آ), ة/ه, ى/ي, voyelles et chadda, article « ال », lettres ڨ/ڤ, accents et articles
  français (le, la, l', de…), chiffres arabes ٠-٩, ordre des mots (« أصفر و أحمر » = « أحمر و أصفر ») ;
- **fautes tolérées** : 1 faute jusqu'à 4 lettres, 2 de 5 à 8, 3 au-delà (une inversion de deux lettres = 1 faute) ;
- **le sens compte** : une courte phrase qui contient la réponse (« هو بورقيبة », « c'est Carthage ») ; un mot
  distinctif d'un nom (« هوغو » pour « فيكتور هوغو ») ; et **arabe ↔ français par la prononciation**
  (« Monastir » = « المنستير », « Gibran » = « جبران ») même sans variante écrite à l'avance ;
- « X ولا Y » / « X ou Y » (deux réponses à la fois) est refusé ;
- **nombres exacts** : 1956 ≠ 1957 (l'unité est facultative : « 42,195 km » = « 42.195 كم ») ;
- **3 garde-fous** : une saisie aussi proche d'un mauvais choix que de la bonne réponse est refusée ; une saisie
  approximative qui est exactement **une autre réponse connue du jeu** est refusée (« طيّارة » ≠ « سيّارة ») ;
  une question n'est posée à l'écrit que si ses mauvais choix ne peuvent pas passer pour la bonne réponse.

Mesuré sur toutes les questions : 461/467 posables à l'écrit, 100 % des fautes de frappe simulées acceptées,
aucune réponse d'une autre question acceptée à tort (hors équivalences voulues comme « تونس » pour « تونس العاصمة »).

### ⚖️ L'arbitre (« الحكم ») pour la compétition
- **جماعة (groupe)** : si la machine refuse une réponse écrite, la bonne réponse s'affiche et la table peut
  appuyer sur **« ✅ نقبلوه »** pour la valider (les points sont alors accordés).
- **وجه لوجه (face à face)** en 🔴 : pas de clavier ; le répondeur **répond à voix haute** et celui qui lit la
  question (il voit la bonne réponse) est **l'arbitre** : ✅ صحيح / ❌ غالط.
- **وحدي (solo)** : correction automatique uniquement (records et défis restent équitables).

### Validation par l'admin
Après une réponse écrite refusée, le bouton « جوابي صحيح؟ بلّغ الأدمين » envoie le signalement **directement dans
la base de données** (sans Internet, il attend et part au prochain lancement). Dans la page admin, onglet
**📮 Signalements**, les réponses sont regroupées (« 👥 3 joueurs ») : **✅ Accepter** ajoute la variante à la question,
elle est acceptée pour tout le monde dès le lancement suivant du jeu.

Sans base de données configurée, le bouton prépare comme avant un message (WhatsApp, Messenger…) avec l'identifiant
de la question (ex. `tunisie-12`), la réponse tapée et la bonne réponse.

## 📍 Questions photo (thème تونس)

21 photos de lieux tunisiens (`img/places/`) : « وين تلقى البلاصة هاذي؟ ». Le joueur répond en géographie (ville,
île, site). En face à face, le répondeur voit aussi la photo. Chaque photo affiche son crédit (auteur · licence).
Photos libres de Wikimedia Commons, redimensionnées (~45 Ko), disponibles hors ligne :

| Fichier | Auteur | Licence | Source |
|---|---|---|---|
| `sidi-bou-said.jpg` | Mohamed Moslem Mosbah | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Sidi_Chebaan.jpg) |
| `el-jem.jpg` | Carole Raddato | CC BY-SA 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:The_Amphitheatre_of_El_Jem,_built_around_AD_238_in_Thysdrus_in_Africa_Proconsularis,_the_estimated_capacity_is_35,000,_Tunisia_-_52717762494.jpg) |
| `kairouan.jpg` | Marek Szarejko | CC BY-SA 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Great_Mosque_of_Kairouan_Panorama_-_Grande_Mosqu%C3%A9e_de_Kairouan_Panorama.jpg) |
| `dougga.jpg` | Emna Trabelsi | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Dougga,_Beja.jpg) |
| `carthage.jpg` | ISAW | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Antonine_Baths_at_Carthage.jpg) |
| `matmata.jpg` | Colin Kenworthy | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Matmata,_Tunisia.JPG) |
| `chott-el-djerid.jpg` | Kais photographies | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Chott_Djerid_003.jpg) |
| `djerba.jpg` | Wikimedia Commons | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:El_Ghriba.jpg) |
| `zitouna.jpg` | T A | CC BY-SA 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Minaret_et_patio_de_la_mosqu%C3%A9e_Zitouna_au_centre_de_la_M%C3%A9dina_de_Tunis.jpg) |
| `monastir.jpg` | Mohamed Ezzi | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Grand_Ribat_Monastir.JPG) |
| `tataouine.jpg` | Ian Sewell | CC BY 2.5 | [Commons](https://commons.wikimedia.org/wiki/File:Ksar_Ouled_Soltane_01.jpg) |
| `sbeitla.jpg` | Bernard Gagnon | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Sbeitla_10.jpg) |
| `ichkeul.jpg` | Dhfaouzi | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Vue_matinale_de_la_montagne_dominant_le_parc_Ichkeul.jpg) |
| `tabarka.jpg` | Noomen9 | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Ile_de_tabarka_1.jpg) |
| `tozeur.jpg` | Rawen Ab | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Tozeur_sud_tunisien.jpg) |
| `testour.jpg` | Noomen9 | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Grande_Mosqu%C3%A9e_de_Testour_31.jpg) |
| `bulla-regia.jpg` | Houss 2020 | CC BY-SA 4.0 | [Commons](https://commons.wikimedia.org/wiki/File:Bulla_regia_archaeological_site.jpg) |
| `kerkouane.jpg` | CarlesVA | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Kerkouane_-_panorama.jpg) |
| `bizerte.jpg` | Khaled Abdelmoumen | CC BY 2.0 | [Commons](https://commons.wikimedia.org/wiki/File:Bizerte_bridge_from_south_side(zarzouna).jpg) |
| `tunis-avenue.jpg` | Dacoslett | CC0 | [Commons](https://commons.wikimedia.org/wiki/File:TunisAveHabibBourguiba.jpg) |
| `zaghouan.jpg` | Mathiasrex | CC BY-SA 3.0 | [Commons](https://commons.wikimedia.org/wiki/File:Zaghouan_aqueduc.jpg) |

**Ajouter une photo** : place un JPEG (~720 px de large) dans `img/places/`, ajoute la question **à la fin** de
`js/topics/tunisie.js` avec `img` et `credit`, ses variantes dans `_answers.js` et son nom dans `sw.js` (`PLACES`).

## 🔁 Anti-répétition

- **Mémoire d'une ouverture à l'autre** : chaque carte retournée est notée sur le téléphone (par le texte de la
  question, donc insensible à l'ordre des listes). Le tirage prend **d'abord les questions jamais vues**, puis
  les plus anciennes. Exemple : 6 parties de « ثقافة عامّة » ou 14 parties « للمحبّين » de suite sans aucune répétition.
- **Nouveautés ✨ en premier** : une question ajoutée dans l'admin (publiée depuis moins de 30 jours) passe devant
  toutes les autres chez chaque joueur qui ne l'a pas encore vue → elle sort **dès la partie suivante** de son thème
  (et en « خلطة »), avec le badge « ✨ جديد » sur la carte. Une fois vue, elle redevient une question comme les autres.
- **Commun à tous les modes** : une question vue en solo, en groupe, en face à face, en « خلطة » ou au défi du jour
  ne revient pas tout de suite ailleurs.
- **« خلطة »** : les cartes alternent les thèmes (8 thèmes différents sur 10 cartes).
- **Défi du jour** : chaque thème est réparti régulièrement sur un cycle de 44 jours → **aucune question répétée
  d'un jour à l'autre** pendant le cycle, et au moins 6 thèmes chaque jour.

## 🎮 Modes de jeu

### 🗓️ تحدّي اليوم — Défi du jour
Grande tuile en haut de l'accueil. 10 questions tirées de tous les thèmes, **identiques pour tous** le même jour
(tirage reproductible à partir de la date), minuteur fixe de 30 s, **une seule tentative qui compte dès la
1ʳᵉ carte retournée** : quitter en cours fige le score (cartes non jouées ⬜) jusqu'au lendemain.
À la fin : grille d'emojis, série de jours 🔥, compte à rebours jusqu'au prochain défi et bouton **📤 شارك نتيجتك**.
Le lien partagé (`…/#daily`) ouvre directement le défi.

### 👤 وحدي — Solo (écran normal)
Un joueur, 10 cartes. Score en **points ⭐** (🌶️ = 2 points) et **record mémorisé** par thème (🏅 sur la tuile).
Bouton **🤝 تحدّى صاحبك** : envoie un lien qui fait rejouer les mêmes cartes à un ami ; à la fin, il voit
« غلبت Ali! » ou « Ali غلبك » et peut **renvoyer le défi**.

### 👥 جماعة — Groupe (écran normal, 2 à 6 joueurs)
On se passe le téléphone : chacun son tour retourne une carte (« 🎯 دور Sami »). Chaque joueur joue le même
nombre de cartes (9, 10 ou 12 selon le nombre de joueurs). Classement final avec médailles.

### ⚔️ وجه لوجه — Face à face (écran partagé)
Le téléphone est posé à plat entre les joueurs, l'écran est **coupé en deux** (moitié du haut retournée à 180°) :

| Rôle | Ce qu'il voit | Ce qu'il peut faire |
|---|---|---|
| 🎯 دورك تجاوب (répondeur) | les 10 cartes, puis **uniquement les 3 choix** | choisit une carte, puis touche sa réponse |
| 📢 إنتي اللي تسأل (questionneur) | la carte qui se retourne avec **la question + les 3 choix** | rien à toucher : il lit à voix haute |

La bonne réponse n'est révélée qu'après la réponse ; les rôles s'inversent à chaque carte (5 chacun).

### 💕 للمحبّين — Amoureux (écran normal)
Chacun son tour, on retourne une carte : une question libre « لـLina » ou « لـمحمد » à laquelle on
répond **à voix haute**. Bouton **💖 جواب يهبّل** (offre un cœur) ou **السؤال الجاي**.
Pas de minuteur, pas de gagnant : un bilan des cœurs à la fin.

## ✨ Effets

- **Effets sonores** synthétisés (aucun fichier) : carte, retournement, carte spéciale, bonne/mauvaise réponse,
  temps écoulé, victoire, cœur — bouton 🔊/🔇
- Minuteur (20 / 30 / 45 s ou بلا وقت) avec bips sur les 5 dernières secondes
- Vibrations, écran maintenu allumé pendant la partie, confettis (ou pluie de cœurs 💖)
- Un **proverbe tunisien** (et son sens) en fin de partie
- Les questions déjà vues ne reviennent pas tant qu'il en reste de nouvelles, **même après avoir fermé le jeu**
- Installable sur l'écran d'accueil (bouton 📲 sur Android), raccourci « تحدّي اليوم », **jouable hors ligne**

> 💡 En face à face, bloquez la rotation automatique du téléphone. Le son fonctionne aussi avec le bouton silencieux de l'iPhone.

## 🧱 Technologies & structure

HTML + CSS + JavaScript **sans framework ni étape de build** : léger, rapide sur mobile, hébergeable gratuitement.
Les questions viennent d'une base de données **Supabase** (PostgreSQL) gérée depuis `admin.html` ; le jeu garde
une copie sur le téléphone et embarque les questions d'origine → il démarre instantanément et marche hors ligne.

```
index.html               → tous les écrans (lang="ar-TN", dir="rtl")
admin.html               → page d'administration (questions, import en masse, signalements, thèmes)
css/style.css            → design tunisien (portes, zellige, frises, animations 3D)
css/admin.css            → style de la page admin
img/flag-tn.svg          → médaillon du drapeau tunisien
js/lang.js               → TOUS les textes de l'interface en derja (à modifier ici)
js/config.js             → connexion à Supabase (URL + clé publique) ; vide = questions intégrées uniquement
js/data.js               → source des questions : base de données + copie sur le téléphone + signalements
js/account.js            → comptes joueurs : connexion (code e-mail / Google), profil, XP, envoi des parties, classements
js/social.js             → écrans des comptes : « 👤 حسابي », « 🏆 الترتيب », XP et rang en fin de partie
js/admin.js              → logique de la page admin
js/topics/_registry.js   → registre des thèmes (format documenté)
js/topics/*.js           → questions intégrées (1er lancement, hors ligne, ou sans base de données)
js/topics/amthal.js      → thème « كمّل المثل » + liste des proverbes (aussi utilisés en fin de partie)
js/sound.js              → effets sonores (Web Audio API)
js/core.js               → outils partagés (tirage, cartes spéciales, défi du jour, liens, partage…)
js/modes/duel.js         → mode face à face (écran partagé)
js/modes/single.js       → modes Solo, Groupe et Amoureux (écran normal) + défis
js/app.js                → navigation : accueil → thème → mode → partie, liens #daily / #c=
supabase/1-schema.sql    → tables, sécurité (RLS), fonctions du jeu — à exécuter une fois dans Supabase
supabase/2-seed.sql      → les 738 questions d'origine (généré par tools/export-seed.js)
supabase/3-admin.sql     → donne les droits d'administration à ton compte
supabase/maj/*.sql       → mises à jour de la base (à exécuter une fois chacune, dans l'ordre)
supabase/email-code.html → modèle d'e-mail avec le code de connexion (à coller dans Supabase)
tools/export-seed.js     → régénère supabase/2-seed.sql depuis js/topics/*.js
tools/check-catalog.js   → vérifie que la base donne exactement le même jeu que les fichiers
tools/check-live.js      → diagnostic en direct de la base configurée (lecture seule)
sw.js                    → service worker (jeu jouable hors ligne, toujours à jour en ligne)
manifest.webmanifest     → installation « Ajouter à l'écran d'accueil »
icon.svg                 → icône (porte de Sidi Bou Saïd + croissant et étoile)
publier.bat              → publication sur GitHub Pages (branche main) ; sur une autre branche : simple sauvegarde
```

## 🗄️ Base de données (Supabase) — ajouter des questions sans toucher au code

### Mise en place (une seule fois, ~15 minutes, gratuit)
1. Crée un compte et un projet sur https://supabase.com/dashboard (région **Europe**, ex. Frankfurt ou Paris).
   Note bien le mot de passe de la base.
2. **SQL Editor → New query** : colle tout `supabase/1-schema.sql` → **Run**.
3. **SQL Editor → New query** : colle tout `supabase/2-seed.sql` → **Run** (importe les 738 questions actuelles avec
   les **mêmes identifiants** : les liens « تحدّى صاحبك » déjà envoyés restent valables).
4. **Authentication → Users → Add user → Create new user** : ton e-mail + un mot de passe solide, coche
   **Auto Confirm User**. Puis dans **SQL Editor**, exécute `supabase/3-admin.sql` en y mettant ton e-mail.
5. Remplis `js/config.js` :
   - `supabaseUrl` : `https://<Project ID>.supabase.co` (Project ID dans **Project Settings → General**, ou dans
     l'adresse du tableau de bord `supabase.com/dashboard/project/<Project ID>`) ;
   - `supabasePublishableKey` : **Project Settings → API Keys → Publishable key** (`sb_publishable_…`).

   ⛔ **Jamais une « Secret key »** (`sb_secret_…`) ni `service_role` : elle donnerait tous les droits sur la base à
   n'importe qui (le jeu et l'admin refusent de démarrer avec). Si une clé secrète a été publiée par erreur,
   supprime-la dans **API Keys** et crées-en une autre.
6. Ouvre `admin.html` (en local avec `npx serve .`, ou en ligne `https://…/admin.html`) et connecte-toi.

### Au quotidien : la page admin
| Onglet | Pour quoi faire |
|---|---|
| 📚 **Questions** | Chercher (tolère hamza, voyelles, accents), modifier, ajouter, archiver. Aperçu de la carte en direct, photo envoyée depuis le téléphone (redimensionnée à 720 px), réponses acceptées à l'écrit. Doublons détectés. |
| 📥 **Import en masse** | Coller des lignes `question \| bonne réponse \| mauvaise 1 \| mauvaise 2 \| anecdote \| variantes` ou un fichier CSV / copie d'Excel ou Google Sheets → vérification ligne par ligne → import. |
| 📮 **Signalements** | Réponses écrites refusées et signalées par les joueurs → ✅ accepter (devient valable pour tous) ou ❌ refuser. |
| 🎨 **Thèmes** | Créer un thème, nom, emoji, couleurs, ordre, ruban, mise en avant, activer / masquer. Un thème apparaît dans le jeu dès qu'il a **10 questions publiées**. |
| 👥 **Joueurs** | Joueurs inscrits triés par XP : rechercher, renommer un pseudo, bannir / réactiver (les e-mails ne sont jamais affichés). |

### Comment le jeu s'en sert
- **Démarrage instantané** : le jeu utilise la dernière copie des questions gardée sur le téléphone (ou, au tout premier
  lancement, les questions intégrées), puis demande à la base si quelque chose a changé. Si oui, il télécharge les
  questions, les garde et met l'accueil à jour (« ✨ أسئلة جديدة وصلت: +12 »). Si rien n'a changé, la réponse fait
  quelques octets.
- **Hors ligne** : tout continue de marcher avec la dernière copie ; les photos ajoutées depuis l'admin sont
  téléchargées à l'avance.
- **Identifiants stables** : chaque question garde son identifiant (`tunisie-12`, puis `tunisie-95`, `tunisie-96`… pour
  les nouvelles). On **archive** une question au lieu de la supprimer.
- **Défi du jour** : une question publiée n'y entre que **2 jours plus tard**, et les thèmes y sont pris par ordre
  d'identifiant. Ajouter des questions ou réordonner les tuiles ne change donc jamais le défi en cours de journée :
  tout le monde a les mêmes 10 questions.
- **Sécurité** : la clé publique ne permet que de lire les questions publiées et d'envoyer un signalement ; toute
  modification exige un compte présent dans la table `admins` (règles RLS de `1-schema.sql`).
- **Sans configuration** (`js/config.js` vide), le jeu fonctionne exactement comme avant.

### Mises à jour de la base
Quand le jeu évolue, un petit script apparaît dans `supabase/maj/` (ex. `01-dates-questions-origine.sql`).
Exécute chaque nouveau fichier **une fois**, dans l'ordre : **SQL Editor → New query → coller → Run**.
Ils sont sans risque et ré-exécutables. Sur une base toute neuve : 1-schema, 2-seed, 3-admin, puis tous les `maj/` dans l'ordre.

| Fichier | Contenu |
|---|---|
| `maj/01-dates-questions-origine.sql` | Les questions d'origine ne sont pas des nouveautés ✨ |
| `maj/02-comptes-classements.sql` | Comptes joueurs, profils, XP, classements (phase 2) |

### Outils
```cmd
node tools/check-live.js      :: diagnostic de TA base (lecture seule) : le jeu reçoit-il les questions ? sécurité OK ?
                              :: + liste de ce qui a été ajouté / modifié / retiré depuis l'admin
node tools/export-seed.js     :: régénère supabase/2-seed.sql depuis js/topics/*.js
node tools/check-catalog.js   :: vérifie : mêmes thèmes, mêmes défis du jour, mêmes identifiants, même correction
```

## 👤 Comptes joueurs & 🏆 classements (phase 2)

On peut toujours **jouer sans compte**. Avec un compte, le joueur entre dans les classements, gagne de l'XP et
monte de niveau. Connexion **sans mot de passe** : un **code à 6 chiffres reçu par e-mail** (ou Google).

| Fonction | Détail |
|---|---|
| 👤 **حسابي** | E-mail → code à 6 chiffres → pseudo (unique), avatar (16 emojis tunisiens) et **ولاية** (24 + 🌍 برّا تونس) |
| ⭐ **XP & niveaux** | XP = points ⭐ des parties **solo** et du **défi du jour** : 🌱 مبتدئ → 📘 تلميذ → ✏️ شاطر → 🧠 فهّام → 🎓 خبير → 🏅 أستاذ → 🦅 بطل → 👑 أسطورة |
| 🗓️ **Classement du jour** | Même défi pour tous ; à égalité, le plus de bonnes réponses puis le premier arrivé |
| 📅 **Classement de la semaine** | Points depuis lundi (heure de Tunis) |
| 🇹🇳 **Classement des ولايات** | Chaque joueur rapporte ses points de la semaine à sa ولاية |
| 🏁 **Fin de partie** | « ⭐ +18 XP · 🧠 فهّام » ou « 🏆 ترتيبك اليوم: 12 من 340 » ; sans compte : « أدخل للترتيب » |
| 🎁 **Joué avant de s'inscrire** | Le défi du jour (et la dernière partie solo) joués en invité comptent quand on s'inscrit juste après |
| 📴 **Hors ligne** | Les parties attendent sur le téléphone et partent au retour d'Internet |
| 🛡️ **Anti-triche** | Le serveur vérifie chaque partie (score possible, 1 seule participation au défi, 40 parties / 24 h) |
| 🧹 **Modération** | Page admin → **👥 Joueurs** : renommer un pseudo, bannir (disparaît des classements) |
| 🗑️ **فسّخ حسابي** | Le joueur peut supprimer son compte et toutes ses données (obligatoire sur les stores) |
| 🔗 **Lien `#rank`** | `https://…/#rank` ouvre directement le classement du jour |

### Mise en place dans Supabase (une seule fois)
1. **SQL Editor** : exécute `supabase/maj/02-comptes-classements.sql`.
2. **Authentication → URL Configuration** :
   - *Site URL* : `https://zmar1.github.io/qalleb-el-karta/`
   - *Redirect URLs* : ajoute `https://zmar1.github.io/qalleb-el-karta/**` et `http://localhost:3000/**`
3. **Tester tout de suite (sans rien d'autre)** : avec le service d'e-mails par défaut de Supabase, l'e-mail contient
   un **lien** de connexion (le jeu le gère : il ramène au jeu, connecté). Limites de ce service : il n'écrit
   **qu'aux adresses des membres de ton projet Supabase** (donc à toi), **2 à 3 e-mails par heure**, et ses modèles
   d'e-mails ne sont pas modifiables (« Set up custom SMTP to edit the source »).
4. **Avant d'ouvrir au public : ton propre service d'e-mails (SMTP)**. Le plus simple, gratuit, ~5 minutes :
   **un Gmail dédié au jeu** (jusqu'à ~500 e-mails / jour) :
   - crée une adresse Gmail pour le jeu (ex. `qalleb.karta…@gmail.com`) ;
   - dans ce compte Google : **Sécurité → Validation en deux étapes** : active-la ;
   - puis https://myaccount.google.com/apppasswords : crée un mot de passe d'application nommé « Supabase »
     → copie les **16 caractères** ;
   - Supabase → **Authentication → Emails → SMTP Settings** : active *Enable Custom SMTP* et remplis :
     *Sender email* = l'adresse Gmail, *Sender name* = `قلّب الكارطة`, *Host* = `smtp.gmail.com`, *Port* = `587`,
     *Username* = l'adresse Gmail, *Password* = les 16 caractères → **Save** ;
   - Supabase → **Authentication → Rate Limits** : monte la limite d'e-mails par heure (ex. 60).

   *Alternative* : **Brevo** (300 e-mails / jour) : compte sur https://www.brevo.com → **Senders** : ajoute et vérifie
   l'adresse d'envoi → **SMTP & API → SMTP** : serveur `smtp-relay.brevo.com`, port `587`, identifiant + clé SMTP
   à générer → mêmes champs dans Supabase. Plus tard, avec un nom de domaine à toi, les e-mails arriveront encore
   mieux (moins de Spam).
5. **Le code à 6 chiffres** (une fois le SMTP branché, les modèles deviennent modifiables) :
   **Authentication → Emails → Templates** : dans **Magic Link** ET **Confirm signup**, bouton **Source** → remplace
   tout par le contenu de `supabase/email-code.html`, sujet `🇹🇳 الكود متاعك لقلّب الكارطة` → **Save changes**.
   Garde la longueur du code à **6** (Authentication → Sign In / Providers → Email → *Email OTP Length*).
   Le code est indispensable pour le jeu **installé sur iPhone** (un lien s'ouvrirait dans Safari, pas dans le jeu).

### Google (facultatif)
1. https://console.cloud.google.com → nouveau projet → **Google Auth Platform** (écran de consentement) : nom de l'appli,
   e-mail de contact, public **Externe**, puis publie l'appli (*In production*).
2. **Clients → Create client → Web application** :
   - *Authorized JavaScript origins* : `https://zmar1.github.io` et `http://localhost:3000`
   - *Authorized redirect URIs* : `https://wkzeeaukdiltpujrmjey.supabase.co/auth/v1/callback`
   → copie le *Client ID* et le *Client secret*.
3. Supabase → **Authentication → Sign In / Providers → Google** : active, colle l'ID et le secret → Save.
4. Dans `js/config.js` : `googleLogin: true`, puis publie. Le bouton « كمّل بـ Google » apparaît.

> Sur iPhone, dans le jeu **installé sur l'écran d'accueil**, Google s'ouvre dans Safari : le code par e-mail y est plus pratique.

## ✏️ Modifier les textes, ajouter des questions ou un thème

**Changer une formulation** de l'interface : tout est dans `js/lang.js`.

**Ajouter des questions ou un thème** : avec la base de données configurée, tout se fait dans **`admin.html`**
(voir « 🗄️ Base de données » ci-dessus), sans toucher au code ni republier le site.

Sans base de données, on peut toujours modifier les fichiers intégrés. **Ajouter une question** dans un thème quiz
(`js/topics/tunisie.js` par ex.) :

```js
{ q: 'السؤال متاعك؟', a: ['جواب 1', 'جواب 2', 'جواب 3'], c: 0, f: 'معلومة صغيرة (اختياري)' },
```

`c` = index de la bonne réponse (0, 1 ou 2), `f` = anecdote « 💡 » optionnelle affichée après la réponse.
Pour le thème للمحبّين, une simple chaîne : `'السؤال متاعك؟',`

> ⚠️ Ajoute toujours les nouvelles questions **à la fin** de la liste : les liens « تحدّى صاحبك » déjà envoyés
> retrouvent les questions par leur position.

**Ajouter un thème** : copie un fichier de `js/topics/`, change `id`, `name`, `emoji`, `description`,
`colors`, `type` (`'quiz'` ou `'love'`) et les questions (minimum 10), puis ajoute sa balise
`<script src="js/topics/mon-theme.js"></script>` dans `index.html` (section « Thèmes ») et son chemin
dans la liste `ASSETS` de `sw.js` (pour le mode hors ligne).
Il apparaît automatiquement sur l'accueil, dans « خلطة » et dans le défi du jour.
Options : `image` (remplace l'emoji du médaillon), `featured: true` (tuile en grand, en tête) et
`ribbon: 'جديد ✨'` (ruban sur la tuile).

## ▶️ Tester en local

Double-clique sur `index.html`, ou lance un petit serveur :

```cmd
npx serve .
```

Pour tester sur ton téléphone sur le même Wi-Fi : ouvre `http://<IP-de-ton-PC>:3000`.

## 🌍 Hébergement gratuit et permanent

> ⚠️ **Netlify Drop sans compte** : le site est **supprimé au bout d'1 heure** s'il n'est pas « réclamé ».
> Utilise une des solutions ci-dessous, elles restent en ligne indéfiniment.

### Option 1 — GitHub Pages (recommandé) avec `publier.bat`

1. Crée un compte gratuit sur https://github.com puis un dépôt **public** vide : https://github.com/new
   (nom conseillé : `qalleb-el-karta`).
2. **Double-clique sur `publier.bat`** et colle l'adresse du dépôt quand elle est demandée
   (ex. `https://github.com/ton-pseudo/qalleb-el-karta.git`). Une fenêtre de connexion GitHub s'ouvre la 1ʳᵉ fois.
3. Une seule fois : sur GitHub, **Settings → Pages → Source : Deploy from a branch → `main` / `(root)` → Save**.
4. Après 1 à 2 minutes, le jeu est en ligne pour toujours sur `https://ton-pseudo.github.io/qalleb-el-karta/`.

**Mises à jour** : après chaque modification, re-double-clique sur `publier.bat` → le site se met à jour tout seul.

### Option 2 — Netlify avec un compte gratuit (glisser-déposer)

1. Crée un compte sur https://app.netlify.com/signup
2. **Sites → Add new site → Deploy manually**, glisse-dépose le dossier du projet.
3. URL permanente `https://xxx.netlify.app` (modifiable dans *Site configuration → Change site name*).
   Pour mettre à jour : *Deploys* → glisse-dépose à nouveau le dossier.

### Option 3 — Cloudflare Pages (glisser-déposer)

https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Upload assets** → glisse le dossier.
URL permanente `https://xxx.pages.dev`.

Ensuite, ouvre l'URL sur ton smartphone → menu du navigateur → **« Ajouter à l'écran d'accueil »**.

## 🔊 Le son ne marche pas sur le téléphone ?

Le jeu gère déjà le déblocage audio des navigateurs mobiles et le bouton silencieux de l'iPhone. Si c'est muet :
- vérifie que le bouton du jeu est sur 🔊 (et pas 🔇) ;
- monte le **volume « média »** du téléphone (sur Android, c'est un volume séparé de la sonnerie) ;
- touche l'écran une fois : le son se réactive après un appel ou un verrouillage ;
- dans les navigateurs intégrés (Messenger, Instagram…), ouvre plutôt le lien dans Chrome / Safari.

