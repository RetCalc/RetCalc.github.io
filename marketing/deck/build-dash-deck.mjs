// The Dashboard deck: a 21-slide talk about My Dashboard (retcalc.app/dashboard),
// then an appendix with a deeper look at the tabs and how it works. Same family
// as the main deck (build-deck.mjs): night slides, one amber accent, split
// slides with a tinted panel of real screenshots. Screenshots are the dark
// Dashboard captures in ../shots/dash (tooling/dash.mjs and
// tooling/dashdeck-extra.mjs); facts are from ../build/DASHBOARD-FACTS.md.
// Build: node ../deck/build-dash-deck.mjs (from tooling/).
import fs from 'fs';
import { createRequire } from 'module';
import { icon } from './assets.mjs';
import { dcard, dview, phone, reportPages, OUT } from './dash/kit.mjs';
import { applyTheme } from './apply-theme.mjs';
const require = createRequire(import.meta.url);
const pptxgen = require('../tooling/node_modules/pptxgenjs');
const sharp = require('../tooling/node_modules/sharp');

/* ---------- theme: the site's Clear Glass night palette, as the main deck ---------- */
const THEME = {
  name: 'RetCalc Clear Glass Night', headFontFace: 'Arial', bodyFontFace: 'Arial',
  colors: { dk1: '000000', lt1: 'FFFFFF', dk2: '1C1C1E', lt2: 'F5F5F7', accent1: 'FFB340', accent2: '5AA9E6', accent3: '46B9A6', accent4: '9670EC', accent5: 'E0749B', accent6: '8A94A3', hlink: 'FFB340', folHlink: 'A1A1A6' },
};
const X = { ground: '000000', surface: '1C1C1E', raised: '2C2C2E', rule: '38383A', text: 'F5F5F7', muted: 'A1A1A6', amber: 'FFB340', sky: '5AA9E6', teal: '46B9A6', lav: '9670EC', rose: 'E0749B', gray: '8A94A3', gain: '30D158', loss: 'FF6961' };
const GROUP = {
  dash: { name: 'My Dashboard', color: X.amber }, money: { name: 'Money today', color: X.lav },
  plan: { name: 'Planning ahead', color: X.teal }, retire: { name: 'Retirement', color: X.sky },
  more: { name: 'Tools and learning', color: X.rose }, build: { name: 'How it works', color: X.gray },
};
const mix = (hex, t) => { // hex blended toward the ground color: t of hex
  const a = parseInt(hex, 16), g = parseInt(X.ground, 16);
  const ch = (v, s) => Math.round(((v >> s) & 255) * t + ((g >> s) & 255) * (1 - t));
  return [16, 8, 0].map((s) => ch(a, s).toString(16).padStart(2, '0')).join('').toUpperCase();
};
const tint = (g) => mix(GROUP[g].color, g === 'dash' ? 0.12 : 0.17);
const W = 13.333, H = 7.5, M = 0.6;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'RetCalc: My Dashboard'; pres.author = 'RetCalc'; pres.company = 'RetCalc';
const C = pres.SchemeColor;

/* ---------- layouts (the main deck's masters) ---------- */
const footer = [{ text: { text: 'RetCalc  ·  retcalc.app/dashboard', options: { x: M, y: 7.02, w: 4, h: 0.3, fontSize: 10, color: X.muted, margin: 0 } } }];
pres.defineSlideMaster({ title: 'COVER', background: { color: X.ground }, objects: [] });
pres.defineSlideMaster({
  title: 'DIVIDER', background: { color: X.ground },
  objects: [
    { placeholder: { options: { name: 'kicker', type: 'body', x: M, y: 0.6, w: 8, h: 0.4, fontSize: 14, bold: true, color: C.accent1, margin: 0, charSpacing: 3, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.0, w: 6.4, h: 3.0, fontSize: 54, bold: true, color: C.background2, margin: 0, valign: 'bottom', align: 'left' }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENT', background: { color: X.ground },
  objects: [
    ...footer,
    { placeholder: { options: { name: 'kicker', type: 'body', x: M, y: 0.42, w: 9, h: 0.32, fontSize: 12, bold: true, color: C.accent1, margin: 0, charSpacing: 2, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.78, w: W - 2 * M, h: 0.75, fontSize: 34, bold: true, color: C.background2, margin: 0, valign: 'top', align: 'left' }, text: '' } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: X.muted, align: 'right' },
});
pres.defineSlideMaster({
  title: 'SPLIT', background: { color: X.ground },
  objects: [
    ...footer,
    { placeholder: { options: { name: 'kicker', type: 'body', x: M, y: 0.6, w: 4.4, h: 0.32, fontSize: 12, bold: true, color: C.accent1, margin: 0, charSpacing: 2, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.98, w: 4.5, h: 1.45, fontSize: 30, bold: true, color: C.background2, margin: 0, valign: 'top', align: 'left' }, text: '' } },
  ],
});

/* ---------- helpers (as in the main deck) ---------- */
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, color: X.text, fontSize: 14, valign: 'top', ...o });
const shadow = () => ({ type: 'outer', color: '000000', blur: 20, offset: 8, angle: 90, opacity: 0.5 });
const img = (s, im, x, y, w, o = {}) => { const h = w / im.ar; s.addImage({ path: im.path, x, y, w, h, shadow: o.flat ? undefined : shadow(), rotate: o.rotate }); return h; };
const imgH = (s, im, x, y, h, o = {}) => img(s, im, x, y, h * im.ar, o);
/** An image fitted inside a box (centered across, top or middle down). Returns { x, y, w, h }. */
const fit = (s, im, x, y, w, h, o = {}) => { let iw = w, ih = w / im.ar; if (ih > h) { ih = h; iw = h * im.ar; } const ix = x + (w - iw) / 2, iy = o.top ? y : o.bottom ? y + h - ih : y + (h - ih) / 2; img(s, im, ix, iy, iw, o); return { x: ix, y: iy, w: iw, h: ih }; };
const rect = (s, x, y, w, h, fill, o = {}) => s.addShape(o.round ? pres.ShapeType.roundRect : pres.ShapeType.rect, { x, y, w, h, fill: fill ? { color: fill, transparency: o.tr || 0 } : { type: 'none' }, line: o.line ? { color: o.line, width: o.lw || 1, dashType: o.dash } : { type: 'none' }, rectRadius: o.round ? o.r ?? 0.12 : undefined });
/** A thin outline around a black screenshot, so its edge shows on the black slide. */
const frame = (s, x, y, w, h) => rect(s, x, y, w, h, null, { round: true, r: 0.06, line: X.rule, lw: 1 });
const circle = (s, x, y, d, fill, o = {}) => s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: o.line ? { color: o.line, width: o.lw || 1 } : { type: 'none' } });
/** A line from (x1, y1) to (x2, y2): the shape runs top-left to bottom-right, flipped to start where the line starts. */
const line = (s, x1, y1, x2, y2, color, o = {}) => s.addShape(pres.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, flipH: x2 < x1, flipV: y2 < y1, line: { color, width: o.w || 1.25, dashType: o.dash, beginArrowType: o.begin, endArrowType: o.end } });
const arrow = (s, x1, y1, x2, y2, color = X.muted, o = {}) => line(s, x1, y1, x2, y2, color, { end: 'triangle', ...o });
const iconIn = async (s, name, color, x, y, d, bg) => { if (bg) circle(s, x, y, d, bg); const p = await icon(name, color); const pad = bg ? d * 0.24 : 0; s.addImage({ path: p, x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad }); };
const link = (url, text) => ({ text: text || url.replace('https://', ''), options: { hyperlink: { url, tooltip: url } } });
const bullets = (items, o = {}) => items.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: o.gap ?? 6 } }));
const kick = (s, text) => s.addText(text.toUpperCase(), { placeholder: 'kicker' });
const title = (s, text) => s.addText(text, { placeholder: 'title' });
const notes = (s, text) => s.addNotes(text);
const label = (s, text, x, y, w, color = X.muted) => T(s, text.toUpperCase(), { x, y, w, h: 0.28, fontSize: 11, bold: true, color, charSpacing: 1 });
const stat = (s, x, y, w, n, l, o = {}) => {
  T(s, n, { x, y, w, h: o.nh || 0.62, fontSize: o.size || 34, bold: true, color: o.color || X.text });
  T(s, l, { x, y: y + (o.nh || 0.62) + 0.04, w, h: o.lh || 0.5, fontSize: o.lsize || 12, color: X.muted });
};
/** Where text starts under a left-column title: one line holds about 18 characters at 30pt. */
const underTitle = (name, tl) => 0.98 + (tl || (name.length > 18 ? 2 : 1)) * 0.47 + 0.2;
const qLines = (q, per = 30) => Math.ceil(q.length / per);
/** Lays rows of images into a box, every row filling its width, the whole scaled to fit. */
function panel(s, rows, bx, by, bw, bh, gap = 0.22) {
  const rowH = (row) => { const ws = bw - gap * (row.length - 1); return ws / row.reduce((a, im) => a + im.ar, 0); };
  const hs = rows.map(rowH), total = hs.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
  const k = Math.min(1, bh / total), w = bw * k, x0 = bx + (bw - w) / 2;
  let y = by + (bh - total * k) / 2;
  rows.forEach((row, i) => { let x = x0; for (const im of row) { const iw = im.ar * hs[i] * k; img(s, im, x, y, iw); x += iw + gap * k; } y += hs[i] * k + gap * k; });
}
/** A row of images at one height, centered in [x, x + w]; returns the boxes. */
function rowAt(s, ims, x, y, w, h, gap = 0.3) {
  let hh = h; const need = (k) => ims.reduce((a, im) => a + im.ar * k, 0) + gap * (ims.length - 1);
  if (need(hh) > w) hh = (w - gap * (ims.length - 1)) / ims.reduce((a, im) => a + im.ar, 0);
  let cx = x + (w - need(hh)) / 2; const boxes = [];
  for (const im of ims) { const iw = im.ar * hh; img(s, im, cx, y, iw, { flat: im.flat }); boxes.push({ x: cx, y, w: iw, h: hh }); cx += iw + gap; }
  return boxes;
}

