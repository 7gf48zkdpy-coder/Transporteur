// Transporteur VTC — affiche le vrai mode de paiement d'une course (« Espèces » ou « Carte »)
// à la place du libellé générique « Carte ou espèces », partout : suivi, fin de course, historique, demandes, admin.
// Course terminée : « Payé en espèces » / « Payé par carte » au lieu de « À régler au chauffeur » / « Encaissé à bord ».
import { sb, lang } from "./core.js";

const EN = lang === "en";
const L = {
  CASH: EN ? "Cash" : "Espèces", CARD: EN ? "Card" : "Carte",
  paidCASH: EN ? "Paid in cash" : "Payé en espèces", paidCARD: EN ? "Paid by card" : "Payé par carte",
  dueCASH: EN ? "Pay the driver in cash" : "À régler en espèces", dueCARD: EN ? "Pay the driver by card" : "À régler par carte",
};
const GENERIC = ["Carte ou espèces", "Card or cash"];
const DONE = ["À régler au chauffeur", "Pay the driver", "Encaissé à bord", "Collected on board"];
const page = /chauffeur/.test(location.pathname) ? "driver" : /admin/.test(location.pathname) ? "admin" : "client";

const cache = new Map();           // id → { onboard_method, payment_method, status }
let mine = null, mineAt = 0;       // mes courses (les plus récentes d'abord)
let lastClicked = null;
document.addEventListener("click", (e) => {
  const el = e.target.closest?.("[data-b],[data-ride],[data-req]");
  if (el) lastClicked = el.dataset.b || el.dataset.ride || el.dataset.req;
}, true);

async function uid() { const { data: { session } } = await sb.auth.getSession(); return session?.user?.id || null; }
async function loadMine(force) {
  if (!force && mine && Date.now() - mineAt < 8000) return mine;
  const id = await uid(); if (!id) return (mine = []);
  const field = page === "driver" ? "driver_user_id" : "client_user_id";
  const { data } = await sb.from("bookings").select("id, onboard_method, payment_method, status, created_at").eq(field, id)
    .order("created_at", { ascending: false }).limit(30);
  mine = data || []; mineAt = Date.now();
  mine.forEach((b) => cache.set(b.id, b));
  return mine;
}
async function load(ids) {
  const miss = [...new Set(ids)].filter((i) => i && !cache.has(i));
  if (!miss.length) return;
  const { data } = await sb.from("bookings").select("id, onboard_method, payment_method, status").in("id", miss);
  (data || []).forEach((b) => cache.set(b.id, b));
}

// Quelle course concerne ce texte ?
function idFor(node, rows) {
  const el = node.parentElement;
  const tagged = el.closest("[data-b],[data-ride]");
  if (tagged) return tagged.dataset.b || tagged.dataset.ride;
  const req = el.closest(".reqcard")?.querySelector("[data-req]");
  if (req) return req.dataset.req;
  if (el.closest("#overlay .sheet") && lastClicked && !el.closest(".done")) return lastClicked;
  const row = el.closest("#app .list-row");
  if (row && rows) { const i = rows.indexOf(row); if (i >= 0 && mine?.[i]) return mine[i].id; }
  return mine?.[0]?.id || null;      // suivi en cours / fin de course : ma course la plus récente
}

let busy = false, again = false;
async function run() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const s = n.nodeValue;
      if (s && (GENERIC.some((g) => s.includes(g)) || DONE.some((g) => s.trim() === g))) nodes.push(n);
    }
    if (!nodes.length) return;
    if (page !== "admin") await loadMine(nodes.some((n) => !n.parentElement.closest("[data-b],[data-ride],.reqcard")));
    const rows = page === "client" ? [...document.querySelectorAll("#app .list-row")] : null;
    const ids = nodes.map((n) => idFor(n, rows));
    await load(ids);
    nodes.forEach((n, i) => {
      const b = cache.get(ids[i]);
      if (!b || b.payment_method !== "ON_BOARD" || !L[b.onboard_method] || !n.isConnected) return;
      const m = b.onboard_method;
      if (DONE.some((g) => n.nodeValue.trim() === g)) {
        n.nodeValue = b.status === "COMPLETED" || /Encaissé|Collected/.test(n.nodeValue) ? L["paid" + m] : L["due" + m];
      } else {
        GENERIC.forEach((g) => { n.nodeValue = n.nodeValue.replace(g, L[m]); });
      }
    });
  } catch { /* hors ligne : on garde le libellé d'origine */ }
  finally { busy = false; if (again) { again = false; setTimeout(run, 50); } }
}

// Paiement en ligne (Stripe) retiré pour l'instant : on masque la ligne « Paiements par carte » (versements Stripe).
function hideStripe() {
  document.querySelectorAll(".kv > span:first-child").forEach((s) => {
    if (["Paiements par carte", "Card payments"].includes(s.textContent.trim())) s.parentElement.style.display = "none";
  });
}

let timer = 0;
new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => { hideStripe(); run(); }, 60); })
  .observe(document.body, { childList: true, subtree: true, characterData: true });
