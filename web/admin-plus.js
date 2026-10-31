// Transporteur VTC — admin : suppression d'une course depuis sa fiche.
import { sb, $, toast, errText, icon } from "./core.js";

const MSG = {
  BOOKING_RUNNING: "Course en cours : annulez-la d'abord, puis supprimez-la.",
  PAYMENT_HELD: "Le paiement par carte est encore bloqué : annulez la course d'abord (le client est remboursé), puis supprimez-la.",
  BOOKING_NOT_FOUND: "Course introuvable (déjà supprimée ?).",
  FORBIDDEN: "Réservé à l'administrateur.",
};

let lastRide = null;
document.addEventListener("click", (e) => { const c = e.target.closest?.("[data-ride]"); if (c) lastRide = c.dataset.ride; }, true);

function addButton(sheet) {
  if (!lastRide || sheet.querySelector("#rDelete")) return;
  const h = sheet.querySelector(".sheet-head h1");
  if (!h || h.textContent.trim() !== "Course") return;
  const id = lastRide;
  const btn = document.createElement("button");
  btn.id = "rDelete"; btn.className = "btn secondary"; btn.style.color = "var(--bad)"; btn.style.marginTop = "10px";
  btn.innerHTML = `${icon("x")} Supprimer la course`;
  btn.onclick = async () => {
    if (!confirm("Supprimer définitivement cette course ? Elle disparaîtra pour le client, le chauffeur et l'historique.")) return;
    btn.disabled = true;
    const { error } = await sb.rpc("admin_delete_booking", { p_booking_id: id });
    if (error) {
      btn.disabled = false;
      const code = Object.keys(MSG).find((k) => String(error.message || "").includes(k));
      toast(code ? MSG[code] : await errText(error), true);
      return;
    }
    toast("Course supprimée");
    $("#overlay").innerHTML = "";
    document.querySelector(`[data-ride="${id}"]`)?.remove();
    setTimeout(() => location.reload(), 600);
  };
  (sheet.querySelector(".inner") || sheet).appendChild(btn);
  addRideInfo(sheet, id);
}

const num = (x) => String(Math.round(Number(x || 0) * 10) / 10).replace(".", ",");
const hm = (d) => new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
// Motif d'annulation, désistements des chauffeurs, attente et mode de paiement à bord.
async function addRideInfo(sheet, id) {
  const [{ data: b }, { data: logs }] = await Promise.all([
    sb.from("bookings").select("status, cancel_reason, cancelled_by, client_user_id, onboard_method, payment_method, arrived_at, wait_fee_cents, prepaid_at, approach_km, departed_at, cancel_info, cancel_fee_cents, cancelled_at").eq("id", id).maybeSingle(),
    sb.from("audit_log").select("action, data, created_at, actor_user_id").eq("entity_id", id).eq("action", "DRIVER_RELEASED").order("created_at"),
  ]);
  if (!b || !sheet.isConnected || sheet.querySelector("#rInfo")) return;
  const rows = [];
  if (b.payment_method === "ON_BOARD") rows.push(["Paiement à bord", b.onboard_method === "CARD" ? `Carte${b.prepaid_at ? " · reçu le " + new Date(b.prepaid_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : ""}` : "Espèces"]);
  if (b.approach_km != null) rows.push(["Chauffeur → client à l'acceptation", `${num(b.approach_km)} km${b.onboard_method === "CARD" ? (b.approach_km > 8 ? " · paiement avant départ" : " · paiement à l'arrivée") : ""}`]);
  if (b.departed_at) rows.push(["Chauffeur parti", hm(b.departed_at)]);
  if (b.arrived_at) rows.push(["Chauffeur arrivé", new Date(b.arrived_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })]);
  if (b.wait_fee_cents) rows.push(["Supplément d'attente", (b.wait_fee_cents / 100).toFixed(2).replace(".", ",") + " €"]);
  if (b.status === "CANCELLED") rows.push(["Annulée par", b.cancelled_by === b.client_user_id ? "le client" : b.cancelled_by ? "le chauffeur / l'admin" : "le système"],
    ["Motif", b.cancel_reason === "NO_SHOW" ? "Client absent" : b.cancel_reason === "PAYMENT_TIMEOUT" ? "Paiement non effectué à temps" : b.cancel_reason || "Non précisé"]);
  const ci = b.cancel_info;
  if (b.status === "CANCELLED" && ci) {
    rows.push(["Au moment de l'annulation", ci.status === "DRIVER_ARRIVING"
      ? `chauffeur ${ci.driver_arrived ? "arrivé" : "en route"} depuis ${num(ci.driver_minutes)} min · ${num(ci.driver_km)} km parcourus`
      : ci.status === "ACCEPTED" ? "chauffeur pas encore parti" : "aucun chauffeur en route"]);
    rows.push(["Frais d'annulation", b.cancel_fee_cents ? `${(b.cancel_fee_cents / 100).toFixed(2).replace(".", ",")} € · éligible` : "0 € · annulation gratuite"]);
  }
  (logs || []).forEach((l) => rows.push(["Désistement chauffeur", `${new Date(l.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${l.data?.reason || "sans motif"}`]));
  if (!rows.length) return;
  const card = document.createElement("div"); card.className = "card"; card.id = "rInfo";
  card.innerHTML = rows.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))}</span></div>`).join("");
  const del = sheet.querySelector("#rDelete");
  del ? del.before(card) : (sheet.querySelector(".inner") || sheet).appendChild(card);
}

new MutationObserver(() => { const o = $("#overlay"); if (!o) return; if (o.children.length) addButton(o); else lastRide = null; })
  .observe(document.getElementById("overlay") || document.body, { childList: true, subtree: true });

// ------------------------------------------------------------------ Revtag Revolut dans « Mon entreprise »
// Les clients qui paient « Carte ou espèces » voient un bouton « Payer avec Revolut » qui ouvre revolut.me/<Revtag>.
async function addRevtag(form) {
  if (form.querySelector("[name=revtag]")) return;
  const submit = form.querySelector("button[type=submit]");
  const wrap = document.createElement("div");
  wrap.innerHTML = `<label>Revtag Revolut (paiement des clients)</label><input name="revtag" placeholder="@montag" autocomplete="off">
    <p class="muted" style="font-size:13px;margin:6px 0 0">Visibilité du Revtag à activer dans l'appli Revolut. Laissez vide pour masquer le bouton « Payer avec Revolut ».</p>`;
  submit.before(...wrap.childNodes);
  const { data } = await sb.from("app_settings").select("doc").eq("id", 1).maybeSingle();
  form.querySelector("[name=revtag]").value = data?.doc?.revtag || "";
}
new MutationObserver(() => { const f = document.getElementById("coForm"); if (f) addRevtag(f); })
  .observe(document.getElementById("overlay") || document.body, { childList: true, subtree: true });
