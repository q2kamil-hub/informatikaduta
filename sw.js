// sw.js — Service Worker Portal Informatika DUTA
// Versi: 1.0.3 — NETWORK-FIRST untuk konten inti (perbaikan cache basi)
const CACHE_NAME = 'duta-pwa-v3';
const OFFLINE_URL = '/informatikaduta/index.html';

// Aset yang dipanaskan saat install (untuk offline pertama kali)
const STATIC_ASSETS = [
  '/informatikaduta/',
  '/informatikaduta/index.html',
  '/informatikaduta/script.js',
  '/informatikaduta/desain.css',
  '/informatikaduta/favicon.png',
  '/informatikaduta/manifest.json'
];

// ============================================
// INSTALL: cache aset statis + ambil alih segera
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
// ACTIVATE: hapus cache lama (v1/v2) + claim klien
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
// FETCH: network-first untuk konten inti
// ============================================
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya tangani GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Jangan intersep lintas origin (API Apps Script, CDN, dll)
  if (url.origin !== self.location.origin) return;

  // versi.json: SELALU jaringan dulu (deteksi update), fallback cache saat offline
  if (url.pathname.endsWith('/versi.json')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Konten inti (halaman, JS, CSS, manifest, gambar, JSON):
  // NETWORK-FIRST → sukses = perbarui cache; gagal (offline) → fallback cache
  const isCoreAsset = req.mode === 'navigate' ||
    /\.(html?|js|css|json|png|svg|ico)(\?|$)/i.test(url.pathname);

  if (isCoreAsset) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match(OFFLINE_URL);
          return Response.error();
        });
      })
    );
    return;
  }

  // Aset lain: cache-first → fallback jaringan
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
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