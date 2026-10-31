self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Use the network without caching account data, API responses, or exercise videos.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kineticare — Offline</title><body style="font-family:system-ui;padding:32px"><h1>You’re offline</h1><p>Connect to the internet to open Kineticare and sync your exercises.</p><button onclick="location.reload()">Try again</button></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )));
});
