// Transporteur VTC — photo du véhicule.
//  • Espace chauffeur : « Mon véhicule » permet d'ajouter / changer la photo de la voiture ; elle s'affiche aussi dans « Mon profil ».
//  • Appli client : pendant la course, la photo de la voiture du chauffeur remplace l'icône à côté du modèle et de la plaque.
// Les photos sont rangées dans le dossier public « avatars/<id du chauffeur>/ » et l'adresse est gardée dans vehicles.photo_url.
import { sb, toast, esc, busy } from "./core.js";

const css = document.createElement("style");
css.textContent = `
.veh-photo { position: relative; border-radius: 16px; overflow: hidden; background: radial-gradient(120% 90% at 50% 60%, #16244a, #0b1428); aspect-ratio: 16 / 9; margin: 6px 0 4px; }
.veh-photo img { width: 100%; height: 100%; object-fit: cover; display: block; -webkit-mask-image: radial-gradient(ellipse 75% 70% at 50% 55%, #000 55%, transparent 100%); mask-image: radial-gradient(ellipse 75% 70% at 50% 55%, #000 55%, transparent 100%); }
.veh-photo .ph { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--muted); font-size: 14px; }
.veh-photo .ph svg { width: 34px; height: 34px; stroke: currentColor; fill: none; stroke-width: 1.6; }
.veh-photo button { position: absolute; right: 10px; bottom: 10px; width: auto; padding: 8px 13px; font-size: 13px; border-radius: 12px; }
/* vignette de la voiture, fondue dans la carte (comme sur la maquette) */
.veh-thumb { flex: 0 0 auto; width: 112px; height: 64px; border: 0 !important; background: none !important; border-radius: 0 !important; overflow: visible; padding: 0; }
.veh-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 10px;
  -webkit-mask-image: radial-gradient(ellipse 70% 72% at 50% 50%, #000 52%, transparent 100%); mask-image: radial-gradient(ellipse 70% 72% at 50% 50%, #000 52%, transparent 100%); }
.person .veh-thumb { width: 96px; height: 56px; }
.veh-plate { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 8px; background: #13244a; color: #cfe0ff; font-size: 13px; font-weight: 600; letter-spacing: .02em; }`;
document.head.appendChild(css);

const CAR = '<svg viewBox="0 0 24 24"><path d="M5 16V12l2-5h10l2 5v4"/><path d="M3 12h18v5H3z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>';
const isDriverApp = /chauffeur/.test(location.pathname);

async function myVehicle() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data } = await sb.from("vehicles").select("id, driver_user_id, photo_url").eq("driver_user_id", session.user.id)
    .order("created_at", { ascending: false }).limit(1);
  return data?.[0] || null;
}

// Photo choisie → réduite à 1280 px (JPEG) → envoyée → enregistrée sur le véhicule.
function pickPhoto(vehicle) {
  return new Promise((done) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = () => busy(null, async () => {
      const file = input.files[0]; if (!file) return done(null);
      const img = await createImageBitmap(file).catch(() => null);
      if (!img) throw new Error("Image illisible");
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
      const path = `${vehicle.driver_user_id}/vehicle-${Date.now()}.jpg`;
      const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error } = await sb.from("vehicles").update({ photo_url: url }).eq("id", vehicle.id);
      if (error) throw error;
      toast("Photo du véhicule enregistrée");
      done(url);
    }).finally(() => done(null));
    input.click();
  });
}

// ------------------------------------------------------------------ espace chauffeur
async function enhanceVehicleForm(form) {
  if (form.querySelector(".veh-photo")) return;
  const box = document.createElement("div");
  box.className = "veh-photo";
  form.prepend(box);
  const v = await myVehicle();
  const draw = (url) => {
    box.innerHTML = url ? `<img src="${esc(url)}" alt="Photo du véhicule">`
      : `<div class="ph">${CAR}<span>${v ? "Ajoutez une photo de votre voiture" : "Enregistrez d'abord votre véhicule"}</span></div>`;
    if (v) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = url ? "Changer la photo" : "Ajouter une photo";
      b.onclick = async () => { const u = await pickPhoto(v); if (u) { v.photo_url = u; draw(u); } };
      box.appendChild(b);
    }
  };
  draw(v?.photo_url);
}
async function enhanceVehicleRow(row) {
  if (row.dataset.photo) return;
  row.dataset.photo = "1";
  const v = await myVehicle();
  const vic = row.querySelector(".vic");
  if (v?.photo_url && vic) { vic.className = "veh-thumb"; vic.removeAttribute("style"); vic.innerHTML = `<img src="${esc(v.photo_url)}" alt="">`; }
  const smalls = row.querySelectorAll(".body small");          // dernière ligne = immatriculation → pastille
  const plate = smalls[smalls.length - 1];
  if (smalls.length > 1 && plate) { const b = document.createElement("span"); b.className = "veh-plate"; b.textContent = plate.textContent; plate.replaceWith(b); }
}

// ------------------------------------------------------------------ appli client
const byPlate = new Map();
async function enhanceClientRide(panel) {
  const badge = [...panel.querySelectorAll(".person .badge")].find((b) => /\w/.test(b.textContent));
  if (!badge) return;
  const row = badge.closest(".person");
  const icon = row.querySelector(".avatar");
  if (!icon || row.dataset.photo) return;
  row.dataset.photo = "1";
  const plate = badge.textContent.trim();
  if (!byPlate.has(plate)) {
    byPlate.set(plate, sb.from("vehicles").select("photo_url").eq("registration_number", plate).limit(1).then(({ data }) => data?.[0]?.photo_url || null));
  }
  const url = await byPlate.get(plate);
  if (!url || !icon.isConnected) return;
  const thumb = document.createElement("div");
  thumb.className = "veh-thumb";
  thumb.innerHTML = `<img src="${esc(url)}" alt="Véhicule du chauffeur">`;
  icon.replaceWith(thumb);
}

new MutationObserver(() => {
  if (isDriverApp) {
    const f = document.getElementById("vehForm"); if (f) enhanceVehicleForm(f);
    const r = document.getElementById("vehRow"); if (r) enhanceVehicleRow(r);
  } else {
    const p = document.getElementById("tPanel"); if (p) enhanceClientRide(p);
  }
}).observe(document.body, { childList: true, subtree: true });
