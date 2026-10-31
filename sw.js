const CACHE = 'saa-quiz-v15';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/firebase-config.js', 'manifest.webmanifest', 'icon.svg',
  'data/compute.js', 'data/storage.js', 'data/database.js', 'data/networking.js',
  'data/security.js', 'data/integration.js', 'data/analytics.js', 'data/management.js',
  'data/batch-02.js', 'data/batch-03.js', 'data/batch-04.js', 'data/batch-05.js', 'data/batch-06.js', 'data/batch-07.js', 'data/batch-08.js', 'data/batch-09.js', 'data/batch-10.js', 'data/concepts.js',
];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 네트워크 우선: 연결되면 항상 최신 파일을 쓰고 캐시를 갱신한다.
// 오프라인이거나 응답이 늦으면(지하철) 캐시로 바로 보여 준다.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT));
    try {
      const res = await Promise.race([network, timeout]);
      if (res) return res;
    } catch (err) { /* 오프라인 */ }
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || network;
  })());
});
