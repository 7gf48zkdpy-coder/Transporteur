// Transporteur VTC — espace chauffeur (maquette « Espace chauffeur ») et administration pour le compte ADMIN
import { sb, isRecovery, lang, t, toggleLang, $, esc, euro, fmtDate, toast, busy, call, rpc, errText, statusBadge,
  currentProfile, renderAuth, VEHICLE_ICON, icon, makeMap, pinIcon, meIcon, labelIcon, routeLayer, getRoute, turnIcon,
  fmtDist, initials, hideSplash } from "./core.js";
import { CAM, avatarHtml, pickAvatar, ratingLine, slideButton, celebrate, openChat, watchMessages, getSettings, registerSW } from "./ui.js";

// ------------------------------------------------------------------ textes propres à l'espace chauffeur
const W = {
  fr: {
    home: "Accueil", rides: "Courses", earnings: "Revenus", profile: "Profil", myProfile: "Mon profil", settings: "Paramètres", logout: "Se déconnecter",
    online: "En ligne", offline: "Hors ligne", onlineSub: "Vous recevez des courses", offlineSub: "Passez en ligne pour recevoir des courses",
    ridesToday: "Courses aujourd'hui", earnToday: "Revenus aujourd'hui", avgRating: "Note moyenne", nearby: "Demandes à proximité",
    details: "Voir les détails", noReq: "Aucune demande pour le moment.", goOnline: "Passez en ligne pour voir les demandes.",
    newReq: "Nouvelle demande", distance: "Distance", estDuration: "Durée estimée", price: "Prix", accept: "Accepter", refuse: "Refuser",
    expires: "Cette demande expirera dans", seconds: "secondes", passengers: "passager(s)", rideNow: "Course en cours", resume: "Reprendre la course",
    stop: "Arrêter", arrivalIn: "Arrivée dans", directions: "Itinéraire", client: "Client", pickup: "Prise en charge", destination: "Destination",
    goPickup: "Partir vers le client", onBoard: "Client à bord", finish: "Arrivée à destination", noShow: "Client absent",
    stopConfirm: "Arrêter cette course ? Elle sera proposée à un autre chauffeur.", toCollect: "À encaisser à bord",
    done: "Course terminée", paidCard: "Paiement effectué", paidBoard: "Encaissé à bord", farePrice: "Prix de la course",
    commission: "Commission (15 %)", yourEarn: "Vos revenus", newRide: "Commencer une nouvelle course", seeDetail: "Voir le détail",
    myRides: "Mes courses", upcoming: "En cours et à venir", history: "Historique", noRides: "Aucune course pour l'instant.",
    myEarnings: "Mes revenus", day: "Jour", week: "Semaine", month: "Mois", today: "Aujourd'hui", nRides: "course(s)",
    rideDetails: "Détail des courses", owed: "Commission due sur les courses à bord",
    myVehicle: "Mon véhicule", docs: "Documents", info: "Informations", edit: "Modifier", addVehicle: "Ajouter mon véhicule",
    availability: "Disponibilité", zones: "Zones de course", zonesVal: "Île-de-France", prefs: "Préférences de courses",
    notifs: "Notifications", notifsSub: "Alerte et son à chaque nouvelle demande", language: "Langue", cardPay: "Paiements par carte",
    cardOn: "Activés", cardOff: "À activer", admin: "Administration", driverSpace: "Espace chauffeur", steps: "Votre dossier",
    complete: "Compléter mon dossier", validated: "Validé", ratingN: "courses", security: "Urgence", call112: "Appeler le 112 ?",
    stats: "Statistiques", loading: "Chargement…", accepted: "Course acceptée", acceptedSub: "En route vers", fromYou: "de vous",
    messages: "Messages", noActive: "Aucune course en cours : la messagerie s'ouvre quand vous avez une course.", help: "Aide et support",
    terms: "Conditions d'utilisation", privacy: "Confidentialité", receipt: "Reçu (PDF)", rateClient: "Notez votre client", thanks: "Merci !",
    company: "Mon entreprise", companySub: "Utilisé pour les mentions légales, les CGV et les reçus", changePhoto: "Changer la photo",
    cName: "Nom commercial", cForm: "Forme (EI, SASU…)", cAddress: "Adresse", cEmail: "E-mail de contact", cPhone: "Téléphone", cEvtc: "N° registre VTC",
    cMediator: "Médiateur de la consommation", cBoss: "Directeur de la publication", cVat: "TVA", cVatNo: "Non applicable (293 B)", cVatYes: "Assujetti", cCancel: "Politique d'annulation",
  },
  en: {
    home: "Home", rides: "Rides", earnings: "Earnings", profile: "Profile", myProfile: "My profile", settings: "Settings", logout: "Log out",
    online: "Online", offline: "Offline", onlineSub: "You receive rides", offlineSub: "Go online to receive rides",
    ridesToday: "Rides today", earnToday: "Earnings today", avgRating: "Average rating", nearby: "Nearby requests",
    details: "See details", noReq: "No requests right now.", goOnline: "Go online to see requests.",
    newReq: "New request", distance: "Distance", estDuration: "Est. duration", price: "Price", accept: "Accept", refuse: "Decline",
    expires: "This request expires in", seconds: "seconds", passengers: "passenger(s)", rideNow: "Current ride", resume: "Resume ride",
    stop: "Stop", arrivalIn: "Arrival in", directions: "Directions", client: "Client", pickup: "Pickup", destination: "Destination",
    goPickup: "Head to the client", onBoard: "Client on board", finish: "Arrived at destination", noShow: "No-show",
    stopConfirm: "Stop this ride? It will be offered to another driver.", toCollect: "To collect on board",
    done: "Ride completed", paidCard: "Payment received", paidBoard: "Collected on board", farePrice: "Ride price",
    commission: "Commission (15%)", yourEarn: "Your earnings", newRide: "Start a new ride", seeDetail: "See details",
    myRides: "My rides", upcoming: "Current and upcoming", history: "History", noRides: "No rides yet.",
    myEarnings: "My earnings", day: "Day", week: "Week", month: "Month", today: "Today", nRides: "ride(s)",
    rideDetails: "Ride details", owed: "Commission owed on on-board rides",
    myVehicle: "My vehicle", docs: "Documents", info: "Information", edit: "Edit", addVehicle: "Add my vehicle",
    availability: "Availability", zones: "Service area", zonesVal: "Paris region", prefs: "Ride preferences",
    notifs: "Notifications", notifsSub: "Alert and sound for each new request", language: "Language", cardPay: "Card payments",
    cardOn: "Active", cardOff: "To activate", admin: "Administration", driverSpace: "Driver space", steps: "Your application",
    complete: "Complete my application", validated: "Approved", ratingN: "rides", security: "Emergency", call112: "Call 112?",
    stats: "Statistics", loading: "Loading…", accepted: "Ride accepted", acceptedSub: "Heading to", fromYou: "from you",
    messages: "Messages", noActive: "No current ride: messaging opens when you have a ride.", help: "Help & support",
    terms: "Terms of use", privacy: "Privacy", receipt: "Receipt (PDF)", rateClient: "Rate your client", thanks: "Thank you!",
    company: "My company", companySub: "Used for legal notice, terms and receipts", changePhoto: "Change photo",
    cName: "Trade name", cForm: "Legal form", cAddress: "Address", cEmail: "Contact email", cPhone: "Phone", cEvtc: "VTC register no.",
    cMediator: "Consumer mediator", cBoss: "Publication director", cVat: "VAT", cVatNo: "Not applicable", cVatYes: "Registered", cCancel: "Cancellation policy",
  },
};
const w = (k) => W[lang]?.[k] ?? W.fr[k] ?? t(k);

const DOC_TYPES = ["CARTE_VTC", "PERMIS_B", "PIECE_IDENTITE", "ASSURANCE_RC_CIRCULATION", "ASSURANCE_RC_PRO", "CARTE_GRISE", "REGISTRE_EVTC", "KBIS_OU_SIRENE"];
const VEHICLES = ["BERLINE", "ELECTRIC", "VAN"];
const RUNNING = ["ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"];
const app = $("#app"), top = $("#top"), tabbar = $("#tabbar"), overlay = $("#overlay");
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* indisponible */ } } };

let me = null, driver = null, vehicle = null, view = "home", sub = null;
let mine = [], feed = [], todayRows = [];
let channel = null, pollTimer = null, redrawTimer = null, recoveryDone = false;
let myPos = null, geoWatch = null, lastSent = 0, geoWarned = false;
let overlayMode = null; // "request" | "nav" | "done"
const seen = new Set(store.get("seenReq", []));
const refused = new Set(store.get("refusedReq", []));
let soundOn = store.get("sound", true), notifOn = store.get("notif", false);

