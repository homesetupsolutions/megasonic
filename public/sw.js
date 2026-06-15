// Minimal service worker — enables "Install app" on Android/Samsung.
// No offline caching yet; we keep network-first so data is always fresh.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
