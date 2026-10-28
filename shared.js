// Code commun client + chauffeur
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY, DEFAULT_SETTINGS, VAPID_PUBLIC_KEY } from "./config.js";

export const configured = !!(SUPABASE_URL && SUPABASE_KEY);
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
export { DEFAULT_SETTINGS };

/* ---------- notifications ---------- */
export const isStandalone = () => window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const b64ToBytes = s => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
export async function pushStatus() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); return sub && Notification.permission === "granted" ? "on" : "off"; } catch { return "off"; }
}
// Demande l'autorisation et enregistre l'appareil (à appeler depuis un toucher sur un bouton)
export async function enablePush() {
  if (!pushSupported()) throw new Error(isStandalone() ? "Les notifications ne sont pas disponibles sur ce téléphone." : "Installez d'abord l'appli sur l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvrez-la depuis l'icône.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications refusées. Vous pouvez les autoriser dans Réglages → Notifications.");
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const { error } = await sb.from("push_subscriptions").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
  if (error) throw new Error("Enregistrement impossible. Réessayez.");
}

/* ---------- Revolut ---------- */
// Format vérifié sur iPhone : montant en centimes (1 € = 100)
export const revolutLink = (tag, amount) => { const t = String(tag || "").trim().replace(/^@/, ""); return t ? `https://revolut.me/${encodeURIComponent(t)}${amount ? "?currency=EUR&amount=" + Math.round(Number(amount) * 100) : ""}` : ""; };

/* ---------- données ---------- */
// Une réservation = colonnes (id, statut, client_uid) + détails dans doc
export const rowToBooking = r => ({ ...(r.doc || {}), id: r.id, statut: r.statut, clientUid: r.client_uid,
  driverId: r.driver_id || null, offeredTo: r.offered_to || null, offeredAt: r.offered_at ? Date.parse(r.offered_at) : null,
  requestedDriver: r.requested_driver || null, refused: r.refused || [] });
// Détails stockés dans doc (sans les colonnes)
export const docOf = b => { const { id, statut, clientUid, driverId, offeredTo, offeredAt, requestedDriver, refused, ...doc } = b; return doc; };
// Chauffeurs actifs (sans téléphone) avec position s'ils sont en ligne
export async function driversLive() {
  const { data, error } = await sb.rpc("drivers_live2"); if (error) throw error; return data || [];
}
// Motorisation du véhicule : électrique ou hybride = badge « Éco » (indépendant de la catégorie Berline / SUV…)
export const ENERGIES = { electrique: "Électrique", hybride: "Hybride", essence: "Essence", diesel: "Diesel", gpl: "GPL" };
export const isEco = d => d?.energie === "electrique" || d?.energie === "hybride";
export const ECO_BADGE = `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#7ee2a8;background:rgba(34,201,122,.14);border-radius:999px;padding:2px 9px;white-space:nowrap">🌿 Éco</span>`;
// Devine la motorisation d'après le modèle tapé (simple suggestion : le chauffeur peut corriger)
export function guessEnergie(modele) {
  const m = String(modele || "").toLowerCase();
  if (!m.trim()) return "";
  if (/\b(tesla|model ?[3sxy]|zo[eé]|e-?20(08|8)|e-?c4|e-?tron|id\.? ?[3-7]|leaf|ev ?[369]|ioniq ?[56]|enyaq|mach-?e|polestar|byd|mg ?4|mg ?5|spring|bz4x|eq[abcesv]|i[34x]\b|électrique|electrique|electric|e-?golf|e-?up|e-?208|megane e-?tech electri|scenic e-?tech|r5 e-?tech|kona electri|niro ev|e-?niro)/.test(m)) return "electrique";
  if (/(hybrid|hybride|prius|c-?hr|rav ?4|corolla|yaris|camry|auris|e-?tech|phev|plug-?in|niro|ioniq|lexus|cr-?v|jazz|kuga|outlander|e-?hybrid|full hybrid|hev)/.test(m)) return "hybride";
  return "";
}
export const carLabel = d => [d?.modele, d?.plaque, isEco(d) ? "🌿 Éco" : ""].filter(Boolean).join(" · ");
export async function fetchSettings() {
  const { data, error } = await sb.from("settings").select("doc").eq("id", 1).maybeSingle();
  if (error) throw error; return data?.doc || {};
}
export function watchSettings(cb) {
  fetchSettings().then(cb).catch(() => cb({}));
  return sb.channel("settings").on("postgres_changes", { event: "*", schema: "public", table: "settings" }, p => { if (p.new?.doc) cb(p.new.doc); }).subscribe();
}
// Recharge une requête à chaque changement de la table (simple et fiable)
export function watchTable(table, load, cb, filter) {
  let t; const run = () => { clearTimeout(t); t = setTimeout(async () => { try { cb(await load()); } catch { } }, 150); };
  run();
  const opts = { event: "*", schema: "public", table }; if (filter) opts.filter = filter;
  const ch = sb.channel("w-" + table + "-" + Math.random().toString(36).slice(2, 7)).on("postgres_changes", opts, run).subscribe();
  ch.refresh = run;
  return ch;
}