// ------------------------------------------------------------------ démarrage
async function start() {
  registerSW();
  me = await currentProfile();
  hideSplash();
  if (!me) { header(false); tabbar.classList.add("hidden"); return renderAuth(app, "driver", start); }
  if (isRecovery && !recoveryDone && (recoveryDone = true)) return renderAuth(app, "driver", start, "newpw");
  if (me.role !== "DRIVER" && me.role !== "ADMIN") { header(true); app.innerHTML = `<div class="card">${esc(t("notDriver"))}</div>`; return; }
  await loadAll();
  if (!driver && me.role === "ADMIN") view = "admin";
  for (const b of feed) seen.add(b.id); // les demandes déjà là ne sonnent pas
  subscribe();
  if (driver?.is_available || mine.length) startGeo();
  render();
  const running = mine.find((b) => b.status !== "ACCEPTED" || !b.scheduled_at || new Date(b.scheduled_at) < Date.now() + 3600e3);
  if (running) openNav(running.id);
}

async function loadAll() {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const [d, v] = await Promise.all([
    sb.from("drivers").select("*").eq("user_id", me.id).maybeSingle(),
    sb.from("vehicles").select("*").eq("driver_user_id", me.id).order("created_at", { ascending: false }).limit(1),
  ]);
  driver = d.data; vehicle = v.data?.[0] || null;
  if (!driver) return;
  const [m, f, td] = await Promise.all([
    sb.from("bookings").select("*").eq("driver_user_id", me.id).in("status", RUNNING).order("scheduled_at", { ascending: true, nullsFirst: true }),
    driver.is_available && driver.partner_status === "VALIDATED"
      ? sb.from("bookings").select("*").eq("status", "REQUESTED").is("driver_user_id", null).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    sb.from("bookings").select("final_fare_cents, driver_earnings_cents, completed_at").eq("driver_user_id", me.id).eq("status", "COMPLETED").gte("completed_at", dayStart.toISOString()),
  ]);
  mine = m.data || []; feed = (f.data || []).filter((b) => !refused.has(b.id)); todayRows = td.data || [];
}

function subscribe() {
  if (channel) return;
  channel = sb.channel("driver-" + me.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => scheduleRefresh())
    .subscribe();
  pollTimer = setInterval(scheduleRefresh, 20000);
}
function scheduleRefresh() { clearTimeout(redrawTimer); redrawTimer = setTimeout(refresh, 400); }
async function refresh() {
  if (!me) return;
  await loadAll();
  const fresh = feed.filter((b) => !seen.has(b.id));
  fresh.forEach((b) => seen.add(b.id));
  store.set("seenReq", [...seen].slice(-200));
  if (fresh.length && !overlayMode && driver?.is_available) { alertNew(fresh[0]); openRequest(fresh[0], true); }
  if (!overlayMode && ["home", "rides", "admin"].includes(view)) render();
  if (overlayMode === "nav") navRefresh?.();
}

// Alerte nouvelle demande : son, vibration, notification système
function alertNew(b) {
  if (soundOn) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach((d, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = [880, 1175, 1568][i];
        g.gain.setValueAtTime(.2, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + d + .16);
        o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + .17); });
    } catch { /* audio bloqué */ }
  }
  navigator.vibrate?.([200, 100, 200]);
  if (notifOn && "Notification" in window && Notification.permission === "granted" && document.hidden) {
    try { new Notification(w("newReq"), { body: `${short(b.pickup_label)} → ${short(b.destination_label)} · ${euro(b.quoted_fare_cents)}`, icon: "icon-192.png" }); } catch { /* indisponible */ }
  }
}

// ------------------------------------------------------------------ position du chauffeur
function startGeo() {
  if (geoWatch != null || !navigator.geolocation) return;
  geoWatch = navigator.geolocation.watchPosition(async (pos) => {
    myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading };
    onPos?.(myPos);
    if (!driver || driver.partner_status !== "VALIDATED" || (!driver.is_available && !mine.length)) return;
    if (Date.now() - lastSent < 10000) return;
    lastSent = Date.now();
    const c = pos.coords;
    await sb.from("driver_locations").upsert({ driver_user_id: me.id, lat: c.latitude, lng: c.longitude,
      heading: Number.isFinite(c.heading) ? c.heading : null, speed_kmh: Number.isFinite(c.speed) ? c.speed * 3.6 : null }, { onConflict: "driver_user_id" });
  }, () => { if (!geoWarned) { geoWarned = true; toast(t("geoDenied"), true); } }, { enableHighAccuracy: true, maximumAge: 5000 });
}
let onPos = null, navRefresh = null;

// ------------------------------------------------------------------ cadre : en-tête, barre d'onglets, menu
const short = (label) => String(label || "").split(",")[0].trim();
const distKm = (a, b) => { const r = (d) => d * Math.PI / 180, h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
function header(withMenu) {
  top.classList.remove("hidden"); document.body.classList.remove("no-top");
  top.innerHTML = `
    <img src="icon.svg" alt="" ${withMenu ? 'id="menuBtn" style="cursor:pointer"' : ""}>
    <div class="brand">Transporteur<small>${w("driverSpace")}</small></div>
    ${withMenu && driver ? `<button class="iconbtn" id="bellBtn" aria-label="${w("nearby")}">${icon("bell")}${feed.length ? '<span class="dotn"></span>' : ""}</button>` : ""}
    ${withMenu ? `<button class="iconbtn" id="menuBtn2" aria-label="Menu">${icon("menu")}</button>` : `<button class="chip" id="langBtn">${lang === "fr" ? "EN" : "FR"}</button>`}`;
  $("#menuBtn")?.addEventListener("click", openDrawer);
  $("#menuBtn2")?.addEventListener("click", openDrawer);
  $("#bellBtn")?.addEventListener("click", () => { if (feed[0]) openRequest(feed[0], false); else go("home"); });
  $("#langBtn")?.addEventListener("click", () => { toggleLang(); location.reload(); });
}

function drawTabbar() {
  if (!driver) { tabbar.classList.add("hidden"); document.body.classList.remove("has-tabbar"); return; }
  const tabs = [["home", "home"], ["rides", "rides"], ["earnings", "wallet"], ["profile", "user"]];
  const active = view === "settings" || view === "vehicle" ? "profile" : view;
  tabbar.innerHTML = `<div>${tabs.map(([k, ic]) => `<button data-v="${k}" class="${active === k ? "on" : ""}">${icon(ic)}<span>${w(k)}</span>${k === "rides" && feed.length ? `<span class="nb">${feed.length}</span>` : ""}</button>`).join("")}</div>`;
  tabbar.classList.remove("hidden"); document.body.classList.add("has-tabbar");
  tabbar.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => go(b.dataset.v));
}

function openDrawer() {
  const items = [
    ...(driver ? [["home", "home", w("home")], ["rides", "rides", w("myRides"), feed.length], ["earnings", "wallet", w("earnings")], ["profile", "user", w("myProfile")], ["settings", "settings", w("settings")]] : []),
    ...(me.role === "ADMIN" ? [["admin", "admin", w("admin")]] : []),
  ];
  const bg = document.createElement("div"); bg.className = "drawer-bg";
  const d = document.createElement("aside"); d.className = "drawer";
  d.innerHTML = `<button class="dclose" id="dClose" aria-label="${t("close")}">${icon("x")}</button><img class="logo" src="icon.svg" alt=""><h2>Transporteur</h2><div class="muted">${w("driverSpace")}</div>
    <nav>${items.map(([k, ic, label, n]) => `<button data-v="${k}" class="${view === k ? "on" : ""}">${icon(ic)}<span class="grow">${esc(label)}</span>${n ? `<span class="count">${n}</span>` : ""}</button>`).join("")}
      ${driver ? `<button id="dMsg">${icon("msg")}<span class="grow">${w("messages")}</span></button>` : ""}
      <button id="dHelp">${icon("shield")}<span class="grow">${w("help")}</span></button></nav>
    <nav style="flex:0"><button id="dOut" class="logout">${icon("logout")}<span class="grow">${w("logout")}</span></button></nav>`;
  const close = () => { bg.remove(); d.remove(); };
  bg.onclick = close; d.querySelector("#dClose").onclick = close;
  d.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => { close(); go(b.dataset.v); });
  d.querySelector("#dOut").onclick = () => { close(); logout(); };
  d.querySelector("#dHelp").onclick = () => { location.href = "legal.html#aide"; };
  d.querySelector("#dMsg")?.addEventListener("click", async () => {
    close();
    const b = mine[0];
    if (!b) return toast(w("noActive"));
    const { data: c } = await sb.from("profiles").select("display_name, phone, avatar_url").eq("id", b.client_user_id).maybeSingle();
    openChat(b.id, me.id, c, "driver");
  });
  document.body.append(bg, d);
}

async function logout() {
  if (channel) sb.removeChannel(channel); channel = null; clearInterval(pollTimer);
  if (geoWatch != null) navigator.geolocation.clearWatch(geoWatch); geoWatch = null;
  await sb.auth.signOut(); me = null; overlay.innerHTML = ""; overlayMode = null; start();
}

