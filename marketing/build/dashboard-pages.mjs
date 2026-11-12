// Part 2 of the marketing package: the Dashboard, tab by tab, then what runs
// across it (the report, the check-in email, the assumption rating, help,
// phones, privacy). build.mjs calls dashboardPart() with its page helpers.
// Screenshots: shots/dash/lt_* from tooling/dash.mjs and lt_x_* from
// tooling/pdfdash-extra.mjs (local build, sample household Sam and Jordan,
// daughter Nora, Illinois). Every figure quoted here was read off them.
import fs from 'fs';

const D = '../shots/dash/';
const dims = (f) => { const b = fs.readFileSync(new URL(D + f + '.png', import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

/** A rectangle of a screenshot (device pixels), shown at the container's width. */
function cut(f, x0, y0, x1, y1, style = '', cls = 'crop') {
  const [W, H] = dims(f); x1 = x1 ?? W; y1 = y1 ?? H;
  const w = x1 - x0, h = y1 - y0;
  return `<div class="${cls}" style="aspect-ratio:${w}/${h};${style}"><img src="${D}${f}.png" style="display:block;width:${(W / w * 100).toFixed(3)}%;max-width:none;margin-left:-${(x0 / w * 100).toFixed(3)}%;margin-top:-${(y0 / w * 100).toFixed(3)}%"></div>`;
}
/** A Dashboard tile capture (16 css px of page around the card), trimmed to a hair of page. */
const PAD = 26;
const tile = (f, style = '', y0 = 0, y1 = null) => { const [W, H] = dims(f); return cut(f, PAD, y0 ? y0 : PAD, W - PAD, y1 ?? H - PAD, style, 'crop tile'); };
/** A browser window around a rectangle of a full-page screenshot. */
const win = (f, url, x0, y0, x1, y1, style = '', over = '') => `<div class="browser" style="${style}"><div class="bar"><i></i><i></i><i></i><a class="url" href="https://${url}">${url}</a></div><div style="position:relative">${cut(f, x0, y0, x1, y1, 'border-radius:0')}${over}</div></div>`;
/** The rail is fixed to the window, so a full-page capture has it only for the first 900 css px; carry it on below that, as the browser shows it. */
const railTo = (from, h) => `<i style="position:absolute;left:0;top:${(from / h * 100).toFixed(3)}%;bottom:0;width:${(134 / 2880 * 100).toFixed(3)}%;background:rgb(251,251,253);border-right:${(2 / 2880 * 708).toFixed(2)}px solid rgb(227,227,232)"></i>`;
const img = (f, style = '') => `<img src="${D}${f}.png" style="display:block;width:100%;${style}">`;

const CSS = `<style>
.dp .side h4 { font-size: 9px; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 0 0 6px; }
.dp .side section { margin-bottom: 13px; }
.dp .side section:last-child { margin-bottom: 0; }
.dp .side p { font-size: 10.5px; }
.dp .crop.tile { border-radius: 14px; }
.dp .mini { display: flex; align-items: baseline; gap: 12px; margin: 0 0 4px; }
.dp .mini .n { font-size: 30px; font-weight: 500; color: var(--rule); letter-spacing: -0.04em; line-height: .8; }
.dp .mini h2 { font-size: 24px; letter-spacing: -0.025em; }
.dp .quote { font-size: 13px; line-height: 1.5; padding: 10px 14px; border-radius: 10px; background: var(--surface); border: 1px solid var(--rule); }
.dp .sheet { width: 100%; display: block; border: 1px solid rgba(29,29,31,.16); border-radius: 2px; }
.dp table.t td { padding-top: 5px; padding-bottom: 5px; }
.dp .flow text { font-family: var(--sans); }
</style>`;

export function dashboardPart(h) {
  const { page, cap, ticks, stats, side } = h;
  const P = (body, sub, name) => page(`<div class="dp">${body}</div>`, { sec: 'dash', sub, toc: { group: 'dash', name } });
  let first = true;
  const css = () => (first ? ((first = false), CSS) : '');

  /* A tab page's header: name, its question in amber, a short description, its place in the rail. */
  const head = (n, name, q, desc, route) => `${css()}
  <div class="tool-head">
    <div style="flex:1">
      <h1 class="title" style="margin-top:0">${name}</h1>
      <div class="q">${q}</div>
      <p class="lede">${desc}</p>
    </div>
    <div style="text-align:right">
      <div class="num">${n}</div>
      <a class="mono muted" style="display:block;font-size:9.5px;margin-top:10px" href="https://retcalc.app/${route}">retcalc.app/${route}</a>
    </div>
  </div>`;
  /* A half-page header, for two tabs on one page. */
  const mini = (n, name, q, desc) => `<div class="mini"><span class="n">${n}</span><h2>${name}</h2></div><div class="q" style="font-size:14.5px">${q}</div><p class="lede" style="font-size:11.5px;max-width:none">${desc}</p>`;
  /* A page that isn't one tab: eyebrow, title, lede. */
  const intro = (eyebrow, title, lede, size = 34) => `${css()}<div style="margin-top:14px"><div class="eyebrow">${eyebrow}</div><h1 class="title" style="font-size:${size}px">${title}</h1>${lede ? `<p class="lede" style="max-width:none">${lede}</p>` : ''}</div>`;

  /* ================= Opening spread ================= */

  // 1. What the Dashboard is
  P(`${intro('My Dashboard', 'A household\'s whole financial picture, in one place.', 'The Dashboard is a personal hub at <a href="https://retcalc.app/dashboard"><b style="color:var(--text)">retcalc.app/dashboard</b></a>. A household enters its numbers once, and fifteen tabs show net worth, pay, taxes, spending, saving and a retirement plan, all worked out from that one profile. It is made to be opened each month or quarter, to update the balances and see where the plan stands.', 36)}
  <div style="margin-top:16px">${win('lt_overview_full', 'retcalc.app/dashboard', 0, 0, 2880, 2039, '', railTo(1800, 2039))}</div>
  ${cap('The Dashboard tab for the sample household:', 'Sam, 42, and Jordan, 40, in Illinois, with their daughter Nora. Unless a caption says otherwise, every screenshot here is theirs.')}
  <div style="margin-top:12px">${stats([['15', 'tabs, all worked out from one profile', 1], ['14', 'planning tools that open inside it, filled in'], ['8', 'short setup steps at most, each one skippable'], ['1926', 'every month since is a test of the plan'], ['$0', 'a free account: no bank logins, no ads']])}</div>
  <div class="row" style="margin-top:16px">
    <div class="col"><div class="h3">Keeping track</div><p class="muted">Net worth by date, a budget, the paycheck after taxes and where each one goes, updated whenever the balances change.</p></div>
    <div class="col"><div class="h3">Planning retirement</div><p class="muted">Savings at retirement, the chance of success, Social Security, the years before 59½ and 65, and changes ahead.</p></div>
    <div class="col"><div class="h3">Two of you</div><p class="muted">Two incomes and two retirement ages, each person's accounts and benefit, and a filter on net worth for whose is whose.</p></div>
  </div>`, 'What it is', 'What the Dashboard is');

  // 2. One profile behind every tab
  P(`${intro('How it works', 'One profile behind every tab.', 'Each figure is set in one place. Every other tab lists it as a fact, with a link to where it is set, so the tabs can\'t disagree. Change a retirement age on Profile and the savings at retirement, the chance of success, the readiness score, the net worth chart and the report all move with it.')}
  <div style="margin-top:18px">${flowDiagram()}</div>
  <div class="row" style="margin-top:22px;gap:20px">
    <div class="col card">
      <div class="label amber">A free account</div>
      <div class="h3">Sign in once, on any device</div>
      <p class="muted" style="font-size:10.5px">The Dashboard needs an account: sign in with Google, or with a six-digit code sent by email. There are no passwords and no payments. Nothing is linked to a bank; a household types its own numbers. One account can hold several profiles, a couple's plan and a solo one, say.</p>
    </div>
    <div class="col card">
      <div class="label amber">What's stored, and where</div>
      <div class="h3">Saved to the browser, synced to the account</div>
      <p class="muted" style="font-size:10.5px">Every change is saved in the browser first, then synced so the Dashboard appears wherever its owner signs in, and only its owner can read it. The server stores it but never calculates with it: every figure is worked out in the browser.</p>
    </div>
    <div class="col card">
      <div class="label amber">What the account keeps</div>
      ${ticks(['Each profile, with every tab\'s choices', 'Dated net worth entries', 'Lessons read', 'The email address, an optional first name and the check-in setting'], 'sm')}
      <p class="muted" style="font-size:10px;margin-top:8px">Signing out removes the synced copy from that browser; the account keeps it. <b style="color:var(--text)">Download my data</b> and <b style="color:var(--text)">Delete my account</b> are on the account page.</p>
    </div>
  </div>
  <div style="margin-top:24px">
    <div class="label">Fifteen tabs, in the order of the rail</div>
    ${tabList()}
    <p class="muted" style="font-size:10px;margin-top:10px">A rail of icons runs down the left of every tab, with a dot on any tab that still has something to fill in. On a phone it becomes a tab bar along the bottom.</p>
  </div>`, 'How it works', 'One profile behind every tab');

  // 3. Setup
  P(`${intro('Getting started', 'Setup: up to eight short steps.', 'A new Dashboard starts with a guided setup. Each step asks one thing, saves the answer as it is typed and can be skipped. Beside the questions, <b style="color:var(--text)">Your plan so far</b> fills in, and once savings and a retirement age are in it draws the projection.')}
  <div style="margin-top:16px">${win('lt_x_setup_spend', 'retcalc.app/dashboard/setup', 0, 0, 2880, 1440)}</div>
  ${cap('Step 7 of 8, Spending.', 'The household, ages, retirement ages, pay and savings are in; the projection already reads $2.1M at retirement.')}
  <div class="row" style="margin-top:16px;gap:20px;align-items:flex-start">
    <div class="col">
      <table class="t">
        <tr><th style="width:18px">#</th><th style="width:74px">Step</th><th>What it asks</th></tr>
        ${[['Household', 'Just me, or me and a partner; children who depend on you, and any planned'], ['About you', 'First name, birth month and year for each person, so ages stay right'], ['Children', 'An optional name and birth month and year for each child'], ['Retirement', 'The age each person hopes to retire'], ['Pay', 'Where you live, and each person\'s pay, before or after taxes'], ['Savings', 'What\'s saved all together, and what goes in'], ['Spending', 'One number per month; a full budget comes later'], ['Home', 'Own (worth, left on the mortgage) or rent (rent per month)']].map(([s, a], i) => `<tr><td class="mono">${i + 1}</td><td>${s}</td><td>${a}</td></tr>`).join('')}
      </table>
      <p class="muted" style="font-size:9.5px;margin-top:6px">Children drops out for a household without children. <b style="color:var(--text)">Save and finish later</b> counts the steps not yet reached as skipped.</p>
    </div>
    <div style="width:300px;flex:none">
      ${cut('lt_setup_0', 340, 200, 1700, 830, 'border-radius:12px;border:1px solid var(--rule)')}
      ${cap('The finish screen.', 'Net worth today, savings at retirement and the chance of success; the plan pays about $7,800 per month to spend in retirement, with taxes on top.')}
      <div style="margin-top:14px">${side([['Then', '<b>Open my Dashboard</b> lands on the Dashboard tab, which welcomes a new user with a <i>Profile N of 10</i> bar. Tiles with nothing to show yet are dashed, each offering the one action that fills it.'], ['Skipped a step?', 'Profile shows a dot and Next steps lists <i>Finish setting up</i> until every step is answered.']])}</div>
    </div>
  </div>`, 'Getting started', 'Setup');

  /* ================= The tabs, in rail order ================= */

  // 01 Profile
  P(`${head('01', 'Profile', 'What does the plan know about us?', 'Every setup answer on one page, editable where it stands, plus the assumptions every figure uses. Edits save as they are made; a bar at the top says what changed and what it did to the plan, with Keep and Undo.', 'dashboard/profile')}
  <div class="row" style="margin-top:14px;gap:16px;align-items:flex-start">
    <div class="col">${tile('lt_profile__household')}</div>
    <div class="col">${tile('lt_profile__retirement')}<div style="height:8px"></div>${tile('lt_profile__saving')}</div>
  </div>
  <div style="margin-top:8px">${tile('lt_profile__assumptions')}</div>
  ${cap('Assumptions:', 'savings grow 4.5% per year after inflation until retirement; five presets run from 2% to 7%. Once retired, the plan runs through every market since 1926.')}
  <div class="row" style="margin-top:12px;gap:20px;align-items:flex-start">
    <div class="col">${side([
      ['Also on Profile', ['<b>Pay</b>, and <b>Home</b>: own or rent', '<b>Children ahead:</b> children planned, childcare, help with college and the kind of school', '<b>Email:</b> the monthly check-in, on or off', '<b>Reset</b>, asked twice; the rest of RetCalc is untouched']],
    ])}</div>
    <div class="col">${side([
      ['Profiles', 'One account can hold several plans: a couple\'s and a solo one, or a plan and a what-if. <b>New profile</b> starts fresh, through setup, or as a copy of the open one. Each can be renamed or deleted, and the one that\'s open is remembered on each device.'],
    ])}</div>
    <div style="width:196px;flex:none">${cut('lt_x_profile_new', 1124, 419, 1756, 1150, 'border-radius:12px;border:1px solid var(--rule)')}</div>
  </div>`, 'Tab 1 of 15', 'Profile and profiles');

  // 02 Dashboard
  P(`${head('02', 'Dashboard', 'Where do we stand today?', 'The home tab answers in one line, then shows the pieces: net worth across the whole plan, the readiness score, the chance of success, retirement income, Social Security, the withdrawal strategy, the emergency fund, the next steps and a timeline.', 'dashboard')}
  <div class="quote" style="margin-top:16px;font-size:14px"><b>You're on track:</b> $1,891,000 in savings at 60, and your plan lasted in every past market since 1926.</div>
  <div class="row" style="margin-top:10px;gap:10px;align-items:flex-start">
    <div style="flex:1.93">${tile('lt_overview__net-worth')}</div>
    <div style="flex:1">${tile('lt_overview__readiness-score')}<div style="height:6px"></div>${tile('lt_overview__chance-of-success')}</div>
  </div>
  <div class="row" style="margin-top:6px;gap:6px">${['retirement-income', 'social-security', 'withdrawal-strategy', 'emergency-fund'].map((t) => `<div class="col">${tile('lt_overview__' + t)}</div>`).join('')}</div>
  ${cap('Net worth today, $610,500,', 'up $51,865 since the last entry; $2.1M at retirement in 2044. After retirement the chart is the Retirement tab\'s own run through history: the median, the 25th to 75th and 10th to 90th percentiles, and a faint line for each starting year. Readiness: 96 of 100, on track. A tile with nothing to show yet is dashed and offers the one action that fills it.')}
  <div style="margin-top:14px">${tile('lt_overview__your-timeline')}</div>
  ${cap('Your timeline.', 'A lane for each person (work, retirement, Medicare, Social Security), one for Nora\'s college years and one for the mortgage. Today is the dashed line.')}`, 'Tab 2 of 15', 'Dashboard');

  // 03 Plan summary
  P(`${head('03', 'Plan summary', 'What does the whole plan come to?', 'The plan on one page: savings at retirement, what it pays and the tax on top, where each year\'s pay goes, health cover before Medicare, the budget and net worth. Folds open the climb to retirement, what the children cost, the readiness score and the timeline.', 'dashboard/summary')}
  <div style="margin-top:14px">${tile('lt_summary__your-plan')}</div>
  <div style="margin-top:6px">${tile('lt_summary__where-your-pay-goes')}</div>
  ${cap('Where your pay goes:', '$214,000 of pay per year: $48,333 in taxes, $93,600 of spending, $28,800 saved and invested, and $43,267 not yet assigned. The employer adds $6,420.')}
  <div style="margin-top:10px">${tile('lt_summary__health-cover-before-medicare')}</div>
  <div class="row" style="margin-top:6px;gap:8px;align-items:flex-start">
    <div class="col">${tile('lt_summary__your-budget')}
      <div style="margin-top:12px">${side([['Print your plan', 'The button on this tab and the Dashboard tab builds the printable report of the whole plan (see <i>The printable report</i>).'], ['How your assumptions compare', 'A fold on this page rates the plan\'s guesses against balanced ones.']])}</div>
    </div>
    <div class="col">${tile('lt_summary__net-worth-today')}</div>
  </div>
  <div style="margin-top:6px">${tile('lt_summary__readiness-score96-of-100show')}</div>
  ${cap('A fold, closed.', 'Saving to retirement, the readiness score and the timeline each open in place.')}`, 'Tab 3 of 15', 'Plan summary');

  // 04 Net worth
  P(`${head('04', 'Net worth', 'What do we own and owe, and how is it changing?', 'Balances are typed in, never linked to a bank, and saved as dated entries: each <b>Update balances</b> adds a point to the net worth line. The plan starts from the latest one.', 'dashboard/accounts')}
  <div style="margin-top:12px">${tile('lt_accounts__assets-and-debts')}</div>
  <div class="row" style="margin-top:6px;gap:8px;align-items:flex-start">
    <div class="col">${tile('lt_accounts__when-you-can-spend-it')}</div>
    <div class="col">${tile('lt_accounts__how-it-s-taxed')}</div>
  </div>
  ${cap('When you can spend it, and how it\'s taxed:', '$90,000 can be spent today without the 10% penalty, the rest at each owner\'s 59½ or, for the HSA, 65. 75% will be taxed when spent.')}
  <div class="row" style="margin-top:12px;gap:20px;align-items:flex-start">
    <div class="col">${tile('lt_accounts__assets')}</div>
    <div style="width:300px;flex:none">${side([
      ['It tracks', ['Whose each account is, with a filter for everyone, either of a couple, or what\'s shared', 'Nine kinds of assets, from a 401(k) or 457(b) to a home or a car', 'Five kinds of debt, each with its rate', 'A brokerage cost basis and Roth contributions, for the tax']],
      ['Over time', 'A switch turns the bars into the net worth line, with milestones and the growth per year. Entries download as CSV.'],
    ])}</div>
  </div>`, 'Tab 4 of 15', 'Net worth');

  // 05 Your home
  P(`${head('05', 'Your home', 'What does the house really cost?', 'For owners: the equity, when the mortgage is paid off and the interest still to pay, then the Mortgage Calculator run on their own loan, where property tax, insurance, upkeep and utilities become the budget\'s housing lines. Renters get their rent and the Rent vs. Buy Calculator, seeded with it.', 'dashboard/home')}
  <div style="margin-top:14px">${tile('lt_home__your-home')}</div>
  <div style="margin-top:6px">${tile('lt_home__mortgage')}</div>
  ${cap('The mortgage:', '$318,000 left at 4.25%, $2,150 per month, paid off in April 2044 with $133,500 of interest still to pay. It ends after Sam retires, so the plan keeps counting the payment through retirement.')}
  <div class="row" style="margin-top:14px;gap:20px;align-items:flex-start">
    <div style="width:236px;flex:none">${side([
      ['What owning costs', 'The Mortgage Calculator with the loan locked in from Net worth and the mortgage above. What is set here (property tax, insurance, PMI, HOA, upkeep, utilities) becomes the housing lines on Spending.'],
      ['Try things', ['Extra payments, each month or once', 'Recasting after a lump sum', 'A refinance, with its before and after']],
      ['Renting instead', 'Rent and renter\'s insurance per month, both budget lines, and Rent vs. Buy on your own rent.'],
    ])}<div style="margin-top:12px">${cut('lt_home__what-owning-costs', 30, 684, 872, 1236, 'border-radius:12px')}</div>${cap('Monthly costs,', 'beside the loan.')}</div>
    <div class="col">${cut('lt_home__what-owning-costs', 890, 183, 2640, 903, 'border-radius:14px')}${cap('$3,509 per month, everything included:', '$2,149 for the loan itself and $1,360 for tax, insurance, upkeep and utilities.')}<div style="height:8px"></div>${cut('lt_home__what-owning-costs', 890, 1281, 2640, 2225, 'border-radius:14px')}${cap('Loan balance and what you\'ve paid,', 'year by year to April 2044.')}</div>
  </div>`, 'Tab 5 of 15', 'Your home');

  // 06 Income + 07 Spending
  P(`${css()}<div style="margin-top:12px">${mini('06', 'Income', 'What comes in, and what will Social Security pay?', 'Each person\'s pay, the employer\'s 401(k) match, any other income, and Social Security: a benefit typed from the ssa.gov statement, estimated from today\'s pay or worked out from a pay history, with the age each of you claims and the share you expect.')}</div>
  <div style="margin-top:8px">${tile('lt_income__coming-in')}</div>
  <div style="margin-top:6px">${tile('lt_income__social-security')}</div>
  ${cap('Social Security, checked against a statement:', 'Sam $2,900 per month claimed at 67 in 2051, Jordan $2,100 at 67 in 2053. Claim ages are shared with Retirement, and the share expected scales every benefit in the plan.')}
  <div class="rule" style="margin:20px 0 16px"></div>
  ${mini('07', 'Spending', 'What do we spend, and what\'s left to save?', 'The Budget tool on the Dashboard\'s numbers: its total is spending on every tab. Setup\'s one number starts as a single line; housing lines come from Your home. It also sizes the emergency fund and can build a leaner emergency budget beside the normal one.')}
  <div style="margin-top:8px">${tile('lt_spending__each-month')}</div>
  ${cap('Each month:', '$7,800 of spending against $13,806 of income after taxes leaves $6,006 per month available to save. Nora\'s costs, $1,400 per month now, are part of it, and saving $527 per month from today would cover the share of college they plan to help with.')}
  <div class="row" style="margin-top:14px;gap:20px;align-items:flex-start">
    <div class="col">${side([['Employer match', 'Each employer\'s match and the share of pay it covers, with a line saying whether the household saves enough to get all of it. Both of theirs: 50% of the first 6%.']])}</div>
    <div class="col">${side([['Your budget', 'Lines in groups (housing, transportation, health, food, lifestyle, debt), each per month or per year, with CSV. Housing lines from Your home are locked and marked.']])}</div>
    <div class="col">${side([['Emergency fund', 'Six months of spending is typical: $46,800 here. A leaner emergency budget can sit beside the normal one, and the fund can be sized on either.']])}</div>
  </div>`, 'Tabs 6 and 7 of 15', 'Income and Spending');

  // 08 Taxes & Savings
  P(`${head('08', 'Taxes &amp; Savings', 'What do we pay in tax, and where should each paycheck go?', 'The paycheck, worked out line by line with 2026 federal, state and FICA tax, is the household\'s one tax calculator: its pay after taxes is the figure every tab uses. Below it, each dollar left after spending gets a place: the 401(k) match first, then an HSA, an IRA, more 401(k) or a brokerage account.', 'dashboard/savings')}
  <div class="row" style="margin-top:14px;gap:8px;align-items:flex-start">
    <div class="col">${tile('lt_savings__taxes-this-year')}</div>
    <div class="col">${tile('lt_savings__each-month')}</div>
  </div>
  ${cap('Taxes this year, $48,333:', '$23,084 federal, $8,878 Illinois and $16,371 FICA, 22.6% of pay. They save $2,400 per month, plus $535 from their employers: a savings rate of 16.5%.')}
  <div class="row" style="margin-top:14px;gap:20px;align-items:flex-start">
    <div style="width:214px;flex:none">${side([
      ['Start from a plan', ['<b>The usual order:</b> the match, an HSA, an IRA, more 401(k), then brokerage', '<b>Max tax breaks:</b> pre-tax first', '<b>Stay flexible:</b> money reachable before retirement']],
      ['Then adjust', 'A slider per line, each capped at its 2026 limit, with Max. Pre-tax lines lower the taxes above as they move; with two incomes the lines split between partners.'],
      ['Also here', 'The deduction, standard or itemized; a local income tax in the 14 states that have one; an itemized paycheck per check, month and year.'],
    ])}<div style="margin-top:14px">${cut('lt_savings__your-paychecks', 0, 12, 904, 648, 'border-radius:0')}</div></div>
    <div class="col">${tile('lt_savings__where-the-rest-goes')}${cap('Where the rest goes.', 'Both 401(k)s up to the match and $1,330 per month beyond it; $3,606 per month still unassigned.')}<div style="height:8px"></div>${tile('lt_savings__how-your-saving-grows')}</div>
  </div>`, 'Tab 8 of 15', 'Taxes and Savings');

  // 09 Year by year
  P(`${head('09', 'Year by year', 'How do the years to retirement add up?', 'Every year from now to retirement, worked out from pay with raises, taxes from the paycheck, spending, and saving by account up to each limit, with the children\'s costs and college taken out of saving in their years. Savings at retirement on every tab are built from these years.', 'dashboard/years')}
  <div style="margin-top:14px">${tile('lt_years__what-shapes-the-years')}</div>
  <div style="margin-top:6px">${tile('lt_years__every-year-to-retirement', '', PAD, 1186)}</div>
  ${cap('Every year to retirement, in today\'s dollars', '(or each year\'s own). In 2030 Nora becomes a teenager and saving dips; in 2035 college starts. Click a pay or spending figure to type your own, for one year or until retirement. CSV download.')}
  <div class="row" style="margin-top:12px;gap:8px">
    <div class="col">${tile('lt_years__income-and-spending')}</div>
    <div class="col">${tile('lt_years__where-each-year-s-income-goe')}</div>
  </div>`, 'Tab 9 of 15', 'Year by year');

  // 10 Calculator, page 1
  P(`${head('10', 'Calculator', 'What will our savings grow to, with the changes we see coming?', 'The Advanced calculator, run on the Dashboard\'s numbers. Balances, pay, taxes and inflation are listed with links to where they are set. What is set here (the changes ahead, fees, a goal, the mix) is saved with the plan, and the result becomes savings at retirement on every tab.', 'dashboard/calculator')}
  <div style="margin-top:14px">${win('lt_calculator_full', 'retcalc.app/dashboard/calculator', 0, 0, 2880, 1078)}</div>
  ${cap('$1,891,305 at 60 in today\'s dollars,', 'about $72,274 per year after tax, across five stages and 18 years.')}
  <div class="row" style="margin-top:14px;gap:20px;align-items:flex-start">
    <div style="width:240px;flex:none">
      ${cut('lt_calculator_full', 190, 1080, 1070, 1545, 'border-radius:12px')}
      ${cap('Changes ahead.', 'One so far: Nora, whose costs take $393K off savings at retirement.')}
      <div style="margin-top:10px">${side([['How changes work', 'Each change is plain English on screen and compiles to stages behind it, so every tab follows the plan with its changes in. A switch turns one off without deleting it.']])}</div>
    </div>
    <div style="width:198px;flex:none">${cut('lt_x_calc_add', 1044, 432, 1832, 1366, 'border-radius:12px;border:1px solid var(--rule)')}${cap('Add a change:', 'five kinds, each a form with a live sentence and its effect.')}</div>
    <div class="col">${side([
      ['Five kinds', ['<b>Pay changes:</b> a raise, a new job, part-time years or time off', '<b>Spend more or less</b>', '<b>Save less,</b> or stop, from an age on', '<b>A lump sum,</b> in or out of an account, on the day you turn an age', '<b>Different returns</b> from an age on']],
      ['Today\'s dollars', 'Every change, like every figure on the Dashboard, is in today\'s dollars.'],
    ])}</div>
  </div>
  <div style="margin-top:12px">${cut('lt_x_calc_view', 429, 640, 2452, 1022, 'border-radius:12px;border:1px solid var(--rule)')}</div>
  ${cap('View or edit:', 'every change on a lane by age, from today to retirement.')}`, 'Tab 10 of 15 · page 1', 'Calculator: changes ahead');

  // 10 Calculator, page 2
  P(`${intro('Calculator · the projection', 'Every year to retirement, tested three ways.', 'The same projection as the Advanced calculator on the site: a band of better and worse returns, every rolling window since 1926 with a mix of US stocks, small-cap value, bonds and cash, or 5,000 Monte Carlo simulations per redraw. A dashed line marks where each change starts.', 30)}
  <div class="row" style="margin-top:14px;gap:12px;align-items:flex-start">
    <div class="col">${tile('lt_x_calc_historical', '', PAD, 1330)}${cap('Historical:', '985 rolling 18-year windows since 1926, each starting year drawn in gray.')}</div>
    <div style="width:236px;flex:none">${tile('lt_calculator__balance-over-time-inflation-', '', PAD, 1190)}${cap('Rate band:', 'every stage 2% higher and lower.')}<div style="height:6px"></div>${tile('lt_x_calc_montecarlo', '', PAD, 1294)}${cap('Monte Carlo:', '5,000 runs at 15% volatility per year.')}</div>
  </div>
  <div class="row" style="margin-top:22px;gap:18px;align-items:center">
    <div class="col">${tile('lt_calculator__when-you-could-stop-saving')}</div>
    <div style="width:280px;flex:none">${side([['When you could stop saving', 'The earliest age saving could stop outright, the match included, and still reach the target. When there is one, <b>Add to my changes</b> makes it part of the plan. Sam and Jordan need to keep saving to 60.']])}</div>
  </div>
  <div class="row" style="margin-top:12px;gap:18px;align-items:flex-start">
    <div class="col">${tile('lt_calculator__by-account-type')}</div>
    <div style="width:236px;flex:none">${side([
      ['By account type', 'What each account holds at retirement, its share, the first year\'s withdrawal and the tax on it, with 2026 married-filing-jointly brackets and Illinois tax.'],
      ['Also on this screen', ['<b>Milestones:</b> when growth outpaces what goes in, and each round number', '<b>Stage by stage:</b> years, return, contributions and growth', 'A year-by-year table', 'CSV downloads, and full screen for the chart']],
    ])}</div>
  </div>`, 'Tab 10 of 15 · page 2', 'Calculator: the projection');

  // 11 Retirement, page 1
  P(`${head('11', 'Retirement', 'Will our money last, and how should we draw it down?', 'The Drawdown Simulator, run on the plan: savings at retirement from the Calculator, ages from Profile and Social Security from Income are listed, not typed. The chosen strategy\'s run through every historical starting month is the chance of success and the net worth chart on every tab.', 'dashboard/retirement')}
  <div style="margin-top:14px">${tile('lt_retirement__at-retirement')}</div>
  <div style="margin-top:6px">${tile('lt_x_ret_strategies', '', PAD, 833)}</div>
  ${cap('The withdrawal strategies, open:', 'eight of the fifteen, each with a line on how it decides what to spend. Sam and Jordan use Guyton-Klinger Guardrails; <b>How the withdrawal strategies compare</b> sets all fifteen side by side.')}
  <div class="row" style="margin-top:12px;gap:18px;align-items:flex-start">
    <div class="col">${cut('lt_retirement__your-drawdown', 892, 837, 2649, 2207, 'border-radius:14px')}</div>
    <div style="width:236px;flex:none">${side([
      ['Your drawdown', 'Every historical starting month: 751 of 751 since 1926 lasted 37 years, to ages 97 and 95. The median left $3,556,793; the worst, $1,279,567, never ran out.'],
      ['Chosen here, saved to the plan', ['The strategy and its settings: starting rate, guardrails, floors and ceilings', 'Years in retirement', 'The mix once retired: US stocks, small-cap value, bonds and cash, with an optional glide', 'The spending path']],
    ])}<div style="margin-top:12px">${cut('lt_retirement__your-drawdown', 892, 105, 2649, 711, 'border-radius:12px')}</div>${cap('Historical or Monte Carlo,', 'and a baseline to pin and compare against.')}</div>
  </div>`, 'Tab 11 of 15 · page 1', 'Retirement: drawdown');

  // 11 Retirement, page 2: bridge and health cover
  P(`${intro('Retirement · two more views', 'The years before 59½, and before Medicare.', 'A switch under <b style="color:var(--text)">At retirement</b> adds two views when they apply. <b style="color:var(--text)">Bridge to 59½</b> appears when someone retires before 401(k)s and IRAs open without the 10% penalty; <b style="color:var(--text)">Health cover</b> prices the years between the last paycheck and Medicare. To show the bridge, the household below has Sam retiring at 56 and Jordan at 58.', 30)}
  <div style="margin-top:14px">${win('lt_x_ret_bridge_full', 'retcalc.app/dashboard/retirement', 160, 940, 2880, 2380)}</div>
  ${cap('Bridge to 59½:', 'the Early Retirement Bridge on the plan, each year withdrawing what the chosen strategy does. The blended plan (the rule of 55, then Roth before brokerage) reaches 59½ in 100% of 97 starts since 1926, for $41,936 in tax and premiums, with $1,516,208 left at 59½. <b>Use this bridge plan</b> saves it to the plan.')}
  <div class="row" style="margin-top:16px;gap:18px;align-items:center">
    <div style="width:580px;flex:none">${cut('lt_x_ret_health_full', 1040, 1140, 2840, 1748, 'border-radius:14px')}</div>
    <div class="col">${side([['Health cover', 'The Healthcare Cost Planner on the plan. For the original household (work stops in 2048): about $629 per month for an ACA plan for 3 years, then Medicare at about $716 to $876 per month for the two of them.']])}</div>
  </div>
  <div class="row" style="margin-top:14px;gap:20px;align-items:flex-start">
    <div class="col">${side([['Routes to 59½', ['A Roth conversion ladder', '72(t) payments', 'The rule of 55, or a 457(b)', 'Brokerage, then Roth contributions', 'Part-time work, or paying the 10% penalty']]])}</div>
    <div class="col">${side([['Five markets', 'A picker follows the plan through the 90th, 75th, median, 25th and 10th percentile markets from history, ranked by what the strategy withdraws.']])}</div>
    <div class="col">${side([['Priced on the plan', 'ACA premiums and the subsidy before 65 use the plan\'s income that year; Medicare Part B, Part D and any IRMAA surcharge use its income at 65.']])}</div>
  </div>`, 'Tab 11 of 15 · page 2', 'Retirement: bridge, health cover');

  // 12 Tools
  P(`${head('12', 'Tools', 'What would the other tools say, with our numbers?', 'The site\'s tool list, led by the Advanced Calculator, with a line on each card from the plan. A tool opens inside the Dashboard with everything known filled in. It is a copy to try things on: changes there never change the plan.', 'dashboard/tools')}
  <div style="margin-top:14px">${win('lt_x_tools_compact_full', 'retcalc.app/dashboard/tools', 0, 0, 2880, 1690)}</div>
  ${cap('All 14 tools and the Advanced Calculator, compact view,', 'each with its question and a line from the plan: "Your plan: lasted in 100% of past markets", "Your taxes: $48,333 per year".')}
  <div class="row" style="margin-top:14px;gap:20px;align-items:flex-start">
    <div style="width:280px;flex:none">${side([
      ['Opened from here', ['Filled in from the plan, with the rail kept and a way back to the tab you came from', 'Saved scenarios, shared with the same tool on the site', 'Reset returns to the plan\'s figures']],
      ['One that writes back', '<b>College Savings</b> has <b>Apply to my plan</b>, which writes each child\'s cost, start and years into the profile.'],
    ])}</div>
    <div class="col">${cut('lt_x_tool_social', 0, 0, 2880, 1750, 'border-radius:12px;border:1px solid var(--rule)')}${cap('The Social Security Calculator, opened from Tools.', 'Birth years, pay and retirement ages come from the plan; the banner says where to change the plan itself.')}</div>
  </div>`, 'Tab 12 of 15', 'Tools');

  // 13 Next steps, 14 Learn, 15 About
  P(`${css()}<div style="margin-top:12px">${mini('13', 'Next steps', 'What should we do next?', 'A to-do list ranked by how much each step would raise the readiness score, each with a button to the tab that does it. Done steps move below; the top four also sit on the Dashboard tab.')}</div>
  <div class="row" style="margin-top:8px;gap:18px;align-items:flex-start">
    <div class="col">${tile('lt_next__to-do')}</div>
    <div style="width:160px;flex:none">${side([['Steps that can appear', ['Split your savings into accounts', 'Get the full employer match', 'Build months of cash', 'Pay down debt at 8% or more', 'Save for college', 'Check your Social Security', 'Choose a withdrawal strategy', 'Plan your bridge to 59½', 'Plan health cover until Medicare', 'Update your balances']]])}</div>
  </div>
  <div class="rule" style="margin:22px 0 16px"></div>
  ${mini('14', 'Learn', 'What does all this mean?', 'The same 66 lessons as retcalc.app/learn, in 8 tracks, inside the Dashboard. <b>Next for you</b> picks a lesson from what the plan needs, and lessons show the household\'s own numbers beside the idea.')}
  <div style="margin-top:8px">${tile('lt_learn__health-cover-before-65')}</div>
  ${cap('Next for you:', 'retiring at 60 leaves years before Medicare, so the lesson on health cover before 65 comes first.')}
  <div class="rule" style="margin:22px 0 16px"></div>
  <div class="row" style="gap:20px;align-items:flex-start">
    <div class="col">${mini('15', 'About', 'How does it work?', 'How the Dashboard works, tab by tab; the Calculator and how the projection runs; each tool; the methods, historical and Monte Carlo, and where every number comes from; then the fine print.')}</div>
    <div style="width:330px;flex:none">${cut('lt_about_view', 1060, 214, 2460, 976, 'border-radius:12px 12px 0 0')}</div>
  </div>`, 'Tabs 13 to 15 of 15', 'Next steps, Learn and About');

  /* ================= Across the Dashboard ================= */

  // The printable report, page 1
  const R = (i) => `${D}lt_x_report_p${String(i).padStart(2, '0')}.png`;
  P(`${intro('Across the Dashboard', 'The plan, printed.', '<b style="color:var(--text)">Print your plan</b>, on the Dashboard and Plan summary tabs, builds US Letter sheets in the browser from the Dashboard as it stands (nothing is sent anywhere to make it), to print or save as a PDF. Fourteen sheets are always there; up to seven more appear when they apply, each saying why it is there.', 34)}
  <div class="row" style="margin-top:20px;gap:24px">
    ${[[0, 'The cover:', 'the net worth line to the end of the plan, with the points along the way.'], [9, 'Will it last?', 'Every starting month from 1926 to 1989, and what was left at 97.']].map(([i, b, t]) => `<div class="col"><img class="sheet" src="${R(i)}">${cap(b, t)}</div>`).join('')}
  </div>
  <div style="margin-top:20px">${stats([['14', 'sheets every report has', 1], ['7', 'more that appear when they apply'], ['19', 'sheets in Sam and Jordan\'s report'], ['0', 'figures sent anywhere to build it']])}</div>
  <div class="row" style="margin-top:14px;gap:20px;align-items:flex-start">
    <div class="col">${side([['Always there', ['Cover, with contents', 'Where you stand', 'Net worth', 'Income and taxes', 'Spending', 'Saving and investing', 'The road from here']]])}</div>
    <div class="col">${side([['&nbsp;', ['Will it last?', 'Where the money comes from', 'Your readiness score', 'Next steps', 'Assumptions and method', 'Saving year by year', 'Retirement year by year']]])}</div>
    <div class="col">${side([['When they apply', ['Your home, or Renting', 'Your children', 'Changes ahead', 'Getting to 59½', 'Social Security, for both of you', 'Health cover before Medicare', 'How your assumptions compare']]])}</div>
  </div>
  <p class="muted" style="font-size:10.5px;margin-top:12px">Every figure is in today's dollars. The two year-by-year tables run over as many sheets as they need, crowded sheets zoom to fit, and a couple's report shows whose each asset and debt is.</p>`, 'Across the Dashboard', 'The printable report');

  // The printable report, page 2: the sheets
  P(`${css()}<div class="row" style="margin-top:14px;gap:12px;align-items:baseline"><h2 style="font-size:22px">Sam and Jordan's report, sheet by sheet</h2></div>
  <p class="muted" style="font-size:10.5px;margin-top:6px">Theirs runs to 19 sheets. The cover and Will it last? are on the page before; here are 16 more.</p>
  <div style="display:grid;grid-template-columns:repeat(4,160px);justify-content:space-between;gap:12px 0;margin-top:10px">
    ${[1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17].map((i) => `<img class="sheet" src="${R(i)}">`).join('')}
  </div>`, 'Across the Dashboard', 'The report, sheet by sheet');

  // Assumptions + help guides
  P(`${intro('Across the Dashboard', 'How your assumptions compare.', 'Every projection rests on guesses about the future. This rates each one the plan uses against a balanced middle, on a five-band scale from very conservative to very aggressive, with what it does to savings at retirement. There is no score out of 100, only the bands. It is a fold on Plan summary, a chip on the Dashboard tab and a sheet in the report.', 30)}
  <div style="margin-top:14px">${tile('lt_x_summary_assume')}</div>
  ${cap('Sam and Jordan\'s guesses are balanced overall:', '$1,891,000 at retirement on their assumptions, $1,950,000 on balanced ones. Raises of 0% beyond inflation rate as conservative (−$59,000); counting 100% of Social Security rather than 90% adds $119,000.')}
  <div class="rule" style="margin:16px 0 14px"></div>
  <div class="row" style="gap:20px;align-items:flex-start">
    <div style="width:236px;flex:none">
      <div class="h3" style="font-size:18px">Help on every tab</div>
      <p class="muted" style="font-size:10.5px"><b style="color:var(--text)">Help</b> in the title bar opens a step-by-step guide in a side panel that scrolls to each part of the page, highlights it and ticks off the tasks.</p>
      ${stats([['24', 'guides: 10 for Dashboard tabs, 14 for the tools', 1], ['53', 'plain-language tips']])}
      <p class="muted" style="font-size:10px;margin-top:8px">The "?" tips say what a figure is, why it is there and how the plan uses it.</p>
    </div>
    <div class="col">${cut('lt_x_help_accounts', 160, 0, 2880, 1800, 'border-radius:12px;border:1px solid var(--rule)')}${cap('The Net worth guide, part 1 of 3,', 'with the tile it describes outlined on the page.')}</div>
  </div>`, 'Across the Dashboard', 'Assumptions, and help');

  // Check-in email + privacy
  P(`${intro('Across the Dashboard', 'A monthly check-in, and what stays private.', '', 30)}
  <div class="row" style="margin-top:14px;gap:22px;align-items:flex-start">
    <div class="col">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:10px 14px;border-bottom:1px solid var(--rule);font-size:10px;line-height:1.6"><div><span class="muted">From</span>&nbsp; RetCalc</div><div><span class="muted">Subject</span>&nbsp; <b>Your monthly RetCalc check-in</b></div></div>
        ${cut('lt_x_email', 0, 0, 1280, 1200, 'border-radius:0')}
      </div>
    </div>
    <div style="width:280px;flex:none">
      <div class="h3" style="font-size:18px">The check-in email</div>
      <p class="muted" style="font-size:10.5px">A short reminder to update balances, look over the month's spending and see how the plan moved. It goes out only when the latest balances are 30 or more days old, and never more than once in 28 days.</p>
      ${side([['What it says', ['When balances were last updated', 'Three things to check', 'A button to open the Dashboard']], ['What it never has', 'Dollar figures or plan results. Those are worked out in the browser, so the server that sends the email doesn\'t have them.'], ['Turning it off', 'It is on for every Dashboard that is set up. It turns off from Profile, or with one click from any email.']])}
    </div>
  </div>
  <div class="rule" style="margin:24px 0 18px"></div>
  <div class="h3" style="font-size:18px">Privacy</div>
  <div style="margin-top:10px">${privacyDiagram()}</div>
  <div class="row" style="margin-top:8px;gap:20px;align-items:flex-start">
    <div class="col">${side([['Where the work happens', 'Every calculation runs in the browser. The account stores the Dashboard (profiles, entries, choices), lessons read, the email preference, the email address and an optional first name.'], ['Who can read it', 'Only the person signed in: the database lets each account reach its own data and no one else\'s. Signing out removes the synced copy from that browser.']])}</div>
    <div class="col">${side([['Never shared', ['Not sold or shared with advertisers', 'No ads', 'No bank connections: balances are typed in']], ['Yours to take or erase', '<b>Download my data</b> saves everything as a file; <b>Delete my account</b> signs out every device and erases it all.']])}</div>
    <div class="col">${side([['Error reports', 'Errors only, with addresses cut to their path and no inputs, cookies or user details, sent through the site\'s own server. The numbers you type never reach them.'], ['Analytics', 'Cookieless page counts only.']])}</div>
  </div>`, 'Across the Dashboard', 'Check-in email and privacy');

  // Phones and tablets
  const ph = (f, b, t) => `<div class="col">${img('lt_x_frame_ph_' + f)}${cap(b, t)}</div>`;
  P(`${intro('Across the Dashboard', 'On a phone, every tab.', 'Nothing on the Dashboard is desktop-only except the full-screen chart buttons. On a phone, and on a tablet held upright, the rail becomes a tab bar; held sideways, a tablet keeps the rail with its labels. The Dashboard can be added to the home screen and opens full screen, like an app.', 30)}
  <div class="row" style="margin-top:16px;gap:14px">
    ${ph('overview', 'Dashboard.', 'Figures shrink to fit, switching to /mo and /yr.')}
    ${ph('more', 'More', 'opens every tab, the theme and the way back.')}
    ${ph('retirement', 'Retirement.', 'Charts read out by tap-and-drag.')}
    ${ph('accounts', 'Net worth.', 'Rows reorder by touch and hold.')}
  </div>
  <div class="row" style="margin-top:14px;gap:14px;align-items:flex-start">
    ${ph('calculator', 'Calculator.', 'Inputs first, then the results.')}
    ${ph('savings', 'Taxes &amp; Savings.', 'The paycheck, on a phone.')}
    <div style="flex:2;min-width:0;padding-left:6px">${side([
      ['The tab bar', 'Dashboard, Plan summary, Calculator, Retirement and More. It slides away while scrolling down and comes back on the way up, like Safari\'s toolbar, and shows the same dots as the rail.'],
      ['Made for touch', ['Charts read out by tap-and-drag', 'The timeline and wide tables scroll sideways inside their box', 'Net worth rows reorder by touch-and-hold']],
      ['Light or dark', 'Light, dark (Apple-style black), or match the device, from the rail or the More menu.'],
    ])}</div>
  </div>`, 'Across the Dashboard', 'Phones and tablets');
}

/* The profile and the plan in the middle, the tabs that set it on the left, what it drives on the right. */
function flowDiagram() {
  const W = 708, H = 320;
  const left = ['Profile', 'Net worth', 'Your home', 'Income', 'Spending', 'Taxes & Savings', 'Year by year', 'Calculator', 'Retirement'];
  const right = [['Dashboard', 'the one-line answer'], ['Plan summary', 'the plan on one page'], ['Readiness score', 'out of 100'], ['Chance of success', 'every month since 1926'], ['Next steps', 'ranked by what they add'], ['The printable report', 'the whole plan'], ['Tools', 'filled in, never written back']];
  const lw = 118, rw = 214, top = 26;
  const ly = (i) => top + 12 + i * ((H - top - 24) / (left.length - 1)), ry = (i) => top + 14 + i * ((H - top - 28) / (right.length - 1));
  const cw = 122, cx1 = 176, cx2 = cx1 + cw + 36, cy = top + (H - top) / 2, ch = 112;
  let s = `<svg class="flow" viewBox="0 0 ${W} ${H}" width="100%" style="display:block">`;
  s += `<text x="0" y="10" font-size="8.5" fill="#6e6e73" letter-spacing=".9" font-weight="600">SET ON THESE TABS</text>`;
  s += `<text x="${W}" y="10" font-size="8.5" fill="#6e6e73" letter-spacing=".9" font-weight="600" text-anchor="end">AND READ EVERYWHERE</text>`;
  for (let i = 0; i < left.length; i++) s += `<path d="M${lw},${ly(i)} C${(lw + cx1) / 2},${ly(i)} ${(lw + cx1) / 2},${cy} ${cx1},${cy}" fill="none" stroke="#d1d1d6" stroke-width="1.2"/>`;
  for (let i = 0; i < right.length; i++) s += `<path d="M${cx2 + cw},${cy} C${(cx2 + cw + W - rw) / 2},${cy} ${(cx2 + cw + W - rw) / 2},${ry(i)} ${W - rw},${ry(i)}" fill="none" stroke="#d1d1d6" stroke-width="1.2" ${i === right.length - 1 ? 'stroke-dasharray="3 3"' : ''}/>`;
  left.forEach((t, i) => { s += `<rect x="0.5" y="${ly(i) - 10.5}" width="${lw - 1}" height="21" rx="10.5" fill="#fff" stroke="#e3e3e8"/><circle cx="12" cy="${ly(i)}" r="3.5" fill="#975300"/><text x="21" y="${ly(i) + 3.4}" font-size="9.5" font-weight="600" fill="#1d1d1f">${t.replace('&', '&amp;')}</text>`; });
  right.forEach(([t, d], i) => { s += `<rect x="${W - rw + 0.5}" y="${ry(i) - 13}" width="${rw - 1}" height="26" rx="8" fill="#fff" stroke="#e3e3e8"/><text x="${W - rw + 11}" y="${ry(i) + 3.4}" font-size="9.5" font-weight="600" fill="#1d1d1f">${t}</text><text x="${W - 10}" y="${ry(i) + 3.4}" font-size="8.5" fill="#6e6e73" text-anchor="end">${d}</text>`; });
  s += `<rect x="${cx1}" y="${cy - ch / 2}" width="${cw}" height="${ch}" rx="14" fill="#fcf1e0" stroke="#f8dcb2"/>`;
  s += `<text x="${cx1 + cw / 2}" y="${cy - 30}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1d1d1f">One profile</text>`;
  ['household · ages · pay', 'accounts · debts · home', 'budget · saving', 'changes · assumptions'].forEach((t, i) => { s += `<text x="${cx1 + cw / 2}" y="${cy - 10 + i * 14}" text-anchor="middle" font-size="8.5" fill="#6e6e73">${t}</text>`; });
  s += `<path d="M${cx1 + cw + 5},${cy} L${cx2 - 5},${cy}" stroke="#975300" stroke-width="1.6"/><path d="M${cx2 - 11},${cy - 4} L${cx2 - 4},${cy} L${cx2 - 11},${cy + 4}" fill="none" stroke="#975300" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<rect x="${cx2}" y="${cy - ch / 2}" width="${cw}" height="${ch}" rx="14" fill="#1d1d1f"/>`;
  s += `<text x="${cx2 + cw / 2}" y="${cy - 30}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#f5f5f7">One plan</text>`;
  ['worked out in your', 'browser, and tested', 'against every month', 'since 1926'].forEach((t, i) => { s += `<text x="${cx2 + cw / 2}" y="${cy - 10 + i * 14}" text-anchor="middle" font-size="8.5" fill="#a1a1a6">${t}</text>`; });
  return s + '</svg>';
}

/* Where the work happens: the browser calculates, the account stores, the email sees almost nothing. */
function privacyDiagram() {
  const W = 708, H = 112, bw = 210, gap = (W - 3 * bw) / 2;
  const box = (x, title, lines, dark) => `<rect x="${x + 0.5}" y="0.5" width="${bw - 1}" height="${H - 1}" rx="12" fill="${dark ? '#1d1d1f' : '#fff'}" stroke="${dark ? '#1d1d1f' : '#e3e3e8'}"/><text x="${x + 14}" y="24" font-size="12" font-weight="700" fill="${dark ? '#f5f5f7' : '#1d1d1f'}">${title}</text>${lines.map((t, i) => `<text x="${x + 14}" y="${44 + i * 15}" font-size="9" fill="${dark ? '#a1a1a6' : '#6e6e73'}">${t}</text>`).join('')}`;
  const arrow = (x1, x2, y, label, both) => `<path d="M${x1 + 4},${y} L${x2 - 4},${y}" stroke="#975300" stroke-width="1.5"/><path d="M${x2 - 9},${y - 4} L${x2 - 3},${y} L${x2 - 9},${y + 4}" fill="none" stroke="#975300" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${both ? `<path d="M${x1 + 9},${y - 4} L${x1 + 3},${y} L${x1 + 9},${y + 4}" fill="none" stroke="#975300" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}<text x="${(x1 + x2) / 2}" y="${y - 7}" font-size="8" fill="#975300" text-anchor="middle" font-weight="600">${label}</text>`;
  let s = `<svg class="flow" viewBox="0 0 ${W} ${H}" width="100%" style="display:block">`;
  s += box(0, 'Your browser', ['Every figure is worked out here:', 'the plan, every month since 1926,', 'the report. Changes are saved', 'here first.'], true);
  s += box(bw + gap, 'Your account', ['Keeps the Dashboard so it appears', 'on every device you sign in on.', 'Only you can read it. It stores,', 'and never calculates.'], false);
  s += box(2 * (bw + gap), 'The check-in email', ['Reads only the email address,', 'a first name, the date of the', 'latest balances and when the', 'last email went out.'], false);
  s += arrow(bw, bw + gap, 58, 'sync', true);
  s += arrow(2 * bw + gap, 2 * (bw + gap), 58, 'a date', false);
  return s + '</svg>';
}

function tabList() {
  const xs = ['Profile', 'Dashboard', 'Plan summary', 'Net worth', 'Your home', 'Income', 'Spending', 'Taxes &amp; Savings', 'Year by year', 'Calculator', 'Retirement', 'Tools', 'Next steps', 'Learn', 'About'];
  return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 14px">${xs.map((x, i) => `<div style="display:flex;gap:8px;align-items:center;font-size:10.5px;padding:5px 0;border-bottom:1px solid var(--rule)"><span class="mono amber" style="font-weight:600;width:16px">${String(i + 1).padStart(2, '0')}</span>${x}</div>`).join('')}</div>`;
}