/* ---------- assets ---------- */
const logoPng = OUT + 'logo.png';
await sharp(Buffer.from(fs.readFileSync(new URL('../shots/logo_nav.svg', import.meta.url), 'utf8').replace('class="brandmark"', 'xmlns="http://www.w3.org/2000/svg" width="256" height="256"').replace(/var\(--ds-brand-gold\)/g, '#e9b872').replace(/var\(--ds-brand-jade\)/g, '#4fbf95').replace(/var\(--ds-brand-steel\)/g, '#7d9fd6'))).png().toFile(logoPng);
const logo = (s, x, y, size, word = true) => { s.addImage({ path: logoPng, x, y, w: size, h: size }); if (word) T(s, 'RetCalc', { x: x + size + 0.12, y, w: 2, h: size, fontSize: size * 34, bold: true, valign: 'middle' }); };
const flat = (im) => ({ ...im, flat: true });
const DASH_URL = 'https://retcalc.app/dashboard';

// The sidebar's tabs, in its order, with the rail's icons
const TABS = [
  ['Profile', 'LuUserRound', 'Every answer in one place, editable where it stands, and your profiles'],
  ['Dashboard', 'LuLayoutGrid', 'Where you stand: the one-line answer, net worth, readiness, chance of success'],
  ['Plan summary', 'LuClipboardList', 'The whole plan on one page, with the assumption rating and Print your plan'],
  ['Net worth', 'LuWallet', 'Assets and debts by date, whose they are, and when you can spend them'],
  ['Your home', 'LuHouse', 'Equity, the mortgage and what owning costs; or rent against buying'],
  ['Income', 'LuBanknote', 'Pay, the employer match, other income and Social Security'],
  ['Spending', 'LuReceipt', 'Your budget, which is spending everywhere, and the emergency fund'],
  ['Taxes & Savings', 'LuPiggyBank', 'This year\'s taxes and where each paycheck goes, line by line'],
  ['Year by year', 'LuCalendarRange', 'Every year to retirement: raises, typed figures and changes ahead'],
  ['Calculator', 'LuCalculator', 'The Advanced Calculator on your plan, with changes ahead'],
  ['Retirement', 'LuSunset', 'Drawdown, the bridge to 59½ and health cover, on your plan'],
  ['Tools', 'LuWrench', 'All 14 tools, filled in from your plan, to try things on'],
  ['Next steps', 'LuListChecks', 'What to do, ordered by how much each moves your plan'],
  ['Learn', 'LuGraduationCap', '66 lessons in 8 tracks, with your own numbers where they fit'],
  ['About', 'LuInfo', 'How every tab works, the methods and where the numbers come from'],
];

/* =====================================================================
   THE TALK
   ===================================================================== */
const MAIN = 'The talk', APP = 'Appendix';
pres.addSection({ title: MAIN });

// 1. Cover
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: MAIN });
  logo(s, M, 0.5, 0.42);
  T(s, 'MY DASHBOARD', { x: W - M - 4, y: 0.55, w: 4, h: 0.3, fontSize: 11, color: X.muted, align: 'right', charSpacing: 3 });
  T(s, [{ text: 'One place for your money', options: { breakLine: true } }, { text: 'and your retirement plan.', options: { color: X.amber } }], { x: M, y: 1.3, w: 11.5, h: 1.75, fontSize: 50, bold: true, lineSpacingMultiple: 0.95 });
  T(s, 'A free personal financial hub: net worth, pay, taxes, spending, saving and retirement, worked out from one profile and tested against every market since 1926.', { x: M, y: 3.35, w: 4.15, h: 1.6, fontSize: 16, color: X.muted });
  T(s, [{ text: 'Free account', options: { breakLine: true } }, { text: 'No bank logins', options: { breakLine: true } }, { text: 'No ads' }], { x: M, y: 5.05, w: 3, h: 1.0, fontSize: 14, bold: true, paraSpaceAfter: 3 });
  T(s, [link(DASH_URL, 'retcalc.app/dashboard')], { x: M, y: 6.55, w: 4.5, h: 0.45, fontSize: 22, bold: true, color: X.amber });
  const v = await dview('dk_overview_view');
  img(s, v, 6.2, 3.2, W - 6.2 - 0.35);
  const p = await phone('dk_ph_overview');
  imgH(s, p, 5.0, 3.3, 4.0, { flat: true });
  notes(s, 'This is My Dashboard, the part of RetCalc that keeps a household\'s whole financial picture in one place. You set it up once from one profile, and every tab, from net worth to retirement, is worked out from it. It needs a free account, there are no bank logins and no ads. Everything you will see is a made-up household: Sam, 42, and Jordan, 40, with a daughter, Nora, in Illinois.');
}

// 2. What it is and who it's for
{
  const s = pres.addSlide({ masterName: 'SPLIT', sectionTitle: MAIN });
  kick(s, 'What it is'); title(s, 'Your whole picture, in one place');
  T(s, 'Net worth, pay, taxes, spending, saving and retirement, kept together and worked out from one profile. You come back each month or quarter, update your balances and see where you stand.', { x: M, y: 2.5, w: 4.5, h: 1.45, fontSize: 15, color: X.muted });
  label(s, 'Who it\'s for', M, 4.08, 4.4);
  T(s, bullets(['One person, or a couple planning together', 'Anyone who wants every account in one view', 'Anyone who would rather not link a bank'], { gap: 6 }), { x: M, y: 4.42, w: 4.5, h: 1.15, fontSize: 14 });
  [['15', 'tabs, one profile'], ['14', 'tools inside it'], ['$0', 'free account']].forEach(([n, l], i) => stat(s, M + i * 1.55, 5.95, 1.5, n, l, { size: 28, nh: 0.48, lh: 0.3, color: i === 0 ? X.amber : X.text }));
  rect(s, 5.45, 0, W - 5.45, H, tint('dash'));
  const v = await dview('dk_overview_full', { b: 0.52 });
  const b = fit(s, v, 5.85, 0.4, W - 5.85 - 0.4, H - 1.2);
  T(s, 'The Dashboard tab for the sample household, Sam and Jordan', { x: 5.85, y: b.y + b.h + 0.15, w: W - 6.25, h: 0.3, fontSize: 11, color: X.muted, align: 'center' });
  notes(s, 'The Dashboard is for people who want their money in one place rather than one calculator at a time. Setup asks a few questions, and from then on you visit each month or quarter: update balances, see what moved. This is the home tab for the sample household: on track, about $1.9 million at Sam\'s retirement in 2044, a readiness score of 96 and a plan that lasted in every past market since 1926.');
}

// 3. One profile behind every tab: the hub
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'How it fits together'); title(s, 'One profile behind every tab');
  const cw = 2.06, ch = 0.72, x0 = M, x1 = 9.45, gx = (x1 - x0 - 4 * cw) / 3;
  const top = 1.7, bot = 6.13, gy = (bot - top - ch - 3 * ch) / 4, side = [0, 1, 2].map((i) => top + ch + gy + i * (ch + gy));
  const nodes = [ // [name, line, hosts a tool]
    ['Dashboard', 'where you stand'], ['Plan summary', 'the whole plan'], ['Net worth', 'balances by date'], ['Your home', 'Mortgage Calculator', 1],
    ['Income', 'Social Security pay history', 1], ['Spending', 'the Budget', 1], ['Taxes & Savings', 'the Paycheck tab', 1],
    ['Year by year', 'every year ahead'], ['Calculator', 'Advanced Calculator', 1], ['Retirement', 'Drawdown Simulator', 1], ['Tools', 'all 14, filled in'],
    ['Next steps', 'ranked by effect'], ['Learn', 'your numbers in lessons'], ['The report', 'Print your plan'],
  ];
  const pos = [
    ...[0, 1, 2, 3].map((i) => [x0 + i * (cw + gx), top]),
    ...side.map((y) => [x1 - cw, y]),
    ...[3, 2, 1, 0].map((i) => [x0 + i * (cw + gx), bot]),
    ...[...side].reverse().map((y) => [x0, y]),
  ];
  const cx = (x0 + x1) / 2, cy = (top + bot + ch) / 2;
  pos.forEach(([x, y]) => line(s, cx, cy, x + cw / 2, y + ch / 2, X.muted, { w: 1, dash: 'dash' }));
  const bw = 4.1, bh = 3.0, bx = cx - bw / 2, by = cy - bh / 2;
  rect(s, bx, by, bw, bh, X.amber, { round: true, r: 0.2 });
  T(s, 'Your profile', { x: bx + 0.28, y: by + 0.2, w: bw - 0.56, h: 0.5, fontSize: 24, bold: true, color: X.ground });
  T(s, 'Household and ages · where you live · pay · savings and accounts · spending · home · children · assumptions · Social Security · strategy · changes ahead', { x: bx + 0.28, y: by + 0.75, w: bw - 0.56, h: 1.35, fontSize: 14, color: X.ground });
  rect(s, bx + 0.28, by + bh - 0.78, bw - 0.56, 0.56, mix(X.amber, 0.8), { round: true, r: 0.1 });
  T(s, '+ your dated balances from Net worth', { x: bx + 0.42, y: by + bh - 0.78, w: bw - 0.84, h: 0.56, fontSize: 13, bold: true, color: X.ground, valign: 'middle' });
  for (let i = 0; i < nodes.length; i++) {
    const [n, l, host] = nodes[i], [x, y] = pos[i];
    rect(s, x, y, cw, ch, X.raised, { round: true, r: 0.1, line: host ? X.amber : X.rule, lw: host ? 1.5 : 1, dash: n === 'The report' ? 'dash' : undefined });
    T(s, [{ text: n, options: { bold: true, breakLine: true } }, { text: l, options: { fontSize: 11, color: host ? X.amber : X.muted } }], { x: x + 0.16, y: y + 0.05, w: cw - 0.26, h: ch - 0.1, fontSize: 13.5, valign: 'middle' });
  }
  const rx = 9.95, rw = W - rx - M;
  const blocks = [
    ['Set once', 'Each figure is set in one place. Other tabs show it as a fact with a link to where it\'s set, so two tabs can\'t disagree.'],
    ['One change, every tab', 'Change a retirement age on Profile and the net worth chart, the chance of success and the next steps all move.'],
    ['Tools on your numbers', 'Tabs outlined in amber run one of RetCalc\'s tools on your plan. What you change there is saved to it.'],
  ];
  blocks.forEach(([h, l], i) => { const y = 1.7 + i * 1.75; rect(s, rx - 0.2, y + 0.04, 0.05, 1.4, i === 2 ? X.amber : X.rule); T(s, h, { x: rx, y, w: rw, h: 0.4, fontSize: 17, bold: true, color: i === 2 ? X.amber : X.text }); T(s, l, { x: rx, y: y + 0.45, w: rw, h: 1.05, fontSize: 13, color: X.muted }); });
  notes(s, 'Everything on the Dashboard is worked out from one profile: the household, pay, savings, spending, home, children and assumptions, plus the dated balances from Net worth. Every tab reads it, and so does the printable report. A figure is typed in one place only; anywhere else it appears as a fact with a link back, so the tabs never disagree. Six tabs, outlined in amber, run one of the site\'s own tools on your numbers: the Mortgage Calculator, the Budget and its Paycheck tab, the Social Security pay history, the Advanced Calculator, and the Drawdown Simulator with the Bridge and the Healthcare Cost Planner.');
}