const pageHead = (title, end = "", back = "home") => `<div class="back"><button data-back="${back}" aria-label="${t("back")}">${icon("back")}</button><span class="grow">${title}</span>${end}</div>`;
function bindBack() { app.querySelectorAll("[data-back]").forEach((b) => b.onclick = () => go(b.dataset.back)); }
const eur0 = (c) => euro(c).replace(/[,.]00(?=\s|$)/, "");
function go(v, s = null) { view = v; sub = s; window.scrollTo(0, 0); render(); }

async function render() {
  const bare = driver && view !== "home" && view !== "admin";
  top.classList.toggle("hidden", bare); document.body.classList.toggle("no-top", bare);
  if (!bare) header(true);
  drawTabbar();
  try {
    if (view === "home") await homeView();
    else if (view === "rides") await ridesView();
    else if (view === "earnings") await earningsView();
    else if (view === "profile") await profileView();
    else if (view === "settings") await settingsView();
    else if (view === "vehicle") await vehicleView();
    else if (view === "admin") await (sub ? adminDriver(sub) : adminView());
  } catch (e) { app.innerHTML = `<div class="card">${esc(await errText(e))}</div>`; }
}

// ------------------------------------------------------------------ ACCUEIL
let homeMap = null;
async function homeView() {
  if (!driver) return;
  if (driver.partner_status !== "VALIDATED") return onboardingView();
  const earned = todayRows.reduce((s, b) => s + (b.driver_earnings_cents || 0), 0);
  const running = mine[0];
  app.innerHTML = `
    <div class="card avail ${driver.is_available ? "on" : ""}">
      <span class="dot"></span><div class="txt"><strong>${driver.is_available ? w("online") : w("offline")}</strong><small>${driver.is_available ? w("onlineSub") : w("offlineSub")}</small></div>
      <input type="checkbox" class="tg" id="avail" ${driver.is_available ? "checked" : ""} aria-label="${w("availability")}">
    </div>
    <div class="card stats">
      <div><strong>${todayRows.length}</strong><span>${w("ridesToday")}</span></div>
      <div><strong>${eur0(earned)}</strong><span>${w("earnToday")}</span></div>
      <div><strong>${driver.rating ?? "—"}${driver.rating ? '<span style="display:inline;color:var(--warn);font-size:16px"> ★</span>' : ""}</strong><span>${w("avgRating")}</span></div>
    </div>
    ${running ? `<div class="card"><div class="row" style="justify-content:space-between"><strong>${w("rideNow")}</strong><span style="flex:0">${statusBadge(running.status)}</span></div>
      <div class="route" style="margin-top:8px"><div>${esc(running.pickup_label)}</div><div>${esc(running.destination_label)}</div></div>
      <button class="btn" id="resumeBtn">${icon("nav")} ${w("resume")}</button></div>` : ""}
    <div class="map" id="homeMap" style="height:230px"></div>
    <div class="section-title"><span>${w("nearby")}</span>${feed.length ? `<span class="count">${feed.length}</span>` : ""}<span class="grow"></span>
      <button class="link" id="allReq" aria-label="${w("rides")}">${icon("chevR")}</button></div>
    ${!driver.is_available ? `<p class="list-empty">${w("goOnline")}</p>` : feed.length ? feed.slice(0, 3).map(reqCard).join("") : `<p class="list-empty">${w("noReq")}</p>`}`;

  $("#avail").onchange = (e) => busy(e.target, async () => {
    const want = e.target.checked;
    const { error } = await sb.from("drivers").update({ is_available: want }).eq("user_id", me.id);
    if (error) { e.target.checked = !want; throw error; }
    if (want) startGeo();
    await loadAll(); for (const b of feed) seen.add(b.id); render();
  });
  $("#resumeBtn")?.addEventListener("click", () => openNav(running.id));
  $("#allReq").onclick = () => go("rides");
  app.querySelectorAll("[data-req]").forEach((b) => b.onclick = () => openRequest(feed.find((x) => x.id === b.dataset.req), false));

  homeMap = makeMap($("#homeMap"), { dragging: true });
  if (homeMap) {
    const pts = [];
    let me1 = myPos ? L.marker([myPos.lat, myPos.lng], { icon: meIcon(), zIndexOffset: 1000 }).addTo(homeMap) : null;
    if (myPos) pts.push([myPos.lat, myPos.lng]);
    feed.slice(0, 10).forEach((b) => { if (b.pickup_lat != null) { L.marker([b.pickup_lat, b.pickup_lng], { icon: pinIcon(true) }).addTo(homeMap); pts.push([b.pickup_lat, b.pickup_lng]); } });
    if (pts.length > 1) homeMap.fitBounds(pts, { padding: [30, 30], maxZoom: 14 }); else if (pts.length) homeMap.setView(pts[0], 13);
    onPos = (p) => {
      if (view !== "home" || !homeMap || overlayMode) return;
      if (me1) return me1.setLatLng([p.lat, p.lng]);
      me1 = L.marker([p.lat, p.lng], { icon: meIcon(), zIndexOffset: 1000 }).addTo(homeMap);
      homeMap.fitBounds([[p.lat, p.lng], ...pts], { padding: [30, 30], maxZoom: 14 });
    };
    if (myPos && !me1) onPos(myPos);
  }
}

const paxTxt = (n) => `${n > 1 ? "1-" + n : 1} ${lang === "en" ? (n > 1 ? "passengers" : "passenger") : (n > 1 ? "passagers" : "passager")}`;
const metaRow = (b) => `<div class="meta"><span>${icon("car")} ${esc(t("v_" + b.vehicle_type))}</span><span>${icon("user")} ${paxTxt(b.passengers)}</span>
      ${b.payment_method === "ON_BOARD" ? `<span>${icon("wallet")} ${t("onBoard")}</span>` : ""}</div>`;
function reqCard(b) {
  return `<div class="card reqcard">
    <div class="req"><div class="vic">${icon("car")}</div>
      <div class="body"><div class="title">${esc(short(b.pickup_label))} → ${esc(short(b.destination_label))}</div>
        <div class="sub">${Math.round((b.duration_seconds || 0) / 60)} min · ${fmtDist(b.distance_meters || 0)}${b.scheduled_at ? ` · ${fmtDate(b.scheduled_at)}` : ""}</div></div>
      <div class="price">${eur0(b.quoted_fare_cents)}</div></div>
    ${metaRow(b)}
    <button class="btn" data-req="${b.id}">${w("details")}</button>
  </div>`;
}

