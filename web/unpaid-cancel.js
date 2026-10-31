// Transporteur VTC — chauffeur : annuler une course par carte que le client ne paie pas.
// Possible 8 min après la demande de paiement, ou dès 5 min si le chauffeur a appelé le client au moins 2 fois.
// (Demande de paiement : à l'acceptation si le client est à plus de 8 km, sinon à l'arrivée du chauffeur.)
// Les appels sont comptés quand le chauffeur appuie sur le bouton « appeler » de la course. Règle vérifiée côté base.
import { sb, toast, busy } from "./core.js";

const css = document.createElement("style");
css.textContent = `
.unpaid { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line, #24314f); font-size: 13px; color: var(--muted); line-height: 1.4; }
.unpaid b { color: var(--text); }
.unpaid .btn { margin-top: 10px; background: transparent; border: 1px solid var(--bad, #e5484d); color: var(--bad, #e5484d); box-shadow: none; }
.unpaid .btn:disabled { opacity: .45; }`;
document.head.appendChild(css);

const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
let current = null;       // { id, status }

async function activeBooking() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return null;
  const { data } = await sb.from("bookings").select("id, status, onboard_method, prepaid_at").eq("driver_user_id", session.user.id)
    .in("status", ["ACCEPTED", "DRIVER_ARRIVING"]).order("accepted_at", { ascending: false, nullsFirst: false }).limit(1);
  return data?.[0] || null;
}

async function enhance(box) {
  if (box.dataset.unpaid) return;
  box.dataset.unpaid = "1";
  const b = await activeBooking();
  if (!b || b.onboard_method !== "CARD" || b.prepaid_at || !box.isConnected) return;
  current = b;
  const { data: s } = await sb.rpc("unpaid_status", { p_booking_id: b.id });
  if (!s?.waiting || !box.isConnected) return;
  const el = document.createElement("div"); el.className = "unpaid";
  box.appendChild(el);
  let calls = s.calls || 0;
  const since = new Date(s.since).getTime();
  const draw = () => {
    if (!el.isConnected) return clearInterval(timer);
    const sec = (Date.now() - since) / 1000;
    const ok = sec >= 480 || (sec >= 300 && calls >= 2);
    const wait = calls >= 2 ? 300 - sec : 480 - sec;
    el.innerHTML = `Paiement attendu depuis <b>${mmss(sec)}</b> · appels au client : <b>${calls}</b><br>
      ${ok ? "Le client ne paie pas ? Vous pouvez annuler la course." : `Annulation possible dans ${mmss(wait)}${calls < 2 ? " (ou dès 5 min après 2 appels)" : ""}.`}
      <button class="btn" type="button" ${ok ? "" : "disabled"}>Annuler : le client ne paie pas</button>`;
    el.querySelector("button").onclick = (e) => busy(e.target, async () => {
      if (!confirm("Annuler cette course ? Le client sera prévenu que le paiement n'a pas été reçu.")) return;
      const { error } = await sb.rpc("cancel_unpaid", { p_booking_id: b.id });
      if (error) throw error;
      toast("Course annulée");
      setTimeout(() => location.reload(), 600);
    });
  };
  draw();
  const timer = setInterval(draw, 1000);
  el._setCalls = (n) => { calls = n; draw(); };
}

// Appel du client depuis la course : on le note (compte pour l'annulation).
document.addEventListener("click", (e) => {
  const a = e.target.closest?.('#navPanel a[href^="tel:"]');
  if (!a || !current) return;
  sb.rpc("log_driver_call", { p_booking_id: current.id }).then(({ data }) => {
    if (typeof data === "number") document.querySelector(".unpaid")?._setCalls?.(data);
  });
}, true);

new MutationObserver(() => {
  const box = document.querySelector("#navPanel .prepay.wait");
  if (box) enhance(box);
}).observe(document.body, { childList: true, subtree: true });
