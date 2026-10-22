// Builds the RetCalc marketing package (package.html) and the one-pager
// (onepager.html). Rendered to PDF by render.mjs.
import fs from 'fs';
import { coverFan, centuryChart, LOGO } from './charts.mjs';

const C = '../shots/crops/';
const GROUP = {
  calc: { name: 'Calculators', color: 'var(--amber)' },
  income: { name: 'Retirement income', color: 'var(--sky)' },
  saving: { name: 'Saving and investing', color: 'var(--teal)' },
  everyday: { name: 'Everyday money', color: 'var(--lavender)' },
  guide: { name: 'Guided walkthroughs', color: 'var(--rose)' },
  story: { name: 'Putting it together', color: 'var(--amber)' },
  build: { name: 'Under the hood', color: 'var(--gray)' },
};

/* ---------- helpers ---------- */
const dims = (f) => { const b = fs.readFileSync(new URL(C + f + '.png', import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
/** A horizontal slice of a screenshot, from fraction t to fraction b of its height, at full container width. */
const region = (f, t, b, style = '') => { const [w, h] = dims(f); return `<div class="crop" style="aspect-ratio:${w}/${(h * (b - t)).toFixed(1)};${style}"><img src="${C}${f}.png" style="width:100%;margin-top:-${((t * h) / w * 100).toFixed(3)}%"></div>`; };
const img = (f, style = '', cls = 'shot') => `<img class="${cls}" src="${C}${f}.png" style="${style}">`;
const crop = (f, h, style = '', pos = 'top') => `<div class="crop" style="height:${h}px;${style}"><img src="${C}${f}.png" style="object-fit:cover;object-position:${pos};height:100%;width:100%"></div>`;
const browser = (f, url, h, style = '') => `<div class="browser" style="${style}"><div class="bar"><i></i><i></i><i></i><a class="url" href="https://${url}">${url}</a></div><div style="height:${h}px;overflow:hidden"><img src="${C}${f}.png"></div></div>`;
/** A fixed-height window onto a screenshot shown at width w, starting at fraction `start` of its height. */
const cropAt = (f, h, w, start) => { const [iw, ih] = dims(f); const dh = ih * (w / iw); const off = Math.min(start * dh, Math.max(dh - h, 0)); return `<div class="crop" style="height:${h}px"><img src="${C}${f}.png" style="width:100%;margin-top:-${off.toFixed(1)}px"></div>`; };
const browserRegion = (f, url, t, b) => `<div class="browser"><div class="bar"><i></i><i></i><i></i><a class="url" href="https://${url}">${url}</a></div>${region(f, t, b, 'border-radius:0')}</div>`;
const cap = (b, t) => `<div class="cap"><b>${b}</b><span>${t}</span></div>`;
const ticks = (xs, cls = '') => `<ul class="ticks ${cls}">${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`;
const stats = (xs) => `<div class="stats">${xs.map(([n, l, a]) => `<div class="stat"><div class="n ${a ? 'amber' : ''}">${n}</div><div class="l">${l}</div></div>`).join('')}</div>`;
const logo = (size = 18, word = true) => `<span class="logo">${LOGO(size)}${word ? '<span>RetCalc</span>' : ''}</span>`;

const pages = []; // {html, toc?}
function page(body, { dark = false, sec = null, sub = '', toc = null, foot = true, cls = '' } = {}) {
  const pn = pages.length + 1;
  const g = sec ? GROUP[sec] : null;
  const head = g ? `<div class="runhead"><span class="sec"><span class="dot" style="background:${g.color}"></span><span style="color:${g.color}">${g.name}</span>${sub ? `<span>· ${sub}</span>` : ''}</span><a href="https://retcalc.app">retcalc.app</a></div>` : '';
  const footer = foot ? `<div class="foot"><a class="brand" href="https://retcalc.app">${logo(14)}<span>The complete retirement planning toolkit.</span></a><span class="pn">${String(pn).padStart(2, '0')}</span></div>` : '';
  pages.push({ html: `<section class="page ${dark ? 'dark' : ''} ${cls}">${head}${body}${footer}</section>`, toc, pn });
  return pn;
}

/* Tool page: header, a side column of text, and the visuals. */
let toolNo = 0;
function toolPage(t) {
  const g = GROUP[t.group];
  const n = t.group === 'calc' || t.group === 'guide' ? t.num : String(++toolNo).padStart(2, '0');
  const label = t.group === 'calc' || t.group === 'guide' ? t.kicker : `Tool ${n} of 14`;
  const body = `
  <div class="tool-head">
    <div style="flex:1">
      <h1 class="title" style="margin-top:0">${t.name}</h1>
      <div class="q">${t.q}</div>
      <p class="lede">${t.desc}</p>
    </div>
    <div style="text-align:right">
      <div class="num">${n}</div>
      <a class="mono muted" style="display:block;font-size:9.5px;margin-top:10px" href="https://retcalc.app/${t.route}">retcalc.app/${t.route}</a>
    </div>
  </div>
  ${t.body}`;
  return page(body, { sec: t.group, sub: label, toc: { group: t.group, name: t.name, sub: t.q } });
}
const side = (secs) => `<div class="side">${secs.map(([h, x]) => `<section><h4>${h}</h4>${Array.isArray(x) ? ticks(x, 'sm') : `<p>${x}</p>`}</section>`).join('')}</div>`;

/* =====================================================================
   COVER
   ===================================================================== */
const fan = coverFan(708, 330);
page(`
  <div style="display:flex;flex-direction:column;height:100%;padding-bottom:46px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span class="logo" style="font-size:20px;gap:10px">${LOGO(30)}<span>RetCalc</span></span>
      <span class="mono" style="font-size:10px;color:var(--g-muted);letter-spacing:.08em">PRODUCT OVERVIEW · OCTOBER 2026</span>
    </div>
    <div style="margin-top:118px">
      <h1 style="font-size:78px;letter-spacing:-0.045em;line-height:.95">The complete<br><span style="color:var(--g-amber)">retirement<br>planning</span> toolkit.</h1>
      <p style="font-size:16px;color:var(--g-muted);max-width:470px;margin-top:22px;line-height:1.5">A calculator, two guided walkthroughs and fourteen planning tools, each checked against every market since 1926. Free, and you don't need an account.</p>
    </div>
    <div style="margin-top:auto">
      ${fan.svg}
      <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:9.5px;color:var(--g-muted)">
        <span>Every 30-year stretch since 1926 for a 60/40 portfolio, after inflation. The amber line is the middle one.</span>
        <a class="mono" style="color:var(--g-text)" href="https://retcalc.app">retcalc.app</a>
      </div>
    </div>
  </div>`, { dark: true, foot: false });

/* =====================================================================
   CONTENTS (filled in after every page is laid out)
   ===================================================================== */
const TOC_AT = pages.length;
pages.push(null);

/* =====================================================================
   PART 1: OVERVIEW
   ===================================================================== */
function opener(k, title, intro, list) {
  return page(`
  <div class="opener" style="padding-bottom:60px">
    <div class="idx">PART ${k}</div>
    <div class="big">${title}</div>
    <p style="font-size:15px;color:var(--g-muted);max-width:520px;margin-top:22px;line-height:1.55">${intro}</p>
    <ol>${list}</ol>
  </div>`, { dark: true, toc: { part: k, name: title.replace(/<br>/g, ' ') } });
}
const OPEN1 = pages.length;
pages.push(null); // opener 1, filled once page numbers are known

// O1: What RetCalc is
page(`
  <div style="margin-top:14px">
    <div class="eyebrow">What it is</div>
    <h1 class="title" style="font-size:44px;max-width:640px">A whole retirement plan, worked out in your own browser.</h1>
    <p class="lede" style="font-size:14px;max-width:660px">RetCalc is a free retirement planning toolkit at <a href="https://retcalc.app"><b style="color:var(--text)">retcalc.app</b></a>. It takes someone from their first paycheck to their last withdrawal: what to save, where to put it, whether it will last, what it will cost in tax and health insurance, and when to claim Social Security. Every projection is tested against real market history, month by month, back to 1926.</p>
  </div>
  <div style="margin-top:18px">${browser('home_view', 'retcalc.app', 360)}</div>
  <div style="margin-top:22px">${stats([['14', 'planning tools, in three groups', 1], ['3', 'calculators: Basic, Advanced and Stages'], ['2', 'guided walkthroughs that end in a printable plan'], ['100', 'years of monthly market history, 1926 to 2025'], ['$0', 'no ads, no paywall, no account needed']])}</div>
  <div class="row" style="margin-top:20px">
    <div class="col"><div class="h3">For someone starting out</div><p class="muted">What a paycheck really takes home, a budget that adds up, and how today's saving grows into a retirement income.</p></div>
    <div class="col"><div class="h3">For someone getting close</div><p class="muted">When to claim, how to cover the years before 59½ and 65, whether to convert to Roth, and what the best plan looks like.</p></div>
    <div class="col"><div class="h3">For someone already retired</div><p class="muted">How much is safe to spend, which withdrawal rule to follow, and how the plan would have fared in the worst markets on record.</p></div>
  </div>`, { sec: null, toc: { group: 'ov', name: 'What RetCalc is' } });

// O2: How it works
const cent = centuryChart(400, 290);
page(`
  <div style="margin-top:14px">
    <div class="eyebrow">How it works</div>
    <h1 class="title" style="font-size:38px">Three ideas run through every page.</h1>
  </div>
  <div style="display:grid;grid-template-columns:44px 1fr;gap:6px 16px;margin-top:22px">
    <div class="mono amber" style="font-size:26px;font-weight:500">1</div>
    <div>
      <div class="h3" style="font-size:18px">One household, every tool.</div>
      <p class="muted" style="font-size:11.5px;max-width:600px">Ages, state, savings, income and spending are entered once and fill in everywhere. Results also carry forward: the Calculator hands its balance to the Drawdown Simulator, Income Tax hands its paycheck to the Budget, and the Budget's savings split goes to the Advanced or Stages calculator.</p>
      ${hubDiagram()}
    </div>
    <div class="mono amber" style="font-size:26px;font-weight:500;margin-top:30px">2</div>
    <div style="margin-top:30px">
      <div class="h3" style="font-size:18px">Tested against history, not one average.</div>
      <div class="row" style="gap:18px;align-items:flex-start">
        <div style="width:270px;flex:none">
          <p class="muted" style="font-size:11.5px">A single average return hides the order returns come in, and that order decides whether a retirement lasts. RetCalc replays every real starting month since January 1926: the Depression, 1970s stagflation, 2000 and 2008. Where history runs out, it runs 5,000 Monte Carlo simulations per redraw.</p>
          <p class="muted" style="font-size:11.5px">One dollar in US stocks in January 1926 grew to about <b style="color:var(--text)">$${Math.round(cent.end).toLocaleString()}</b> after inflation by the end of 2025, in the same data the tools use. The shaded years are when it didn't feel that way.</p>
        </div>
        <div style="flex:1">${cent.svg}<div class="cap" style="margin-top:2px"><b>US stocks after inflation, dividends reinvested.</b><span>Log scale. Shiller (Yale) and BLS CPI-U.</span></div></div>
      </div>
    </div>
    <div class="mono amber" style="font-size:26px;font-weight:500;margin-top:30px">3</div>
    <div style="margin-top:30px">
      <div class="h3" style="font-size:18px">Private by default.</div>
      <p class="muted" style="font-size:11.5px;max-width:610px">Every calculation runs in the visitor's own browser, and nothing they type is sent anywhere. An account is optional: signing in with a one-time email code or Google simply keeps a household, saved scenarios and Guide answers in step across devices. As the site puts it, <i>"Nothing leaves your browser unless you sign in to save it."</i></p>
    </div>
  </div>`, { toc: { group: 'ov', name: 'How it works' } });

function hubDiagram() {
  const W = 620, H = 180, cx = W / 2, cy = 90, lw = 150, rw = 168;
  const left = [[24, 'Calculator', 'var(--amber)'], [90, 'Readiness Guide', 'var(--rose)'], [156, 'Paycheck to Retirement', 'var(--rose)']];
  const right = [[24, 'Retirement income tools', 'var(--sky)'], [90, 'Saving and investing tools', 'var(--teal)'], [156, 'Everyday money tools', 'var(--lavender)']];
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:8px">`;
  for (const [y] of left) s += `<path d="M${lw + 1},${y} C${(lw + cx - 86) / 2},${y} ${(lw + cx - 86) / 2},${cy} ${cx - 86},${cy}" fill="none" stroke="#cfcac0" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  for (const [y] of right) s += `<path d="M${cx + 86},${cy} C${(cx + 86 + W - rw) / 2},${cy} ${(cx + 86 + W - rw) / 2},${y} ${W - rw - 1},${y}" fill="none" stroke="#cfcac0" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  s += `<rect x="${cx - 86}" y="${cy - 34}" width="172" height="68" rx="12" fill="#f3e6cc" stroke="#e9d3a8"/>`;
  s += `<text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#17191c">Your household</text>`;
  s += `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-size="8.5" fill="#5b636e">ages · state · savings</text>`;
  s += `<text x="${cx}" y="${cy + 19}" text-anchor="middle" font-size="8.5" fill="#5b636e">income · spending</text>`;
  const pill = (x, y, w, t, c) => `<rect x="${x + 0.5}" y="${y - 13}" width="${w - 1}" height="26" rx="13" fill="#fff" stroke="#e3e0d8"/><circle cx="${x + 14}" cy="${y}" r="4" fill="${c}"/><text x="${x + 24}" y="${y + 3.5}" font-size="9.5" font-weight="600" fill="#17191c">${t}</text>`;
  for (const [y, t, c] of left) s += pill(0, y, lw, t, c);
  for (const [y, t, c] of right) s += pill(W - rw, y, rw, t, c);
  return s + '</svg>';
}

// O3: The path through the site
page(`
  <div style="margin-top:14px">
    <div class="eyebrow">Where to start</div>
    <h1 class="title" style="font-size:38px">A tool for every stage of the road.</h1>
    <p class="lede">The tools follow the order life brings the questions. Most people start with the Calculator or one of the two guided walkthroughs, which open the right tools along the way.</p>
  </div>
  ${journey()}
  <div class="row" style="margin-top:22px;gap:18px">
    <div class="col card">
      <div class="label" style="color:var(--rose)">Guided walkthrough</div>
      <div class="h3">Retirement Readiness Guide</div>
      <p class="muted">A check-up in twelve short cards (about ten minutes) or a full walkthrough. It finds the number to aim for, tests it against history, scores readiness out of 100, and ends in a full-color report of about a dozen pages.</p>
    </div>
    <div class="col card">
      <div class="label" style="color:var(--rose)">Guided walkthrough</div>
      <div class="h3">Paycheck to Retirement</div>
      <p class="muted">Five steps, about fifteen minutes: from gross pay to take-home, a budget, where each paycheck goes (401(k), HSA, IRA, brokerage), and where that saving leads by retirement, children included.</p>
    </div>
    <div class="col card">
      <div class="label" style="color:var(--amber)">Calculator</div>
      <div class="h3">Basic, Advanced and Stages</div>
      <p class="muted">Six questions for a quick answer; then fees, taxes, account types and a target; then a plan in stages, each with its own saving, return and length.</p>
    </div>
  </div>
  <div style="margin-top:20px">${browserRegion('tools_compact_full', 'retcalc.app/tools', 0.165, 0.665)}</div>
  ${cap('The tool list, compact view.', 'All fourteen tools in their three groups, each with the question it answers.')}`, { toc: { group: 'ov', name: 'A tool for every stage' } });

function journey() {
  const cols = [
    ['Today', 'Get the basics right', 'var(--lavender)', ['Income Tax', 'Budget', 'Debt Payoff', 'Mortgage Calculator', 'Rent vs. Buy']],
    ['Saving years', 'Grow it', 'var(--teal)', ['Calculator<br><span style="font-weight:400;color:var(--muted)">Basic · Advanced · Stages</span>', 'FIRE Calculator', 'Portfolio Backtest', 'College Savings']],
    ['Getting close', 'Plan the handoff', 'var(--sky)', ['Social Security Calculator', 'Healthcare Cost Planner', 'Early Retirement Bridge', 'Roth Conversion Calculator', 'Retirement Plan Optimizer']],
    ['Retired', 'Make it last', 'var(--sky)', ['Drawdown Simulator', 'Roth Conversion Calculator', 'Healthcare Cost Planner']],
  ];
  const W = 708;
  let s = `<div style="position:relative;margin-top:26px">`;
  s += `<svg viewBox="0 0 ${W} 40" width="100%" style="display:block"><defs><linearGradient id="road" x1="0" x2="1"><stop offset="0" stop-color="#7541b8"/><stop offset=".35" stop-color="#1f8f7e"/><stop offset=".7" stop-color="#2f7fc4"/><stop offset="1" stop-color="#9a6200"/></linearGradient></defs>
    <rect x="0" y="17" width="${W - 14}" height="6" rx="3" fill="url(#road)"/><path d="M${W - 16},8 L${W},20 L${W - 16},32 Z" fill="#9a6200"/>
    ${[0, 1, 2, 3].map((i) => `<circle cx="${12 + i * 180}" cy="20" r="9" fill="#faf9f6" stroke="#17191c" stroke-width="2"/><text x="${12 + i * 180}" y="23.5" text-anchor="middle" font-size="9.5" font-weight="700">${i + 1}</text>`).join('')}
    </svg>`;
  s += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:8px">`;
  for (const [t, sub, c, xs] of cols) {
    s += `<div><div style="font-size:15px;font-weight:700">${t}</div><div class="muted" style="font-size:10px;margin-bottom:10px">${sub}</div>`;
    s += xs.map((x) => `<div style="display:flex;align-items:flex-start;gap:7px;padding:7px 9px;margin-bottom:6px;border-radius:8px;background:#fff;border:1px solid var(--rule);font-size:10px;font-weight:500;line-height:1.4"><span class="dot" style="background:${x.startsWith('Calculator') ? 'var(--amber)' : c};width:7px;height:7px;margin-top:4px"></span><span>${x}</span></div>`).join('');
    s += `</div>`;
  }
  return s + `</div></div>`;
}

// O4: Highlights
page(`
  <div style="margin-top:14px">
    <div class="eyebrow">Highlights</div>
    <h1 class="title" style="font-size:38px">Six places to see what it can do.</h1>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 20px;margin-top:16px">
    ${hl('Stages calculator', 'A savings plan in stretches: early career, kids at home, peak earning, coasting. Each stage has its own saving, return and volatility, chained into one projection and tested three ways.', crop('stages_chart_mc', 160, '', 'center 62%'))}
    ${hl('Drawdown Simulator', 'Fifteen withdrawal strategies replayed through every retirement since 1926, then ranked against each other at the same level of risk.', crop('drawdown_1_historicalmonte-carl', 160, '', 'left center'))}
    ${hl('Income Tax', '2026 federal, state (all 50 plus DC) and FICA tax on a salary, or a retirement mode that stacks withdrawals, gains and Social Security the way the return really does.', cropAt('incometax_1_after-taxtake-homere', 160, 314, 0.205))}
    ${hl('Budget and Paycheck', 'A budget, then a paycheck that pays it: taxes rerun live as sliders move money into the 401(k) match, HSA, IRA and brokerage, in the order you choose.', cropAt('budget_1_where-it-goes', 160, 314, 0.345))}
    ${hl('Retirement Readiness Guide', 'A check-up that scores readiness out of 100, tests the plan against history and prints a report of about a dozen pages.', reportFan(160))}
    ${hl('Paycheck to Retirement', 'Gross pay to retirement in five steps, running the real tools inside it and copying the results into them at the end.', crop('plan_paycheck_3_where-the-rest-goes', 160, '', 'left top'))}
  </div>`, { toc: { group: 'ov', name: 'Highlights' } });

function hl(name, text, vis) {
  return `<div><div style="background:var(--raised);border-radius:14px;padding:12px">${vis}</div><div class="h3" style="margin-top:9px">${name}</div><p class="muted" style="font-size:10.5px">${text}</p></div>`;
}
function reportFan(h) {
  const ps = ['report_p00', 'report_p02', 'report_p04', 'report_p05', 'report_p08'];
  return `<div style="height:${h}px;position:relative">${ps.map((p, i) => `<img src="${C}${p}.png" style="position:absolute;height:${h - 8}px;top:4px;left:${8 + i * 58}px;border-radius:3px;border:1px solid rgba(23,25,28,.14);transform:rotate(${(i - 2) * 2.2}deg)">`).join('')}</div>`;
}

// O5: Every tool at a glance
const TOOLS = JSON.parse(fs.readFileSync(new URL('./tools.json', import.meta.url), 'utf8'));
page(`
  <div style="margin-top:14px">
    <div class="eyebrow">At a glance</div>
    <h1 class="title" style="font-size:38px">Every tool, and the question it answers.</h1>
  </div>
  <div style="margin-top:14px">
    ${glanceGroup('calc', [['Calculator: Basic', 'What will my savings grow to?'], ['Calculator: Advanced', 'Will I reach my target, after fees and tax?'], ['Calculator: Stages', 'What if my saving changes over the years?']])}
    ${glanceGroup('income', TOOLS.income)}
    ${glanceGroup('saving', TOOLS.saving)}
    ${glanceGroup('everyday', TOOLS.everyday)}
    ${glanceGroup('guide', [['Retirement Readiness Guide', 'How ready am I, and what should I do next?'], ['Paycheck to Retirement', 'Where should each paycheck go?']])}
  </div>
  <div class="card raised" style="margin-top:4px">
    <div class="label">Also on the site</div>
    <p style="font-size:11px;margin:0">29 plain-English articles, each with worked examples the test suite checks against the calculator, so the numbers in the writing always match the numbers in the tools.</p>
  </div>`, { toc: { group: 'ov', name: 'Every tool at a glance' } });

function glanceGroup(g, xs) {
  const G = GROUP[g];
  return `<div style="margin-bottom:22px"><div style="display:flex;align-items:center;gap:8px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${G.color};padding-bottom:5px;border-bottom:2px solid ${G.color}"><span class="dot" style="background:${G.color}"></span>${G.name}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;column-gap:24px">${xs.map(([n, q]) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid var(--rule);font-size:11.5px"><b>${n}</b><span class="muted" style="text-align:right">${q}</span></div>`).join('')}</div></div>`;
}

/* =====================================================================
   PART 2: DEEP DIVE
   ===================================================================== */
const OPEN2 = pages.length;
pages.push(null);

// Calculators: Basic and Advanced
toolPage({
  group: 'calc', num: 'B·A', kicker: 'Calculator 1 and 2 of 3', name: 'Basic and Advanced', route: 'calculator', q: 'What will my savings grow to, and will it be enough?',
  desc: 'The Calculator comes in three depths. Basic answers in six questions; Advanced adds what a real plan has to carry: fees, inflation, account types, an employer match, 2026 taxes and a target to reach.',
  body: `
  <div class="row" style="margin-top:16px;gap:20px">
    <div style="width:250px;flex:none">
      <div class="label">Basic · six questions</div>
      ${img('calculator_0_how-old-are-you-yrs-', 'width:100%')}
      <p class="muted" style="font-size:10px;margin-top:8px">Age, retirement age, savings, how much and how often, and one of five risk levels. Out comes the balance at retirement in today's dollars and the income it could pay.</p>
    </div>
    <div class="col">
      ${img('calculator_1_balance-over-time', 'width:100%')}
      ${cap('Basic.', 'The answer, what built it, and a band for better and worse returns with milestones along the line.')}
    </div>
  </div>
  <div class="rule" style="margin:14px 0 12px"></div>
  <div class="row" style="gap:20px">
    <div style="width:250px;flex:none">
      <div class="label">Advanced · the whole plan</div>
      ${ticks(['Traditional, Roth, brokerage and HSA balances, each with its own contribution', 'Employer match, contribution growth, fees and a glide path', 'Filing status and state set the tax in retirement', 'Solve for an after-tax income or a portfolio value', '<b>Reach your target:</b> the contribution or the years it would take, applied in one click', 'Chart three ways: a rate band, every historical window since 1926, or 5,000 Monte Carlo runs'], 'sm')}
    </div>
    <div class="col">
      ${region('advanced_chart_mc', 0, 0.8)}
      ${cap('Advanced, Monte Carlo.', 'Percentile bands across 5,000 runs, against the plan without volatility.')}
    </div>
  </div>`,
});

// Stages
toolPage({
  group: 'calc', num: 'S', kicker: 'Calculator 3 of 3', fav: true, name: 'Stages calculator', route: 'stages', q: 'What if my saving changes over the years?',
  desc: 'Real plans come in stretches. Stages chains them into one projection: each stage has its own length, contribution, raises, return, volatility, glide path and account split.',
  body: `
  <div style="margin-top:16px">${browser('stages_view', 'retcalc.app/stages', 200)}</div>
  <div class="row" style="margin-top:16px;gap:20px">
    <div style="width:236px;flex:none">
      ${side([
        ['What makes it different', ['Any number of named stages, sized by their years on a stage bar', 'A <b>Planning for kids</b> builder rebuilds the stages around the children you have or plan', 'Stage boundaries drawn right on the chart', 'Solves the final stage for you: the contribution, or the length, that reaches the target']],
        ['Tested three ways', 'A ±rate band, every rolling window since 1926 with a stock mix that can glide, and 5,000 Monte Carlo runs with volatility set per stage.'],
        ['Hands off to', 'The Drawdown Simulator, to see how long the balance lasts once spending starts.'],
      ])}
    </div>
    <div class="col">
      ${img('stages_hist_45000', 'width:100%')}
      ${cap('Sample plan, every historical window since 1926.', 'Early career, kids at home, peak earning, then coasting. Dashed lines mark each new stage.')}
      <div style="margin-top:10px">${img('stages_6_stage-by-stage', 'width:100%')}</div>
    </div>
  </div>`,
});

const T = (o) => toolPage(o);

// --- Retirement income ---
T({ group: 'income', fav: true, name: 'Drawdown Simulator', route: 'drawdown', q: 'Will my money last?',
  desc: 'Most calculators ask how much you will have. This one asks the harder question: once you start spending it, will it last? It replays a plan through every real retirement since 1926, month by month, with Social Security, pensions, annuities and one-time costs.',
  body: `
  <div style="margin-top:14px">${img('drawdown_1_historicalmonte-carl', 'width:100%')}</div>
  <div class="row" style="margin-top:12px;gap:18px;align-items:flex-start">
    <div style="width:236px;flex:none"><div class="label">15 strategies, five families</div>${strategies()}</div>
    <div class="col">${region('drawdown_2_every-historical-sta', 0.125, 0.76)}${cap('Every historical starting month.', 'Percentile bands across 835 real 30-year retirements, each start drawn in gray.')}</div>
  </div>
  <div class="row" style="margin-top:12px;gap:14px">
    <div class="col">${region('drawdown_cmp_3_strategy-showdown', 0.2, 0.425)}${cap('Strategy showdown.', 'All 15 tuned to the same risk, then compared on lifetime spending and what is left.')}</div>
    <div class="col">${region('drawdown_safe_4_success-grid', 0.18, 0.80)}${cap('Success grid.', 'Withdrawal rate against stock share. Click a cell to use it.')}</div>
  </div>` });

function strategies() {
  const fam = [
    ['Steady income', ['Fixed, rising with inflation (4% rule)', 'Kitces ratchet']],
    ['Share of portfolio', ['Fixed percentage', '95% rule (Clyatt)', '1/N', 'RMD method', 'Variable percentage (VPW)']],
    ['Guardrails', ['Guyton-Klinger', 'Risk-based guardrails']],
    ['Smoothed', ['Floor and ceiling', 'Vanguard dynamic spending', 'Yale endowment', 'Hebeler Autopilot II', 'Sensible withdrawals']],
    ['Valuation', ['CAPE-based']],
  ];
  return fam.map(([f, xs]) => `<div style="margin-bottom:6px"><div style="font-size:9.5px;font-weight:700;color:var(--sky)">${f}</div><div style="font-size:9.5px;line-height:1.45">${xs.join(' · ')}</div></div>`).join('');
}

T({ group: 'income', name: 'Retirement Plan Optimizer', route: 'optimizer', q: 'Which plan leaves me the most?',
  desc: 'Thousands of combinations of Social Security claiming ages, withdrawal order, Roth conversions and income guards, each run through every market since 1926, to find the plan that leaves the most, lasts the longest or spends the most.',
  body: `
  <div style="margin-top:14px">${img('optimizer_2_left-for-you-and-you', 'width:100%')}</div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['How it searches', 'Every pair of claiming ages from 62 to 70 for a couple (81 pairs), crossed with how far to fill each bracket with conversions and whether to stay under the IRMAA and ACA income lines. In the sample above that came to <b>4,941 plans</b> in <b>66 historical retirements</b>: 326,106 retirements simulated.'],
        ['Three goals', ['Leave the most', 'Make it last', 'Spend the most']],
        ['What you get', ['How much each kind of change adds', 'A year-by-year roadmap in plain words', 'Tax and premiums against the usual way', 'Close runners-up, so the choice isn\'t a black box']],
      ])}
    </div>
    <div class="col">
      ${img('optimizer_3_what-makes-the-diffe', 'width:100%')}
      <div style="margin-top:10px">${img('optimizer_5_where-each-year-s-mo', 'width:100%')}</div>
      ${cap('Where each year\'s money comes from.', 'Social Security, traditional, brokerage, and what is converted to Roth.')}
    </div>
  </div>` });

T({ group: 'income', name: 'Social Security Calculator', route: 'social-security', q: 'When should I claim Social Security?',
  desc: 'What the check will be at every age from 62 to 70, how it is figured, and which age pays off best depending on how long you live. Written as a sentence to fill in; works for a single person or a couple.',
  body: `
  <div style="margin-top:14px">${img('ss_1_pick-the-age-you-cla', 'width:100%')}</div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['You enter', ['Year born and pay, or pay year by year', 'A spouse, if there is one', 'Life expectancy', 'Other retirement income, to work out how much of the benefit is taxed']],
        ['You get', ['A staircase of checks by claiming age: click a step to pick it', 'Best age by lifespan, and the break-even', 'Survivor benefit and every pair of ages for couples', 'Year-by-year and side-by-side tables']],
      ])}
    </div>
    <div class="col">
      <div class="row" style="gap:12px">
        <div class="col">${img('ss_3_best-age-by-how-long', 'width:100%')}</div>
        <div class="col">${img('ss_4_when-waiting-pays-of', 'width:100%')}</div>
      </div>
      ${cap('Best age, by how long you live; and when waiting pays off.', '')}
    </div>
  </div>
  <div class="row" style="margin-top:12px;gap:14px"><div class="col">${region('ss_5_every-age-side-by-si', 0, 0.78)}</div><div style="width:220px;flex:none">${region('ss_6_year-by-year', 0, 0.78)}</div></div>
  ${cap('Every age, side by side; and year by year.', 'Sample: born 1990, earning $85,000.')}` });

T({ group: 'income', name: 'Early Retirement Bridge', route: 'bridge', q: 'How do I pay for the years before 59½?',
  desc: 'Retiring before 59½? It compares a Roth conversion ladder, 72(t) payments, the rule of 55, brokerage money and part-time work, with the tax, penalties and ACA premiums each costs, and shows what is left at 59½.',
  body: `
  <div style="margin-top:14px">${img('bridge_2_ways-to-59', 'width:100%;max-height:450px;object-fit:cover;object-position:top')}</div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['Routes compared', ['Roth conversion ladder', '72(t) / SEPP payments', 'Brokerage, then Roth contributions', 'Rule of 55', 'Part-time work', 'Paying the 10% penalty, as a benchmark']],
        ['Seven conversion fills', 'From none, through the standard deduction and the tops of the 10% and 12% brackets, to just under the ACA subsidy cliff.'],
        ['Tested against', 'Every start since 1926, or Monte Carlo.'],
      ])}
    </div>
    <div class="col">
      ${img('bridge_4_where-each-year-s-mo', 'width:100%')}
      ${cap('Where each year\'s money comes from,', 'from retirement to 59½.')}
    </div>
  </div>` });

T({ group: 'income', name: 'Roth Conversion Calculator', route: 'roth', q: 'Should I convert to Roth before RMDs start?',
  desc: 'Projects required minimum distributions to age 100, then tests a conversion schedule against doing nothing: lifetime tax, after-tax net worth, IRMAA surcharges and the survivor\'s higher bracket.',
  body: `
  <div style="margin-top:14px">${img('roth_1_converting-wins-on-b', 'width:100%')}</div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['Conversion strategies', ['Fill to a tax bracket', 'Fill to an IRMAA threshold', 'A fixed amount', 'A percentage of the balance', 'None, for comparison']],
        ['It accounts for', ['Social Security and its taxation', 'Tax paid from the taxable account', 'The survivor filing single after one spouse dies', 'Heirs\' tax rate on what is left', 'A discount rate for present value']],
      ])}
    </div>
    <div class="col">
      ${img('roth_3_traditional-balance', 'width:100%')}
      ${cap('Traditional balance,', 'converting against doing nothing.')}
      <div style="margin-top:8px">${region('roth_4_converting-vs-not', 0, 0.56)}</div>
    </div>
  </div>` });

T({ group: 'income', name: 'Healthcare Cost Planner', route: 'healthcare', q: 'What will health insurance cost before and after Medicare?',
  desc: 'ACA marketplace premiums and subsidies for the gap before Medicare, then Medicare Part B, Part D, Medigap and IRMAA surcharges by income, on 2026 rules.',
  body: `
  <div style="margin-top:14px">${img('hc95_1_aca-premium-before-6', 'width:100%')}</div>
  <div class="row" style="margin-top:12px;gap:14px">
    <div class="col">${region('hc95_2_before-65-the-aca-br', 0, 0.545)}</div>
    <div class="col">${region('hc95_3_from-65-medicare', 0, 0.545)}</div>
  </div>
  ${cap('Sample couple retiring at 60,', 'with $95,000 of income: just over the subsidy cliff, so the full ACA premium until 65, then Medicare.')}
  <div class="row" style="margin-top:14px;gap:20px;align-items:flex-start">
    <div style="width:236px;flex:none">${region('hc95_0_income', 0, 0.64)}</div>
    <div class="col">${side([['You enter', ['Retirement age, status and household size', 'State and income in retirement (MAGI)', 'Social Security, if any, and your own quote']]])}${side([['Why it matters', 'Before 65, the subsidy depends on income, so how a retiree draws money down can change the premium by thousands. The planner shows the household\'s share of the poverty line, warns near the subsidy cliff, and compares plan tiers. From 65 it prices Part B, Part D and Medigap, with the IRMAA tier income puts you in.']])}</div>
  </div>` });

// --- Saving and investing ---
T({ group: 'saving', name: 'FIRE Calculator', route: 'fire', q: 'When does work become optional?',
  desc: 'Finds the age a portfolio reaches financial independence. Coast FIRE mode finds the moment you could stop contributing and let growth carry you the rest of the way.',
  body: `
  <div style="margin-top:14px">${img('fire_hist_1_rate-bandhistoricaly', 'width:100%')}</div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['You enter', ['Age, savings and monthly saving', 'Return and inflation', 'Spending and withdrawal rate', 'FIRE or Coast FIRE']],
        ['Historical mode', 'Runs every rolling window since 1926. A success-rate slider then gives a second answer: the age reached in, say, 90% of history.'],
      ])}
    </div>
    <div class="col">
      ${img('fire_hist_2_portfolio-growth', 'width:100%')}
      ${cap('Portfolio growth,', 'every historical window since 1926.')}
    </div>
  </div>` });

T({ group: 'saving', name: 'Portfolio Backtest', route: 'backtest', q: 'What would this mix have actually done?',
  desc: 'Pick a mix of stocks, small-cap value, bonds and cash, then see what it actually did: return, volatility, the worst year, the deepest fall, and every rolling window back to 1926.',
  body: `
  <div style="margin-top:14px">${region('backtest_1_return-per-year9-65-', 0, 0.66)}</div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['You choose', ['Stocks, small-cap value, bonds and cash', 'Rebalancing yearly, every few years, or by band', 'Any span from 1926 to 2025, with one-tap eras']],
        ['You see', ['Return per year, before and after inflation', 'Volatility and the deepest fall', 'Growth of $10,000', 'Rolling returns and how prices multiplied', 'Every year in a table']],
      ])}
    </div>
    <div class="col">
      ${img('backtest_2_growth-of-10-000', 'width:100%')}
    </div>
  </div>
  <div style="margin-top:10px">${region('backtest_3_rolling-returns', 0, 0.62)}${cap('Rolling returns.', 'The best, worst and typical result for every holding period, from every start since 1926.')}</div>` });

T({ group: 'saving', name: 'College Savings', route: 'college', q: 'How much should I save for college?',
  desc: 'How much to save each month to cover tuition, with presets for a public in-state school, a private college and an elite one, and room for several children sharing one account.',
  body: `
  <div style="margin-top:14px">${img('college_1_save-per-month-558fo', 'width:100%')}</div>
  <div style="margin-top:10px">${img('college_2_savings-over-time', 'width:100%')}${cap('Savings over time', 'against the cost when college starts. Sample: one child, 18 years away, public in-state preset.')}</div>
  <div class="row" style="margin-top:14px;gap:20px">
    <div class="col">${side([['Presets, per year', ['Public in-state, about $27,000', 'Private non-profit, about $59,000', 'Elite, about $82,000', 'Or a custom figure']]])}</div>
    <div class="col">${side([['You enter', ['Years until college, and years in it', 'What is already saved', 'Return and tuition inflation', 'Each child, if there is more than one']]])}</div>
    <div class="col">${side([['You get', ['The monthly saving needed, stepping down for younger children', 'The total projected cost', 'What is needed today, or when college starts']], ['Source', 'College Board, Trends in College Pricing, updated each year.']])}</div>
  </div>` });

T({ group: 'saving', name: 'Rent vs. Buy', route: 'rentbuy', q: 'Should I rent or buy?',
  desc: 'Compares a buyer\'s and a renter\'s net worth over any horizon, counting what the down payment could have earned invested and what the home gains in value.',
  body: `
  <div style="margin-top:14px">${img('rentbuy_2_net-worth-over-time', 'width:100%')}</div>
  <div style="margin-top:10px">${region('rentbuy_1_each-month-to-start', 0, 0.8)}${cap('Each month, to start:', 'the buyer\'s costs beside the renter\'s, and which side is ahead.')}</div>
  <div class="row" style="margin-top:14px;gap:20px">
    <div class="col">${side([['It counts', ['Price, down payment, rate and term', 'Property tax, insurance and maintenance', 'Closing and selling costs']]])}</div>
    <div class="col">${side([['And', ['Rent, and how fast it rises', 'Home appreciation and investment return', 'Tax on gains']]])}</div>
    <div class="col">${side([['The verdict', 'Which side is ahead after the chosen number of years, by how much, and the year the lines cross.']])}</div>
  </div>` });

// --- Everyday money ---
T({ group: 'everyday', fav: true, name: 'Income Tax', route: 'incometax', q: 'How much tax will I owe?',
  desc: '2026 federal, state and FICA tax on a salary, or a retirement mode that shows what a year of withdrawals costs across traditional, Roth, brokerage and Social Security.',
  body: `
  <div class="row" style="margin-top:14px;gap:14px">
    <div class="col">${img('incometax_1_after-taxtake-homere', 'width:100%')}${cap('Working.', '$100,000 salary, single, Illinois.')}</div>
    <div class="col">${img('incometax_ret_1_after-taxtake-homere', 'width:100%')}${cap('Retired.', '$100,000 from four sources, 65+.')}</div>
  </div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['Covers', ['Federal brackets, standard or itemized deduction', 'Social Security tax per earner up to the $184,500 wage base, Medicare and the 0.9% surtax', 'All 50 states plus DC, with their retirement-income rules', 'Pre-tax deductions by kind and by earner: 401(k), IRA, HSA, premiums']],
        ['Retirement mode adds', ['Long-term gains stacked into the 0/15/20% bands', 'The 3.8% net investment income tax', 'Taxable Social Security (the 0/50/85% tiers)', 'The 2026 senior deduction', 'A true marginal rate, from rerunning the whole return with $1,000 more']],
      ])}
    </div>
    <div class="col">
      ${img('incometax_ret_2_your-capital-gain-an', 'width:100%')}
      <div style="margin-top:8px">${region('incometax_ret_3_where-each-dollar-ca', 0, 0.74)}</div>
    </div>
  </div>` });

T({ group: 'everyday', fav: true, name: 'Budget', route: 'budget', q: 'Where does my money go?',
  desc: 'Lay out the expenses, then see how each paycheck covers them and where the rest goes. Two tabs: a Budget, and a Paycheck that turns gross pay into taxes, bills and savings, line by line.',
  body: `
  <div class="row" style="margin-top:14px;gap:14px;align-items:flex-start">
    <div style="width:250px;flex:none">${crop('budget_1_where-it-goes', 300, '', 'top')}${cap('Budget tab.', '18 lines in six groups, monthly or yearly.')}</div>
    <div class="col">${img('budget_pc_1_saved-and-invested-e', 'width:100%')}${cap('Paycheck tab.', 'Each check split into saving, taxes and expenses.')}
      <div style="margin-top:10px">${side([
        ['Three one-click plans', ['<b>The usual order:</b> match, emergency fund, HSA, Roth IRA, more 401(k), brokerage', '<b>Max tax breaks:</b> everything pre-tax first', '<b>Stay flexible:</b> money reachable before retirement']],
      ])}</div>
    </div>
  </div>
  <div class="row" style="margin-top:8px;gap:14px">
    <div class="col">${img('budget_pc_2_where-the-rest-goes', 'width:100%')}${cap('Where the rest goes.', 'Six lines, each capped at its 2026 limit; taxes rerun as the sliders move.')}</div>
    <div style="width:236px;flex:none">${side([
      ['Two incomes', 'Married with two incomes plans by the month, taxes the couple jointly, and gives each spouse their own pay schedule, 401(k) match and HSA limit.'],
      ['Connected', 'Opens in Income Tax; sends the savings split, by account type, to the Advanced or Stages calculator.'],
    ])}</div>
  </div>` });

T({ group: 'everyday', name: 'Debt Payoff', route: 'debt', q: 'Which debt should I pay off first?',
  desc: 'List what you owe, then watch avalanche and snowball race each other: payoff date, total interest, and exactly what ordering by motivation instead of rate costs.',
  body: `
  <div style="margin-top:14px">${img('debt_1_debt-freesep-20303y-', 'width:100%')}</div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['You get', ['The debt-free date and total interest', 'What it saves against paying minimums', 'Avalanche against snowball, with a verdict', 'The payoff order', 'A blended rate, minimums that don\'t cover interest, and what $100 more per month would do']],
      ])}
    </div>
    <div class="col">${img('debt_2_avalanche-vs-snowbal', 'width:100%')}</div>
  </div>
  <div style="margin-top:10px">${region('debt_3_what-you-owe-month-b', 0, 0.94)}${cap('What you owe, month by month.', 'Sample: a credit card, a store card, a car loan and a student loan, with $300 extra per month.')}</div>` });

T({ group: 'everyday', name: 'Mortgage Calculator', route: 'mortgage', q: 'What will the house cost each month?',
  desc: 'The full monthly payment, how the balance falls, and amortization year by year, with extra payments, a recast or a refinance to compare against the loan as it stands.',
  body: `
  <div style="margin-top:14px">${img('mx_2_extra-payments-and-r', 'width:100%')}${cap('Sample:', '$450,000 at 7.25%, plus $300 per month, $10,000 in month 24, and a refinance to 6.25%.')}</div>
  <div class="row" style="margin-top:12px;gap:18px">
    <div style="width:236px;flex:none">
      ${side([
        ['What-ifs', ['Extra every month, or a lump sum', 'Recast, or keep the payment and finish early', 'Refinance, with the break-even']],
        ['Defaults', 'The rate starts at Freddie Mac\'s weekly survey, checked each quarter.'],
      ])}
    </div>
    <div class="col">${region('mx_3_loan-balance-and-wha', 0, 0.9)}</div>
  </div>` });

// --- Guides ---
toolPage({
  group: 'guide', num: 'G1', kicker: 'Walkthrough 1 of 2 · page 1', fav: true, name: 'Retirement Readiness Guide', route: 'guide', q: 'How ready am I, and what should I do next?',
  desc: 'A guided check-up. It finds the number to aim for, tests the plan against every market since 1926, scores readiness out of 100 and lists the moves that matter, in the order that matters.',
  body: `
  <div style="margin-top:14px">${browser('guide_number_view', 'retcalc.app/guide', 330)}</div>
  <div class="row" style="margin-top:16px;gap:20px">
    <div class="col">
      <div class="h3">Two paces</div>
      <div class="row" style="gap:12px;margin-top:6px">
        <div class="col card raised"><div class="label amber">Quick check · about 10 min</div><p style="font-size:10px">Twelve short cards, three questions at most on each. The number by the sixth card, then a test of whether it lasts. Defaults stand in for the details, and every one says so.</p></div>
        <div class="col card raised"><div class="label amber">Full walkthrough · an hour or more</div><p style="font-size:10px">Every card, with trips into the tools that find the numbers you don't know: children, raises, a paid-off mortgage. It saves as you go.</p></div>
      </div>
      <div class="h3" style="margin-top:14px">Seven chapters</div>
      ${chapters()}
    </div>
    <div style="width:250px;flex:none">
      <div class="h3">The readiness score</div>
      ${scoreBars()}
      <p class="muted" style="font-size:9.5px;margin-top:6px">On track at 85 and up, then Nearly there, Getting there, Needs work and Needs attention. A confidence line says how many answers were entered, estimated or defaulted.</p>
    </div>
  </div>`,
});

function chapters() {
  const xs = ['You and your timeline', 'Where you stand', 'Building your savings', 'What retirement costs', 'Will it last', 'Make it stronger', 'Your plan and toolkit'];
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-top:6px">${xs.map((x, i) => `<div style="display:flex;gap:8px;align-items:center;font-size:10px;padding:4px 0;border-bottom:1px solid var(--rule)"><span class="mono" style="color:var(--rose);font-weight:500">0${i + 1}</span>${x}</div>`).join('')}</div>`;
}
function scoreBars() {
  const xs = [['Retirement outlook', 40, 'Full marks when the plan lasted in 95% of history'], ['Savings rate', 20, '15% of gross income, or a plan that already lasts'], ['Emergency fund', 15, 'Six months of spending in cash'], ['Debt', 15, 'Nothing owed at 8% or more, besides a mortgage'], ['Monthly cash flow', 10, 'Spend no more than 80% of take-home']];
  return xs.map(([n, w, d]) => `<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600"><span>${n}</span><span class="mono">${w}</span></div><div style="height:7px;border-radius:4px;background:var(--raised);margin:3px 0"><div style="height:100%;width:${w * 2.5}%;background:var(--rose);border-radius:4px"></div></div><div class="muted" style="font-size:9px">${d}</div></div>`).join('');
}

