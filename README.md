# 🇹🇳 قلّب الكارطة — Qalleb el Karta

Jeu de cartes-quiz **100 % tunisien**, entièrement en **derja (arabe tunisien)**, jouable sur smartphone :
10 cartes face cachée, on en touche une, elle se retourne et révèle une question.

## 🎨 Design tunisien

- **Dos des cartes** = portes bleues cloutées en arc de **Sidi Bou Saïd** (numéro dans un médaillon doré)
- **Face des cartes** = mur blanchi à la chaux avec bordure en **zellige de Nabeul**
- **Frises de céramique**, motif d'étoiles à 8 branches en fond, rouge du **drapeau** pour les boutons
- Thème **للمحبّين** en rose bougainvillier 🌸
- Polices arabes : **Reem Kufi** (titres, style coufique) et **Cairo** (textes) — interface **RTL**

## 🗂️ Thèmes (المواضيع)

| Thème | Questions | Type | Modes |
|---|---|---|---|
| 🇹🇳 **تونس** (mis en avant) | 29 | Quiz à 3 choix : histoire, lieux, cuisine, culture, sport | وحدي · واحد ضدّ واحد |
| 🧠 ثقافة عامّة | 15 | Quiz à 3 choix | وحدي · واحد ضدّ واحد |
| 🌍 جغرافيا | 15 | Quiz à 3 choix | وحدي · واحد ضدّ واحد |
| 🔬 علوم و طبيعة | 15 | Quiz à 3 choix | وحدي · واحد ضدّ واحد |
| 🎬 سينما و مزيكة | 15 | Quiz à 3 choix | وحدي · واحد ضدّ واحد |
| 🎲 خلطة | toutes | Mélange des thèmes quiz | وحدي · واحد ضدّ واحد |
| 💕 للمحبّين | 31 | Questions **libres**, réponse à voix haute | À deux, écran normal |

## 🎮 Modes de jeu

### 👤 وحدي — Solo (écran normal)
Un joueur répond aux 10 cartes. Score sur 10 et **record mémorisé** par thème (affiché sur la tuile 🏅).

### ⚔️ واحد ضدّ واحد — 1 contre 1 (écran partagé, face à face)
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

- **Effets sonores** synthétisés (aucun fichier) : carte, retournement, bonne/mauvaise réponse, temps écoulé,
  victoire, cœur — bouton 🔊/🔇
- Minuteur (20 / 30 / 45 s ou بلا وقت) avec bips sur les 5 dernières secondes
- Vibrations, écran maintenu allumé pendant la partie, confettis (ou pluie de cœurs 💖)
- Les questions déjà vues ne reviennent pas tant qu'il en reste de nouvelles
- Installable sur l'écran d'accueil (manifest PWA)

> 💡 En 1 contre 1, bloquez la rotation automatique du téléphone. Le son fonctionne aussi avec le bouton silencieux de l'iPhone.

## 🧱 Technologies & structure

HTML + CSS + JavaScript **sans framework ni serveur** : léger, rapide sur mobile, hébergeable gratuitement.

```
index.html               → tous les écrans (lang="ar-TN", dir="rtl")
css/style.css            → design tunisien (portes, zellige, frises, animations 3D)
img/flag-tn.svg          → médaillon du drapeau tunisien
js/lang.js               → TOUS les textes de l'interface en derja (à modifier ici)
js/topics/_registry.js   → registre des thèmes (format documenté)
js/topics/*.js           → un fichier par thème (questions en derja)
js/sound.js              → effets sonores (Web Audio API)
js/core.js               → outils partagés (tirage, cartes, minuteur, stockage…)
js/modes/duel.js         → mode 1 contre 1 (écran partagé)
js/modes/single.js       → modes Solo et Amoureux (écran normal)
js/app.js                → navigation : accueil → thème → mode → partie
manifest.webmanifest     → installation « Ajouter à l'écran d'accueil »
icon.svg                 → icône (porte de Sidi Bou Saïd + croissant et étoile)
publier.bat              → publication / mise à jour sur GitHub Pages en un double-clic
```

## ✏️ Modifier les textes, ajouter des questions ou un thème

**Changer une formulation** de l'interface : tout est dans `js/lang.js`.

**Ajouter une question** dans un thème quiz (`js/topics/tunisie.js` par ex.) :

```js
{ q: 'السؤال متاعك؟', a: ['جواب 1', 'جواب 2', 'جواب 3'], c: 0 },
```

`c` = index de la bonne réponse (0, 1 ou 2). Pour le thème للمحبّين, une simple chaîne : `'السؤال متاعك؟',`

**Ajouter un thème** : copie un fichier de `js/topics/`, change `id`, `name`, `emoji`, `description`,
`colors`, `type` (`'quiz'` ou `'love'`) et les questions (minimum 10), puis ajoute sa balise
`<script src="js/topics/mon-theme.js"></script>` dans `index.html` (section « Thèmes »).
Il apparaît automatiquement sur l'accueil et dans « خلطة ».
Options : `image` (remplace l'emoji du médaillon) et `featured: true` (tuile en tête avec ruban « جديد »).

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

