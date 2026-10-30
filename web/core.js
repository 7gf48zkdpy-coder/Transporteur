// Transporteur VTC — code commun (client et chauffeur)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Projet Supabase « transporteur ». La clé publishable est faite pour être publique :
// les données sont protégées par les règles d'accès de la base (Row Level Security).
export const SUPABASE_URL = "https://zzkxkbvnhfhtdkpeljjz.supabase.co";
export const SUPABASE_KEY = "sb_publishable_yFtcdcTEuDAAynPBYIUOpA_0PT_fks1";

// Lien « mot de passe oublié » : repéré avant que Supabase ne nettoie l'adresse.
export const isRecovery = /type=recovery/.test(location.hash);

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// ------------------------------------------------------------------ langues
const DICT = {
  fr: {
    tagline: "Votre chauffeur privé en Île-de-France", driverSpace: "Espace chauffeur",
    login: "Se connecter", signup: "Créer un compte", logout: "Déconnexion", email: "E-mail", password: "Mot de passe",
    name: "Prénom et nom", phone: "Téléphone", noAccount: "Pas encore de compte ?", haveAccount: "Déjà un compte ?",
    forgot: "Mot de passe oublié ?", sendReset: "Recevoir un lien", resetSent: "E-mail de réinitialisation envoyé.", checkEmail: "Compte créé. Confirmez votre adresse via l'e-mail reçu, puis connectez-vous.",
    newPassword: "Nouveau mot de passe", save: "Enregistrer", saved: "Enregistré", cancel: "Annuler", close: "Fermer", back: "Retour",
    pickup: "Départ", destination: "Arrivée", myPosition: "Ma position", when: "Quand ?", now: "Maintenant", later: "Plus tard",
    passengers: "Passagers", notes: "Note pour le chauffeur (optionnel)", seePrices: "Voir les prix", chooseVehicle: "Choisissez votre véhicule",
    estimated: "Itinéraire estimé", fixed: "Forfait", priceGuaranteed: "Prix total garanti", payment: "Paiement",
    card: "Carte bancaire", onBoard: "À bord", onBoardHint: "Vous payez le chauffeur pendant la course (espèces, carte sur TPE, virement).",
    cardHint: "Montant réservé sur votre carte, débité à la fin de la course.", book: "Réserver", bookFor: "Réserver pour",
    payNow: "Valider le paiement", cardUnavailable: "Le paiement par carte n'est pas encore disponible. Choisissez « À bord ».",
    myRide: "Ma course", history: "Mes courses", noHistory: "Aucune course pour l'instant.", newRide: "Nouvelle course",
    driver: "Chauffeur", vehicle: "Véhicule", plate: "Immatriculation", call: "Appeler", cancelRide: "Annuler la course",
    cancelConfirm: "Annuler cette course ?", feeWarning: "Le chauffeur est en route : des frais d'annulation s'appliquent.",
    rate: "Notez votre chauffeur", thanks: "Merci !", price: "Prix", scheduledFor: "Prévue le", min: "min", km: "km",
    driversNearby: "chauffeur(s) à proximité", noDriverNearby: "Pas de chauffeur proche pour l'instant",
    s_REQUESTED: "Recherche d'un chauffeur", s_OFFERED: "Proposée", s_ACCEPTED: "Chauffeur trouvé", s_DRIVER_ARRIVING: "Chauffeur en route",
    s_IN_PROGRESS: "Course en cours", s_COMPLETED: "Terminée", s_CANCELLED: "Annulée",
    p_PENDING: "À payer", p_AUTHORIZED: "Carte autorisée", p_CAPTURED: "Payée", p_CANCELED: "Non débitée", p_REFUNDED: "Remboursée", p_FAILED: "Échec du paiement",
    awaitingPayment: "En attente de validation du paiement par carte…", searching: "Les chauffeurs disponibles sont prévenus. Restez sur cette page.",
    v_BERLINE: "Berline", v_ELECTRIC: "Électrique", v_VAN: "Van", v_SUV: "SUV", v_PREMIUM: "Premium",
    // chauffeur
    rides: "Courses", profile: "Profil", documents: "Documents", earnings: "Gains", admin: "Admin",
    available: "Disponible", unavailable: "Hors ligne", accept: "Accepter", onMyWay: "Je pars", clientOnBoard: "Client à bord",
    finish: "Terminer la course", release: "Me désister", noShow: "Client absent", navigate: "Itinéraire",
    waitingRides: "Courses disponibles", noRides: "Aucune course en attente.", activeRide: "Course en cours",
    youEarn: "Vous gagnez", collect: "À encaisser", client: "Client",
    partner_PENDING: "Dossier à compléter", partner_IN_REVIEW: "Dossier en cours de vérification", partner_VALIDATED: "Compte validé",
    partner_SUSPENDED: "Compte suspendu", partner_REJECTED: "Dossier refusé",
    stepVehicle: "Renseigner votre véhicule", stepDocs: "Envoyer vos 8 justificatifs", stepReview: "Validation par Transporteur",
    vehicleType: "Catégorie", make: "Marque", model: "Modèle", color: "Couleur", year: "Année", capacity: "Places passagers", siret: "SIRET",
    upload: "Envoyer", replace: "Remplacer", expires: "Expire le", d_PENDING: "En vérification", d_APPROVED: "Approuvé", d_REJECTED: "Refusé", d_EXPIRED: "Expiré", d_MISSING: "À envoyer",
    doc_CARTE_VTC: "Carte professionnelle VTC", doc_PERMIS_B: "Permis B", doc_PIECE_IDENTITE: "Pièce d'identité",
    doc_ASSURANCE_RC_CIRCULATION: "Assurance RC circulation", doc_ASSURANCE_RC_PRO: "Assurance RC professionnelle",
    doc_CARTE_GRISE: "Carte grise", doc_REGISTRE_EVTC: "Inscription au registre EVTC", doc_KBIS_OU_SIRENE: "Kbis ou avis SIRENE",
    cardPayouts: "Paiements par carte", cardPayoutsOff: "Pour recevoir aussi les courses payées par carte, activez vos versements Stripe.",
    cardPayoutsOn: "Versements activés : vous recevez aussi les courses payées par carte.", activateStripe: "Activer mes versements", checkStripe: "Vérifier l'activation",
    totalEarned: "Total gagné", ridesDone: "Courses terminées", commissionOwed: "Commission due (courses à bord)",
    notDriver: "Ce compte n'est pas un compte chauffeur. Créez un compte chauffeur avec une autre adresse e-mail.",
    drivers: "Chauffeurs", allRides: "Toutes les courses", approve: "Approuver", reject: "Refuser", validate: "Valider le chauffeur",
    suspend: "Suspendre", reactivate: "Réactiver", view: "Voir", reason: "Motif", becomeAvailable: "Passez « Disponible » pour recevoir des courses.",
    geoDenied: "Activez la localisation pour que les clients vous voient arriver.", newRequest: "Nouvelle demande", expiryOpt: "Date d'expiration (optionnel)",
  },
  en: {
    tagline: "Your private driver in Paris region", driverSpace: "Driver space",
    login: "Log in", signup: "Create account", logout: "Log out", email: "Email", password: "Password",
    name: "Full name", phone: "Phone", noAccount: "No account yet?", haveAccount: "Already have an account?",
    forgot: "Forgot password?", sendReset: "Send reset link", resetSent: "Reset email sent.", checkEmail: "Account created. Confirm your address from the email, then log in.",
    newPassword: "New password", save: "Save", saved: "Saved", cancel: "Cancel", close: "Close", back: "Back",
    pickup: "Pickup", destination: "Destination", myPosition: "My location", when: "When?", now: "Now", later: "Later",
    passengers: "Passengers", notes: "Note for the driver (optional)", seePrices: "See prices", chooseVehicle: "Choose your vehicle",
    estimated: "Estimated route", fixed: "Flat rate", priceGuaranteed: "Guaranteed total price", payment: "Payment",
    card: "Card", onBoard: "On board", onBoardHint: "Pay the driver during the ride (cash, card terminal, transfer).",
    cardHint: "Amount held on your card, charged at the end of the ride.", book: "Book", bookFor: "Book for",
    payNow: "Confirm payment", cardUnavailable: "Card payment is not available yet. Choose “On board”.",
    myRide: "My ride", history: "My rides", noHistory: "No rides yet.", newRide: "New ride",
    driver: "Driver", vehicle: "Vehicle", plate: "Plate", call: "Call", cancelRide: "Cancel ride",
    cancelConfirm: "Cancel this ride?", feeWarning: "Your driver is on the way: a cancellation fee applies.",
    rate: "Rate your driver", thanks: "Thank you!", price: "Price", scheduledFor: "Scheduled for", min: "min", km: "km",
    driversNearby: "driver(s) nearby", noDriverNearby: "No driver nearby right now",
    s_REQUESTED: "Finding a driver", s_OFFERED: "Offered", s_ACCEPTED: "Driver found", s_DRIVER_ARRIVING: "Driver on the way",
    s_IN_PROGRESS: "Ride in progress", s_COMPLETED: "Completed", s_CANCELLED: "Cancelled",
    p_PENDING: "To pay", p_AUTHORIZED: "Card authorized", p_CAPTURED: "Paid", p_CANCELED: "Not charged", p_REFUNDED: "Refunded", p_FAILED: "Payment failed",
    awaitingPayment: "Waiting for card payment confirmation…", searching: "Available drivers have been notified. Stay on this page.",
    v_BERLINE: "Sedan", v_ELECTRIC: "Electric", v_VAN: "Van", v_SUV: "SUV", v_PREMIUM: "Premium",
    rides: "Rides", profile: "Profile", documents: "Documents", earnings: "Earnings", admin: "Admin",
    available: "Available", unavailable: "Offline", accept: "Accept", onMyWay: "On my way", clientOnBoard: "Client on board",
    finish: "Finish ride", release: "Release ride", noShow: "No-show", navigate: "Directions",
    waitingRides: "Available rides", noRides: "No rides waiting.", activeRide: "Current ride",
    youEarn: "You earn", collect: "To collect", client: "Client",
    partner_PENDING: "Application incomplete", partner_IN_REVIEW: "Application under review", partner_VALIDATED: "Account approved",
    partner_SUSPENDED: "Account suspended", partner_REJECTED: "Application rejected",
    stepVehicle: "Add your vehicle", stepDocs: "Upload your 8 documents", stepReview: "Review by Transporteur",
    vehicleType: "Category", make: "Make", model: "Model", color: "Color", year: "Year", capacity: "Passenger seats", siret: "SIRET",
    upload: "Upload", replace: "Replace", expires: "Expires", d_PENDING: "Under review", d_APPROVED: "Approved", d_REJECTED: "Rejected", d_EXPIRED: "Expired", d_MISSING: "Missing",
    doc_CARTE_VTC: "VTC professional card", doc_PERMIS_B: "Driving licence", doc_PIECE_IDENTITE: "ID document",
    doc_ASSURANCE_RC_CIRCULATION: "Motor liability insurance", doc_ASSURANCE_RC_PRO: "Professional liability insurance",
    doc_CARTE_GRISE: "Vehicle registration", doc_REGISTRE_EVTC: "EVTC register", doc_KBIS_OU_SIRENE: "Kbis or SIRENE notice",
    cardPayouts: "Card payments", cardPayoutsOff: "To also receive card-paid rides, activate your Stripe payouts.",
    cardPayoutsOn: "Payouts active: you also receive card-paid rides.", activateStripe: "Activate payouts", checkStripe: "Check activation",
    totalEarned: "Total earned", ridesDone: "Completed rides", commissionOwed: "Commission owed (on-board rides)",
    notDriver: "This is not a driver account. Create a driver account with another email address.",
    drivers: "Drivers", allRides: "All rides", approve: "Approve", reject: "Reject", validate: "Approve driver",
    suspend: "Suspend", reactivate: "Reactivate", view: "View", reason: "Reason", becomeAvailable: "Switch to “Available” to receive rides.",
    geoDenied: "Enable location so clients can see you coming.", newRequest: "New request", expiryOpt: "Expiry date (optional)",
  },
};