toolPage({
  group: 'guide', num: 'G1', kicker: 'Walkthrough 1 of 2 · page 2', name: 'The plan, on paper', route: 'guide/report', q: 'A full-color report in your own numbers.',
  desc: 'The Guide ends in a report of about a dozen US Letter pages, built in the browser and saved as a PDF: what you will have, how it holds up against every market since 1926, Social Security, taxes and health insurance, and the next moves. Below, the report for a sample couple, 38 and 36, retiring at 62.',
  body: `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px 12px;margin-top:18px">
    ${Array.from({ length: 12 }, (_, i) => `<img src="${C}report_p${String(i).padStart(2, '0')}.png" style="width:100%;display:block;border-radius:3px;${'border:1px solid rgba(23,25,28,.14)'}">`).join('')}
  </div>`,
});

toolPage({
  group: 'guide', num: 'G2', kicker: 'Walkthrough 2 of 2', fav: true, name: 'Paycheck to Retirement', route: 'guide/paycheck', q: 'Where should each paycheck go?',
  desc: 'For anyone who would rather get straight to the numbers. Five steps, about fifteen minutes: take-home pay after tax, a budget, where each paycheck goes, and where that saving leads by retirement, children included.',
  body: `
  <div style="margin-top:14px">${steps5()}</div>
  <div style="margin-top:8px">${img('plan_paycheck_0_gross-pay-3-654per-p', 'width:100%')}${cap('The running totals', 'stay pinned above every step: pay per check, taxes, spending, saving and what is left.')}</div>
  <div class="row" style="margin-top:14px;gap:16px">
    <div class="col">${img('plan_paycheck_2_saved-and-invested-e', 'width:100%')}${cap('Step 2, Paycheck.', 'Each check, split.')}
      <div style="margin-top:8px">${img('plan_paycheck_4_itemized-paycheck', 'width:100%')}${cap('The itemized paycheck,', 'per check, per month and per year.')}</div>
    </div>
    <div class="col">${img('plan_paycheck_3_where-the-rest-goes', 'width:100%')}${cap('Where the rest goes.', 'Pick a plan or move the sliders.')}
      <div style="margin-top:10px">${side([
        ['It runs the real tools', 'Budget, Advanced and Stages run inside the walkthrough on its own copy of the numbers, so nothing in the standalone tools changes until <b>Copy into my tools</b> sends the results to Income Tax, Budget, Advanced and Stages.'],
        ['It ends in a report', 'Cover, the paycheck, the spending, the saving, the road to retirement, life stages if used, and the assumptions.'],
      ])}</div>
    </div>
  </div>`,
});

