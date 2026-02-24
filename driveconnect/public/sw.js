const CACHE_NAME = 'driveconnect-v3';
const STATIC_ASSETS = [
    '/',
    '/app.html',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(cacheNames.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('supabase.co') ||
        event.request.url.includes('paypal.com') ||
        event.request.url.includes('resend.com') ||
        event.request.url.includes('cdn.') ||
        event.request.url.includes('unpkg.com')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request).then(c => c || caches.match('/app.html')))
    );
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || 'DriveConnect NC', {
            body: data.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            data: { url: data.url || '/app.html' },
            actions: [
                { action: 'open', title: 'Voir' },
                { action: 'close', title: 'Ignorer' }
            ]
        })
    );
});

// Clic sur la notification → ouvre l'app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;
    const url = event.notification.data?.url || '/app.html';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (const client of windowClients) {
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});
