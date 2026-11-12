// Builds the Dashboard one-pager (dash-onepager.html), a sibling of the main
// one-pager in build.mjs, about the signed-in Dashboard only. Rendered to PDF
// by tooling/render.mjs:
//   node render.mjs ../build/dash-onepager.html ../RetCalc-Dashboard-One-Pager.pdf ../.preview/dashone/pages
// Screenshots are the light-mode Dashboard captures in shots/dash (tooling/dash.mjs);
// the framed phone and the Retirement success card come from tooling/dashone-extra.mjs.
import fs from 'fs';
import { LOGO } from './charts.mjs';

const D = '../shots/dash/';

/* ---------- helpers (copied from build.mjs, pointed at shots/dash) ---------- */
const dims = (f) => { const b = fs.readFileSync(new URL(D + f + '.png', import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const stats = (xs) => `<div class="stats">${xs.map(([n, l, a]) => `<div class="stat"><div class="n ${a ? 'amber' : ''}">${n}</div><div class="l">${l}</div></div>`).join('')}</div>`;
/** A window onto a screenshot: the box [x, y, w, h] in image pixels, shown at height h px (width follows). */
const clip = (f, box, H) => {
  const [iw, ih] = dims(f);
  const [x, y, w, h] = box || [0, 0, iw, ih];
  const W = (H * w) / h;
  return { W, html: `<div class="crop clip" style="width:${W.toFixed(1)}px;height:${H}px"><img src="${D}${f}.png" style="width:${((iw / w) * 100).toFixed(3)}%;margin-left:-${((x / w) * 100).toFixed(3)}%;margin-top:-${((y / w) * 100).toFixed(3)}%"></div>` };
};

/* ---------- pieces ---------- */
/** Tile captures carry 16px (32 device px) of page around the card; IN trims most of it so captions line up with the card. */
const IN = (f) => { const [w, h] = dims(f); return [30, 30, w - 60, h - 60]; };
/** A row of highlight tiles whose screenshots share one height and together fill the width. */
const ROW_W = 728, GAP = 14;
/* The phone rises out of the band's bottom edge, cut in the gap between the
   "last entry" box and the Net worth card (rows 668-685 of the 645-wide frame). */
const BAND = 244, PHONE_W = 170, PHONE_CUT = Math.round((676 * PHONE_W) / 645);
function tileRow(items) {
  // height that makes the images fill the row exactly
  items = items.map(([n, l, f, box]) => [n, l, f, typeof box === 'function' ? box(f) : box]);
  const aspects = items.map(([, , f, box]) => { const [iw, ih] = dims(f); const [, , w, h] = box || [0, 0, iw, ih]; return w / h; });
  const H = (ROW_W - GAP * (items.length - 1)) / aspects.reduce((a, b) => a + b, 0);
  return `<div class="trow">${items.map(([name, line, f, box]) => {
    const c = clip(f, box, Math.floor(H));
    return `<div style="width:${c.W.toFixed(1)}px">${c.html}<div class="tn">${name}</div><div class="tl muted">${line}</div></div>`;
  }).join('')}</div>`;
}

const TABS = [
  ['Profile', 'every answer, editable in place'],
  ['Dashboard', 'where do I stand today?'],
  ['Plan summary', 'the whole plan on one page'],
  ['Net worth', 'what we own and owe, over time'],
  ['Your home', 'what owning, or renting, costs'],
  ['Income', 'pay, the match, Social Security'],
  ['Spending', 'where does the money go?'],
  ['Taxes &amp; Savings', 'tax, and where the rest goes'],
  ['Year by year', 'every year to retirement'],
  ['Calculator', 'what your savings grow to'],
  ['Retirement', 'will the money last?'],
  ['Tools', 'all 14 tools, your numbers filled in'],
  ['Next steps', 'what to do next, ranked by effect'],
  ['Learn', '66 lessons with your own numbers'],
  ['About', 'how every figure is worked out'],
];
const tabRow = ([n, q]) => `<div class="tab"><b>${n}</b> <span class="muted">· ${q}</span></div>`;

const IDEAS = [
  ['One profile, every tab', 'Setup takes up to eight short steps, each one skippable. Every figure is set in one place, so a change on any tab re-runs the whole plan.'],
  ['Your balances, by date', 'Type your balances each month or quarter. Each update is a point on your net worth line, and the plan starts from the latest. No bank logins.'],
  ['Tested against history', 'Chance of success replays your plan and your withdrawal strategy through every starting month since January 1926.'],
];

/* ---------- the page ---------- */
const one = `<section class="page" style="padding:0">
  <div class="band">
    <img class="phone" src="${D}dashone_ph_overview_lt.png">
    <div style="position:relative">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-right:226px"><span class="logo" style="font-size:17px;gap:9px">${LOGO(26)}<span>RetCalc</span><span class="kick">My Dashboard</span></span><a class="mono" style="font-size:11px;color:var(--g-amber)" href="https://retcalc.app/dashboard">retcalc.app/dashboard</a></div>
      <h1>One place for your money and <span style="color:var(--g-amber)">your retirement plan.</span></h1>
      <p>A free RetCalc account turns one profile into 15 tabs: net worth, pay, taxes, spending, saving, and a retirement plan tested against every market since 1926. Update your balances each month or quarter and see where you stand.</p>
    </div>
  </div>
  <div style="padding:14px 44px 0" class="op">
    ${stats([['15', 'tabs, all from one profile', 1], ['14', 'tools inside, your numbers filled in'], ['Up to 8', 'setup steps, each one skippable'], ['100 yrs', 'of monthly market history'], ['66', 'lessons in 8 tracks'], ['$0', 'no ads, no bank logins']])}
    <div class="row" style="gap:16px;margin-top:15px">
      ${IDEAS.map(([h, t], i) => `<div class="col"><div style="display:flex;gap:8px;align-items:baseline"><span class="mono amber" style="font-size:15px;font-weight:500">${i + 1}</span><b style="font-size:11.5px">${h}</b></div><p class="muted" style="font-size:9.5px;margin:3px 0 0;line-height:1.45">${t}</p></div>`).join('')}
    </div>
    <div class="label" style="margin-top:16px">Highlights</div>
    ${tileRow([
      ['Dashboard', 'Your net worth from your own entries, projected to retirement, then run through every market since 1926.', 'lt_overview__net-worth', IN],
      ['Taxes &amp; Savings', 'Federal, state and FICA tax on your own pay, and where the rest goes.', 'lt_savings__taxes-this-year', IN],
      ['Readiness score', 'Out of 100 across five areas, each with what would raise it.', 'lt_overview__readiness-score', IN],
    ])}
    ${tileRow([
      ['Retirement', 'The Drawdown Simulator on your plan, with 15 withdrawal strategies.', 'dashone_retirement_success_lt'],
      ['Net worth', 'Nine kinds of assets and five of debts, by date, with when each dollar can be spent.', 'lt_accounts__assets-and-debts', IN],
    ])}
    <div class="bottom">
      <div style="flex:1">
        <div class="label">Every tab</div>
        <div class="tabs">${TABS.map(tabRow).join('')}</div>
      </div>
      <div class="also">
        <div><b>Print your plan.</b> <span class="muted">A report of 14 standard pages, plus up to 7 that fit your situation, built in your browser.</span></div>
        <div><b>A monthly check-in.</b> <span class="muted">An email when your balances are 30 days old, with no figures in it. One click turns it off.</span></div>
        <div><b>On your phone.</b> <span class="muted">A bottom tab bar and charts you read with a finger. Every tab works on a phone.</span></div>
      </div>
    </div>
  </div>
  <div class="footline muted">
    <span>Free account: sign in with Google or a code sent by email. An educational tool, not financial or tax advice.</span>
    <a class="mono" style="color:var(--amber);font-weight:500;font-size:10.5px" href="https://retcalc.app/dashboard">retcalc.app/dashboard</a>
  </div>
</section>`;

const css = `<style>
  .band { background: var(--g-ground); color: var(--g-text); padding: 30px 44px 24px; position: relative; overflow: hidden; height: ${BAND}px; }
  .band h1 { font-size: 38px; letter-spacing: -0.04em; line-height: 1.02; margin: 20px 0 0; max-width: 520px; }
  .band p { font-size: 12px; color: var(--g-muted); max-width: 470px; margin: 11px 0 0; line-height: 1.5; }
  .band .kick { font-size: 11px; font-weight: 600; color: var(--g-muted); letter-spacing: .02em; padding-left: 10px; margin-left: 2px; border-left: 1px solid var(--g-rule); }
    .band .phone { position: absolute; right: 52px; top: ${BAND - PHONE_CUT}px; width: ${PHONE_W}px; }
  .clip { overflow: hidden; border-radius: 10px; }
  .clip img { display: block; max-width: none; }
  .trow { display: flex; gap: ${GAP}px; margin-bottom: 13px; }
  .tn { font-weight: 700; font-size: 11.5px; margin-top: 5px; }
  .tl { font-size: 9.3px; line-height: 1.4; }
  .bottom { display: flex; gap: 22px; margin-top: 4px; }
  .tabs { columns: 2; column-gap: 16px; }
  .tab { font-size: 9.2px; padding: 3.2px 0; border-bottom: 1px solid var(--rule); break-inside: avoid; white-space: nowrap; }
  .also { width: 200px; flex: none; display: flex; flex-direction: column; gap: 8px; font-size: 9.3px; line-height: 1.42; padding-top: 19px; }
  .footline { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; padding: 0 44px; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--rule); font-size: 9px; }
</style>`;

const head = `<!doctype html><html><head><meta charset="utf-8"><title>RetCalc — Dashboard One-Pager</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">${css}</head><body>`;
fs.writeFileSync(new URL('./dash-onepager.html', import.meta.url), head + one + '</body></html>');
console.log('wrote dash-onepager.html');
