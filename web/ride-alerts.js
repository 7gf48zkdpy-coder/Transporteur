// Transporteur VTC — alertes quand une course est annulée ou que le chauffeur se désiste.
//  • Appli ouverte : grande alerte rouge animée (vibration + son) chez l'autre partie
//    (client qui annule → chauffeur ; chauffeur qui annule ou se désiste → client ; admin/système → les deux).
//  • Appli fermée : notification push (service worker sw.js, envoyée par la fonction ride-push).
//  • Au retour dans l'appli, une annulation non vue des 30 dernières minutes est aussi affichée.
import { sb, euro, esc } from "./core.js";

const page = /chauffeur/.test(location.pathname) ? "driver" : "client";
const FIELD = page === "driver" ? "driver_user_id" : "client_user_id";
const VAPID = "BK9Vru5GJeL59MrtCJOvfmKCBkoa4I0CbUdgV1gfBh92pIq4bypAAH_xbV1rIMp-XsuOV-hEuQtNGtsOhWJvwTE";
const REASON = { NO_SHOW: "Client absent", PAYMENT_TIMEOUT: "Paiement non effectué à temps" };
const short = (s) => String(s || "").split(",")[0].trim();

const css = document.createElement("style");
css.textContent = `
.ralert { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 24px;
  background: rgba(70, 0, 8, .62); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: raFade .25s ease-out; }
.ralert .box { width: 100%; max-width: 380px; text-align: center; padding: 28px 22px 20px; border-radius: 24px; color: #fff;
  background: linear-gradient(160deg, #e5303f, #9d0f1d); box-shadow: 0 20px 60px rgba(229, 48, 63, .55); animation: raShake .55s .15s both; }
.ralert .x { width: 76px; height: 76px; margin: 0 auto 14px; border-radius: 50%; background: rgba(255, 255, 255, .16); display: grid; place-items: center;
  position: relative; animation: raPop .4s cubic-bezier(.2, 1.6, .4, 1) both; }
.ralert .x::before, .ralert .x::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 3px solid rgba(255, 255, 255, .5); animation: raPulse 1.4s ease-out infinite; }
.ralert .x::after { animation-delay: .7s; }
.ralert .x svg { width: 38px; height: 38px; stroke: #fff; stroke-width: 3; fill: none; stroke-linecap: round; }
.ralert h2 { margin: 0 0 8px; font-size: 24px; }
.ralert p { margin: 0 0 6px; font-size: 15px; line-height: 1.45; color: rgba(255, 255, 255, .92); }
.ralert small { display: block; margin-top: 4px; font-size: 13px; color: rgba(255, 255, 255, .75); }
.ralert button { margin-top: 18px; width: 100%; padding: 15px; border: 0; border-radius: 14px; background: #fff; color: #b3131f; font: 800 16px/1 inherit; cursor: pointer; }
.ralert.out { animation: raFade .25s reverse both; }
@keyframes raFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes raPop { from { transform: scale(.3) } to { transform: scale(1) } }
@keyframes raPulse { from { transform: scale(.9); opacity: .9 } to { transform: scale(1.6); opacity: 0 } }
@keyframes raShake { 0%, 100% { transform: translateX(0) } 15%, 55% { transform: translateX(-10px) } 35%, 75% { transform: translateX(10px) } }
.pushbar { position: fixed; left: 12px; right: 12px; top: calc(env(safe-area-inset-top, 0px) + 64px); z-index: 900; display: flex; gap: 10px; align-items: center;
  padding: 12px 12px 12px 14px; border-radius: 16px; background: #0e1a36; border: 1px solid var(--line2, #2a3a63); box-shadow: 0 10px 30px rgba(0, 0, 0, .45); font-size: 13px; color: var(--text, #fff); }
.pushbar span { flex: 1; line-height: 1.35; }
.pushbar button { border: 0; border-radius: 10px; padding: 9px 12px; font: 700 13px/1 inherit; cursor: pointer; }
.pushbar .on { background: var(--blue, #1f7aff); color: #fff; }
.pushbar .no { background: transparent; color: var(--muted, #9aa); padding: 9px 6px; font-size: 18px; }`;
document.head.appendChild(css);

// ------------------------------------------------------------------ alerte animée
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, .28, .56].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.value = 660; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.18, ctx.currentTime + t + .02);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + t + .2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .22);
    });
  } catch { /* son indisponible */ }
}
function showAlert({ title, body, sub }, onClose) {
  document.querySelector(".ralert")?.remove();
  const el = document.createElement("div"); el.className = "ralert";
  el.innerHTML = `<div class="box"><div class="x"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></div>
    <h2>${esc(title)}</h2><p>${esc(body)}</p>${sub ? `<small>${esc(sub)}</small>` : ""}<button type="button">J'ai compris</button></div>`;
  document.body.appendChild(el);
  navigator.vibrate?.([300, 120, 300, 120, 500]);
  beep();
  el.querySelector("button").onclick = () => { el.classList.add("out"); setTimeout(() => { el.remove(); onClose?.(); }, 250); };
  // Appli en arrière-plan (onglet caché) : notification système en plus.
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body, tag: "ralert", renotify: true, icon: "icon-192.png", vibrate: [300, 120, 300] })).catch(() => {});
  }
}