// 4. Setup
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'Getting started'); title(s, 'Set up in up to eight short steps');
  const steps = ['Household', 'About you', 'Children', 'Retirement', 'Pay', 'Savings', 'Spending', 'Home'];
  const sw = (W - 2 * M) / steps.length;
  steps.forEach((t, i) => {
    s.addShape(i ? pres.ShapeType.chevron : pres.ShapeType.homePlate, { x: M + i * sw - (i ? 0.08 : 0), y: 1.62, w: sw + (i ? 0.08 : 0), h: 0.5, fill: { color: i === 0 || i === 4 ? X.amber : X.raised }, line: { type: 'none' }, adjustPoint: 0.3 });
    T(s, `${i + 1}  ${t}`, { x: M + i * sw + 0.14, y: 1.62, w: sw - 0.3, h: 0.5, fontSize: 12, bold: true, color: i === 0 || i === 4 ? X.ground : X.text, align: 'center', valign: 'middle' });
  });
  // the facts, in a row under the steps
  const facts = [['LuSave', 'Saved as it\'s typed', 'Leave partway with Save and finish later.'], ['LuSkipForward', 'Skip anything', 'The Dashboard asks for it later, on Profile.'], ['LuCalendar', 'Birth month and year', 'Not ages, so every age stays right.']];
  const fw = (W - 2 * M) / 3;
  for (let i = 0; i < 3; i++) { const x = M + i * fw; await iconIn(s, facts[i][0], '000000', x, 2.33, 0.46, X.amber); T(s, [{ text: facts[i][1], options: { bold: true, breakLine: true } }, { text: facts[i][2], options: { color: X.muted, fontSize: 12.5 } }], { x: x + 0.6, y: 2.29, w: fw - 0.75, h: 0.6, fontSize: 14.5 }); }
  // the screens: step 5 and the finish
  const pay = await dview('dk_x_setup_pay', { l: 0.1, r: 0.885, t: 0.075, b: 0.845 });
  const fin = await dview('dk_setup_0', { l: 0.1, r: 0.885, t: 0.075, b: 0.79 });
  const boxes = rowAt(s, [pay, fin], M, 3.1, W - 2 * M, 3.4, 0.3);
  const caps = ['Step 5: pay, with "Your plan so far" filling in beside it', 'The finish: your starting point'];
  boxes.forEach((b, i) => { frame(s, b.x, b.y, b.w, b.h); T(s, caps[i], { x: b.x, y: b.y + b.h + 0.08, w: b.w, h: 0.3, fontSize: 12, color: X.muted, align: 'center' }); });
  notes(s, 'Setup is a full-screen walk through up to eight steps: who the plan is for, birth months and years, children, retirement ages, pay, savings, spending and the home. The children step drops out when there are none. Every answer is saved as it is typed and any step can be skipped. Beside the questions, "Your plan so far" fills in as you go, and the finish screen gives a starting point: net worth today, savings at retirement and the chance of success.');
}

// 5. A month in the life
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'How people use it'); title(s, 'A month in the life of a plan');
  const cards = [
    ['The check-in email', 'Arrives only when your balances are 30 or more days old. No figures in it, just a nudge and a link.', await dcard('dk_x_ph_email', { pad: 0, b: 0.555, radius: 40 })],
    ['Update balances', 'Type today\'s balances on Net worth. Each save adds a dated point to your net worth line.', await dcard('dk_ph_accounts', { pad: 0, b: 0.7, radius: 40 })],
    ['See where you stand', 'The plan reruns from the new entry: savings at retirement, readiness, the chance of success.', await dcard('dk_ph_overview', { pad: 0, b: 0.51, radius: 40 })],
    ['Take the next step', 'Next steps are ordered by how much each moves your plan, with a button to the tab that does it.', await dcard('dk_ph_next', { pad: 0, b: 0.583, radius: 40 })],
  ];
  const cw = (W - 2 * M - 3 * 0.32) / 4, y0 = 2.2;
  line(s, M + cw / 2, 1.88, W - M - cw / 2, 1.88, X.rule, { w: 2 });
  for (let i = 0; i < 4; i++) {
    const x = M + i * (cw + 0.32), [h, l, im] = cards[i];
    circle(s, x + cw / 2 - 0.2, 1.68, 0.4, X.amber);
    T(s, String(i + 1), { x: x + cw / 2 - 0.2, y: 1.68, w: 0.4, h: 0.4, fontSize: 15, bold: true, color: X.ground, align: 'center', valign: 'middle' });
    rect(s, x, y0, cw, 6.85 - y0, X.surface, { round: true, r: 0.14 });
    T(s, h, { x: x + 0.22, y: y0 + 0.18, w: cw - 0.44, h: 0.36, fontSize: 15, bold: true });
    T(s, l, { x: x + 0.22, y: y0 + 0.56, w: cw - 0.44, h: 0.95, fontSize: 12, color: X.muted });
    fit(s, im, x + 0.2, y0 + 1.5, cw - 0.4, 6.85 - y0 - 1.7, { bottom: true });
    if (i < 3) s.addShape(pres.ShapeType.rightArrow, { x: x + cw + 0.04, y: 1.72, w: 0.24, h: 0.32, fill: { color: X.muted }, line: { type: 'none' } });
  }
  notes(s, 'The Dashboard is built to be revisited, and it works the same on a phone, as here. When your balances are a month old, a short check-in email arrives. It never carries figures: those are only ever worked out in your browser. You open Net worth, press Update balances and type today\'s numbers. The plan reruns from that entry, so the home tab shows where you stand, and Next steps lists what to do, ordered by how much each would move the plan.');
}

/* Tab slide: text on the left, a tinted full-bleed panel of screenshots on the right. */
async function tab({ group, kicker, name, q, points, note, art, cap, tl }) {
  const s = pres.addSlide({ masterName: 'SPLIT', sectionTitle: MAIN });
  const g = GROUP[group];
  kick(s, kicker || g.name); title(s, name);
  const qy = underTitle(name, tl), ql = qLines(q), py = qy + ql * 0.31 + 0.35, step = Math.min(1.25, (6.85 - py) / points.length);
  T(s, q, { x: M, y: qy, w: 4.5, h: ql * 0.31 + 0.05, fontSize: 18, bold: true, color: g.color });
  points.forEach(([h, l], i) => {
    const y = py + i * step;
    T(s, h, { x: M, y, w: 4.45, h: 0.34, fontSize: 16, bold: true });
    T(s, l, { x: M, y: y + 0.36, w: 4.45, h: step - 0.4, fontSize: 13, color: X.muted });
  });
  rect(s, 5.45, 0, W - 5.45, H, tint(group));
  await art(s, 5.45, W - 5.45);
  if (cap) T(s, cap, { x: 5.85, y: 7.02, w: W - 6.25, h: 0.3, fontSize: 11, color: X.muted, align: 'right' });
  if (note) notes(s, note);
  return s;
}
const P = (rows, o = {}) => async (s, px, pw) => panel(s, await Promise.all(rows.map((r) => Promise.all(r))), px + 0.4, o.y ?? 0.4, pw - 0.8, o.h ?? (H - 0.8 - (o.cap ? 0.2 : 0)), o.gap ?? 0.22);

// 6. Dashboard (home tab)
await tab({
  group: 'dash', kicker: 'Tab by tab · Dashboard', name: 'Dashboard', q: 'Where do we stand today?',
  points: [
    ['A one-line answer', '"You\'re on track", or "Not there yet" with the first fix: save more, retire later or spend less.'],
    ['Net worth, past and ahead', 'Your dated entries, the projection to retirement, then every market since 1926 after it.'],
    ['Readiness and chance of success', 'A score out of 100 across five areas, and the share of past retirements that lasted.'],
    ['Retirement income, at a glance', 'Income per month, Social Security, your withdrawal strategy and the emergency fund.'],
  ],
  art: P([[dcard('dk_overview__net-worth')], [dcard('dk_overview__readiness-score'), dcard('dk_overview__chance-of-success')], [dcard('dk_overview__retirement-income'), dcard('dk_overview__social-security'), dcard('dk_overview__withdrawal-strategy'), dcard('dk_overview__emergency-fund')]]),
  note: 'The home tab answers the first question in one line. For the sample it reads: you\'re on track, $1,891,000 in savings at 60, and the plan lasted in every past market since 1926. The net worth chart joins the entries you have typed to the projection, and from retirement on it shows the Retirement tab\'s own run through history, with a band for the middle eight in ten markets. Readiness is 96 of 100; the chance of success is 100%. Empty tiles are dashed and offer the one action that fills them.',
});

// 7. Plan summary
await tab({
  group: 'dash', kicker: 'Tab by tab · Plan summary', name: 'Plan summary', q: 'What does the whole plan add up to?',
  points: [
    ['Your plan in one row', 'Savings at retirement, what you plan to spend, taxes on top, Social Security and the chance of success.'],
    ['Where your pay goes', 'Gross pay split into taxes, spending and saving, per year or per month.'],
    ['How your assumptions compare', 'Your guesses about the future rated from very conservative to very aggressive.'],
    ['The rest, folded', 'Saving to retirement, what the children cost, readiness and the timeline open in place.'],
  ],
  art: P([[dcard('dk_summary__your-plan')], [dcard('dk_summary__where-your-pay-goes')], [dcard('dk_x_summary_assumptions', { b: 0.295 })], [dcard('dk_summary__your-budget'), dcard('dk_summary__net-worth-today')]]),
  note: 'Plan summary is the plan on one page. For the sample: $1,891,000 at retirement in 2044, $7,800 per month to spend with $1,962 per month of taxes on top, Social Security of $5,000 per month from 2051, and a 100% chance of success. The assumption rating sits here too, and Print your plan in the title bar turns the whole Dashboard into a report.',
});

