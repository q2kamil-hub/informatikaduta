// sw.js — Service Worker Portal Informatika DUTA
// Versi: 1.0.0

const CACHE_NAME = 'duta-pwa-v2';
const OFFLINE_URL = '/informatikaduta/index.html';

// Aset statis yang dicache saat install
const STATIC_ASSETS = [
  '/informatikaduta/',
  '/informatikaduta/index.html',
  '/informatikaduta/script.js',
  '/informatikaduta/desain.css',
  '/informatikaduta/favicon.png',
  '/informatikaduta/manifest.json'
];

// Aset yang JANGAN dicache (selalu fetch langsung dari jaringan)
const NO_CACHE_ASSETS = [
  '/informatikaduta/versi.json'
];

// ============================================
// INSTALL: cache aset statis
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch((err) => {
      console.warn('[SW] Gagal cache aset statis:', err);
    })
  );
  self.skipWaiting();
});

// ============================================
// ACTIVATE: hapus cache lama
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// ============================================
// FETCH: intercept request untuk offline & cache
// ============================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan cache versi.json — selalu fetch dari jaringan
  if (NO_CACHE_ASSETS.some((path) => url.pathname.endsWith(path))) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first untuk aset statis, fallback ke jaringan
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache response baru untuk halaman & aset yang diizinkan
        if (networkResponse.ok && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback untuk navigasi HTML
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ============================================
// PESAN dari client (halaman)
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});