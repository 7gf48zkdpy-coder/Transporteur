// Transporteur VTC — paiement « Espèces ou Carte ».
//  • Client : choisit Espèces ou Carte en réservant. Carte = il paie le chauffeur avant que la course démarre
//    (lien Revolut du chauffeur avec le montant pré-rempli, ou virement instantané sur son RIB) :
//    à l'arrivée du chauffeur si celui-ci était à 8 km ou moins, sinon avant que le chauffeur parte vers lui.
//    Format du lien Revolut repris de l'ancienne appli (vérifié) : revolut.me/<Revtag>?currency=EUR&amount=<centimes>.
//  • Chauffeur : renseigne son Revtag / RIB dans « Mon profil » ; pour une course par carte, il appuie sur
//    « J'ai reçu le paiement » après avoir vérifié son compte. La course ne peut pas démarrer avant (bloqué aussi côté base).
import { sb, euro, esc, toast, busy } from "./core.js";
import { waitFee } from "./ride-extras.js";

const isDriverApp = /chauffeur/.test(location.pathname);
const RUNNING = ["ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"];

const css = document.createElement("style");
css.textContent = `
.prepay { margin: 12px 0 4px; padding: 14px; border-radius: 16px; background: #0e1a36; border: 1px solid var(--line2); }
.prepay h3 { margin: 0 0 4px; font-size: 16px; display: flex; justify-content: space-between; gap: 8px; }
.prepay p { margin: 0 0 10px; color: var(--muted); font-size: 13px; line-height: 1.4; }
.prepay .btn { margin-top: 8px; }
.prepay .rib { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: var(--bg2); border: 1px solid var(--line); font-size: 13px; }
.prepay .rib b { display: block; font-family: ui-monospace, Menlo, monospace; font-size: 15px; letter-spacing: .03em; margin-top: 2px; word-break: break-all; }
.prepay .rib button { margin-top: 8px; width: auto; padding: 8px 12px; font-size: 13px; }
.prepay.ok { background: rgba(52, 211, 153, .1); border-color: rgba(52, 211, 153, .35); }
.prepay.ok h3 { color: var(--ok); }
.prepay.wait h3 small { color: var(--warn); font-weight: 600; font-size: 12px; }`;
document.head.appendChild(css);

const copy = (text, label) => navigator.clipboard?.writeText(text).then(() => toast(`${label} copié`)).catch(() => {});
// Montant dû : prix de la course + supplément d'attente (figé quand le paiement est confirmé).
// Client à plus de 8 km du chauffeur au moment de l'acceptation → paiement avant le départ du chauffeur ;
// sinon paiement à l'arrivée du chauffeur chez le client (même règle côté base : card_pay_before_departure).
export const PREPAY_KM = 8;
const farAway = (b) => Number(b.approach_km || 0) > PREPAY_KM;
const fare = (b) => b.status === "COMPLETED" ? (b.final_fare_cents ?? b.quoted_fare_cents)
  : b.quoted_fare_cents + (b.prepaid_at ? (b.wait_fee_cents || 0) : waitFee(b.arrived_at));
const busyEls = new WeakSet();
async function once(el, fn) { if (busyEls.has(el)) return; busyEls.add(el); try { await fn(); } finally { busyEls.delete(el); } }

async function me() { const { data: { session } } = await sb.auth.getSession(); return session?.user?.id || null; }

// ================================================================== APPLI CLIENT
let choice = "CASH";
try { choice = sessionStorage.getItem("payChoice") || "CASH"; } catch { /* indisponible */ }
const HINT = { CASH: "Vous réglez le chauffeur en espèces à la fin de la course.",
  CARD: "Vous payez le chauffeur par carte (lien Revolut ou virement instantané) à son arrivée, ou avant qu'il parte s'il est loin. La course démarre dès qu'il a reçu le paiement." };

function enhancePaySeg(seg) {
  if (seg.dataset.pay) return;
  seg.dataset.pay = "1";
  seg.innerHTML = `<button type="button" data-m="CASH">Espèces</button><button type="button" data-m="CARD">Carte</button>`;
  const draw = () => {
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.m === choice));
    const h = document.getElementById("payHint"); if (h) h.textContent = HINT[choice];
  };
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    e.stopImmediatePropagation();                           // garde le paiement « à bord » de l'appli
    choice = b.dataset.m; try { sessionStorage.setItem("payChoice", choice); sessionStorage.setItem("payChoiceAt", Date.now()); } catch { /* */ }
    draw();
  }, true);
  draw();
}

