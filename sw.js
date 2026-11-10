/* Service Worker: cache the app shell + learning data for offline use.
   Pyodide/Monaco CDN assets are runtime-cached after first download. */
const CACHE = 'python-studio-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'worker.js', 'manifest.webmanifest', 'icon.svg',
  'data/lessons.js', 'data/quizzes.js', 'data/reference.js', 'data/glossary.js', 'data/extras.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone();
    if (res.ok) caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  })));
});