function steps5() {
  const xs = [['Start', 'Ages, filing status, pay and state'], ['Budget', 'Spending, line by line'], ['Paycheck', 'Tax, then 401(k), HSA, IRA, brokerage'], ['Your plan', 'The Advanced calculator, seeded'], ['Life stages', 'Optional: Stages, with children'], ['Summary', 'Copy into my tools']];
  return `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0">${xs.map(([t, d], i) => `<div style="padding:10px 10px 10px 0;border-top:3px solid ${i ? 'var(--rose)' : 'var(--rule-strong)'};margin-right:6px"><div class="mono" style="font-size:9px;color:var(--rose)">${i ? 'STEP ' + i : 'START'}</div><div style="font-weight:700;font-size:12px;margin:2px 0">${t}</div><div class="muted" style="font-size:9.5px;line-height:1.35">${d}</div></div>`).join('')}</div>`;
}

function calendar() {
  // [label, light months, strong months] (0 = Jan). From upkeep/items.json.
  const rows = [
    ['Federal tax, limits', [10, 11], [0]], ['Social Security', [9, 10, 11], [0]], ['Medicare, ACA', [9, 10, 11], [0]],
    ['State tax', [], [1, 2]], ['Market history', [], [1, 2]], ['Today\'s CAPE', [], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
    ['Rates, law watch', [], [0, 3, 6, 9]], ['College, children', [], [9, 10]], ['Housing defaults', [], [2]],
  ];
  const lw = 82, cw = 12.6, rh = 15, W = lw + cw * 12, H = 16 + rows.length * rh;
  let s = `<svg viewBox="0 0 ${W} ${H + 14}" width="100%" style="display:block">`;
  'JFMAMJJASOND'.split('').forEach((m, i) => { s += `<text x="${lw + i * cw + cw / 2}" y="10" font-size="7.5" fill="#5b636e" text-anchor="middle">${m}</text>`; });
  rows.forEach(([l, light, strong], r) => {
    const y = 16 + r * rh;
    s += `<text x="0" y="${y + 9.5}" font-size="8" fill="#17191c">${l}</text>`;
    for (let i = 0; i < 12; i++) {
      const c = strong.includes(i) ? '#9a6200' : light.includes(i) ? '#e9d3a8' : '#f0ede6';
      s += `<rect x="${lw + i * cw + 1}" y="${y}" width="${cw - 2}" height="${rh - 3}" rx="2" fill="${c}"/>`;
    }
  });
  s += `<rect x="${lw}" y="${H + 4}" width="8" height="8" rx="2" fill="#e9d3a8"/><text x="${lw + 11}" y="${H + 11}" font-size="7.5" fill="#5b636e">prepare</text>`;
  s += `<rect x="${lw + 52}" y="${H + 4}" width="8" height="8" rx="2" fill="#9a6200"/><text x="${lw + 63}" y="${H + 11}" font-size="7.5" fill="#5b636e">update or switch</text>`;
  return s + '</svg>';
}

/* =====================================================================
   PUTTING IT TOGETHER: one household through four tools, by their own hand-off buttons
   (tooling/story.mjs captured every screen below in one browser session)
   ===================================================================== */
const step = (n, tool, route, title) => `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px"><span class="mono amber" style="font-size:22px;font-weight:500;line-height:1">${n}</span><div><a class="label" style="margin:0;display:block" href="https://retcalc.app/${route}">${tool}</a><div class="h3" style="font-size:16px;margin:2px 0 0">${title}</div></div></div>`;
const handoff = (button, carried) => `<div style="display:flex;align-items:center;gap:12px;margin:14px 0;padding:9px 14px;border-radius:10px;background:var(--raised)"><svg width="18" height="18" viewBox="0 0 18 18" style="flex:none"><path d="M9 2v12M3 9l6 6 6-6" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="mono" style="font-size:10px;font-weight:500;padding:3px 8px;border-radius:6px;background:#fff;border:1px solid var(--rule)">${button}</span><span style="font-size:10.5px">${carried}</span></div>`;
page(`
  <div style="margin-top:14px">
    <div class="eyebrow">One household, start to finish</div>
    <h1 class="title" style="font-size:38px">From a paycheck to a retirement that lasts.</h1>
    <p class="lede">A sample couple, carried through four tools by the tools' own buttons. Nothing was typed twice: each tool handed its answer to the next. Every figure on these two pages is from the live site.</p>
  </div>
  <div style="margin-top:14px">${stats([['34 and 32', 'Alex and Jordan, in Illinois'], ['$160,000', '$92,000 and $68,000 pay, per year', 1], ['$60,000', 'saved so far'], ['2', 'children planned, the first in two years'], ['65', 'when Alex retires, 31 years out']])}</div>
  <div class="row" style="margin-top:18px;gap:20px">
    <div style="width:236px;flex:none">
      ${step(1, 'Budget', 'budget', 'Where each paycheck goes')}
      <p class="muted" style="font-size:10.5px">Their budget goes in line by line, then both paychecks on the Paycheck tab. One click on <b style="color:var(--text)">The usual order</b> fills both 401(k) matches, an HSA, two Roth IRAs and more 401(k), and reruns their taxes as it goes.</p>
      <p class="muted" style="font-size:10.5px">They can save <b style="color:var(--text)">$1,803 per month</b>, 13.5% of pay, plus $457 per month from their employers.</p>
    </div>
    <div class="col">${img('st_pc_1_saved-and-invested-e', 'width:100%')}</div>
  </div>
  ${handoff('Copy to a calculator → Stages', 'carries <b>$832.35 every two weeks</b>, split by account type, with the salaries and the match.')}
  <div class="row" style="gap:20px">
    <div style="width:236px;flex:none">
      ${step(2, 'Stages', 'stages', 'Saving around the children')}
      <p class="muted" style="font-size:10.5px">The <b style="color:var(--text)">Planning for kids</b> builder turns one 31-year stage into nine, from <i>Before children</i> to <i>Empty nest</i>. Childcare and the teen years take the saving to nothing for 18 years; it comes back as the children leave.</p>
      <p class="muted" style="font-size:10.5px">At 65 that is <b style="color:var(--text)">$743,576 in today's dollars</b>, from $487,735 put in over 31 years.</p>
    </div>
    <div class="col">${region('st_stg_0_your-stages', 0.02, 0.214)}</div>
  </div>
`, { sec: 'story', sub: 'Page 1 of 2', toc: { group: 'story', name: 'One household, start to finish' } });

page(`
  <div class="row" style="gap:20px;margin-top:14px">
    <div style="width:236px;flex:none">
      <div class="label">Step 2, tested against history</div>
      <p class="muted" style="font-size:10.5px">The same plan run through all 829 31-year windows since 1926, with a dashed line where each stage begins. The median finish is <b style="color:var(--text)">$993,511</b>; the worst window, starting in 1951, still reaches $488,459.</p>
    </div>
    <div class="col">${region('st_stg_4_balance-over-time-in', 0.27, 0.8)}</div>
  </div>
  ${handoff('Test withdrawals → Drawdown Simulator', 'carries the portfolio: <b>$743,576</b>, the balance in today\'s dollars.')}
  <div class="row" style="gap:20px;margin-top:4px">
    <div style="width:236px;flex:none">
      ${step(3, 'Social Security Calculator', 'social-security', 'When to claim')}
      <p class="muted" style="font-size:10.5px">Born in 1992 and 1994, with the same pay. Claiming at 67, their full retirement age, brings <b style="color:var(--text)">$6,236 per month</b> together: $3,376 for Alex and $2,860 for Jordan, in today's dollars.</p>
      <p class="muted" style="font-size:10.5px">Waiting until 70 would add $810 per month and more over a long life; the calculator shows by how much at every age.</p>
    </div>
    <div class="col">${region('st_ss_1_pick-the-age-you-cla', 0, 0.8)}</div>
  </div>
  ${handoff('Copy from Social Security Calculator', 'carries both benefits into the Drawdown Simulator: <b>$40,506 and $34,323 per year</b>, starting at 67.')}
  <div class="row" style="gap:20px">
    <div style="width:236px;flex:none">
      ${step(4, 'Drawdown Simulator', 'drawdown', 'Will it last?')}
      <p class="muted" style="font-size:10.5px">From 65, the 4% rule draws <b style="color:var(--text)">$29,743 per year</b>, rising with inflation, and Social Security joins at 67. The plan is replayed through every monthly start since 1926, 835 of them, for 30 years each.</p>
    </div>
    <div class="col">${img('st_dd_1_historicalmonte-carl', 'width:100%')}</div>
  </div>
  <div style="margin-top:20px;padding:20px 22px;border-radius:14px;background:var(--g-ground);color:var(--g-text)">
    <div class="label" style="color:var(--g-amber)">Where Alex and Jordan land</div>
    <div class="row" style="gap:0;margin-top:8px">
      ${[['$104,573', 'per year in retirement, in today\'s dollars: $29,743 from savings and $74,830 from Social Security'], ['835 of 835', 'historical retirements lasted the full 30 years, the Depression and the 1970s included'], ['$1.5M', 'left at the end in the worst of them, in today\'s dollars']].map(([n, l], i) => `<div class="col" style="${i ? 'padding-left:18px;border-left:1px solid var(--g-rule);' : ''}padding-right:18px"><div style="font-size:30px;font-weight:700;letter-spacing:-0.03em;color:${i ? 'var(--g-text)' : 'var(--g-amber)'}">${n}</div><div style="font-size:10px;color:var(--g-muted);margin-top:4px;line-height:1.4">${l}</div></div>`).join('')}
    </div>
  </div>
  <p class="muted" style="font-size:9.5px;margin-top:10px">A sample household, not advice. Returns before retirement are the plan's own assumptions; the historical tests use real monthly returns from 1926 to 2025.</p>`, { sec: 'story', sub: 'Page 2 of 2', toc: { group: 'story', name: 'From claiming to drawdown' } });

/* =====================================================================
   PART 3: UNDER THE HOOD
   ===================================================================== */
const OPEN3 = pages.length;
pages.push(null);
const B = fs.readFileSync(new URL('./build-pages.html', import.meta.url), 'utf8').replace('__CALENDAR__', calendar()).split('<!--PAGE-->').filter((x) => x.trim());
const BUILD_TITLES = ['The stack', 'The calculation engine', 'Hosting and delivery', 'Accounts and privacy', 'Where the numbers come from'];
B.forEach((html, i) => page(html, { sec: 'build', toc: { group: 'build', name: BUILD_TITLES[i] } }));

// Back cover
page(`
  <div style="display:flex;flex-direction:column;height:100%;justify-content:center;align-items:flex-start;padding-bottom:80px">
    <span class="logo" style="font-size:28px;gap:14px">${LOGO(52)}<span>RetCalc</span></span>
    <h2 style="font-size:46px;margin-top:30px;letter-spacing:-0.035em">Find out where you stand.</h2>
    <p style="font-size:15px;color:var(--g-muted);margin-top:14px;max-width:460px">Free, private, and tested against every market since 1926.</p>
    <a class="mono" style="display:block;font-size:22px;color:var(--g-amber);margin-top:34px" href="https://retcalc.app">retcalc.app</a>
    <div style="margin-top:auto;font-size:9.5px;color:var(--g-muted);max-width:560px;line-height:1.55">RetCalc is an educational tool, not financial, tax or legal advice. Past returns don't predict future ones, and tax figures are estimates. Screenshots are from the live site on 22 October 2026 with sample households. Contact: <a href="mailto:contact@retcalc.app">contact@retcalc.app</a></div>
  </div>`, { dark: true, foot: false });

/* ---------- fill in the openers and contents ---------- */
const pn = (i) => i + 1;
const tocOf = (g) => pages.filter((p) => p && p.toc && p.toc.group === g);
const items = (xs) => xs.map((p) => `<li><a href="#p-${p.pn}"><span>${p.toc.name}</span><span>${String(p.pn).padStart(2, '0')}</span></a></li>`).join('');
function fillOpener(at, k, title, intro, list) {
  const tmp = pages.length;
  opener(k, title, intro, list);
  const op = pages.pop();
  const num = String(pn(at)).padStart(2, '0');
  op.pn = pn(at);
  op.html = op.html.replace(/<span class="pn">\d+<\/span>/, `<span class="pn">${num}</span>`);
  pages[at] = op;
}
const deepAll = pages.filter((p) => p && p.toc && ['calc', 'income', 'saving', 'everyday', 'guide', 'story'].includes(p.toc.group));
fillOpener(OPEN1, 1, 'The<br>overview.', 'Free, private, and tested against a hundred years of real markets.', items(tocOf('ov')));
fillOpener(OPEN2, 2, 'The<br>deep dive.', 'Every tool on the site, what it asks for and what it gives back.', items(deepAll));
fillOpener(OPEN3, 3, 'Under<br>the hood.', 'Next.js on Vercel, an engine that runs in the browser, accounts that only sync, and figures that each carry a source and a due date.', items(tocOf('build')));

// Contents
const groupsDeep = ['calc', 'income', 'saving', 'everyday', 'guide', 'story'];
function tocBlock(k, title, startPn, xs, showDots) {
  return `<div class="grp"><a class="grp-h" href="#p-${startPn}"><span class="k">${k}</span><h3>${title}</h3><span class="pg">${String(startPn).padStart(2, '0')}</span></a><div class="items">${xs.map((p) => `<a class="it" href="#p-${p.pn}">${showDots ? `<span class="d" style="background:${GROUP[p.toc.group].color}"></span>` : ''}<span>${p.toc.name}</span><span class="lead"></span><span class="pg">${String(p.pn).padStart(2, '0')}</span></a>`).join('')}</div></div>`;
}
const deep = pages.filter((p) => p && p.toc && groupsDeep.includes(p.toc.group));
const tocHtml = `
  <div style="margin-top:14px">
    <div class="eyebrow">Contents</div>
    <h1 class="title" style="font-size:40px">What's inside.</h1>
  </div>
  <div class="toc">
    ${tocBlock('01', 'The overview', pn(OPEN1), tocOf('ov'), false)}
    ${tocBlock('02', 'The deep dive', pn(OPEN2), deep, true)}
    ${tocBlock('03', 'Under the hood', pn(OPEN3), tocOf('build'), false)}
  </div>
  <div style="display:flex;gap:16px;margin-top:4px;font-size:9.5px" class="muted">${groupsDeep.map((g) => `<span style="display:flex;align-items:center;gap:6px"><span class="dot" style="background:${GROUP[g].color};width:7px;height:7px"></span>${GROUP[g].name}</span>`).join('')}</div>`;
const tocPn = pn(TOC_AT);
pages[TOC_AT] = { pn: tocPn, html: `<section class="page">${tocHtml}<div class="foot"><a class="brand" href="https://retcalc.app">${logo(14)}<span>The complete retirement planning toolkit.</span></a><span class="pn">${String(tocPn).padStart(2, '0')}</span></div></section>` };

/* ---------- write ---------- */
const head = `<!doctype html><html><head><meta charset="utf-8"><title>RetCalc — Product Overview</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css"></head><body>`;
// The PDF's bookmark sidebar: each part, with its pages under it (tooling/outline.py reads this).
const outline = [
  { title: 'Cover', page: 1 }, { title: 'Contents', page: tocPn },
  { title: 'Part 1 · The overview', page: pn(OPEN1), kids: tocOf('ov').map((p) => ({ title: p.toc.name, page: p.pn })) },
  { title: 'Part 2 · The deep dive', page: pn(OPEN2), kids: deep.map((p) => ({ title: p.toc.name, page: p.pn })) },
  ...(typeof STORY_GROUP !== 'undefined' ? [] : []),
  { title: 'Part 3 · Under the hood', page: pn(OPEN3), kids: tocOf('build').map((p) => ({ title: p.toc.name, page: p.pn })) },
  { title: 'Back cover', page: pages.length },
];
fs.writeFileSync(new URL('./outline.json', import.meta.url), JSON.stringify(outline, null, 1));
fs.writeFileSync(new URL('./package.html', import.meta.url), head + pages.map((p, i) => p.html.replace('<section class="page', `<section id="p-${i + 1}" class="page`)).join('\n') + '</body></html>');
console.log('pages', pages.length);

/* =====================================================================
   ONE-PAGER
   ===================================================================== */
const opTile = (name, line, vis) => `<div><div style="background:var(--raised);border-radius:10px;padding:8px;height:96px;overflow:hidden">${vis}</div><div style="font-weight:700;font-size:11.5px;margin-top:6px">${name}</div><div class="muted" style="font-size:9.3px;line-height:1.4">${line}</div></div>`;
const opGroup = (g, xs) => `<div><div style="display:flex;align-items:center;gap:6px;font-size:8.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${GROUP[g].color};padding-bottom:4px;border-bottom:1.5px solid ${GROUP[g].color};margin-bottom:3px"><span class="dot" style="background:${GROUP[g].color};width:6px;height:6px"></span>${GROUP[g].name}</div>${xs.map(([n, q]) => `<div style="font-size:9.2px;padding:2.5px 0;border-bottom:1px solid var(--rule)"><b>${n}</b> <span class="muted">· ${q}</span></div>`).join('')}</div>`;
const one = `<section class="page" style="padding:0">
  <div style="background:var(--g-ground);color:var(--g-text);padding:30px 44px 26px;--ds-brand-gold:#e9b872;--ds-brand-jade:#4fbf95;--ds-brand-steel:#7d9fd6;position:relative;overflow:hidden">
    <div style="position:absolute;right:-20px;bottom:-30px;opacity:.3">${coverFan(420, 170).svg}</div>
    <div style="position:relative">
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="logo" style="font-size:17px;gap:9px">${LOGO(26)}<span>RetCalc</span></span><a class="mono" style="font-size:11px;color:var(--g-amber)" href="https://retcalc.app">retcalc.app</a></div>
      <h1 style="font-size:40px;letter-spacing:-0.04em;line-height:1;margin-top:22px">The complete <span style="color:var(--g-amber)">retirement planning</span> toolkit.</h1>
      <p style="font-size:12px;color:var(--g-muted);max-width:440px;margin:12px 0 0;line-height:1.5">A calculator, two guided walkthroughs and fourteen planning tools for saving, withdrawals, taxes, Social Security and healthcare, each checked against every market since 1926. Free, private, and no account needed.</p>
    </div>
  </div>
  <div style="padding:14px 44px 0" class="op">
    ${stats([['14', 'planning tools', 1], ['3', 'calculators'], ['2', 'guided walkthroughs'], ['100 yrs', 'of monthly market history'], ['5,000', 'Monte Carlo runs per redraw'], ['$0', 'no ads, no account']])}
    <div class="row" style="gap:16px;margin-top:14px">
      ${[['One household, every tool', 'Ages, state, savings, income and spending are entered once and fill in everywhere; results carry from tool to tool.'], ['Tested against history', 'Plans are replayed through every real starting month since January 1926, the Depression and the 1970s included.'], ['Private by default', 'Every calculation runs in the browser. An optional account only syncs a household, scenarios and Guide answers.']].map(([h, t], i) => `<div class="col"><div style="display:flex;gap:8px;align-items:baseline"><span class="mono amber" style="font-size:15px;font-weight:500">${i + 1}</span><b style="font-size:11.5px">${h}</b></div><p class="muted" style="font-size:9.5px;margin:3px 0 0">${t}</p></div>`).join('')}
    </div>
    <div class="label" style="margin-top:12px">Highlights</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px 14px">
      ${opTile('Stages calculator', 'A savings plan in stretches, each with its own saving, return and volatility, tested three ways.', crop('stages_chart_mc', 80, '', 'center 62%'))}
      ${opTile('Drawdown Simulator', '15 withdrawal strategies replayed through every retirement since 1926, and ranked at equal risk.', crop('drawdown_1_historicalmonte-carl', 80, '', 'left center'))}
      ${opTile('Income Tax', '2026 federal, state (50 + DC) and FICA tax, or a retirement mode that stacks withdrawals, gains and Social Security.', cropAt('incometax_1_after-taxtake-homere', 80, 206, 0.205))}
      ${opTile('Budget and Paycheck', 'A budget, then a paycheck that pays it, with taxes rerun live as money moves into the 401(k), HSA and IRA.', cropAt('budget_1_where-it-goes', 80, 206, 0.345))}
      ${opTile('Retirement Readiness Guide', 'A check-up that scores readiness out of 100 and prints a report of about a dozen pages.', reportFan(80).replace(/left:\$\{8 \+ i \* 58\}px/g, ''))}
      ${opTile('Paycheck to Retirement', 'Gross pay to a retirement projection in five steps and about fifteen minutes.', crop('plan_paycheck_3_where-the-rest-goes', 80, '', 'left top'))}
    </div>
    <div class="label" style="margin-top:12px">Every tool</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
      <div style="display:flex;flex-direction:column;gap:10px">${opGroup('income', TOOLS.income)}</div>
      <div style="display:flex;flex-direction:column;gap:10px">${opGroup('saving', TOOLS.saving)}${opGroup('calc', [['Basic', 'six questions'], ['Advanced', 'fees, tax, accounts, a target'], ['Stages', 'saving that changes']])}</div>
      <div style="display:flex;flex-direction:column;gap:10px">${opGroup('everyday', TOOLS.everyday)}${opGroup('guide', [['Readiness Guide', 'score and report'], ['Paycheck to Retirement', 'five steps']])}</div>
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:40px;padding:0 44px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--rule);font-size:9px" class="muted">
    <span>Built on Next.js and a 5,700-line calculation engine; 2026 tax rules; market data from Shiller (Yale), BLS and the French Data Library.</span>
    <a class="mono" style="color:var(--amber);font-weight:500;font-size:10.5px" href="https://retcalc.app">retcalc.app</a>
  </div>
</section>`;
fs.writeFileSync(new URL('./onepager.html', import.meta.url), head.replace('RetCalc — Product Overview', 'RetCalc — One-Pager') + one + '</body></html>');
