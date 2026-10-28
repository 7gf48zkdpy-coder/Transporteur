// Mise en ligne Netlify (lancé après le reste de la construction, voir netlify.toml) :
// branche acces.js (écran de lancement animé, compte obligatoire, verrou code / Face ID)
// dans les pages, sans toucher aux fichiers sources. Aucune dépendance.
const fs = require("fs");
function patch(file, find, insert, after) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(insert)) return console.log("acces : déjà en place dans", file);
  if (!s.includes(find)) throw new Error("acces : repère introuvable dans " + file + " : " + find);
  s = s.replace(find, after ? find + insert : insert + find);
  fs.writeFileSync(file, s);
  console.log("acces : branché dans", file);
}

const CLIENT = "<script>window.ACCES={app:\"transporteur\",name:\"Transporteur\",tu:false,tag:\"VTC · chauffeur privé\",requireAccount:true,resetLink:true,signupFunction:\"client-signup\",\nsupabase:function(){return new Promise(function(r){(function w(){window.__sb?r(window.__sb):setTimeout(w,30)})()})},\nbg:\"#060a13\",bg2:\"#16264a\",accent:\"#9db4ea\",accent2:\"#e8edf8\",onAccent:\"#060a13\",logo:'<svg viewBox=\"0 0 512 512\"><defs><radialGradient id=\"acg\" cx=\"256\" cy=\"220\" r=\"380\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#1a2c55\"/><stop offset=\"1\" stop-color=\"#040710\"/></radialGradient></defs><rect width=\"512\" height=\"512\" fill=\"url(#acg)\"/><g fill=\"#f6f7fa\" transform=\"translate(256 236) scale(0.9) translate(-165 -70)\"><polygon points=\"42,0 124,0 82,140 0,140\"/><polygon points=\"145,0 227,0 185,140 103,140\"/><polygon points=\"248,0 330,0 288,140 206,140\"/></g><rect x=\"196\" y=\"328\" width=\"120\" height=\"6\" rx=\"3\" fill=\"#9db4ea\"/></svg>'};</script>\n<script src=\"acces.js\"></script>\n";
const CHAUFFEUR = "<script>window.ACCES={app:\"transporteur\",name:\"Transporteur\",tu:false,tag:\"Espace chauffeur\",requireAccount:false,\nsupabase:function(){return new Promise(function(r){(function w(){window.__sb?r(window.__sb):setTimeout(w,30)})()})},\nbg:\"#060a13\",bg2:\"#16264a\",accent:\"#9db4ea\",accent2:\"#e8edf8\",onAccent:\"#060a13\",logo:'<svg viewBox=\"0 0 512 512\"><defs><radialGradient id=\"acg\" cx=\"256\" cy=\"220\" r=\"380\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#1a2c55\"/><stop offset=\"1\" stop-color=\"#040710\"/></radialGradient></defs><rect width=\"512\" height=\"512\" fill=\"url(#acg)\"/><g fill=\"#f6f7fa\" transform=\"translate(256 236) scale(0.9) translate(-165 -70)\"><polygon points=\"42,0 124,0 82,140 0,140\"/><polygon points=\"145,0 227,0 185,140 103,140\"/><polygon points=\"248,0 330,0 288,140 206,140\"/></g><rect x=\"196\" y=\"328\" width=\"120\" height=\"6\" rx=\"3\" fill=\"#9db4ea\"/></svg>'};</script>\n<script src=\"acces.js\"></script>\n";
patch("index.html", '<script src="pwa.js" defer></script>', CLIENT, false);
patch("chauffeur.html", '<script src="pwa.js" defer></script>', CHAUFFEUR, false);
patch("shared.js", "export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });\n", "window.__sb = sb; // utilisé par acces.js (écran de connexion et verrou)\n", true);
