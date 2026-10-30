// Transporteur VTC — tableau de bord administrateur (style Uber / Bolt)
import { sb, lang, t, toggleLang, $, esc, euro, fmtDate, toast, busy, call, errText, statusBadge, currentProfile, renderAuth,
  icon, makeMap, pinIcon, routeLayer, getRoute, fmtDist, initials, hideSplash } from "./core.js";
import { avatarHtml, getSettings, registerSW } from "./ui.js";

const app = $("#app"), top = $("#top"), tabbar = $("#tabbar"), overlay = $("#overlay");
const RUNNING = ["ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"];
const DOC_TYPES = ["CARTE_VTC", "PERMIS_B", "PIECE_IDENTITE", "ASSURANCE_RC_CIRCULATION", "ASSURANCE_RC_PRO", "CARTE_GRISE", "REGISTRE_EVTC", "KBIS_OU_SIRENE"];
const loc = lang === "en" ? "en-GB" : "fr-FR";
const short = (s) => String(s || "").split(",")[0].trim();
const money = (c) => euro(c || 0).replace(/,00(?=\s|$)/, "").replace(/\.00(?=$)/, "");
const isOnline = (d, pos) => d.is_available && d.partner_status === "VALIDATED" && pos && Date.now() - new Date(pos.updated_at) < 15 * 60e3;

let me = null, view = "dash", D = { bookings: [], drivers: [], locs: [], clients: [], profiles: {} };
let channel = null, timer = null, filt = { rides: "all", drivers: "all", q: "" }, mapInst = null;

// ------------------------------------------------------------------ démarrage
async function start() {
  registerSW();
  me = await currentProfile();
  hideSplash();
  if (!me) { drawTop(false); tabbar.classList.add("hidden"); return renderAuth(app, "driver", start); }
  if (me.role !== "ADMIN") {
    drawTop(false);
    app.innerHTML = `<div class="card empty-hero"><div class="art">${icon("admin")}</div><strong>Accès réservé</strong><p>Ce compte n'est pas administrateur.</p>
      <a class="btn" href="./">Ouvrir l'appli client</a><button class="btn secondary" id="out">Se déconnecter</button></div>`;
    $("#out").onclick = async () => { await sb.auth.signOut(); start(); };
    return;
  }
  await load();
  channel = sb.channel("admin").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => refresh())
    .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () => refresh()).subscribe();
  timer = setInterval(refresh, 15000);
  const h = location.hash.slice(1); if (["dash", "map", "rides", "drivers", "clients"].includes(h)) view = h;
  render();
}

async function load() {
  const since = new Date(Date.now() - 31 * 864e5).toISOString();
  const [b, d, l, p] = await Promise.all([
    sb.from("bookings").select("*").or(`created_at.gte.${since},status.in.(REQUESTED,ACCEPTED,DRIVER_ARRIVING,IN_PROGRESS)`).order("created_at", { ascending: false }).limit(800),
    sb.from("drivers").select("*").order("created_at", { ascending: false }),
    sb.from("driver_locations").select("*"),
    sb.from("profiles").select("id, role, email, phone, display_name, avatar_url, created_at, client_rating, client_rating_count").order("created_at", { ascending: false }).limit(1000),
  ]);
  D.bookings = b.data || []; D.drivers = d.data || []; D.locs = l.data || [];
  D.profiles = Object.fromEntries((p.data || []).map((x) => [x.id, x]));
  D.clients = (p.data || []).filter((x) => x.role === "CLIENT");
}
let refreshing = false;
async function refresh() {
  if (refreshing || overlay.innerHTML) return;
  refreshing = true;
  try { await load(); if (view !== "map") render(); else updateMap(); } finally { refreshing = false; }
}