async function onboardingView() {
  const { data: docs } = await sb.from("driver_documents").select("document_type").eq("driver_user_id", me.id);
  const sent = new Set((docs || []).map((d) => d.document_type));
  const step = (ok, label) => `<div class="list-row" style="cursor:default"><div class="vic" style="${ok ? "color:var(--ok)" : ""}">${icon(ok ? "check" : "clock")}</div><div class="body">${label}</div></div>`;
  app.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><strong>${w("steps")}</strong><span style="flex:0">${partnerBadge(driver.partner_status)}</span></div>
    ${step(!!vehicle, t("stepVehicle"))}${step(sent.size >= DOC_TYPES.length, `${t("stepDocs")} (${sent.size}/${DOC_TYPES.length})`)}${step(false, t("stepReview"))}
    <button class="btn" id="goProfile">${w("complete")}</button></div>`;
  $("#goProfile").onclick = () => go("profile");
}

function partnerBadge(s) {
  const cls = { VALIDATED: "ok", SUSPENDED: "bad", REJECTED: "bad" }[s] || "warn";
  return `<span class="badge ${cls}">${esc(t("partner_" + s))}</span>`;
}

// ------------------------------------------------------------------ NOUVELLE DEMANDE
let countdownTimer = null;
async function openRequest(b, auto) {
  if (!b) return;
  overlayMode = "request";
  const el = document.createElement("div"); el.className = "sheet";
  overlay.innerHTML = ""; overlay.appendChild(el);
  el.innerHTML = `<div class="inner">
    <div class="sheet-head"><h1>${w("newReq")}</h1><button class="iconbtn" id="rqClose" aria-label="${t("close")}">${icon("x")}</button></div>
    <div class="map" id="rqMap" style="height:290px;margin-top:0"></div>
    <div class="trip-stats"><div><span>${w("distance")}</span><strong>${fmtDist(b.distance_meters || 0)}</strong></div>
      <div><span>${w("estDuration")}</span><strong>${Math.round((b.duration_seconds || 0) / 60)} min</strong></div>
      <div style="text-align:right"><span>${w("price")}</span><strong>${eur0(b.quoted_fare_cents)}</strong></div></div>
    <div class="card metacard">${metaRow(b)}</div>
    ${b.scheduled_at || b.notes ? `<div class="card metacard">${b.scheduled_at ? `<div class="kv"><span>${t("scheduledFor")}</span><span>${fmtDate(b.scheduled_at)}</span></div>` : ""}
      ${b.notes ? `<div class="kv"><span>Note</span><span>${esc(b.notes)}</span></div>` : ""}</div>` : ""}
    <button class="btn" id="rqAccept">${w("accept")}</button>
    <button class="btn secondary" id="rqRefuse">${w("refuse")}</button>
    ${auto ? `<div class="countdown"><div class="ring"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" stroke="#1b2948" stroke-width="4" fill="none"/>
      <circle id="cdArc" cx="28" cy="28" r="24" stroke="#1f7aff" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="150.8" stroke-dashoffset="0"/></svg><b id="cdNum">25</b></div>
      <div>${w("expires")}<br><span id="cdTxt">25</span> ${w("seconds")}</div></div>` : ""}
  </div>`;
  const close = () => { clearInterval(countdownTimer); overlay.innerHTML = ""; overlayMode = null; render(); };
  el.querySelector("#rqClose").onclick = close;
  el.querySelector("#rqRefuse").onclick = () => { refused.add(b.id); store.set("refusedReq", [...refused].slice(-200)); feed = feed.filter((x) => x.id !== b.id); close(); };
  el.querySelector("#rqAccept").onclick = (e) => busy(e.target, async () => {
    await rpc("accept_booking", { p_booking_id: b.id });
    clearInterval(countdownTimer); overlay.innerHTML = ""; overlayMode = "anim";
    await celebrate(w("accepted"), `${w("acceptedSub")} ${short(b.pickup_label)}`);
    overlayMode = null;
    await loadAll(); openNav(b.id);
  });
  if (auto) {
    let left = 25;
    countdownTimer = setInterval(() => {
      left--; const n = el.querySelector("#cdNum"); if (!n) return clearInterval(countdownTimer);
      n.textContent = left; el.querySelector("#cdTxt").textContent = left;
      el.querySelector("#cdArc").setAttribute("stroke-dashoffset", String(150.8 * (1 - left / 25)));
      if (left <= 0) close();
    }, 1000);
  }
  const map = makeMap(el.querySelector("#rqMap"));
  if (map && b.pickup_lat != null) {
    const from = { lat: b.pickup_lat, lng: b.pickup_lng }, to = { lat: b.destination_lat, lng: b.destination_lng };
    L.marker([from.lat, from.lng], { icon: pinIcon(true) }).addTo(map);
    L.marker([to.lat, to.lng], { icon: pinIcon() }).addTo(map);
    L.marker([to.lat, to.lng], { icon: labelIcon(short(b.destination_label), b.destination_label.split(",")[1]?.trim()) }).addTo(map);
    map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], { padding: [40, 40] });
    const r = await getRoute(from, to);
    if (overlayMode === "request") { const layer = routeLayer(map, r.coords); map.fitBounds(layer.bounds, { padding: [40, 40] }); }
  }
}

// ------------------------------------------------------------------ COURSE EN COURS
async function openNav(id) {
  overlayMode = "nav";
  tabbar.classList.add("hidden");
  let b = null, client = null, map = null, meMarker = null, targetMarker = null, layer = null, lastRouteAt = 0, lastRoutePos = null, followMe = true, unread = 0, stopWatch = null;
  overlay.innerHTML = `<div class="nav-screen">
    <div class="map-full"><div class="mapbox" id="navMap"></div>
      <div class="nav-top"><button class="backb" id="navBack" aria-label="${t("back")}">${icon("back")}</button><div class="ttl">${w("rideNow")}</div><span id="stopSlot"></span></div>
      <div class="turn hidden" id="turn"></div>
      <div class="fabs"><button id="fSound" aria-label="Son">${icon(soundOn ? "sound" : "mute")}</button><button id="fCenter" aria-label="Recentrer">${icon("locate")}</button>
        <button id="fSos" aria-label="${w("security")}">${icon("shield")}</button></div></div>
    <div class="nav-panel"><div class="inner" id="navPanel"><div class="center"><span class="spinner"></span></div></div></div></div>`;
  map = makeMap($("#navMap"));
  $("#navBack").onclick = () => { closeNav(); };
  $("#fSound").onclick = (e) => { soundOn = !soundOn; store.set("sound", soundOn); e.currentTarget.innerHTML = icon(soundOn ? "sound" : "mute"); };
  $("#fCenter").onclick = () => { followMe = true; fit(true); };
  $("#fSos").onclick = () => { if (confirm(w("call112"))) location.href = "tel:112"; };
  map?.on("dragstart", () => { followMe = false; });

  const target = () => b.status === "IN_PROGRESS" ? { lat: b.destination_lat, lng: b.destination_lng, label: b.destination_label } : { lat: b.pickup_lat, lng: b.pickup_lng, label: b.pickup_label };
  const fit = (force) => {
    if (!map) return;
    map.invalidateSize();
    const pts = [];
    if (myPos) pts.push([myPos.lat, myPos.lng]);
    const tg = target(); if (tg.lat != null) pts.push([tg.lat, tg.lng]);
    if (layer && (force || !myPos)) map.fitBounds(layer.bounds, { padding: [70, 50] });
    else if (myPos && followMe && !force) map.setView([myPos.lat, myPos.lng], Math.max(map.getZoom(), 15));
    else if (pts.length) map.fitBounds(pts, { padding: [70, 50] });
  };

  const updateRoute = async (force) => {
    const tg = target(); if (tg.lat == null) return;
    const from = myPos || (b.status === "IN_PROGRESS" ? { lat: b.pickup_lat, lng: b.pickup_lng } : null);
    if (!from) { drawPanel(null); return; }
    const moved = lastRoutePos ? Math.hypot(from.lat - lastRoutePos.lat, from.lng - lastRoutePos.lng) * 111000 : Infinity;
    if (!force && moved < 60 && Date.now() - lastRouteAt < 30000) return;
    lastRouteAt = Date.now(); lastRoutePos = from;
    const r = await getRoute(from, tg);
    if (overlayMode !== "nav") return;
    if (map) {
      map.invalidateSize();
      layer?.remove(); layer = routeLayer(map, r.coords);
      if (!targetMarker) targetMarker = L.marker([tg.lat, tg.lng], { icon: pinIcon(b.status !== "IN_PROGRESS") }).addTo(map);
      else targetMarker.setLatLng([tg.lat, tg.lng]);
      if (force) { const pts = [...r.coords]; if (myPos) pts.push([myPos.lat, myPos.lng]); map.fitBounds(pts, { paddingTopLeft: [40, 170], paddingBottomRight: [70, 40] }); }
    }
    const tn = $("#turn");
    if (r.next && tn) { tn.classList.remove("hidden"); tn.innerHTML = `${icon(turnIcon(r.next))}<div><strong>${esc(r.next.name || (r.next.type === "arrive" ? short(tg.label) : ""))}</strong><span>${fmtDist(r.next.distance)}</span></div>`; }
    drawPanel(r);
  };

  const drawPanel = (r) => {
    const tg = target();
    const mins = r ? Math.max(1, Math.round(r.duration / 60)) : Math.round((b.duration_seconds || 0) / 60);
    const eta = new Date(Date.now() + mins * 60e3).toLocaleTimeString(lang === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
    const next = { ACCEPTED: ["arriving", w("goPickup")], DRIVER_ARRIVING: ["start", w("onBoard")], IN_PROGRESS: ["finish", w("finish")] }[b.status];
    $("#stopSlot").innerHTML = ["ACCEPTED", "DRIVER_ARRIVING"].includes(b.status) ? `<button class="pill-danger" id="stopBtn">${w("stop")}</button>` : "";
    $("#stopBtn")?.addEventListener("click", (e) => { if (confirm(w("stopConfirm"))) busy(e.target, async () => { await call("booking-cancel", { bookingId: b.id, action: "release" }); closeNav(); }); });
    $("#navPanel").innerHTML = `
      <div class="eta"><div class="grow"><strong>${w("arrivalIn")} ${mins} min</strong><span class="muted">${r ? fmtDist(r.distance) : fmtDist(b.distance_meters || 0)} · ${eta}</span></div>
        <a class="btn small secondary navbtn" target="_blank" rel="noopener" href="https://waze.com/ul?ll=${tg.lat},${tg.lng}&navigate=yes">${w("directions")}</a></div>
      ${client ? `<div class="person">${avatarHtml(client)}
        <div class="grow"><small>${w("client")}</small><strong>${esc(client.display_name)}</strong>${ratingLine(client.client_rating, client.client_rating_count)}</div>
        ${client.phone ? `<a class="round" href="tel:${esc(client.phone)}" aria-label="${t("call")}">${icon("phone")}</a>` : ""}
        <button class="round" id="chatBtn" aria-label="${w("messages")}">${icon("msg")}${unread ? `<span class="nb">${unread}</span>` : ""}</button></div>` : ""}
      <div class="person"><div class="avatar plain">${icon(b.status === "IN_PROGRESS" ? "car" : "pin")}</div>
        <div class="grow"><small>${b.status === "IN_PROGRESS" ? w("destination") : w("pickup")}</small><strong>${esc(short(tg.label))}</strong><small>${esc(tg.label.split(",").slice(1).join(",").trim())}</small></div></div>
      ${b.payment_method === "ON_BOARD" ? `<div class="kv"><span>${w("toCollect")}</span><strong>${euro(b.quoted_fare_cents)}</strong></div>` : ""}
      ${b.notes ? `<p class="muted">📝 ${esc(b.notes)}</p>` : ""}
      <div id="slideSlot"></div>
      ${b.status === "DRIVER_ARRIVING" ? `<button class="btn danger" id="navNoShow">${w("noShow")}</button>` : ""}`;
    $("#chatBtn")?.addEventListener("click", () => openChat(b.id, me.id, client, "driver"));
    if (next) $("#slideSlot").appendChild(slideButton(next[1], async () => {
      if (next[0] === "arriving") b = await rpc("advance_booking", { p_booking_id: b.id, p_status: "DRIVER_ARRIVING" });
      else if (next[0] === "start") { b = await rpc("advance_booking", { p_booking_id: b.id, p_status: "IN_PROGRESS" }); targetMarker?.remove(); targetMarker = null; }
      else if (next[0] === "finish") {
        if (b.payment_method === "ON_BOARD") b = await rpc("complete_onboard_booking", { p_booking_id: b.id });
        else b = (await call("ride-complete", { bookingId: b.id })).booking;
        stopWatch?.(); overlayMode = "anim";
        await celebrate(w("done"), b.payment_method === "ON_BOARD" ? w("paidBoard") : w("paidCard"), { kind: "green", amount: euro(b.final_fare_cents ?? b.quoted_fare_cents).replace(/,00/, "") });
        return showDone(b, client);
      }
      await updateRoute(true);
    }, next[0] === "finish" ? "finish" : ""));
    $("#navNoShow")?.addEventListener("click", (e) => { if (confirm(w("noShow") + " ?")) busy(e.target, async () => { await call("booking-cancel", { bookingId: b.id, action: "no_show" }); closeNav(); }); });
  };

  navRefresh = async () => {
    const { data } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
    if (!data || data.driver_user_id !== me.id || ["CANCELLED"].includes(data.status)) { toast(t("s_CANCELLED"), true); return closeNav(); }
    if (data.status === "COMPLETED") { stopWatch?.(); return showDone(data, client); }
    const changed = !b || b.status !== data.status;
    b = data;
    if (changed) await updateRoute(true);
  };

  const { data } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!data) return closeNav();
  b = data;
  ({ data: client } = await sb.from("profiles").select("display_name, phone, avatar_url, client_rating, client_rating_count").eq("id", b.client_user_id).maybeSingle());
  stopWatch = watchMessages(b.id, me.id, (n) => { unread = n; const cb = $("#chatBtn"); if (cb) cb.innerHTML = icon("msg") + (n ? `<span class="nb">${n}</span>` : ""); });
  navStop = () => stopWatch?.();
  startGeo();
  if (map && myPos) meMarker = L.marker([myPos.lat, myPos.lng], { icon: meIcon(), zIndexOffset: 1000 }).addTo(map);
  onPos = (p) => {
    if (overlayMode !== "nav" || !map) return;
    if (!meMarker) meMarker = L.marker([p.lat, p.lng], { icon: meIcon(), zIndexOffset: 1000 }).addTo(map); else meMarker.setLatLng([p.lat, p.lng]);
    if (followMe) map.panTo([p.lat, p.lng]);
    updateRoute(false);
  };
  drawPanel(null);
  await updateRoute(true);
  if (!layer && map) fit(true);
}

let navStop = null;
function closeNav() { navStop?.(); navStop = null; overlay.innerHTML = ""; overlayMode = null; onPos = null; navRefresh = null; scheduleRefresh(); go("home"); }

// ------------------------------------------------------------------ COURSE TERMINÉE
function showDone(b, client) {
  overlayMode = "done"; navRefresh = null; onPos = null;
  const fare = b.final_fare_cents ?? b.quoted_fare_cents;
  overlay.innerHTML = `<div class="sheet"><div class="inner">
    <div class="done"><div class="check">${icon("check")}</div><h1 style="margin:0">${w("done")}</h1>
      <div class="amount">${eur0(fare)}</div><div class="muted">${b.payment_method === "ON_BOARD" ? w("paidBoard") : w("paidCard")}</div></div>
    <div class="card"><div class="kv"><span>${w("farePrice")}</span><strong>${euro(fare)}</strong></div>
      <div class="kv"><span>${w("commission")}</span><span>−${euro(b.commission_cents)}</span></div>
      <div class="kv"><span style="color:var(--text);font-weight:700">${w("yourEarn")}</span><strong>${euro(b.driver_earnings_cents)}</strong></div></div>
    ${client ? `<div class="card"><div class="person" style="border:0;padding:0">${avatarHtml(client)}
      <div class="grow"><small>${w("client")}</small><strong>${esc(client.display_name)}</strong>
      ${b.client_rating ? `<div class="stars-s">${"★".repeat(b.client_rating)}</div>` : `<div class="stars sm" id="cStars">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" aria-label="${n}">★</button>`).join("")}</div>`}</div>
      <span class="chev">${icon("chevR")}</span></div></div>` : ""}
    <button class="btn" id="dNew">${w("newRide")}</button>
    <button class="btn secondary" id="dDetail">${w("seeDetail")}</button></div></div>`;
  bindStars($("#cStars"), (n) => rpc("rate_client", { p_booking_id: b.id, p_rating: n }));
  const leave = (v, s) => { overlay.innerHTML = ""; overlayMode = null; scheduleRefresh(); go(v, s); };
  $("#dNew").onclick = () => leave("home");
  $("#dDetail").onclick = () => leave("rides", b.id);
}

function bindStars(box, save) {
  if (!box) return;
  const btns = box.querySelectorAll("button");
  btns.forEach((btn) => {
    btn.onmouseenter = () => btns.forEach((x) => x.classList.toggle("on", +x.dataset.n <= +btn.dataset.n));
    btn.onclick = () => busy(btn, async () => { await save(+btn.dataset.n); btns.forEach((x) => { x.classList.toggle("on", +x.dataset.n <= +btn.dataset.n); x.disabled = true; }); toast(w("thanks")); });
  });
}

// ------------------------------------------------------------------ MES COURSES
async function ridesView() {
  if (sub) return rideDetail(sub);
  const { data } = await sb.from("bookings").select("*").eq("driver_user_id", me.id).order("created_at", { ascending: false }).limit(60);
  const rows = data || [];
  const cur = rows.filter((b) => RUNNING.includes(b.status)), past = rows.filter((b) => !RUNNING.includes(b.status));
  const row = (b) => `<div class="list-row" data-b="${b.id}"><div class="vic">${icon("car")}</div>
    <div class="body"><div>${esc(short(b.pickup_label))} → ${esc(short(b.destination_label))}</div><small>${fmtDate(b.scheduled_at || b.completed_at || b.created_at)} · ${esc(t("s_" + b.status))}</small></div>
    <div class="end">${euro(b.final_fare_cents ?? b.quoted_fare_cents).replace(/,00/, "")}</div><span class="chev">${icon("chevR")}</span></div>`;
  app.innerHTML = `${pageHead(w("myRides"))}
    ${feed.length ? `<div class="section-title"><span>${w("nearby")}</span><span class="count">${feed.length}</span></div>${feed.map(reqCard).join("")}` : ""}
    <div class="section-title">${w("upcoming")}</div><div class="card" style="padding:4px 16px">${cur.length ? cur.map(row).join("") : `<p class="list-empty">${w("noRides")}</p>`}</div>
    <div class="section-title">${w("history")}</div><div class="card" style="padding:4px 16px">${past.length ? past.map(row).join("") : `<p class="list-empty">${w("noRides")}</p>`}</div>`;
  bindBack();
  app.querySelectorAll("[data-req]").forEach((b) => b.onclick = () => openRequest(feed.find((x) => x.id === b.dataset.req), false));
  app.querySelectorAll("[data-b]").forEach((el) => el.onclick = () => {
    const b = rows.find((x) => x.id === el.dataset.b);
    if (RUNNING.includes(b.status)) openNav(b.id); else go("rides", b.id);
  });
}

async function rideDetail(id) {
  const { data: b } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!b) return go("rides");
  app.innerHTML = `<div class="back"><button id="bk">${icon("back")}</button><span class="grow">${w("seeDetail")}</span>${statusBadge(b.status)}</div>
    <div class="card"><div class="route"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div></div>
    <div class="card">
      <div class="kv"><span>${t("scheduledFor")}</span><span>${fmtDate(b.scheduled_at || b.created_at)}</span></div>
      ${b.completed_at ? `<div class="kv"><span>${t("s_COMPLETED")}</span><span>${fmtDate(b.completed_at)}</span></div>` : ""}
      <div class="kv"><span>${w("distance")}</span><span>${fmtDist(b.distance_meters || 0)} · ${Math.round((b.duration_seconds || 0) / 60)} min</span></div>
      <div class="kv"><span>${t("vehicle")}</span><span>${esc(t("v_" + b.vehicle_type))} · ${b.passengers} ${w("passengers")}</span></div>
      <div class="kv"><span>${t("payment")}</span><span>${b.payment_method === "ON_BOARD" ? t("onBoard") : t("card")} · ${esc(t("p_" + b.payment_status))}</span></div>
      <div class="kv"><span>${w("farePrice")}</span><strong>${euro(b.final_fare_cents ?? b.quoted_fare_cents)}</strong></div>
      <div class="kv"><span>${w("commission")}</span><span>−${euro(b.commission_cents)}</span></div>
      <div class="kv"><span>${w("yourEarn")}</span><strong>${euro(b.driver_earnings_cents)}</strong></div>
      ${b.driver_rating ? `<div class="kv"><span>★</span><span class="stars-s">${"★".repeat(b.driver_rating)}</span></div>` : ""}</div>
    ${b.status === "COMPLETED" ? `${b.client_rating ? "" : `<div class="card center"><div class="muted">${w("rateClient")}</div><div class="stars" id="cStars">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}">★</button>`).join("")}</div></div>`}
      <a class="btn secondary" href="receipt.html?id=${b.id}">${icon("doc")} ${w("receipt")}</a>` : ""}`;
  $("#bk").onclick = () => go("rides");
  bindStars($("#cStars"), (n) => rpc("rate_client", { p_booking_id: b.id, p_rating: n }));
}

// ------------------------------------------------------------------ REVENUS
let earnMode = "day", earnOffset = 0;
async function earningsView() {
  const now = new Date();
  let from, to, bins, labels, binOf, title;
  if (earnMode === "day") {
    from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() + earnOffset); to = new Date(from); to.setDate(to.getDate() + 1);
    labels = ["0h", "3h", "6h", "9h", "12h", "15h", "18h", "21h"]; binOf = (d) => Math.floor(d.getHours() / 3);
    title = (earnOffset === 0 ? w("today") + ", " : "") + from.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { weekday: earnOffset === 0 ? undefined : "long", day: "numeric", month: "long" });
  } else if (earnMode === "week") {
    from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - ((from.getDay() + 6) % 7) + 7 * earnOffset); to = new Date(from); to.setDate(to.getDate() + 7);
    labels = lang === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]; binOf = (d) => (d.getDay() + 6) % 7;
    const end = new Date(to - 1); title = `${from.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" })}`;
  } else {
    from = new Date(now.getFullYear(), now.getMonth() + earnOffset, 1); to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    labels = ["S1", "S2", "S3", "S4", "S5"]; binOf = (d) => Math.min(4, Math.floor((d.getDate() - 1) / 7));
    title = from.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { month: "long", year: "numeric" });
  }
  bins = labels.map(() => 0);
  const { data } = await sb.from("bookings").select("*").eq("driver_user_id", me.id).eq("status", "COMPLETED")
    .gte("completed_at", from.toISOString()).lt("completed_at", to.toISOString()).order("completed_at", { ascending: false });
  const rows = data || [];
  rows.forEach((b) => { bins[binOf(new Date(b.completed_at))] += b.driver_earnings_cents || 0; });
  const total = rows.reduce((s, b) => s + (b.driver_earnings_cents || 0), 0);
  const owed = rows.reduce((s, b) => s + (b.payment_method === "ON_BOARD" ? b.commission_cents || 0 : 0), 0);
  const step = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000].find((x) => x * 4 >= Math.max(...bins, 1)) || 200000;
  const max = step * 4;
  app.innerHTML = `${pageHead(w("myEarnings"))}
    <div class="seg" id="eSeg">${["day", "week", "month"].map((k) => `<button data-m="${k}" class="${earnMode === k ? "on" : ""}">${w(k)}</button>`).join("")}</div>
    <div class="datenav"><button id="ePrev" aria-label="${t("back")}">${icon("chevL")}</button><span>${esc(title)}</span><button id="eNext" ${earnOffset >= 0 ? "disabled" : ""} aria-label="+">${icon("chevR")}</button></div>
    <div class="total"><strong>${eur0(total)}</strong><span class="muted">${rows.length} ${w("nRides")}</span></div>
    <div class="chartbox"><div class="plot"><div class="chart">${bins.map((v) => `<i><b class="${v ? "" : "zero"}" style="height:${v ? Math.max(4, (v / max) * 100) : 0}%" title="${euro(v)}"></b></i>`).join("")}</div>
      <div class="yaxis">${[4, 3, 2, 1, 0].map((k) => `<span>${eur0(step * k)}</span>`).join("")}</div></div>
      <div class="chart-x">${labels.map((l) => `<span>${l}</span>`).join("")}</div></div>
      ${owed ? `<div class="kv" style="margin-top:10px"><span>${w("owed")}</span><strong>${euro(owed)}</strong></div>` : ""}
    <div class="section-title">${w("rideDetails")}</div>
    <div class="card" style="padding:4px 16px">${rows.length ? rows.map((b) => `<div class="list-row" data-b="${b.id}"><div class="vic">${icon("car")}</div>
      <div class="body"><div>${esc(short(b.pickup_label))} → ${esc(short(b.destination_label))}</div><small>${new Date(b.completed_at).toLocaleString(lang === "en" ? "en-GB" : "fr-FR", earnMode === "day" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
      <div class="end">${eur0(b.final_fare_cents)}</div><span class="chev">${icon("chevR")}</span></div>`).join("") : `<p class="list-empty">${w("noRides")}</p>`}</div>`;
  bindBack();
  $("#eSeg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; earnMode = b.dataset.m; earnOffset = 0; render(); };
  $("#ePrev").onclick = () => { earnOffset--; render(); };
  $("#eNext").onclick = () => { if (earnOffset < 0) { earnOffset++; render(); } };
  app.querySelectorAll("[data-b]").forEach((el) => el.onclick = () => go("rides", el.dataset.b));
}

// ------------------------------------------------------------------ PROFIL
async function profileView() {
  const [{ data: docs }, { count }] = await Promise.all([
    sb.from("driver_documents").select("*").eq("driver_user_id", me.id).order("uploaded_at", { ascending: false }),
    sb.from("bookings").select("id", { count: "exact", head: true }).eq("driver_user_id", me.id).eq("status", "COMPLETED"),
  ]);
  const last = {};
  for (const d of docs || []) if (!last[d.document_type]) last[d.document_type] = d;
  const docBadge = (d) => {
    const s = !d ? "MISSING" : (d.expires_at && new Date(d.expires_at) < new Date() ? "EXPIRED" : d.status);
    const cls = { APPROVED: "ok", REJECTED: "bad", EXPIRED: "bad", MISSING: "warn" }[s] || "";
    return `<span class="badge ${cls}">${s === "APPROVED" ? w("validated") : t("d_" + s)}</span>`;
  };
  const r = driver.rating;
  app.innerHTML = `${pageHead(w("myProfile"), `<button id="gear" aria-label="${w("settings")}">${icon("settings")}</button>`)}
    <div class="profile-head"><div style="display:inline-block" id="photoBtn" title="${w("changePhoto")}">${avatarHtml(me, "lg editable", `${driver.partner_status === "VALIDATED" ? `<span class="ok">${icon("check")}</span>` : ""}<span class="cam">${CAM}</span>`)}</div>
      <h2>${esc(me.display_name)}</h2>
      <div class="stars-s">${r ? "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r)) : "☆☆☆☆☆"} <span class="muted">${r ?? "—"} (${count || 0} ${w("ratingN")})</span></div>
      ${driver.partner_status !== "VALIDATED" ? `<div style="margin-top:8px">${partnerBadge(driver.partner_status)}</div>` : ""}</div>
    <div class="section-title">${w("myVehicle")}</div>
    <div class="card" style="padding:4px 16px"><div class="list-row" id="vehRow"><div class="vic" style="width:64px;border-radius:12px">${icon("car")}</div>
      <div class="body">${vehicle ? `<div><strong>${esc([vehicle.make, vehicle.model].filter(Boolean).join(" "))}</strong></div>
        <small>${esc(t("v_" + vehicle.vehicle_type))} · ${vehicle.passenger_capacity} ${w("passengers")}${vehicle.color ? " · " + esc(vehicle.color) : ""}</small><small>${esc(vehicle.registration_number)}</small>` : `<div>${w("addVehicle")}</div>`}</div>
      <span class="chev">${icon("chevR")}</span></div></div>
    <div class="section-title">${w("docs")}</div>
    <div class="card" style="padding:4px 16px">${DOC_TYPES.map((k) => `<div class="list-row" data-doc="${k}"><div class="vic" style="border-radius:10px">${icon("doc")}</div>
      <div class="body"><div>${t("doc_" + k)}</div>${last[k]?.rejection_reason ? `<small style="color:var(--bad)">${esc(last[k].rejection_reason)}</small>` : last[k]?.expires_at ? `<small>${t("expires")} ${new Date(last[k].expires_at).toLocaleDateString()}</small>` : ""}</div>
      ${docBadge(last[k])}<span class="chev">${icon("chevR")}</span></div>`).join("")}</div>
    <div class="section-title">${w("info")}</div>
    <form class="card" id="meForm">
      <label>${t("name")}</label><input name="display_name" required value="${esc(me.display_name)}">
      <label>${t("phone")}</label><input name="phone" type="tel" value="${esc(me.phone)}">
      <label>${t("siret")}</label><input name="siret" inputmode="numeric" maxlength="14" value="${esc(driver.siret)}">
      <button class="btn secondary" type="submit">${t("save")}</button></form>`;
  bindBack();
  $("#gear").onclick = () => go("settings");
  $("#photoBtn").onclick = async () => { const url = await pickAvatar(me.id); if (url) { me.avatar_url = url; render(); } };
  $("#vehRow").onclick = () => go("vehicle");
  app.querySelectorAll("[data-doc]").forEach((el) => el.onclick = () => docSheet(el.dataset.doc, last[el.dataset.doc]));
  $("#meForm").onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const f = Object.fromEntries(new FormData(e.target));
    let r1 = await sb.from("profiles").update({ display_name: f.display_name.trim(), phone: f.phone.trim() || null }).eq("id", me.id);
    if (r1.error) throw r1.error;
    r1 = await sb.from("drivers").update({ siret: f.siret.trim() || null }).eq("user_id", me.id);
    if (r1.error) throw r1.error;
    me.display_name = f.display_name.trim(); me.phone = f.phone.trim(); toast(t("saved")); render();
  }); };
}

