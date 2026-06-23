const CACHE_NAME = 'healthchain-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  // In a real production app we would cache all CSS/JS
  // but to prevent breaking the hackathon demo, we will cache the bare minimum
  // so the user sees an offline page instead of a crash.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        // If it's an HTML page request and we're offline, we could return a fallback offline.html
        // For now, just returning what's in cache if available.
      });
    })
  );
});