// ------------------------------------------------------------------ cadre
function drawTop(withMenu = true) {
  top.innerHTML = `<img src="icon.svg" alt=""><div class="brand">Transporteur<small>Administration</small></div>
    ${withMenu ? `<button class="iconbtn" id="bell" aria-label="À traiter">${icon("bell")}${todo().length ? '<span class="dotn"></span>' : ""}</button>
    <button class="iconbtn" id="menu" aria-label="Menu">${icon("menu")}</button>` : `<button class="chip" id="langBtn">${lang === "fr" ? "EN" : "FR"}</button>`}`;
  $("#menu")?.addEventListener("click", drawer);
  $("#bell")?.addEventListener("click", () => go("dash"));
  $("#langBtn")?.addEventListener("click", () => { toggleLang(); location.reload(); });
}
function drawTabs() {
  const pending = D.drivers.filter((d) => ["PENDING", "IN_REVIEW"].includes(d.partner_status)).length;
  const live = D.bookings.filter((b) => b.status === "REQUESTED" || RUNNING.includes(b.status)).length;
  const tabs = [["dash", "home", "Tableau"], ["map", "pin", "Carte"], ["rides", "rides", "Courses", live], ["drivers", "car", "Chauffeurs", pending], ["clients", "users", "Clients"]];
  tabbar.innerHTML = `<div>${tabs.map(([k, ic, l, n]) => `<button data-v="${k}" class="${view === k ? "on" : ""}">${icon(ic)}<span>${l}</span>${n ? `<span class="nb">${n}</span>` : ""}</button>`).join("")}</div>`;
  tabbar.classList.remove("hidden"); document.body.classList.add("has-tabbar");
  tabbar.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => go(b.dataset.v));
}
function drawer() {
  const bg = document.createElement("div"); bg.className = "drawer-bg";
  const d = document.createElement("aside"); d.className = "drawer";
  const items = [["dash", "home", "Tableau de bord"], ["map", "pin", "Carte en direct"], ["rides", "rides", "Courses"], ["drivers", "car", "Chauffeurs"], ["clients", "users", "Clients"]];
  d.innerHTML = `<img class="logo" src="icon.svg" alt=""><h2>Transporteur</h2><div class="muted">${esc(me.display_name)} · Admin</div>
    <nav>${items.map(([k, ic, l]) => `<button data-v="${k}" class="${view === k ? "on" : ""}">${icon(ic)}<span class="grow">${l}</span></button>`).join("")}
      <button id="dCo">${icon("settings")}<span class="grow">Mon entreprise</span></button>
      <button id="dDrive">${icon("nav")}<span class="grow">Mode chauffeur</span></button>
      <button id="dClient">${icon("user")}<span class="grow">Appli client</span></button>
      <button id="dHelp">${icon("doc")}<span class="grow">CGV et mentions légales</span></button></nav>
    <nav style="flex:0"><button id="dOut" class="logout">${icon("logout")}<span class="grow">Se déconnecter</span></button></nav>`;
  const close = () => { bg.remove(); d.remove(); };
  bg.onclick = close;
  d.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => { close(); go(b.dataset.v); });
  d.querySelector("#dCo").onclick = () => { close(); companySheet(); };
  d.querySelector("#dDrive").onclick = () => busy(null, async () => {
    const { data } = await sb.from("drivers").select("user_id").eq("user_id", me.id).maybeSingle();
    if (!data) { const { error } = await sb.from("drivers").insert({ user_id: me.id }); if (error) throw error; }
    location.href = "chauffeur.html";
  });
  d.querySelector("#dClient").onclick = () => { location.href = "./"; };
  d.querySelector("#dHelp").onclick = () => { location.href = "legal.html#cgv"; };
  d.querySelector("#dOut").onclick = async () => { close(); clearInterval(timer); if (channel) sb.removeChannel(channel); channel = null; await sb.auth.signOut(); me = null; start(); };
  document.body.append(bg, d);
}
function go(v) { view = v; history.replaceState(null, "", "#" + v); window.scrollTo(0, 0); render(); }
function render() {
  drawTop(); drawTabs();
  if (mapInst) { mapInst.remove(); mapInst = null; }
  ({ dash, map: mapView, rides, drivers, clients })[view]();
}