// 8. Net worth
await tab({
  group: 'money', kicker: 'Tab by tab · Net worth', name: 'Net worth', q: 'What do we own, what do we owe, and how is it moving?',
  points: [
    ['Balances by date', 'Update balances saves a dated entry. The plan always starts from the latest one.'],
    ['9 kinds of assets, 5 of debts', 'From 401(k)s, Roth IRAs and HSAs to the home, car loans and credit cards.'],
    ['Whose it is', 'Couples filter every picture by Everyone, either name, or Shared.'],
    ['When you can spend it', 'Which dollars are free of the 10% penalty now, at 59½ or at 65, and how each is taxed.'],
  ],
  art: P([[dcard('dk_accounts__assets-and-debts')], [dcard('dk_x_accounts_overtime')], [dcard('dk_accounts__when-you-can-spend-it', { b: 0.56 }), dcard('dk_accounts__how-it-s-taxed', { b: 0.6 })]]),
  note: 'Net worth is read-only until you press Update balances. Then you type each balance, pick the date, and save a new entry; one entry per day. The sample shows $610,500 today: $943,000 of assets and $332,500 of debts, up $51,865 since the last entry. Over time draws the line through every entry. Two tips explain which dollars you can spend without the 10% penalty, and when, and how much of it will be taxed when spent.',
});

// 9. Your home and Income
await tab({
  group: 'money', kicker: 'Tab by tab · Home, Income', name: 'Your home and Income', q: 'What does the house cost, and what is coming in?',
  points: [
    ['The home and its mortgage', 'Equity, the payoff date and interest still to pay, with the Mortgage Calculator on your own loan. Renters get Rent vs. Buy on their rent.'],
    ['Pay and the match', 'Each person\'s pay, the employer 401(k) match and any other income.'],
    ['Social Security', 'Estimated, typed from your statement or built from your pay history; claim at 62 to 70.'],
  ],
  art: P([[dcard('dk_home__your-home')], [dcard('dk_home__mortgage')], [dcard('dk_income__coming-in')], [dcard('dk_income__social-security')]]),
  note: 'Your home depends on whether you own or rent. Owners see equity, the mortgage and what owning costs: the Mortgage Calculator on their own loan, where property tax, insurance and upkeep become the budget\'s housing lines. The sample home is worth $520,000 with $318,000 left, paid off in April 2044. Income lists pay, the employer match and other income, and Social Security, where the claiming ages here are shared with the Retirement tab.',
});

// 10. Spending and Taxes & Savings
await tab({
  group: 'money', kicker: 'Spending · Taxes & Savings', name: 'Spending, taxes and saving', q: 'Where does each paycheck go?',
  points: [
    ['A budget that is the plan', 'The Budget tool\'s total is spending on every tab, with an emergency fund sized on it.'],
    ['Taxes this year', 'Federal, state, local where there is one, and FICA, for all 50 states and DC.'],
    ['Where the rest goes', 'Sliders for the 401(k) match, HSA, IRA, more 401(k) and brokerage, with three starting plans.'],
    ['Taxes move as you save', 'Pre-tax lines lower the taxes above them as the sliders move.'],
  ],
  art: P([[dcard('dk_spending__each-month')], [dcard('dk_savings__taxes-this-year'), dcard('dk_savings__each-month')], [dcard('dk_savings__where-the-rest-goes', { b: 0.56 })]]),
  note: 'Spending hosts the Budget tool. Its total is the spending figure everywhere on the Dashboard: $7,800 per month for the sample. Taxes & Savings hosts the Budget\'s Paycheck tab, the household\'s one tax calculator: $48,333 of taxes per year, 22.6% of pay. Below it, where the rest goes: the 401(k) up to the match, an HSA, an IRA and brokerage, each a slider with Max, and three plans to start from: the usual order, max tax breaks, or stay flexible.',
});

// 11. Year by year
await tab({
  group: 'plan', kicker: 'Tab by tab · Year by year', name: 'Year by year', q: 'What happens in each year between now and retirement?',
  points: [
    ['Raises, and how much you keep', 'A raise beyond inflation for each of you, and how much of each raise you save.'],
    ['Type your own figure', 'Click any pay or spending figure to set it for one year or until retirement.'],
    ['Changes ahead', 'Pay changes, spending more or less, saving less: switch each on or off.'],
    ['Today\'s dollars or future dollars', 'One switch for the whole table, with a CSV download.'],
  ],
  art: P([[dcard('dk_years__what-shapes-the-years')], [dcard('dk_years__every-year-to-retirement', { b: 0.555 })], [dcard('dk_years__income-and-spending'), dcard('dk_years__where-each-year-s-income-goe')]]),
  note: 'Year by year is the engine room. Every year to retirement has its pay, taxes from the paycheck calculator, spending, and saving by account up to each account\'s limit. The plan\'s savings at retirement on every tab are built from these years: $1,891,305 for the sample. You can type your own figure for any year, set raises, and add changes ahead.',
});

// 12. Calculator and Changes ahead
await tab({
  group: 'plan', kicker: 'Tab by tab · Calculator', name: 'Calculator and changes ahead', q: 'What will we have, with the changes we see coming?',
  points: [
    ['Five kinds of change', 'Pay, spending, saving less, a lump sum and different returns, each in plain words with ages.'],
    ['The effect of each', 'Every change shows what it does to savings at retirement, and switches off without deleting.'],
    ['When you could stop saving', 'The earliest age you could stop and still reach your target, one click to add.'],
    ['Tested three ways', 'A rate band, every historical window since 1926, or 5,000 Monte Carlo runs.'],
  ],
  art: P([[dcard('dk_x_calc_lanes', { pad: 0, radius: 26 })], [dcard('dk_x_calc_changes_card', { pad: 0, radius: 24 }), dcard('dk_x_calc_kinds', { pad: 0, radius: 26 })]], { cap: true }),
  cap: 'The sample with three changes added: part-time years, a car, an inheritance',
  note: 'The Calculator is the Advanced Calculator, run on the plan. Changes ahead is where you write down what you see coming. Here the sample has three: Jordan going part-time from 50 to 55, a new car at 47, and a $50,000 inheritance at 55. Each row shows its effect on savings at retirement; the children\'s row is there because the profile has a child. All of them follow through every tab, and any can be switched off to compare.',
});

// 13. Retirement
await tab({
  group: 'retire', kicker: 'Tab by tab · Retirement', name: 'Retirement', q: 'Will it last, and how do we get there?',
  points: [
    ['15 withdrawal strategies', 'Each with a one-line blurb and Use this one. Your choice is the plan\'s chance of success.'],
    ['The Drawdown Simulator, on your plan', 'Savings, ages and Social Security come in as facts; the mix and strategy settings are saved.'],
    ['Three views', 'Drawdown, Bridge to 59½ when someone retires early, and Health cover until Medicare.'],
    ['The years before 65', 'ACA premiums before Medicare, then Part B, Part D and IRMAA after.'],
  ],
  art: P([[dcard('dk_retirement__at-retirement')], [dcard('dk_x_ret_strategies', { b: 0.515 })], [dcard('dk_x_ret_health', { l: 0.338, r: 0.998, t: 0.076, b: 0.304, radius: 30 })]]),
  note: 'Retirement opens with the plan at retirement, then a switch between three views. Drawdown is the Drawdown Simulator on the plan, with all 15 strategies one click away; the sample uses Guyton-Klinger Guardrails. Bridge to 59½ appears when someone retires before 59½. Health cover runs the Healthcare Cost Planner: the sample stops work in 2048 and needs three years of marketplace cover before Medicare.',
});

// 14. Tools, Next steps and Learn
await tab({
  group: 'more', kicker: 'Tools · Next steps · Learn', name: 'Tools, next steps and Learn', q: 'What else can we try, and what should we do next?',
  points: [
    ['14 tools, filled in', 'Each opens inside the Dashboard with your numbers, to try things on without changing the plan.'],
    ['Next steps, ranked', 'Ordered by how many readiness points each would add, each with a button to the right tab.'],
    ['66 lessons in 8 tracks', '"Next for you" picks a lesson from your plan, and lessons show your own numbers.'],
  ],
  art: P([[dview('dk_tools_view', { t: 0.0, b: 0.59 })], [dcard('dk_overview__what-to-do-next')], [dcard('dk_learn__health-cover-before-65')]]),
  note: 'Tools lists all 14 of the site\'s tools, each with a line from your plan, like "Your plan: lasted in 100% of past markets". A tool opens with everything known filled in; changes there are a sandbox and never touch the plan, except College Savings\' Apply to my plan. Next steps ranks what to do by how much it moves the plan. Learn holds the site\'s 66 lessons, picks one for you, and shows your own figures inside them.',
});

// 15. Profile and profiles
await tab({
  group: 'dash', kicker: 'Tab by tab · Profile', name: 'Profile and profiles', tl: 1, q: 'Where is everything set, and can we try another plan?',
  points: [
    ['Every answer, editable in place', 'Edits save as you type, and a bar says what changed and what it did to the plan, with Undo.'],
    ['Assumptions', 'Growth and inflation, with five presets from very conservative to aggressive.'],
    ['Several profiles', 'A couple\'s plan and a solo one, for example: start fresh, or copy the one you have.'],
  ],
  art: P([[dcard('dk_profile__household'), dcard('dk_x_profile_new', { pad: 0, radius: 26 })], [dcard('dk_x_profile_profiles')], [dcard('dk_profile__assumptions')]]),
  note: 'Profile holds every setup answer, each editable where it stands, and the plan\'s assumptions: 4.5% growth after 3% inflation by default. After any edit a bar says what changed and what it did, for example to the chance of success, with Keep and Undo. An account can hold several profiles: here a copy of Sam and Jordan\'s plan for Sam on his own. Which one is open is remembered per device, and every profile syncs.',
});

