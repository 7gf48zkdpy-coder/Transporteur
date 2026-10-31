// Transporteur VTC — chauffeur : ouvrir le guidage dans Waze, Google Maps ou Plans en un geste,
// et « Nouveau client » quand le client n'a pas encore de note.
const css = document.createElement("style");
css.textContent = `
.navapps { display: flex; gap: 8px; margin: 10px 0 4px; }
.navapps a { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 8px; border-radius: 14px;
  font: 700 14px/1 inherit; text-decoration: none; color: #fff; background: var(--card2, #16213d); border: 1px solid var(--line, #24314f); }
.navapps a.waze { background: #33ccff; color: #05202b; border-color: #33ccff; }
.navapps a svg { width: 18px; height: 18px; }
#navPanel .eta .navbtn { display: none; }
.rating-line.newc b { color: var(--muted, #9aa); font-weight: 600; }`;
document.head.appendChild(css);

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const ICON = {
  waze: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C7 3 3.5 6.4 3.5 10.6c0 1.6.5 3 1.4 4.2-.3 1.1-1.1 1.9-2.1 2.3.9.6 2.2.8 3.4.5 1.1.7 2.4 1.2 3.8 1.3a2 2 0 0 0 3.9.1h.3c4.7 0 8.3-3.4 8.3-7.9S17 3 12 3Zm-3 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm-6.2 2.6h1.4c.2 1 .9 1.6 1.8 1.6s1.6-.6 1.8-1.6h1.4c-.2 1.8-1.5 3-3.2 3s-3-1.2-3.2-3Z"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14"/></svg>`,
};

// Lien vers l'appli : schéma direct (ouvre l'appli installée), sinon le lien web.
function openApp(app, ll) {
  const web = { waze: `https://waze.com/ul?ll=${ll}&navigate=yes`, gmaps: `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`,
    apple: `https://maps.apple.com/?daddr=${ll}&dirflg=d` }[app];
  const direct = { waze: `waze://?ll=${ll}&navigate=yes`, gmaps: isIOS ? `comgooglemaps://?daddr=${ll}&directionsmode=driving` : null, apple: null }[app];
  if (!direct) { window.open(web, "_blank"); return; }
  const t = setTimeout(() => { if (!document.hidden) window.location.href = web; }, 1200);
  window.addEventListener("pagehide", () => clearTimeout(t), { once: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(t); }, { once: true });
  window.location.href = direct;
}

function enhance(panel) {
  const old = panel.querySelector(".eta .navbtn");
  if (!old || panel.querySelector(".navapps")) return;
  const ll = new URL(old.href).searchParams.get("ll");
  if (!ll) return;
  const row = document.createElement("div"); row.className = "navapps";
  row.innerHTML = `<a class="waze" href="#" data-app="waze">${ICON.waze} Waze</a>
    <a href="#" data-app="${isIOS ? "apple" : "gmaps"}">${ICON.map} ${isIOS ? "Plans" : "Google Maps"}</a>
    ${isIOS ? `<a href="#" data-app="gmaps">${ICON.map} Google Maps</a>` : ""}`;
  row.querySelectorAll("a").forEach((a) => a.onclick = (e) => { e.preventDefault(); openApp(a.dataset.app, ll); });
  panel.querySelector(".eta").after(row);
}

// Client sans note : « Nouveau client » (au lieu de rien).
function newClient(root) {
  root.querySelectorAll(".person .grow").forEach((g) => {
    const label = g.querySelector("small")?.textContent.trim();
    if (!["Client", "Customer"].includes(label) || g.querySelector(".rating-line")) return;
    const s = document.createElement("span"); s.className = "rating-line newc"; s.innerHTML = "<b>Nouveau client · pas encore noté</b>";
    g.appendChild(s);
  });
}

new MutationObserver(() => {
  const p = document.getElementById("navPanel");
  if (p) { enhance(p); newClient(p); }
  const o = document.getElementById("overlay"); if (o) newClient(o);
}).observe(document.body, { childList: true, subtree: true });
