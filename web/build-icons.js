// Génère les icônes PNG de l'appli à partir du logo (mêmes formes que icon.svg).
// Lancé automatiquement par Netlify à chaque mise en ligne (voir netlify.toml). Aucune dépendance.
const fs = require("fs");
const zlib = require("zlib");

// Fond bleu nuit en dégradé (clair au centre, presque noir sur les bords), logo blanc, filet argent-bleu
let BG_IN = [0x1a, 0x2c, 0x55], BG_OUT = [0x04, 0x07, 0x10], FG = [0xf6, 0xf7, 0xfa], GOLD = [0x9d, 0xb4, 0xea];
const bgAt = (x, y) => { const t = Math.min(1, Math.hypot(x - 256, y - 220) / 380); const e = t * t * (3 - 2 * t); return BG_IN.map((c, i) => c + (BG_OUT[i] - c) * e); };
// Logo : trois parallélogrammes (repère 330 x 140), placés comme dans icon.svg
const LOGO = [[[42, 0], [124, 0], [82, 140], [0, 140]], [[145, 0], [227, 0], [185, 140], [103, 140]], [[248, 0], [330, 0], [288, 140], [206, 140]]]
  .map(poly => poly.map(([x, y]) => [256 + (x - 165) * 0.9, 236 + (y - 70) * 0.9]));
const RULE = { x: 196, y: 328, w: 120, h: 6, r: 3 };

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inRule(px, py) {
  const { x, y, w, h, r } = RULE;
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r), cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}
function colorAt(x, y) { // coordonnées dans le repère 512
  if (LOGO.some(p => inPoly(x, y, p))) return FG;
  if (inRule(x, y)) return GOLD;
  return bgAt(x, y);
}

function render(size) {
  const ss = 4, k = 512 / size, rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 3); // filtre 0 + RGB
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = colorAt((px + (sx + 0.5) / ss) * k, (py + (sy + 0.5) / ss) * k);
        r += c[0]; g += c[1]; b += c[2];
      }
      const n = ss * ss, o = 1 + px * 3;
      row[o] = Math.round(r / n); row[o + 1] = Math.round(g / n); row[o + 2] = Math.round(b / n);
    }
    rows.push(row);
  }
  return png(size, size, Buffer.concat(rows));
}

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB (sans transparence)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const out = process.argv[2] || ".";
for (const [name, size] of [["icon-512.png", 512], ["icon-maskable-512.png", 512], ["icon-192.png", 192], ["apple-touch-icon.png", 180]]) {
  fs.writeFileSync(require("path").join(out, name), render(size));
  console.log("icône créée :", name, size + "x" + size);
}

// Appli « Transporteur Admin » : même logo sur fond doré, pour la distinguer des applis client / chauffeur sur l'écran d'accueil.
BG_IN = [0xc9, 0x93, 0x2c]; BG_OUT = [0x3a, 0x24, 0x05]; FG = [0xff, 0xff, 0xff]; GOLD = [0x1a, 0x10, 0x02];
for (const [name, size] of [["icon-admin-512.png", 512], ["icon-admin-192.png", 192], ["apple-touch-icon-admin.png", 180]]) {
  fs.writeFileSync(require("path").join(out, name), render(size));
  console.log("icône créée :", name, size + "x" + size);
}
