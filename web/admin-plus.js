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
}

new MutationObserver(() => { const o = $("#overlay"); if (!o) return; if (o.children.length) addButton(o); else lastRide = null; })
  .observe(document.getElementById("overlay") || document.body, { childList: true, subtree: true });
