// Transporteur VTC — carte façon maquette (chargé juste après Leaflet, avant l'appli).
//  1. Carte vectorielle bleu nuit comme sur les maquettes (MapLibre + OpenFreeMap, sans clé).
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

  var css = document.createElement("style");
  css.textContent = ".leaflet-container{background:#0a1431!important}" +
    ".leaflet-control-attribution{background:rgba(10,20,49,.7)!important;color:#6f82b5!important;font-size:9px!important}" +
    ".leaflet-control-attribution a{color:#8597c7!important}.maplibregl-ctrl-attrib,.maplibregl-ctrl-logo{display:none!important}";
  document.head.appendChild(css);

  var L = window.L;
  if (!L) return;

  // ---------------------------------------------------------------- 1. fond de carte
  // Carte vectorielle bleu nuit dessinée sur mesure (MapLibre + tuiles OpenFreeMap, gratuites, sans clé).
  // Si le téléphone ne gère pas WebGL ou si MapLibre ne charge pas, repli sur le fond sombre Esri.
  var ATTR = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>';
  var C = { bg: "#0a1431", park: "#0c1a3d", water: "#050c22", building: "#0f1d45", minor: "#16264f", mid: "#1d3263",
            major: "#24407c", motor: "#2c4c94", label: "#8597c7", place: "#c7d3f2", halo: "#0a1431", waterLabel: "#4a64a6" };
  var Z = function (a, b) { return ["interpolate", ["exponential", 1.5], ["zoom"], 10, a, 18, b]; };
  var NAME = ["coalesce", ["get", "name:fr"], ["get", "name"]];
  var cls = function (list) { return ["match", ["get", "class"], list, true, false]; };
  var STYLE = {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": C.bg } },
      { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": C.park } },
      { id: "wood", type: "fill", source: "omt", "source-layer": "landcover", filter: cls(["wood", "grass"]), paint: { "fill-color": C.park, "fill-opacity": .7 } },
      { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": C.water } },
      { id: "building", type: "fill", source: "omt", "source-layer": "building", minzoom: 14, paint: { "fill-color": C.building, "fill-opacity": .8 } },
      { id: "road-minor", type: "line", source: "omt", "source-layer": "transportation", filter: cls(["minor", "service"]), minzoom: 12,
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.minor, "line-width": Z(.4, 9) } },
      { id: "road-mid", type: "line", source: "omt", "source-layer": "transportation", filter: cls(["tertiary", "secondary"]),
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.mid, "line-width": Z(.8, 13) } },
      { id: "road-major", type: "line", source: "omt", "source-layer": "transportation", filter: cls(["primary", "trunk"]),
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.major, "line-width": Z(1.2, 16) } },
      { id: "road-motor", type: "line", source: "omt", "source-layer": "transportation", filter: cls(["motorway"]),
        layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": C.motor, "line-width": Z(1.4, 18) } },
      { id: "road-name", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 14,
        layout: { "symbol-placement": "line", "text-field": NAME, "text-font": ["Noto Sans Regular"], "text-size": 11 },
        paint: { "text-color": C.label, "text-halo-color": C.halo, "text-halo-width": 1.4 } },
      { id: "water-name", type: "symbol", source: "omt", "source-layer": "water_name",
        layout: { "text-field": NAME, "text-font": ["Noto Sans Italic"], "text-size": 12 },
        paint: { "text-color": C.waterLabel, "text-halo-color": C.halo, "text-halo-width": 1 } },
      { id: "place-small", type: "symbol", source: "omt", "source-layer": "place", filter: cls(["suburb", "neighbourhood", "quarter", "village", "hamlet"]), minzoom: 11,
        layout: { "text-field": NAME, "text-font": ["Noto Sans Regular"], "text-size": 12 },
        paint: { "text-color": C.label, "text-halo-color": C.halo, "text-halo-width": 1.4 } },
      { id: "place-town", type: "symbol", source: "omt", "source-layer": "place", filter: cls(["town", "city"]),
        layout: { "text-field": NAME, "text-font": ["Noto Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 14, 17] },
        paint: { "text-color": C.place, "text-halo-color": C.halo, "text-halo-width": 1.6 } }
    ]
  };
  function webgl() {
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
    catch (e) { return false; }
  }
  var tileLayer = L.tileLayer;
  L.tileLayer = function (url, opts) {
    if (typeof url !== "string" || url.indexOf("tile.openstreetmap.org") === -1) return tileLayer.apply(this, arguments);
    if (L.maplibreGL && window.maplibregl && webgl()) {
      try { return L.maplibreGL({ style: STYLE, attribution: ATTR, attributionControl: false }); } catch (e) { /* repli */ }
    }
    return tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20, maxNativeZoom: 16, attribution: "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap" });
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