function messageFor(b, kind) {
  if (kind === "RELEASED") return { title: "Votre chauffeur s'est désisté", body: "Pas d'inquiétude : nous cherchons un autre chauffeur pour vous.", sub: short(b.pickup_label) };
  const by = !b.cancelled_by ? "SYSTEM" : b.cancelled_by === b.client_user_id ? "CLIENT" : b.cancelled_by === b.driver_user_id ? "DRIVER" : "ADMIN";
  const reason = b.cancel_reason ? `Motif : ${REASON[b.cancel_reason] || b.cancel_reason}` : "";
  const fee = b.cancel_fee_cents ? `Frais d'annulation : ${euro(b.cancel_fee_cents)}` : "";
  if (page === "driver") {
    return { title: "Course annulée", body: by === "CLIENT" ? `Le client a annulé la course ${short(b.pickup_label)}.` : `La course ${short(b.pickup_label)} a été annulée${by === "ADMIN" ? " par l'administrateur" : ""}.`,
      sub: [reason, by === "CLIENT" && fee ? fee + " (dus par le client)" : ""].filter(Boolean).join(" · ") };
  }
  return { title: "Course annulée", body: by === "DRIVER" ? "Votre chauffeur a annulé la course." : by === "ADMIN" ? "Votre course a été annulée par Transporteur." : "Votre course a été annulée.",
    sub: [reason, fee].filter(Boolean).join(" · ") };
}

// ------------------------------------------------------------------ suivi des courses
let me = null, started = false;
const known = new Map();     // id → driver_user_id connu
const seen = (key) => { try { return localStorage.getItem("ralert:" + key); } catch { return null; } };
const markSeen = (key) => { try { localStorage.setItem("ralert:" + key, Date.now()); } catch { /* */ } };

function handle(b) {
  const prevDriver = known.get(b.id);
  known.set(b.id, b.driver_user_id || null);
  let kind = null;
  if (b.status === "CANCELLED" && b.cancelled_by !== me && Date.now() - new Date(b.cancelled_at || 0) < 30 * 60e3) kind = "CANCELLED";
  else if (page === "client" && ["REQUESTED", "OFFERED"].includes(b.status) && !b.driver_user_id && prevDriver) kind = "RELEASED";
  if (!kind) return;
  const key = `${b.id}:${kind}:${kind === "RELEASED" ? prevDriver : ""}`;
  if (seen(key)) return;
  markSeen(key);
  showAlert(messageFor(b, kind), () => { if (document.getElementById("tPanel") || document.getElementById("navPanel")) location.reload(); });
}

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user || started) return;
  started = true; me = session.user.id;
  const { data } = await sb.from("bookings").select("*").eq(FIELD, me).order("created_at", { ascending: false }).limit(15);
  (data || []).forEach((b) => {
    known.set(b.id, b.driver_user_id || null);
    // Annulée pendant que l'appli était fermée (30 dernières minutes) et pas encore vue.
    if (b.status === "CANCELLED") handle(b);
  });
  sb.channel("ralert-" + me)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `${FIELD}=eq.${me}` }, (p) => handle(p.new))
    .subscribe();
  // Filet de sécurité si le temps réel décroche : on revérifie mes courses en cours toutes les 20 s.
  setInterval(async () => {
    const ids = [...known.keys()].slice(-15);
    if (!ids.length || document.hidden) return;
    const { data: rows } = await sb.from("bookings").select("*").in("id", ids).in("status", ["CANCELLED", "REQUESTED", "OFFERED"]);
    (rows || []).forEach(handle);
  }, 20000);
  setupPush();
}

// ------------------------------------------------------------------ notifications push
const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let subscribed = false;
async function ensurePush() {
  if (subscribed || !("serviceWorker" in navigator) || !("PushManager" in window) || Notification.permission !== "granted" || !me) return;
  subscribed = true;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID) }));
    await sb.from("push_subscriptions").upsert({ endpoint: sub.endpoint, user_id: me, p256dh: toB64(sub.getKey("p256dh")), auth: toB64(sub.getKey("auth")), app: page });
  } catch { subscribed = false; }
}
function setupPush() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  ensurePush();
  setInterval(ensurePush, 5000);   // ex. après activation des notifications dans les réglages chauffeur
  let later = 0; try { later = +localStorage.getItem("pushbarLater") || 0; } catch { /* */ }
  if (Notification.permission !== "default" || Date.now() - later < 3 * 864e5) return;
  const bar = document.createElement("div"); bar.className = "pushbar";
  bar.innerHTML = `<span>🔔 Activez les notifications pour être prévenu${page === "driver" ? " si un client annule" : " si votre course est annulée"}, même appli fermée.</span>
    <button class="on" type="button">Activer</button><button class="no" type="button" aria-label="Plus tard">×</button>`;
  bar.querySelector(".on").onclick = async () => { bar.remove(); if ((await Notification.requestPermission()) === "granted") ensurePush(); };
  bar.querySelector(".no").onclick = () => { bar.remove(); try { localStorage.setItem("pushbarLater", Date.now()); } catch { /* */ } };
  setTimeout(() => document.body.appendChild(bar), 2500);
}

sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN") start(); });
start();
