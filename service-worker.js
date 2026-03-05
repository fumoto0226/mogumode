const CACHE_NAME = 'mogu-pwa-v2';
const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './map.js',
    './manifest.webmanifest',
    './offline.html',
    './images/applogo.jpg',
    './images/pwa/apple-touch-icon.png',
    './images/pwa/icon-192.png',
    './images/pwa/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', cloned));
                    return response;
                })
                .catch(async () => {
                    const cachedPage = await caches.match(request);
                    if (cachedPage) return cachedPage;
                    return (await caches.match('./index.html')) || caches.match('./offline.html');
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                const cloned = response.clone();
                if (response.ok && ['style', 'script', 'worker', 'image', 'font'].includes(request.destination)) {
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                }
                return response;
            });
        })
    );
});
