// Extra Dashboard captures for Part 2 of the marketing PDF (light mode only),
// beside what dash.mjs takes: a setup step part filled in, the printed report
// sheet by sheet, the tool list in its compact view, the 15 strategies open,
// the Bridge to 59½ (Sam retiring at 52) and Health cover views, the Add a
// change and New profile dialogs, a Help guide open, the assumptions fold
// open, the phone's More menu, and the monthly check-in email rendered from
// its own template. Same local build and sample household as dash.mjs
// (tooling/dash-seed.json). Writes shots/dash/lt_x_*.png.
// Usage: node pdfdash-extra.mjs [job,...]   (default: every job)
import puppeteer from 'puppeteer-core'; import fs from 'fs';
import { sleep, unstick } from './lib.mjs';
const BASE = process.env.DASH || 'http://localhost:3190';
const OUT = new URL('../shots/dash/', import.meta.url).pathname;
const only = process.argv[2]?.split(',');
const seed = JSON.parse(fs.readFileSync(new URL('./dash-seed.json', import.meta.url), 'utf8'));
const KEY = 'retcalc.dashboard.v1';
/** The seed with its Dashboard record changed by fn. */
const withDash = (fn) => { const d = JSON.parse(seed[KEY]); fn(d); return { ...seed, [KEY]: JSON.stringify(d) }; };
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const save = (f) => OUT + `lt_x_${f}.png`;
async function newPage({ s = seed, phone = false, dsf = 2 } = {}) {
  const page = await browser.newPage();
  if (phone) { await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'); await page.setViewport({ width: 390, height: 756, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); }
  else await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: dsf });
  await page.evaluateOnNewDocument((s) => { try {
    localStorage.setItem('retcalc.theme.v1', JSON.stringify('light'));
    localStorage.setItem('rc-dev-account', '1');
    for (const [k, v] of Object.entries(s)) if (!sessionStorage.getItem('seeded:' + k)) { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); sessionStorage.setItem('seeded:' + k, '1'); }
  } catch (e) {} }, s);
  return page;
}
const go = async (page, route, wait = 3500) => { await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 90000 }); await sleep(wait); };
/** Click the first visible control whose text is txt. */
async function click(page, txt, sel = 'button,[role="tab"],a,label') {
  const ok = await page.evaluate((txt, sel) => { const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === txt && e.getClientRects().length); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; } return false; }, txt, sel);
  if (!ok) console.log('  ! no click target', txt);
  await sleep(1800); return ok;
}
/** Screenshot the Dashboard tile whose heading starts with h. */
async function tile(page, h, file, pad = 16) {
  const b = await page.evaluate((h) => { const t = [...document.querySelectorAll('.dsh-tile, [data-slot="card"]')].find((c) => (c.querySelector('h1,h2,h3,[data-slot="card-title"]')?.textContent || '').trim().startsWith(h)); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; }, h);
  if (!b) { console.log('  ! no tile', h); return; }
  await page.screenshot({ path: save(file), clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: b.height + 2 * pad }, captureBeyondViewport: true });
  console.log('  tile', file);
}
const jobs = {
  // A setup step part way through: the side panel filled in up to Spending.
  async setup() {
    const page = await newPage({ s: withDash((d) => { d.step = 6; d.done = false; }) });
    await go(page, '/dashboard/setup'); await page.screenshot({ path: save('setup_spend') }); await page.close();
  },
  // The printed report, one PNG per sheet.
  async report() {
    const page = await newPage({ dsf: 1.5 });
    await go(page, '/dashboard/report', 9000);
    await page.evaluate(() => document.documentElement.classList.remove('rp-on'));
    const n = await page.evaluate(() => document.querySelectorAll('.rp-page').length); console.log('  report sheets', n);
    for (let i = 0; i < n; i++) {
      const b = await page.evaluate((i) => { const e = document.querySelectorAll('.rp-page')[i]; e.scrollIntoView(); const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, t: e.getAttribute('aria-label') }; }, i);
      await sleep(400);
      await page.screenshot({ path: save('report_p' + String(i).padStart(2, '0')), clip: { x: b.x, y: b.y, width: b.width, height: b.height }, captureBeyondViewport: true });
      console.log('   ', i, b.t);
    }
    await page.close();
  },
  async tools() {
    const page = await newPage(); await go(page, '/dashboard/tools'); await click(page, 'Compact');
    await unstick(page); await page.screenshot({ path: save('tools_compact_full'), fullPage: true }); await page.close();
  },
  async strategies() {
    const page = await newPage(); await go(page, '/dashboard/retirement'); await click(page, 'Show all 15');
    await tile(page, 'The withdrawal strategies', 'ret_strategies');
    await click(page, 'Health cover'); await unstick(page); await page.screenshot({ path: save('ret_health_full'), fullPage: true }); await page.close();
  },
  async bridge() {
    const page = await newPage({ s: withDash((d) => { d.profile.p1.retire = +(process.env.R1 || 56); d.profile.p2.retire = +(process.env.R2 || 58); }) });
    await go(page, '/dashboard/retirement', 6000); await click(page, 'Bridge to 59½'); await sleep(3000);
    await unstick(page); await page.screenshot({ path: save('ret_bridge_full'), fullPage: true }); await page.close();
  },
  async change() {
    const page = await newPage(); await go(page, '/dashboard/calculator'); await click(page, 'Add a change');
    await page.screenshot({ path: save('calc_add') });
    await page.keyboard.press('Escape'); await sleep(800); await click(page, 'View or edit'); await page.screenshot({ path: save('calc_view') }); await page.close();
  },
  async help() {
    const page = await newPage(); await go(page, '/dashboard/accounts'); await click(page, 'Help'); await sleep(1500);
    await page.screenshot({ path: save('help_accounts') }); await page.close();
  },
  async assume() {
    const page = await newPage(); await go(page, '/dashboard/summary');
    await page.evaluate(() => { const t = [...document.querySelectorAll('details, .dsh-tile, [data-slot="card"]')].find((c) => c.textContent.trim().startsWith('How your assumptions compare')); const b = t && [...t.querySelectorAll('button,summary')].find((x) => /Show/.test(x.textContent)); (b || t?.querySelector('summary,button'))?.click(); });
    await sleep(2000); await unstick(page); await tile(page, 'How your assumptions compare', 'summary_assume'); await page.close();
  },
  async profiles() {
    const page = await newPage(); await go(page, '/dashboard/profile'); await click(page, 'New profile');
    await page.screenshot({ path: save('profile_new') }); await page.close();
  },
  async more() {
    const page = await newPage({ phone: true }); await go(page, '/dashboard/summary'); await page.click('.dsh-tb[aria-haspopup="dialog"]'); await sleep(1500);
    await page.screenshot({ path: save('ph_more') }); await page.close();
  },
  // The check-in email, rendered from its own template with a sample name and date.
  async email() {
    const { checkinEmail } = await import('../../supabase/functions/_shared/checkin.ts');
    const e = checkinEmail({ name: 'Sam', lastEntry: '2026-10-20', now: new Date('2026-11-20T15:00:00Z'), unsubscribeUrl: 'https://retcalc.app/unsubscribe' });
    const page = await browser.newPage(); await page.setViewport({ width: 640, height: 600, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]); await page.setContent(e.html, { waitUntil: 'networkidle0' }); await sleep(500);
    await page.screenshot({ path: save('email'), fullPage: true }); await page.close();
  },
  // The Calculator's projection in its other two modes.
  async calcchart() {
    const page = await newPage(); await go(page, '/dashboard/calculator');
    for (const m of ['Historical', 'Monte Carlo']) { await click(page, m); await sleep(2500); await tile(page, 'Balance over time', 'calc_' + m.toLowerCase().replace(' ', '')); }
    await page.close();
  },
  // A tool opened inside the Dashboard, filled in from the plan.
  async tool() {
    const page = await newPage(); await go(page, '/dashboard/tools/social', 5000);
    await page.screenshot({ path: save('tool_social') }); await page.close();
  },
  // Phone captures in the drawn iPhone outline (tooling/phone.mjs), light.
  async frames() {
    const { framePhone } = await import('./phone.mjs');
    for (const f of ['ph_overview', 'ph_retirement', 'ph_accounts', 'ph_calculator', 'ph_savings', 'x_ph_more']) {
      const src = OUT + 'lt_' + f + '.png'; if (!fs.existsSync(src)) { console.log('  ! missing', f); continue; }
      await framePhone(src, save('frame_' + f.replace(/^x_/, '')), { mode: 'light' }); console.log('  framed', f);
    }
  },
};
for (const [k, f] of Object.entries(jobs)) { if (only && !only.includes(k)) continue; console.log(k); try { await f(); } catch (e) { console.log('  ERR', e.message); } }
await browser.close();
