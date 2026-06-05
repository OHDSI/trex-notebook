// Self-unregistering kill-switch.
//
// A previous build registered a cross-origin-isolation (COOP/COEP) service
// worker at this URL. That approach was wrong: shinylive/WebR uses its own
// service-worker (httpuv) channel, which does NOT need cross-origin isolation,
// and the COEP this worker injected broke that channel (the result viewer hung).
//
// We can't just delete the file: a 404 on a SW script is an "update failed" and
// the browser KEEPS the old worker running. So we serve this stub instead — on
// the next update check (any navigation within scope) the browser installs it,
// it unregisters itself, clears caches, and reloads controlled tabs. Affected
// browsers self-heal with no manual "clear site data" needed.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_e) { /* best effort */ }
    try {
      await self.registration.unregister();
    } catch (_e) { /* best effort */ }
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) {
      try { c.navigate(c.url); } catch (_e) { /* best effort */ }
    }
  })());
});

// While still controlling (before activation completes), pass every request
// straight through with NO header rewriting, so it can't keep the page isolated.
self.addEventListener('fetch', () => { /* default network handling */ });