const ERRORS = {
  fr: {
    "Invalid login credentials": "E-mail ou mot de passe incorrect.", "User already registered": "Un compte existe déjà avec cet e-mail.",
    "Email not confirmed": "Confirmez d'abord votre adresse e-mail (voir l'e-mail reçu).",
    OUTSIDE_SERVICE_AREA: "Transporteur ne dessert que l'Île-de-France.", TRIP_TOO_SHORT: "Trajet trop court.", TRIP_TOO_LONG: "Trajet trop long.",
    QUOTE_EXPIRED: "Le prix a expiré, relancez la recherche.", QUOTE_ALREADY_USED: "Ce prix a déjà été utilisé, relancez la recherche.",
    ACTIVE_BOOKING_EXISTS: "Vous avez déjà une course en cours.", SCHEDULE_OUT_OF_RANGE: "Réservation possible jusqu'à 6 jours à l'avance.",
    BOOKING_ALREADY_TAKEN: "Course déjà prise par un autre chauffeur.", DRIVER_BUSY: "Vous avez déjà une course en cours.",
    DRIVER_NOT_VALIDATED: "Votre compte n'est pas encore validé.", DRIVER_NOT_AVAILABLE: "Passez « Disponible » d'abord.",
    NO_ACTIVE_VEHICLE: "Renseignez d'abord votre véhicule (onglet Profil).", VEHICLE_TYPE_MISMATCH: "Cette course demande une autre catégorie de véhicule.",
    VEHICLE_TOO_SMALL: "Pas assez de places dans votre véhicule.", PAYOUTS_NOT_ENABLED: "Course payée par carte : activez d'abord vos versements Stripe.",
    PAYMENT_NOT_AUTHORIZED: "Paiement pas encore validé.", RIDE_IN_PROGRESS: "La course a commencé, annulation impossible.",
    DOCUMENTS_INCOMPLETE: "Les 8 justificatifs doivent être approuvés (et valides) avant de valider le chauffeur.",
    NO_SHOW_ONLY_ON_ARRIVAL: "Possible seulement quand vous êtes en route vers le client.", INVALID_TRANSITION: "Action impossible à ce stade.",
    BOOKING_CLOSED: "Course déjà terminée ou annulée.", NETWORK: "Connexion impossible. Vérifiez votre réseau.",
  },
  en: {
    "Invalid login credentials": "Wrong email or password.", "User already registered": "An account already exists with this email.",
    "Email not confirmed": "Please confirm your email first.",
    OUTSIDE_SERVICE_AREA: "Transporteur only serves the Paris region.", TRIP_TOO_SHORT: "Trip too short.", TRIP_TOO_LONG: "Trip too long.",
    QUOTE_EXPIRED: "Price expired, search again.", QUOTE_ALREADY_USED: "Price already used, search again.",
    ACTIVE_BOOKING_EXISTS: "You already have a ride in progress.", SCHEDULE_OUT_OF_RANGE: "You can book up to 6 days ahead.",
    BOOKING_ALREADY_TAKEN: "Ride already taken.", DRIVER_BUSY: "You already have a ride in progress.",
    DRIVER_NOT_VALIDATED: "Your account is not approved yet.", DRIVER_NOT_AVAILABLE: "Switch to “Available” first.",
    NO_ACTIVE_VEHICLE: "Add your vehicle first (Profile tab).", VEHICLE_TYPE_MISMATCH: "This ride needs another vehicle category.",
    VEHICLE_TOO_SMALL: "Not enough seats in your vehicle.", PAYOUTS_NOT_ENABLED: "Card-paid ride: activate Stripe payouts first.",
    PAYMENT_NOT_AUTHORIZED: "Payment not confirmed yet.", RIDE_IN_PROGRESS: "Ride already started.",
    DOCUMENTS_INCOMPLETE: "All 8 documents must be approved and valid first.",
    NO_SHOW_ONLY_ON_ARRIVAL: "Only possible while driving to the client.", INVALID_TRANSITION: "Not possible at this stage.",
    BOOKING_CLOSED: "Ride already closed.", NETWORK: "Network error. Check your connection.",
  },
};

