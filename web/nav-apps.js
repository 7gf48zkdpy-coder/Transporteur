// Transporteur VTC — chauffeur : ouvrir le guidage dans Waze en un geste,
// et « Nouveau client » quand le client n'a pas encore de note. L'entrée « Administration » est retirée (appli admin séparée).
const css = document.createElement("style");
css.textContent = `
.navapps { display: flex; gap: 8px; margin: 10px 0 4px; }
.navapps a { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 8px; border-radius: 14px;
  font-weight: 700; font-size: 14px; line-height: 1; font-family: inherit; text-decoration: none; color: #fff; background: var(--card2, #16213d); border: 1px solid var(--line, #24314f); }
.navapps a.waze { background: #33ccff; color: #05202b; border-color: #33ccff; }
.navapps a svg { width: 18px; height: 18px; }
#navPanel .eta .navbtn { display: none; }
.rating-line.newc b { color: var(--muted, #9aa); font-weight: 600; }
[data-v="admin"], #sAdmin { display: none !important; }   /* l'administration se fait dans l'appli séparée « Transporteur Admin » (admin.html) */`;
document.head.appendChild(css);

const ICON = {
  waze: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C7 3 3.5 6.4 3.5 10.6c0 1.6.5 3 1.4 4.2-.3 1.1-1.1 1.9-2.1 2.3.9.6 2.2.8 3.4.5 1.1.7 2.4 1.2 3.8 1.3a2 2 0 0 0 3.9.1h.3c4.7 0 8.3-3.4 8.3-7.9S17 3 12 3Zm-3 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm-6.2 2.6h1.4c.2 1 .9 1.6 1.8 1.6s1.6-.6 1.8-1.6h1.4c-.2 1.8-1.5 3-3.2 3s-3-1.2-3.2-3Z"/></svg>`,
};

function enhance(panel) {
  const old = panel.querySelector(".eta .navbtn");
  if (!old || panel.querySelector(".navapps")) return;
  const ll = new URL(old.href).searchParams.get("ll");
  if (!ll) return;
  const row = document.createElement("div"); row.className = "navapps";
  // Lien universel Waze (ouvre l'appli Waze avec le guidage) dans un nouvel onglet : l'appli Transporteur reste sur la course.
  row.innerHTML = `<a class="waze" target="_blank" rel="noopener" href="https://waze.com/ul?ll=${ll}&navigate=yes">${ICON.waze} Ouvrir dans Waze</a>`;
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
