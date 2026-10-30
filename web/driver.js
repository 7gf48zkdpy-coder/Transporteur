// Transporteur VTC — espace chauffeur (et administration pour le compte ADMIN)
import { sb, isRecovery, t, $, esc, euro, fmtDate, toast, busy, call, rpc, errText, statusBadge,
  currentProfile, renderAuth, header, VEHICLE_ICON } from "./core.js";

const app = $("#app");
const DOC_TYPES = ["CARTE_VTC", "PERMIS_B", "PIECE_IDENTITE", "ASSURANCE_RC_CIRCULATION", "ASSURANCE_RC_PRO", "CARTE_GRISE", "REGISTRE_EVTC", "KBIS_OU_SIRENE"];
const VEHICLES = ["BERLINE", "ELECTRIC", "VAN"];
const RUNNING = ["ACCEPTED", "DRIVER_ARRIVING", "IN_PROGRESS"];
let geoWarned = false;
let me = null, driver = null, tab = "rides", channel = null, geoWatch = null, lastSent = 0, redrawTimer = null, recoveryDone = false;

async function start() {
  me = await currentProfile();
  header($("#top"), t("driverSpace"), me ? async () => { stopGeo(); if (channel) sb.removeChannel(channel); await sb.auth.signOut(); start(); } : null);
  if (!me) return renderAuth(app, "driver", start);
  if (isRecovery && !recoveryDone && (recoveryDone = true)) return renderAuth(app, "driver", start, "newpw");
  if (me.role !== "DRIVER" && me.role !== "ADMIN") { app.innerHTML = `<div class="card">${esc(t("notDriver"))}</div>`; return; }
  if (me.role === "ADMIN") tab = "admin";
  subscribe();
  render();
}

function subscribe() {
  if (channel) return;
  channel = sb.channel("driver")
    .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => { if (tab === "rides" || tab === "admin") scheduleRedraw(); })
    .subscribe();
  setInterval(() => { if (tab === "rides") scheduleRedraw(); }, 20000);
}
function scheduleRedraw() { clearTimeout(redrawTimer); redrawTimer = setTimeout(render, 300); }

async function loadDriver() {
  const { data } = await sb.from("drivers").select("*").eq("user_id", me.id).maybeSingle();
  driver = data;
  return data;
}

async function render() {
  await loadDriver();
  const tabs = [...(driver ? ["rides", "profile", "earnings"] : []), ...(me.role === "ADMIN" ? ["admin"] : [])];
  if (!tabs.includes(tab)) tab = tabs[0];
  app.innerHTML = `<div class="tabs">${tabs.map((k) => `<button class="chip ${k === tab ? "on" : ""}" data-t="${k}">${t(k)}</button>`).join("")}</div><div id="pane"></div>`;
  app.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
  const pane = $("#pane");
  try {
    if (tab === "rides") await ridesTab(pane);
    if (tab === "profile") await profileTab(pane);
    if (tab === "earnings") await earningsTab(pane);
    if (tab === "admin") await adminTab(pane);
  } catch (e) { pane.innerHTML = `<div class="card">${esc(await errText(e))}</div>`; }
}

// ------------------------------------------------------------------ courses
function partnerBadge(s) {
  const cls = { VALIDATED: "ok", SUSPENDED: "bad", REJECTED: "bad" }[s] || "warn";
  return `<span class="badge ${cls}">${esc(t("partner_" + s))}</span>`;
}