export let lang = (() => { try { return localStorage.getItem("lang") || (navigator.language || "fr").slice(0, 2); } catch { return "fr"; } })();
if (!DICT[lang]) lang = "fr";
export const t = (k) => DICT[lang][k] ?? DICT.fr[k] ?? k;
export function toggleLang() {
  lang = lang === "fr" ? "en" : "fr";
  try { localStorage.setItem("lang", lang); } catch { /* stockage indisponible */ }
  document.documentElement.lang = lang;
}
document.documentElement.lang = lang;

/** Message lisible à partir d'une erreur Supabase / Edge Function / code métier. */
export async function errText(e) {
  let code = e?.message || String(e);
  try {
    if (e?.context && typeof e.context.json === "function") {
      const j = await e.context.json();
      code = j.error || j.message || code;
    }
  } catch { /* corps illisible */ }
  if (/Failed to fetch|NetworkError|Load failed/i.test(code)) code = "NETWORK";
  if (/^MISSING_ENV_STRIPE|STRIPE/.test(code)) return t("cardUnavailable");
  const m = code.match(/[A-Z][A-Z_]{3,}/);
  return ERRORS[lang][code] || (m && ERRORS[lang][m[0]]) || code;
}

export async function call(fn, body) {
  const { data, error } = await sb.functions.invoke(fn, { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------------ petits outils
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const euro = (cents) => (cents == null ? "—" : (cents / 100).toLocaleString(lang === "en" ? "en-GB" : "fr-FR", { style: "currency", currency: "EUR" }));
export const fmtDate = (d) => new Date(d).toLocaleString(lang === "en" ? "en-GB" : "fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const VEHICLE_ICON = { BERLINE: "🚘", ELECTRIC: "⚡", VAN: "🚐", SUV: "🚙", PREMIUM: "🖤" };

export function toast(msg, bad = false) {
  document.querySelectorAll(".toast").forEach((n) => n.remove());
  const n = document.createElement("div");
  n.className = "toast" + (bad ? " bad" : "");
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), bad ? 5000 : 2600);
}

export function statusBadge(s) {
  const cls = { COMPLETED: "ok", CANCELLED: "bad", REQUESTED: "warn" }[s] || "";
  return `<span class="badge ${cls}">${esc(t("s_" + s))}</span>`;
}

/** Bouton qui se désactive pendant l'action et affiche l'erreur éventuelle. */
export async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); }
  catch (e) { toast(await errText(e), true); }
  finally { if (btn) btn.disabled = false; }
}

