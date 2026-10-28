// ============================================================
//  Accès : écran de lancement + compte obligatoire + verrou (code / Face ID)
// ============================================================
// Fichier commun aux applis (Finly, Mindinvest, Transporteur). Chaque page déclare
// window.ACCES = { … } juste avant de charger ce script (réglages dans build-acces.js).
//
// 1. Écran de lancement : logo animé + nom, affiché à l'ouverture depuis l'icône
//    du téléphone (mode « appli installée »).
// 2. Compte obligatoire : plus de mode invité, il faut se connecter ou créer un compte.
// 3. Verrou : un code à 4 chiffres (et Face ID / empreinte si le téléphone le permet)
//    est demandé à chaque ouverture, et après 2 minutes passées hors de l'appli.
//    Le code est propre à chaque téléphone et n'est jamais envoyé sur internet
//    (seule une empreinte chiffrée est gardée sur le téléphone).
(function () {
  "use strict";
  var C = window.ACCES || {};
  var tu = C.tu !== false;
  function T(a, b) { return tu ? a : b; }
  var doc = document, root = doc.documentElement;
  var standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || /[?&]splash\b/.test(location.search);
  var KEY = "acces:" + (C.app || "app") + ":";
  var RELOCK_MS = C.relockAfter || 2 * 60 * 1000;
  var MAX_TRIES = 5;

  /* ---------- styles ---------- */
  var css = [
    ":root{--ac-bg:" + (C.bg || "#000") + ";--ac-bg2:" + (C.bg2 || C.bg || "#000") + ";--ac-a:" + (C.accent || "#8b5cf6") + ";--ac-a2:" + (C.accent2 || C.accent || "#c084fc") + ";--ac-t:" + (C.text || "#fff") + ";--ac-on:" + (C.onAccent || "#fff") + "}",
    "html.ac-on,html.ac-on body{overflow:hidden!important}",
    "#ac{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ac-t);background:radial-gradient(120% 80% at 50% 30%,var(--ac-bg2) 0%,var(--ac-bg) 62%);font:16px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',system-ui,sans-serif;-webkit-font-smoothing:antialiased;padding:env(safe-area-inset-top,0) 22px env(safe-area-inset-bottom,0);box-sizing:border-box;transition:opacity .45s ease,transform .45s ease;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overflow:hidden}",
    "#ac *{box-sizing:border-box}",
    "#ac.ac-out{opacity:0;transform:scale(1.04);pointer-events:none}",
    // écran de lancement
    ".ac-splash{display:flex;flex-direction:column;align-items:center;gap:22px;transition:opacity .35s ease,transform .45s cubic-bezier(.2,.8,.2,1)}",
    ".ac-splash.ac-leave{opacity:0;transform:translateY(-26px) scale(.92)}",
    ".ac-logo{position:relative;width:112px;height:112px;display:grid;place-items:center}",
    ".ac-logo>.ac-mark{width:112px;height:112px;border-radius:26px;overflow:hidden;position:relative;z-index:2;box-shadow:0 18px 50px -12px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.07)}",
    ".ac-logo>.ac-mark>img,.ac-logo>.ac-mark>svg{width:100%;height:100%;display:block}",
    ".ac-anim .ac-logo>.ac-mark{animation:ac-pop .9s cubic-bezier(.2,.9,.25,1.15) both}",
    ".ac-logo:before{content:'';position:absolute;inset:-34px;border-radius:50%;background:radial-gradient(circle,var(--ac-a) 0%,transparent 66%);opacity:.0;filter:blur(8px);z-index:1}",
    ".ac-anim .ac-logo:before{animation:ac-glow 2.4s ease-in-out .35s infinite}",
    ".ac-logo:after{content:'';position:absolute;inset:-6px;border-radius:32px;border:1.5px solid var(--ac-a2);opacity:0;z-index:1}",
    ".ac-anim .ac-logo:after{animation:ac-ring 1.6s ease-out .55s infinite}",
    ".ac-name{font-size:30px;font-weight:700;letter-spacing:.5px;display:flex;gap:1px}",
    ".ac-name span{display:inline-block}",
    ".ac-anim .ac-name span{opacity:0;animation:ac-up .55s cubic-bezier(.2,.8,.2,1) both}",
    ".ac-tag{font-size:14px;opacity:.6;margin-top:-14px;letter-spacing:.2px;text-align:center;max-width:280px}",
    ".ac-anim .ac-tag{animation:ac-fade .6s ease .75s both}",
    ".ac-bar{width:120px;height:3px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:6px}",
    ".ac-bar i{display:block;height:100%;width:40%;border-radius:3px;background:linear-gradient(90deg,var(--ac-a),var(--ac-a2));animation:ac-load 1.1s ease-in-out infinite}",
    "@keyframes ac-pop{0%{opacity:0;transform:scale(.6) rotate(-8deg);filter:blur(10px)}100%{opacity:1;transform:none;filter:none}}",
    "@keyframes ac-glow{0%,100%{opacity:.22;transform:scale(.9)}50%{opacity:.5;transform:scale(1.08)}}",
    "@keyframes ac-ring{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(1.45)}}",
    "@keyframes ac-up{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:none}}",
    "@keyframes ac-fade{0%{opacity:0}100%{opacity:.6}}",
    "@keyframes ac-load{0%{transform:translateX(-110%)}100%{transform:translateX(280%)}}",
    "@keyframes ac-in{0%{opacity:0;transform:translateY(18px)}100%{opacity:1;transform:none}}",
    "@keyframes ac-shake{0%,100%{transform:none}20%,60%{transform:translateX(-10px)}40%,80%{transform:translateX(10px)}}",
    // panneaux (connexion, code)
    ".ac-panel{width:100%;max-width:380px;display:flex;flex-direction:column;align-items:center;animation:ac-in .5s cubic-bezier(.2,.8,.2,1) both;max-height:100%;overflow:auto;padding:24px 0;-webkit-user-select:text;user-select:text}",
    ".ac-head{display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:22px;text-align:center}",
    ".ac-head .ac-mark{width:64px;height:64px;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px -10px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.07)}",
    ".ac-head .ac-mark>img,.ac-head .ac-mark>svg{width:100%;height:100%;display:block}",
    ".ac-h{font-size:24px;font-weight:700;margin:0}",
    ".ac-p{font-size:15px;opacity:.65;margin:0;max-width:320px}",
    ".ac-tabs{display:flex;width:100%;background:rgba(255,255,255,.07);border-radius:12px;padding:3px;margin-bottom:16px}",
    ".ac-tabs button{flex:1;border:0;background:none;color:inherit;font:inherit;font-size:15px;font-weight:600;padding:9px 6px;border-radius:9px;opacity:.6;cursor:pointer}",
    ".ac-tabs button.on{background:rgba(255,255,255,.14);opacity:1}",
    ".ac-form{width:100%;display:flex;flex-direction:column;gap:10px}",
    ".ac-in{width:100%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;font:inherit;font-size:16px;padding:14px 15px;border-radius:13px;outline:none;-webkit-appearance:none;appearance:none}",
    ".ac-in:focus{border-color:var(--ac-a2);background:rgba(255,255,255,.09)}",
    ".ac-in::placeholder{color:currentColor;opacity:.4}",
    ".ac-btn{width:100%;border:0;font:inherit;font-size:16px;font-weight:650;padding:15px;border-radius:13px;cursor:pointer;color:var(--ac-on);background:linear-gradient(135deg,var(--ac-a),var(--ac-a2));box-shadow:0 10px 26px -12px var(--ac-a)}",
    ".ac-btn[disabled]{opacity:.55}",
    ".ac-btn.ac-ghost{background:rgba(255,255,255,.08);color:var(--ac-t);box-shadow:none;font-weight:600}",
    ".ac-link{border:0;background:none;color:var(--ac-a2);font:inherit;font-size:14.5px;font-weight:600;padding:10px;cursor:pointer}",
    ".ac-sep{display:flex;align-items:center;gap:10px;width:100%;font-size:13px;opacity:.45;margin:6px 0}",
    ".ac-sep:before,.ac-sep:after{content:'';flex:1;height:1px;background:currentColor;opacity:.4}",
    ".ac-msg{min-height:20px;font-size:14px;text-align:center;margin:4px 0 2px;color:#ff8a8a}",
    ".ac-msg.ok{color:#7ee2a8}",
    // verrou
    ".ac-dots{display:flex;gap:18px;margin:6px 0 30px}",
    ".ac-dots i{width:14px;height:14px;border-radius:50%;border:1.6px solid currentColor;opacity:.75;transition:background .15s,transform .15s}",
    ".ac-dots i.on{background:currentColor;opacity:1;transform:scale(1.08)}",
    ".ac-dots.ac-bad{animation:ac-shake .42s ease}",
    ".ac-pad{display:grid;grid-template-columns:repeat(3,76px);gap:16px 24px;justify-content:center}",
    ".ac-pad button{width:76px;height:76px;border-radius:50%;border:0;background:rgba(255,255,255,.09);color:inherit;font:inherit;font-size:30px;font-weight:400;cursor:pointer;display:grid;place-items:center;transition:background .12s}",
    ".ac-pad button:active{background:rgba(255,255,255,.26)}",
    ".ac-pad button.ac-k0{background:none}",
    ".ac-pad button.ac-k0:active{background:rgba(255,255,255,.1)}",
    ".ac-pad button svg{width:30px;height:30px}",
    ".ac-foot{margin-top:22px;display:flex;flex-direction:column;align-items:center;gap:2px}",
    ".ac-who{font-size:13px;opacity:.5;margin-top:-14px;margin-bottom:22px}",
    "@media (max-height:780px){.ac-pad{grid-template-columns:repeat(3,68px);gap:12px 24px}.ac-pad button{width:68px;height:68px;font-size:27px}.ac-dots{margin:2px 0 14px}.ac-head{margin-bottom:12px;gap:8px}.ac-head .ac-mark{width:52px;height:52px;border-radius:13px}.ac-h{font-size:22px}.ac-who{margin-top:-8px;margin-bottom:12px}.ac-foot{margin-top:10px}.ac-panel{padding:14px 0}}",
    "@media (max-height:620px){.ac-pad{grid-template-columns:repeat(3,58px);gap:10px 22px}.ac-pad button{width:58px;height:58px;font-size:23px}.ac-head .ac-mark{display:none}}",
    "@media (prefers-reduced-motion:reduce){#ac *{animation-duration:.01s!important;animation-iteration-count:1!important}}"
  ].join("\n");

  /* ---------- outils ---------- */
  function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function mark() { return '<div class="ac-mark">' + (C.logo || "") + "</div>"; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function b64(buf) { var s = "", a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function rand(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function hashPin(pin, salt) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(salt), iterations: 120000, hash: "SHA-256" }, k, 256);
    }).then(b64);
  }
  function validEmail(m) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m); }

  /* ---------- liaison avec la base (Supabase) ---------- */
  // C.cloud = "FinlyCloud" / "MindCloud" (cloud.js) ou C.supabase = fonction qui renvoie le client Supabase de la page
  var api = (function () {
    if (C.cloud) {
      var cloud = function () { return window[C.cloud]; };
      return {
        client: function () { return cloud().client(); },
        login: function (m, p) { return cloud().account.login(m, p); },
        create: function (m, p) { return cloud().use("user").then(function () { return cloud().account.create(m, p); }); },
        sendCode: function (m) { return cloud().account.sendCode(m, false); },
        verifyCode: function (m, c) { return cloud().account.verifyCode(m, c); },
        google: function () { return cloud().account.google(); },
        logout: function () { return cloud().account.logout(); }
      };
    }
    var sbp = null;
    function sb() { if (!sbp) sbp = Promise.resolve(C.supabase()); return sbp; }
    return {
      client: sb,
      login: function (m, p) {
        return sb().then(function (s) {
          return s.auth.signInWithPassword({ email: m, password: p }).then(function (r) {
            if (r.error) throw new Error(/invalid/i.test(r.error.message) ? "E-mail ou mot de passe incorrect." : /confirm/i.test(r.error.message) ? "Adresse e-mail pas encore confirmée." : /banned/i.test(r.error.message) ? "Ce compte est bloqué." : "Connexion impossible, réessayez.");
          });
        });
      },
      create: function (m, p) {
        return sb().then(function (s) {
          return s.auth.getSession().then(function (r) {
            var u = r.data && r.data.session && r.data.session.user;
            if (u && u.is_anonymous) return s;
            return s.auth.signInAnonymously().then(function (a) { if (a.error) throw new Error("Création impossible, réessayez."); return s; });
          }).then(function () {
            return s.functions.invoke(C.signupFunction || "client-signup", { body: { email: m, password: p } });
          }).then(function (r) {
            if (r.error) {
              var ctx = r.error.context;
              if (ctx && typeof ctx.json === "function") return ctx.json().then(function (j) { throw new Error((j && j.error) || "Création impossible, réessayez."); }, function () { throw new Error("Création impossible, réessayez."); });
              throw new Error("Création impossible, réessayez.");
            }
            if (r.data && r.data.error) throw new Error(r.data.error);
            return s.auth.refreshSession();
          });
        });
      },
      reset: function (m) {
        return sb().then(function (s) {
          return s.auth.resetPasswordForEmail(m, { redirectTo: location.origin + location.pathname }).then(function (r) {
            if (r.error) throw new Error(/rate|seconds/i.test(r.error.message) ? "Patientez une minute avant de redemander." : "Envoi impossible, réessayez.");
          });
        });
      },
      setPassword: function (p) {
        return sb().then(function (s) { return s.auth.updateUser({ password: p }).then(function (r) { if (r.error) throw new Error("Modification impossible, réessayez."); }); });
      },
      logout: function () { return sb().then(function (s) { return s.auth.signOut(); }); }
    };
  })();

  function currentUser() {
    var t = sleep(8000).then(function () { throw new Error("délai"); });
    return Promise.race([t, api.client().then(function (sb) {
      return sb.auth.getSession().then(function (r) { return (r.data && r.data.session && r.data.session.user) || null; });
    })]);
  }

  /* ---------- montage ---------- */
  var box = null, user = null, hiddenAt = 0, locked = false, recovering = /type=recovery/.test(location.hash);
  function mount() {
    if (box) return box;
    var st = el("style"); st.textContent = css; (doc.head || root).appendChild(st);
    box = el("div"); box.id = "ac"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    root.classList.add("ac-on");
    (doc.body || root).appendChild(box);
    if (!doc.body) doc.addEventListener("DOMContentLoaded", function () { if (box && box.parentNode === root) doc.body.appendChild(box); });
    return box;
  }
  function show(node) { mount(); box.classList.remove("ac-out"); box.innerHTML = ""; box.appendChild(node); return node; }
  function close() {
    if (!box) return;
    box.classList.add("ac-out"); root.classList.remove("ac-on");
    var b = box; box = null;
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 480);
  }

  /* ---------- 1. écran de lancement ---------- */
  var splashAt = Date.now(), splashNode = null;
  function splash() {
    var name = (C.name || "").split("").map(function (ch, i) { return '<span style="animation-delay:' + (0.32 + i * 0.045).toFixed(3) + 's">' + (ch === " " ? "&nbsp;" : ch.replace(/[<>&]/g, "")) + "</span>"; }).join("");
    splashNode = el("div", "ac-splash" + (standalone ? " ac-anim" : ""), '<div class="ac-logo">' + mark() + '</div><div class="ac-name">' + name + "</div>" + (C.tag ? '<div class="ac-tag"></div>' : "") + '<div class="ac-bar"><i></i></div>');
    if (C.tag) splashNode.querySelector(".ac-tag").textContent = C.tag;
    show(splashNode);
  }
  function splashDone() {
    var min = standalone ? (C.splashMs || 1700) : 0;
    var wait = Math.max(0, min - (Date.now() - splashAt));
    return sleep(wait).then(function () {
      if (splashNode && splashNode.parentNode) { splashNode.classList.add("ac-leave"); return sleep(standalone ? 320 : 0); }
    });
  }

  /* ---------- 2. connexion obligatoire ---------- */
  function loginScreen(mode) {
    mode = mode || "in";
    var p = el("div", "ac-panel");
    var title = mode === "new" ? T("Crée ton compte", "Créez votre compte") : mode === "code" ? T("Connexion par code", "Connexion par code") : mode === "reset" ? "Mot de passe oublié" : mode === "newpw" ? "Nouveau mot de passe" : T("Content de te revoir", "Bienvenue");
    var sub = mode === "new" ? T("Un compte pour retrouver tes données sur tous tes appareils.", "Un compte pour réserver et suivre vos courses.")
      : mode === "code" ? T("On t'envoie un code à 6 chiffres par e-mail.", "Un code à 6 chiffres vous est envoyé par e-mail.")
      : mode === "reset" ? "Un lien pour choisir un nouveau mot de passe vous est envoyé par e-mail."
      : mode === "newpw" ? "Choisissez votre nouveau mot de passe (8 caractères minimum)."
      : T("Connecte-toi pour accéder à ", "Connectez-vous pour accéder à ") + (C.name || "l'appli") + ".";
    var h = '<div class="ac-head">' + mark() + '<h1 class="ac-h"></h1><p class="ac-p"></p></div>';
    if (mode === "in" || mode === "new") h += '<div class="ac-tabs"><button type="button" data-m="in" class="' + (mode === "in" ? "on" : "") + '">Se connecter</button><button type="button" data-m="new" class="' + (mode === "new" ? "on" : "") + '">Créer un compte</button></div>';
    h += '<form class="ac-form" novalidate>';
    if (mode !== "newpw") h += '<input class="ac-in" name="m" type="email" inputmode="email" autocomplete="' + (mode === "new" ? "email" : "username") + '" placeholder="Adresse e-mail" autocapitalize="off" spellcheck="false">';
    if (mode === "in" || mode === "new" || mode === "newpw") h += '<input class="ac-in" name="p" type="password" autocomplete="' + (mode === "in" ? "current-password" : "new-password") + '" placeholder="' + (mode === "in" ? "Mot de passe" : "Mot de passe (8 caractères min.)") + '">';
    if (mode === "new" || mode === "newpw") h += '<input class="ac-in" name="p2" type="password" autocomplete="new-password" placeholder="Confirmer le mot de passe">';
    if (mode === "code") h += '<input class="ac-in" name="c" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="Code reçu par e-mail" maxlength="8" hidden>';
    h += '<div class="ac-msg" aria-live="polite"></div>';
    h += '<button class="ac-btn" type="submit">' + (mode === "new" ? "Créer mon compte" : mode === "code" ? "Recevoir le code" : mode === "reset" ? "Recevoir le lien" : mode === "newpw" ? "Enregistrer" : "Se connecter") + "</button></form>";
    if (mode === "in") {
      if (C.codeLogin) h += '<button type="button" class="ac-link" data-m="code">' + T("Mot de passe oublié ? Reçois un code par e-mail", "Mot de passe oublié ? Recevoir un code par e-mail") + "</button>";
      else if (C.resetLink) h += '<button type="button" class="ac-link" data-m="reset">Mot de passe oublié ?</button>';
    }
    if (mode === "code" || mode === "reset") h += '<button type="button" class="ac-link" data-m="in">Retour</button>';
    if (C.google && (mode === "in" || mode === "new")) h += '<div class="ac-sep">ou</div><button type="button" class="ac-btn ac-ghost" data-g="1"><svg viewBox="0 0 48 48" width="18" height="18" style="vertical-align:-3px;margin-right:8px"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continuer avec Google</button>';
    p.innerHTML = h;
    p.querySelector(".ac-h").textContent = title;
    p.querySelector(".ac-p").textContent = sub;
    show(p);
    var f = p.querySelector("form"), msg = p.querySelector(".ac-msg"), btn = f.querySelector(".ac-btn");
    function say(t, ok) { msg.textContent = t || ""; msg.className = "ac-msg" + (ok ? " ok" : ""); }
    function busy(on, label) { btn.disabled = on; if (label) btn.textContent = label; }
    Array.prototype.forEach.call(p.querySelectorAll("[data-m]"), function (b) { b.onclick = function () { loginScreen(b.getAttribute("data-m")); }; });
    var g = p.querySelector("[data-g]");
    if (g) g.onclick = function () { say(""); g.disabled = true; api.google().catch(function (e) { g.disabled = false; say(e.message); }); };
    var codeSent = false;
    f.onsubmit = function (e) {
      e.preventDefault(); say("");
      var m = f.m ? f.m.value.trim().toLowerCase() : "", pw = f.p ? f.p.value : "", pw2 = f.p2 ? f.p2.value : "";
      if (f.m && !validEmail(m)) return say("Adresse e-mail invalide.");
      if (mode === "in" && !pw) return say(T("Entre ton mot de passe.", "Entrez votre mot de passe."));
      if ((mode === "new" || mode === "newpw") && pw.length < 8) return say("Mot de passe : 8 caractères minimum.");
      if ((mode === "new" || mode === "newpw") && pw !== pw2) return say("Les deux mots de passe ne sont pas identiques.");
      var label = btn.textContent, job;
      if (mode === "in") { busy(true, "Connexion…"); job = api.login(m, pw); }
      else if (mode === "new") { busy(true, "Création…"); job = api.create(m, pw); }
      else if (mode === "newpw") { busy(true, "Enregistrement…"); job = api.setPassword(pw).then(function () { recovering = false; history.replaceState(null, "", location.pathname + location.search); }); }
      else if (mode === "reset") {
        busy(true, "Envoi…");
        return api.reset(m).then(function () { busy(false, label); say("C'est envoyé ! Ouvrez le lien reçu par e-mail sur ce téléphone.", true); }, function (er) { busy(false, label); say(er.message); });
      } else if (mode === "code" && !codeSent) {
        busy(true, "Envoi…");
        return api.sendCode(m).then(function () {
          codeSent = true; f.m.readOnly = true; f.c.hidden = false; f.c.focus();
          busy(false, "Valider le code"); say(T("Code envoyé ! Regarde tes e-mails.", "Code envoyé ! Regardez vos e-mails."), true);
        }, function (er) { busy(false, label); say(er.message); });
      } else { busy(true, "Vérification…"); job = api.verifyCode(m, f.c.value); }
      job.then(function () { say(T("C'est bon !", "C'est bon !"), true); setTimeout(function () { location.reload(); }, 250); },
        function (er) { busy(false, label); say((er && er.message) || "Erreur, réessaie."); });
    };
    setTimeout(function () { var i = p.querySelector(".ac-in"); if (i && !standalone) i.focus(); }, 400);
  }

  /* ---------- 3. verrou : code à 4 chiffres + Face ID ---------- */
  function lockKey() { return KEY + (user && user.id); }
  function lockData() { return lsGet(lockKey()); }
  function bioAvailable() {
    return (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; }) : Promise.resolve(false);
  }
  function bioName() { return /iPhone|iPad|Mac/.test(navigator.userAgent) ? "Face ID" : "l'empreinte / le visage"; }
  function bioCreate() {
    return navigator.credentials.create({ publicKey: {
      challenge: rand(32), rp: { name: C.name || "Appli", id: location.hostname },
      user: { id: rand(16), name: (user && user.email) || "compte", displayName: (C.name || "Appli") + " – déverrouillage" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000, attestation: "none"
    } }).then(function (c) { return b64(c.rawId); });
  }
  function bioCheck(id) {
    return navigator.credentials.get({ publicKey: {
      challenge: rand(32), rpId: location.hostname, allowCredentials: [{ type: "public-key", id: unb64(id) }],
      userVerification: "required", timeout: 60000
    } }).then(function (c) { if (!c) throw new Error("annulé"); });
  }
  var ICON_BIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16c1.4 1 3.6 1 5 0"/></svg>';
  var ICON_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M17 9l-5 6M12 9l5 6"/></svg>';

  // Clavier à code : renvoie le code tapé (4 chiffres) via onDone
  function pinPad(opts) {
    var p = el("div", "ac-panel");
    p.innerHTML = '<div class="ac-head">' + mark() + '<h1 class="ac-h"></h1><p class="ac-p"></p></div>' +
      (opts.who ? '<div class="ac-who"></div>' : "") +
      '<div class="ac-dots"><i></i><i></i><i></i><i></i></div><div class="ac-msg" aria-live="polite"></div><div class="ac-pad"></div><div class="ac-foot"></div>';
    p.querySelector(".ac-h").textContent = opts.title;
    p.querySelector(".ac-p").textContent = opts.sub || "";
    if (opts.who) p.querySelector(".ac-who").textContent = opts.who;
    var pad = p.querySelector(".ac-pad"), dots = p.querySelectorAll(".ac-dots i"), msg = p.querySelector(".ac-msg"), code = "", busy = false;
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", opts.bio ? "bio" : "", "0", "del"];
    keys.forEach(function (k) {
      var b = el("button"); b.type = "button";
      if (k === "bio") { b.innerHTML = ICON_BIO; b.className = "ac-k0"; b.setAttribute("aria-label", "Déverrouiller avec " + bioName()); b.onclick = function () { opts.bio(); }; }
      else if (k === "del") { b.innerHTML = ICON_DEL; b.className = "ac-k0"; b.setAttribute("aria-label", "Effacer"); b.onclick = function () { code = code.slice(0, -1); paint(); }; }
      else if (!k) { b.className = "ac-k0"; b.disabled = true; b.style.visibility = "hidden"; }
      else { b.textContent = k; b.onclick = function () { press(k); }; }
      pad.appendChild(b);
    });
    function paint() { for (var i = 0; i < 4; i++) dots[i].classList.toggle("on", i < code.length); }
    function press(k) {
      if (busy || code.length >= 4) return;
      code += k; paint(); msg.textContent = "";
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
      if (code.length === 4) { busy = true; var c = code; setTimeout(function () { opts.onDone(c, api2); }, 120); }
    }
    var api2 = {
      fail: function (t) {
        var d = p.querySelector(".ac-dots"); d.classList.remove("ac-bad"); void d.offsetWidth; d.classList.add("ac-bad");
        if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch (e) {}
        msg.className = "ac-msg"; msg.textContent = t || ""; code = ""; busy = false; paint();
      },
      reset: function (title, sub) { p.querySelector(".ac-h").textContent = title; p.querySelector(".ac-p").textContent = sub || ""; code = ""; busy = false; msg.textContent = ""; paint(); },
      foot: p.querySelector(".ac-foot"), msg: msg
    };
    function onKey(e) {
      if (!p.isConnected) return doc.removeEventListener("keydown", onKey);
      if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === "Backspace") { code = code.slice(0, -1); paint(); }
    }
    doc.addEventListener("keydown", onKey);
    show(p);
    return api2;
  }

  function maskMail(m) { if (!m) return ""; var i = m.indexOf("@"); return i > 2 ? m.slice(0, 2) + "•••" + m.slice(i) : m; }

  function forgot() {
    if (!confirm(T("Pour réinitialiser le code, tu vas être déconnecté. Tu pourras te reconnecter avec ton e-mail et ton mot de passe, puis choisir un nouveau code.", "Pour réinitialiser le code, vous allez être déconnecté. Reconnectez-vous ensuite avec votre e-mail et votre mot de passe, puis choisissez un nouveau code."))) return;
    signOutAndReload();
  }
  function signOutAndReload() {
    lsSet(lockKey(), null);
    Promise.resolve().then(api.logout).catch(function () {}).then(function () { location.reload(); });
  }

  function setupLock() {
    locked = true;
    return new Promise(function (done) {
      var first = null;
      var pad = pinPad({ title: T("Choisis ton code", "Choisissez votre code"), sub: T("4 chiffres, demandés à chaque ouverture de l'appli.", "4 chiffres, demandés à chaque ouverture de l'appli."),
        onDone: function (c, ui) {
          if (!first) { first = c; ui.reset(T("Confirme ton code", "Confirmez votre code"), T("Tape le même code une deuxième fois.", "Tapez le même code une deuxième fois.")); return; }
          if (c !== first) { first = null; ui.fail("Les codes ne correspondent pas."); ui.reset(T("Choisis ton code", "Choisissez votre code"), "Recommencez."); return; }
          var salt = b64(rand(16));
          hashPin(c, salt).then(function (h) {
            lsSet(lockKey(), { salt: salt, hash: h, bio: null, tries: 0 });
            return bioAvailable();
          }).then(function (ok) {
            if (!ok) return done();
            offerBio(done);
          });
        } });
      pad.foot.innerHTML = "";
    });
  }
  function offerBio(done) {
    var p = el("div", "ac-panel");
    p.innerHTML = '<div class="ac-head">' + mark() + '<h1 class="ac-h"></h1><p class="ac-p"></p></div><div class="ac-form"><div class="ac-msg" aria-live="polite"></div><button class="ac-btn" type="button" data-y>Activer</button><button class="ac-btn ac-ghost" type="button" data-n>Plus tard</button></div>';
    p.querySelector(".ac-h").textContent = "Activer " + bioName() + " ?";
    p.querySelector(".ac-p").textContent = T("Déverrouille l'appli d'un regard. Ton code reste utilisable à tout moment.", "Déverrouillez l'appli d'un regard. Votre code reste utilisable à tout moment.");
    show(p);
    p.querySelector("[data-n]").onclick = function () { done(); };
    p.querySelector("[data-y]").onclick = function () {
      var b = this; b.disabled = true;
      bioCreate().then(function (id) {
        var d = lockData() || {}; d.bio = id; lsSet(lockKey(), d); done();
      }, function () { b.disabled = false; p.querySelector(".ac-msg").textContent = "Activation impossible sur ce téléphone. Vous pouvez continuer avec le code."; });
    };
  }

  function unlock() {
    locked = true;
    return new Promise(function (done) {
      var d = lockData();
      function tryBio() {
        if (!d.bio) return;
        bioCheck(d.bio).then(function () { d.tries = 0; lsSet(lockKey(), d); done(); }, function () { /* l'utilisateur tape son code */ });
      }
      var ui = pinPad({ title: T("Entre ton code", "Entrez votre code"), who: maskMail(user && user.email), bio: d.bio ? tryBio : null,
        onDone: function (c, ui) {
          hashPin(c, d.salt).then(function (h) {
            if (h === d.hash) { d.tries = 0; lsSet(lockKey(), d); return done(); }
            d.tries = (d.tries || 0) + 1; lsSet(lockKey(), d);
            var left = MAX_TRIES - d.tries;
            if (left <= 0) { ui.fail(T("Trop d'essais : reconnecte-toi.", "Trop d'essais : reconnectez-vous.")); return setTimeout(signOutAndReload, 1200); }
            ui.fail("Code incorrect. " + left + (left > 1 ? " essais restants." : " essai restant."));
          });
        } });
      ui.foot.innerHTML = '<button type="button" class="ac-link">Code oublié ?</button>';
      ui.foot.firstChild.onclick = forgot;
      if (d.bio) setTimeout(tryBio, 350);
    });
  }

  /* ---------- déroulé ---------- */
  function needLock() { return C.lock !== false && user && !user.is_anonymous; }
  function guard() {
    if (needLock()) {
      var d = lockData();
      return (d && d.hash ? unlock() : setupLock()).then(function () { locked = false; });
    }
    return Promise.resolve();
  }

  function start() {
    splash();
    currentUser().catch(function () { return null; }).then(function (u) {
      user = u;
      return splashDone().then(function () {
        if (recovering && user && C.resetLink) return loginScreen("newpw");
        if (C.requireAccount !== false && (!user || user.is_anonymous)) return loginScreen("in");
        return guard().then(close);
      });
    });

    // Re-verrouillage après un moment hors de l'appli
    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > RELOCK_MS && !locked && !box && needLock() && lockData()) {
        unlock().then(function () { locked = false; close(); });
      }
      hiddenAt = 0;
    });

    // Connexion / déconnexion faites ailleurs dans la page (ex. espace chauffeur)
    api.client().then(function (sb) {
      sb.auth.onAuthStateChange(function (ev, session) {
        var u = session && session.user;
        if (ev === "PASSWORD_RECOVERY" && C.resetLink) { user = u; recovering = true; return loginScreen("newpw"); }
        if (ev === "SIGNED_OUT") { user = null; if (C.requireAccount !== false) loginScreen("in"); return; }
        if (ev === "SIGNED_IN" && u && !u.is_anonymous && (!user || user.id !== u.id) && !box && !locked) {
          user = u; guard().then(close);
        } else if (u) user = u;
      });
    }).catch(function () {});
  }

  window.Acces = { lockNow: function () { if (!box && needLock() && lockData()) unlock().then(function () { locked = false; close(); }); }, standalone: standalone };
  start();
})();