function docSheet(k, cur) {
  const m = document.createElement("div"); m.className = "modal";
  m.innerHTML = `<div><h2 style="margin-top:0">${t("doc_" + k)}</h2>
    ${cur ? `<p class="muted">${t("d_" + cur.status)}${cur.expires_at ? ` · ${t("expires")} ${new Date(cur.expires_at).toLocaleDateString()}` : ""}</p>` : ""}
    <input type="file" accept="image/jpeg,image/png,image/heic,application/pdf" id="dFile">
    <label>${t("expiryOpt")}</label><input type="date" id="dExp">
    <button class="btn" id="dUp">${cur ? t("replace") : t("upload")}</button><button class="btn secondary" id="dCancel">${t("cancel")}</button></div>`;
  document.body.appendChild(m);
  m.querySelector("#dCancel").onclick = () => m.remove();
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  m.querySelector("#dUp").onclick = (e) => busy(e.target, async () => {
    const file = m.querySelector("#dFile").files[0];
    if (!file) throw new Error(t("upload") + " : " + t("doc_" + k));
    if (file.size > 10 * 1024 * 1024) throw new Error("10 Mo max.");
    const path = `${me.id}/${k}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_").slice(-60)}`;
    const up = await sb.storage.from("driver-documents").upload(path, file, { contentType: file.type || undefined });
    if (up.error) throw up.error;
    const r = await sb.from("driver_documents").insert({ driver_user_id: me.id, document_type: k, storage_key: path, expires_at: m.querySelector("#dExp").value || null });
    if (r.error) throw r.error;
    m.remove(); toast(t("saved")); render();
  });
}

