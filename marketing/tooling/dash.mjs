// The Dashboard, captured from a local build signed in as the sample household
// (Sam and Jordan, daughter Nora; tooling/dash-seed.json). Needs a local
// server at $DASH (default http://localhost:3190) whose AccountProvider accepts
// the localStorage key rc-dev-account on localhost. Never commit that bypass:
// build it in a throwaway worktree (see ../README.md).
// Usage: node dash.mjs <light|dark> [desk|phone|setup|landing|report] [section,...]
import puppeteer from 'puppeteer-core'; import fs from 'fs';
import { sleep, unstick } from './lib.mjs';
const BASE = process.env.DASH || 'http://localhost:3190';
const theme = process.argv[2] || 'light', what = (process.argv[3] || 'desk').split(','), only = process.argv[4]?.split(',');
const OUT = new URL('../shots/dash/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const T = theme === 'dark' ? 'dk' : 'lt';
const seed = JSON.parse(fs.readFileSync(new URL('./dash-seed.json', import.meta.url), 'utf8'));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
async function newPage({ phone = false, signedIn = true, fresh = false } = {}) {
  const page = await browser.newPage();
  if (phone) { await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'); await page.setViewport({ width: 390, height: 756, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); } // 844 less the 54pt status bar and 34pt home-bar area phone.mjs draws
  else await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((t, s, signedIn, fresh) => { try {
    localStorage.setItem('retcalc.theme.v1', JSON.stringify(t));
    if (signedIn) localStorage.setItem('rc-dev-account', '1');
    if (!fresh) for (const [k, v] of Object.entries(s)) if (!sessionStorage.getItem('seeded:' + k)) { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); sessionStorage.setItem('seeded:' + k, '1'); }
  } catch (e) {} }, theme, seed, signedIn, fresh);
  return page;
}
const go = async (page, route, wait = 2500) => { await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 90000 }); await sleep(wait); };
const save = (f) => OUT + `${T}_${f}.png`;
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
// every top-level Dashboard tile (and card, for hosted tools), named by its heading
async function tiles(page, prefix, pad = 16) {
  await unstick(page);
  const boxes = await page.evaluate(() => {
    const sel = '.dsh-tile, [data-slot="card"]';
    return [...document.querySelectorAll(sel)].filter((e) => !e.parentElement.closest(sel)).map((c) => { const b = c.getBoundingClientRect(); const h = (c.querySelector('h1,h2,h3,[data-slot="card-title"]')?.textContent || c.textContent).trim(); return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height, t: h.slice(0, 40) }; }).filter((b) => b.w > 60 && b.h > 40);
  });
  const seen = {};
  for (const b of boxes) { let s = slug(b.t) || 'tile'; s = seen[s] ? s + '-' + (++seen[s]) : (seen[s] = 1, s);
    await page.screenshot({ path: save(`${prefix}__${s}`), clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.w + 2 * pad, height: b.h + 2 * pad }, captureBeyondViewport: true }); }
  console.log('  ', prefix, boxes.length, 'tiles:', boxes.map((b) => b.t.slice(0, 22)).join(' | '));
}
const SECTIONS = ['overview', 'summary', 'profile', 'accounts', 'home', 'income', 'spending', 'savings', 'retirement', 'years', 'calculator', 'tools', 'next', 'learn', 'about'];
const route = (s) => s === 'overview' ? '/dashboard' : s === 'learn' ? '/dashboard/learn' : s === 'tools' ? '/dashboard/tools' : '/dashboard/' + s;
if (what.includes('desk')) {
  const page = await newPage();
  for (const s of SECTIONS) { if (only && !only.includes(s)) continue; console.log(s);
    try { await go(page, route(s), 3500);
      await page.screenshot({ path: save(`${s}_view`) });
      await page.screenshot({ path: save(`${s}_full`), fullPage: true });
      await tiles(page, s);
    } catch (e) { console.log('  ERR', e.message); } }
  await page.close();
}
if (what.includes('phone')) {
  const page = await newPage({ phone: true });
  for (const s of ['overview', 'summary', 'accounts', 'savings', 'retirement', 'calculator', 'years', 'next', 'learn', 'spending', 'income']) { if (only && !only.includes(s)) continue; console.log('phone', s);
    try { await go(page, route(s), 3500); await page.screenshot({ path: save(`ph_${s}`) }); await page.screenshot({ path: save(`ph_${s}_full`), fullPage: true }); } catch (e) { console.log('  ERR', e.message); } }
  await page.close();
}
if (what.includes('landing')) {
  const page = await newPage({ signedIn: false, fresh: true });
  await go(page, '/dashboard', 3500); await page.screenshot({ path: save('landing_view') }); await page.screenshot({ path: save('landing_full'), fullPage: true });
  await page.close();
}
if (what.includes('setup')) {
  const page = await newPage({ fresh: true });
  await go(page, '/dashboard/setup', 3500); await page.screenshot({ path: save('setup_0') }); await page.screenshot({ path: save('setup_0_full'), fullPage: true });
  await page.close();
}
if (what.includes('report')) {
  const page = await newPage();
  await go(page, '/dashboard/report', 6000); await page.screenshot({ path: save('report_full'), fullPage: true });
  await page.close();
}
await browser.close();
