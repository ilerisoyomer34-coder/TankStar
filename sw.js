// Tank Rush — Service Worker
// Tüm oyun dosyalarını cache'e alır → offline çalışır

const CACHE  = 'tank-rush-v1';
const ASSETS = [
  './',
  './index.html',
  './game.js',
  './manifest.json',
  './icons/icon.svg',
  'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js',
];

// Install: tüm dosyaları cache'e al
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: eski cache versiyonlarını temizle
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: önce cache, yoksa network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Başarılı response'u cache'e de ekle
        if (res && res.status === 200 && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached); // network yoksa cache'ten sun
    })
  );
});
