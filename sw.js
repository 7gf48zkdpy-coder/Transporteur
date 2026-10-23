// Service worker Transporteur
// Un seul rôle : quand l'appli installée s'ouvre sans réseau, afficher la page
// « Pas de connexion » (offline.html) au lieu d'un écran d'erreur dont on ne peut pas sortir.
//
// Il ne met en cache QUE offline.html (page statique, sans donnée).
// Il n'intercepte que les ouvertures de page (navigations) du site lui-même :
// Firebase/Firestore, la connexion, la carte, les adresses et les itinéraires passent
// directement par le réseau. Aucune donnée client, réservation ou réponse authentifiée
// n'est stockée. Les pages et le code sont toujours chargés depuis le réseau (dernière version).

const VERSION = "transporteur-offline-v1";
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