async function ridesTab(pane) {
  if (driver.partner_status !== "VALIDATED") {
    const [{ data: veh }, { data: docs }] = await Promise.all([
      sb.from("vehicles").select("id").eq("driver_user_id", me.id).limit(1),
      sb.from("driver_documents").select("document_type").eq("driver_user_id", me.id),
    ]);
    const sent = new Set((docs || []).map((d) => d.document_type));
    const step = (ok, label) => `<div class="kv"><span>${ok ? "✅" : "⬜️"} ${label}</span></div>`;
    pane.innerHTML = `<div class="card"><div>${partnerBadge(driver.partner_status)}</div>
      <h2>${esc(me.display_name)}</h2>
      ${step(veh?.length, t("stepVehicle"))}${step(sent.size >= DOC_TYPES.length, `${t("stepDocs")} (${sent.size}/${DOC_TYPES.length})`)}${step(false, t("stepReview"))}
      <button class="btn" id="goProfile">${t("profile")} →</button></div>`;
    $("#goProfile").onclick = () => { tab = "profile"; render(); };
    return;
  }

  const [{ data: mine }, { data: feed }] = await Promise.all([
    sb.from("bookings").select("*").eq("driver_user_id", me.id).in("status", RUNNING).order("scheduled_at", { ascending: true, nullsFirst: true }),
    driver.is_available ? sb.from("bookings").select("*").eq("status", "REQUESTED").is("driver_user_id", null).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
  ]);
  const active = (mine || [])[0];
  const clients = {};
  for (const b of mine || []) {
    const { data } = await sb.from("profiles").select("display_name, phone").eq("id", b.client_user_id).maybeSingle();
    clients[b.id] = data;
  }

  pane.innerHTML = `
    <div class="card switch"><div><strong>${driver.is_available ? "🟢 " + t("available") : "⚪️ " + t("unavailable")}</strong>
      <div class="muted">${driver.is_available ? "" : t("becomeAvailable")}</div></div>
      <input type="checkbox" id="avail" ${driver.is_available ? "checked" : ""} aria-label="${t("available")}"></div>
    ${active ? `<h2>${t("activeRide")}</h2>${rideCard(active, clients[active.id], true)}` : ""}
    ${(mine || []).slice(1).map((b) => rideCard(b, clients[b.id], true)).join("")}
    ${driver.is_available ? `<h2>${t("waitingRides")}</h2>${(feed || []).length ? feed.map((b) => rideCard(b, null, false)).join("") : `<p class="list-empty">${t("noRides")}</p>`}` : ""}`;

  $("#avail").onchange = (e) => busy(e.target, async () => {
    const want = e.target.checked;
    const { error } = await sb.from("drivers").update({ is_available: want }).eq("user_id", me.id);
    if (error) { e.target.checked = !want; throw error; }
    want ? startGeo() : stopGeo();
    render();
  });
  if (driver.is_available || active) startGeo();

  pane.querySelectorAll("[data-act]").forEach((btn) => btn.onclick = () => busy(btn, async () => {
    const id = btn.dataset.id, act = btn.dataset.act, pm = btn.dataset.pm;
    if (act === "accept") await rpc("accept_booking", { p_booking_id: id });
    if (act === "arriving") await rpc("advance_booking", { p_booking_id: id, p_status: "DRIVER_ARRIVING" });
    if (act === "start") await rpc("advance_booking", { p_booking_id: id, p_status: "IN_PROGRESS" });
    if (act === "finish") {
      if (pm === "ON_BOARD") await rpc("complete_onboard_booking", { p_booking_id: id });
      else await call("ride-complete", { bookingId: id });
      toast(t("s_COMPLETED"));
    }
    if (act === "release") { if (!confirm(t("release") + " ?")) return; await call("booking-cancel", { bookingId: id, action: "release" }); }
    if (act === "noshow") { if (!confirm(t("noShow") + " ?")) return; await call("booking-cancel", { bookingId: id, action: "no_show" }); }
    render();
  }));
}

