// Transporteur VTC — ouverture rapide et installation sur l'écran d'accueil.
// Les pages et scripts sont toujours redemandés au réseau (pour avoir la dernière version) ;
// la copie en cache ne sert que si le réseau est indisponible. Les données (Supabase) ne sont jamais mises en cache.
const CACHE = "transporteur-v3";
const SHELL = ["./", "index.html", "chauffeur.html", "app.css", "ui.css", "core.js", "ui.js", "client.js", "driver.js", "icon.svg", "manifest.json", "manifest-chauffeur.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