// ------------------------------------------------------------------ calculs
const name = (id) => D.profiles[id]?.display_name || "—";
const fare = (b) => b.final_fare_cents ?? b.quoted_fare_cents ?? 0;
const dayStart = (offset = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
const done = () => D.bookings.filter((b) => b.status === "COMPLETED" && b.completed_at);
const locOf = (id) => D.locs.find((l) => l.driver_user_id === id);
function todo() {
  const out = [];
  const pend = D.drivers.filter((d) => ["PENDING", "IN_REVIEW"].includes(d.partner_status));
  if (pend.length) out.push({ ic: "car", cls: "amber", title: `${pend.length} dossier${pend.length > 1 ? "s" : ""} chauffeur à vérifier`, sub: pend.map((d) => name(d.user_id)).slice(0, 3).join(", "), go: () => { filt.drivers = "pending"; go("drivers"); } });
  const waiting = D.bookings.filter((b) => b.status === "REQUESTED");
  if (waiting.length) out.push({ ic: "clock", cls: "amber", title: `${waiting.length} course${waiting.length > 1 ? "s" : ""} sans chauffeur`, sub: "En attente d'acceptation", go: () => { filt.rides = "live"; go("rides"); } });
  return out;
}

// ------------------------------------------------------------------ TABLEAU DE BORD
async function dash() {
  const today = dayStart(), month = new Date(today.getFullYear(), today.getMonth(), 1);
  const dToday = done().filter((b) => new Date(b.completed_at) >= today);
  const dMonth = done().filter((b) => new Date(b.completed_at) >= month);
  const caToday = dToday.reduce((s, b) => s + fare(b), 0);
  const comMonth = dMonth.reduce((s, b) => s + (b.commission_cents || 0), 0);
  const validated = D.drivers.filter((d) => d.partner_status === "VALIDATED");
  const online = validated.filter((d) => isOnline(d, locOf(d.user_id)) || D.bookings.some((b) => b.driver_user_id === d.user_id && RUNNING.includes(b.status)));
  const live = D.bookings.filter((b) => b.status === "REQUESTED" || RUNNING.includes(b.status));
  const days = [...Array(7)].map((_, i) => dayStart(i - 6));
  const per = days.map((d, i) => done().filter((b) => { const c = new Date(b.completed_at); return c >= d && (i === 6 || c < days[i + 1]); }).reduce((s, b) => s + fare(b), 0));
  const max = Math.max(...per, 1), week = per.reduce((a, b) => a + b, 0);
  const co = await getSettings();
  const steps = [
    { ok: !!(co.siret && co.adresse), ic: "settings", title: "Compléter « Mon entreprise »", sub: "SIRET, adresse, médiateur : utilisés pour les CGV et les reçus", act: companySheet },
    { ok: D.drivers.length > 0, ic: "car", title: "Inscrire un premier chauffeur", sub: "Partagez le lien de l'espace chauffeur", act: () => share("chauffeur.html", "Rejoignez Transporteur VTC comme chauffeur") },
    { ok: validated.length > 0, ic: "check", title: "Valider un chauffeur", sub: "Vérifiez ses 8 documents puis validez-le", act: () => go("drivers") },
    { ok: D.bookings.length > 0, ic: "rides", title: "Faire une course test", sub: "Réservez depuis l'appli client, paiement « À bord »", act: () => share("", "Réservez votre chauffeur avec Transporteur VTC") },
  ];
  const started = steps.every((s) => s.ok);
  const hour = new Date().getHours();
  app.innerHTML = `
    <div class="adm-hello"><div><div class="muted">${new Date().toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}</div>
      <h1>${hour < 18 ? "Bonjour" : "Bonsoir"} ${esc(String(me.display_name || "").split(" ")[0])}</h1></div><span class="live"><i></i>En direct</span></div>
    <div class="kpis">
      <div class="kpi" data-go="rides"><div class="ic">${icon("wallet")}</div><strong>${money(caToday)}</strong><span>Chiffre d'affaires aujourd'hui</span></div>
      <div class="kpi green" data-go="rides"><div class="ic">${icon("rides")}</div><strong>${dToday.length}</strong><span>Courses terminées aujourd'hui</span></div>
      <div class="kpi" data-go="map"><div class="ic">${icon("nav")}</div><strong>${online.length}<span style="font-size:15px;color:var(--muted)"> / ${validated.length}</span></strong><span>Chauffeurs en ligne</span></div>
      <div class="kpi amber" data-go="rides"><div class="ic">${icon("card")}</div><strong>${money(comMonth)}</strong><span>Commissions ce mois</span></div>
    </div>
    <div class="mapcard"><div class="mapbox" id="dMap"></div>
      <div class="over"><span class="pill"><b class="dot-on"></b>${online.length} en ligne</span><span class="pill"><b class="dot-busy"></b>${D.bookings.filter((b) => RUNNING.includes(b.status)).length} en course</span>
        <span class="pill"><b class="dot-req"></b>${D.bookings.filter((b) => b.status === "REQUESTED").length} en attente</span></div>
      <button class="btn small open" id="openMap" style="width:auto">${icon("pin")} Carte en direct</button></div>
    ${todo().length ? `<div class="section-title">À traiter<span class="count">${todo().length}</span></div>
      <div class="card todo" style="padding:4px 16px">${todo().map((x, i) => `<div class="list-row" data-todo="${i}"><div class="vic ${x.cls}">${icon(x.ic)}</div><div class="body"><div>${esc(x.title)}</div><small>${esc(x.sub)}</small></div><span class="chev">${icon("chevR")}</span></div>`).join("")}</div>` : ""}
    ${started ? "" : `<div class="section-title">Démarrage<span class="count">${steps.filter((s) => s.ok).length}/4</span></div>
      <div class="card todo" style="padding:4px 16px">${steps.map((s, i) => `<div class="list-row ${s.ok ? "is-done" : ""}" data-step="${i}"><div class="vic ${s.ok ? "done" : ""}">${icon(s.ok ? "check" : s.ic)}</div>
        <div class="body"><div>${s.title}</div><small>${s.sub}</small></div>${s.ok ? "" : `<span class="chev">${icon("chevR")}</span>`}</div>`).join("")}</div>`}
    <div class="section-title">Revenus · 7 jours</div>
    <div class="card"><div class="chart-head"><strong>${money(week)}</strong><span class="muted">${done().filter((b) => new Date(b.completed_at) >= days[0]).length} courses</span></div>
      <div class="bars7">${per.map((v, i) => `<div><i class="${v ? (i === 6 ? "today" : "") : "zero"}" style="height:${Math.max(4, (v / max) * 100)}%" title="${euro(v)}"></i>
        <small>${i === 6 ? "Auj." : days[i].toLocaleDateString(loc, { weekday: "short" }).replace(".", "")}</small></div>`).join("")}</div></div>
    <div class="section-title">Courses en direct${live.length ? `<span class="count">${live.length}</span>` : ""}<span class="grow"></span><button class="link" id="allRides">Tout voir</button></div>
    ${live.length ? live.slice(0, 4).map(rideCard).join("") : `<div class="card empty-hero"><div class="art">${icon("route")}</div><strong>Aucune course en cours</strong><p>Les nouvelles réservations apparaîtront ici en temps réel.</p></div>`}
    <div class="section-title">Derniers chauffeurs<span class="grow"></span><button class="link" id="allDrv">Tout voir</button></div>
    ${D.drivers.length ? `<div class="card" style="padding:4px 16px">${D.drivers.slice(0, 4).map(driverRow).join("")}</div>`
      : `<div class="card empty-hero"><div class="art">${icon("car")}</div><strong>Aucun chauffeur inscrit</strong><p>Envoyez le lien d'inscription à vos chauffeurs.</p><button class="btn" id="inviteDrv">${icon("users")} Inviter un chauffeur</button></div>`}`;
  bindCommon();
  app.querySelectorAll("[data-go]").forEach((el) => el.onclick = () => go(el.dataset.go));
  app.querySelectorAll("[data-todo]").forEach((el) => el.onclick = () => todo()[+el.dataset.todo].go());
  app.querySelectorAll("[data-step]").forEach((el) => el.onclick = () => steps[+el.dataset.step].act());
  $("#openMap").onclick = () => go("map");
  $("#allRides").onclick = () => go("rides");
  $("#allDrv").onclick = () => go("drivers");
  $("#inviteDrv")?.addEventListener("click", () => share("chauffeur.html", "Rejoignez Transporteur VTC comme chauffeur"));
  mapInst = makeMap($("#dMap"), { dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false });
  if (mapInst) { mapInst.setView([48.8566, 2.3522], 11); drawMarkers(mapInst, true); }
}

async function share(path, text) {
  const url = new URL(path || "./", location.href).href;
  try { if (navigator.share) { await navigator.share({ title: "Transporteur VTC", text, url }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(url); toast("Lien copié : " + url); } catch { prompt("Lien à partager :", url); }
}

// ------------------------------------------------------------------ CARTE EN DIRECT
const carMk = (color) => L.divIcon({ className: "", html: `<div class="car-mk" style="background:${color}"><svg viewBox="0 0 24 24"><path d="M5 16V12l2-5h10l2 5v4"/><path d="M3 12h18v5H3z"/></svg></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
let layerGroup = null;
function drawMarkers(map, fit) {
  layerGroup?.remove(); layerGroup = L.layerGroup().addTo(map);
  const pts = [];
  for (const d of D.drivers) {
    const p = locOf(d.user_id); if (!p) continue;
    const busyRide = D.bookings.find((b) => b.driver_user_id === d.user_id && RUNNING.includes(b.status));
    const on = isOnline(d, p);
    if (!on && !busyRide) continue;
    L.marker([p.lat, p.lng], { icon: carMk(busyRide ? "#10b981" : "#1f7aff"), zIndexOffset: 500 }).addTo(layerGroup)
      .bindPopup(`<b>${esc(name(d.user_id))}</b><br>${busyRide ? esc(t("s_" + busyRide.status)) : "Disponible"} · ${new Date(p.updated_at).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" })}`);
    pts.push([p.lat, p.lng]);
  }
  for (const b of D.bookings.filter((x) => x.status === "REQUESTED" && x.pickup_lat != null)) {
    L.marker([b.pickup_lat, b.pickup_lng], { icon: pinIcon(true) }).addTo(layerGroup)
      .bindPopup(`<b>En attente</b><br>${esc(short(b.pickup_label))} → ${esc(short(b.destination_label))}<br>${money(fare(b))}`);
    pts.push([b.pickup_lat, b.pickup_lng]);
  }
  if (fit && pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 });
}
function mapView() {
  const nOn = D.drivers.filter((d) => isOnline(d, locOf(d.user_id))).length;
  const nBusy = D.bookings.filter((b) => RUNNING.includes(b.status)).length, nReq = D.bookings.filter((b) => b.status === "REQUESTED").length;
  app.innerHTML = `<div class="map-page"><div class="mapbox" id="bigMap"></div>
    <div class="over" id="mapPills"><span class="pill"><b class="dot-on"></b>${nOn} disponible${nOn > 1 ? "s" : ""}</span><span class="pill"><b class="dot-busy"></b>${nBusy} en course</span><span class="pill"><b class="dot-req"></b>${nReq} demande${nReq > 1 ? "s" : ""}</span></div>
    ${!nOn && !nBusy && !nReq ? `<div class="legend"><div class="card center"><strong>Aucun chauffeur en ligne</strong><div class="muted" style="font-size:13px">Les chauffeurs validés et « En ligne » apparaissent ici en temps réel.</div></div></div>` : ""}</div>`;
  mapInst = makeMap($("#bigMap"));
  if (mapInst) { mapInst.setView([48.8566, 2.3522], 11); setTimeout(() => { mapInst?.invalidateSize(); drawMarkers(mapInst, true); }, 50); }
}
function updateMap() { if (mapInst) drawMarkers(mapInst, false); }

// ------------------------------------------------------------------ COURSES
function rideCard(b) {
  return `<div class="card ride" data-ride="${b.id}"><div class="top1">${statusBadge(b.status)}<span class="grow">${fmtDate(b.scheduled_at || b.created_at)}</span><span class="price">${money(fare(b))}</span></div>
    <div class="route"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div>
    <div class="people"><span>${icon("user")} ${esc(name(b.client_user_id))}</span><span>${icon("car")} ${b.driver_user_id ? esc(name(b.driver_user_id)) : "<i>Pas encore de chauffeur</i>"}</span>
      <span>${icon(b.payment_method === "ON_BOARD" ? "wallet" : "card")} ${b.payment_method === "ON_BOARD" ? t("onBoard") : t("card")}</span></div></div>`;
}
function rides() {
  const F = { all: ["Toutes", () => true], live: ["En cours", (b) => b.status === "REQUESTED" || RUNNING.includes(b.status)],
    done: ["Terminées", (b) => b.status === "COMPLETED"], cancel: ["Annulées", (b) => b.status === "CANCELLED"] };
  const q = filt.q.toLowerCase();
  const list = D.bookings.filter(F[filt.rides][1]).filter((b) => !q || [b.pickup_label, b.destination_label, name(b.client_user_id), name(b.driver_user_id)].join(" ").toLowerCase().includes(q));
  const ca = list.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + fare(b), 0);
  app.innerHTML = `<h1>Courses</h1>
    <div class="search">${icon("route")}<input id="q" placeholder="Rechercher une adresse, un client, un chauffeur…" value="${esc(filt.q)}"></div>
    <div class="filters">${Object.entries(F).map(([k, [l, f]]) => `<button class="chip ${filt.rides === k ? "on" : ""}" data-f="${k}">${l} <small>${D.bookings.filter(f).length}</small></button>`).join("")}</div>
    ${list.length ? `<div class="muted" style="font-size:13px;margin:-4px 0 10px">${list.length} course(s)${ca ? ` · ${money(ca)} encaissés` : ""} · 31 derniers jours</div>${list.slice(0, 120).map(rideCard).join("")}`
      : `<div class="card empty-hero"><div class="art">${icon("rides")}</div><strong>Aucune course</strong><p>${filt.rides === "all" && !q ? "Dès qu'un client réserve, la course s'affiche ici en direct." : "Aucune course ne correspond à ce filtre."}</p>
        ${filt.rides === "all" && !q ? `<button class="btn secondary" id="shareClient">${icon("users")} Partager l'appli client</button>` : ""}</div>`}`;
  app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { filt.rides = b.dataset.f; rides(); });
  const qi = $("#q"); qi.oninput = () => { filt.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { rides(); const n = $("#q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $("#shareClient")?.addEventListener("click", () => share("", "Réservez votre chauffeur avec Transporteur VTC"));
  bindCommon();
}
async function rideSheet(id) {
  const b = D.bookings.find((x) => x.id === id) || (await sb.from("bookings").select("*").eq("id", id).maybeSingle()).data;
  if (!b) return;
  const el = sheet(`<div class="sheet-head"><h1>Course</h1><button class="iconbtn" data-close>${icon("x")}</button></div>
    <div class="map" id="rMap" style="height:220px;margin-top:0"></div>
    <div class="card"><div class="row" style="justify-content:space-between;align-items:center"><span style="flex:0">${statusBadge(b.status)}</span><strong style="font-size:22px;flex:0">${euro(fare(b))}</strong></div>
      <div class="route" style="margin-top:10px"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div></div>
    <div class="card">
      <div class="kv"><span>Client</span><span>${esc(name(b.client_user_id))}${D.profiles[b.client_user_id]?.phone ? ` · <a href="tel:${esc(D.profiles[b.client_user_id].phone)}">${esc(D.profiles[b.client_user_id].phone)}</a>` : ""}</span></div>
      <div class="kv"><span>Chauffeur</span><span>${b.driver_user_id ? esc(name(b.driver_user_id)) : "—"}${D.profiles[b.driver_user_id]?.phone ? ` · <a href="tel:${esc(D.profiles[b.driver_user_id].phone)}">${esc(D.profiles[b.driver_user_id].phone)}</a>` : ""}</span></div>
      <div class="kv"><span>Réservée le</span><span>${fmtDate(b.created_at)}</span></div>
      ${b.scheduled_at ? `<div class="kv"><span>Prévue le</span><span>${fmtDate(b.scheduled_at)}</span></div>` : ""}
      ${b.completed_at ? `<div class="kv"><span>Terminée le</span><span>${fmtDate(b.completed_at)}</span></div>` : ""}
      <div class="kv"><span>Trajet</span><span>${fmtDist(b.distance_meters || 0)} · ${Math.round((b.duration_seconds || 0) / 60)} min</span></div>
      <div class="kv"><span>Véhicule</span><span>${esc(t("v_" + b.vehicle_type))} · ${b.passengers} pass.</span></div>
      <div class="kv"><span>Paiement</span><span>${b.payment_method === "ON_BOARD" ? t("onBoard") : t("card")} · ${esc(t("p_" + b.payment_status))}</span></div>
      <div class="kv"><span>Commission</span><span>${euro(b.commission_cents)}</span></div>
      <div class="kv"><span>Part chauffeur</span><span>${euro(b.driver_earnings_cents)}</span></div>
      ${b.driver_rating ? `<div class="kv"><span>Note du client</span><span class="stars-s">${"★".repeat(b.driver_rating)}</span></div>` : ""}
      ${b.notes ? `<div class="kv"><span>Note</span><span>${esc(b.notes)}</span></div>` : ""}</div>
    ${b.status === "COMPLETED" ? `<a class="btn secondary" href="receipt.html?id=${b.id}">${icon("doc")} Reçu (PDF)</a>` : ""}
    ${["REQUESTED", ...RUNNING].includes(b.status) ? `<button class="btn danger" id="rCancel">${t("cancelRide")}</button>` : ""}`);
  el.querySelector("#rCancel")?.addEventListener("click", (e) => { if (confirm(t("cancelConfirm"))) busy(e.target, async () => { await call("booking-cancel", { bookingId: b.id, action: "cancel" }); closeSheet(); await load(); render(); }); });
  const map = makeMap(el.querySelector("#rMap"));
  if (map && b.pickup_lat != null) {
    const from = { lat: b.pickup_lat, lng: b.pickup_lng }, to = { lat: b.destination_lat, lng: b.destination_lng };
    L.marker([from.lat, from.lng], { icon: pinIcon(true) }).addTo(map); L.marker([to.lat, to.lng], { icon: pinIcon() }).addTo(map);
    map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], { padding: [40, 40] });
    const r = await getRoute(from, to); if (el.isConnected) { const lay = routeLayer(map, r.coords); map.fitBounds(lay.bounds, { padding: [40, 40] }); }
  }
}

// ------------------------------------------------------------------ CHAUFFEURS
const partnerBadge = (s) => `<span class="badge ${{ VALIDATED: "ok", SUSPENDED: "bad", REJECTED: "bad" }[s] || "warn"}">${esc(t("partner_" + s))}</span>`;
function driverRow(d) {
  const p = D.profiles[d.user_id] || {}, pos = locOf(d.user_id);
  const ride = D.bookings.find((b) => b.driver_user_id === d.user_id && RUNNING.includes(b.status));
  const st = ride ? "dot-busy" : isOnline(d, pos) ? "dot-on" : "dot-off";
  const n = done().filter((b) => b.driver_user_id === d.user_id).length;
  return `<div class="list-row who" data-drv="${d.user_id}">${avatarHtml(p, "", `<span class="st ${st}"></span>`)}
    <div class="body"><div><strong>${esc(p.display_name || "—")}</strong></div><small>${esc(p.email || "")}</small>
      <div class="mini-stats"><span>${ride ? "En course" : isOnline(d, pos) ? "En ligne" : "Hors ligne"}</span><span>${n} course(s) / 31 j</span>${d.rating ? `<span>★ ${d.rating}</span>` : ""}</div></div>
    ${partnerBadge(d.partner_status)}<span class="chev">${icon("chevR")}</span></div>`;
}
function drivers() {
  const F = { all: ["Tous", () => true], pending: ["À valider", (d) => ["PENDING", "IN_REVIEW"].includes(d.partner_status)],
    ok: ["Validés", (d) => d.partner_status === "VALIDATED"], online: ["En ligne", (d) => isOnline(d, locOf(d.user_id))], off: ["Suspendus / refusés", (d) => ["SUSPENDED", "REJECTED"].includes(d.partner_status)] };
  const list = D.drivers.filter(F[filt.drivers][1]);
  app.innerHTML = `<div class="section-title" style="margin-top:4px"><h1 style="margin:0;flex:1">Chauffeurs</h1><button class="btn small" id="inv" style="width:auto">${icon("users")} Inviter</button></div>
    <div class="filters">${Object.entries(F).map(([k, [l, f]]) => `<button class="chip ${filt.drivers === k ? "on" : ""}" data-f="${k}">${l} <small>${D.drivers.filter(f).length}</small></button>`).join("")}</div>
    ${list.length ? `<div class="card" style="padding:4px 16px">${list.map(driverRow).join("")}</div>`
      : `<div class="card empty-hero"><div class="art">${icon("car")}</div><strong>${D.drivers.length ? "Aucun chauffeur dans cette catégorie" : "Aucun chauffeur inscrit"}</strong>
        <p>Les chauffeurs s'inscrivent depuis l'espace chauffeur, envoient leurs 8 documents, puis vous les validez ici.</p>
        <button class="btn" id="inv2">${icon("users")} Envoyer le lien d'inscription</button></div>`}`;
  app.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { filt.drivers = b.dataset.f; drivers(); });
  const invite = () => share("chauffeur.html", "Rejoignez Transporteur VTC comme chauffeur");
  $("#inv").onclick = invite; $("#inv2")?.addEventListener("click", invite);
  bindCommon();
}
async function driverSheet(id) {
  const [{ data: d }, { data: veh }, { data: docs }] = await Promise.all([
    sb.from("drivers").select("*").eq("user_id", id).single(),
    sb.from("vehicles").select("*").eq("driver_user_id", id).order("created_at", { ascending: false }).limit(1),
    sb.from("driver_documents").select("*").eq("driver_user_id", id).order("uploaded_at", { ascending: false }),
  ]);
  const p = D.profiles[id] || {}, v = veh?.[0], last = {};
  for (const x of docs || []) if (!last[x.document_type]) last[x.document_type] = x;
  const mine = done().filter((b) => b.driver_user_id === id);
  const okDocs = DOC_TYPES.filter((k) => last[k]?.status === "APPROVED").length;
  const el = sheet(`<div class="sheet-head"><h1>Chauffeur</h1><button class="iconbtn" data-close>${icon("x")}</button></div>
    <div class="card center" style="padding-top:20px">${avatarHtml(p, "lg")}<h2 style="margin:10px 0 4px">${esc(p.display_name)}</h2>
      <div>${partnerBadge(d.partner_status)}</div>
      <div class="stats" style="margin-top:14px"><div><strong>${mine.length}</strong><span>Courses (31 j)</span></div>
        <div><strong>${money(mine.reduce((s, b) => s + (b.driver_earnings_cents || 0), 0))}</strong><span>Gagné (31 j)</span></div><div><strong>${d.rating ?? "—"}</strong><span>Note</span></div></div></div>
    <div class="card">
      <div class="kv"><span>${t("email")}</span><span>${esc(p.email)}</span></div>
      <div class="kv"><span>${t("phone")}</span><span>${p.phone ? `<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : "—"}</span></div>
      <div class="kv"><span>SIRET</span><span>${esc(d.siret || "—")}</span></div>
      <div class="kv"><span>${t("vehicle")}</span><span>${v ? `${esc(t("v_" + v.vehicle_type))} · ${esc([v.make, v.model, v.color].filter(Boolean).join(" "))} · ${esc(v.registration_number)}` : "—"}</span></div>
      <div class="kv"><span>${t("cardPayouts")}</span><span>${d.stripe_payouts_enabled ? "Activés" : "—"}</span></div>
      <div class="kv"><span>Documents approuvés</span><span>${okDocs}/8</span></div>
      ${d.partner_status !== "VALIDATED" ? `<button class="btn" data-ps="VALIDATED">${icon("check")} ${t("validate")}</button>` : `<button class="btn danger" data-ps="SUSPENDED">${t("suspend")}</button>`}
      ${["IN_REVIEW", "PENDING"].includes(d.partner_status) ? `<button class="btn secondary" data-ps="REJECTED">${t("reject")}</button>` : ""}</div>
    <div class="section-title">${t("documents")}<span class="count">${okDocs}/8</span></div>
    ${DOC_TYPES.map((k) => { const x = last[k]; return `<div class="card" style="padding:12px 14px">
      <div class="row" style="justify-content:space-between;align-items:center"><strong>${t("doc_" + k)}</strong><span style="flex:0">${x ? `<span class="badge ${{ APPROVED: "ok", REJECTED: "bad" }[x.status] || ""}">${t("d_" + x.status)}</span>` : `<span class="badge warn">${t("d_MISSING")}</span>`}</span></div>
      ${x?.expires_at ? `<p class="muted" style="margin:6px 0 0">${t("expires")} ${new Date(x.expires_at).toLocaleDateString(loc)}</p>` : ""}
      ${x ? `<div class="row" style="margin-top:10px"><button class="btn small secondary" data-view="${esc(x.storage_key)}">${t("view")}</button>
        <button class="btn small" data-doc="${x.id}" data-st="APPROVED">${t("approve")}</button><button class="btn small danger" data-doc="${x.id}" data-st="REJECTED">${t("reject")}</button></div>` : ""}</div>`; }).join("")}`);
  el.querySelectorAll("[data-ps]").forEach((b) => b.onclick = () => busy(b, async () => {
    const { error } = await sb.from("drivers").update({ partner_status: b.dataset.ps }).eq("user_id", id);
    if (error) throw error; toast(t("saved")); await load(); driverSheet(id);
  }));
  el.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => busy(b, async () => {
    const win = window.open("", "_blank");
    const { data, error } = await sb.storage.from("driver-documents").createSignedUrl(b.dataset.view, 120);
    if (error) { win?.close(); throw error; }
    if (win) win.location = data.signedUrl; else location.href = data.signedUrl;
  }));
  el.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => busy(b, async () => {
    const patch = { status: b.dataset.st, rejection_reason: null };
    if (b.dataset.st === "REJECTED") { const r = prompt(t("reason")); if (r === null) return; patch.rejection_reason = r; }
    const { error } = await sb.from("driver_documents").update(patch).eq("id", b.dataset.doc);
    if (error) throw error; driverSheet(id);
  }));
}

// ------------------------------------------------------------------ CLIENTS
function clients() {
  const q = filt.q.toLowerCase();
  const list = D.clients.filter((c) => !q || [c.display_name, c.email, c.phone].join(" ").toLowerCase().includes(q));
  const newWeek = D.clients.filter((c) => new Date(c.created_at) > Date.now() - 7 * 864e5).length;
  app.innerHTML = `<h1>Clients</h1>
    <div class="kpis" style="margin-bottom:14px"><div class="kpi"><div class="ic">${icon("users")}</div><strong>${D.clients.length}</strong><span>Clients inscrits</span></div>
      <div class="kpi green"><div class="ic">${icon("user")}</div><strong>+${newWeek}</strong><span>Nouveaux cette semaine</span></div></div>
    <div class="search">${icon("user")}<input id="q" placeholder="Nom, e-mail ou téléphone…" value="${esc(filt.q)}"></div>
    ${list.length ? `<div class="card" style="padding:4px 16px">${list.map((c) => { const mine = D.bookings.filter((b) => b.client_user_id === c.id);
      const spent = mine.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + fare(b), 0);
      return `<div class="list-row who" data-cli="${c.id}">${avatarHtml(c)}<div class="body"><div><strong>${esc(c.display_name)}</strong></div><small>${esc(c.email)}${c.phone ? " · " + esc(c.phone) : ""}</small>
        <div class="mini-stats"><span>${mine.length} course(s)</span>${spent ? `<span>${money(spent)} dépensés</span>` : ""}${c.client_rating ? `<span>★ ${c.client_rating}</span>` : ""}<span>Inscrit le ${new Date(c.created_at).toLocaleDateString(loc)}</span></div></div><span class="chev">${icon("chevR")}</span></div>`; }).join("")}</div>`
      : `<div class="card empty-hero"><div class="art">${icon("users")}</div><strong>Aucun client</strong><p>Partagez l'appli pour recevoir vos premières réservations.</p><button class="btn" id="shareC">${icon("users")} Partager l'appli client</button></div>`}`;
  const qi = $("#q"); qi.oninput = () => { filt.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { clients(); const n = $("#q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  $("#shareC")?.addEventListener("click", () => share("", "Réservez votre chauffeur avec Transporteur VTC"));
  app.querySelectorAll("[data-cli]").forEach((el) => el.onclick = () => clientSheet(el.dataset.cli));
}
function clientSheet(id) {
  const c = D.profiles[id], mine = D.bookings.filter((b) => b.client_user_id === id);
  sheet(`<div class="sheet-head"><h1>Client</h1><button class="iconbtn" data-close>${icon("x")}</button></div>
    <div class="card center" style="padding-top:20px">${avatarHtml(c, "lg")}<h2 style="margin:10px 0 2px">${esc(c.display_name)}</h2><div class="muted">${esc(c.email)}</div>
      ${c.phone ? `<a class="btn secondary" style="margin-top:12px" href="tel:${esc(c.phone)}">${icon("phone")} ${esc(c.phone)}</a>` : ""}
      <div class="stats" style="margin-top:14px"><div><strong>${mine.length}</strong><span>Courses</span></div><div><strong>${money(mine.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + fare(b), 0))}</strong><span>Dépensé</span></div>
        <div><strong>${c.client_rating ?? "—"}</strong><span>Note chauffeurs</span></div></div></div>
    <div class="section-title">Ses courses</div>${mine.length ? mine.map(rideCard).join("") : `<p class="list-empty">Aucune course.</p>`}`);
  overlay.querySelectorAll("[data-ride]").forEach((el) => el.onclick = () => rideSheet(el.dataset.ride));
}

// ------------------------------------------------------------------ MON ENTREPRISE
async function companySheet() {
  const co = await getSettings();
  const f = (k, label, type = "text", ph = "") => `<label>${label}</label><input name="${k}" type="${type}" placeholder="${ph}" value="${esc(co[k] || "")}">`;
  const el = sheet(`<div class="sheet-head"><h1>Mon entreprise</h1><button class="iconbtn" data-close>${icon("x")}</button></div>
    <p class="muted">Ces informations apparaissent dans les mentions légales, les CGV et les reçus de vos clients.</p>
    <form class="card" id="coForm">${f("nom", "Nom commercial", "text", "Transporteur VTC")}${f("forme", "Forme juridique", "text", "EI, SASU…")}${f("adresse", "Adresse du siège")}
      <div class="row"><div>${f("siret", "SIRET", "text", "14 chiffres")}</div><div>${f("evtc", "N° registre VTC", "text", "EVTC…")}</div></div>
      <div class="row"><div>${f("email", "E-mail de contact", "email")}</div><div>${f("tel", "Téléphone", "tel")}</div></div>
      ${f("responsable", "Directeur de la publication")}${f("mediateur", "Médiateur de la consommation")}
      <label>TVA</label><select name="tva"><option value="franchise" ${co.tva !== "assujetti" ? "selected" : ""}>Non applicable (art. 293 B du CGI)</option><option value="assujetti" ${co.tva === "assujetti" ? "selected" : ""}>Assujetti à la TVA</option></select>
      <label>Politique d'annulation</label><textarea name="annulation" rows="3">${esc(co.annulation || "")}</textarea>
      <button class="btn" type="submit">${t("save")}</button></form>`);
  el.querySelector("#coForm").onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const doc = Object.fromEntries([...new FormData(e.target)].map(([k, v]) => [k, String(v).trim()]));
    const { error } = await sb.from("app_settings").update({ doc, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw error; toast(t("saved")); closeSheet(); render();
  }); };
}

// ------------------------------------------------------------------ outils
function sheet(html) {
  overlay.innerHTML = `<div class="sheet"><div class="inner">${html}</div></div>`;
  const el = overlay.firstElementChild;
  el.querySelectorAll("[data-close]").forEach((b) => b.onclick = closeSheet);
  return el;
}
function closeSheet() { overlay.innerHTML = ""; }
function bindCommon() {
  app.querySelectorAll("[data-ride]").forEach((el) => el.onclick = () => rideSheet(el.dataset.ride));
  app.querySelectorAll("[data-drv]").forEach((el) => el.onclick = () => driverSheet(el.dataset.drv));
}

start().catch(async (e) => { hideSplash(); app.innerHTML = `<div class="card">${esc(await errText(e))}</div>`; });
