// Original visuals for the package. The data charts are drawn from the same
// monthly history the site uses (web/lib/engine/data/history.js), read straight from the site.
import * as H from '../../web/lib/engine/data/history.js';

const N = H.HIST_M_STOCK.length; // 1,200 months, Jan 1926 to Dec 2025
const fmt = (n) => n.toLocaleString('en-US');

/** Real (after-inflation) value of $1, month by month, for a stock share rebalanced monthly. */
function realPath(startMonth, months, stock = 1) {
  const out = [1];
  let v = 1;
  for (let m = startMonth; m < startMonth + months && m < N; m++) {
    const r = stock * H.HIST_M_STOCK[m] / 100 + (1 - stock) * H.HIST_M_BOND[m] / 100;
    v *= (1 + r) / (1 + H.HIST_M_INFL[m] / 100);
    out.push(v);
  }
  return out;
}

/** Every 30-year stretch starting each January, 1926 to 1996, for a 60/40 mix: the cover art. */
export function coverFan(w, h, { color = '#9aa4b2', hi = '#e3a93b' } = {}) {
  const paths = [];
  for (let y = 0; y + 30 <= 100; y++) paths.push(realPath(y * 12, 360, 0.6));
  const max = 12; // y scale: 0..12x after inflation
  const lo = Math.log(0.45), x = (i) => (i / 360) * w, yv = (v) => h - ((Math.log(v) - lo) / (Math.log(max) - lo)) * h;
  const d = (p) => p.filter((_, i) => i % 3 === 0 || i === p.length - 1).map((v, i, a) => `${i ? 'L' : 'M'}${x(i * 3 > 360 ? 360 : i * 3).toFixed(1)},${yv(Math.max(v, 0.45)).toFixed(1)}`).join('');
  const finals = paths.map((p) => p[p.length - 1]).sort((a, b) => a - b);
  const med = finals[Math.floor(finals.length / 2)];
  const medPath = paths.find((p) => p[p.length - 1] === med);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">`;
  s += `<line x1="0" x2="${w}" y1="${yv(1)}" y2="${yv(1)}" stroke="${color}" stroke-opacity=".35" stroke-dasharray="2 4"/>`;
  for (const p of paths) s += `<path d="${d(p)}" fill="none" stroke="${color}" stroke-opacity=".28" stroke-width="1"/>`;
  s += `<path d="${d(medPath)}" fill="none" stroke="${hi}" stroke-width="2.6" stroke-linecap="round"/>`;
  const ex = x(360), ey = yv(med);
  s += `<circle cx="${ex}" cy="${ey}" r="4" fill="${hi}"/>`;
  s += '</svg>';
  return { svg: s, count: paths.length, median: med, best: finals.at(-1), worst: finals[0] };
}

/** A century of stocks after inflation, log scale, with the eras the tools test against. */
export function centuryChart(w, h) {
  const p = realPath(0, N, 1);
  const pad = { l: 40, r: 64, t: 16, b: 26 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const lo = Math.log(0.3), hi = Math.log(2000);
  const x = (m) => pad.l + (m / N) * iw, y = (v) => pad.t + ih - ((Math.log(v) - lo) / (hi - lo)) * ih;
  const eras = [
    [1929.7, 1932.5, 'Great Depression'], [1966, 1982, 'Stagflation'], [2000.2, 2002.8, 'Dot-com bust'], [2007.8, 2009.2, '2008 crash'],
  ];
  let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">`;
  for (const [a, b, t] of eras) {
    const xa = x((a - 1926) * 12), xb = x((b - 1926) * 12);
    s += `<rect x="${xa}" y="${pad.t}" width="${Math.max(xb - xa, 3)}" height="${ih}" fill="#c2467a" fill-opacity=".09"/>`;
  }
  for (const v of [1, 10, 100, 1000]) {
    s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e0d8"/>`;
    s += `<text x="${pad.l - 6}" y="${y(v) + 3}" font-size="8.5" fill="#5b636e" text-anchor="end">$${fmt(v)}</text>`;
  }
  for (const [a, , t] of eras) s += `<text x="${x((a - 1926) * 12) + 3}" y="${pad.t + 11 + (t === '2008 crash' ? 12 : 0)}" font-size="8.5" fill="#c2467a" font-weight="600" stroke="#faf9f6" stroke-width="3" paint-order="stroke">${t}</text>`;
  for (let yr = 1930; yr <= 2020; yr += 10) s += `<text x="${x((yr - 1926) * 12)}" y="${h - 8}" font-size="8.5" fill="#5b636e" text-anchor="middle">${yr}</text>`;
  const d = p.filter((_, i) => i % 2 === 0).map((v, i) => `${i ? 'L' : 'M'}${x(i * 2).toFixed(1)},${y(v).toFixed(1)}`).join('');
  s += `<path d="${d}" fill="none" stroke="#9a6200" stroke-width="2"/>`;
  const end = p.at(-1);
  s += `<circle cx="${x(N)}" cy="${y(end)}" r="3.5" fill="#9a6200"/>`;
  s += `<text x="${x(N) + 7}" y="${y(end) - 2}" font-size="13" font-weight="700" fill="#17191c">$${fmt(Math.round(end))}</text>`;
  s += `<text x="${x(N) + 7}" y="${y(end) + 10}" font-size="8.5" fill="#5b636e">by 2025</text>`;
  s += `<text x="${x(0) + 4}" y="${y(1) - 6}" font-size="8.5" fill="#5b636e">$1 in Jan 1926</text>`;
  s += '</svg>';
  return { svg: s, end };
}

/** The site's logo mark, exactly as the live header draws it. */
import fs from 'fs';
const LOGO_SVG = fs.readFileSync(new URL('../shots/logo_nav.svg', import.meta.url), 'utf8').replace(/class="[^"]*"/, '');
export const LOGO = (size = 22) => LOGO_SVG.replace('<svg ', `<svg width="${size}" height="${size}" `);