function rideCard(b, client, mine) {
  const nav = (lat, lng, label) => lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
  const target = b.status === "IN_PROGRESS" ? [b.destination_lat, b.destination_lng, b.destination_label] : [b.pickup_lat, b.pickup_lng, b.pickup_label];
  const next = { ACCEPTED: ["arriving", t("onMyWay")], DRIVER_ARRIVING: ["start", t("clientOnBoard")], IN_PROGRESS: ["finish", t("finish")] }[b.status];
  return `<div class="card">
    <div class="row" style="justify-content:space-between"><div>${mine ? statusBadge(b.status) : `<span class="badge warn">${t("newRequest")}</span>`}</div>
      <div style="flex:0;text-align:right;white-space:nowrap"><div class="big" style="font-size:22px">${euro(b.quoted_fare_cents)}</div><small class="muted">${t("youEarn")} ${euro(b.driver_earnings_cents)}</small></div></div>
    <div class="route" style="margin-top:8px"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div>
    <div class="kv"><span>${b.scheduled_at ? "🗓 " + fmtDate(b.scheduled_at) : "⚡ " + t("now")}</span><span>${VEHICLE_ICON[b.vehicle_type] || ""} ${esc(t("v_" + b.vehicle_type))} · 👤 ${b.passengers}</span></div>
    <div class="kv"><span>${t("payment")}</span><span>${b.payment_method === "ON_BOARD" ? `💶 ${t("onBoard")} — ${t("collect")} ${euro(b.quoted_fare_cents)}` : "💳 " + t("card")}</span></div>
    ${b.distance_meters ? `<div class="kv"><span>${(b.distance_meters / 1000).toFixed(1)} ${t("km")}</span><span>~${Math.round((b.duration_seconds || 0) / 60)} ${t("min")}</span></div>` : ""}
    ${b.notes ? `<p class="muted">📝 ${esc(b.notes)}</p>` : ""}
    ${mine && client ? `<div class="kv"><span>${t("client")}</span><strong>${esc(client.display_name)}</strong></div>
      ${client.phone ? `<a class="btn secondary" href="tel:${esc(client.phone)}">📞 ${t("call")} ${esc(client.phone)}</a>` : ""}` : ""}
    ${mine ? `<a class="btn secondary" target="_blank" rel="noopener" href="${nav(...target)}">🧭 ${t("navigate")}</a>
      ${next ? `<button class="btn" data-act="${next[0]}" data-id="${b.id}" data-pm="${b.payment_method}">${next[1]}</button>` : ""}
      ${b.status === "DRIVER_ARRIVING" ? `<button class="btn danger" data-act="noshow" data-id="${b.id}">${t("noShow")}</button>` : ""}
      ${["ACCEPTED", "DRIVER_ARRIVING"].includes(b.status) ? `<button class="btn danger" data-act="release" data-id="${b.id}">${t("release")}</button>` : ""}`
    : `<button class="btn" data-act="accept" data-id="${b.id}">${t("accept")}</button>`}
  </div>`;
}

// Position du chauffeur (visible par le client pendant la course)
function startGeo() {
  if (geoWatch != null || !navigator.geolocation) return;
  geoWatch = navigator.geolocation.watchPosition(async (pos) => {
    if (Date.now() - lastSent < 10000) return;
    lastSent = Date.now();
    const c = pos.coords;
    await sb.from("driver_locations").upsert({ driver_user_id: me.id, lat: c.latitude, lng: c.longitude,
      heading: Number.isFinite(c.heading) ? c.heading : null, speed_kmh: Number.isFinite(c.speed) ? c.speed * 3.6 : null }, { onConflict: "driver_user_id" });
  }, () => { if (!geoWarned) { geoWarned = true; toast(t("geoDenied"), true); } }, { enableHighAccuracy: true, maximumAge: 5000 });
}
function stopGeo() { if (geoWatch != null) navigator.geolocation.clearWatch(geoWatch); geoWatch = null; }