// 16. In numbers
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'In numbers'); title(s, 'What is inside the Dashboard');
  const tiles = [
    ['15', 'tabs, every one worked out from one profile', 'LuLayoutGrid'], ['14', 'tools that open with your numbers filled in', 'LuWrench'],
    ['15', 'withdrawal strategies to test your plan with', 'LuSunset'], ['100', 'years of monthly market history: every starting month since 1926', 'LuChartLine'],
    ['66', 'lessons in 8 tracks, with 39 interactive widgets', 'LuGraduationCap'], ['24', 'Help guides: 10 for the tabs, 14 for the tools', 'LuLifeBuoy'],
    ['53', 'plain-language tips on what a figure is and why', 'LuCircleHelp'], ['5', 'kinds of change to plan ahead with', 'LuCalendarRange'],
  ];
  const tw = (W - 2 * M - 3 * 0.25) / 4, th = 2.42;
  for (let i = 0; i < tiles.length; i++) {
    const x = M + (i % 4) * (tw + 0.25), y = 1.72 + Math.floor(i / 4) * (th + 0.25);
    rect(s, x, y, tw, th, X.surface, { round: true, r: 0.14 });
    rect(s, x + tw - 0.86, y + 0.3, 0.58, 0.58, mix(X.amber, 0.22), { round: true, r: 0.12 });
    await iconIn(s, tiles[i][2], 'FFB340', x + tw - 0.75, y + 0.41, 0.36);
    T(s, tiles[i][0], { x: x + 0.28, y: y + 0.28, w: tw - 1.1, h: 0.95, fontSize: 54, bold: true, color: i === 0 ? X.amber : X.text });
    T(s, tiles[i][1], { x: x + 0.28, y: y + 1.35, w: tw - 0.56, h: 0.9, fontSize: 15, color: X.muted });
  }
  notes(s, 'Fifteen tabs, all from one profile. The fourteen tools of the main site open inside it with your numbers. Fifteen withdrawal strategies. A hundred years of monthly market history, so a plan is tested from every starting month since 1926. The 66 lessons of Learn, with 39 interactive widgets. Twenty-four step-by-step Help guides and 53 plain-language tips. And five kinds of change to plan ahead with.');
}

// 17. The report and the check-in email
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'Beyond the screen'); title(s, 'On paper, and a reminder once a month');
  const pages = await reportPages();
  const pick = [0, 1, 2, 9, 13], ph = 3.2, pw = ph * 8.5 / 11;
  pick.forEach((n, i) => s.addImage({ path: pages[n].path, x: M + 0.1 + i * 1.18, y: 1.85 + Math.abs(i - 2) * 0.08, w: pw, h: ph, rotate: (i - 2) * 3, shadow: shadow() }));
  const lx = M, lw = 6.6;
  T(s, 'Print your plan', { x: lx, y: 5.42, w: lw, h: 0.4, fontSize: 18, bold: true, color: X.amber });
  T(s, 'The whole Dashboard as US Letter pages: 14 standard ones plus up to 7 that fit the household, like Your child or Getting to 59½. Built in the browser; nothing is sent anywhere to make it.', { x: lx, y: 5.85, w: lw, h: 1.0, fontSize: 13, color: X.muted });
  const rx = 7.75, rw = W - rx - M;
  const em = await dcard('dk_x_email', { pad: 0, t: 0, b: 0.58, radius: 18 });
  fit(s, em, rx, 1.75, rw, 3.45);
  T(s, 'The monthly check-in email', { x: rx, y: 5.42, w: rw, h: 0.4, fontSize: 18, bold: true, color: X.amber });
  T(s, 'Sent only when balances are 30 or more days old, at most about once per month. No dollar figures and no plan results. One click turns it off.', { x: rx, y: 5.85, w: rw, h: 1.0, fontSize: 13, color: X.muted });
  notes(s, 'Print your plan builds the whole Dashboard as a report in the browser: the sample\'s runs to 19 pages, from a cover to every year of retirement, ready to print or save as a PDF. The monthly check-in email, on by default once the Dashboard is set up, goes out only when balances are a month old. It says when you last updated, lists what a check-in is, and links to the Dashboard. It carries no figures, because figures are only ever worked out in your browser.');
}

// 18. Help in the right places
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'Explained as you go'); title(s, 'Help where the questions come up');
  const a = await dcard('dk_x_summary_assumptions');
  const h = await dview('dk_x_help_accounts');
  const lw = 6.55, top = 1.72, ih = 3.55;
  fit(s, a, M, top, lw, ih);
  fit(s, h, M + lw + 0.4, top, W - 2 * M - lw - 0.4, ih);
  const cols = [[M, lw, 'How your assumptions compare', 'Growth, inflation, raises, Social Security, how long the plan runs and more, each rated from very conservative to very aggressive, with what it does to savings at retirement. No score, just where each guess sits.'], [M + lw + 0.4, W - 2 * M - lw - 0.4, 'Help guides and tips', '24 step-by-step guides open beside the page and point at each part in turn. 53 "?" tips say what a figure is and how the plan uses it.']];
  cols.forEach(([x, w, hh, l]) => { T(s, hh, { x, y: top + ih + 0.25, w, h: 0.4, fontSize: 18, bold: true, color: X.amber }); T(s, l, { x, y: top + ih + 0.68, w, h: 1.05, fontSize: 13, color: X.muted }); });
  notes(s, 'How your assumptions compare rates each guess about the future against balanced middles: growth, inflation, raises, the children\'s costs, Social Security and how long the plan runs. The sample rates balanced overall, with its zero raises rated conservative. And on the tabs, Help opens a step-by-step guide in a side panel that highlights each part in turn; here it is on Net worth.');
}

// 19. Phones
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'On a phone'); title(s, 'Every tab works on a phone');
  const list = [['dk_ph_overview', 'Dashboard: the answer first'], ['dk_ph_accounts', 'Net worth, updated on the go'], ['dk_ph_savings', 'Taxes & Savings: the paycheck'], ['dk_ph_retirement', 'Retirement, on the plan'], ['dk_x_ph_more', 'More opens every other tab']];
  const gap = 0.18, pw = (W - 2 * M - 4 * gap) / 5, ph = pw / (1290 / 2634);
  for (let i = 0; i < list.length; i++) {
    const p = await phone(list[i][0]);
    const x = M + i * (pw + gap);
    s.addImage({ path: p.path, x, y: 1.6, w: pw, h: ph });
    T(s, list[i][1], { x, y: 1.6 + ph + 0.08, w: pw, h: 0.3, fontSize: 12, color: X.muted, align: 'center' });
  }
  notes(s, 'Everything works on a phone. The rail becomes a bottom tab bar with the Dashboard, Plan summary, Calculator and Retirement, and More opens every other tab with the theme switch. The bar slides away as you scroll down and comes back on the way up. Charts read out with tap-and-drag, wide tables scroll inside their box, and the Dashboard can be added to the home screen and opens full screen like an app.');
}

// 20. Privacy and cost: where your data lives
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'Privacy and cost'); title(s, 'Where your numbers live, and what it costs');
  // the browser
  rect(s, M, 1.72, 4.1, 5.13, X.surface, { round: true, r: 0.16, line: X.amber, lw: 1.5 });
  await iconIn(s, 'LuMonitorSmartphone', 'FFB340', M + 0.25, 1.92, 0.42);
  T(s, 'Your browser', { x: M + 0.8, y: 1.92, w: 3, h: 0.42, fontSize: 18, bold: true, valign: 'middle' });
  const inB = [['Your Dashboard', 'saved here first, as you type'], ['Every calculation', 'the plan, history, taxes and scores run here'], ['The printable report', 'built here from your data'], ['Your figures', 'leave it only to sync to your account']];
  inB.forEach(([h, l], i) => { const y = 2.55 + i * 1.05; rect(s, M + 0.25, y, 3.6, 0.88, X.raised, { round: true, r: 0.1 }); T(s, [{ text: h, options: { bold: true, breakLine: true } }, { text: l, options: { color: X.muted, fontSize: 12 } }], { x: M + 0.42, y: y + 0.08, w: 3.3, h: 0.72, fontSize: 14, valign: 'middle' }); });
  // the account and the email
  const ax = 5.55, aw = 3.3;
  rect(s, ax, 1.72, aw, 2.05, X.surface, { round: true, r: 0.14, line: X.teal, lw: 1.5 });
  T(s, [{ text: 'Your account', options: { bold: true, fontSize: 17, breakLine: true } }, { text: 'A synced copy, so the Dashboard is on every device you sign in on. Only you can read it. The server stores it and never computes with it.', options: { color: X.muted, fontSize: 12.5 } }], { x: ax + 0.22, y: 1.82, w: aw - 0.44, h: 1.85, fontSize: 14, valign: 'middle' });
  arrow(s, M + 4.1, 2.75, ax, 2.75, X.teal, { begin: 'triangle', w: 1.5 });
  T(s, 'syncs', { x: M + 4.15, y: 2.4, w: 0.8, h: 0.3, fontSize: 11, color: X.teal, align: 'center' });
  rect(s, ax, 4.0, aw, 1.45, X.surface, { round: true, r: 0.14, line: X.rule });
  T(s, [{ text: 'The check-in email', options: { bold: true, fontSize: 15, breakLine: true } }, { text: 'Knows your email, first name and the date of your last balances. No figures.', options: { color: X.muted, fontSize: 12.5 } }], { x: ax + 0.22, y: 4.08, w: aw - 0.44, h: 1.3, fontSize: 14, valign: 'middle' });
  rect(s, ax, 5.68, aw, 1.17, null, { round: true, r: 0.14, line: X.loss, dash: 'dash' });
  T(s, [{ text: 'Never connected', options: { bold: true, color: X.loss, breakLine: true } }, { text: 'Bank logins, advertisers, anyone buying data', options: { color: X.muted, fontSize: 12.5 } }], { x: ax + 0.22, y: 5.78, w: aw - 0.44, h: 0.95, fontSize: 15, valign: 'middle' });
  // the stats
  const sx = 9.35, sw = W - sx - M;
  [['$0', 'Free, with a free account. Sign in with Google or a code emailed to you; no passwords.'], ['0', 'bank logins: you type your own numbers'], ['0', 'ads. Your data is never sold or shared with advertisers.']].forEach(([n, l], i) => {
    const y = 1.72 + i * 1.5;
    T(s, n, { x: sx, y, w: sw, h: 0.7, fontSize: 44, bold: true, color: i === 0 ? X.amber : X.text });
    T(s, l, { x: sx, y: y + 0.72, w: sw, h: 0.7, fontSize: 12.5, color: X.muted });
  });
  T(s, 'Download my data, or delete the account and everything in it, any time.', { x: sx, y: 6.2, w: sw, h: 0.62, fontSize: 12.5, color: X.text });
  notes(s, 'Where the numbers live. Everything is worked out in your browser: the plan, the history runs, taxes, the scores and the report. The Dashboard is saved there first and synced to your account so it is on every device you sign in on; database rules mean only you can read it, and the server stores it without computing anything. The check-in email knows only your email, first name and when you last updated balances. There are no bank connections and no advertisers. It is free; an account just needs Google or a 6-digit code by email. You can download your data or delete the account at any time.');
}