// ------------------------------------------------------------------ adresses (Géoplateforme IGN, gratuit)
const GEO = "https://data.geopf.fr/geocodage";
function toPlace(f) {
  const p = f.properties || {};
  const first = (v) => (Array.isArray(v) ? v[0] : v);
  const label = p.label || [first(p.toponym) || first(p.name), first(p.city)].filter(Boolean).join(", ");
  const postcode = first(p.postcode);
  return { label, detail: p.context || first(p.city) || "", lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], postcode: /^\d{5}$/.test(postcode || "") ? postcode : undefined };
}
export async function geocode(q, near) {
  const params = new URLSearchParams({ q, limit: "6", index: "address,poi" });
  if (near) { params.set("lat", near.lat); params.set("lon", near.lng); }
  const r = await fetch(`${GEO}/search?${params}`);
  if (!r.ok) return [];
  const j = await r.json();
  const seen = new Set();
  return (j.features || []).map(toPlace).filter((p) => p.label && !seen.has(p.label) && seen.add(p.label));
}
export async function reverseGeocode(lat, lng) {
  const r = await fetch(`${GEO}/reverse?lat=${lat}&lon=${lng}&limit=1&index=address`);
  if (!r.ok) return null;
  const j = await r.json();
  return j.features?.[0] ? toPlace(j.features[0]) : null;
}

