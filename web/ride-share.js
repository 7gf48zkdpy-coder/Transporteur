// Transporteur VTC — appli client :
//  • « Partager ma course » : lien de suivi en direct à envoyer à une personne de confiance (page suivi.html, sans compte).
//  • Animation d'arrivée quand le chauffeur termine la course (aussi au retour dans l'appli si elle était fermée).
import { sb, euro, esc, toast } from "./core.js";

const css = document.createElement("style");
css.textContent = `
.celebrate.green { display: none !important; }   /* remplacée par l'animation d'arrivée ci-dessous */
.sharebtn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin: 10px 0 2px; padding: 13px; border-radius: 14px;
  border: 1px solid var(--line2, #2a3a63); background: var(--card2, #16213d); color: var(--text, #fff); font-weight: 700; font-size: 15px; line-height: 1; font-family: inherit; cursor: pointer; }
.sharebtn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; }
.arrive { position: fixed; inset: 0; z-index: 9998; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px;
  text-align: center; color: #fff; background: radial-gradient(120% 90% at 50% 20%, #0f6b4f 0%, #063a2c 55%, #03140f 100%); animation: arFade .3s ease-out; }
.arrive .road { position: relative; width: min(320px, 80vw); height: 64px; margin-bottom: 26px; }
.arrive .road::before { content: ""; position: absolute; left: 0; right: 34px; top: 40px; border-top: 4px dashed rgba(255, 255, 255, .35); }
.arrive .flag { position: absolute; right: 0; top: 8px; width: 34px; height: 40px; }
.arrive .car { position: absolute; left: 0; top: 18px; width: 54px; animation: arDrive 1.6s cubic-bezier(.3, .7, .2, 1) .2s both; }
.arrive .ok { width: 92px; height: 92px; border-radius: 50%; background: #34d399; display: grid; place-items: center; margin-bottom: 18px;
  box-shadow: 0 0 0 0 rgba(52, 211, 153, .6); animation: arPop .45s cubic-bezier(.2, 1.6, .4, 1) 1.5s both, arRing 1.6s ease-out 1.9s infinite; }
.arrive .ok svg { width: 48px; height: 48px; stroke: #04261b; stroke-width: 3.2; fill: none; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 30; stroke-dashoffset: 30; animation: arTick .4s ease-out 1.85s forwards; }
.arrive h1 { margin: 0 0 6px; font-size: 30px; animation: arUp .4s ease-out 1.7s both; }
.arrive p { margin: 0; color: rgba(255, 255, 255, .85); font-size: 16px; animation: arUp .4s ease-out 1.8s both; }
.arrive .amt { margin: 18px 0 4px; font-weight: 800; font-size: 40px; line-height: 1; font-family: inherit; animation: arUp .4s ease-out 1.9s both; }
.arrive small { color: rgba(255, 255, 255, .7); font-size: 14px; animation: arUp .4s ease-out 2s both; }
.arrive button { margin-top: 30px; width: min(320px, 85vw); padding: 15px; border: 0; border-radius: 14px; background: #fff; color: #063a2c;
  font-weight: 800; font-size: 16px; line-height: 1; font-family: inherit; cursor: pointer; animation: arUp .4s ease-out 2.1s both; }
.arrive i.cf { position: absolute; top: -12px; width: 8px; height: 14px; border-radius: 2px; animation: arFall linear forwards; }
.arrive.out { animation: arFade .3s reverse both; }
@keyframes arFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes arDrive { from { transform: translateX(0) } to { transform: translateX(calc(min(320px, 80vw) - 96px)) } }
@keyframes arPop { from { transform: scale(0) } to { transform: scale(1) } }
@keyframes arRing { 0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, .55) } 100% { box-shadow: 0 0 0 26px rgba(52, 211, 153, 0) } }
@keyframes arTick { to { stroke-dashoffset: 0 } }
@keyframes arUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes arFall { to { transform: translateY(110vh) rotate(540deg) } }`;
document.head.appendChild(css);

let me = null;
const seen = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const mark = (k) => { try { localStorage.setItem(k, Date.now()); } catch { /* */ } };
const short = (s) => String(s || "").split(",")[0].trim();

