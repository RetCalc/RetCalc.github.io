// Images, icons and chart data for the deck. Screenshots come from ../shots/crops
// (captured from the live site); each is trimmed of its page margin and given
// rounded corners so it sits on the dark slides as a card.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('../tooling/node_modules/sharp');
const React = require('../tooling/node_modules/react');
const { renderToStaticMarkup } = require('../tooling/node_modules/react-dom/server');
const Lu = require('../tooling/node_modules/react-icons/lu');
import * as H from '../../web/lib/engine/data/history.js';
import { coverFan } from '../build/charts.mjs';

const CROPS = new URL('../shots/crops/', import.meta.url).pathname;
const OUT = new URL('./img/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

/** A screenshot as a rounded card: `pad` px of page margin trimmed, then the
    slice from fraction t to b of what is left. Returns { path, ar }. */
export async function card(name, { t = 0, b = 1, pad = 32, radius = 26, out } = {}) {
  const file = path.join(OUT, (out || name) + `${t || b < 1 ? `_${t}_${b}` : ''}.png`);
  const img = sharp(path.join(CROPS, name + '.png'));
  const { width, height } = await img.metadata();
  const w = width - 2 * pad, ih = height - 2 * pad;
  const top = pad + Math.round(ih * t), h = Math.round(ih * (b - t));
  const buf = await sharp(path.join(CROPS, name + '.png')).extract({ left: pad, top, width: w, height: h }).png().toBuffer();
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${radius}" ry="${radius}"/></svg>`);
  await sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png().toFile(file);
  return { path: file, ar: w / h };
}

/** A full screenshot (no margin to trim), optionally cut to fractions of its height. */
export async function shot(name, { t = 0, b = 1, radius = 0 } = {}) {
  return card(name, { t, b, pad: 0, radius });
}

/** A Lucide icon (the site's icon set) as a PNG. */
export async function icon(name, color, size = 256) {
  const file = path.join(OUT, `icon_${name}_${color}.png`);
  if (!fs.existsSync(file)) {
    const svg = renderToStaticMarkup(React.createElement(Lu[name], { color: '#' + color, size, strokeWidth: 1.75 }));
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  }
  return file;
}

/** The cover art: every 30-year stretch since 1926 for a 60/40 portfolio, full bleed. */
export async function coverArt(name, w, h, opts = {}) {
  const file = path.join(OUT, name + '.png');
  const f = coverFan(w, h, opts);
  const svg = f.svg.replace('<svg ', `<svg style="background:#0e1116" `).replace('style="display:block;overflow:visible"', '');
  await sharp(Buffer.from(svg), { density: 216 }).resize(w * 3, h * 3).png().toFile(file);
  return { path: file, ...f };
}

/** $1 in US stocks, after inflation, at the end of each year 1926 to 2025. */
export function centurySeries() {
  let v = 1; const years = [], vals = [];
  for (let m = 0; m < H.HIST_M_STOCK.length; m++) {
    v *= (1 + H.HIST_M_STOCK[m] / 100) / (1 + H.HIST_M_INFL[m] / 100);
    if (m % 12 === 11) { years.push(String(1926 + Math.floor(m / 12))); vals.push(+v.toFixed(3)); }
  }
  return { years, vals };
}
