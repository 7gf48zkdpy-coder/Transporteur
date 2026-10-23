// Installation PWA : enregistre le service worker (page hors connexion uniquement)
// et signale le mode « appli installée » pour adapter l'affichage.
(function () {
  var standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (standalone) document.documentElement.classList.add("standalone");
  var secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && secure) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () { /* l'appli marche sans */ });
    });
  }
})();
