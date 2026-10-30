// Transporteur VTC — appli client (même style que l'espace chauffeur)
import { sb, isRecovery, lang, t, toggleLang, $, esc, euro, fmtDate, toast, busy, call, rpc, errText, statusBadge, addressField, reverseGeocode,
  makeMap, pinIcon, meIcon, labelIcon, routeLayer, getRoute, fmtDist, initials, icon, hideSplash, currentProfile, renderAuth, VEHICLE_ICON } from "./core.js";

const W = {
  fr: { home: "Réserver", rides: "Courses", profile: "Profil", whereTo: "Où allez-vous ?", tagline: "Votre chauffeur privé", logout: "Se déconnecter",
    driverComing: "Votre chauffeur arrive", arrivalIn: "Arrivée dans", onTheWay: "En route vers votre destination", driver: "Chauffeur",
    done: "Course terminée", paidCard: "Paiement effectué", paidBoard: "À régler au chauffeur", rate: "Notez votre chauffeur", newRide: "Réserver une nouvelle course",
    myRides: "Mes courses", language: "Langue", info: "Mes informations", driverSpace: "Espace chauffeur", pickup: "Prise en charge", destination: "Destination" },
  en: { home: "Book", rides: "Rides", profile: "Profile", whereTo: "Where to?", tagline: "Your private driver", logout: "Log out",
    driverComing: "Your driver is coming", arrivalIn: "Arrival in", onTheWay: "On the way to your destination", driver: "Driver",
    done: "Ride completed", paidCard: "Payment received", paidBoard: "Pay the driver", rate: "Rate your driver", newRide: "Book a new ride",
    myRides: "My rides", language: "Language", info: "My information", driverSpace: "Driver space", pickup: "Pickup", destination: "Destination" },
};
const w = (k) => W[lang]?.[k] ?? W.fr[k] ?? t(k);
const short = (label) => String(label || "").split(",")[0].trim();

const app = $("#app"), top = $("#top"), tabbar = $("#tabbar"), overlay = $("#overlay");
const ACTIVE = ["REQUESTED", "ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"];
let recoveryDone = false, me = null, channel = null, pollTimer = null, view = "home";
const form = { pickup: null, destination: null, when: "now", at: "", passengers: 1, notes: "", quotes: null, vehicle: null, pay: "ON_BOARD", info: null };

function cleanup() {
  if (channel) { sb.removeChannel(channel); channel = null; }
  clearInterval(pollTimer); pollTimer = null;
}

function header() {
  top.innerHTML = `<img src="icon.svg" alt=""><div class="brand">Transporteur<small>${w("tagline")}</small></div>
    <button class="chip" id="langBtn">${lang === "fr" ? "EN" : "FR"}</button>`;
  $("#langBtn").onclick = () => { toggleLang(); location.reload(); };
}
function drawTabbar() {
  if (!me?.role) { tabbar.classList.add("hidden"); document.body.classList.remove("has-tabbar"); return; }
  tabbar.innerHTML = `<div>${[["home", "car"], ["rides", "rides"], ["profile", "user"]].map(([k, ic]) => `<button data-v="${k}" class="${view === k ? "on" : ""}">${icon(ic)}<span>${w(k)}</span></button>`).join("")}</div>`;
  tabbar.classList.remove("hidden"); document.body.classList.add("has-tabbar");
  tabbar.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => { view = b.dataset.v; home(); });
}

async function start() {
  cleanup();
  me = await currentProfile();
  hideSplash();
  header();
  if (!me) { drawTabbar(); return renderAuth(app, "client", start); }
  if (isRecovery && !recoveryDone && (recoveryDone = true)) return renderAuth(app, "client", start, "newpw");
  if (!me.role) { app.innerHTML = `<div class="card">${esc(t("checkEmail"))}</div>`; return; }
  home();
}

async function home() {
  cleanup();
  overlay.innerHTML = "";
  drawTabbar();
  const { data: mine } = await sb.from("bookings").select("*").eq("client_user_id", me.id).order("created_at", { ascending: false }).limit(30);
  const list = mine || [];
  const active = list.find((b) => ACTIVE.includes(b.status) && !(b.payment_method === "CARD" && b.payment_status === "PENDING" && Date.now() - new Date(b.created_at) > 30 * 60e3));
  if (active) return track(active.id);
  const toRate = list.find((b) => b.status === "COMPLETED" && !b.driver_rating && Date.now() - new Date(b.completed_at) < 24 * 3600e3);
  if (toRate && !sessionStorage.getItem("rated-" + toRate.id)) return showDone(toRate);
  window.scrollTo(0, 0);
  if (view === "rides") return ridesView(list);
  if (view === "profile") return profileView();
  bookingForm();
}

