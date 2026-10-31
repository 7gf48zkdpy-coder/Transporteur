// Transporteur VTC — motifs d'annulation et attente chez le client.
//  • Annulation (client) et « Arrêter » (chauffeur) : on demande le motif, visible ensuite dans l'admin.
//  • Le chauffeur appuie sur « Je suis arrivé » : compteur d'attente des deux côtés, 6 minutes offertes,
//    puis 0,50 € par minute commencée (calcul identique côté base : fonction wait_fee). « Client absent » après 6 min.
//  • Client : avant d'annuler, il voit si c'est gratuit ou les frais (selon le temps et les km du chauffeur).
//  • Appli client : le champ « Note pour le chauffeur » est retiré du formulaire.
import { sb, euro, esc, toast, busy, call } from "./core.js";

export const FREE_MIN = 6, PER_MIN_CENTS = 50;
export const waitFee = (arrivedAt, until = Date.now()) =>
  arrivedAt ? Math.max(0, Math.ceil((until - new Date(arrivedAt)) / 60000) - FREE_MIN) * PER_MIN_CENTS : 0;

const isDriverApp = /chauffeur/.test(location.pathname);
const css = document.createElement("style");
css.textContent = `
label:has(+ #notes), #notes { display: none !important; }
.waitbox { margin: 12px 0 4px; padding: 14px; border-radius: 16px; background: #0e1a36; border: 1px solid var(--line2); display: flex; align-items: center; gap: 14px; }
.waitbox .clock { font: 700 30px/1 ui-monospace, Menlo, monospace; letter-spacing: .02em; min-width: 96px; text-align: center; padding: 10px 6px; border-radius: 12px; background: var(--bg2); }
.waitbox.over .clock { color: var(--warn); }
.waitbox .txt { flex: 1; font-size: 13px; color: var(--muted); line-height: 1.4; }
.waitbox .txt strong { display: block; color: var(--text); font-size: 15px; margin-bottom: 2px; }
.waitbox .txt b { color: var(--warn); }
.cfee { margin: 10px 0; padding: 12px 14px; border-radius: 12px; background: rgba(245, 158, 11, .12); border: 1px solid rgba(245, 158, 11, .4); font-size: 13px; color: var(--muted); line-height: 1.4; }
.cfee strong { display: block; color: var(--warn); font-size: 15px; margin-bottom: 2px; }
.cfee.free { background: rgba(52, 211, 153, .1); border-color: rgba(52, 211, 153, .35); }
.cfee.free strong { color: var(--ok); }
.reasons { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
.reasons button { text-align: left; padding: 13px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--card2); color: var(--text); font: inherit; cursor: pointer; }
.reasons button.on { border-color: var(--blue); background: rgba(31, 122, 255, .15); }`;
document.head.appendChild(css);

async function uid() { const { data: { session } } = await sb.auth.getSession(); return session?.user?.id || null; }
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const busyEls = new WeakSet();
async function once(el, fn) { if (busyEls.has(el)) return; busyEls.add(el); try { await fn(); } finally { busyEls.delete(el); } }

// ------------------------------------------------------------------ fenêtre « motif »
function askReason(title, reasons, confirmLabel, note = "") {
  return new Promise((done) => {
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = `<div><h2 style="margin-top:0">${esc(title)}</h2>${note}<p class="muted" style="margin:0">Choisissez un motif :</p>
      <div class="reasons">${reasons.map((r) => `<button type="button">${esc(r)}</button>`).join("")}</div>
      <textarea id="rsOther" rows="2" placeholder="Précisez (facultatif)" style="display:none"></textarea>
      <button class="btn danger" id="rsOk" disabled>${esc(confirmLabel)}</button><button class="btn secondary" id="rsBack">Retour</button></div>`;
    document.body.appendChild(m);
    let pick = null;
    const other = m.querySelector("#rsOther"), ok = m.querySelector("#rsOk");
    m.querySelectorAll(".reasons button").forEach((b) => b.onclick = () => {
      pick = b.textContent; m.querySelectorAll(".reasons button").forEach((x) => x.classList.toggle("on", x === b));
      other.style.display = pick === "Autre" ? "" : "none"; ok.disabled = false;
    });
    const close = (v) => { m.remove(); done(v); };
    m.querySelector("#rsBack").onclick = () => close(null);
    m.onclick = (e) => { if (e.target === m) close(null); };
    ok.onclick = () => close(pick === "Autre" ? `Autre${other.value.trim() ? " : " + other.value.trim() : ""}` : pick);
  });
}
const CLIENT_REASONS = ["Le chauffeur met trop de temps", "J'ai changé d'avis", "Erreur d'adresse ou d'horaire", "Le prix est trop élevé", "J'ai trouvé un autre moyen de transport", "Autre"];
const DRIVER_REASONS = ["Client injoignable", "Problème avec le véhicule", "Trop loin / trop de trafic", "Urgence personnelle", "Adresse de prise en charge introuvable", "Autre"];

async function activeBooking(field) {
  const id = await uid(); if (!id) return null;
  const { data } = await sb.from("bookings").select("*").eq(field, id).in("status", ["REQUESTED", "ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"])
    .order("created_at", { ascending: false }).limit(1);
  return data?.[0] || null;
}

