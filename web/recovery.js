// Transporteur VTC — lien « Mot de passe oublié » reçu par e-mail : il ouvre uniquement une page pour choisir
// un nouveau mot de passe (l'appli reste cachée). Après l'enregistrement, on déconnecte et on demande de se
// reconnecter avec le nouveau mot de passe. « Annuler » déconnecte aussi : le lien ne sert pas à entrer dans l'appli.
import { sb, toast } from "./core.js";

const css = document.createElement("style");
css.textContent = `
.pwpage { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 24px;
  background: var(--bg, #040814); }
.pwpage .box { width: 100%; max-width: 380px; }
.pwpage img { width: 56px; height: 56px; display: block; margin: 0 auto 14px; }
.pwpage h1 { margin: 0 0 6px; font-size: 24px; text-align: center; }
.pwpage p { margin: 0 0 18px; color: var(--muted, #9aa); text-align: center; line-height: 1.4; }
.pwpage label { display: block; margin: 12px 0 6px; font-size: 14px; color: var(--muted, #9aa); }
.pwpage input { width: 100%; box-sizing: border-box; }
.pwpage .btn { margin-top: 18px; }
.pwpage .link { display: block; margin: 14px auto 0; background: none; border: 0; color: var(--muted, #9aa); font-size: 14px; cursor: pointer; }`;
document.head.appendChild(css);

async function done(msg) {
  await sb.auth.signOut().catch(() => {});
  history.replaceState(null, "", location.pathname);
  toast(msg);
  setTimeout(() => location.replace(location.pathname), 1200);
}

function page() {
  if (document.querySelector(".pwpage")) return;
  const el = document.createElement("div"); el.className = "pwpage";
  el.innerHTML = `<div class="box"><img src="icon.svg" alt="">
    <h1>Nouveau mot de passe</h1><p>Choisissez votre nouveau mot de passe, puis reconnectez-vous avec.</p>
    <label for="pw1">Nouveau mot de passe (8 caractères minimum)</label><input type="password" id="pw1" autocomplete="new-password" minlength="8">
    <label for="pw2">Confirmer le mot de passe</label><input type="password" id="pw2" autocomplete="new-password" minlength="8">
    <button class="btn" id="pwOk" type="button">Enregistrer le mot de passe</button>
    <button class="link" id="pwNo" type="button">Annuler</button></div>`;
  document.body.appendChild(el);
  el.querySelector("#pwOk").onclick = async (e) => {
    const a = el.querySelector("#pw1").value, b = el.querySelector("#pw2").value;
    if (a.length < 8) return toast("8 caractères minimum", true);
    if (a !== b) return toast("Les deux mots de passe sont différents", true);
    e.target.disabled = true;
    const { error } = await sb.auth.updateUser({ password: a });
    e.target.disabled = false;
    if (error) return toast(/expired|invalid|session/i.test(error.message) ? "Lien expiré : refaites « Mot de passe oublié »." : error.message, true);
    done("Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.");
  };
  el.querySelector("#pwNo").onclick = () => done("Mot de passe inchangé.");
}

if (window.__pwRecovery) page();
sb.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") page(); });