// ------------------------------------------------------------------ profil, véhicule, documents
async function profileTab(pane) {
  const [{ data: veh }, { data: docs }] = await Promise.all([
    sb.from("vehicles").select("*").eq("driver_user_id", me.id).order("created_at", { ascending: false }).limit(1),
    sb.from("driver_documents").select("*").eq("driver_user_id", me.id).order("uploaded_at", { ascending: false }),
  ]);
  const v = veh?.[0] || {};
  const last = {};
  for (const d of docs || []) if (!last[d.document_type]) last[d.document_type] = d;
  const docBadge = (d) => {
    const s = !d ? "MISSING" : (d.expires_at && new Date(d.expires_at) < new Date() ? "EXPIRED" : d.status);
    const cls = { APPROVED: "ok", REJECTED: "bad", EXPIRED: "bad", MISSING: "warn" }[s] || "";
    return `<span class="badge ${cls}">${t("d_" + s)}</span>`;
  };

  pane.innerHTML = `
    <div class="card"><div>${partnerBadge(driver.partner_status)}</div>
      <form id="meForm">
        <label>${t("name")}</label><input name="display_name" required value="${esc(me.display_name)}">
        <label>${t("phone")}</label><input name="phone" type="tel" value="${esc(me.phone)}">
        <label>${t("siret")}</label><input name="siret" inputmode="numeric" maxlength="14" value="${esc(driver.siret)}">
        <button class="btn" type="submit">${t("save")}</button>
      </form></div>

    <h2>${t("vehicle")}</h2>
    <form class="card" id="vehForm">
      <label>${t("vehicleType")}</label><select name="vehicle_type">${VEHICLES.map((k) => `<option value="${k}" ${v.vehicle_type === k ? "selected" : ""}>${VEHICLE_ICON[k]} ${t("v_" + k)}</option>`).join("")}</select>
      <div class="row"><div><label>${t("make")}</label><input name="make" required value="${esc(v.make)}"></div><div><label>${t("model")}</label><input name="model" required value="${esc(v.model)}"></div></div>
      <div class="row"><div><label>${t("color")}</label><input name="color" value="${esc(v.color)}"></div><div><label>${t("year")}</label><input name="year" type="number" min="2000" max="2030" value="${esc(v.year)}"></div></div>
      <div class="row"><div><label>${t("plate")}</label><input name="registration_number" required placeholder="AB-123-CD" value="${esc(v.registration_number)}"></div>
        <div><label>${t("capacity")}</label><input name="passenger_capacity" type="number" min="1" max="8" required value="${esc(v.passenger_capacity || 4)}"></div></div>
      <button class="btn" type="submit">${t("save")}</button>
    </form>

    <h2>${t("documents")}</h2>
    ${DOC_TYPES.map((k) => `<div class="card" style="padding:12px 14px">
      <div class="row" style="justify-content:space-between"><strong>${t("doc_" + k)}</strong><span style="flex:0;white-space:nowrap">${docBadge(last[k])}</span></div>
      ${last[k]?.rejection_reason ? `<p class="muted">⚠️ ${esc(last[k].rejection_reason)}</p>` : ""}
      ${last[k]?.expires_at ? `<p class="muted">${t("expires")} ${new Date(last[k].expires_at).toLocaleDateString()}</p>` : ""}
      <input type="file" style="margin-top:8px" accept="image/jpeg,image/png,image/heic,application/pdf" data-doc="${k}">
      <label>${t("expiryOpt")}</label><input type="date" data-exp="${k}">
      <button class="btn small secondary" style="margin-top:8px" data-up="${k}">${last[k] ? t("replace") : t("upload")}</button>
    </div>`).join("")}

    <h2>${t("cardPayouts")}</h2>
    <div class="card"><p class="muted">${driver.stripe_payouts_enabled ? "✅ " + t("cardPayoutsOn") : t("cardPayoutsOff")}</p>
      ${driver.stripe_payouts_enabled ? "" : `<button class="btn secondary" id="stripeBtn">${t("activateStripe")}</button>`}
      ${driver.stripe_account_id && !driver.stripe_payouts_enabled ? `<button class="btn secondary" id="stripeCheck">${t("checkStripe")}</button>` : ""}
    </div>`;

  $("#meForm").onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const f = Object.fromEntries(new FormData(e.target));
    let r = await sb.from("profiles").update({ display_name: f.display_name.trim(), phone: f.phone.trim() || null }).eq("id", me.id);
    if (r.error) throw r.error;
    r = await sb.from("drivers").update({ siret: f.siret.trim() || null }).eq("user_id", me.id);
    if (r.error) throw r.error;
    me.display_name = f.display_name.trim(); me.phone = f.phone.trim();
    toast(t("saved"));
  }); };

  $("#vehForm").onsubmit = (e) => { e.preventDefault(); busy(e.submitter, async () => {
    const f = Object.fromEntries(new FormData(e.target));
    const row = { driver_user_id: me.id, vehicle_type: f.vehicle_type, make: f.make.trim(), model: f.model.trim(), color: f.color.trim() || null,
      year: f.year ? +f.year : null, registration_number: f.registration_number.trim().toUpperCase(), passenger_capacity: +f.passenger_capacity };
    const r = v.id ? await sb.from("vehicles").update(row).eq("id", v.id) : await sb.from("vehicles").insert(row);
    if (r.error) throw r.error;
    toast(t("saved")); render();
  }); };

  pane.querySelectorAll("[data-up]").forEach((btn) => btn.onclick = () => busy(btn, async () => {
    const k = btn.dataset.up;
    const file = pane.querySelector(`[data-doc="${k}"]`).files[0];
    if (!file) throw new Error(t("upload") + " : " + t("doc_" + k));
    if (file.size > 10 * 1024 * 1024) throw new Error("10 Mo max.");
    const path = `${me.id}/${k}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_").slice(-60)}`;
    const up = await sb.storage.from("driver-documents").upload(path, file, { contentType: file.type || undefined });
    if (up.error) throw up.error;
    const exp = pane.querySelector(`[data-exp="${k}"]`).value || null;
    const r = await sb.from("driver_documents").insert({ driver_user_id: me.id, document_type: k, storage_key: path, expires_at: exp });
    if (r.error) throw r.error;
    toast(t("saved")); render();
  }));

  const sBtn = $("#stripeBtn");
  if (sBtn) sBtn.onclick = () => busy(sBtn, async () => { const { url } = await call("connect-onboarding", { action: "onboard" }); location.href = url; });
  const cBtn = $("#stripeCheck");
  if (cBtn) cBtn.onclick = () => busy(cBtn, async () => { await call("connect-onboarding", { action: "status" }); render(); });
}

