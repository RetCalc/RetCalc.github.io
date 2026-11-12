// Extra Dashboard captures for the Dashboard deck (deck/build-dash-deck.mjs):
// dialogs open, switch states, a Help guide, setup steps, the phone's More
// menu and the check-in email. Same local build and sample household as
// dash.mjs (tooling/dash-seed.json); writes shots/dash/dk_x_*.png.
// Usage: node dashdeck-extra.mjs [job,...]   (default: every job)
import puppeteer from 'puppeteer-core'; import fs from 'fs';
import { sleep, unstick } from './lib.mjs';
const BASE = process.env.DASH || 'http://localhost:3190';
const OUT = new URL('../shots/dash/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2]?.split(',');
const KEY = 'retcalc.dashboard.v1';
const seed = JSON.parse(fs.readFileSync(new URL('./dash-seed.json', import.meta.url), 'utf8'));
const base = JSON.parse(seed[KEY]);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const save = (f) => OUT + `dk_x_${f}.png`;

/** A page in its own browser context (its own localStorage), dark, signed in, seeded with `data`. */
async function newPage(data, { phone = false } = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  if (phone) { await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'); await page.setViewport({ width: 390, height: 756, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); }
  else await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument((k, v) => { try {
    localStorage.setItem('retcalc.theme.v1', JSON.stringify('dark'));
    localStorage.setItem('rc-dev-account', '1');
    if (v && !sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); }
  } catch (e) {} }, KEY, data ? JSON.stringify(data) : null);
  page.ctx = ctx;
  return page;
}
const go = async (page, route, wait = 3500) => { await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 90000 }); await sleep(wait); };
/** Clicks the first visible button-like element whose text is (or starts with) `txt`. */
async function click(page, txt, { starts = false, sel = 'button,[role="tab"],[role="radio"],a,label,[aria-pressed]' } = {}) {
  const ok = await page.evaluate((txt, starts, sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => { const t = e.textContent.trim(); return (starts ? t.startsWith(txt) : t === txt) && e.offsetParent !== null; });
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; } return false;
  }, txt, starts, sel);
  if (!ok) console.log('  ! no click target', txt);
  await sleep(1500);
  return ok;
}
/** Screenshot of the element matched in the page by fn (returns an element), padded. */
async function shootEl(page, file, find, pad = 16, arg) {
  await page.evaluate(() => { const a = document.activeElement; if (a && a.tagName === 'BUTTON') a.blur(); }); await sleep(300);
  const box = await page.evaluate((src, arg) => { const el = new Function('arg', src)(arg); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height }; }, find, arg);
  if (!box) { console.log('  ! nothing to shoot for', file); return; }
  await page.screenshot({ path: save(file), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + 2 * pad, height: box.h + 2 * pad }, captureBeyondViewport: true });
  console.log('  ', file, Math.round(box.w) + 'x' + Math.round(box.h));
}
const tileBy = `const t=[...document.querySelectorAll('.dsh-tile')].find(e=>(e.querySelector('h1,h2,h3')?.textContent||'').trim().startsWith(arg)); return t;`;
const dialog = `return [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(e=>e.offsetParent!==null||e.getBoundingClientRect().width>0).pop();`;