async function enhanceClientPanel(panel) {
  if (panel.querySelector(".prepay, [data-pay-done]")) return;
  await once(panel, async () => {
    const uid = await me(); if (!uid) return;
    const { data } = await sb.from("bookings").select("*").eq("client_user_id", uid).in("status", ["REQUESTED", ...RUNNING])
      .order("created_at", { ascending: false }).limit(1);
    const b = data?.[0]; if (!b || b.payment_method !== "ON_BOARD" || !panel.isConnected) return;
    // Choix fait au moment de réserver → enregistré sur la course qui vient d'être créée.
    let at = 0; try { at = +sessionStorage.getItem("payChoiceAt") || 0; } catch { /* */ }
    if (at && new Date(b.created_at) > at - 60e3 && b.onboard_method !== choice && !b.prepaid_at && b.status !== "IN_PROGRESS") {
      const { error } = await sb.rpc("set_onboard_method", { p_booking_id: b.id, p_method: choice });
      if (!error) b.onboard_method = choice;
    }
    try { sessionStorage.removeItem("payChoiceAt"); } catch { /* */ }
    // Libellé du paiement
    panel.querySelectorAll(".kv span").forEach((s) => { if (s.textContent.includes("Carte ou espèces")) s.textContent = s.textContent.replace("Carte ou espèces", b.onboard_method === "CARD" ? "Carte" : "Espèces"); });
    const anchor = [...panel.querySelectorAll(".kv")].pop();
    const box = document.createElement("div");
    box.dataset.payDone = "1";
    if (b.onboard_method !== "CARD" || !b.driver_user_id || b.status === "REQUESTED") { anchor?.after(box); return; }
    if (b.prepaid_at) {
      box.className = "prepay ok";
      box.innerHTML = `<h3>✓ Paiement reçu par le chauffeur <span>${euro(fare(b))}</span></h3><p>Merci ! Bon trajet.</p>`;
      anchor?.after(box); return;
    }
    const far = farAway(b), km = b.approach_km != null ? `${String(b.approach_km).replace(".", ",")} km` : "";
    if (!far && !b.arrived_at) {   // client proche : on paie quand le chauffeur arrive
      box.className = "prepay later";
      box.innerHTML = `<h3>Paiement par carte <small>${euro(fare(b))}</small></h3>
        <p>Vous paierez à l'arrivée du chauffeur (Revolut ou virement instantané). Rien à faire pour l'instant.</p>`;
      anchor?.after(box); return;
    }
    const { data: info } = await sb.rpc("booking_payment_info", { p_booking_id: b.id });
    if (!panel.isConnected || panel.querySelector(".prepay")) return;
    const amount = (fare(b) / 100).toFixed(2).replace(".", ",");
    const early = far && b.status === "ACCEPTED";
    box.className = "prepay wait";
    box.innerHTML = `<h3>${early ? "Payez pour que le chauffeur parte" : "Payez maintenant"} <small>${euro(fare(b))}</small></h3>
      <p>${early ? `Votre chauffeur est à ${km || "plus de 8 km"} : il part vers vous dès qu'il a reçu votre paiement.`
        : far ? "Votre chauffeur attend la confirmation de votre paiement." : "Votre chauffeur est arrivé : la course démarre dès qu'il a reçu votre paiement."}</p>
      ${info?.revtag ? `<a class="btn" style="background:#fff;color:#0b0b0b;box-shadow:none;font-weight:800" target="_blank" rel="noopener"
          href="https://revolut.me/${encodeURIComponent(String(info.revtag).replace(/^@/, ""))}?currency=EUR&amount=${fare(b)}" data-amt="${amount}">Payer avec Revolut · ${euro(fare(b))}</a>` : ""}
      ${info?.iban ? `<div class="rib">Virement instantané à <strong>${esc(info.holder || "")}</strong><b>${esc(info.iban)}</b>
          <button class="btn secondary" type="button" data-iban>Copier l'IBAN</button></div>` : ""}
      ${!info?.revtag && !info?.iban ? `<p>Le chauffeur vous indiquera comment payer (Revolut, virement…). Vous pouvez lui écrire avec le bouton message.</p>` : ""}`;
    box.querySelector("[data-amt]")?.addEventListener("click", (e) => copy(e.currentTarget.dataset.amt, `Montant (${amount} €)`));
    box.querySelector("[data-iban]")?.addEventListener("click", () => copy(info.iban.replace(/\s+/g, ""), "IBAN"));
    anchor?.after(box);
  });
}

// ================================================================== ESPACE CHAUFFEUR
async function enhanceDriverProfile(form) {
  const host = form.parentElement;
  if (!host || host.querySelector("#payForm")) return;
  const uid = await me(); if (!uid || host.querySelector("#payForm")) return;
  const { data: d } = await sb.from("drivers").select("pay_revtag, pay_iban, pay_holder").eq("user_id", uid).maybeSingle();
  if (!d || host.querySelector("#payForm")) return;
  const title = document.createElement("div"); title.className = "section-title"; title.textContent = "Paiement par carte des clients";
  const f = document.createElement("form"); f.className = "card"; f.id = "payForm";
  f.innerHTML = `<p class="muted" style="margin-top:0">Quand un client choisit « Carte », il voit ces informations et vous paie à votre arrivée (ou avant votre départ s'il est à plus de 8 km).</p>
    <label>Revtag Revolut</label><input name="pay_revtag" placeholder="@montag" autocomplete="off" value="${esc(d.pay_revtag || "")}">
    <label>Titulaire du compte</label><input name="pay_holder" autocomplete="name" value="${esc(d.pay_holder || "")}">
    <label>IBAN (pour virement instantané)</label><input name="pay_iban" placeholder="FR76 …" autocomplete="off" value="${esc(d.pay_iban || "")}">
    <button class="btn secondary" type="submit">Enregistrer</button>`;
  f.onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const v = Object.fromEntries([...new FormData(f)].map(([k, x]) => [k, String(x).trim() || null]));
    if (v.pay_revtag) v.pay_revtag = v.pay_revtag.replace(/^@/, "");
    if (v.pay_iban) { v.pay_iban = v.pay_iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim(); if (!/^[A-Z]{2}\d{2}[A-Z0-9 ]{10,40}$/.test(v.pay_iban)) throw new Error("IBAN invalide"); }
    const { error } = await sb.from("drivers").update(v).eq("user_id", uid);
    if (error) throw error;
    toast("Enregistré");
  }); };
  form.after(title, f);
}

async function enhanceNav(panel) {
  if (panel.querySelector("[data-pay-done]")) return;
  await once(panel, async () => {
    const uid = await me(); if (!uid) return;
    const { data } = await sb.from("bookings").select("*").eq("driver_user_id", uid).in("status", RUNNING)
      .order("accepted_at", { ascending: false, nullsFirst: false }).limit(1);
    const b = data?.[0]; if (!b || !panel.isConnected || panel.querySelector("[data-pay-done]")) return;
    const box = document.createElement("div"); box.dataset.payDone = "1";
    const slot = panel.querySelector("#slideSlot");
    panel.querySelectorAll(".kv span").forEach((s) => { if (s.textContent.trim() === "À encaisser à bord") s.textContent = b.onboard_method !== "CARD" ? "À encaisser en espèces" : b.prepaid_at ? "Payé par carte" : farAway(b) ? "Carte · payée avant votre départ" : "Carte · payée à votre arrivée"; });
    if (b.payment_method !== "ON_BOARD" || b.onboard_method !== "CARD" || b.status === "IN_PROGRESS") { slot?.before(box); return; }
    if (b.prepaid_at) {
      box.className = "prepay ok"; box.innerHTML = `<h3>✓ Paiement reçu <span>${euro(fare(b))}</span></h3><p>Vous pouvez démarrer la course.</p>`;
      slot?.before(box); if (slot) slot.style.display = ""; return;
    }
    const far = farAway(b), km = b.approach_km != null ? `${String(b.approach_km).replace(".", ",")} km` : "";
    if (!far && !b.arrived_at) {   // client proche : paiement demandé à l'arrivée
      box.className = "prepay later";
      box.innerHTML = `<h3>Paiement par carte <small>${euro(fare(b))}</small></h3><p>Client à ${km || "moins de 8 km"} : il vous paiera à votre arrivée (bouton « Je suis arrivé »).</p>`;
      slot?.before(box);
      if (b.status === "DRIVER_ARRIVING" && slot) slot.style.display = "none";   // « Client à bord » seulement après l'arrivée et le paiement
      return;
    }
    box.className = "prepay wait";
    box.innerHTML = `<h3>${far && b.status === "ACCEPTED" ? "Paiement avant de partir" : "Paiement par carte"} <small>${euro(fare(b))}</small></h3>
      <p>${far && b.status === "ACCEPTED" ? `Client à ${km} : attendez son paiement avant de partir, pour ne pas rouler pour rien. ` : "Le client paie maintenant. "}Vérifiez dans votre appli bancaire que l'argent est bien arrivé, puis confirmez.</p>
      <button class="btn" type="button" id="payOk">J'ai reçu le paiement</button>`;
    box.querySelector("#payOk").onclick = (e) => busy(e.target, async () => {
      if (!confirm(`Confirmez-vous avoir reçu ${euro(fare(b))} sur votre compte ?`)) return;
      const { error } = await sb.rpc("confirm_prepayment", { p_booking_id: b.id });
      if (error) throw error;
      box.className = "prepay ok"; box.innerHTML = `<h3>✓ Paiement reçu <span>${euro(fare(b))}</span></h3><p>${b.status === "ACCEPTED" ? "Vous pouvez partir vers le client." : "Vous pouvez démarrer la course."}</p>`;
      if (slot) slot.style.display = "";
      if (b.status === "ACCEPTED") { const a = panel.querySelector("[data-arrive]"); if (a) a.style.display = ""; }
    });
    slot?.before(box);
    if (slot) slot.style.display = "none";   // départ (client loin) ou « Client à bord » masqués tant que non payé
  });
}

new MutationObserver(() => {
  if (isDriverApp) {
    const f = document.getElementById("meForm"); if (f && document.getElementById("vehRow")) enhanceDriverProfile(f);
    const n = document.getElementById("navPanel"); if (n && n.querySelector("#slideSlot")) enhanceNav(n);
  } else {
    const s = document.getElementById("paySeg"); if (s) enhancePaySeg(s);
    const p = document.getElementById("tPanel"); if (p && p.querySelector(".kv")) enhanceClientPanel(p);
  }
}).observe(document.body, { childList: true, subtree: true });