async function vehicleView() {
  const v = vehicle || {};
  app.innerHTML = `<div class="back"><button id="bk">${icon("back")}</button><span class="grow">${w("myVehicle")}</span></div>
    <form class="card" id="vehForm">
      <label>${t("vehicleType")}</label><div class="seg" id="vtSeg">${VEHICLES.map((k) => `<button type="button" data-k="${k}" class="${(v.vehicle_type || "BERLINE") === k ? "on" : ""}">${t("v_" + k)}</button>`).join("")}</div>
      <div class="row"><div><label>${t("make")}</label><input name="make" required value="${esc(v.make)}"></div><div><label>${t("model")}</label><input name="model" required value="${esc(v.model)}"></div></div>
      <div class="row"><div><label>${t("color")}</label><input name="color" value="${esc(v.color)}"></div><div><label>${t("year")}</label><input name="year" type="number" min="2000" max="2030" value="${esc(v.year)}"></div></div>
      <div class="row"><div><label>${t("plate")}</label><input name="registration_number" required placeholder="AB-123-CD" value="${esc(v.registration_number)}"></div>
        <div><label>${t("capacity")}</label><input name="passenger_capacity" type="number" min="1" max="8" required value="${esc(v.passenger_capacity || 4)}"></div></div>
      <button class="btn" type="submit">${t("save")}</button></form>`;
  let vt = v.vehicle_type || "BERLINE";
  $("#vtSeg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; vt = b.dataset.k; $("#vtSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); };
  $("#bk").onclick = () => go("profile");
  $("#vehForm").onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const f = Object.fromEntries(new FormData(e.target));
    const row = { driver_user_id: me.id, vehicle_type: vt, make: f.make.trim(), model: f.model.trim(), color: f.color.trim() || null,
      year: f.year ? +f.year : null, registration_number: f.registration_number.trim().toUpperCase(), passenger_capacity: +f.passenger_capacity };
    const r = v.id ? await sb.from("vehicles").update(row).eq("id", v.id) : await sb.from("vehicles").insert(row);
    if (r.error) throw r.error;
    await loadAll(); toast(t("saved")); go("profile");
  }); };
}

