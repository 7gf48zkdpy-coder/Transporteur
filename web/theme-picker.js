// Transporteur VTC — couleur de fond au choix (mémorisée sur le téléphone).
// Ajoute la ligne « Couleur de fond » dans les paramètres (client : profil, chauffeur : paramètres).
(function () {
  "use strict";
  var THEMES = [
    ["noir", "Noir", "#050506"], ["graphite", "Graphite", "#1f1f23"], ["nuit", "Bleu nuit", "#0b1630"],
    ["emeraude", "Émeraude", "#0b2219"], ["bordeaux", "Bordeaux", "#2a0d18"], ["prune", "Prune", "#1f1230"],
  ];
  var EN = { noir: "Black", graphite: "Graphite", nuit: "Midnight blue", emeraude: "Emerald", bordeaux: "Burgundy", prune: "Plum" };
  var get = function () { try { return localStorage.getItem("bg") || "noir"; } catch (e) { return "noir"; } };
  var en = function () { try { return localStorage.getItem("lang") === "en"; } catch (e) { return false; } };
  var find = function (k) { return THEMES.filter(function (x) { return x[0] === k; })[0] || THEMES[0]; };
  var label = function (k) { return en() ? EN[k] : find(k)[1]; };
  function apply(k) {
    document.documentElement.dataset.bg = k;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || find(k)[2]);
  }
  apply(get());
  document.addEventListener("DOMContentLoaded", function () { apply(get()); });

  function openPicker() {
    var m = document.createElement("div"); m.className = "modal";
    var cur = get();
    m.innerHTML = '<div><h2 style="margin-top:0">' + (en() ? "Background colour" : "Couleur de fond") + '</h2><div class="bgpick">' +
      THEMES.map(function (x) { return '<button data-k="' + x[0] + '" class="' + (x[0] === cur ? "on" : "") + '"><i style="background:' + x[2] + '"></i>' + label(x[0]) + "</button>"; }).join("") +
      '</div><button class="btn secondary" id="bgClose">' + (en() ? "Close" : "Fermer") + "</button></div>";
    document.body.appendChild(m);
    var close = function () { m.remove(); };
    m.onclick = function (e) { if (e.target === m) close(); };
    m.querySelector("#bgClose").onclick = close;
    m.querySelectorAll("[data-k]").forEach(function (b) {
      b.onclick = function () {
        try { localStorage.setItem("bg", b.dataset.k); } catch (e) { /* stockage indisponible */ }
        apply(b.dataset.k);
        m.querySelectorAll("[data-k]").forEach(function (x) { x.classList.toggle("on", x === b); });
        var end = document.querySelector("#rowBg .end"); if (end) end.innerHTML = swatch(b.dataset.k);
      };
    });
  }
  function swatch(k) { return '<span class="bgdot" style="background:' + find(k)[2] + '"></span>' + label(k); }
  var PAL = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.8-.4-1 .3-2.2 1.4-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/></svg>';
  function inject() {
    if (document.getElementById("rowBg")) return;
    var lang = document.getElementById("sLang") || document.getElementById("pLang");
    if (!lang) return;
    var row = document.createElement("div"); row.className = "list-row"; row.id = "rowBg";
    row.innerHTML = '<div class="vic">' + PAL + '</div><div class="body">' + (en() ? "Background colour" : "Couleur de fond") + '</div><span class="end">' + swatch(get()) +
      '</span><span class="chev"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>';
    row.onclick = openPicker;
    lang.parentNode.insertBefore(row, lang.nextSibling);
  }
  new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true });
})();
