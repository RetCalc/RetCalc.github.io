// Dashboard one-pager extras for build/build-dash-onepager.mjs: the framed
// light-mode phone (Dashboard tab), scaled to half size to keep the repo small,
// and the Retirement tab's success card. Run from tooling/: node dashone-extra.mjs
import { createRequire } from 'module';
import fs from 'fs';
import { framePhone } from './phone.mjs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const D = '../shots/dash/';
const tmp = '../.preview/dashone/_phone.png';
fs.mkdirSync('../.preview/dashone', { recursive: true });
await framePhone(D + 'lt_ph_overview.png', tmp, { mode: 'light' });
await sharp(tmp).resize(645).png({ compressionLevel: 9 }).toFile(D + 'dashone_ph_overview_lt.png');
fs.unlinkSync(tmp);
console.log('wrote', D + 'dashone_ph_overview_lt.png');
// The Retirement tab's success card, cut out of the 15,496-px-tall "Your drawdown"
// capture so the PDF doesn't embed the whole page (card plus 2px of page around it).
await sharp(D + 'lt_retirement__your-drawdown.png').extract({ left: 910, top: 110, width: 1722, height: 595 }).png({ compressionLevel: 9 }).toFile(D + 'dashone_retirement_success_lt.png');
console.log('wrote', D + 'dashone_retirement_success_lt.png');