/** Champ d'adresse avec suggestions. onPick(place) à chaque choix. */
export function addressField(input, onPick, getNear) {
  const box = document.createElement("ul");
  box.className = "hidden";
  input.parentElement.classList.add("suggest");
  input.parentElement.appendChild(box);
  let timer, items = [], idx = -1;
  const close = () => { box.classList.add("hidden"); idx = -1; };
  const show = () => {
    box.innerHTML = items.map((p, i) => `<li data-i="${i}" class="${i === idx ? "on" : ""}">${esc(p.label)}${p.detail ? `<small>${esc(p.detail)}</small>` : ""}</li>`).join("");
    box.classList.toggle("hidden", !items.length);
  };
  const pick = (p) => { input.value = p.label; close(); onPick(p); };
  input.addEventListener("input", () => {
    onPick(null);
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 3) { items = []; return close(); }
    timer = setTimeout(async () => { try { items = await geocode(q, getNear?.()); idx = -1; show(); } catch { /* réseau */ } }, 250);
  });
  input.addEventListener("keydown", (e) => {
    if (box.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") { idx = Math.min(items.length - 1, idx + 1); show(); e.preventDefault(); }
    if (e.key === "ArrowUp") { idx = Math.max(0, idx - 1); show(); e.preventDefault(); }
    if (e.key === "Enter" && items[Math.max(0, idx)]) { pick(items[Math.max(0, idx)]); e.preventDefault(); }
    if (e.key === "Escape") close();
  });
  box.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pick(items[+li.dataset.i]); } });
  input.addEventListener("blur", () => setTimeout(close, 150));
}

