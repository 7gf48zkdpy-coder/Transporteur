// Transporteur VTC — appli client : chauffeurs disponibles autour, en temps réel sur la carte de réservation (comme Uber / Bolt).
// Positions fournies par nearby_drivers_live (chauffeurs validés, en ligne, sans course ; aucune identité transmise,
// seulement une clé anonyme pour suivre chaque voiture). Rafraîchi toutes les 4 s, les voitures glissent d'une position à l'autre.
import { sb } from "./core.js";

const L = window.L;
const maps = new Set();
if (L) L.Map.addInitHook(function () { if (this.getContainer().id === "bkMap") maps.add(this); });

const POLL_MS = 4000, ANIM_MS = 3600;
const carIcon = () => L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [34, 34], iconAnchor: [17, 17] });
const R = Math.PI / 180;
function bearing(a, b) {
  const y = Math.sin((b.lng - a.lng) * R) * Math.cos(b.lat * R);
  const x = Math.cos(a.lat * R) * Math.sin(b.lat * R) - Math.sin(a.lat * R) * Math.cos(b.lat * R) * Math.cos((b.lng - a.lng) * R);
  return (Math.atan2(y, x) / R + 360) % 360;
}
function rotate(m, deg) { const car = m._icon?.querySelector(".car-top"); if (car && deg != null) car.style.transform = `rotate(${deg}deg)`; m._deg = deg; }

// Glisse la voiture de sa position actuelle vers la nouvelle (animation fluide).
function glide(m, to, heading) {
  const from = m.getLatLng();
  const moved = from.distanceTo(to);
  if (moved < 2) { if (heading != null) rotate(m, heading); return; }
  rotate(m, heading ?? bearing(from, L.latLng(to)));
  if (moved > 3000) { m.setLatLng(to); return; }            // saut (GPS perdu) : pas d'animation
  cancelAnimationFrame(m._raf);
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ANIM_MS), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    m.setLatLng([from.lat + (to[0] - from.lat) * e, from.lng + (to[1] - from.lng) * e]);
    if (m._deg != null) rotate(m, m._deg);
    if (k < 1) m._raf = requestAnimationFrame(step);
  };
  m._raf = requestAnimationFrame(step);
}

async function refresh(map) {
  if (!map._container?.isConnected) { maps.delete(map); map._nearby?.remove(); return; }
  if (document.hidden || map._busy) return;
  map._busy = true;
  try {
    const c = map.getCenter();
    const { data, error } = await sb.rpc("nearby_drivers_live", { p_lat: c.lat, p_lng: c.lng, p_km: 15 });
    if (error || !map._container?.isConnected) return;
    if (!map._nearby) map._nearby = L.layerGroup().addTo(map);
    const cars = map._cars || (map._cars = new Map());
    const keep = new Set();
    (data || []).forEach((d) => {
      keep.add(d.k);
      const to = [d.lat, d.lng];
      const m = cars.get(d.k);
      if (m) return glide(m, to, d.heading);
      const nm = L.marker(to, { icon: carIcon(), interactive: false, keyboard: false, zIndexOffset: -100 });
      nm.on("add", () => rotate(nm, d.heading));
      nm.addTo(map._nearby); cars.set(d.k, nm);
    });
    cars.forEach((m, k) => { if (!keep.has(k)) { cancelAnimationFrame(m._raf); map._nearby.removeLayer(m); cars.delete(k); } });
  } finally { map._busy = false; }
}

setInterval(() => maps.forEach(refresh), POLL_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) maps.forEach(refresh); });
let moveTimer = null;
new MutationObserver(() => maps.forEach((m) => {
  if (m._nearbyStarted) return;
  m._nearbyStarted = true;
  setTimeout(() => refresh(m), 600);
  m.on("moveend", () => { clearTimeout(moveTimer); moveTimer = setTimeout(() => refresh(m), 500); });
}))
  .observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
