const CACHE = 'mahjooz-v9';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/styles/index.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // استراتيجية (Network First) للملفات الديناميكية وصفحات HTML والـ JS لمنع مشاكل كاش التحديثات
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.js')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // استراتيجية (Cache First) للملفات الثابتة الأخرى (الصور والتنسيقات والخطوط)
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }))
    );
  }
});
