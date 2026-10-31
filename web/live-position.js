// Transporteur VTC — espace chauffeur : position envoyée toutes les 4 s quand le chauffeur est en ligne,
// pour que les clients voient la voiture bouger en temps réel sur leur carte (l'appli de base l'envoie toutes les 10 s).
import { sb } from "./core.js";

const EVERY_MS = 4000;
let me = null, online = false, lastSent = 0, last = null;

async function checkOnline() {
  if (!me) { const { data: { session } } = await sb.auth.getSession(); me = session?.user?.id || null; }
  if (!me) { online = false; return; }
  const { data } = await sb.from("drivers").select("partner_status, is_available").eq("user_id", me).maybeSingle();
  online = !!data && data.partner_status === "VALIDATED" && data.is_available;
}

async function send(c) {
  if (!online || !me || Date.now() - lastSent < EVERY_MS) return;
  if (last && Math.abs(last.lat - c.latitude) < 1e-5 && Math.abs(last.lng - c.longitude) < 1e-5 && Date.now() - lastSent < 30000) return;   // immobile
  lastSent = Date.now(); last = { lat: c.latitude, lng: c.longitude };
  await sb.from("driver_locations").upsert({ driver_user_id: me, lat: c.latitude, lng: c.longitude,
    heading: Number.isFinite(c.heading) ? c.heading : null, speed_kmh: Number.isFinite(c.speed) ? c.speed * 3.6 : null }, { onConflict: "driver_user_id" });
}

if (navigator.geolocation) {
  checkOnline();
  setInterval(checkOnline, 20000);
  document.addEventListener("change", (e) => { if (e.target?.matches?.('input[type="checkbox"]')) setTimeout(checkOnline, 800); }, true);
  navigator.geolocation.watchPosition((pos) => { send(pos.coords).catch(() => {}); }, () => {}, { enableHighAccuracy: true, maximumAge: 2000 });
}