// ------------------------------------------------------------------ animation d'arrivée
function arrival(b) {
  const key = "arrived:" + b.id;
  if (seen(key)) return;
  mark(key);
  document.querySelector(".arrive")?.remove();
  const fare = b.final_fare_cents ?? b.quoted_fare_cents;
  const paid = b.payment_method !== "ON_BOARD" ? "Payé par carte" : b.onboard_method === "CARD" ? "Payé par carte" : "Payé en espèces";
  const colors = ["#34d399", "#ffffff", "#fbbf24", "#4a93ff"];
  const el = document.createElement("div"); el.className = "arrive";
  el.innerHTML = Array.from({ length: 34 }, (_, i) => `<i class="cf" style="left:${Math.random() * 100}%;background:${colors[i % 4]};animation-duration:${2 + Math.random() * 1.8}s;animation-delay:${1.6 + Math.random() * .8}s"></i>`).join("") +
    `<div class="road">
      <svg class="car" viewBox="0 0 64 30"><rect x="4" y="9" width="56" height="14" rx="6" fill="#f4f6fb"/><path d="M16 9l7-7h17l8 7z" fill="#dfe5f2"/>
        <rect x="24" y="3.5" width="14" height="5" rx="1" fill="#0d1526"/><circle cx="17" cy="24" r="5" fill="#0d1526"/><circle cx="47" cy="24" r="5" fill="#0d1526"/>
        <rect x="56" y="12" width="4" height="3" rx="1" fill="#fffbe6"/></svg>
      <svg class="flag" viewBox="0 0 34 40"><rect x="2" y="2" width="3" height="38" fill="#fff"/><g fill="#fff"><rect x="5" y="2" width="7" height="6"/><rect x="19" y="2" width="7" height="6"/>
        <rect x="12" y="8" width="7" height="6"/><rect x="26" y="8" width="6" height="6"/><rect x="5" y="14" width="7" height="6"/><rect x="19" y="14" width="7" height="6"/></g>
        <g fill="#0d1526"><rect x="12" y="2" width="7" height="6"/><rect x="26" y="2" width="6" height="6"/><rect x="5" y="8" width="7" height="6"/><rect x="19" y="8" width="7" height="6"/>
        <rect x="12" y="14" width="7" height="6"/><rect x="26" y="14" width="6" height="6"/></g></svg></div>
    <div class="ok"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h1>Vous êtes arrivé !</h1><p>${esc(short(b.destination_label))}</p>
    <div class="amt">${euro(fare)}</div><small>${paid}</small>
    <button type="button">Merci, à bientôt 👋</button>`;
  document.body.appendChild(el);
  navigator.vibrate?.([80, 60, 80, 60, 220]);
  el.querySelector("button").onclick = () => { el.classList.add("out"); setTimeout(() => el.remove(), 300); };
}

// ------------------------------------------------------------------ partage de course
const SHARE_ICON = `<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>`;
async function shareRide(b) {
  const { data: tok, error } = await sb.rpc("create_share_link", { p_booking_id: b.id });
  if (error || !tok) { toast("Impossible de créer le lien de partage", true); return; }
  const url = `${location.origin}/suivi.html?t=${tok}`;
  const text = `Je suis en VTC Transporteur vers ${short(b.destination_label)}. Suis mon trajet en direct :`;
  if (navigator.share) { try { await navigator.share({ title: "Suivez ma course", text, url }); return; } catch (e) { if (e?.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Lien copié : envoyez-le à votre proche"); }
  catch { prompt("Copiez ce lien et envoyez-le :", url); }
}

let current = null, lastRefresh = 0, adding = false;
const ACTIVE = ["REQUESTED", "ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"];
async function addShare(panel) {
  if (panel.querySelector(".sharebtn") || adding) return;
  if (!current || !ACTIVE.includes(current.status)) {
    if (Date.now() - lastRefresh < 3000) return;
    adding = true; try { await refresh(); } finally { adding = false; }
    if (!current || !ACTIVE.includes(current.status) || panel.querySelector(".sharebtn") || !panel.isConnected) return;
  }
  const btn = document.createElement("button"); btn.type = "button"; btn.className = "sharebtn";
  btn.innerHTML = `${SHARE_ICON} Partager ma course avec un proche`;
  btn.onclick = () => shareRide(current);
  const cancel = panel.querySelector("#cancelBtn");
  cancel ? cancel.before(btn) : panel.appendChild(btn);
}

async function refresh() {
  lastRefresh = Date.now();
  const { data } = await sb.from("bookings").select("*").eq("client_user_id", me).order("created_at", { ascending: false }).limit(1);
  const b = data?.[0];
  if (!b) return;
  current = b;
  if (b.status === "COMPLETED" && b.completed_at && Date.now() - new Date(b.completed_at) < 15 * 60e3) arrival(b);
}

async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user || me) return;
  me = session.user.id;
  await refresh();
  sb.channel("rshare-" + me)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `client_user_id=eq.${me}` }, (p) => {
      const b = p.new; if (!b) return;
      current = b;
      if (b.status === "COMPLETED") arrival(b);
    }).subscribe();
  new MutationObserver(() => { const p = document.getElementById("tPanel"); if (p && p.querySelector(".kv, .eta")) addShare(p); })
    .observe(document.body, { childList: true, subtree: true });
  setInterval(() => { if (!document.hidden) refresh(); }, 20000);
}
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN") start(); });
start();
