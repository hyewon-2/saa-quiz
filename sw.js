const CACHE = 'saa-quiz-v8';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/firebase-config.js', 'manifest.webmanifest', 'icon.svg',
  'data/compute.js', 'data/storage.js', 'data/database.js', 'data/networking.js',
  'data/security.js', 'data/integration.js', 'data/analytics.js', 'data/management.js',
  'data/batch-02.js', 'data/batch-03.js', 'data/batch-04.js', 'data/batch-05.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 캐시를 먼저 보여 주고, 백그라운드에서 최신 파일로 갱신한다 (지하철 오프라인 대응)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || fresh;
  }));
});