// ------------------------------------------------------------------ carte (Leaflet + OpenStreetMap)
export function makeMap(el) {
  if (!window.L) { el.innerHTML = ""; return null; }
  const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([48.8566, 2.3522], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  return map;
}
export const dot = (color) => L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
export const carIcon = () => L.divIcon({ className: "", html: `<div style="font-size:26px;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))">🚘</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });

// ------------------------------------------------------------------ compte
export async function currentProfile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  return data ? { ...data, user: session.user } : { id: session.user.id, role: null, user: session.user };
}

/** Écran de connexion / inscription. app = "client" | "driver". */
export function renderAuth(root, app, onDone, initial = "login") {
  let mode = initial;
  const draw = () => {
    const isUp = mode === "signup", isReset = mode === "reset", isNewPw = mode === "newpw";
    root.innerHTML = `
      <div class="hero"><img src="icon.svg" alt="Transporteur"><h1>Transporteur VTC</h1>
        <p class="muted">${app === "driver" ? t("driverSpace") : t("tagline")}</p></div>
      <form class="card" id="authForm">
        ${isNewPw ? `<label>${t("newPassword")}</label><input name="password" type="password" minlength="8" required autocomplete="new-password">` : `
        ${isUp ? `<label>${t("name")}</label><input name="name" required autocomplete="name">
                  <label>${t("phone")}</label><input name="phone" type="tel" required autocomplete="tel" placeholder="06 12 34 56 78">` : ""}
        <label>${t("email")}</label><input name="email" type="email" required autocomplete="email">
        ${isReset ? "" : `<label>${t("password")}</label><input name="password" type="password" minlength="8" required autocomplete="${isUp ? "new-password" : "current-password"}">`}`}
        <button class="btn" type="submit">${isNewPw ? t("save") : isReset ? t("sendReset") : isUp ? t("signup") : t("login")}</button>
        ${isNewPw ? "" : `<p class="center muted" style="margin:14px 0 0">
          ${mode === "login" ? `${t("noAccount")} <button type="button" class="link" data-m="signup">${t("signup")}</button><br><button type="button" class="link" data-m="reset">${t("forgot")}</button>`
                             : `${t("haveAccount")} <button type="button" class="link" data-m="login">${t("login")}</button>`}</p>`}
      </form>`;
    root.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => { mode = b.dataset.m; draw(); });
    root.querySelector("#authForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const btn = e.target.querySelector("button[type=submit]");
      await busy(btn, async () => {
        if (mode === "login") {
          const { error } = await sb.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
          if (error) throw error;
          onDone();
        } else if (mode === "signup") {
          const { data, error } = await sb.auth.signUp({
            email: f.email.trim(), password: f.password,
            options: { emailRedirectTo: location.origin + location.pathname,
              data: { display_name: f.name.trim(), phone: f.phone.trim(), lang, ...(app === "driver" ? { app: "driver" } : {}) } },
          });
          if (error) throw error;
          if (data.session) onDone(); else { toast(t("checkEmail")); mode = "login"; draw(); }
        } else if (mode === "reset") {
          const { error } = await sb.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: location.origin + location.pathname });
          if (error) throw error;
          toast(t("resetSent")); mode = "login"; draw();
        } else if (mode === "newpw") {
          const { error } = await sb.auth.updateUser({ password: f.password });
          if (error) throw error;
          history.replaceState(null, "", location.pathname); toast(t("saved")); onDone();
        }
      });
    };
  };
  sb.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") { mode = "newpw"; draw(); } });
  draw();
}

export function header(root, subtitle, onLogout) {
  root.innerHTML = `<img src="icon.svg" alt=""><div class="brand">Transporteur<small>${esc(subtitle)}</small></div>
    <button class="chip" id="langBtn">${lang === "fr" ? "EN" : "FR"}</button>
    ${onLogout ? `<button class="chip" id="outBtn">${t("logout")}</button>` : ""}`;
  root.querySelector("#langBtn").onclick = () => { toggleLang(); location.reload(); };
  if (onLogout) root.querySelector("#outBtn").onclick = onLogout;
}