// 21. Close
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: MAIN });
  logo(s, M, 0.6, 0.55);
  T(s, [{ text: 'Set up your', options: { breakLine: true } }, { text: 'Dashboard.', options: { color: X.amber } }], { x: M, y: 1.55, w: 6.6, h: 2.2, fontSize: 54, bold: true, lineSpacingMultiple: 0.95 });
  T(s, 'One profile, every tab, tested against every market since 1926. Free, with no bank logins and no ads.', { x: M, y: 3.85, w: 5.6, h: 0.9, fontSize: 18, color: X.muted });
  T(s, [link(DASH_URL, 'retcalc.app/dashboard')], { x: M, y: 4.95, w: 6, h: 0.7, fontSize: 32, bold: true, color: X.amber });
  T(s, 'Create a free account: Google, or a 6-digit code emailed to you.', { x: M, y: 5.65, w: 6, h: 0.4, fontSize: 14 });
  T(s, 'Appendix: each tab in more depth, and how the Dashboard works.', { x: M, y: 6.9, w: 7, h: 0.35, fontSize: 12, color: X.muted });
  const ar = 1290 / 2634, ch = 5.75, cw = ch * ar, sh = 5.0, sw = sh * ar, ax = 6.95, aw = W - 0.45 - ax;
  const cx = ax + (aw - cw) / 2, base = 0.85 + ch;
  const sides = [['dk_ph_summary', ax], ['dk_ph_years', ax + aw - sw]];
  for (const [n, x] of sides) { const p = await phone(n); s.addImage({ path: p.path, x, y: base - sh - 0.1, w: sw, h: sh }); }
  const p = await phone('dk_ph_overview'); s.addImage({ path: p.path, x: cx, y: 0.85, w: cw, h: ch });
  notes(s, 'That is My Dashboard: one profile, fifteen tabs, a report on paper and a nudge once a month. It is at retcalc.app/dashboard, and a free account is all it takes. The appendix that follows has a deeper look at several tabs and the full story of how it works.');
}

/* =====================================================================
   APPENDIX
   ===================================================================== */
pres.addSection({ title: APP });
const appendix = [];
const A = (name, fn) => appendix.push({ name, fn });
const HOW = (name, fn) => appendix.push({ name, fn, how: true });

/* Deep-dive slide: text column on the left, a tinted panel of screenshots on the right. */
const deep = (spec) => A(spec.name, async () => {
  const s = pres.addSlide({ masterName: 'SPLIT', sectionTitle: APP });
  const g = GROUP[spec.group];
  kick(s, spec.kicker || g.name); title(s, spec.name);
  let y = underTitle(spec.name);
  if (spec.q) { const n = qLines(spec.q, 34); T(s, spec.q, { x: M, y, w: 4.45, h: n * 0.29 + 0.05, fontSize: 17, bold: true, color: g.color }); y += n * 0.29 + 0.3; }
  if (spec.desc) { T(s, spec.desc, { x: M, y, w: 4.45, h: spec.dh || 1.0, fontSize: 14, color: X.muted }); y += (spec.dh || 1.0) + 0.15; }
  for (const [h, items] of spec.sections || []) {
    label(s, h, M, y, 4.4); y += 0.32;
    const hh = items.reduce((a, t) => a + Math.ceil(t.length / 46), 0) * 0.245 + items.length * 0.045 + 0.08;
    T(s, bullets(items, { gap: 3 }), { x: M, y, w: 4.45, h: hh, fontSize: 14 }); y += hh + 0.2;
  }
  if (spec.stat) { const sy = Math.max(y + 0.05, 5.65); T(s, spec.stat[0], { x: M, y: sy, w: 4.4, h: 0.6, fontSize: 34, bold: true, color: g.color }); T(s, spec.stat[1], { x: M, y: sy + 0.62, w: 4.4, h: 0.3, fontSize: 12, color: X.muted }); if (sy > 6.05) console.log('  stat low:', spec.name, sy.toFixed(2)); }
  rect(s, 5.45, 0, W - 5.45, H, tint(spec.group));
  if (spec.art) await spec.art(s, 5.45, W - 5.45);
  else panel(s, await Promise.all(spec.rows.map((r) => Promise.all(r))), 5.85, 0.4, W - 5.45 - 0.8, H - 0.8 - (spec.cap ? 0.25 : 0), 0.24);
  if (spec.cap) T(s, spec.cap, { x: 5.85, y: 7.02, w: W - 6.25, h: 0.3, fontSize: 11, color: X.muted, align: 'right' });
});

// Every tab at a glance
A('Every tab at a glance', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'At a glance'); title(s, 'Fifteen tabs, in the order of the sidebar');
  const cw = (W - 2 * M - 2 * 0.25) / 3, rh = 0.92;
  for (let i = 0; i < TABS.length; i++) {
    const [n, ic, l] = TABS[i], x = M + Math.floor(i / 5) * (cw + 0.25), y = 1.72 + (i % 5) * (rh + 0.1);
    rect(s, x, y, cw, rh, X.surface, { round: true, r: 0.1 });
    rect(s, x + 0.18, y + 0.2, 0.52, 0.52, mix(X.amber, 0.22), { round: true, r: 0.1 });
    await iconIn(s, ic, 'FFB340', x + 0.29, y + 0.31, 0.3);
    T(s, [{ text: `${i + 1}  ${n}`, options: { bold: true, breakLine: true } }, { text: l, options: { color: X.muted, fontSize: 11.5 } }], { x: x + 0.85, y: y + 0.06, w: cw - 1.0, h: rh - 0.12, fontSize: 14, valign: 'middle' });
  }
});

deep({ group: 'dash', kicker: 'Dashboard', name: 'The home tab, below the fold', q: 'What to do next, what is filled in, and the years ahead',
  sections: [['What to do next', ['The top four steps, ordered by how much each moves the plan']], ['Your profile', ['Ten sections, each with a check or Fill in']], ['Your timeline', ['A lane per person: work, retirement, Medicare at 65, Social Security', 'A lane per child, and one for the mortgage']]],
  rows: [[dcard('dk_overview__what-to-do-next'), dcard('dk_overview__your-profile')], [dcard('dk_overview__your-timeline')]] });

deep({ group: 'money', kicker: 'Net worth', name: 'Net worth, in depth', q: 'When can we spend it, and how much is taxed?',
  sections: [['When you can spend it', ['Now: cash, brokerage, Roth contributions', 'At 59½: 401(k)s, IRAs and Roth growth', 'At 65: the HSA; a 457(b) when its owner leaves work']], ['How it\'s taxed', ['Taxed when spent against tax-free, as shares', 'By pre-tax, Roth, brokerage, HSA and cash']], ['Your entries', ['Every dated entry, with its change and a CSV']]],
  rows: [[dcard('dk_accounts__when-you-can-spend-it'), dcard('dk_accounts__how-it-s-taxed')], [dcard('dk_accounts__your-entries')]] });

deep({ group: 'money', kicker: 'Taxes & Savings', name: 'The paycheck, line by line', q: 'Every dollar of pay, given a place',
  desc: 'The household\'s one tax calculator. Its taxes are "pay after taxes" on every tab.', dh: 0.75,
  sections: [['Start from a plan', ['The usual order', 'Max tax breaks', 'Stay flexible']], ['A slider per line', ['401(k) up to the match, HSA, emergency fund', 'IRA (Traditional or Roth), 401(k) beyond the match, brokerage']]],
  rows: [[dcard('dk_savings__where-the-rest-goes')], [dcard('dk_savings__itemized-paycheck', { b: 0.42 })]] });

deep({ group: 'plan', kicker: 'Year by year', name: 'Every year to retirement', q: 'The years the plan is built from',
  sections: [['Columns', ['Coming in: each person\'s pay, other income', 'Going out: taxes and spending', 'Saved: Traditional, Roth and HSA, brokerage, emergency fund, the match']], ['Type your own', ['Click a pay or spending figure', 'For just this year, or until retirement', '"Use the plan\'s figure" undoes it']]],
  rows: [[dcard('dk_years__every-year-to-retirement')]] });

deep({ group: 'plan', kicker: 'Calculator', name: 'The projection', q: 'Rate band, history or Monte Carlo',
  sections: [['On the chart', ['Ages on the axis and a mark where each change starts', 'A historical mix: US stocks, small-cap value, bonds and cash', 'Full screen, milestones and stage by stage, with a CSV']], ['When you could stop saving', ['The earliest age you could stop outright and still reach the target', 'One click adds it to your changes']]],
  stat: ['5,000', 'Monte Carlo runs on every redraw'],
  rows: [[dcard('dk_calculator__balance-over-time-inflation-')], [dcard('dk_calculator__when-you-could-stop-saving')]] });

deep({ group: 'retire', kicker: 'Retirement', name: 'Fifteen ways to spend it', q: 'Pick a strategy; the plan follows',
  sections: [['From', ['A fixed amount rising with prices', 'Shares of the portfolio: % of portfolio, 95% rule, 1/N, RMD, VPW', 'Guardrails, floors and ceilings, Vanguard, Yale', 'Hebeler Autopilot II, sensible withdrawals, CAPE-based']], ['Then', ['"How the withdrawal strategies compare" side by side', 'The chosen one is the chance of success on every tab']]],
  rows: [[dcard('dk_x_ret_strategies')]] });

deep({ group: 'retire', kicker: 'Retirement', name: 'Before 59½ and before 65', q: 'The bridge, and health cover until Medicare',
  sections: [['Bridge to 59½', ['Shown when someone retires before 59½', 'The Early Retirement Bridge on the plan, with the strategy\'s withdrawals', '5 markets from history: 90th, 75th, median, 25th, 10th', 'Use this bridge plan saves it to the plan']], ['Health cover', ['The Healthcare Cost Planner on the plan', 'ACA premiums before 65; Part B, Part D and IRMAA after']]],
  cap: 'Top: the sample with Sam retiring at 55 instead of 60. Bottom: the sample as it is.',
  rows: [[dview('dk_x_ret_bridge_view', { l: 0.068, r: 0.99, t: 0.405, b: 0.94 })], [dview('dk_x_ret_health_view', { l: 0.068, r: 0.99, t: 0.475, b: 0.955 })]] });

