// Service Worker — handler des notifications push
// Importé par workbox via workbox.importScripts dans vite.config.ts

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'CrewFlo',
      body: event.data ? event.data.text() : 'Nouvelle notification',
    };
  }

  const title = data.title || 'CrewFlo';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192-v2.png',
    badge: data.badge || '/icon-192-v2.png',
    tag: data.tag || 'crewflo',
    data: { url: data.url || '/' },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre CrewFlo est déjà ouverte, la focuser
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          const myUrl = new URL(self.location.href);
          if (url.origin === myUrl.origin && 'focus' in client) {
            return client.focus().then((c) => {
              if (c && 'navigate' in c) return c.navigate(targetUrl).catch(() => {});
            });
          }
        } catch (e) {}
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
