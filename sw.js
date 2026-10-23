// Service worker Transporteur
// Un seul rôle : quand l'appli installée s'ouvre sans réseau, afficher la page
// « Pas de connexion » (offline.html) au lieu d'un écran d'erreur dont on ne peut pas sortir.
//
// Il ne met en cache QUE offline.html (page statique, sans donnée).
// Il n'intercepte que les ouvertures de page (navigations) du site lui-même :
// la base de données, la connexion, la carte, les adresses et les itinéraires passent
// directement par le réseau. Aucune donnée client, réservation ou réponse authentifiée
// n'est stockée. Les pages et le code sont toujours chargés depuis le réseau (dernière version).

const VERSION = "transporteur-offline-v3";
const OFFLINE_URL = "./offline.html";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(c => c.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;   // tout le reste : comportement normal du navigateur
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
  );
});

// Notifications (course acceptée, chauffeur à proximité)
self.addEventListener("push", event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || "Transporteur", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag, data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "./", self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
