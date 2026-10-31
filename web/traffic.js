// Transporteur VTC — temps de trajet réalistes en Île-de-France.
// L'itinéraire (OSRM, gratuit) donne un temps « route dégagée », souvent 2 fois plus court que Waze aux heures chargées.
// En attendant un service avec trafic réel, on applique un coefficient selon l'heure et le jour (heure de Paris)
// à toutes les durées renvoyées par OSRM : temps d'arrivée affichés au client et au chauffeur.
(function () {
  function factor(d) {
    const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    const h = +get("hour") + +get("minute") / 60, wd = get("weekday").toLowerCase();
    const weekend = wd.startsWith("sam") || wd.startsWith("dim");
    if (h < 6 || h >= 23) return 1.15;                         // nuit
    if (!weekend) {
      if (h >= 7 && h < 10) return 1.9;                        // pointe du matin
      if (h >= 16.5 && h < 20) return 2.0;                     // pointe du soir
      if (h >= 10 && h < 16.5) return 1.5;                     // journée
      return 1.3;                                              // tôt le matin / soirée
    }
    if (h >= 14 && h < 20) return 2.0;                         // week-end après-midi
    if (h >= 10 && h < 14) return 1.5;
    return 1.25;
  }
  window.trafficFactor = () => factor(new Date());
  const orig = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const res = await orig(input, init);
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      if (!/router\.project-osrm\.org\/route\//.test(url) || !res.ok) return res;
      const j = await res.clone().json();
      const f = factor(new Date());
      (j.routes || []).forEach((r) => {
        r.duration *= f;
        (r.legs || []).forEach((l) => { l.duration *= f; (l.steps || []).forEach((s) => { s.duration *= f; }); });
      });
      return new Response(JSON.stringify(j), { status: res.status, headers: { "Content-Type": "application/json" } });
    } catch { return res; }
  };
})();