// ------------------------------------------------------------------ réservation
let formMap = null, formLayer = null, formMarks = [];
function bookingForm() {
  app.innerHTML = `
    <div class="map" id="bkMap" style="height:200px;margin-top:0"></div>
    <div class="card">
      <h2 style="margin-top:0">${w("whereTo")}</h2>
      <label>${t("pickup")}</label>
      <div><input id="pickup" placeholder="Gare de Lyon, 12 rue…" autocomplete="off" value="${esc(form.pickup?.label || "")}"></div>
      <button class="link" id="locBtn" style="margin-top:8px;display:inline-flex;gap:6px;align-items:center">${icon("locate")} ${t("myPosition")}</button>
      <label>${t("destination")}</label>
      <div><input id="dest" placeholder="Aéroport Charles de Gaulle…" autocomplete="off" value="${esc(form.destination?.label || "")}"></div>
      <label>${t("when")}</label>
      <div class="seg" id="whenSeg"><button data-w="now" class="${form.when === "now" ? "on" : ""}">${t("now")}</button><button data-w="later" class="${form.when === "later" ? "on" : ""}">${t("later")}</button></div>
      <input id="at" type="datetime-local" class="${form.when === "later" ? "" : "hidden"}" style="margin-top:8px" value="${esc(form.at)}">
      <div class="row">
        <div><label>${t("passengers")}</label><select id="pax">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option ${n === form.passengers ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      </div>
      <label>${t("notes")}</label><input id="notes" maxlength="300" value="${esc(form.notes)}">
      <button class="btn" id="quoteBtn">${t("seePrices")}</button>
    </div>
    <div id="quotes"></div>
    <p class="center muted" style="margin-top:20px"><a href="chauffeur.html">${w("driverSpace")}</a></p>`;

  formMap = makeMap($("#bkMap")); formLayer = null; formMarks = [];
  const drawFormRoute = async () => {
    if (!formMap) return;
    formLayer?.remove(); formMarks.forEach((m) => m.remove()); formMarks = []; formLayer = null;
    const p = form.pickup, d = form.destination;
    if (p) formMarks.push(L.marker([p.lat, p.lng], { icon: pinIcon(true) }).addTo(formMap));
    if (d) { formMarks.push(L.marker([d.lat, d.lng], { icon: pinIcon() }).addTo(formMap)); formMarks.push(L.marker([d.lat, d.lng], { icon: labelIcon(short(d.label)) }).addTo(formMap)); }
    if (p && d) { const r = await getRoute(p, d); formLayer = routeLayer(formMap, r.coords); formMap.fitBounds(formLayer.bounds, { padding: [30, 30] }); }
    else if (p || d) formMap.setView([(p || d).lat, (p || d).lng], 14);
  };
  drawFormRoute();

  const pickupIn = $("#pickup"), destIn = $("#dest");
  addressField(pickupIn, (p) => { form.pickup = p; form.quotes = null; $("#quotes").innerHTML = ""; if (p) drawFormRoute(); });
  addressField(destIn, (p) => { form.destination = p; form.quotes = null; $("#quotes").innerHTML = ""; if (p) drawFormRoute(); }, () => form.pickup);
  $("#locBtn").onclick = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const place = (await reverseGeocode(lat, lng).catch(() => null)) || { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
      form.pickup = { ...place, lat, lng };
      pickupIn.value = form.pickup.label;
      drawFormRoute();
    }, () => toast(t("geoDenied").replace(/ pour.*| so .*/, ""), true), { enableHighAccuracy: true, timeout: 10000 });
  };
  $("#whenSeg").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    form.when = b.dataset.w;
    $("#whenSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("#at").classList.toggle("hidden", form.when !== "later");
    if (form.when === "later" && !$("#at").value) {
      const d = new Date(Date.now() + 2 * 3600e3); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
      $("#at").value = new Date(d - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
    }
  };
  $("#quoteBtn").onclick = (e) => busy(e.target, async () => {
    form.at = $("#at").value; form.passengers = +$("#pax").value; form.notes = $("#notes").value.trim();
    if (!form.pickup || !form.destination) throw new Error(t("pickup") + " / " + t("destination") + " ?");
    const data = await call("quote", { pickup: form.pickup, destination: form.destination });
    form.info = data;
    const { data: cats } = await sb.from("vehicle_categories").select("*");
    const capacity = Object.fromEntries((cats || []).map((c) => [c.vehicle_type, c]));
    form.quotes = data.quotes.filter((q) => (capacity[q.vehicle]?.max_passengers ?? 8) >= form.passengers).map((q) => ({ ...q, cat: capacity[q.vehicle] }));
    form.vehicle = form.quotes[0]?.vehicle || null;
    drawQuotes();
  });
  if (form.quotes) drawQuotes();
}