A('The readiness score', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Dashboard'); title(s, 'A readiness score out of 100, in five areas');
  const areas = [['Retirement outlook', 40, X.amber], ['Savings rate', 20, X.teal], ['Emergency fund', 15, X.sky], ['Debt', 15, X.lav], ['Monthly cash flow', 10, X.rose]];
  const bx = M, bw = 7.3; let x = bx;
  for (const [n, p, c] of areas) {
    const w = bw * p / 100; rect(s, x, 1.85, w - 0.05, 0.62, c, { round: true, r: 0.06 });
    T(s, String(p), { x, y: 1.85, w: w - 0.05, h: 0.62, fontSize: 18, bold: true, color: X.ground, align: 'center', valign: 'middle' });
    x += w;
  }
  areas.forEach(([n, p, c], i) => { const y = 2.75 + i * 0.5; circle(s, M, y + 0.1, 0.2, c); T(s, n, { x: M + 0.35, y, w: 3.5, h: 0.4, fontSize: 15, bold: true, valign: 'middle' }); T(s, p + ' points', { x: M + 3.6, y, w: 1.5, h: 0.4, fontSize: 14, color: X.muted, valign: 'middle' }); });
  label(s, 'The word beside the score', M, 5.4, 7);
  [['On track', '85 and up', X.gain], ['Nearly there', '70 to 84', X.teal], ['Getting there', '50 to 69', X.amber], ['Needs work', 'under 50', X.loss]].forEach(([w, r, c], i) => { const xx = M + i * 1.85; rect(s, xx, 5.75, 1.7, 1.05, X.surface, { round: true, r: 0.1 }); T(s, [{ text: w, options: { bold: true, color: c, breakLine: true } }, { text: r, options: { color: X.muted, fontSize: 12 } }], { x: xx + 0.15, y: 5.82, w: 1.45, h: 0.9, fontSize: 14, valign: 'middle' }); });
  const r = await dcard('dk_overview__readiness-score');
  fit(s, r, 8.3, 1.85, W - 8.3 - M, 3.5);
  T(s, 'Each area opens to say why it scored as it did and what would raise it, with a button to the tab that does it. The readiness score and the chance of success are different things: one rates the whole household, the other is the share of past retirements that lasted.', { x: 8.3, y: 5.5, w: W - 8.3 - M, h: 1.35, fontSize: 13, color: X.muted });
});

A('The report, page by page', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Print your plan'); title(s, 'The sample\'s report: 19 pages, built in the browser');
  const pages = await reportPages();
  const pick = [0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 13, 15];
  const ph = 2.3, pw = ph * 8.5 / 11, gap = (W - 2 * M - 6 * pw) / 5;
  pick.forEach((n, i) => s.addImage({ path: pages[n].path, x: M + (i % 6) * (pw + gap), y: 1.66 + Math.floor(i / 6) * (ph + 0.18), w: pw, h: ph }));
  T(s, 'Twelve of the 19 pages. The report keeps its own light look, so it prints well.', { x: M, y: 1.66 + 2 * ph + 0.3, w: W - 2 * M, h: 0.32, fontSize: 13, color: X.muted });
});

A('Phones, more tabs', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'On a phone'); title(s, 'More tabs on a phone');
  const list = [['dk_ph_summary', 'Plan summary'], ['dk_ph_spending', 'Spending'], ['dk_ph_years', 'Year by year'], ['dk_x_ph_tools', 'Tools, in the compact view'], ['dk_ph_learn', 'Learn']];
  const gap = 0.18, pw = (W - 2 * M - 4 * gap) / 5, ph = pw / (1290 / 2634);
  for (let i = 0; i < list.length; i++) { const p = await phone(list[i][0]); const x = M + i * (pw + gap); s.addImage({ path: p.path, x, y: 1.6, w: pw, h: ph }); T(s, list[i][1], { x, y: 1.6 + ph + 0.08, w: pw, h: 0.3, fontSize: 12, color: X.muted, align: 'center' }); }
});

/* ---------- how it works ---------- */
const box = (s, x, y, w, h, head, body, o = {}) => {
  rect(s, x, y, w, h, o.fill ?? X.raised, { round: true, r: 0.1, line: o.line || X.rule, lw: o.lw || 1, dash: o.dash });
  T(s, [{ text: head, options: { bold: true, color: o.hc || X.text, breakLine: !!body } }, ...(body ? [{ text: body, options: { color: X.muted, fontSize: o.bs || 12 } }] : [])], { x: x + 0.16, y: y + 0.06, w: w - 0.32, h: h - 0.12, fontSize: o.fs || 14, valign: 'middle' });
};

HOW('The architecture', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'How it works'); title(s, 'Browser first: the engine runs on your device');
  const bx = M, by = 1.72, bw = 7.6, bh = 5.13;
  rect(s, bx, by, bw, bh, X.surface, { round: true, r: 0.16, line: X.rule });
  T(s, 'IN THE BROWSER', { x: bx + 0.25, y: by + 0.18, w: 4, h: 0.3, fontSize: 11, bold: true, color: X.muted, charSpacing: 1 });
  const iw = bw - 0.5, ix = bx + 0.25;
  box(s, ix, by + 0.55, iw, 0.78, 'Dashboard pages', 'Next.js App Router and React: 15 tabs, setup, the report, tools and Learn; rendered client-side behind a signed-in check');
  box(s, ix, by + 1.45, (iw - 0.2) / 2, 1.05, 'One profile record', 'per profile: the profile, dated balance entries and setup progress');
  box(s, ix + (iw + 0.2) / 2, by + 1.45, (iw - 0.2) / 2, 1.05, 'Browser storage, first', 'every write lands here before it syncs');
  box(s, ix, by + 2.62, iw, 1.05, 'Calculation engine', 'plain JavaScript math modules: projections, historical and Monte Carlo runs, the Drawdown Simulator, the bridge, taxes and benefits, with 100 years of market data. Heavy tool jobs can run in a Web Worker.', { line: X.amber, lw: 1.5, hc: X.amber });
  box(s, ix, by + 3.79, iw, 1.05, 'The site\'s tools, hosted', 'loaded on demand only when opened; seeded from the profile, edits kept to it (or not, in the Tools sandbox)');
  const rx = 8.75, rw = W - rx - M;
  T(s, 'ON SERVERS', { x: rx, y: by + 0.18, w: rw, h: 0.3, fontSize: 11, bold: true, color: X.muted, charSpacing: 1 });
  box(s, rx, by + 0.55, rw, 0.95, 'Vercel', 'serves the pages; no API route between you and your data');
  box(s, rx, by + 1.65, rw, 1.2, 'Supabase', 'Postgres with row-level security, called from the browser; sign-in by Google or an emailed code', { line: X.teal, lw: 1.5 });
  box(s, rx, by + 3.0, rw, 0.95, 'A daily scheduled function', 'sends the check-in email through Resend');
  box(s, rx, by + 4.1, rw, 1.03, 'Sentry', 'errors only, production only; inputs, addresses after ? or #, and user details stripped');
  arrow(s, bx + bw, by + 2.25, rx, by + 2.25, X.teal, { begin: 'triangle', w: 1.5 });
  notes(s, 'For a technical audience. The Dashboard is pages in a Next.js app, rendered client-side behind a signed-in check. Everything that computes runs in the browser: one record per profile, saved to browser storage first, and the same calculation engine as the public tools. The servers store and deliver: Vercel serves the pages, Supabase holds each person\'s synced data behind row-level security, a daily function sends the check-in email, and Sentry receives stripped error reports. Nothing is computed on a server.');
});

HOW('One record, one model', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'How it works'); title(s, 'One record in, every tab out');
  const y1 = 1.75, h1 = 1.55, w1 = 2.7, g = (W - 2 * M - 4 * w1) / 3;
  const top = [['The profile record', 'household, people, pay, budget, home, assumptions, Social Security, strategy, changes, children, each tool\'s choices', X.amber], ['model.ts', 'turns the profile and the latest entry into the engine\'s inputs', X.text], ['The engine', 'savings at retirement, the Drawdown run over every historical start, readiness, take-home', X.text], ['Every tab', 'reads it through one hook; a change on one tab reruns the plan everywhere', X.text]];
  top.forEach(([h, b, c], i) => { const x = M + i * (w1 + g); box(s, x, y1, w1, h1, h, b, { hc: c, line: i === 0 ? X.amber : X.rule, lw: i === 0 ? 1.5 : 1 }); if (i < 3) arrow(s, x + w1 + 0.03, y1 + h1 / 2, x + w1 + g - 0.03, y1 + h1 / 2); });
  label(s, 'Underneath', M, 3.48, 6);
  const y2 = 3.82, h2 = 1.3;
  const low = [['cover.ts', 'builds the plan year by year: pay with raises, taxes from the paycheck calculator, saving by account up to limits'], ['scenarios.ts', 'compiles the changes ahead, written in plain words, into those years'], ['calc.ts', 'builds the Calculator\'s stages from those years'], ['flows.ts', 'maps the profile to and from each hosted tool\'s inputs']];
  low.forEach(([h, b], i) => { const x = M + i * (w1 + g); box(s, x, y2, w1, h2, h, b, { fill: X.surface }); });
  rect(s, M, 5.35, W - 2 * M, 1.5, X.surface, { round: true, r: 0.12, line: X.teal, lw: 1.25 });
  T(s, [{ text: 'host.tsx: a tool inside the Dashboard', options: { bold: true, color: X.teal, breakLine: true } }, { text: 'Runs any of the site\'s tools in a scope: seeded from the profile, with locked fields listed as facts linking to where they are set, and a keep hook that writes edits back into the profile. The Tools tab passes no keep hook, so a tool opened there is a sandbox. Nothing on the Dashboard changes the public site\'s tools or their saved household.', options: { color: X.muted, fontSize: 13 } }], { x: M + 0.25, y: 5.42, w: W - 2 * M - 0.5, h: 1.36, fontSize: 15, valign: 'middle' });
});