// ------------------------------------------------------------------ gains
async function earningsTab(pane) {
  const { data } = await sb.from("bookings").select("*").eq("driver_user_id", me.id).eq("status", "COMPLETED").order("completed_at", { ascending: false }).limit(200);
  const rows = data || [];
  const sum = (f) => rows.reduce((s, b) => s + (f(b) || 0), 0);
  const total = sum((b) => b.driver_earnings_cents);
  const owed = sum((b) => (b.payment_method === "ON_BOARD" ? b.commission_cents : 0));
  pane.innerHTML = `
    <div class="card"><div class="kv"><span>${t("totalEarned")}</span><strong class="big" style="font-size:22px">${euro(total)}</strong></div>
      <div class="kv"><span>${t("ridesDone")}</span><strong>${rows.length}</strong></div>
      <div class="kv"><span>${t("commissionOwed")}</span><strong>${euro(owed)}</strong></div>
      ${driver.rating ? `<div class="kv"><span>★</span><strong>${driver.rating}</strong></div>` : ""}</div>
    ${rows.map((b) => `<div class="card" style="padding:12px 14px"><small class="muted">${fmtDate(b.completed_at)}</small>
      <div class="route"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div>
      <div class="kv"><span>${b.payment_method === "ON_BOARD" ? "💶 " + t("onBoard") : "💳 " + t("card")} · ${euro(b.final_fare_cents)}</span><strong>${euro(b.driver_earnings_cents)}</strong></div></div>`).join("")
    || `<p class="list-empty">${t("noHistory")}</p>`}`;
}

