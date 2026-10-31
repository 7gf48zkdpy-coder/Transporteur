// Transporteur VTC — carte façon maquette (chargé juste après Leaflet, avant l'appli).
//  1. Carte vectorielle bleu nuit comme sur les maquettes (MapLibre + OpenFreeMap, sans clé).
//  2. Le chauffeur est une petite berline blanche vue de dessus, orientée dans le sens de la marche.
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

  // Langue : français par défaut (l'anglais reste disponible dans les paramètres).
  try { if (!localStorage.getItem("lang")) localStorage.setItem("lang", "fr"); } catch (e) { /* stockage indisponible */ }

  var css = document.createElement("style");
  css.textContent = ".leaflet-container{background:#0f1b2e!important}" +
    ".leaflet-control-attribution{background:rgba(10,20,49,.7)!important;color:#6f82b5!important;font-size:9px!important}" +
    ".leaflet-control-attribution a{color:#8597c7!important}.maplibregl-ctrl-attrib,.maplibregl-ctrl-logo{display:none!important}";
  document.head.appendChild(css);

  var L = window.L;
  if (!L) return;

  // ---------------------------------------------------------------- 1. fond de carte
  // Carte vectorielle bleu nuit dessinée sur mesure (MapLibre + tuiles OpenFreeMap, gratuites, sans clé).
  // Si le téléphone ne gère pas WebGL ou si MapLibre ne charge pas, repli sur le fond sombre Esri.
  var ATTR = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>';
  var C = { bg: "#0f1b2e", park: "#112235", water: "#0c2550", building: "#15233a", minor: "#1d2b40", mid: "#25354d",
            major: "#2e4060", motor: "#4a5b78", label: "#7e8ba5", place: "#c9d1e0", halo: "#0f1b2e", waterLabel: "#5671a8" };
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
    var id = "g" + Math.random().toString(36).slice(2, 7);
    return '<svg viewBox="0 0 40 80" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + '" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>' +
      '<ellipse cx="4.2" cy="27" rx="2.6" ry="1.8" fill="' + body + '" stroke="rgba(255,255,255,.85)" stroke-width="1"/>' +
      '<ellipse cx="35.8" cy="27" rx="2.6" ry="1.8" fill="' + body + '" stroke="rgba(255,255,255,.85)" stroke-width="1"/>' +
      '<path d="M20 2.5C29 2.5 34 6 34 15V66C34 74 29 77.5 20 77.5S6 74 6 66V15C6 6 11 2.5 20 2.5Z" fill="' + body + '" stroke="rgba(255,255,255,.9)" stroke-width="1.4"/>' +
      '<path d="M20 2.5C29 2.5 34 6 34 15V66C34 74 29 77.5 20 77.5S6 74 6 66V15C6 6 11 2.5 20 2.5Z" fill="url(#' + id + ')"/>' +
      '<path d="M9.5 25Q20 19 30.5 25L28.6 34Q20 31.5 11.4 34Z" fill="#0d1526"/>' +
      '<path d="M11 26.2Q20 21.6 29 26.2" stroke="rgba(150,185,255,.45)" stroke-width="1" fill="none"/>' +
      '<rect x="11.6" y="35" width="16.8" height="20" rx="3.5" fill="#000" opacity=".12"/>' +
      '<path d="M11.4 57Q20 59.5 28.6 57L29.6 64.5Q20 68 10.4 64.5Z" fill="#0d1526"/>' +
      '<path d="M8.6 30 9.8 56M31.4 30 30.2 56" stroke="#0d1526" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>' +
      '<rect x="9" y="4.6" width="6" height="2.2" rx="1.1" fill="#fffbe6"/><rect x="25" y="4.6" width="6" height="2.2" rx="1.1" fill="#fffbe6"/>' +
      '<rect x="9" y="74" width="6" height="1.8" rx=".9" fill="#ff4d5e"/><rect x="25" y="74" width="6" height="1.8" rx=".9" fill="#ff4d5e"/></svg>';
  }
  var divIcon = L.divIcon;
  L.divIcon = function (opts) {
    var html = opts && typeof opts.html === "string" ? opts.html : "";
    var body = null;
    if (html.indexOf('class="me-dot"') !== -1) body = "#f4f6fb";                      // chauffeur (appli client et chauffeur)
    var mk = html.match(/class="car-mk" style="background:\s*([^";]+)/);              // voitures de la carte admin
    if (mk) body = mk[1].trim();
    if (!body) return divIcon.apply(this, arguments);
    return divIcon({ className: "", iconSize: [22, 44], iconAnchor: [11, 22], html: '<div class="car-top">' + carSvg(body) + "</div>" });
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