HOW('Storage, sync and sign-in', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'How it works'); title(s, 'Local first, then synced to the account');
  const steps = [['You change a figure', 'on any tab'], ['Browser storage', 'written at once; it works when the account service is down'], ['Pushed to the account', 'shortly after, one JSON document per synced item'], ['Merged both ways', 'on sign-in and when the tab regains focus']];
  const cw = (W - 2 * M - 3 * 0.42) / 4;
  steps.forEach(([h, l], i) => { const x = M + i * (cw + 0.42); box(s, x, 1.75, cw, 1.35, h, l, { fill: i === 1 ? mix(X.amber, 0.25) : X.raised, line: i === 1 ? X.amber : X.rule, lw: i === 1 ? 1.5 : 1, hc: i === 1 ? X.amber : X.text, fs: 15, bs: 12.5 }); if (i < 3) arrow(s, x + cw + 0.05, 2.42, x + cw + 0.37, 2.42, X.muted, { w: 1.5 }); });
  const cols = [
    ['The merge', ['A three-way merge against the last synced copy', 'Deleted profiles are tracked, so one can\'t come back from another device', 'Signing out removes synced data from that browser; the account keeps it']],
    ['Signing in', ['Google, or a 6-digit code emailed to you; no passwords', 'Supabase Auth with the PKCE flow', 'An optional first name, asked once', 'Row-level security: each person reaches only their own data']],
    ['Leaving, and backups', ['Download my data as JSON, any time', 'Delete my account: a server-side function ends every session first, then erases everything', 'A scheduled job keeps encrypted backups of the database']],
  ];
  const w3 = (W - 2 * M - 2 * 0.3) / 3;
  cols.forEach(([h, xs], i) => { const x = M + i * (w3 + 0.3); rect(s, x, 3.4, w3, 3.45, X.surface, { round: true, r: 0.12 }); label(s, h, x + 0.25, 3.62, w3 - 0.5, X.amber); T(s, bullets(xs, { gap: 9 }), { x: x + 0.25, y: 4.02, w: w3 - 0.5, h: 2.7, fontSize: 15 }); });
});

HOW('The report and the email', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'How it works'); title(s, 'The report and the email');
  const w2 = (W - 2 * M - 0.4) / 2;
  // report
  rect(s, M, 1.72, w2, 5.13, X.surface, { round: true, r: 0.14 });
  label(s, 'The printable report: built in the browser', M + 0.25, 1.92, w2 - 0.5, X.amber);
  const rs = [['Gather', 'a report model collects the figures from the plan in the browser'], ['Lay out', 'US Letter sheets with their own charts; crowded sheets zoom to fit, down to 80%'], ['Print', 'the browser\'s own print dialog, to paper or PDF']];
  rs.forEach(([h, l], i) => { const y = 2.35 + i * 1.12; box(s, M + 0.25, y, 3.15, 0.92, h, l); if (i < 2) arrow(s, M + 1.82, y + 0.93, M + 1.82, y + 1.11); });
  const pages = await reportPages();
  [1, 9].forEach((n, i) => s.addImage({ path: pages[n].path, x: M + 3.6 + i * 1.2, y: 2.35 + i * 0.35, w: 1.7, h: 1.7 * 11 / 8.5, shadow: shadow() }));
  T(s, 'Nothing is sent anywhere to make it. Its pages follow the household: 14 standard ones, plus up to 7 such as Your child or Health cover before Medicare, each saying why it is there.', { x: M + 0.25, y: 5.8, w: w2 - 0.5, h: 0.95, fontSize: 13, color: X.muted });
  // email
  const ex = M + w2 + 0.4;
  rect(s, ex, 1.72, w2, 5.13, X.surface, { round: true, r: 0.14 });
  label(s, 'The monthly check-in email: knows little', ex + 0.25, 1.92, w2 - 0.5, X.amber);
  const es = [['A database function', 'finds who is due: balances 30 or more days old, none sent in 28 days'], ['A daily serverless function', 'builds the email and sends it through Resend'], ['One-click turn-off', 'a link signed with a server-side secret; the page turns it off on a button press, not on opening']];
  es.forEach(([h, l], i) => { const y = 2.35 + i * 1.12; box(s, ex + 0.25, y, w2 - 0.5, 0.92, h, l); if (i < 2) arrow(s, ex + w2 / 2, y + 0.93, ex + w2 / 2, y + 1.11); });
  T(s, [{ text: 'What it reads: ', options: { bold: true, color: X.text } }, { text: 'the email address, first name, the date of the latest balance entry and when the last check-in went out. No dollar figures and no plan results.', options: { color: X.muted } }], { x: ex + 0.25, y: 5.8, w: w2 - 0.5, h: 0.95, fontSize: 13 });
});

HOW('Testing', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'How it works'); title(s, 'How the Dashboard is tested');
  const st = [['33', 'Dashboard unit tests in 5 files: changes ahead, assumption benchmarks, the bridge budget and more'], ['41', 'sync tests across sync, merge and the account layer, including a whole sync against a fake account'], ['13', 'recorded Dashboard plans rerun and compared: savings at retirement, the share that lasts, saving year by year'], ['1,322', 'checks in 62 groups of engine math tests, which gate every commit and CI']];
  const tw = (W - 2 * M - 3 * 0.25) / 4;
  st.forEach(([n, l], i) => { const x = M + i * (tw + 0.25); rect(s, x, 1.72, tw, 2.55, X.surface, { round: true, r: 0.14 }); T(s, n, { x: x + 0.25, y: 1.9, w: tw - 0.5, h: 0.85, fontSize: 48, bold: true, color: i === 3 ? X.amber : X.text }); T(s, l, { x: x + 0.25, y: 2.85, w: tw - 0.5, h: 1.3, fontSize: 13.5, color: X.muted }); });
  label(s, 'Also in CI', M, 4.6, 6);
  T(s, bullets(['The site\'s numbers baseline and the Guide baseline', 'Guide, Budget, Tax and Advanced unit tests: a change that changes nothing must give the same figures to the cent', 'The check-in email and the database access rules', 'Lint and a production build'], { gap: 6 }), { x: M, y: 4.95, w: 7.3, h: 1.9, fontSize: 15 });
  rect(s, 8.3, 4.6, W - 8.3 - M, 2.25, X.surface, { round: true, r: 0.12, line: X.rule });
  T(s, [{ text: 'Not covered by the browser suite', options: { bold: true, breakLine: true } }, { text: 'The end-to-end browser specs cover the public tools, not the signed-in Dashboard. Dashboard screens were checked by hand and with screenshot scripts.', options: { color: X.muted, fontSize: 13.5 } }], { x: 8.52, y: 4.72, w: W - 8.3 - M - 0.44, h: 2.0, fontSize: 15, valign: 'middle' });
});

HOW('Code size', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'How it works'); title(s, 'About 12,600 lines of Dashboard code');
  s.addChart(pres.ChartType.bar, [{ name: 'Lines', labels: ['Dashboard components', 'Calculation engine', 'Learn components', 'Advanced Calculator', 'Account', 'Sync', 'Dashboard tests', 'Changes ahead UI', 'Dashboard routes'], values: [12467, 6774, 4125, 1971, 867, 492, 382, 356, 173] }], {
    x: M - 0.1, y: 1.65, w: 7.5, h: 5.2, barDir: 'bar', catAxisOrientation: 'maxMin', chartColors: [X.amber], showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: X.text, dataLabelFontSize: 12, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: '#,##0',
    catAxisLabelColor: X.text, catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', valAxisHidden: true, valAxisMaxVal: 14500, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false, barGapWidthPct: 45, catAxisLineShow: false,
    showTitle: true, title: 'Lines of code, counted on 11 November 2026', titleColor: X.muted, titleFontSize: 12, titleFontFace: '+mn-lt',
  });
  const st = [['66', 'files of Dashboard code: 55 components and 11 routes'], ['6,774', 'lines in the calculation engine it runs on, plus 1,326 of data'], ['30,822', 'lines in all the site\'s tools, which the Dashboard hosts'], ['1', 'engine: the Dashboard\'s figures come from the same one as the public tools']];
  st.forEach(([n, l], i) => { const y = 1.72 + i * 1.3; rect(s, 8.2, y, W - 8.2 - M, 1.15, X.surface, { round: true, r: 0.12 }); T(s, n, { x: 8.42, y: y + 0.1, w: 1.95, h: 0.95, fontSize: 28, bold: true, color: i === 0 ? X.amber : X.text, valign: 'middle' }); T(s, l, { x: 10.4, y: y + 0.1, w: W - 10.4 - M - 0.15, h: 0.95, fontSize: 12.5, color: X.muted, valign: 'middle' }); });
});

/* ---------- appendix divider, with a link to every appendix slide ---------- */
{
  const first = pres.slides.length + 2;
  const s = pres.addSlide({ masterName: 'DIVIDER', sectionTitle: APP });
  s.addText('APPENDIX', { placeholder: 'kicker' });
  s.addText('Each tab in depth, and how it works', { placeholder: 'title' });
  const groups = [['The tabs in depth', appendix.map((a, i) => [a, i]).filter(([a]) => !a.how)], ['How it works', appendix.map((a, i) => [a, i]).filter(([a]) => a.how)]];
  let y = 0.95;
  for (const [g, list] of groups) {
    label(s, g, 7.6, y, 5, X.amber); y += 0.38;
    T(s, list.map(([a, i], k) => ({ text: `${String(first + i).padStart(2, '0')}   ${a.name}`, options: { hyperlink: { slide: first + i }, breakLine: k < list.length - 1, paraSpaceAfter: 4 } })), { x: 7.6, y, w: 5.1, h: list.length * 0.28, fontSize: 13.5, color: X.text });
    y += list.length * 0.28 + 0.32;
  }
  s.addShape(pres.ShapeType.line, { x: 7.25, y: 0.95, w: 0, h: 5.95, line: { color: X.rule, width: 1 } });
  T(s, 'Every screenshot is a made-up household: Sam (42) and Jordan (40), daughter Nora, in Illinois.', { x: M, y: 5.3, w: 6.2, h: 0.7, fontSize: 13, color: X.muted });
}
for (const a of appendix) await a.fn();

const out = new URL('../RetCalc-Dashboard-Deck.pptx', import.meta.url).pathname;
await pres.writeFile({ fileName: out });
await applyTheme(out, THEME);
console.log('slides', pres.slides.length, '->', out);