// ------------------------------------------------------------------ PARAMÈTRES
async function settingsView() {
  const row = (ic, label, end, id, extra = "") => `<div class="list-row" ${id ? `id="${id}"` : ""}><div class="vic">${icon(ic)}</div><div class="body">${label}${extra}</div>${end}</div>`;
  app.innerHTML = `<div class="back"><button id="bk">${icon("back")}</button><span class="grow">${w("settings")}</span></div>
    <div class="card settings" style="padding:4px 16px">
      ${row("power", w("availability"), `<input type="checkbox" class="tg" id="sAvail" ${driver.is_available ? "checked" : ""} ${driver.partner_status !== "VALIDATED" ? "disabled" : ""}>`, null,
        `<small style="color:${driver.is_available ? "var(--ok)" : "var(--muted)"}">● ${driver.is_available ? w("online") : w("offline")}</small>`)}
      ${row("pin", w("zones"), `<span class="end">${w("zonesVal")}</span>`)}
      ${row("sliders", w("prefs"), `<span class="end">${vehicle ? esc(t("v_" + vehicle.vehicle_type)) : "—"}</span><span class="chev">${icon("chevR")}</span>`, "sPrefs")}
      ${row("bell", w("notifs"), `<input type="checkbox" class="tg" id="sNotif" ${notifOn ? "checked" : ""}>`, null, `<small>${w("notifsSub")}</small>`)}
      ${row("sound", "Sons", `<input type="checkbox" class="tg" id="sSound" ${soundOn ? "checked" : ""}>`)}
      ${row("card", w("cardPay"), `<span class="end">${driver.stripe_payouts_enabled ? w("cardOn") : w("cardOff")}</span><span class="chev">${icon("chevR")}</span>`, "sStripe")}
      ${row("globe", w("language"), `<span class="end">${lang === "fr" ? "Français" : "English"}</span><span class="chev">${icon("chevR")}</span>`, "sLang")}
      ${row("shield", w("help"), `<span class="chev">${icon("chevR")}</span>`, "sHelp")}
      ${row("doc", w("terms"), `<span class="chev">${icon("chevR")}</span>`, "sTerms")}
      ${row("admin", w("privacy"), `<span class="chev">${icon("chevR")}</span>`, "sPriv")}
      ${me.role === "ADMIN" ? row("settings", w("admin"), `<span class="chev">${icon("chevR")}</span>`, "sAdmin") : ""}
      ${row("logout", `<span class="logout">${w("logout")}</span>`, "", "sOut")}
    </div>`;
  $("#bk").onclick = () => go("profile");
  $("#sAvail").onchange = (e) => busy(e.target, async () => {
    const { error } = await sb.from("drivers").update({ is_available: e.target.checked }).eq("user_id", me.id);
    if (error) { e.target.checked = !e.target.checked; throw error; }
    if (e.target.checked) startGeo(); await loadAll(); render();
  });
  $("#sNotif").onchange = async (e) => {
    notifOn = e.target.checked;
    if (notifOn && "Notification" in window && Notification.permission !== "granted") notifOn = (await Notification.requestPermission()) === "granted";
    e.target.checked = notifOn; store.set("notif", notifOn);
  };
  $("#sSound").onchange = (e) => { soundOn = e.target.checked; store.set("sound", soundOn); };
  $("#sPrefs").onclick = () => go("vehicle");
  $("#sLang").onclick = () => { toggleLang(); location.reload(); };
  $("#sOut").onclick = logout;
  $("#sAdmin")?.addEventListener("click", () => go("admin"));
  $("#sHelp").onclick = () => { location.href = "legal.html#aide"; };
  $("#sTerms").onclick = () => { location.href = "legal.html#cgv"; };
  $("#sPriv").onclick = () => { location.href = "legal.html#confidentialite"; };
  $("#sStripe").onclick = () => busy(null, async () => {
    if (driver.stripe_account_id && !driver.stripe_payouts_enabled) { await call("connect-onboarding", { action: "status" }); await loadAll(); if (driver.stripe_payouts_enabled) return render(); }
    if (driver.stripe_payouts_enabled) { const { url } = await call("connect-onboarding", { action: "dashboard" }); location.href = url; return; }
    const { url } = await call("connect-onboarding", { action: "onboard" }); location.href = url;
  });
}