/* ---------- petits outils ---------- */
export const $ = s => document.querySelector(s);
export const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pad = n => String(n).padStart(2, "0");
export const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
export const nowHM = () => pad(new Date().getHours()) + ":" + pad(new Date().getMinutes());
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const fmtDate = iso => { if (!iso) return ""; if (iso === todayISO()) return "Aujourd'hui"; const [y, m, d] = iso.split("-").map(Number); const dt = new Date(y, m - 1, d); return JOURS[dt.getDay()] + " " + pad(d) + "/" + pad(m); };
export const eur = v => (Math.round(v * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
export const ago = ms => { if (!ms) return ""; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? "à l'instant" : m < 60 ? "il y a " + m + " min" : "il y a " + Math.round(m / 60) + " h"; };
export const ref = () => "VTC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
export function toast(t) { let el = $("#toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); } el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2800); }
export async function copy(text) { try { await navigator.clipboard.writeText(text); toast("Copié"); } catch { toast("Appuyez longuement sur le texte pour le copier"); } }

export const STATUS = { en_attente: "En attente", confirmee: "Confirmée", terminee: "Terminée", annulee: "Annulée" };

export const LOGO = `<svg class="logo" viewBox="0 0 330 140" aria-hidden="true"><g fill="currentColor"><polygon points="42,0 124,0 82,140 0,140"/><polygon points="145,0 227,0 185,140 103,140"/><polygon points="248,0 330,0 288,140 206,140"/></g></svg>`;
export const IC = {
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14v-5l-2-5H7l-2 5z"/><path d="M5 12h14"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.3.1 4 1.6 4.5 4.4"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.9 7.5 9.5 4.4-1.6 7.5-5.1 7.5-9.5V6z"/><circle cx="12" cy="10" r="2.4"/><path d="M8.3 16c.7-1.8 2-2.7 3.7-2.7s3 .9 3.7 2.7"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z"/><circle cx="8.2" cy="8.2" r="1.5"/></svg>',
  locate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  carTop: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="6.9" cy="8.9" rx="1" ry=".55" fill="#f6f5f1"/><ellipse cx="17.1" cy="8.9" rx="1" ry=".55" fill="#f6f5f1"/><path d="M12 1.4C15 1.4 16.4 2.3 16.6 4.6L16.8 19.2C16.8 21.6 15.4 22.6 12 22.6S7.2 21.6 7.2 19.2L7.4 4.6C7.6 2.3 9 1.4 12 1.4Z" fill="#f6f5f1"/><path d="M8.3 8.9Q12 7.5 15.7 8.9L14.9 12.1Q12 11.5 9.1 12.1Z" fill="#1b1b19"/><path d="M9.3 12.6Q12 12.1 14.7 12.6L14.7 16Q12 16.4 9.3 16Z" fill="#d9d7cf"/><path d="M9.2 16.6Q12 17 14.8 16.6L15.3 18.8Q12 19.5 8.7 18.8Z" fill="#1b1b19"/><path d="M8.4 2.6Q9.3 2.1 10.1 2.2" stroke="#2F6BED" stroke-width=".7" stroke-linecap="round" fill="none"/><path d="M15.6 2.6Q14.7 2.1 13.9 2.2" stroke="#2F6BED" stroke-width=".7" stroke-linecap="round" fill="none"/><path d="M8.2 21.4H9.8M14.2 21.4H15.8" stroke="#b3302a" stroke-width=".6" stroke-linecap="round"/></svg>'
};

/* ---------- devis (calculé par le serveur : le client ne peut pas modifier le prix) ---------- */
export async function devis(params) {
  const { data, error } = await sb.rpc("tarif_devis", { p: params });
  if (error) throw error; return data;
}
export const CATS = { berline: "Berline", suv: "SUV", premium: "Berline Premium", van: "Van" };

/* ---------- lieux populaires (suggestions de recherche, sans supplément) ---------- */
export const POPULAIRES = [
  ["Aéroport Roissy-CDG · Terminal 1", "Roissy-en-France", 49.0141, 2.5418, "95700"],
  ["Aéroport Roissy-CDG · Terminal 2", "Roissy-en-France", 49.0040, 2.5707, "95700"],
  ["Aéroport Roissy-CDG · Terminal 3", "Roissy-en-France", 49.0127, 2.5617, "95700"],
  ["Aéroport d'Orly · Orly 1-2-3", "Paray-Vieille-Poste", 48.7297, 2.3602, "94390"],
  ["Aéroport d'Orly · Orly 4", "Paray-Vieille-Poste", 48.7290, 2.3699, "94390"],
  ["Aéroport de Beauvais-Tillé", "Tillé", 49.4543, 2.1117, "60000"],
  ["Gare du Nord", "Paris 10e", 48.8809, 2.3553, "75010"],
  ["Gare de Lyon", "Paris 12e", 48.8444, 2.3748, "75012"],
  ["Gare de l'Est", "Paris 10e", 48.8771, 2.3595, "75010"],
  ["Gare Montparnasse", "Paris 15e", 48.8401, 2.3191, "75015"],
  ["Gare Saint-Lazare", "Paris 8e", 48.8770, 2.3251, "75008"],
  ["Gare d'Austerlitz", "Paris 13e", 48.8418, 2.3661, "75013"],
  ["Gare Marne-la-Vallée – Chessy", "Chessy", 48.8699, 2.7822, "77700"],
  ["La Défense · Grande Arche", "Puteaux", 48.8922, 2.2369, "92800"],
  ["Château de Versailles", "Versailles", 48.8044, 2.1203, "78000"],
  ["Disneyland Paris", "Chessy", 48.8723, 2.7757, "77700"],
  ["Stade de France", "Saint-Denis", 48.9245, 2.3601, "93200"],
  ["Parc des expositions Paris-Nord Villepinte", "Villepinte", 48.9702, 2.5254, "93420"],
  ["Paris Expo Porte de Versailles", "Paris 15e", 48.8287, 2.2890, "75015"],
  ["Stade Roland-Garros", "Paris 16e", 48.8469, 2.2484, "75016"]
].map(([main, ville, lat, lng, cp]) => ({ main, sub: cp + " " + ville, label: main + ", " + cp + " " + ville, lat, lng, cp, pop: true }));
const norm = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function populaires(q) {
  const words = norm(q).split(/[^a-z0-9]+/).filter(w => w.length > 1);
  if (!words.length) return POPULAIRES.slice(0, 8);
  return POPULAIRES.filter(p => { const t = norm(p.label); return words.every(w => t.includes(w)); }).slice(0, 4);
}

/* ---------- adresses & itinéraires (services gratuits, sans clé) ---------- */
// Recherche d'adresses : Photon (OpenStreetMap)
export async function searchPlaces(q, near) {
  if (!q || q.trim().length < 3) return [];
  let url = "https://photon.komoot.io/api/?lang=fr&limit=6&q=" + encodeURIComponent(q.trim());
  if (near) url += "&lat=" + near.lat + "&lon=" + near.lng;
  const r = await fetch(url); if (!r.ok) throw new Error("search");
  const j = await r.json();
  return (j.features || []).filter(f => !f.properties.countrycode || ["FR", "BE", "CH", "LU", "MC"].includes(f.properties.countrycode)).map(placeFromFeature);
}
function placeFromFeature(f) {
  const p = f.properties, [lng, lat] = f.geometry.coordinates;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const main = p.name && p.name !== p.street ? p.name : (street || p.city || "Lieu");
  const sub = [p.name && street && p.name !== p.street ? street : "", [p.postcode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return { label: sub ? main + ", " + sub : main, main, sub, lat, lng, cp: p.postcode || "" };
}
export async function reverse(lat, lng) {
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lang=fr&lat=${lat}&lon=${lng}`);
    const j = await r.json(); if (j.features?.[0]) return placeFromFeature(j.features[0]);
  } catch { }
  return { label: "Ma position", main: "Ma position", sub: "", lat, lng };
}
// Itinéraire routier : OSRM
export async function route(a, b) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const r = await fetch(url); if (!r.ok) throw new Error("route");
  const j = await r.json(); const rt = j.routes?.[0]; if (!rt) throw new Error("route");
  return { km: Math.round(rt.distance / 100) / 10, min: Math.max(1, Math.round(rt.duration / 60)), geometry: rt.geometry };
}
export function getPosition(opts = {}) {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("Votre téléphone ne permet pas la localisation."));
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => rej(new Error(e.code === 1 ? "Localisation refusée. Autorisez-la dans les réglages de votre navigateur." : "Position introuvable pour le moment.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000, ...opts });
  });
}

/* ---------- carte (MapLibre + OpenFreeMap) ---------- */
export function createMap(el, center = [2.3522, 48.8566], zoom = 11) {
  const map = new maplibregl.Map({ container: el, style: "https://tiles.openfreemap.org/styles/positron", center, zoom, attributionControl: { compact: true } });
  map.touchZoomRotate.disableRotation();
  map.dragRotate.disable();
  return map;
}
export function markerEl(kind) {
  const el = document.createElement("div");
  el.className = "mk-" + kind;
  if (kind === "car") el.innerHTML = IC.carTop;
  return el;
}
export function setRouteLine(map, geometry) {
  const apply = () => {
    const data = geometry ? { type: "Feature", geometry } : { type: "FeatureCollection", features: [] };
    if (map.getSource("route")) { map.getSource("route").setData(data); return; }
    map.addSource("route", { type: "geojson", data });
    map.addLayer({ id: "route-casing", type: "line", source: "route", paint: { "line-color": "#ffffff", "line-width": 8 }, layout: { "line-cap": "round", "line-join": "round" } });
    map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#0d0d0c", "line-width": 4.5 }, layout: { "line-cap": "round", "line-join": "round" } });
  };
  if (map.isStyleLoaded()) apply(); else map.once("load", apply);
}
export function fitTo(map, points, pad = 60) {
  const pts = points.filter(Boolean);
  if (!pts.length) return;
  if (pts.length === 1) { map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 14 }); return; }
  const b = new maplibregl.LngLatBounds();
  pts.forEach(p => b.extend([p.lng, p.lat]));
  map.fitBounds(b, { padding: { top: pad, bottom: pad + 20, left: pad, right: pad }, maxZoom: 15, duration: 600 });
}

/* ---------- navigation ---------- */
export const wazeTo = p => p?.lat ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(p?.label || "")}&navigate=yes`;
export const appleTo = (a, b) => `https://maps.apple.com/?saddr=${a.lat},${a.lng}&daddr=${b.lat},${b.lng}`;
export const googleTo = (a, b) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}`;

export function notConfiguredScreen(root) {
  root.innerHTML = `<div class="panel stack" style="margin-top:20px"><h2>Presque prêt</h2><p>La configuration de la base de données manque dans <b>config.js</b>.</p></div>`;
}
