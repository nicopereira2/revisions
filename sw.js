const CACHE = 'revisions-v13';
const SHELL = [
  './', './index.html', './Revisions.dc.html', './support.js', './course-import.js', './local-qgen.js', './cloud.js', './config.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './logo-mark.png', './logo-mark-dark.png',
  './ds/styles.css',
  './ds/ds_bundle.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache account / database / AI traffic.
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in') || url.hostname === 'api.anthropic.com' || url.hostname === 'generativelanguage.googleapis.com' || url.hostname === 'api.groq.com' || url.hostname.endsWith('huggingface.co') || url.hostname.endsWith('hf.co') || url.hostname === 'raw.githubusercontent.com') return;
  if (url.origin === location.origin) {
    // App files: network first so updates land immediately; cache when offline.
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./Revisions.dc.html') : undefined))));
    return;
  }
  // CDN libraries and fonts: cache first, refresh in background.
  e.respondWith(caches.match(req).then(cached => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => cached);
    return cached || net;
  }));
});

self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) if ('focus' in w) return w.focus(); return clients.openWindow('./'); })); });
