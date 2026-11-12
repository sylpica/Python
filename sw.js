/* Service Worker for Python Studio.
   - App files: network first (updates reach users at once), cache only as offline fallback.
   - CDN files (Pyodide / Monaco, version-pinned URLs): cache first, kept in a separate cache
     that survives app updates, so Python does not have to be downloaded again after a deploy.
   - Only caches whose names start with "python-studio-" are ever deleted: other apps on the
     same origin (sylpica.github.io/…) keep their caches. */
const VERSION = 'v13';
const APP_CACHE = 'python-studio-app-' + VERSION;
const CDN_CACHE = 'python-studio-cdn-' + VERSION;
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'lib/core.js', 'lib/sim.js', 'lib/sim-ui.js', 'worker.js', 'runtime/pystudio.py', 'runtime/pystudio_mpl.py',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-maskable-512.png', 'data/lessons.js', 'data/quizzes.js', 'data/reference.js', 'data/glossary.js', 'data/extras.js', 'data/templates.js'];
const CDN_HOSTS = ['cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('python-studio-') && k !== APP_CACHE && k !== CDN_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;   // not ours
    // cache:'no-cache' revalidates with the server, so the HTTP cache (GitHub Pages sends max-age=600)
    // can never serve a mix of old and new files after a deploy
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.open(APP_CACHE).then(c => c.match(e.request, { ignoreSearch: true })).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CDN_CACHE).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      // opaque (no-cors) responses come from Monaco's <script> loader; they are cached too
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }))));
  }
  // anything else (PyPI for micropip, user requests) goes to the network untouched
});
