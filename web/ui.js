// Transporteur VTC — finitions partagées : photos, bouton à glisser, animations, messagerie, réglages de l'entreprise
import { sb, lang, t, esc, icon, initials, toast, busy, errText } from "./core.js";

const L10N = {
  fr: { chat: "Messages", write: "Écrire un message…", send: "Envoyer", noMsg: "Aucun message. Écrivez au chauffeur ou au client ici.",
    qDriver: ["J'arrive dans 5 min", "Je suis arrivé", "Où êtes-vous exactement ?", "Merci, bonne journée !"],
    qClient: ["J'arrive", "Je suis devant", "Pouvez-vous m'appeler ?", "Merci !"], photo: "Photo enregistrée", closed: "Messagerie fermée pour cette course." },
  en: { chat: "Messages", write: "Write a message…", send: "Send", noMsg: "No messages yet. Write to your driver or client here.",
    qDriver: ["Arriving in 5 min", "I'm here", "Where exactly are you?", "Thanks, have a nice day!"],
    qClient: ["Coming", "I'm outside", "Can you call me?", "Thank you!"], photo: "Photo saved", closed: "Messaging closed for this ride." },
};
const l = (k) => L10N[lang]?.[k] ?? L10N.fr[k];

// ------------------------------------------------------------------ photos de profil
export function avatarHtml(p, cls = "", extra = "") {
  const img = p?.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" loading="lazy">` : esc(initials(p?.display_name));
  return `<div class="avatar ${cls}">${img}${extra}</div>`;
}

/** Choisir une photo, la réduire (512 px) et l'enregistrer comme photo de profil. Renvoie l'URL publique. */
export function pickAvatar(userId) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => busy(null, async () => {
      const file = input.files[0]; if (!file) return resolve(null);
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height), size = Math.min(512, side);
      const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", .85));
      const path = `${userId}/${Date.now()}.jpg`;
      const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const r = await sb.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (r.error) throw r.error;
      toast(l("photo")); resolve(url);
    });
    input.click();
  });
}

export const CAM = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
export const ratingLine = (rating, count) => rating ? `<span class="rating-line"><b>★ ${rating}</b>${count != null ? ` (${count})` : ""}</span>` : "";

// ------------------------------------------------------------------ bouton à glisser
/** Bouton « glisser pour confirmer ». onConfirm peut être asynchrone ; en cas d'erreur le bouton revient au départ. */
export function slideButton(label, onConfirm, variant = "") {
  const el = document.createElement("div");
  el.className = "slide " + variant;
  el.innerHTML = `<div class="fill"></div><div class="lbl">${esc(label)}</div>
    <div class="knob" role="button" tabindex="0" aria-label="${esc(label)}">${icon("arrows")}</div>`;
  const knob = el.querySelector(".knob"), fill = el.querySelector(".fill");
  let startX = 0, x = 0, dragging = false, locked = false;
  const max = () => el.clientWidth - knob.offsetWidth - 12;
  const set = (v) => { x = Math.max(0, Math.min(max(), v)); knob.style.transform = `translateX(${x}px)`; fill.style.width = `${x + 64}px`; };
  const reset = () => { el.classList.add("back"); set(0); setTimeout(() => el.classList.remove("back"), 260); };
  const fire = async () => {
    if (locked) return; locked = true;
    set(max()); el.classList.add("done"); knob.innerHTML = '<span class="spinner"></span>';
    navigator.vibrate?.(30);
    try { await onConfirm(); }
    catch (e) { toast(await errText(e), true); }
    finally { locked = false; el.classList.remove("done"); knob.innerHTML = icon("arrows"); reset(); }
  };
  knob.addEventListener("pointerdown", (e) => { if (locked) return; dragging = true; startX = e.clientX - x; knob.setPointerCapture(e.pointerId); el.classList.remove("back"); });
  knob.addEventListener("pointermove", (e) => { if (dragging) set(e.clientX - startX); });
  const end = () => { if (!dragging) return; dragging = false; if (x > max() * .85) fire(); else reset(); };
  knob.addEventListener("pointerup", end); knob.addEventListener("pointercancel", end);
  knob.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); } });
  return el;
}

// ------------------------------------------------------------------ animations
/** Écran de célébration (≈ 2 s). kind : "blue" (acceptée / trouvé) ou "green" (terminée). */
export function celebrate(title, sub = "", { kind = "blue", amount = "" } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "celebrate " + kind;
    const colors = kind === "green" ? ["#34d399", "#ffffff", "#fbbf24", "#4a93ff"] : ["#4a93ff", "#ffffff", "#93c5fd", "#fbbf24"];
    const confetti = Array.from({ length: 36 }, (_, i) => `<i class="confetti" style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};
      animation-duration:${1.6 + Math.random() * 1.6}s;animation-delay:${Math.random() * .5}s;transform:rotate(${Math.random() * 180}deg)"></i>`).join("");
    el.innerHTML = `${confetti}<div class="ring"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}${amount ? `<div class="big">${esc(amount)}</div>` : ""}`;
    document.body.appendChild(el);
    navigator.vibrate?.([60, 40, 120]);
    let gone = false;
    const close = () => { if (gone) return; gone = true; el.classList.add("out"); setTimeout(() => { el.remove(); resolve(); }, 340); };
    el.onclick = close;
    setTimeout(close, 2300);
  });
}

