// Transporteur VTC — carte façon maquette (chargé juste après Leaflet, avant l'appli).
//  1. Fond de carte bleu nuit (CARTO Dark Matter teinté dans ui.css) + noms de rues nets sur un calque à part.
//  2. Le chauffeur est une voiture vue de dessus (plus de flèche), orientée dans le sens de la marche.
//  3. Les liens d'itinéraire ouvrent Waze au lieu de Google Maps.
(function () {
  "use strict";

  // ---------------------------------------------------------------- 3. Waze (ne dépend pas de Leaflet)
  var wazeUrl = function (lat, lng) { return "https://waze.com/ul?ll=" + lat + "," + lng + "&navigate=yes"; };
  function toWaze(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('a[href*="google.com/maps"]').forEach(function (a) {
      var m = a.href.match(/(?:destination|daddr|q)=(-?[\d.]+),(-?[\d.]+)/);
      if (!m) return;
      a.href = wazeUrl(m[1], m[2]);
      a.classList.add("waze-link");
      a.textContent = "Waze";
    });
  }
  new MutationObserver(function (list) {
    list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) toWaze(n.parentNode || n); }); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", function () { toWaze(document); });

  var L = window.L;
  if (!L) return;

  // ---------------------------------------------------------------- 1. fond de carte
  var ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>';
  var tileLayer = L.tileLayer;
  L.tileLayer = function (url, opts) {
    if (typeof url !== "string" || url.indexOf("tile.openstreetmap.org") === -1) return tileLayer.apply(this, arguments);
    var base = tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      { maxZoom: 20, subdomains: "abcd", className: "tiles-base", attribution: ATTR });
    var labels = null;
    base.on("add", function () {
      var map = base._map;
      if (!map.getPane("labels")) {
        var pane = map.createPane("labels");
        pane.style.zIndex = 450; // au-dessus des itinéraires, sous les marqueurs
        pane.style.pointerEvents = "none";
      }
      labels = tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
        { maxZoom: 20, subdomains: "abcd", className: "tiles-labels", pane: "labels" }).addTo(map);
    });
    base.on("remove", function () { if (labels) labels.remove(); });
    return base;
  };

  // ---------------------------------------------------------------- 2. voiture vue de dessus
  function carSvg(body) {
    return '<svg viewBox="0 0 64 112" aria-hidden="true">' +
      '<ellipse cx="32" cy="58" rx="30" ry="52" fill="#000" opacity=".28"/>' +
      '<rect x="7" y="4" width="50" height="102" rx="20" fill="' + (body || "#16224d") + '" stroke="#fff" stroke-width="4"/>' +
      '<rect x="3" y="26" width="6" height="16" rx="3" fill="#060b1a"/><rect x="55" y="26" width="6" height="16" rx="3" fill="#060b1a"/>' +
      '<rect x="3" y="74" width="6" height="16" rx="3" fill="#060b1a"/><rect x="55" y="74" width="6" height="16" rx="3" fill="#060b1a"/>' +
      '<path d="M14 30 Q32 20 50 30 L47 44 Q32 39 17 44 Z" fill="#9db4ea"/>' +
      '<rect x="17" y="47" width="30" height="26" rx="6" fill="rgba(255,255,255,.12)"/>' +
      '<path d="M17 78 Q32 74 47 78 L49 90 Q32 96 15 90 Z" fill="#7f98d4"/>' +
      '<rect x="12" y="7" width="10" height="4" rx="2" fill="#fff6c8"/><rect x="42" y="7" width="10" height="4" rx="2" fill="#fff6c8"/>' +
      '<rect x="12" y="100" width="10" height="3" rx="1.5" fill="#ff5b6b"/><rect x="42" y="100" width="10" height="3" rx="1.5" fill="#ff5b6b"/></svg>';
  }
  var divIcon = L.divIcon;
  L.divIcon = function (opts) {
    var html = opts && typeof opts.html === "string" ? opts.html : "";
    var body = null;
    if (html.indexOf('class="me-dot"') !== -1) body = "#16224d";                      // chauffeur (appli client et chauffeur)
    var mk = html.match(/class="car-mk" style="background:\s*([^";]+)/);              // voitures de la carte admin
    if (mk) body = mk[1].trim();
    if (!body) return divIcon.apply(this, arguments);
    return divIcon({ className: "", iconSize: [30, 52], iconAnchor: [15, 26], html: '<div class="car-top">' + carSvg(body) + "</div>" });
  };

  // Orientation : cap calculé entre deux positions successives (fonctionne même sans boussole).
  var R = Math.PI / 180;
  function bearing(a, b) {
    var y = Math.sin((b.lng - a.lng) * R) * Math.cos(b.lat * R);
    var x = Math.cos(a.lat * R) * Math.sin(b.lat * R) - Math.sin(a.lat * R) * Math.cos(b.lat * R) * Math.cos((b.lng - a.lng) * R);
    return (Math.atan2(y, x) / R + 360) % 360;
  }
  var setLatLng = L.Marker.prototype.setLatLng;
  L.Marker.prototype.setLatLng = function (ll) {
    var prev = this._latlng, res = setLatLng.call(this, ll);
    var car = this._icon && this._icon.querySelector(".car-top");
    if (car && prev) {
      var next = L.latLng(ll);
      if (prev.distanceTo(next) > 4) car.style.transform = "rotate(" + bearing(prev, next) + "deg)";
    }
    return res;
  };
})();
