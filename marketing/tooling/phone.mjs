// Puts a 390x844 @3x phone screenshot into a drawn modern iPhone outline
// (titanium edge, black bezel, Dynamic Island, side buttons) with a fake
// status bar, and writes a transparent PNG for the PDFs and decks.
// Usage: node phone.mjs <in.png> <out.png> [light|dark] [time]
// Or import { framePhone } and call it.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
export async function framePhone(input, output, { mode = 'dark', time = '9:41', crop = 0 } = {}) {
  const S = 3, SW = 390 * S, SH = 844 * S;               // screen, px
  const bez = 13 * S, edge = 4 * S, btn = 3 * S;          // bezel, metal edge, button depth
  const W = SW + 2 * (bez + edge) + 2 * btn, H = SH + 2 * (bez + edge);
  const ox = btn + edge + bez, oy = edge + bez;           // screen origin
  const rOut = 62 * S, rScr = 47 * S;
  // the screenshot, status bar area optionally cropped from its top, laid on the screen
  let shot = sharp(input).resize(SW, null);
  const meta = await sharp(input).metadata();
  const h = Math.round(meta.height * (SW / meta.width));
  const top = 54 * S;                                     // the page starts under the status bar, as in Safari
  const bottom = 34 * S;                                  // the home-bar area under the page, filled with the page's last row
  const hh = Math.min(SH - top - bottom, h - crop * S);
  let buf = await shot.extract({ left: 0, top: Math.min(crop * S, h - 1), width: SW, height: hh }).png().toBuffer();
  const last = await sharp(buf).extract({ left: 0, top: hh - 1, width: SW, height: 1 }).resize(SW, bottom, { kernel: 'nearest' }).png().toBuffer();
  const ink = mode === 'dark' ? '#ffffff' : '#000000';
  const status = `<svg width="${SW}" height="${54 * S}" xmlns="http://www.w3.org/2000/svg">
    <text x="${52 * S}" y="${33 * S}" font-family="-apple-system, 'SF Pro Text', Inter, Helvetica, Arial" font-weight="600" font-size="${17 * S}" fill="${ink}" text-anchor="middle">${time}</text>
    <g fill="${ink}" transform="translate(${292 * S},${22 * S}) scale(${S})">
      <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="4.5" y="6" width="3" height="6" rx="1"/><rect x="9" y="3.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="1" width="3" height="11" rx="1"/>
      <path d="M30.5 3.2a9.6 9.6 0 0 1 13 0l-1.4 1.5a7.6 7.6 0 0 0-10.2 0zM33 6a5.8 5.8 0 0 1 8 0l-1.4 1.5a3.8 3.8 0 0 0-5.2 0zM35.6 8.8a2.1 2.1 0 0 1 2.8 0L37 10.4z" transform="translate(-6,0)"/>
      <rect x="44" y="0.5" width="25" height="12" rx="3.8" fill="none" stroke="${ink}" stroke-opacity=".4" stroke-width="1"/><rect x="46" y="2.5" width="21" height="8" rx="2.4"/><path d="M70.5 4.5v4a2 2 0 0 0 0-4z" fill-opacity=".45"/>
    </g></svg>`;
  const ground = mode === 'dark' ? '#000000' : '#f5f5f7';
  const screenMask = Buffer.from(`<svg width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" rx="${rScr}"/></svg>`);
  const screen = await sharp({ create: { width: SW, height: SH, channels: 4, background: ground } })
    .composite([{ input: buf, top, left: 0 }, { input: last, top: top + hh, left: 0 }, { input: Buffer.from(status), top: 0, left: 0 },
      { input: Buffer.from(`<svg width="${SW}" height="${SH}"><rect x="${(SW - 139 * S) / 2}" y="${SH - 9 * S}" width="${139 * S}" height="${5 * S}" rx="${2.5 * S}" fill="${ink}"/></svg>`), top: 0, left: 0 },
      { input: screenMask, blend: 'dest-in' }]).png().toBuffer();
  const body = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="ti" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a9a9f"/><stop offset=".45" stop-color="#4a4a4f"/><stop offset="1" stop-color="#8a8a8f"/></linearGradient></defs>
    <rect x="0" y="${170 * S}" width="${btn + 2}" height="${30 * S}" rx="${1.5 * S}" fill="#5a5a5f"/>
    <rect x="0" y="${225 * S}" width="${btn + 2}" height="${62 * S}" rx="${1.5 * S}" fill="#5a5a5f"/>
    <rect x="0" y="${300 * S}" width="${btn + 2}" height="${62 * S}" rx="${1.5 * S}" fill="#5a5a5f"/>
    <rect x="${W - btn - 2}" y="${245 * S}" width="${btn + 2}" height="${96 * S}" rx="${1.5 * S}" fill="#5a5a5f"/>
    <rect x="${btn}" y="0" width="${W - 2 * btn}" height="${H}" rx="${rOut}" fill="url(#ti)"/>
    <rect x="${btn + edge * 0.5}" y="${edge * 0.5}" width="${W - 2 * btn - edge}" height="${H - edge}" rx="${rOut - edge * 0.5}" fill="#1a1a1c"/>
    <rect x="${btn + edge}" y="${edge}" width="${W - 2 * btn - 2 * edge}" height="${H - 2 * edge}" rx="${rOut - edge}" fill="#050505"/></svg>`;
  const island = `<svg width="${W}" height="${H}"><rect x="${(W - 124 * S) / 2}" y="${oy + 11 * S}" width="${124 * S}" height="${36 * S}" rx="${18 * S}" fill="#000"/></svg>`;
  await sharp(Buffer.from(body)).composite([{ input: screen, top: oy, left: ox }, { input: Buffer.from(island), top: 0, left: 0 }]).png().toFile(output);
  return { w: W, h: H };
}
if (process.argv[1] && process.argv[1].endsWith('phone.mjs') && process.argv[3]) {
  const [, , i, o, mode = 'dark', time = '9:41'] = process.argv;
  console.log(await framePhone(i, o, { mode, time }));
}