// ------------------------------------------------------------------ messagerie client ↔ chauffeur
export async function unreadCount(bookingId, meId) {
  const { count } = await sb.from("messages").select("id", { count: "exact", head: true }).eq("booking_id", bookingId).neq("sender_id", meId).is("read_at", null);
  return count || 0;
}
/** Surveille les nouveaux messages d'une course ; cb(nonLus). Renvoie une fonction pour arrêter. */
export function watchMessages(bookingId, meId, cb) {
  const ch = sb.channel("msgw-" + bookingId + Math.random().toString(36).slice(2, 6))
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` }, async (p) => {
      if (p.eventType === "INSERT" && p.new.sender_id !== meId && !document.querySelector(".chat")) { navigator.vibrate?.(80); }
      cb(await unreadCount(bookingId, meId));
    }).subscribe();
  unreadCount(bookingId, meId).then(cb);
  return () => sb.removeChannel(ch);
}

/** Ouvre la conversation de la course. other = { display_name, avatar_url, phone }, role = "driver" | "client". */
export async function openChat(bookingId, meId, other, role) {
  document.querySelector(".chat")?.remove();
  const el = document.createElement("div"); el.className = "chat";
  el.innerHTML = `<div class="chat-head"><button class="iconbtn" id="chClose" aria-label="${t("close")}">${icon("back")}</button>
      ${avatarHtml(other)}<div class="grow"><strong>${esc(other?.display_name || "")}</strong><small>${l("chat")}</small></div>
      ${other?.phone ? `<a class="round" href="tel:${esc(other.phone)}" aria-label="${t("call")}">${icon("phone")}</a>` : ""}</div>
    <div class="chat-list" id="chList"><div class="center"><span class="spinner"></span></div></div>
    <div class="chat-quick">${l(role === "driver" ? "qDriver" : "qClient").map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <form class="chat-form" id="chForm"><input id="chInput" maxlength="1000" autocomplete="off" placeholder="${l("write")}"><button type="submit" aria-label="${l("send")}">${icon("nav")}</button></form>`;
  document.body.appendChild(el);
  const list = el.querySelector("#chList");
  const fmt = (d) => new Date(d).toLocaleTimeString(lang === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
  const draw = async () => {
    const { data } = await sb.from("messages").select("*").eq("booking_id", bookingId).order("created_at");
    list.innerHTML = (data || []).length ? data.map((m) => `<div class="bubble ${m.sender_id === meId ? "me" : ""}">${esc(m.body)}<small>${fmt(m.created_at)}${m.sender_id === meId && m.read_at ? " · ✓✓" : ""}</small></div>`).join("")
      : `<p class="list-empty">${l("noMsg")}</p>`;
    list.scrollTop = list.scrollHeight;
    sb.rpc("mark_messages_read", { p_booking_id: bookingId }).then(() => {});
  };
  const send = async (body) => {
    body = body.trim(); if (!body) return;
    const { error } = await sb.from("messages").insert({ booking_id: bookingId, body });
    if (error) { toast(/row-level|policy/i.test(error.message) ? l("closed") : await errText(error), true); return; }
    el.querySelector("#chInput").value = ""; draw();
  };
  const ch = sb.channel("chat-" + bookingId).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `booking_id=eq.${bookingId}` }, draw).subscribe();
  el.querySelector("#chClose").onclick = () => { sb.removeChannel(ch); el.remove(); };
  el.querySelector("#chForm").onsubmit = (e) => { e.preventDefault(); send(el.querySelector("#chInput").value); };
  el.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => send(b.dataset.q));
  await draw();
  el.querySelector("#chInput").focus({ preventScroll: true });
}

// ------------------------------------------------------------------ informations de l'entreprise
export async function getSettings() {
  const { data } = await sb.from("app_settings").select("doc").eq("id", 1).maybeSingle();
  return data?.doc || {};
}

export const legalLinks = () => `<div class="legal-links"><a href="legal.html#aide">${lang === "en" ? "Help" : "Aide"}</a>·<a href="legal.html#cgv">${lang === "en" ? "Terms" : "CGV"}</a>·<a href="legal.html#confidentialite">${lang === "en" ? "Privacy" : "Confidentialité"}</a>·<a href="legal.html#mentions">${lang === "en" ? "Legal notice" : "Mentions légales"}</a></div>`;

// ------------------------------------------------------------------ installation (PWA) et ouverture rapide
export function registerSW() {
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
