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

// ------------------------------------------------------------------ icônes (traits fins, style de la maquette)
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  rides: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4"/>',
  wallet: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M12 7v10M14.5 9.2c-.6-.7-1.5-1-2.5-1-1.4 0-2.5.7-2.5 1.8 0 2.6 5 1.3 5 3.9 0 1.1-1.1 1.9-2.5 1.9-1.1 0-2-.4-2.6-1.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  car: '<path d="M5 16V12l2-5h10l2 5v4"/><path d="M3 12h18v5H3z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.1.6 3.5 2.4 3.5 5.2"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>', chevL: '<path d="M15 5l-7 7 7 7"/>', back: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  phone: '<path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  msg: '<rect x="3" y="5" width="18" height="13" rx="3"/><path d="M7 10l5 3 5-3"/>',
  nav: '<path d="M12 2l7 19-7-4-7 4z"/>', locate: '<path d="M3 11l18-8-8 18-2-8z"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>', pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  admin: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>', power: '<path d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  arrows: '<path d="M6 7l5 5-5 5M13 7l5 5-5 5"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  "turn-left": '<path d="M15 20v-7a3 3 0 0 0-3-3H5M9 6l-4 4 4 4"/>', "turn-right": '<path d="M9 20v-7a3 3 0 0 1 3-3h7M15 6l4 4-4 4"/>',
  straight: '<path d="M12 20V4M6 10l6-6 6 6"/>', uturn: '<path d="M8 20V9a4 4 0 0 1 8 0v4M12 10l4 4 4-4"/>', flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
};
export const icon = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;

// ------------------------------------------------------------------ carte sombre (Leaflet + CARTO / OpenStreetMap)
export function makeMap(el, opts = {}) {
  if (!window.L) { el.innerHTML = ""; return null; }
  const map = L.map(el, { zoomControl: false, attributionControl: true, ...opts }).setView([48.8566, 2.3522], 12);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap © CARTO",
  }).addTo(map);
  return map;
}
export const dot = (color) => L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
export const pinIcon = (start = false) => L.divIcon({ className: "", html: `<div class="pin ${start ? "start" : ""}"></div>`, iconSize: [30, 30], iconAnchor: [15, 30] });
export const meIcon = () => L.divIcon({ className: "", html: `<div class="me-dot"><svg viewBox="0 0 24 24"><path d="M12 2l7 19-7-4-7 4z"/></svg></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
export const carIcon = () => L.divIcon({ className: "", html: `<div class="me-dot"><svg viewBox="0 0 24 24"><path d="M12 2l7 19-7-4-7 4z"/></svg></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
export const labelIcon = (title, sub) => L.divIcon({ className: "", html: `<div class="map-label">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ""}</div>`, iconSize: null, iconAnchor: [-14, 46] });
export function routeLayer(map, coords) {
  const glow = L.polyline(coords, { color: "#1f7aff", weight: 12, opacity: .25 }).addTo(map);
  const line = L.polyline(coords, { color: "#3d8bff", weight: 5, opacity: 1 }).addTo(map);
  return { remove: () => { glow.remove(); line.remove(); }, bounds: line.getBounds() };
}

/** Itinéraire routier (OSRM, gratuit) avec la prochaine manœuvre. Sans réseau : ligne droite estimée. */
export async function getRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const r = await fetch(url);
    const j = await r.json();
    const rt = j.routes?.[0];
    if (!rt) throw new Error("NO_ROUTE");
    const steps = rt.legs?.[0]?.steps || [];
    const nextStep = steps[1] || steps[0];
    return {
      coords: rt.geometry.coordinates.map(([x, y]) => [y, x]), distance: rt.distance, duration: rt.duration,
      next: nextStep ? { type: nextStep.maneuver?.type, modifier: nextStep.maneuver?.modifier || "", name: nextStep.name || nextStep.destinations || "", distance: steps[0]?.distance ?? 0 } : null,
    };
  } catch {
    const R = 6371e3, rad = (d) => (d * Math.PI) / 180;
    const h = Math.sin(rad(to.lat - from.lat) / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(h)) * 1.35;
    return { coords: [[from.lat, from.lng], [to.lat, to.lng]], distance: d, duration: d / 7.8 + 120, next: null };
  }
}
export function turnIcon(next) {
  if (!next) return "straight";
  if (next.type === "arrive") return "flag";
  const m = next.modifier;
  if (m.includes("uturn")) return "uturn";
  if (m.includes("left")) return "turn-left";
  if (m.includes("right")) return "turn-right";
  return "straight";
}
export const fmtDist = (m) => (m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", lang === "en" ? "." : ",")} km`);
export const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

/** Écran de chargement : retiré dès que l'appli est prête. */
export function hideSplash() { const s = document.getElementById("splash"); if (s) { s.classList.add("out"); setTimeout(() => s.remove(), 400); } }

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
