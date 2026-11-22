/**
 * Service worker : le jeu fonctionne hors ligne une fois ouvert.
 *  - fichiers du jeu : réseau d'abord (toujours la dernière version), cache si pas de connexion ;
 *  - polices Google : cache d'abord, mise à jour en arrière-plan.
 */
const CACHE = 'qalleb-v1';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'icon.svg',
  'img/flag-tn.svg',
  'manifest.webmanifest',
  'js/lang.js',
  'js/topics/_registry.js',
  'js/topics/tunisie.js',
  'js/topics/amthal.js',
  'js/topics/culture.js',
  'js/topics/geographie.js',
  'js/topics/sciences.js',
  'js/topics/cinema-musique.js',
  'js/topics/amoureux.js',
  'js/sound.js',
  'js/core.js',
  'js/modes/duel.js',
  'js/modes/single.js',
  'js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => { /* un fichier manquant ne doit pas bloquer l'installation */ })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(new Request(request.url, { cache: 'no-cache' }))
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request.url, copy));
          }
          return response;
        })
        .catch(() => caches.match(request.url, { ignoreSearch: true })
          .then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : undefined))
          .then((hit) => hit || Response.error())),
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE).then((cache) => cache.match(request).then((hit) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit || Response.error());
        return hit || network;
      })),
    );
  }
});


