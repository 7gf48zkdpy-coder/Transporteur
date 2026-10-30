// Transporteur VTC — appli client
import { sb, isRecovery, t, $, esc, euro, fmtDate, toast, busy, call, rpc, errText, statusBadge, addressField, reverseGeocode,
  makeMap, dot, carIcon, currentProfile, renderAuth, header, VEHICLE_ICON } from "./core.js";

const app = $("#app");
const ACTIVE = ["REQUESTED", "ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"];
let recoveryDone = false;
let me = null, channel = null, pollTimer = null;
const form = { pickup: null, destination: null, when: "now", at: "", passengers: 1, notes: "", quotes: null, vehicle: null, pay: "ON_BOARD", info: null };

function cleanup() {
  if (channel) { sb.removeChannel(channel); channel = null; }
  clearInterval(pollTimer); pollTimer = null;
}

async function start() {
  cleanup();
  me = await currentProfile();
  header($("#top"), t("tagline"), me ? async () => { cleanup(); await sb.auth.signOut(); start(); } : null);
  if (!me) return renderAuth(app, "client", start);
  if (isRecovery && !recoveryDone && (recoveryDone = true)) return renderAuth(app, "client", start, "newpw");
  if (!me.role) { app.innerHTML = `<div class="card">${esc(t("checkEmail"))}</div>`; return; }
  home();
}

async function home() {
  cleanup();
  const { data: mine } = await sb.from("bookings").select("*").eq("client_user_id", me.id).order("created_at", { ascending: false }).limit(20);
  const list = mine || [];
  const active = list.find((b) => ACTIVE.includes(b.status) && !(b.payment_method === "CARD" && b.payment_status === "PENDING" && Date.now() - new Date(b.created_at) > 30 * 60e3));
  if (active) return track(active.id);
  bookingForm(list);
}

// ------------------------------------------------------------------ réservation
function bookingForm(history) {
  const toRate = history.find((b) => b.status === "COMPLETED" && !b.driver_rating && Date.now() - new Date(b.completed_at) < 24 * 3600e3);
  app.innerHTML = `
    ${toRate ? rateCard(toRate) : ""}
    <h1>${t("tagline")}</h1>
    <div class="card">
      <label>${t("pickup")}</label>
      <div><input id="pickup" placeholder="Gare de Lyon, 12 rue…" autocomplete="off" value="${esc(form.pickup?.label || "")}"></div>
      <button class="link" id="locBtn" style="margin-top:8px">📍 ${t("myPosition")}</button>
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
    <h2>${t("history")}</h2>
    <div id="hist">${history.length ? history.map(histRow).join("") : `<p class="list-empty">${t("noHistory")}</p>`}</div>`;

  if (toRate) bindRate(toRate);
  const pickupIn = $("#pickup"), destIn = $("#dest");
  addressField(pickupIn, (p) => { form.pickup = p; form.quotes = null; $("#quotes").innerHTML = ""; });
  addressField(destIn, (p) => { form.destination = p; form.quotes = null; $("#quotes").innerHTML = ""; }, () => form.pickup);
  $("#locBtn").onclick = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const place = (await reverseGeocode(lat, lng).catch(() => null)) || { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
      form.pickup = { ...place, lat, lng };
      pickupIn.value = form.pickup.label;
    }, () => toast("📍 ?", true), { enableHighAccuracy: true, timeout: 10000 });
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
      <p class="muted">${(info.distanceMeters / 1000).toFixed(1)} ${t("km")} · ~${Math.round(info.durationSeconds / 60)} ${t("min")}${info.routeEstimated ? ` · ${t("estimated")}` : ""}</p>
      ${form.quotes.map((q) => `
        <div class="vehicle ${q.vehicle === form.vehicle ? "on" : ""}" data-v="${q.vehicle}">
          <span class="ico">${VEHICLE_ICON[q.vehicle] || "🚘"}</span>
          <div class="name">${esc(t("v_" + q.vehicle))}<br><small class="muted">${q.cat ? `👤 ${q.cat.max_passengers} · 🧳 ${q.cat.max_bags}` : ""}${q.pricingMode === "FIXED" ? ` · ${t("fixed")}` : ""}
            <br>${q.driversNearby ? `${q.driversNearby} ${t("driversNearby")}${q.etaMinutes ? ` · ${q.etaMinutes} ${t("min")}` : ""}` : t("noDriverNearby")}</small></div>
          <span class="price">${euro(q.fareCents)}</span>
        </div>`).join("")}
      <p class="muted">${t("priceGuaranteed")}</p>
      <label>${t("payment")}</label>
      <div class="seg" id="paySeg"><button data-p="ON_BOARD" class="${form.pay === "ON_BOARD" ? "on" : ""}">💶 ${t("onBoard")}</button><button data-p="CARD" class="${form.pay === "CARD" ? "on" : ""}">💳 ${t("card")}</button></div>
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
    // Stripe pas encore configuré : on annule la réservation et on repasse en paiement à bord.
    await call("booking-cancel", { bookingId: booking.id, action: "cancel", reason: "CARD_UNAVAILABLE" }).catch(() => {});
    form.pay = "ON_BOARD";
    toast(t("cardUnavailable"), true);
    return home();
  }
  const stripe = window.Stripe(data.publishableKey);
  const elements = stripe.elements({ clientSecret: data.paymentIntentClientSecret, appearance: { theme: "night" }, locale: document.documentElement.lang });
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `<div><h2 style="margin-top:0">${t("payment")} · ${euro(data.amountCents)}</h2><p class="muted">${t("cardHint")}</p>
    <div id="payEl"></div><button class="btn" id="payBtn">${t("payNow")}</button><button class="btn secondary" id="payCancel">${t("cancel")}</button></div>`;
  document.body.appendChild(modal);
  elements.create("payment").mount("#payEl");
  modal.querySelector("#payCancel").onclick = (e) => busy(e.target, async () => {
    await call("booking-cancel", { bookingId: booking.id, action: "cancel" });
    modal.remove(); home();
  });
  modal.querySelector("#payBtn").onclick = (e) => busy(e.target, async () => {
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: location.href } });
    if (error) throw new Error(error.message);
    modal.remove(); track(booking.id);
  });
}

