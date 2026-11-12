// Images for the Dashboard deck (../build-dash-deck.mjs). Screenshots come from
// ../../shots/dash (dark `dk_` captures from tooling/dash.mjs and
// tooling/dashdeck-extra.mjs); each is trimmed and given rounded corners so it
// sits on the night slides as a card, like the main deck's assets.mjs does
// with the site's crops. Output goes to ../img/dash (gitignored).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('../../tooling/node_modules/sharp');
import { framePhone } from '../../tooling/phone.mjs';

const DASH = new URL('../../shots/dash/', import.meta.url).pathname;
const TOOLING = new URL('../../tooling/', import.meta.url).pathname;
export const OUT = new URL('../img/dash/', import.meta.url).pathname;
const MAXW = 1800;
fs.mkdirSync(OUT, { recursive: true });

/** A Dashboard capture as a rounded card. `pad` device px of page are trimmed
    from every side (tile captures carry 32), then the slice from fraction
    t to b of the height and l to r of the width is kept. Returns { path, ar }. */
export async function dcard(name, { t = 0, b = 1, l = 0, r = 1, pad = 32, radius = 34 } = {}) {
  const tag = [t, b, l, r].join('_');
  const file = path.join(OUT, `${name}_${pad}_${tag}_${MAXW}.png`);
  const src = path.join(DASH, name + '.png');
  const { width, height } = await sharp(src).metadata();
  const iw = width - 2 * pad, ih = height - 2 * pad;
  const left = pad + Math.round(iw * l), top = pad + Math.round(ih * t);
  const w = Math.round(iw * (r - l)), h = Math.round(ih * (b - t));
  if (!fs.existsSync(file)) {
    // no wider than MAXW px: sharp enough on a slide, and keeps the deck light for PowerPoint
    const k = Math.min(1, MAXW / w), ow = Math.round(w * k), oh = Math.round(h * k), rr = Math.round(radius * k);
    const buf = await sharp(src).extract({ left, top, width: w, height: h }).resize(ow, oh).png().toBuffer();
    const mask = Buffer.from(`<svg width="${ow}" height="${oh}"><rect width="${ow}" height="${oh}" rx="${rr}" ry="${rr}"/></svg>`);
    await sharp(buf).composite([{ input: mask, blend: 'dest-in' }]).png({ palette: true, quality: 95, effort: 8 }).toFile(file);
  }
  return { path: file, ar: w / h };
}

/** A whole-window capture (no page margin to trim), optionally cut. */
export const dview = (name, o = {}) => dcard(name, { pad: 0, radius: 22, ...o });

/** A phone capture inside the modern iPhone outline (tooling/phone.mjs). */
export async function phone(name) {
  const file = path.join(OUT, `${name}_phone.png`);
  if (!fs.existsSync(file)) {
    const big = file.replace(/\.png$/, '_big.png');
    await framePhone(path.join(DASH, name + '.png'), big, { mode: 'dark' });
    await sharp(big).resize(860).png({ palette: true, quality: 95, effort: 8 }).toFile(file); // 1290 wide is more than any slide needs
    fs.unlinkSync(big);
  }
  return { path: file, ar: 1290 / 2634 };
}

/** The printable report's pages (printed to PDF by dashdeck-extra.mjs), as images. */
export async function reportPages(scale = 1.6) {
  const dir = path.join(OUT, 'report');
  if (!fs.existsSync(path.join(dir, 's01.png'))) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync(path.join(TOOLING, '.venv/bin/python'), [path.join(TOOLING, 'pdf2png.py'), path.join(DASH, 'x_report.pdf'), dir, String(scale)]);
  }
  const files = fs.readdirSync(dir).filter((f) => /^s\d+\.png$/.test(f)).sort();
  return files.map((f) => ({ path: path.join(dir, f), ar: 8.5 / 11 }));
}