function drawQuotes() {
  const box = $("#quotes");
  const info = form.info;
  box.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">${t("chooseVehicle")}</h2>
      <div class="trip-stats" style="margin-top:0"><div><span>Distance</span><strong>${fmtDist(info.distanceMeters)}</strong></div>
        <div><span>${lang === "en" ? "Duration" : "Durée estimée"}</span><strong>${Math.round(info.durationSeconds / 60)} min</strong></div><div></div></div>
      ${form.quotes.map((q) => `
        <div class="vehicle ${q.vehicle === form.vehicle ? "on" : ""}" data-v="${q.vehicle}">
          <span class="vic" style="width:44px;height:44px;border-radius:12px;background:var(--card2);display:flex;align-items:center;justify-content:center">${icon("car")}</span>
          <div class="name">${esc(t("v_" + q.vehicle))}<br><small class="muted" style="font-weight:400">${q.cat ? `${q.cat.max_passengers} ${lang === "en" ? "seats" : "places"} · ${q.cat.max_bags} ${lang === "en" ? "bags" : "bagages"}` : ""}${q.pricingMode === "FIXED" ? ` · ${t("fixed")}` : ""}
            <br>${q.driversNearby ? `${q.driversNearby} ${t("driversNearby")}${q.etaMinutes ? ` · ${q.etaMinutes} ${t("min")}` : ""}` : t("noDriverNearby")}</small></div>
          <span class="price">${euro(q.fareCents).replace(/,00/, "")}</span>
        </div>`).join("")}
      <p class="muted">${t("priceGuaranteed")}</p>
      <label>${t("payment")}</label>
      <div class="seg" id="paySeg"><button data-p="ON_BOARD" class="${form.pay === "ON_BOARD" ? "on" : ""}">${t("onBoard")}</button><button data-p="CARD" class="${form.pay === "CARD" ? "on" : ""}">${t("card")}</button></div>
      <p class="muted" id="payHint">${form.pay === "CARD" ? t("cardHint") : t("onBoardHint")}</p>
      <button class="btn" id="bookBtn"></button>
    </div>`;
  const setBtn = () => { const q = form.quotes.find((x) => x.vehicle === form.vehicle); $("#bookBtn").textContent = q ? `${t("bookFor")} ${euro(q.fareCents)}` : t("book"); $("#bookBtn").disabled = !q; };
  setBtn();
  box.querySelectorAll(".vehicle").forEach((el) => el.onclick = () => { form.vehicle = el.dataset.v; box.querySelectorAll(".vehicle").forEach((x) => x.classList.toggle("on", x === el)); setBtn(); });
  $("#paySeg").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    form.pay = b.dataset.p;
    $("#paySeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("#payHint").textContent = form.pay === "CARD" ? t("cardHint") : t("onBoardHint");
  };
  $("#bookBtn").onclick = (e) => busy(e.target, async () => {
    const q = form.quotes.find((x) => x.vehicle === form.vehicle);
    const scheduled = form.when === "later" && form.at ? new Date(form.at).toISOString() : null;
    const b = await rpc("create_booking_web", { p_quote_id: q.quoteId, p_payment_method: form.pay, p_scheduled_at: scheduled, p_passengers: form.passengers, p_notes: form.notes || null });
    form.quotes = null;
    if (form.pay === "CARD") await payByCard(b);
    else track(b.id);
  });
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------------------------ paiement par carte (Stripe)
function loadStripe() {
  if (window.Stripe) return Promise.resolve();
  return new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://js.stripe.com/v3/"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
}
async function payByCard(booking) {
  let data;
  try {
    data = await call("payments-create-intent", { bookingId: booking.id });
    await loadStripe();
  } catch (e) {
    await call("booking-cancel", { bookingId: booking.id, action: "cancel", reason: "CARD_UNAVAILABLE" }).catch(() => {});
    form.pay = "ON_BOARD";
    toast(t("cardUnavailable"), true);
    return home();
  }
  const stripe = window.Stripe(data.publishableKey);
  const elements = stripe.elements({ clientSecret: data.paymentIntentClientSecret, appearance: { theme: "night", variables: { colorPrimary: "#1f7aff", colorBackground: "#0a1328" } }, locale: document.documentElement.lang });
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `<div><h2 style="margin-top:0">${t("payment")} · ${euro(data.amountCents)}</h2><p class="muted">${t("cardHint")}</p>
    <div id="payEl"></div><button class="btn" id="payBtn">${t("payNow")}</button><button class="btn secondary" id="payCancel">${t("cancel")}</button></div>`;
  document.body.appendChild(modal);
  elements.create("payment").mount("#payEl");
  modal.querySelector("#payCancel").onclick = (e) => busy(e.target, async () => { await call("booking-cancel", { bookingId: booking.id, action: "cancel" }); modal.remove(); home(); });
  modal.querySelector("#payBtn").onclick = (e) => busy(e.target, async () => {
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: location.href } });
    if (error) throw new Error(error.message);
    modal.remove(); track(booking.id);
  });
}

// ------------------------------------------------------------------ suivi de course (style « Course en cours »)
async function track(id) {
  cleanup();
  tabbar.classList.add("hidden"); document.body.classList.remove("has-tabbar");
  overlay.innerHTML = `<div class="nav-screen">
    <div class="map-full"><div class="mapbox" id="tMap"></div>
      <div class="nav-top"><div class="ttl" style="padding-left:4px">${t("myRide")}</div></div></div>
    <div class="nav-panel"><div class="inner" id="tPanel"><div class="center"><span class="spinner"></span></div></div></div></div>`;
  const map = makeMap($("#tMap"));
  let layer = null, pMark = null, dMark = null, carMark = null, lastKey = "", fitted = false, fitPts = null;

  const draw = async () => {
    const { data: b } = await sb.from("bookings").select("*").eq("id", id).single();
    if (!b) return home();
    if (b.status === "COMPLETED") { cleanup(); return showDone(b); }
    if (!ACTIVE.includes(b.status)) { cleanup(); toast(t("s_" + b.status)); return home(); }
    let driver = null, vehicle = null, loc = null, rating = null;
    if (b.driver_user_id) {
      const [p, v, l, d] = await Promise.all([
        sb.from("profiles").select("display_name, phone").eq("id", b.driver_user_id).maybeSingle(),
        b.vehicle_id ? sb.from("vehicles").select("*").eq("id", b.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
        sb.from("driver_locations").select("*").eq("driver_user_id", b.driver_user_id).maybeSingle(),
        sb.from("drivers").select("rating").eq("user_id", b.driver_user_id).maybeSingle(),
      ]);
      driver = p.data; vehicle = v.data; loc = l.data; rating = d.data?.rating;
    }
    const pick = { lat: b.pickup_lat, lng: b.pickup_lng }, dest = { lat: b.destination_lat, lng: b.destination_lng };
    let eta = null;
    if (map) {
      if (!pMark && pick.lat != null) pMark = L.marker([pick.lat, pick.lng], { icon: pinIcon(true) }).addTo(map);
      if (!dMark && dest.lat != null) { dMark = L.marker([dest.lat, dest.lng], { icon: pinIcon() }).addTo(map); L.marker([dest.lat, dest.lng], { icon: labelIcon(short(b.destination_label)) }).addTo(map); }
      if (loc) { if (!carMark) carMark = L.marker([loc.lat, loc.lng], { icon: meIcon(), zIndexOffset: 1000 }).addTo(map); else carMark.setLatLng([loc.lat, loc.lng]); }
      const from = loc && b.status !== "IN_PROGRESS" ? { lat: loc.lat, lng: loc.lng } : (loc && b.status === "IN_PROGRESS" ? { lat: loc.lat, lng: loc.lng } : pick);
      const to = b.status === "IN_PROGRESS" || !loc ? dest : pick;
      const key = `${b.status}|${from.lat?.toFixed(3)},${from.lng?.toFixed(3)}`;
      if (key !== lastKey && from.lat != null && to.lat != null) {
        lastKey = key;
        const r = await getRoute(from, to);
        layer?.remove(); layer = routeLayer(map, r.coords);
        if (loc) eta = Math.max(1, Math.round(r.duration / 60));
        if (!fitted) { fitPts = [...r.coords]; if (loc) fitPts.push([loc.lat, loc.lng]); fitted = true; }
      }
    }
    const waitingCard = b.payment_method === "CARD" && b.payment_status === "PENDING";
    const headline = b.status === "REQUESTED" ? (waitingCard ? t("awaitingPayment") : t("s_REQUESTED"))
      : b.status === "IN_PROGRESS" ? w("onTheWay") : w("driverComing");
    $("#tPanel").innerHTML = `
      <div class="eta"><div class="grow"><strong>${esc(headline)}</strong>
        <span class="muted">${eta ? `${w("arrivalIn")} ${eta} min · ` : ""}${b.scheduled_at ? fmtDate(b.scheduled_at) + " · " : ""}${euro(b.quoted_fare_cents)}</span></div>
        ${b.status === "REQUESTED" ? "" : `<span style="flex:0">${statusBadge(b.status)}</span>`}</div>
      ${b.status === "REQUESTED" ? `<p class="pulse muted">${waitingCard ? "" : t("searching")}</p>` : ""}
      ${driver ? `<div class="person"><div class="avatar">${esc(initials(driver.display_name))}</div>
        <div class="grow"><small>${w("driver")}</small><strong>${esc(driver.display_name)}</strong>${rating ? `<small class="stars-s">★ ${rating}</small>` : ""}</div>
        ${driver.phone ? `<a class="round" href="tel:${esc(driver.phone)}" aria-label="${t("call")}">${icon("phone")}</a><a class="round" href="sms:${esc(driver.phone)}" aria-label="SMS">${icon("msg")}</a>` : ""}</div>
        ${vehicle ? `<div class="person"><div class="avatar" style="background:var(--card2);border:1px solid var(--line)">${icon("car")}</div>
          <div class="grow"><small>${t("vehicle")}</small><strong>${esc([vehicle.make, vehicle.model].filter(Boolean).join(" "))}</strong><small>${esc(vehicle.color || "")}</small></div>
          <span class="badge" style="font-size:14px">${esc(vehicle.registration_number)}</span></div>` : ""}` : ""}
      <div class="person"><div class="avatar" style="background:var(--card2);border:1px solid var(--line)">${icon("flag")}</div>
        <div class="grow"><small>${w("destination")}</small><strong>${esc(short(b.destination_label))}</strong><small>${esc(b.destination_label.split(",").slice(1).join(",").trim())}</small></div></div>
      <div class="kv"><span>${t("payment")}</span><span>${b.payment_method === "CARD" ? t("card") : t("onBoard")} · ${esc(t("p_" + b.payment_status))}</span></div>
      ${b.status !== "IN_PROGRESS" ? `<button class="btn danger" id="cancelBtn">${t("cancelRide")}</button>` : ""}`;
    if (fitPts && map) { map.invalidateSize(); map.fitBounds(fitPts, { paddingTopLeft: [50, 70], paddingBottomRight: [50, 40] }); fitPts = null; }
    const cb = $("#cancelBtn");
    if (cb) cb.onclick = (e) => {
      const msg = t("cancelConfirm") + (b.status === "DRIVER_ARRIVING" ? "\n" + t("feeWarning") : "");
      if (!confirm(msg)) return;
      busy(e.target, async () => { await call("booking-cancel", { bookingId: b.id, action: "cancel" }); cleanup(); home(); });
    };
  };
  await draw();
  channel = sb.channel("ride-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `id=eq.${id}` }, draw)
    .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, draw)
    .subscribe();
  pollTimer = setInterval(draw, 15000);
}

// ------------------------------------------------------------------ course terminée + note
async function showDone(b) {
  tabbar.classList.add("hidden");
  let driver = null;
  if (b.driver_user_id) ({ data: driver } = await sb.from("profiles").select("display_name").eq("id", b.driver_user_id).maybeSingle());
  const fare = b.final_fare_cents ?? b.quoted_fare_cents;
  overlay.innerHTML = `<div class="sheet"><div class="inner">
    <div class="done"><div class="check">${icon("check")}</div><h1 style="margin:0">${w("done")}</h1>
      <div class="amount">${euro(fare).replace(/,00/, "")}</div><div class="muted">${b.payment_method === "CARD" ? w("paidCard") : w("paidBoard")}</div></div>
    <div class="card"><div class="route"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div></div>
    ${driver ? `<div class="card center"><div class="person" style="border:0;padding:0 0 10px;justify-content:center;text-align:left"><div class="avatar">${esc(initials(driver.display_name))}</div>
      <div><small class="muted">${w("driver")}</small><br><strong>${esc(driver.display_name)}</strong></div></div>
      ${b.driver_rating ? `<div class="stars-s" style="font-size:26px">${"★".repeat(b.driver_rating)}</div>` : `<div class="muted">${w("rate")}</div><div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}">★</button>`).join("")}</div>`}</div>` : ""}
    <button class="btn" id="dNew">${w("newRide")}</button></div></div>`;
  $("#dNew").onclick = () => { sessionStorage.setItem("rated-" + b.id, "1"); view = "home"; home(); };
  const stars = $("#stars");
  if (stars) stars.querySelectorAll("button").forEach((btn) => {
    btn.onmouseenter = () => stars.querySelectorAll("button").forEach((x) => x.classList.toggle("on", +x.dataset.n <= +btn.dataset.n));
    btn.onclick = () => busy(btn, async () => {
      await rpc("rate_driver", { p_booking_id: b.id, p_rating: +btn.dataset.n });
      stars.querySelectorAll("button").forEach((x) => x.classList.toggle("on", +x.dataset.n <= +btn.dataset.n));
      stars.querySelectorAll("button").forEach((x) => x.disabled = true);
      toast(t("thanks"));
    });
  });
}

// ------------------------------------------------------------------ mes courses, profil
function ridesView(list) {
  app.innerHTML = `<h1>${w("myRides")}</h1><div class="card" style="padding:4px 16px">${list.length ? list.map((b) => `<div class="list-row" style="cursor:default"><div class="vic">${icon("car")}</div>
    <div class="body"><div>${esc(short(b.pickup_label))} → ${esc(short(b.destination_label))}</div><small>${fmtDate(b.scheduled_at || b.created_at)} · ${esc(t("s_" + b.status))} · ${b.payment_method === "CARD" ? t("card") : t("onBoard")}</small></div>
    <div class="end">${euro(b.final_fare_cents ?? b.quoted_fare_cents).replace(/,00/, "")}</div></div>`).join("") : `<p class="list-empty">${t("noHistory")}</p>`}</div>`;
}

function profileView() {
  app.innerHTML = `<div class="profile-head"><div class="avatar lg" style="margin:0 auto">${esc(initials(me.display_name))}</div><h2>${esc(me.display_name)}</h2><div class="muted">${esc(me.email || "")}</div></div>
    <div class="section-title">${w("info")}</div>
    <form class="card" id="meForm"><label>${t("name")}</label><input name="display_name" required value="${esc(me.display_name)}">
      <label>${t("phone")}</label><input name="phone" type="tel" value="${esc(me.phone)}"><button class="btn secondary" type="submit">${t("save")}</button></form>
    <div class="card settings" style="padding:4px 16px">
      <div class="list-row" id="pLang"><div class="vic">${icon("globe")}</div><div class="body">${w("language")}</div><span class="end">${lang === "fr" ? "Français" : "English"}</span><span class="chev">${icon("chevR")}</span></div>
      <div class="list-row" id="pOut"><div class="vic">${icon("logout")}</div><div class="body logout">${w("logout")}</div></div></div>`;
  $("#pLang").onclick = () => { toggleLang(); location.reload(); };
  $("#pOut").onclick = async () => { cleanup(); await sb.auth.signOut(); view = "home"; start(); };
  $("#meForm").onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const f = Object.fromEntries(new FormData(e.target));
    const { error } = await sb.from("profiles").update({ display_name: f.display_name.trim(), phone: f.phone.trim() || null }).eq("id", me.id);
    if (error) throw error;
    me.display_name = f.display_name.trim(); me.phone = f.phone.trim(); toast(t("saved")); profileView();
  }); };
}

start().catch(async (e) => { hideSplash(); app.innerHTML = `<div class="card">${esc(await errText(e))}</div>`; });
