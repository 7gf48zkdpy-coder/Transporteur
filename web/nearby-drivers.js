// Transporteur VTC — appli client : chauffeurs disponibles autour, affichés en direct sur la carte de réservation (comme Uber / Bolt).
// Positions fournies par la fonction nearby_drivers (chauffeurs validés, en ligne, sans course, vus il y a moins de 10 min ;
// aucune identité n'est transmise). Mise à jour toutes les 15 secondes.
import { sb } from "./core.js";

const L = window.L;
const maps = new Set();
if (L) L.Map.addInitHook(function () { if (this.getContainer().id === "bkMap") maps.add(this); });

const carIcon = () => L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [34, 34], iconAnchor: [17, 17] });

async function refresh(map) {
  if (!map._container?.isConnected) { maps.delete(map); map._nearby?.remove(); return; }
  const c = map.getCenter();
  const { data, error } = await sb.rpc("nearby_drivers", { p_lat: c.lat, p_lng: c.lng, p_km: 15 });
  if (error || !map._container?.isConnected) return;
  map._nearby?.remove();
  map._nearby = L.layerGroup((data || []).map((d) => {
    const m = L.marker([d.lat, d.lng], { icon: carIcon(), interactive: false, keyboard: false, zIndexOffset: -100 });
    m.on("add", () => { const car = m._icon?.querySelector(".car-top"); if (car && d.heading != null) car.style.transform = `rotate(${d.heading}deg)`; });
    return m;
  })).addTo(map);
}

setInterval(() => maps.forEach(refresh), 15000);
let moveTimer = null;
new MutationObserver(() => maps.forEach((m) => {
  if (m._nearbyStarted) return;
  m._nearbyStarted = true;
  setTimeout(() => refresh(m), 600);
  m.on("moveend", () => { clearTimeout(moveTimer); moveTimer = setTimeout(() => refresh(m), 500); });
}))
  .observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
