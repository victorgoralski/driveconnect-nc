const CACHE_NAME = 'driveconnect-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Installation - mise en cache des ressources statiques
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activation - nettoyage des anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch - stratégie Network First avec fallback cache
self.addEventListener('fetch', (event) => {
    // Ne pas intercepter les requêtes Supabase ou PayPal
    if (event.request.url.includes('supabase.co') ||
        event.request.url.includes('paypal.com') ||
        event.request.url.includes('resend.com') ||
        event.request.url.includes('cdn.') ||
        event.request.url.includes('unpkg.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Mettre en cache la réponse fraîche
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback vers le cache si pas de réseau
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // Page offline par défaut
                    return caches.match('/index.html');
                });
            })
    );
});

// Notifications push (pour plus tard)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    self.registration.showNotification(data.title || 'DriveConnect NC', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200]
    });
});