// ------------------------------------------------------------------ ADMINISTRATION
async function adminView() {
  const [{ data: drivers }, { data: rides }] = await Promise.all([
    sb.from("drivers").select("*, profiles!drivers_user_id_fkey(display_name, email, phone)").order("created_at", { ascending: false }),
    sb.from("bookings").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const co = await getSettings();
  const f = (k, label, type = "text") => `<label>${label}</label><input name="${k}" type="${type}" value="${esc(co[k] || "")}">`;
  app.innerHTML = `<h1>${w("admin")}</h1>
    <details class="card"><summary style="cursor:pointer;font-weight:700">${icon("settings")} ${w("company")}</summary>
      <p class="muted">${w("companySub")}</p>
      <form id="coForm">${f("nom", w("cName"))}${f("forme", w("cForm"))}${f("adresse", w("cAddress"))}
        <div class="row"><div>${f("siret", "SIRET")}</div><div>${f("evtc", w("cEvtc"))}</div></div>
        <div class="row"><div>${f("email", w("cEmail"), "email")}</div><div>${f("tel", w("cPhone"), "tel")}</div></div>
        ${f("responsable", w("cBoss"))}${f("mediateur", w("cMediator"))}
        <label>${w("cVat")}</label><select name="tva"><option value="franchise" ${co.tva !== "assujetti" ? "selected" : ""}>${w("cVatNo")}</option><option value="assujetti" ${co.tva === "assujetti" ? "selected" : ""}>${w("cVatYes")}</option></select>
        <label>${w("cCancel")}</label><textarea name="annulation" rows="3">${esc(co.annulation || "")}</textarea>
        <button class="btn" type="submit">${t("save")}</button></form></details>
    <div class="section-title">${t("drivers")}</div>
    <div class="card" style="padding:4px 16px">${(drivers || []).map((d) => `<div class="list-row" data-d="${d.user_id}"><div class="avatar">${esc(initials(d.profiles?.display_name))}</div>
      <div class="body"><div>${esc(d.profiles?.display_name)}</div><small>${esc(d.profiles?.email)}${d.profiles?.phone ? " · " + esc(d.profiles.phone) : ""}</small></div>
      ${partnerBadge(d.partner_status)}<span class="chev">${icon("chevR")}</span></div>`).join("") || `<p class="list-empty">—</p>`}</div>
    <div class="section-title">${t("allRides")}</div>
    ${(rides || []).map((b) => `<div class="card" style="padding:12px 14px">
      <div class="row" style="justify-content:space-between"><small class="muted">${fmtDate(b.scheduled_at || b.created_at)}</small><span style="flex:0">${statusBadge(b.status)}</span></div>
      <div class="route"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div>
      <div class="kv"><span>${esc(t("v_" + b.vehicle_type))} · ${b.payment_method === "ON_BOARD" ? t("onBoard") : t("card")} · ${esc(t("p_" + b.payment_status))}</span><strong>${euro(b.final_fare_cents ?? b.quoted_fare_cents)}</strong></div>
      ${["REQUESTED", ...RUNNING].includes(b.status) ? `<button class="btn small danger" data-cancel="${b.id}">${t("cancelRide")}</button>` : ""}</div>`).join("") || `<p class="list-empty">${t("noHistory")}</p>`}`;
  app.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => go("admin", b.dataset.d));
  $("#coForm").onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const doc = Object.fromEntries([...new FormData(e.target)].map(([k, v]) => [k, String(v).trim()]));
    const { error } = await sb.from("app_settings").update({ doc, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw error; toast(t("saved"));
  }); };
  app.querySelectorAll("[data-cancel]").forEach((b) => b.onclick = () => { if (confirm(t("cancelConfirm"))) busy(b, async () => { await call("booking-cancel", { bookingId: b.dataset.cancel, action: "cancel" }); render(); }); });
}

async function adminDriver(id) {
  const [{ data: d }, { data: veh }, { data: docs }] = await Promise.all([
    sb.from("drivers").select("*, profiles!drivers_user_id_fkey(display_name, email, phone)").eq("user_id", id).single(),
    sb.from("vehicles").select("*").eq("driver_user_id", id).order("created_at", { ascending: false }).limit(1),
    sb.from("driver_documents").select("*").eq("driver_user_id", id).order("uploaded_at", { ascending: false }),
  ]);
  const last = {};
  for (const x of docs || []) if (!last[x.document_type]) last[x.document_type] = x;
  const v = veh?.[0];
  app.innerHTML = `<div class="back"><button id="bk">${icon("back")}</button><span class="grow">${esc(d.profiles?.display_name)}</span>${partnerBadge(d.partner_status)}</div>
    <div class="card">
      <div class="kv"><span>${t("email")}</span><span>${esc(d.profiles?.email)}</span></div>
      <div class="kv"><span>${t("phone")}</span><span>${esc(d.profiles?.phone || "—")}</span></div>
      <div class="kv"><span>${t("siret")}</span><span>${esc(d.siret || "—")}</span></div>
      <div class="kv"><span>${t("vehicle")}</span><span>${v ? `${esc(t("v_" + v.vehicle_type))} · ${esc([v.make, v.model, v.color].filter(Boolean).join(" "))} · ${esc(v.registration_number)} · ${v.passenger_capacity} pl.` : "—"}</span></div>
      <div class="kv"><span>${t("cardPayouts")}</span><span>${d.stripe_payouts_enabled ? "✅" : "—"}</span></div>
      ${d.partner_status !== "VALIDATED" ? `<button class="btn" data-ps="VALIDATED">${t("validate")}</button>` : `<button class="btn danger" data-ps="SUSPENDED">${t("suspend")}</button>`}
      ${d.partner_status === "IN_REVIEW" || d.partner_status === "PENDING" ? `<button class="btn danger" data-ps="REJECTED">${t("reject")}</button>` : ""}</div>
    <div class="section-title">${w("docs")}</div>
    ${DOC_TYPES.map((k) => { const x = last[k]; return `<div class="card" style="padding:12px 14px">
      <div class="row" style="justify-content:space-between"><strong>${t("doc_" + k)}</strong><span style="flex:0">${x ? `<span class="badge ${{ APPROVED: "ok", REJECTED: "bad" }[x.status] || ""}">${t("d_" + x.status)}</span>` : `<span class="badge warn">${t("d_MISSING")}</span>`}</span></div>
      ${x?.expires_at ? `<p class="muted">${t("expires")} ${new Date(x.expires_at).toLocaleDateString()}</p>` : ""}
      ${x ? `<div class="row" style="margin-top:10px"><button class="btn small secondary" data-view="${esc(x.storage_key)}">${t("view")}</button>
        <button class="btn small" data-doc="${x.id}" data-st="APPROVED">${t("approve")}</button>
        <button class="btn small danger" data-doc="${x.id}" data-st="REJECTED">${t("reject")}</button></div>` : ""}</div>`; }).join("")}`;
  $("#bk").onclick = () => go("admin");
  app.querySelectorAll("[data-ps]").forEach((b) => b.onclick = () => busy(b, async () => {
    const { error } = await sb.from("drivers").update({ partner_status: b.dataset.ps }).eq("user_id", id);
    if (error) throw error; toast(t("saved")); render();
  }));
  app.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => busy(b, async () => {
    const win = window.open("", "_blank");
    const { data, error } = await sb.storage.from("driver-documents").createSignedUrl(b.dataset.view, 120);
    if (error) { win?.close(); throw error; }
    if (win) win.location = data.signedUrl; else location.href = data.signedUrl;
  }));
  app.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => busy(b, async () => {
    const patch = { status: b.dataset.st, rejection_reason: null };
    if (b.dataset.st === "REJECTED") { const r = prompt(t("reason")); if (r === null) return; patch.rejection_reason = r; }
    const { error } = await sb.from("driver_documents").update(patch).eq("id", b.dataset.doc);
    if (error) throw error; render();
  }));
}

start().catch(async (e) => { hideSplash(); app.innerHTML = `<div class="card">${esc(await errText(e))}</div>`; });