const JOBS = {
  // Changes ahead: three changes, the card, the lanes and the kinds
  async changes() {
    const d = JSON.parse(JSON.stringify(base));
    d.profile.scenarios = [
      { id: 'children', kind: 'children', name: 'Children', on: true, from: 0, until: 0, mode: 'amount', amount: 0, ramp: 0, acct: 'auto', nominal: 0 },
      { id: 'x1', kind: 'income', name: 'Jordan goes part-time', on: true, from: 50, until: 55, mode: 'pct', amount: -50, ramp: 0, acct: 'auto', nominal: 0, who: 1 },
      { id: 'x2', kind: 'spending', name: 'A new car', on: true, from: 47, until: 52, mode: 'amount', amount: 600, ramp: 0, acct: 'auto', nominal: 0 },
      { id: 'x3', kind: 'lump', name: 'An inheritance', on: true, from: 55, until: 0, mode: 'amount', amount: 50000, ramp: 0, acct: 'brok', nominal: 0 },
    ];
    const page = await newPage(d);
    await go(page, '/dashboard/calculator', 4500);
    await page.screenshot({ path: save('calc_changes_view') });
    await unstick(page);
    await shootEl(page, 'calc_changes_card', `const h=[...document.querySelectorAll('h2,h3,.dsh-label,div')].find(e=>e.textContent.trim()==='Changes ahead'); let c=h; while(c&&c.parentElement&&c.getBoundingClientRect().height<200) c=c.parentElement; return c;`, 16);
    await page.evaluate(() => scrollTo(0, 0)); await sleep(500);
    await page.evaluate(() => document.getElementById('btnViewScenarios')?.click()); await sleep(2000);
    await page.screenshot({ path: save('calc_lanes_view') });
    await shootEl(page, 'calc_lanes', dialog, 0);
    await page.keyboard.press('Escape'); await sleep(1000);
    await page.evaluate(() => document.getElementById('btnAddScenario')?.click()); await sleep(2000);
    await shootEl(page, 'calc_kinds', dialog, 0);
    await page.ctx.close();
  },
  // Profiles: the New profile dialog, then two profiles in the list
  async profiles() {
    const page = await newPage(base);
    await go(page, '/dashboard/profile', 3500);
    await click(page, 'New profile');
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => e.textContent.includes('Copy ')); b?.click(); }); await sleep(800);
    await page.type('#dshProfName', 'Sam on his own');
    await sleep(500);
    await shootEl(page, 'profile_new', dialog, 0);
    await click(page, 'Create the copy'); await sleep(2500);
    await page.evaluate(() => scrollTo(0, 0)); await sleep(800);
    await page.screenshot({ path: save('profile_two_view') });
    await unstick(page);
    await shootEl(page, 'profile_profiles', tileBy, 16, 'Profiles');
    await page.ctx.close();
  },
  // A Help guide open beside Net worth
  async help() {
    const page = await newPage(base);
    await go(page, '/dashboard/accounts', 3500);
    await click(page, 'Help'); await sleep(2500);
    await page.screenshot({ path: save('help_accounts') });
    await page.ctx.close();
  },
  // The net worth chart full screen, and Net worth's "Over time"
  async charts() {
    const page = await newPage(base);
    await go(page, '/dashboard', 4000);
    await page.evaluate(() => { const t = [...document.querySelectorAll('.dsh-tile')].find((e) => e.textContent.includes('Net worth')); const b = [...t.querySelectorAll('button')].pop(); b?.click(); }); await sleep(2500);
    await page.screenshot({ path: save('full_networth') });
    await page.keyboard.press('Escape'); await sleep(800);
    await go(page, '/dashboard/accounts', 3500);
    await click(page, 'Over time'); await sleep(1500);
    await unstick(page);
    await shootEl(page, 'accounts_overtime', tileBy, 16, 'Net worth over time');
    await page.ctx.close();
  },
  // Retirement: the strategies open, and the Health cover view
  async retirement() {
    const page = await newPage(base);
    await go(page, '/dashboard/retirement', 4500);
    await click(page, 'Show all', { starts: true }); await sleep(1500);
    await unstick(page);
    await shootEl(page, 'ret_strategies', tileBy, 16, 'The withdrawal strategies');
    await page.evaluate(() => scrollTo(0, 0)); await sleep(500);
    await click(page, 'Health cover'); await sleep(3000);
    await page.screenshot({ path: save('ret_health_view') });
    await unstick(page);
    await shootEl(page, 'ret_health', tileBy, 16, 'Health cover');
    await page.ctx.close();
  },
  // The Bridge to 59½ view: a variant of the sample with Sam retiring at 55
  async bridge() {
    const d = JSON.parse(JSON.stringify(base)); d.profile.p1.retire = 55;
    const page = await newPage(d);
    await go(page, '/dashboard/retirement', 4500);
    await click(page, 'Bridge to 59½'); await sleep(4000);
    await page.screenshot({ path: save('ret_bridge_view') });
    await unstick(page);
    await shootEl(page, 'ret_bridge', tileBy, 16, 'Bridge to 59½');
    await page.ctx.close();
  },
  // Setup: the Household step and the Pay step with "Your plan so far"
  async setup() {
    for (const [step, name] of [[0, 'household'], [4, 'pay'], [5, 'savings']]) {
      const d = JSON.parse(JSON.stringify(base)); d.step = step; d.done = false; d.skipped = [];
      const page = await newPage(d);
      await go(page, '/dashboard/setup', 3500);
      await page.screenshot({ path: save('setup_' + name) });
      await page.ctx.close();
    }
  },
  // Phone: the More menu, and Net worth over time
  async phone() {
    const page = await newPage(base, { phone: true });
    await go(page, '/dashboard', 3500);
    await page.evaluate(() => [...document.querySelectorAll('.dsh-tabbar button')].pop()?.click()); await sleep(1800);
    await page.screenshot({ path: save('ph_more') });
    await page.keyboard.press('Escape'); await sleep(800);
    await go(page, '/dashboard/profile', 3500);
    await page.screenshot({ path: save('ph_profile') });
    await go(page, '/dashboard/tools', 3500);
    await page.screenshot({ path: save('ph_tools') });
    await page.ctx.close();
  },
  // The monthly check-in email, as a dark-mode mail app would show it
  async email() {
    const { checkinEmail } = await import('../../supabase/functions/_shared/checkin.ts');
    const e = checkinEmail({ name: 'Sam', lastEntry: '2026-10-11', now: new Date('2026-11-11T15:00:00Z'), unsubscribeUrl: 'https://retcalc.app/unsubscribe' });
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 640, height: 900, deviceScaleFactor: 2 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await page.setContent(e.html, { waitUntil: 'networkidle0' }); await sleep(800);
    await page.screenshot({ path: save('email'), fullPage: true });
    // and as a phone's mail app would show it
    await page.setViewport({ width: 390, height: 756, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.setContent(e.html, { waitUntil: 'networkidle0' }); await sleep(800);
    await page.screenshot({ path: save('ph_email') });
    console.log('  email subject:', e.subject);
    await ctx.close();
  },
  // The printable report, printed to PDF as the browser's print dialog would
  // (it has its own fixed light look); pdf2png.py turns it into page images
  async report() {
    const page = await newPage(base);
    await go(page, '/dashboard/report', 9000);
    await page.waitForSelector('.rp-page', { timeout: 60000 });
    await page.evaluate(() => { for (const a of document.querySelectorAll('a')) if (a.textContent.trim() === 'Skip to content') a.remove(); });
    await page.pdf({ path: OUT + 'x_report.pdf', preferCSSPageSize: true, printBackground: true });
    console.log('  report pdf, pages:', await page.$$eval('.rp-page', (x) => x.length));
    await page.ctx.close();
  },
  // Plan summary's "How your assumptions compare", opened
  async assumptions() {
    const page = await newPage(base);
    await go(page, '/dashboard/summary', 4000);
    await page.evaluate(() => { const t = [...document.querySelectorAll('.dsh-tile')].find((e) => (e.querySelector('h1,h2,h3')?.textContent || '').startsWith('How your assumptions')); const b = [...t.querySelectorAll('button')].find((x) => /Show/.test(x.textContent)); b?.click(); }); await sleep(2000);
    await unstick(page);
    await shootEl(page, 'summary_assumptions', tileBy, 16, 'How your assumptions');
    await page.ctx.close();
  },
};
for (const [k, fn] of Object.entries(JOBS)) { if (only && !only.includes(k)) continue; console.log(k); try { await fn(); } catch (e) { console.log('  ERR', e.message); } }
await browser.close();