document.addEventListener("click", async (e) => {
  const clientCancel = !isDriverApp && e.target.closest?.("#cancelBtn");
  const driverStop = isDriverApp && e.target.closest?.("#stopBtn");
  if (!clientCancel && !driverStop) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  const b = await activeBooking(clientCancel ? "client_user_id" : "driver_user_id"); if (!b) return;
  if (clientCancel) {
    const { data: t } = await sb.rpc("cancel_preview", { p_booking_id: b.id });
    const reason = await askReason("Annuler la course ?", CLIENT_REASONS, t?.fee_cents ? `Annuler (frais ${euro(t.fee_cents)})` : "Annuler la course", feeNote(t)); if (!reason) return;
    busy(null, async () => { await call("booking-cancel", { bookingId: b.id, action: "cancel", reason }); toast("Course annulée"); setTimeout(() => location.reload(), 600); });
  } else {
    const reason = await askReason("Arrêter cette course ?", DRIVER_REASONS, "Arrêter la course"); if (!reason) return;
    busy(null, async () => { await call("booking-cancel", { bookingId: b.id, action: "release", reason }); toast("Course proposée à un autre chauffeur"); setTimeout(() => location.reload(), 600); });
  }
}, true);

// Frais d'annulation (calculés par la base : cancel_terms_for) — gratuits tant que le chauffeur
// roule depuis moins de 3 min et a fait moins de 2 km, sinon 1 € / km parcouru, entre 5 € et 8 €.
const num = (x) => String(Math.round(Number(x || 0) * 10) / 10).replace(".", ",");
function feeNote(t) {
  if (!t) return "";
  if (!t.fee_cents) return `<div class="cfee free"><strong>Annulation gratuite</strong>${t.status === "DRIVER_ARRIVING" ? `Votre chauffeur vient de partir (${num(t.driver_minutes)} min).` : "Votre chauffeur n'est pas encore parti."}</div>`;
  return `<div class="cfee"><strong>Frais d'annulation : ${euro(t.fee_cents)}</strong>Votre chauffeur ${t.driver_arrived ? "est déjà arrivé" : "roule vers vous"} depuis ${num(t.driver_minutes)} min (${num(t.driver_km)} km). 1 € par km parcouru, 5 € minimum, 8 € maximum.</div>`;
}

// ------------------------------------------------------------------ compteur d'attente
function waitBox(b, who) {
  const box = document.createElement("div"); box.className = "waitbox"; box.dataset.wait = "1";
  const draw = () => {
    if (!box.isConnected && box._started) return clearInterval(box._t);
    box._started = true;
    const ms = Date.now() - new Date(b.arrived_at), fee = waitFee(b.arrived_at), left = FREE_MIN * 60000 - ms;
    box.classList.toggle("over", left <= 0);
    box.innerHTML = `<div class="clock">${mmss(ms)}</div><div class="txt">
      <strong>${who === "client" ? "Votre chauffeur est arrivé" : "Attente du client"}</strong>
      ${left > 0 ? `Attente offerte encore ${mmss(left)}, puis ${euro(PER_MIN_CENTS)} / min.`
        : `Attente payante : <b>+${euro(fee)}</b> (${euro(PER_MIN_CENTS)} / min après ${FREE_MIN} min).`}</div>`;
    if (who === "driver") {
      const ns = document.getElementById("navNoShow");
      if (ns) { ns.disabled = left > 0; ns.textContent = left > 0 ? `Client absent (dans ${mmss(left)})` : "Client absent"; }
    }
  };
  draw(); box._t = setInterval(draw, 1000);
  return box;
}

async function driverPanel(panel) {
  if (panel.querySelector("[data-wait-done]")) return;
  await once(panel, async () => {
    const b = await activeBooking("driver_user_id");
    if (!b || !panel.isConnected || panel.querySelector("[data-wait-done]")) return;
    const slot = panel.querySelector("#slideSlot");
    const mark = document.createElement("div"); mark.dataset.waitDone = "1";
    if (!["ACCEPTED", "DRIVER_ARRIVING"].includes(b.status)) { slot?.before(mark); return; }
    if (b.arrived_at) { mark.appendChild(waitBox(b, "driver")); slot?.before(mark); return; }
    const btn = document.createElement("button"); btn.className = "btn secondary"; btn.type = "button"; btn.textContent = "Je suis arrivé chez le client"; btn.dataset.arrive = "1";
    // Carte + client à plus de 8 km : pas de départ ni d'arrivée tant que le client n'a pas payé.
    if (b.status === "ACCEPTED" && b.payment_method === "ON_BOARD" && b.onboard_method === "CARD" && !b.prepaid_at && Number(b.approach_km || 0) > 8) btn.style.display = "none";
    btn.onclick = () => busy(btn, async () => {
      const { data, error } = await sb.rpc("driver_arrived", { p_booking_id: b.id });
      if (error) throw error;
      mark.innerHTML = ""; mark.appendChild(waitBox(data, "driver"));
    });
    mark.appendChild(btn); slot?.before(mark);
    const ns = document.getElementById("navNoShow"); if (ns) { ns.disabled = true; ns.textContent = "Client absent (après l'arrivée)"; }
  });
}

let toldArrived = false;
async function clientPanel(panel) {
  if (panel.querySelector("[data-wait-done]")) return;
  await once(panel, async () => {
    const b = await activeBooking("client_user_id");
    if (!b || !panel.isConnected || panel.querySelector("[data-wait-done]")) return;
    const mark = document.createElement("div"); mark.dataset.waitDone = "1";
    const eta = panel.querySelector(".eta");
    if (b.status === "DRIVER_ARRIVING" && b.arrived_at) {
      mark.appendChild(waitBox(b, "client"));
      if (!toldArrived) { toldArrived = true; toast("Votre chauffeur est arrivé"); navigator.vibrate?.([150, 80, 150]); }
    }
    eta ? eta.after(mark) : panel.prepend(mark);
  });
}

new MutationObserver(() => {
  if (isDriverApp) { const n = document.getElementById("navPanel"); if (n && n.querySelector("#slideSlot")) driverPanel(n); }
  else { const p = document.getElementById("tPanel"); if (p && p.querySelector(".eta")) clientPanel(p); }
}).observe(document.body, { childList: true, subtree: true });