// ------------------------------------------------------------------ administration
let adminView = { driver: null };
async function adminTab(pane) {
  if (adminView.driver) return adminDriver(pane, adminView.driver);
  const [{ data: drivers }, { data: rides }] = await Promise.all([
    sb.from("drivers").select("*, profiles!drivers_user_id_fkey(display_name, email, phone)").order("created_at", { ascending: false }),
    sb.from("bookings").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  pane.innerHTML = `<h2>${t("drivers")}</h2>
    ${(drivers || []).map((d) => `<div class="card" style="padding:12px 14px"><div class="row" style="justify-content:space-between">
        <div><strong>${esc(d.profiles?.display_name)}</strong><br><small class="muted">${esc(d.profiles?.email)} · ${esc(d.profiles?.phone || "")}</small></div>
        <div style="flex:0;text-align:right">${partnerBadge(d.partner_status)}<br><button class="btn small secondary" style="margin-top:6px" data-d="${d.user_id}">${t("view")}</button></div></div></div>`).join("")
      || `<p class="list-empty">—</p>`}
    <h2>${t("allRides")}</h2>
    ${(rides || []).map((b) => `<div class="card" style="padding:12px 14px">
      <div class="row" style="justify-content:space-between"><small class="muted">${fmtDate(b.scheduled_at || b.created_at)}</small><span style="flex:0;white-space:nowrap">${statusBadge(b.status)}</span></div>
      <div class="route"><div>${esc(b.pickup_label)}</div><div>${esc(b.destination_label)}</div></div>
      <div class="kv"><span>${esc(t("v_" + b.vehicle_type))} · ${b.payment_method === "ON_BOARD" ? t("onBoard") : t("card")} · ${esc(t("p_" + b.payment_status))}</span><strong>${euro(b.final_fare_cents ?? b.quoted_fare_cents)}</strong></div>
      ${["REQUESTED", ...RUNNING].includes(b.status) ? `<button class="btn small danger" data-cancel="${b.id}">${t("cancelRide")}</button>` : ""}</div>`).join("")
      || `<p class="list-empty">${t("noHistory")}</p>`}`;
  pane.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { adminView.driver = b.dataset.d; render(); });
  pane.querySelectorAll("[data-cancel]").forEach((b) => b.onclick = () => { if (confirm(t("cancelConfirm"))) busy(b, async () => { await call("booking-cancel", { bookingId: b.dataset.cancel, action: "cancel" }); render(); }); });
}

async function adminDriver(pane, id) {
  const [{ data: d }, { data: veh }, { data: docs }] = await Promise.all([
    sb.from("drivers").select("*, profiles!drivers_user_id_fkey(display_name, email, phone)").eq("user_id", id).single(),
    sb.from("vehicles").select("*").eq("driver_user_id", id).order("created_at", { ascending: false }).limit(1),
    sb.from("driver_documents").select("*").eq("driver_user_id", id).order("uploaded_at", { ascending: false }),
  ]);
  const last = {};
  for (const x of docs || []) if (!last[x.document_type]) last[x.document_type] = x;
  const v = veh?.[0];
  pane.innerHTML = `<button class="link" id="backBtn">← ${t("back")}</button>
    <div class="card"><h2 style="margin-top:0">${esc(d.profiles?.display_name)}</h2>${partnerBadge(d.partner_status)}
      <div class="kv"><span>${t("email")}</span><span>${esc(d.profiles?.email)}</span></div>
      <div class="kv"><span>${t("phone")}</span><span>${esc(d.profiles?.phone || "—")}</span></div>
      <div class="kv"><span>${t("siret")}</span><span>${esc(d.siret || "—")}</span></div>
      <div class="kv"><span>${t("vehicle")}</span><span>${v ? `${VEHICLE_ICON[v.vehicle_type]} ${esc(t("v_" + v.vehicle_type))} · ${esc([v.make, v.model, v.color].filter(Boolean).join(" "))} · ${esc(v.registration_number)} · 👤 ${v.passenger_capacity}` : "—"}</span></div>
      <div class="kv"><span>${t("cardPayouts")}</span><span>${d.stripe_payouts_enabled ? "✅" : "—"}</span></div>
      ${d.partner_status !== "VALIDATED" ? `<button class="btn" data-ps="VALIDATED">${t("validate")}</button>` : `<button class="btn danger" data-ps="SUSPENDED">${t("suspend")}</button>`}
      ${d.partner_status === "IN_REVIEW" || d.partner_status === "PENDING" ? `<button class="btn danger" data-ps="REJECTED">${t("reject")}</button>` : ""}
    </div>
    <h2>${t("documents")}</h2>
    ${DOC_TYPES.map((k) => { const x = last[k]; return `<div class="card" style="padding:12px 14px">
      <div class="row" style="justify-content:space-between"><strong>${t("doc_" + k)}</strong><span style="flex:0;white-space:nowrap">${x ? `<span class="badge ${{ APPROVED: "ok", REJECTED: "bad" }[x.status] || ""}">${t("d_" + x.status)}</span>` : `<span class="badge warn">${t("d_MISSING")}</span>`}</span></div>
      ${x?.expires_at ? `<p class="muted">${t("expires")} ${new Date(x.expires_at).toLocaleDateString()}</p>` : ""}
      ${x ? `<div class="row" style="margin-top:8px"><button class="btn small secondary" data-view="${esc(x.storage_key)}">${t("view")}</button>
        <button class="btn small" data-doc="${x.id}" data-st="APPROVED">${t("approve")}</button>
        <button class="btn small danger" data-doc="${x.id}" data-st="REJECTED">${t("reject")}</button></div>` : ""}</div>`; }).join("")}`;

  $("#backBtn").onclick = () => { adminView.driver = null; render(); };
  pane.querySelectorAll("[data-ps]").forEach((b) => b.onclick = () => busy(b, async () => {
    const { error } = await sb.from("drivers").update({ partner_status: b.dataset.ps }).eq("user_id", id);
    if (error) throw error;
    toast(t("saved")); render();
  }));
  pane.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => busy(b, async () => {
    const w = window.open("", "_blank");
    const { data, error } = await sb.storage.from("driver-documents").createSignedUrl(b.dataset.view, 120);
    if (error) { w?.close(); throw error; }
    if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  }));
  pane.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => busy(b, async () => {
    const patch = { status: b.dataset.st, rejection_reason: null };
    if (b.dataset.st === "REJECTED") { const r = prompt(t("reason")); if (r === null) return; patch.rejection_reason = r; }
    const { error } = await sb.from("driver_documents").update(patch).eq("id", b.dataset.doc);
    if (error) throw error;
    render();
  }));
}

start().catch(async (e) => { app.innerHTML = `<div class="card">${esc(await errText(e))}</div>`; });