// ------------------------------------------------------------------ suivi de course
async function track(id) {
  cleanup();
  app.innerHTML = `<h1>${t("myRide")}</h1><div id="map" class="map"></div><div id="ride"></div>`;
  const map = makeMap($("#map"));
  let markers = {}, driverMarker = null, fitted = false;

  const draw = async () => {
    const { data: b } = await sb.from("bookings").select("*").eq("id", id).single();
    if (!b) return home();
    if (!ACTIVE.includes(b.status)) { cleanup(); if (b.status === "COMPLETED") toast(t("s_COMPLETED")); return home(); }
    let driver = null, vehicle = null, loc = null;
    if (b.driver_user_id) {
      [{ data: driver }, { data: vehicle }, { data: loc }] = await Promise.all([
        sb.from("profiles").select("display_name, phone").eq("id", b.driver_user_id).maybeSingle(),
        b.vehicle_id ? sb.from("vehicles").select("*").eq("id", b.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
        sb.from("driver_locations").select("*").eq("driver_user_id", b.driver_user_id).maybeSingle(),
      ]);
    }
    const waitingCard = b.payment_method === "CARD" && b.payment_status === "PENDING";
    $("#ride").innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between"><div>${statusBadge(b.status)}</div><div class="big" style="flex:0">${euro(b.quoted_fare_cents)}</div></div>
        ${b.status === "REQUESTED" ? `<p class="pulse muted">${waitingCard ? t("awaitingPayment") : t("searching")}</p>` : ""}
        <div class="route" style="margin-top:10px"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div>
        ${b.scheduled_at ? `<div class="kv"><span>${t("scheduledFor")}</span><span>${fmtDate(b.scheduled_at)}</span></div>` : ""}
        <div class="kv"><span>${t("vehicle")}</span><span>${VEHICLE_ICON[b.vehicle_type] || ""} ${esc(t("v_" + b.vehicle_type))}</span></div>
        <div class="kv"><span>${t("payment")}</span><span>${b.payment_method === "CARD" ? "💳 " + t("card") : "💶 " + t("onBoard")} · ${esc(t("p_" + b.payment_status))}</span></div>
      </div>
      ${driver ? `<div class="card">
        <div class="kv"><span>${t("driver")}</span><strong>${esc(driver.display_name)}</strong></div>
        ${vehicle ? `<div class="kv"><span>${t("vehicle")}</span><span>${esc([vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(" "))}</span></div>
        <div class="kv"><span>${t("plate")}</span><strong>${esc(vehicle.registration_number)}</strong></div>` : ""}
        ${driver.phone ? `<a class="btn secondary" href="tel:${esc(driver.phone)}">📞 ${t("call")}</a>` : ""}
      </div>` : ""}
      ${b.status !== "IN_PROGRESS" ? `<button class="btn danger" id="cancelBtn">${t("cancelRide")}</button>` : ""}`;
    const cb = $("#cancelBtn");
    if (cb) cb.onclick = (e) => {
      const msg = t("cancelConfirm") + (b.status === "DRIVER_ARRIVING" ? "\n" + t("feeWarning") : "");
      if (!confirm(msg)) return;
      busy(e.target, async () => { await call("booking-cancel", { bookingId: b.id, action: "cancel" }); cleanup(); home(); });
    };

    if (map) {
      const pts = [[b.pickup_lat, b.pickup_lng], [b.destination_lat, b.destination_lng]].filter((p) => p[0] != null);
      if (!markers.p && pts[0]) markers.p = L.marker(pts[0], { icon: dot("#4fd1a1") }).addTo(map);
      if (!markers.d && pts[1]) { markers.d = L.marker(pts[1], { icon: dot("#f2777a") }).addTo(map); L.polyline(pts, { color: "#9db4ea", weight: 3, dashArray: "6 8" }).addTo(map); }
      if (loc) {
        if (!driverMarker) driverMarker = L.marker([loc.lat, loc.lng], { icon: carIcon() }).addTo(map);
        else driverMarker.setLatLng([loc.lat, loc.lng]);
      }
      if (!fitted && pts.length) { map.fitBounds(L.latLngBounds(loc ? [...pts, [loc.lat, loc.lng]] : pts), { padding: [30, 30] }); fitted = true; }
    }
  };
  await draw();
  channel = sb.channel("ride-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `id=eq.${id}` }, draw)
    .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, draw)
    .subscribe();
  pollTimer = setInterval(draw, 15000);
}

// ------------------------------------------------------------------ historique et note
function histRow(b) {
  return `<div class="card" style="padding:12px 14px">
    <div class="row" style="justify-content:space-between"><small class="muted">${fmtDate(b.scheduled_at || b.created_at)}</small><span style="flex:0;white-space:nowrap">${statusBadge(b.status)}</span></div>
    <div class="route"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div>
    <div class="kv"><span>${esc(t("v_" + b.vehicle_type))} · ${b.payment_method === "CARD" ? t("card") : t("onBoard")}</span><strong>${euro(b.final_fare_cents ?? b.quoted_fare_cents)}</strong></div>
  </div>`;
}

function rateCard(b) {
  return `<div class="card center" id="rateCard"><h2 style="margin-top:0">${t("rate")}</h2>
    <p class="muted">${esc(b.pickup_label)} → ${esc(b.destination_label)}</p>
    <div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}">★</button>`).join("")}</div></div>`;
}
function bindRate(b) {
  const card = $("#rateCard");
  card.querySelectorAll(".stars button").forEach((btn) => {
    btn.onmouseenter = () => card.querySelectorAll(".stars button").forEach((x) => x.classList.toggle("on", +x.dataset.n <= +btn.dataset.n));
    btn.onclick = () => busy(btn, async () => { await rpc("rate_driver", { p_booking_id: b.id, p_rating: +btn.dataset.n }); card.innerHTML = `<p class="big">${t("thanks")}</p>`; });
  });
}

sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { me = null; } });
start().catch(async (e) => { app.innerHTML = `<div class="card">${esc(await errText(e))}</div>`; });
