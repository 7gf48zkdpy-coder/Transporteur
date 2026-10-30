// Transporteur VTC — connexion avec Google (client et chauffeur)
// Ajoute le bouton « Continuer avec Google » à l'écran de connexion, transforme un nouveau compte Google
// créé depuis l'espace chauffeur en compte chauffeur, et demande le téléphone s'il manque.
import { sb, lang, t, busy, toast, rpc, currentProfile } from "./core.js";

const APP = /chauffeur/.test(location.pathname) ? "driver" : "client";
const en = lang === "en";
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* indisponible */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* indisponible */ } },
};

const css = document.createElement("style");
css.textContent = `
.or-sep { display: flex; align-items: center; gap: 12px; margin: 14px 0 4px; color: var(--muted); font-size: 13px; }
.or-sep::before, .or-sep::after { content: ""; flex: 1; height: 1px; background: var(--line); }
.btn.google { background: #fff; color: #1f1f1f; border: 1px solid #dadce0; box-shadow: none; font-weight: 600; }
.btn.google:hover { background: #f5f7fb; }`;
document.head.appendChild(css);

const G = `<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

// ------------------------------------------------------------------ bouton sur l'écran de connexion / inscription
function addButton(form) {
  if (form.querySelector("#gBtn") || !form.querySelector("input[name=email]") || !form.querySelector("input[name=password]")) return;
  const submit = form.querySelector("button[type=submit]");
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="or-sep"><span>${en ? "or" : "ou"}</span></div>
    <button type="button" class="btn google" id="gBtn">${G}<span>${en ? "Continue with Google" : "Continuer avec Google"}</span></button>`;
  submit.after(...wrap.childNodes);
  form.querySelector("#gBtn").onclick = (e) => busy(e.currentTarget, async () => {
    store.set("oauthApp", APP);
    const { error } = await sb.auth.signInWithOAuth({ provider: "google",
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } } });
    if (error) {
      store.del("oauthApp");
      throw /not enabled|Unsupported provider/i.test(error.message)
        ? new Error(en ? "Google sign-in is not enabled yet." : "La connexion Google n'est pas encore activée.") : error;
    }
  });
}
const root = document.getElementById("app");
const scan = () => root.querySelectorAll("#authForm").forEach(addButton);
new MutationObserver(scan).observe(root, { childList: true, subtree: true });
scan();

// ------------------------------------------------------------------ retour de Google
function askPhone(me) {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<form><h2 style="margin-top:0">${en ? "Your phone number" : "Votre numéro de téléphone"}</h2>
    <p class="muted">${en ? "So your driver or client can reach you during the ride." : "Pour que votre chauffeur ou votre client puisse vous joindre pendant la course."}</p>
    <input name="phone" type="tel" required autocomplete="tel" placeholder="06 12 34 56 78">
    <button class="btn" type="submit">${t("save")}</button><button class="btn secondary" type="button" id="pLater">${en ? "Later" : "Plus tard"}</button></form>`;
  document.body.appendChild(m);
  m.querySelector("#pLater").onclick = () => m.remove();
  m.querySelector("form").onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const phone = String(new FormData(e.target).get("phone")).trim();
    const { error } = await sb.from("profiles").update({ phone }).eq("id", me.id);
    if (error) throw error;
    m.remove(); toast(t("saved"));
  }); };
}

// Espace chauffeur : l'administration s'ouvre dans le tableau de bord dédié.
if (APP === "driver") {
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.('[data-v="admin"], #sAdmin')) return;
    e.preventDefault(); e.stopImmediatePropagation(); location.href = "admin.html";
  }, true);
  currentProfile().then(async (me) => {
    if (me?.role !== "ADMIN") return;
    const { data } = await sb.from("drivers").select("user_id").eq("user_id", me.id).maybeSingle();
    if (!data) location.replace("admin.html");
  }).catch(() => {});
}

(async () => {
  const from = store.get("oauthApp");
  if (!from) return;
  const me = await currentProfile();
  if (!me) return;
  store.del("oauthApp");
  if (from === "driver" && APP === "driver" && me.role === "CLIENT") {
    try { await rpc("become_driver"); location.reload(); return; } catch { /* compte client déjà utilisé */ }
  }
  if (!me.phone) askPhone(me);
})();
