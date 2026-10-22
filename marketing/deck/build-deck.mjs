// The RetCalc deck: a 14-slide talk, then an appendix with every tool and the
// whole build. Dark Graphite slides with one amber accent, as on the site.
// Build: npm run deck (from tooling/). See ../README.md.
import fs from 'fs';
import { createRequire } from 'module';
import { card, shot, icon, coverArt, centurySeries } from './assets.mjs';
const require = createRequire(import.meta.url);
const pptxgen = require('../tooling/node_modules/pptxgenjs');
const sharp = require('../tooling/node_modules/sharp');
import { applyTheme } from './apply-theme.mjs';

/* ---------- theme: the site's Graphite palette ---------- */
const THEME = {
  name: 'RetCalc Graphite', headFontFace: 'Arial', bodyFontFace: 'Arial',
  colors: { dk1: '0E1116', lt1: 'FFFFFF', dk2: '1C222B', lt2: 'E8EBF0', accent1: 'E3A93B', accent2: '5AA9E6', accent3: '46B9A6', accent4: '9670EC', accent5: 'E0749B', accent6: '8A94A3', hlink: 'E3A93B', folHlink: '9AA4B2' },
};
const X = { ground: '0E1116', surface: '151A21', raised: '1C222B', rule: '2A313C', text: 'E8EBF0', muted: '9AA4B2', amber: 'E3A93B', sky: '5AA9E6', teal: '46B9A6', lav: '9670EC', rose: 'E0749B', gray: '8A94A3', gain: '4CC38A', loss: 'F0716A', paper: 'F3F1EC' };
const GROUP = {
  calc: { name: 'Calculators', color: X.amber }, income: { name: 'Retirement income', color: X.sky },
  saving: { name: 'Saving and investing', color: X.teal }, everyday: { name: 'Everyday money', color: X.lav },
  guide: { name: 'Guided walkthroughs', color: X.rose }, story: { name: 'Putting it together', color: X.amber },
  build: { name: 'Under the hood', color: X.gray },
};
const mix = (hex, t) => { // hex blended toward the ground color: t of hex
  const a = parseInt(hex, 16), g = parseInt(X.ground, 16);
  const ch = (v, s) => Math.round(((v >> s) & 255) * t + ((g >> s) & 255) * (1 - t));
  return [16, 8, 0].map((s) => ch(a, s).toString(16).padStart(2, '0')).join('').toUpperCase();
};
const W = 13.333, H = 7.5, M = 0.6;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'RetCalc'; pres.author = 'RetCalc'; pres.company = 'RetCalc';
const C = pres.SchemeColor;

/* ---------- layouts ---------- */
const footer = [
  { text: { text: 'RetCalc  ·  retcalc.app', options: { x: M, y: 7.02, w: 4, h: 0.3, fontSize: 10, color: X.muted, margin: 0 } } },
];
pres.defineSlideMaster({ title: 'COVER', background: { color: X.ground }, objects: [] });
pres.defineSlideMaster({
  title: 'DIVIDER', background: { color: X.ground },
  objects: [
    { placeholder: { options: { name: 'kicker', type: 'body', x: M, y: 0.6, w: 8, h: 0.4, fontSize: 14, bold: true, color: C.accent1, margin: 0, charSpacing: 3, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.0, w: 7.0, h: 3.0, fontSize: 60, bold: true, color: C.background2, margin: 0, valign: 'bottom', align: 'left' }, text: '' } },
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

/* ---------- helpers ---------- */
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, color: X.text, fontSize: 14, valign: 'top', ...o });
const shadow = () => ({ type: 'outer', color: '000000', blur: 20, offset: 8, angle: 90, opacity: 0.5 });
const img = (s, im, x, y, w, o = {}) => { const h = w / im.ar; s.addImage({ path: im.path, x, y, w, h, shadow: o.flat ? undefined : shadow(), rotate: o.rotate, objectName: o.name }); return h; };
const imgH = (s, im, x, y, h, o = {}) => img(s, im, x, y, h * im.ar, o);
const rect = (s, x, y, w, h, fill, o = {}) => s.addShape(o.round ? pres.ShapeType.roundRect : pres.ShapeType.rect, { x, y, w, h, fill: { color: fill, transparency: o.tr || 0 }, line: o.line ? { color: o.line, width: o.lw || 1 } : { type: 'none' }, rectRadius: o.round ? o.r ?? 0.12 : undefined, objectName: o.name });
const circle = (s, x, y, d, fill) => s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { type: 'none' } });
const iconIn = async (s, name, color, x, y, d, bg) => { if (bg) circle(s, x, y, d, bg); const p = await icon(name, color); const pad = bg ? d * 0.24 : 0; s.addImage({ path: p, x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad }); };
const link = (url, text) => ({ text: text || url.replace('https://', ''), options: { hyperlink: { url, tooltip: url } } });
const bullets = (items, o = {}) => items.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: o.gap ?? 6 } }));
const kick = (s, text) => s.addText(text.toUpperCase(), { placeholder: 'kicker' });
const title = (s, text) => s.addText(text, { placeholder: 'title' });
const notes = (s, text) => s.addNotes(text);
const stat = (s, x, y, w, n, label, o = {}) => {
  T(s, n, { x, y, w, h: o.nh || 0.62, fontSize: o.size || 34, bold: true, color: o.color || X.text });
  T(s, label, { x, y: y + (o.nh || 0.62) + 0.04, w, h: o.lh || 0.5, fontSize: o.lsize || 12, color: X.muted });
};
/** Where text starts under a left-column title: one line holds about 20 characters at 30pt. */
const underTitle = (name) => 0.98 + (name.length > 20 ? 2 : 1) * 0.47 + 0.2;
const qLines = (q, per = 34) => Math.ceil(q.length / per);
/** Lays rows of images into a box, every row filling its width, the whole scaled to fit. */
function panel(s, rows, bx, by, bw, bh, gap = 0.22) {
  const rowH = (row) => { const ws = bw - gap * (row.length - 1); return ws / row.reduce((a, im) => a + im.ar, 0); };
  const hs = rows.map(rowH), total = hs.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
  const k = Math.min(1, bh / total), w = bw * k, x0 = bx + (bw - w) / 2;
  let y = by + (bh - total * k) / 2;
  rows.forEach((row, i) => { let x = x0; for (const im of row) { const iw = im.ar * hs[i] * k; img(s, im, x, y, iw); x += iw + gap * k; } y += hs[i] * k + gap * k; });
}

/* ---------- assets ---------- */
const logoPng = new URL('./img/logo.png', import.meta.url).pathname;
await sharp(Buffer.from(fs.readFileSync(new URL('../shots/logo_nav.svg', import.meta.url), 'utf8').replace('class="brandmark"', 'xmlns="http://www.w3.org/2000/svg" width="256" height="256"').replace(/var\(--ds-brand-gold\)/g, '#e9b872').replace(/var\(--ds-brand-jade\)/g, '#4fbf95').replace(/var\(--ds-brand-steel\)/g, '#7d9fd6'))).png().toFile(logoPng);
const logo = (s, x, y, size, word = true) => { s.addImage({ path: logoPng, x, y, w: size, h: size }); if (word) T(s, 'RetCalc', { x: x + size + 0.12, y, w: 2, h: size, fontSize: size * 34, bold: true, valign: 'middle' }); };

/* =====================================================================
   MAIN DECK
   ===================================================================== */
const MAIN = 'The talk', APP = 'Appendix';
pres.addSection({ title: MAIN });

// 1. Cover
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: MAIN });
  const art = await coverArt('cover_fan', 1333, 470, { color: '#9aa4b2', hi: '#e3a93b' });
  s.addImage({ path: art.path, x: 0, y: 2.8, w: W, h: W * 470 / 1333, transparency: 15 });
  logo(s, M, 0.5, 0.42);
  T(s, 'PRODUCT OVERVIEW', { x: W - M - 4, y: 0.55, w: 4, h: 0.3, fontSize: 11, color: X.muted, align: 'right', charSpacing: 3 });
  T(s, [{ text: 'The complete', options: { breakLine: true } }, { text: 'retirement planning', options: { color: X.amber, breakLine: true } }, { text: 'toolkit.' }], { x: M, y: 1.25, w: 9.5, h: 2.75, fontSize: 60, bold: true, lineSpacingMultiple: 0.92 });
  T(s, 'A calculator, two guided walkthroughs and fourteen planning tools, each tested against every market since 1926.', { x: M, y: 4.05, w: 6.6, h: 0.8, fontSize: 18, color: X.muted });
  T(s, [link('https://retcalc.app', 'retcalc.app')], { x: W - M - 3, y: 6.85, w: 3, h: 0.4, fontSize: 18, bold: true, align: 'right', color: X.amber });
  T(s, 'Every 30-year stretch since 1926 for a 60/40 portfolio, after inflation. The amber line is the middle one.', { x: M, y: 6.95, w: 7, h: 0.3, fontSize: 10, color: X.muted });
  notes(s, 'RetCalc is a free retirement planning toolkit at retcalc.app. The art on this slide is real: every 30-year stretch of a 60/40 portfolio since 1926, after inflation, from the same data the tools use. The amber line is the middle outcome. That spread is the whole point of the site: plans are tested against all of those paths, not one average.');
}

// 2. What it is: a mosaic of real results from across the site
{
  const s = pres.addSlide({ masterName: 'SPLIT', sectionTitle: MAIN });
  kick(s, 'What it is'); title(s, 'A whole retirement plan, in one place');
  T(s, 'From a first paycheck to a last withdrawal: what to save, where to put it, whether it will last, what it costs in tax and health insurance, and when to claim Social Security.', { x: M, y: 2.55, w: 4.5, h: 1.45, fontSize: 15, color: X.muted });
  const st = [['14', 'planning tools'], ['3', 'calculators'], ['2', 'guided walkthroughs'], ['100 yrs', 'of monthly market data'], ['$0', 'no ads, no account needed']];
  st.forEach(([n, l], i) => stat(s, M + (i % 2) * 2.3, 4.2 + Math.floor(i / 2) * 0.85, 2.2, n, l, { size: 28, nh: 0.48, lh: 0.3, color: i === 0 ? X.amber : X.text }));
  rect(s, 5.45, 0, W - 5.45, H, X.surface);
  const rows = [
    [await card('drawdown_1_historicalmonte-carl', { t: 0, b: 0.62 }), await card('incometax_1_after-taxtake-homere', { t: 0.15, b: 1 })],
    [await card('stages_hist_45000', { t: 0.27, b: 0.8 }), await card('budget_1_where-it-goes', { t: 0, b: 0.535 })],
    [await card('ss_1_pick-the-age-you-cla', { t: 0, b: 0.8 })],
  ];
  panel(s, rows, 5.85, 0.4, W - 5.85 - 0.4, H - 0.8, 0.22);
  notes(s, 'These are real results from the live site: the Drawdown Simulator, Income Tax, the Stages calculator against history, the Budget, and Social Security. The whole site runs in the visitor\'s browser and covers the full arc, from saving to drawing it down. 14 tools, 3 calculators and 2 guided walkthroughs, all free, with no ads and no account required.');
}

// 3. Three ideas
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'How it works'); title(s, 'Three ideas run through every page');
  const cols = [
    ['LuHouse', '01', 'One household, every tool', 'Ages, state, savings, income and spending are entered once and fill in everywhere, and each tool hands its results to the next.'],
    ['LuHistory', '02', 'Tested against history', 'One average return hides the order returns come in, and that order decides whether a retirement lasts. Every plan is replayed through each starting month since January 1926.'],
    ['LuLock', '03', 'Private by default', 'Every calculation runs in the visitor\'s own browser. An optional account only keeps a household, saved scenarios and the Guide in step across devices.'],
  ];
  const cw = (W - 2 * M - 2 * 0.3) / 3;
  for (let i = 0; i < 3; i++) {
    const x = M + i * (cw + 0.3), y = 1.75, h = 5.05;
    rect(s, x, y, cw, h, X.raised, { round: true, r: 0.15 });
    await iconIn(s, cols[i][0], '0E1116', x + 0.35, y + 0.35, 0.72, X.amber);
    T(s, cols[i][1], { x: x + cw - 1.2, y: y + 0.35, w: 0.85, h: 0.5, fontSize: 24, bold: true, color: X.rule, align: 'right' });
    T(s, cols[i][2], { x: x + 0.35, y: y + 1.3, w: cw - 0.7, h: 0.8, fontSize: 22, bold: true });
    T(s, cols[i][3], { x: x + 0.35, y: y + 2.15, w: cw - 0.7, h: 1.8, fontSize: 14, color: X.muted });
  }
  // visuals along the bottom of each card
  { // 1: the household at the hub, six tools around it
    const x = M + 0.35, w = cw - 0.7, cx = x + w / 2, cy = 6.05;
    const pts = [[0.04, 5.55], [0.04, 6.55], [0.5, 6.62], [0.96, 5.55], [0.96, 6.55], [0.5, 5.48]];
    const cols = [X.amber, X.rose, X.sky, X.teal, X.lav, X.rose];
    pts.forEach(([fx, y]) => { const px = x + fx * w; s.addShape(pres.ShapeType.line, { x: Math.min(px, cx), y: Math.min(y, cy), w: Math.abs(px - cx) || 0.001, h: Math.abs(y - cy) || 0.001, flipH: (px > cx) !== (y > cy), line: { color: X.rule, width: 1.25, dashType: 'dash' } }); });
    pts.forEach(([fx, y], i) => circle(s, x + fx * w - 0.1, y - 0.1, 0.2, cols[i]));
    rect(s, cx - 0.8, cy - 0.21, 1.6, 0.42, X.amber, { round: true, r: 0.21 });
    T(s, 'Your household', { x: cx - 0.8, y: cy - 0.21, w: 1.6, h: 0.42, fontSize: 12, bold: true, color: X.ground, align: 'center', valign: 'middle' });
  }
  { // 2: a spark of the century
    const { years, vals } = centurySeries();
    const x = M + cw + 0.3 + 0.35;
    s.addChart(pres.ChartType.line, [{ name: 'US stocks', labels: years, values: vals }], { x, y: 5.6, w: cw - 0.7, h: 1.0, valAxisLogScaleBase: 10, valAxisHidden: true, catAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false, chartColors: [X.amber], lineSize: 2, lineDataSymbol: 'none', valAxisMinVal: 1, valAxisMaxVal: 1500 });
  }
  { // 3: the quote
    const x = M + 2 * (cw + 0.3) + 0.35;
    T(s, '"Nothing leaves your browser unless you sign in to save it."', { x, y: 5.7, w: cw - 0.7, h: 0.8, fontSize: 14, italic: true, color: X.amber });
  }
  notes(s, 'Three ideas. One: the household is entered once and every tool reads it, and tools hand results to each other. Two: plans are tested against real market history, month by month since 1926, not a single average return. Three: privacy. The math runs in the browser; an account only syncs saved inputs.');
}

// 4. A century of markets
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'Tested against history'); title(s, 'A hundred years of markets, every month of it');
  const { years, vals } = centurySeries();
  s.addChart(pres.ChartType.line, [{ name: '$1 in US stocks, after inflation', labels: years, values: vals }], {
    x: M - 0.15, y: 1.65, w: 8.6, h: 5.25, valAxisLogScaleBase: 10, valAxisMinVal: 1, valAxisMaxVal: 2000, chartColors: [X.amber], lineSize: 2.5, lineDataSymbol: 'none',
    showLegend: false, catAxisLabelColor: X.muted, valAxisLabelColor: X.muted, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11, catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
    valGridLine: { color: X.rule, size: 0.75 }, catGridLine: { style: 'none' }, catAxisLineShow: false, valAxisLineShow: false, catAxisLabelFrequency: 10, valAxisLabelFormatCode: '$#,##0',
    showTitle: true, title: '$1 invested in US stocks in January 1926, after inflation (log scale)', titleColor: X.muted, titleFontSize: 12, titleFontFace: '+mn-lt',
  });
  const rx = 9.55, rw = W - rx - M;
  T(s, '$1,140', { x: rx, y: 1.7, w: rw, h: 0.95, fontSize: 60, bold: true, color: X.amber });
  T(s, 'What that dollar grew to by the end of 2025, after inflation, with dividends reinvested.', { x: rx, y: 2.7, w: rw, h: 0.75, fontSize: 13, color: X.muted });
  T(s, 'THE STRETCHES THAT DECIDE A RETIREMENT', { x: rx, y: 3.65, w: rw, h: 0.3, fontSize: 11, bold: true, color: X.muted, charSpacing: 1 });
  [['−77%', 'The Great Depression', '1929–32'], ['−50%', 'Stagflation', '1973–74'], ['−45%', 'The dot-com bust', '2000–03'], ['−50%', 'The 2008 crash', '2007–09']].forEach(([n, l, yrs], i) => {
    const y = 4.05 + i * 0.72;
    T(s, n, { x: rx, y, w: 1.3, h: 0.6, fontSize: 28, bold: true, color: X.loss, valign: 'middle' });
    T(s, [{ text: l, options: { bold: true, color: X.text, breakLine: true } }, { text: yrs + ', after inflation', options: { color: X.muted, fontSize: 11 } }], { x: rx + 1.4, y, w: rw - 1.4, h: 0.6, fontSize: 14, valign: 'middle' });
  });
  notes(s, 'This is the data every tool tests against: 1,200 months of stock, bond and inflation history from January 1926 to December 2025, from Robert Shiller at Yale and the BLS. A dollar grew to about $1,140 after inflation, but the falls on the right are what break retirements. A plan that only sees the average never meets them; RetCalc replays every one.');
}

// 5. A tool for every stage
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'Where to start'); title(s, 'A tool for every stage of the road');
  const cols = [
    ['Today', 'Get the basics right', X.lav, ['Income Tax', 'Budget', 'Debt Payoff', 'Mortgage Calculator', 'Rent vs. Buy']],
    ['Saving years', 'Grow it', X.teal, ['Calculator', 'FIRE Calculator', 'Portfolio Backtest', 'College Savings']],
    ['Getting close', 'Plan the handoff', X.sky, ['Social Security Calculator', 'Healthcare Cost Planner', 'Early Retirement Bridge', 'Roth Conversion Calculator', 'Retirement Plan Optimizer']],
    ['Retired', 'Make it last', X.amber, ['Drawdown Simulator', 'Roth Conversion Calculator', 'Healthcare Cost Planner']],
  ];
  const cw = (W - 2 * M) / 4;
  cols.forEach(([t, sub, c, xs], i) => {
    const x = M + i * cw;
    s.addShape(i === 0 ? pres.ShapeType.homePlate : pres.ShapeType.chevron, { x: x + (i ? -0.12 : 0), y: 1.75, w: cw + (i ? 0.12 : -0.02), h: 0.95, fill: { color: c }, line: { type: 'none' }, adjustPoint: 0.28 });
    T(s, [{ text: t, options: { bold: true, fontSize: 20, breakLine: true } }, { text: sub, options: { fontSize: 12 } }], { x: x + (i ? 0.35 : 0.25), y: 1.75, w: cw - 0.6, h: 0.95, color: X.ground, valign: 'middle' });
    xs.forEach((n, j) => {
      const y = 2.95 + j * 0.62;
      rect(s, x + 0.08, y, cw - 0.28, 0.5, X.raised, { round: true, r: 0.1 });
      circle(s, x + 0.25, y + 0.18, 0.14, n === 'Calculator' ? X.amber : c);
      T(s, n === 'Calculator' ? [{ text: 'Calculator  ', options: { bold: true } }, { text: 'Basic · Advanced · Stages', options: { color: X.muted, fontSize: 11 } }] : n, { x: x + 0.52, y, w: cw - 0.8, h: 0.5, fontSize: 13, bold: n !== 'Calculator', valign: 'middle' });
    });
  });
  rect(s, M, 6.15, W - 2 * M, 0.6, X.surface, { round: true, r: 0.1, line: X.rule });
  T(s, [{ text: 'Most people start with the Calculator, or with a guide: ', options: { bold: true } }, { text: 'the Readiness Guide and Paycheck to Retirement open the right tools along the way.', options: { color: X.muted } }], { x: M + 0.3, y: 6.15, w: W - 2 * M - 0.6, h: 0.6, fontSize: 14, valign: 'middle' });
  notes(s, 'The tools follow the order life brings the questions: the basics today, growing savings, planning the handoff, and making it last. Two walkthroughs stitch them together for people who would rather be guided.');
}

/* Feature slide: text on the left, a tinted full-bleed panel of screenshots on the right. */
async function feature({ group, kicker, name, q, points, note, art }) {
  const s = pres.addSlide({ masterName: 'SPLIT', sectionTitle: MAIN });
  const g = GROUP[group];
  kick(s, kicker || g.name); title(s, name);
  const qy = underTitle(name), py = qy + qLines(q) * 0.3 + 0.45, step = Math.min(1.25, (6.75 - py) / points.length);
  T(s, q, { x: M, y: qy, w: 4.5, h: qLines(q) * 0.3 + 0.05, fontSize: 18, bold: true, color: g.color });
  points.forEach(([n, l], i) => {
    const y = py + i * step;
    T(s, n, { x: M, y, w: 4.4, h: 0.5, fontSize: 26, bold: true, color: X.text });
    T(s, l, { x: M, y: y + 0.5, w: 4.4, h: 0.62, fontSize: 13, color: X.muted });
  });
  rect(s, 5.45, 0, W - 5.45, H, mix(g.color, group === 'calc' ? 0.12 : 0.2));
  await art(s, 5.45, W - 5.45);
  if (note) notes(s, note);
  return s;
}

// 6. Stages
await feature({
  group: 'calc', kicker: 'Calculators', name: 'Stages calculator', q: 'What if my saving changes over the years?',
  points: [['Any number of stages', 'Each with its own saving, raises, return, volatility and account split, chained into one projection.'], ['Built around children', 'Planning for kids rebuilds the stages around the children you have or plan.'], ['Tested three ways', 'A rate band, every rolling window since 1926, or 5,000 Monte Carlo runs.']],
  note: 'Stages is the calculator for real life, where saving changes: early career, kids at home, peak earning, coasting. Each stage has its own numbers, and the kids builder can create the stages for you. The chart shows the sample plan against every historical window since 1926, with dashed lines where each stage begins. Basic and Advanced are in the appendix.',
  art: async (s, px, pw) => {
    const chart = await card('stages_hist_45000', { t: 0, b: 0.8 });
    const list = await card('stages_0_your-stages', { t: 0, b: 0.215 });
    img(s, chart, px + 0.45, 1.85, pw - 0.9);
    img(s, list, px + 0.45, 0.45, 3.5);
    T(s, 'Sample plan: early career, kids at home, peak earning, then coasting', { x: px + 4.25, y: 0.75, w: pw - 4.75, h: 0.9, fontSize: 13, color: X.muted });
  },
});

// 7. Drawdown
await feature({
  group: 'income', kicker: 'Retirement income', name: 'Drawdown Simulator', q: 'Will my money last?',
  points: [['15 strategies', 'From the 4% rule to guardrails, VPW and the Yale endowment rule, in five families.'], ['835 real retirements', 'Every monthly start since 1926, each run for 30 years, with Social Security and pensions.'], ['Ranked at equal risk', 'The strategy showdown tunes all 15 to the same risk, then compares what each spends.']],
  note: 'Most calculators ask how much you will have. This asks whether it lasts once spending starts. The sample here, a million dollars at 4%, lasted in 785 of 835 historical starts; it failed only for retirements beginning in the late 1960s. The success grid on the right shows every withdrawal rate against every stock share.',
  art: async (s, px, pw) => {
    const top = await card('drawdown_1_historicalmonte-carl');
    const grid = await card('drawdown_safe_4_success-grid', { t: 0.17, b: 0.81 });
    const h = img(s, top, px + 0.45, 0.45, pw - 0.9);
    const gw = pw - 2.2, gy = 0.45 + h + 0.3;
    img(s, grid, px + 1.75, gy, gw);
    T(s, 'Success grid: withdrawal rate against stock share, each cell the share of history that lasted', { x: px + 0.45, y: gy + 0.1, w: 1.15, h: 2.6, fontSize: 11, color: X.muted });
  },
});

// 8. Income Tax
await feature({
  group: 'everyday', kicker: 'Everyday money', name: 'Income Tax', q: 'How much tax will I owe?',
  points: [['50 states and DC', '2026 federal, state and FICA tax, with every state\'s retirement-income rules in plain English.'], ['A retirement mode', 'Withdrawals, gains and Social Security stacked the way the return really does it.'], ['A true marginal rate', 'Found by rerunning the whole return with $1,000 more.']],
  note: 'Income Tax works for a salary or for a year of retirement withdrawals. Retirement mode is the unusual part: it stacks long-term gains on top of ordinary income, taxes Social Security through the 0, 50 and 85 percent tiers, applies the senior deduction, and reports the real marginal rate on the next dollar.',
  art: async (s, px, pw) => {
    const work = await card('incometax_1_after-taxtake-homere', { t: 0.15, b: 1 });
    const ret = await card('incometax_ret_1_after-taxtake-homere', { t: 0.15, b: 1 });
    panel(s, [[work], [ret]], px + 0.45, 0.45, pw - 0.9, H - 1.3, 0.3);
    T(s, 'Top: a $100,000 salary, single, Illinois.   Bottom: $100,000 in retirement from four sources.', { x: px + 0.45, y: H - 0.65, w: pw - 0.9, h: 0.3, fontSize: 11, color: X.muted, align: 'center' });
  },
});

// 9. Budget and Paycheck
await feature({
  group: 'everyday', kicker: 'Everyday money', name: 'Budget and Paycheck', q: 'Where does my money go, and where should the rest go?',
  points: [['Two tabs', 'A budget of 18 lines in six groups, then a paycheck that pays it, line by line.'], ['Taxes rerun live', 'Sliders move money into the 401(k) match, HSA, IRA and brokerage, capped at 2026 limits.'], ['Two incomes', 'Each spouse with their own pay schedule, match and HSA limit.']],
  note: 'The Budget tab lays out spending. The Paycheck tab turns gross pay into taxes, bills and savings, and every slider reruns the tax math by deduction kind and by earner. Three one-click plans: the usual order, max tax breaks, or stay flexible. It can send the savings split straight into the Advanced or Stages calculator.',
  art: async (s, px, pw) => {
    const where = await card('budget_1_where-it-goes', { t: 0, b: 0.72 });
    const donut = await card('budget_pc_1_saved-and-invested-e');
    const rest = await card('budget_pc_2_where-the-rest-goes', { t: 0, b: 0.62 });
    panel(s, [[where, donut], [rest]], px + 0.45, 0.45, pw - 0.9, H - 0.9, 0.3);
  },
});

// 10. Readiness Guide
await feature({
  group: 'guide', kicker: 'Guided walkthrough', name: 'Retirement Readiness Guide', q: 'How ready am I, and what should I do next?',
  points: [['A score out of 100', 'Outlook, savings rate, emergency fund, debt and cash flow, weighted.'], ['Ten minutes or an hour', 'A twelve-card quick check, or the full walkthrough with trips into the tools.'], ['A plan on paper', 'Ends in a full-color report of about a dozen pages, built in the browser.']],
  note: 'The Guide is a check-up. It finds the number to aim for, tests it against history, scores readiness out of 100 and lists the moves that matter. The sample couple here scored 98. It ends in a printable report; the pages on the right are that couple\'s report.',
  art: async (s, px, pw) => {
    const view = await shot('guide_number_view', { t: 0.08, b: 0.92, radius: 22 });
    img(s, view, px + 0.45, 0.45, pw - 0.9);
    const pages = ['report_p00', 'report_p02', 'report_p04', 'report_p05', 'report_p08'];
    for (let i = 0; i < pages.length; i++) {
      const p = await shot(pages[i], { radius: 8 });
      imgH(s, p, px + 0.8 + i * 1.3, 4.45, 2.45, { rotate: (i - 2) * 3 });
    }
  },
});

// 11. Paycheck to Retirement
await feature({
  group: 'guide', kicker: 'Guided walkthrough', name: 'Paycheck to Retirement', q: 'Where should each paycheck go?',
  points: [['Five steps', 'Budget, paycheck, your plan, life stages, summary. About fifteen minutes.'], ['The real tools inside', 'Budget, Advanced and Stages run in the walkthrough on its own copy of the numbers.'], ['Copy into my tools', 'One click sends the results to Income Tax, Budget, Advanced and Stages.']],
  note: 'For people who would rather get straight to the numbers. Gross pay to take-home, a budget, where each paycheck goes, and where that saving leads by retirement, children included. It runs the real tools inside it and ends with a report.',
  art: async (s, px, pw) => {
    const rest = await card('plan_paycheck_3_where-the-rest-goes');
    const pc = await card('plan_paycheck_2_saved-and-invested-e');
    const steps = ['Start', 'Budget', 'Paycheck', 'Your plan', 'Life stages', 'Summary'];
    const sw = (pw - 0.9) / 6;
    steps.forEach((t, i) => {
      s.addShape(i ? pres.ShapeType.chevron : pres.ShapeType.homePlate, { x: px + 0.45 + i * sw - (i ? 0.08 : 0), y: 0.45, w: sw + (i ? 0.08 : 0), h: 0.55, fill: { color: i === 2 ? X.rose : mix(X.rose, 0.45) }, line: { type: 'none' }, adjustPoint: 0.3 });
      T(s, t, { x: px + 0.45 + i * sw + 0.12, y: 0.45, w: sw - 0.25, h: 0.55, fontSize: 11, bold: true, color: i === 2 ? X.ground : X.text, align: 'center', valign: 'middle' });
    });
    panel(s, [[pc], [rest]], px + 0.45, 1.3, pw - 0.9, H - 1.75, 0.3);
  },
});

// 12. One household
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'Putting it together'); title(s, 'One household, from paycheck to retirement');
  T(s, 'A sample couple, Alex (34, $92,000) and Jordan (32, $68,000) in Illinois, with $60,000 saved and two children planned, carried through four tools by the tools\' own buttons.', { x: M, y: 1.5, w: W - 2 * M, h: 0.55, fontSize: 14, color: X.muted });
  const steps = [
    ['Budget', '$1,803', 'saved per month, 13.5% of pay plus $457 from employers', 'st_pc_1_saved-and-invested-e', 'Copy to a calculator', '$832.35 biweekly'],
    ['Stages', '$743,576', 'at 65 in today\'s dollars, saving paused for 18 years of children', 'st_stg_1_after-tax-income-per', 'Test withdrawals', 'the portfolio'],
    ['Social Security', '$6,236', 'per month together, both claiming at 67', 'st_ss_1_pick-the-age-you-cla', 'Copy from the calculator', 'both benefits'],
    ['Drawdown', '100%', 'of 835 historical retirements lasted 30 years', 'st_dd_1_historicalmonte-carl', null, null],
  ];
  const cw = 2.72, gap = (W - 2 * M - 4 * cw) / 3;
  for (let i = 0; i < 4; i++) {
    const [tool, n, l, pic, btn, carried] = steps[i];
    const x = M + i * (cw + gap), y = 2.25;
    rect(s, x, y, cw, 3.05, X.raised, { round: true, r: 0.14 });
    T(s, `${i + 1}  ${tool.toUpperCase()}`, { x: x + 0.25, y: y + 0.22, w: cw - 0.5, h: 0.3, fontSize: 11, bold: true, color: X.amber, charSpacing: 1 });
    T(s, n, { x: x + 0.25, y: y + 0.55, w: cw - 0.5, h: 0.65, fontSize: 32, bold: true, color: i === 3 ? X.gain : X.text });
    T(s, l, { x: x + 0.25, y: y + 1.22, w: cw - 0.5, h: 0.75, fontSize: 12, color: X.muted });
    const p = await card(pic, { t: 0, b: i === 2 ? 0.8 : 1 });
    const pw = cw - 0.5, ph = Math.min(pw / p.ar, 0.9);
    s.addImage({ path: p.path, x: x + 0.25, y: y + 2.0, w: ph * p.ar, h: ph });
    if (btn) {
      s.addShape(pres.ShapeType.rightArrow, { x: x + cw + 0.02, y: y + 1.35, w: gap - 0.04, h: 0.42, fill: { color: X.amber }, line: { type: 'none' } });
      T(s, [{ text: btn + ': ', options: { bold: true } }, { text: carried, options: { color: X.muted } }], { x: x + cw / 2 + 0.2, y: y + 3.12, w: cw + gap - 0.4, h: 0.55, fontSize: 10, align: 'center', valign: 'middle' });
    }
  }
  rect(s, M, 5.95, W - 2 * M, 0.9, X.amber, { round: true, r: 0.12 });
  T(s, [{ text: '$104,573 per year in retirement', options: { bold: true, fontSize: 22 } }, { text: '   in today\'s dollars: $29,743 from savings and $74,830 from Social Security, through the Depression and the 1970s', options: { fontSize: 13 } }], { x: M + 0.3, y: 5.95, w: W - 2 * M - 0.6, h: 0.9, color: X.ground, valign: 'middle' });
  notes(s, 'Every number here is from the live site, carried tool to tool by the hand-off buttons. Their budget and paycheck give $1,803 per month of saving. Stages, with the kids builder, gets them to $743,576 in today\'s dollars at 65. Social Security adds $6,236 per month from 67. The Drawdown Simulator says the plan lasted in all 835 historical retirements. Step-by-step screenshots are in the appendix.');
}

// 13. Under the hood
{
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: MAIN });
  kick(s, 'Under the hood'); title(s, 'A static site that does its thinking in the browser');
  const bx = 3.95, by = 1.85, bw = 5.4, bh = 3.6;
  rect(s, bx, by, bw, bh, X.raised, { round: true, r: 0.15, line: X.rule });
  T(s, 'The visitor\'s browser', { x: bx + 0.3, y: by + 0.25, w: 4, h: 0.35, fontSize: 16, bold: true });
  rect(s, bx + 0.3, by + 0.8, 2.25, 1.15, X.surface, { round: true, r: 0.1, line: X.rule });
  T(s, [{ text: 'Pages', options: { bold: true, breakLine: true } }, { text: 'Next.js 16 · React 19 · Tailwind · shadcn/ui', options: { color: X.muted, fontSize: 11 } }], { x: bx + 0.45, y: by + 0.9, w: 1.95, h: 0.95, fontSize: 14 });
  rect(s, bx + 2.85, by + 0.8, 2.25, 1.15, X.surface, { round: true, r: 0.1, line: X.amber, lw: 1.5 });
  T(s, [{ text: 'Calculation engine', options: { bold: true, color: X.amber, breakLine: true } }, { text: 'in a Web Worker, with 100 years of data and 2026 tax rules', options: { color: X.muted, fontSize: 11 } }], { x: bx + 3.0, y: by + 0.9, w: 1.95, h: 0.95, fontSize: 14 });
  rect(s, bx + 0.3, by + 2.2, bw - 0.6, 1.1, X.surface, { round: true, r: 0.1, line: X.rule });
  T(s, [{ text: 'Local storage, first', options: { bold: true, breakLine: true } }, { text: 'household, scenarios and the Guide are saved here before anywhere else', options: { color: X.muted, fontSize: 11 } }], { x: bx + 0.45, y: by + 2.3, w: bw - 0.9, h: 0.9, fontSize: 14 });
  const side = (x, y, name, l, c) => { rect(s, x, y, 2.75, 1.0, X.surface, { round: true, r: 0.12, line: c || X.rule }); T(s, [{ text: name, options: { bold: true, breakLine: true } }, { text: l, options: { color: X.muted, fontSize: 11 } }], { x: x + 0.2, y: y + 0.12, w: 2.4, h: 0.8, fontSize: 14 }); };
  side(M, 2.15, 'Vercel', 'prerendered pages from main'); side(M, 3.55, 'Cloudflare', 'DNS and cookieless page counts');
  side(W - M - 2.75, 1.85, 'Supabase', 'optional accounts, each user\'s rows locked to them', X.teal); side(W - M - 2.75, 3.05, 'Resend', 'the 6-digit sign-in codes'); side(W - M - 2.75, 4.25, 'Sentry', 'errors only, inputs stripped');
  const arrow = (x, y, w) => s.addShape(pres.ShapeType.line, { x, y, w, h: 0, line: { color: X.muted, width: 1.25, endArrowType: 'triangle' } });
  arrow(M + 2.75, 2.65, bx - M - 2.75); arrow(bx + bw, 2.35, W - M - 2.75 - bx - bw);
  const st = [['39', 'page routes'], ['~618', 'automated checks before every commit'], ['22', 'tracked figures, each with a source'], ['0', 'API routes taking your inputs']];
  st.forEach(([n, l], i) => stat(s, M + i * 3.05, 5.75, 2.9, n, l, { size: 30, nh: 0.5, lh: 0.45, color: i === 1 ? X.amber : X.text }));
  notes(s, 'Pages are prerendered on Vercel. All the math runs in a Web Worker in the browser, so the page never freezes. Saved data goes to the browser first; an optional Supabase account syncs it, with row-level security. Error reports go to Sentry with every input stripped. The appendix covers the engine, testing, hosting, accounts and every data source.');
}

// 14. Close
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: MAIN });
  const art = await coverArt('close_fan', 1333, 470, { color: '#9aa4b2', hi: '#e3a93b' });
  s.addImage({ path: art.path, x: 0, y: 2.8, w: W, h: W * 470 / 1333, transparency: 55 });
  logo(s, M, 0.6, 0.55);
  T(s, 'Find out where you stand.', { x: M, y: 1.75, w: 11, h: 1.2, fontSize: 54, bold: true });
  T(s, 'Free, private, and tested against every market since 1926.', { x: M, y: 2.95, w: 9, h: 0.5, fontSize: 20, color: X.muted });
  T(s, [link('https://retcalc.app', 'retcalc.app')], { x: M, y: 3.7, w: 5, h: 0.7, fontSize: 32, bold: true, color: X.amber });
  T(s, 'Appendix: every tool, the full build, and where the numbers come from.', { x: M, y: 6.9, w: 9, h: 0.35, fontSize: 12, color: X.muted });
  notes(s, 'That is RetCalc: free, private, and tested against a century of markets. The appendix that follows has a slide for every tool and the full story of the build.');
}

/* =====================================================================
   APPENDIX
   ===================================================================== */
pres.addSection({ title: APP });
const appendix = []; // { title } in order, for the divider's links
const A = (name, fn) => appendix.push({ name, fn });

/* Tool slide: text column on the left, a tinted panel of screenshots on the right. */
const tool = (spec) => A(spec.name, async (num) => {
  const s = pres.addSlide({ masterName: 'SPLIT', sectionTitle: APP });
  const g = GROUP[spec.group];
  kick(s, spec.kicker || g.name); title(s, spec.name);
  let y = underTitle(spec.name);
  if (spec.q) { const n = qLines(spec.q, 36); T(s, spec.q, { x: M, y, w: 4.4, h: n * 0.29 + 0.05, fontSize: 17, bold: true, color: g.color }); y += n * 0.29 + 0.3; }
  if (spec.desc) { T(s, spec.desc, { x: M, y, w: 4.4, h: spec.dh || 1.25, fontSize: 14, color: X.muted }); y += (spec.dh || 1.25) + 0.12; }
  for (const [h, items, lines] of spec.sections || []) {
    T(s, h.toUpperCase(), { x: M, y, w: 4.4, h: 0.28, fontSize: 11, bold: true, color: X.muted, charSpacing: 1 }); y += 0.32;
    const hh = (lines || items.reduce((a, t) => a + Math.ceil(t.length / 48), 0)) * 0.245 + items.length * 0.045 + 0.08;
    T(s, bullets(items, { gap: 3 }), { x: M, y, w: 4.4, h: hh, fontSize: 14 }); y += hh + 0.18;
  }
  if (spec.stat) { const sy = Math.max(y + 0.05, 5.6); if (sy <= 6.1) { T(s, spec.stat[0], { x: M, y: sy, w: 4.4, h: 0.6, fontSize: 34, bold: true, color: g.color }); T(s, spec.stat[1], { x: M, y: sy + 0.6, w: 4.4, h: 0.3, fontSize: 12, color: X.muted }); } else console.log('  no room for stat:', spec.name, sy.toFixed(2)); }
  if (spec.route) T(s, [link('https://retcalc.app/' + spec.route, 'retcalc.app/' + spec.route)], { x: M + 4.4 - 2.6, y: 7.02, w: 2.6, h: 0.3, fontSize: 10, align: 'right', color: X.amber });
  rect(s, 5.45, 0, W - 5.45, H, mix(g.color, 0.18));
  if (spec.art) await spec.art(s, 5.45, W - 5.45);
  else panel(s, await spec.rows(), 5.9, 0.45, W - 5.45 - 0.9, H - 0.9, 0.28);
  if (spec.cap) T(s, spec.cap, { x: 5.9, y: 7.08, w: W - 6.35, h: 0.3, fontSize: 10, color: X.muted, align: 'right' });
  return s;
});

// At a glance
A('Every tool at a glance', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'At a glance'); title(s, 'Every tool, and the question it answers');
  const groups = [
    ['calc', [['Calculator: Basic', 'What will my savings grow to?'], ['Calculator: Advanced', 'Will I reach my target, after fees and tax?'], ['Calculator: Stages', 'What if my saving changes over the years?']]],
    ['guide', [['Readiness Guide', 'How ready am I, and what next?'], ['Paycheck to Retirement', 'Where should each paycheck go?']]],
    ['income', [['Drawdown Simulator', 'Will my money last?'], ['Retirement Plan Optimizer', 'Which plan leaves me the most?'], ['Social Security Calculator', 'When should I claim?'], ['Early Retirement Bridge', 'How do I pay for the years before 59½?'], ['Roth Conversion Calculator', 'Should I convert before RMDs start?'], ['Healthcare Cost Planner', 'What will health insurance cost?']]],
    ['saving', [['FIRE Calculator', 'When does work become optional?'], ['Portfolio Backtest', 'What would this mix have done?'], ['College Savings', 'How much should I save for college?'], ['Rent vs. Buy', 'Should I rent or buy?']]],
    ['everyday', [['Income Tax', 'How much tax will I owe?'], ['Budget', 'Where does my money go?'], ['Debt Payoff', 'Which debt should I pay off first?'], ['Mortgage Calculator', 'What will the house cost each month?']]],
  ];
  const col = (x, w, list, y0) => { let y = y0; for (const [g, xs] of list) { const G = GROUP[g]; circle(s, x, y + 0.08, 0.16, G.color); T(s, G.name.toUpperCase(), { x: x + 0.26, y, w: w - 0.3, h: 0.3, fontSize: 11, bold: true, color: G.color, charSpacing: 1 }); y += 0.34; for (const [n, q] of xs) { rect(s, x, y, w, 0.5, X.raised, { round: true, r: 0.08 }); T(s, [{ text: n, options: { bold: true, breakLine: true } }, { text: q, options: { color: X.muted, fontSize: 10 } }], { x: x + 0.18, y: y + 0.02, w: w - 0.3, h: 0.46, fontSize: 12, valign: 'middle' }); y += 0.56; } y += 0.16; } };
  const cw = (W - 2 * M - 0.6) / 3;
  col(M, cw, [groups[0], groups[1]], 1.7); col(M + cw + 0.3, cw, [groups[2]], 1.7); col(M + 2 * (cw + 0.3), cw, [groups[3], groups[4]], 1.7);
});

tool({ group: 'calc', kicker: 'Calculators', name: 'Basic and Advanced', stat: ['5,000', 'Monte Carlo runs on every redraw'], route: 'calculator', q: 'What will my savings grow to, and is it enough?',
  desc: 'Basic answers in six questions. Advanced adds what a real plan has to carry.', dh: 0.75,
  sections: [['Advanced adds', ['Traditional, Roth, brokerage and HSA', 'Employer match, fees and a glide path', 'Taxes by filing status and state', 'Reach a target: the contribution or years it takes', 'Rate band, 1926 history or Monte Carlo']]],
  rows: async () => [[await card('calculator_1_balance-over-time')], [await card('advanced_chart_mc', { t: 0, b: 0.8 })]] });

tool({ group: 'calc', kicker: 'Calculators', name: 'Stages: around children', stat: ['9 stages', 'built from one, around two planned children'], route: 'stages', q: 'Saving that pauses, then comes back',
  desc: 'The kids builder turned the sample couple\'s single 31-year stage into nine, from Before children to Empty nest, with childcare and the teen years taking the saving for 18 years.', dh: 1.25,
  sections: [['The builder asks', ['Children you have now, and their ages', 'Children planned, and how far apart', 'Paid childcare before school', 'Monthly cost by age band, or the defaults']]],
  rows: async () => [[await card('st_stg_0_your-stages', { t: 0, b: 0.215 }), await card('st_stg_1_after-tax-income-per')], [await card('st_stg_7_stage-by-stage')]] });

tool({ group: 'income', name: 'Drawdown: 15 strategies', stat: ['15', 'strategies, tuned to the same risk and compared'], route: 'drawdown', q: 'Which withdrawal rule spends the most?',
  sections: [['Five families', ['Steady: fixed, Kitces ratchet', 'Share: fixed %, 95% rule, 1/N, RMD, VPW', 'Guardrails: Guyton-Klinger, risk-based', 'Smoothed: floor and ceiling, Vanguard, Yale, Autopilot II, Sensible', 'Valuation: CAPE-based']]],
  rows: async () => [[await card('drawdown_cmp_3_strategy-showdown', { t: 0.13, b: 0.425 })], [await card('drawdown_2_every-historical-sta', { t: 0.12, b: 0.76 })]] });

tool({ group: 'income', name: 'Retirement Plan Optimizer', stat: ['326,106', 'retirements simulated in one search'], route: 'optimizer', q: 'Which plan leaves me the most?',
  desc: 'Claiming ages, withdrawal order, Roth conversions and income guards, crossed and run through every market since 1926.', dh: 1.0,
  sections: [['In the sample', ['4,941 plans in 66 historical retirements', '+$375k left over the usual way']], ['Goals', ['Leave the most, make it last, or spend the most']]],
  rows: async () => [[await card('optimizer_2_left-for-you-and-you')], [await card('optimizer_5_where-each-year-s-mo')]] });

tool({ group: 'income', name: 'Social Security Calculator', stat: ['62 to 70', 'every claiming age, side by side'], route: 'social-security', q: 'When should I claim?',
  desc: 'The check at every age from 62 to 70, how it is figured, and which age pays off best for how long you live.', dh: 1.0,
  sections: [['For couples', ['Every pair of claiming ages', 'The survivor benefit', 'How much of it is taxed']]],
  rows: async () => [[await card('ss_1_pick-the-age-you-cla')], [await card('ss_3_best-age-by-how-long'), await card('ss_4_when-waiting-pays-of')]] });

tool({ group: 'income', name: 'Early Retirement Bridge', stat: ['6 routes', 'to 59½, each tested since 1926'], route: 'bridge', q: 'How do I pay for the years before 59½?',
  desc: 'Tax, penalties and ACA premiums for each route, and what is left at 59½.', dh: 0.7,
  sections: [['Routes compared', ['Roth conversion ladder', '72(t) payments', 'Brokerage, then Roth contributions', 'Rule of 55 and part-time work', 'Paying the 10% penalty, as a benchmark']]],
  rows: async () => [[await card('bridge_2_ways-to-59', { t: 0, b: 0.72 })], [await card('bridge_4_where-each-year-s-mo')]] });

tool({ group: 'income', name: 'Roth Conversion Calculator', stat: ['+$223,304', 'after-tax net worth from converting, in the sample'], route: 'roth', q: 'Should I convert before RMDs start?',
  desc: 'Projects required distributions to age 100, then tests a conversion schedule against doing nothing.', dh: 0.95,
  sections: [['Strategies', ['Fill a bracket or an IRMAA threshold', 'A fixed amount or a share of the balance', 'None, for comparison']]],
  rows: async () => [[await card('roth_1_converting-wins-on-b')], [await card('roth_3_traditional-balance')]] });

tool({ group: 'income', name: 'Healthcare Cost Planner', stat: ['$2,688', 'per month for the ACA, just over the subsidy cliff'], route: 'healthcare', q: 'What will health insurance cost before and after Medicare?',
  desc: 'ACA premiums and subsidies for the gap before 65, then Medicare Part B, Part D, Medigap and IRMAA.', dh: 0.95,
  sections: [['The sample', ['A couple retiring at 60 on $95,000', 'Just over the subsidy cliff: $2,688 per month', 'Then Medicare: $716–876 per month']]],
  rows: async () => [[await card('hc95_1_aca-premium-before-6')], [await card('hc95_2_before-65-the-aca-br', { t: 0, b: 0.545 }), await card('hc95_3_from-65-medicare', { t: 0, b: 0.545 })]] });

tool({ group: 'saving', name: 'FIRE Calculator', stat: ['Age 66.6', 'financial independence in the sample, at $1,024,146'], route: 'fire', q: 'When does work become optional?',
  desc: 'The age a portfolio reaches financial independence, or with Coast FIRE, the age you could stop contributing.', dh: 0.95,
  sections: [['Historical mode', ['Every rolling window since 1926', 'A success-rate slider gives a second answer: the age reached in, say, 90% of history']]],
  rows: async () => [[await card('fire_hist_1_rate-bandhistoricaly')], [await card('fire_hist_2_portfolio-growth')]] });

tool({ group: 'saving', name: 'Portfolio Backtest', stat: ['9.65%', 'per year for 80/20 stocks and bonds, 1926–2025'], route: 'backtest', q: 'What would this mix have actually done?',
  sections: [['You choose', ['Stocks, small-cap value, bonds and cash', 'How often to rebalance', 'Any span from 1926 to 2025']], ['You see', ['Return, before and after inflation', 'Volatility and the deepest fall', 'Growth of $10,000 and rolling returns']]],
  rows: async () => [[await card('backtest_1_return-per-year9-65-', { t: 0, b: 0.66 })], [await card('backtest_2_growth-of-10-000')]] });

tool({ group: 'saving', name: 'College Savings', stat: ['$558', 'per month for an in-state school, 18 years out'], route: 'college', q: 'How much should I save for college?',
  sections: [['Presets, per year', ['Public in-state, about $27,000', 'Private non-profit, about $59,000', 'Elite, about $82,000']], ['Also', ['Several children on one account', 'Tuition inflation and years in college']]],
  rows: async () => [[await card('college_1_save-per-month-558fo')], [await card('college_2_savings-over-time')]] });

tool({ group: 'saving', name: 'Rent vs. Buy', stat: ['$811,712', 'how far renting came out ahead after 30 years'], route: 'rentbuy', q: 'Should I rent or buy?',
  desc: 'Buyer and renter net worth over any horizon, counting what the down payment could have earned.', dh: 0.95,
  sections: [['It counts', ['Price, down payment, rate and term', 'Tax, insurance, upkeep, closing and selling', 'Rent growth, appreciation and returns']]],
  rows: async () => [[await card('rentbuy_2_net-worth-over-time')], [await card('rentbuy_1_each-month-to-start', { t: 0, b: 0.8 })]] });

tool({ group: 'everyday', name: 'Income Tax: retirement mode', stat: ['4.9%', 'total tax on $100,000 of retirement income'], route: 'incometax', q: 'What does a year of withdrawals cost?',
  sections: [['It stacks', ['Long-term gains into the 0/15/20% bands', 'The 3.8% net investment income tax', 'Social Security\'s 0/50/85% tiers', 'The 2026 senior deduction', 'State rules for pensions and withdrawals']]],
  rows: async () => [[await card('incometax_ret_2_your-capital-gain-an')], [await card('incometax_ret_3_where-each-dollar-ca', { t: 0, b: 0.74 })]] });

tool({ group: 'everyday', name: 'Budget: the itemized paycheck', stat: ['$0', 'left unassigned: every dollar has a place'], route: 'budget', q: 'Every line of every check', cap: 'The itemized paycheck, in two halves: per check, per month and per year',
  desc: 'Per check, per month and per year: earnings, pre-tax lines, each tax, the deposit, the budget and where the rest goes.', dh: 1.0,
  sections: [['Three one-click plans', ['The usual order', 'Max tax breaks', 'Stay flexible']]],
  art: async (s, px, pw) => {
    const a = await card('plan_paycheck_4_itemized-paycheck', { t: 0, b: 0.5 });
    const b2 = await card('plan_paycheck_4_itemized-paycheck', { t: 0.5, b: 1 });
    panel(s, [[a], [b2]], px + 0.45, 0.45, pw - 0.9, H - 1.1, 0.3);
  } });

tool({ group: 'everyday', name: 'Debt Payoff', stat: ['Sep 2030', 'debt-free in the sample, $10,167 saved'], route: 'debt', q: 'Which debt should I pay off first?',
  sections: [['You get', ['The debt-free date and total interest', 'Avalanche against snowball, with a verdict', 'The payoff order', 'What $100 more per month would do']]],
  rows: async () => [[await card('debt_1_debt-freesep-20303y-')], [await card('debt_2_avalanche-vs-snowbal')], [await card('debt_3_what-you-owe-month-b', { t: 0, b: 0.94 })]] });

tool({ group: 'everyday', name: 'Mortgage Calculator', stat: ['$201,179', 'less interest with $300 extra per month'], route: 'mortgage', q: 'What will the house cost each month?',
  desc: 'The full payment, how the balance falls, and amortization year by year.', dh: 0.7,
  sections: [['What-ifs, in the sample', ['$300 extra per month and $10,000 once', 'Paid off 9 years 7 months sooner', '$201,179 less interest', 'A refinance to 6.25%: even in 1 year 7 months']]],
  rows: async () => [[await card('mx_2_extra-payments-and-r')], [await card('mx_3_loan-balance-and-wha', { t: 0, b: 0.9 })]] });

A('The Guide\'s report', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Guided walkthroughs'); title(s, 'The Readiness Guide ends in a plan on paper');
  T(s, 'About a dozen US Letter pages, built in the browser and saved as a PDF. This is the report for a sample couple, 38 and 36, retiring at 62.', { x: M, y: 1.5, w: W - 2 * M, h: 0.4, fontSize: 14, color: X.muted });
  const ph = 2.42, pw = ph * 816 / 1056, gap = (W - 2 * M - 6 * pw) / 5;
  for (let i = 0; i < 12; i++) { const p = await shot('report_p' + String(i).padStart(2, '0'), { radius: 6 }); s.addImage({ path: p.path, x: M + (i % 6) * (pw + gap), y: 2.05 + Math.floor(i / 6) * (ph + 0.2), w: pw, h: ph }); }
});

A('The household, step by step', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Putting it together'); title(s, 'The household, step by step');
  const items = [['1 · Budget, Paycheck tab', await card('st_pc_1_saved-and-invested-e')], ['2 · Stages, after the kids builder', await card('st_stg_4_balance-over-time-in', { t: 0.27, b: 0.8 })], ['3 · Social Security, both at 67', await card('st_ss_1_pick-the-age-you-cla', { t: 0, b: 0.8 })], ['4 · Drawdown, with both benefits', await card('st_dd_1_historicalmonte-carl')]];
  const cw = (W - 2 * M - 0.4) / 2;
  items.forEach(([l, p], i) => { const x = M + (i % 2) * (cw + 0.4), y = 1.65 + Math.floor(i / 2) * 2.7; T(s, l, { x, y, w: cw, h: 0.3, fontSize: 12, bold: true, color: X.amber }); const h = Math.min(cw / p.ar, 2.2); s.addImage({ path: p.path, x, y: y + 0.35, w: h * p.ar, h, shadow: shadow() }); });
});

// ---- build appendix ----
A('The stack', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Under the hood'); title(s, 'The stack');
  const rows = [['Framework', 'Next.js 16 (App Router), React 19, TypeScript 5'], ['Look', 'Tailwind CSS v4 and shadcn/ui on Base UI, Lucide icons, IBM Plex Sans served by the site'], ['Engine', 'Plain JavaScript type-checked through JSDoc, behind typed TypeScript bridges, run in a Web Worker'], ['Checks', 'ESLint with zero warnings allowed, tsc, @shadcn/lint, a calculation suite, unit and end-to-end tests'], ['Design', 'A written design system: Graphite (dark, the default) and Paper (light), one amber accent, five chart hues']];
  s.addTable(rows.map(([a, b]) => [{ text: a, options: { bold: true, color: X.amber } }, { text: b, options: { color: X.text } }]), { x: M, y: 1.75, w: 7.4, colW: [1.5, 5.9], fontSize: 14, border: { type: 'solid', color: X.rule, pt: 0.75 }, fill: { color: X.ground }, margin: [0.12, 0.12, 0.12, 0.1], rowH: 0.62, valign: 'middle' });
  const st = [['39', 'page routes'], ['~55,600', 'lines of app code'], ['~7,400', 'lines in the engine and its data'], ['29', 'explanatory articles']];
  st.forEach(([n, l], i) => { const x = 8.5 + (i % 2) * 2.15, y = 1.75 + Math.floor(i / 2) * 1.45; rect(s, x, y, 2.0, 1.3, X.raised, { round: true, r: 0.12 }); stat(s, x + 0.2, y + 0.2, 1.7, n, l, { size: 28, nh: 0.5, lh: 0.5, color: i === 0 ? X.amber : X.text }); });
  T(s, 'THE PALETTE', { x: 8.5, y: 4.75, w: 4.2, h: 0.3, fontSize: 11, bold: true, color: X.muted, charSpacing: 1 });
  [['0E1116', 'Graphite'], ['1C222B', 'Raised'], ['E3A93B', 'Amber'], ['FAF9F6', 'Paper'], ['9A6200', 'Amber, light']].forEach(([c, n], i) => { rect(s, 8.5 + i * 0.84, 5.1, 0.74, 0.74, c, { round: true, r: 0.08, line: X.rule }); T(s, n, { x: 8.5 + i * 0.84, y: 5.9, w: 0.8, h: 0.3, fontSize: 10, color: X.muted }); });
  [X.sky, X.teal, X.rose, X.lav, X.gray, X.gain, X.loss].forEach((c, i) => rect(s, 8.5 + i * 0.6, 6.35, 0.5, 0.22, c, { round: true, r: 0.05 }));
  T(s, 'Design rules are enforced by the linter: no raw colors, no one-off sizes, no inline styles.', { x: M, y: 5.6, w: 7.4, h: 0.8, fontSize: 14, color: X.muted });
});

A('The calculation engine', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Under the hood'); title(s, 'About 5,700 lines of finance in one engine');
  s.addChart(pres.ChartType.bar, [{ name: 'Lines', labels: ['math.js', 'drawdown.js', 'data files', 'plan.js', 'bridge.js', 'calculators.js'], values: [2389, 1435, 1100, 833, 471, 408] }], {
    x: M - 0.1, y: 1.65, w: 6.2, h: 3.4, barDir: 'bar', catAxisOrientation: 'maxMin', chartColors: [X.amber], showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: X.text, dataLabelFontSize: 12, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: '#,##0',
    catAxisLabelColor: X.text, catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false, barGapWidthPct: 45, catAxisLineShow: false,
    showTitle: true, title: 'Lines of code, by file', titleColor: X.muted, titleFontSize: 12, titleFontFace: '+mn-lt',
  });
  T(s, 'Projections, Monte Carlo, federal and state tax, FICA, Social Security, RMDs, Roth conversions, ACA and Medicare, mortgages, debt, rent against buy, college, FIRE, the 72(t) bridge and historical withdrawal backtests.', { x: M, y: 5.2, w: 6.0, h: 1.4, fontSize: 14, color: X.muted });
  const ways = [['Historical replay', 'Every starting month since 1926, run through what actually happened. 835 starts for a 30-year retirement.'], ['Monte Carlo, calculators', '5,000 lognormal runs per redraw, set so zero volatility draws the plain projection exactly.'], ['Monte Carlo, drawdown', 'A block bootstrap of real history: runs of years drawn together, so the 1930s and 1970s keep their streaks.'], ['One seed', 'Every simulation shares a seeded generator, so charts hold still; Re-roll moves them all at once.']];
  ways.forEach(([h, l], i) => { const y = 1.7 + i * 1.28; rect(s, 7.2, y, W - 7.2 - M, 1.13, X.raised, { round: true, r: 0.12 }); T(s, h, { x: 7.45, y: y + 0.15, w: W - 7.7 - M, h: 0.35, fontSize: 16, bold: true, color: i < 3 ? X.amber : X.text }); T(s, l, { x: 7.45, y: y + 0.5, w: W - 7.7 - M, h: 0.6, fontSize: 12, color: X.muted }); });
});

A('Checks before anything ships', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Under the hood'); title(s, 'A test for every claim, before anything ships');
  const steps = [['A change', 'to the engine, a tool\'s defaults, an article or page text'], ['Pre-commit gate', '~618 checks in 55 groups. A failure blocks the commit.'], ['On every push', 'the suite again, numbers baselines, lint, typecheck, build, unit and end-to-end tests'], ['Live', 'main deploys to Vercel; every branch gets a preview first']];
  const cw = (W - 2 * M - 3 * 0.45) / 4;
  steps.forEach(([h, l], i) => { const x = M + i * (cw + 0.45); rect(s, x, 1.8, cw, 1.75, i === 1 ? X.amber : X.raised, { round: true, r: 0.14 }); T(s, h, { x: x + 0.25, y: 1.98, w: cw - 0.5, h: 0.4, fontSize: 18, bold: true, color: i === 1 ? X.ground : X.text }); T(s, l, { x: x + 0.25, y: 2.45, w: cw - 0.5, h: 1.0, fontSize: 13, color: i === 1 ? X.ground : X.muted }); if (i < 3) s.addShape(pres.ShapeType.rightArrow, { x: x + cw + 0.07, y: 2.5, w: 0.31, h: 0.35, fill: { color: X.muted }, line: { type: 'none' } }); });
  const st = [['~618', 'checks in the calculation suite'], ['209', 'tie the 29 articles\' worked examples to the engine'], ['7', 'sample households with pinned Guide results'], ['17', 'end-to-end browser specs'], ['1,200', 'months of market history every engine walks']];
  const sw = (W - 2 * M) / 5;
  st.forEach(([n, l], i) => stat(s, M + i * sw, 4.3, sw - 0.3, n, l, { size: 44, nh: 0.8, lh: 0.8, lsize: 13, color: i === 0 ? X.amber : X.text }));
  T(s, 'Worked examples in the articles are checked against the calculator, so the numbers in the writing always match the numbers in the tools.', { x: M, y: 6.25, w: W - 2 * M, h: 0.5, fontSize: 14, color: X.muted });
});

A('Hosting and delivery', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Under the hood'); title(s, 'Fast because there is almost nothing to serve');
  const rows = [['Hosting', 'Vercel, building from main, with a preview for every branch'], ['Rendering', 'Prerendered pages. No API routes: the one thing the site\'s own server receives is error reports, stripped of inputs'], ['Domain', 'retcalc.app, DNS on Cloudflare'], ['Analytics', 'Cloudflare and Vercel Web Analytics: cookieless, production only, no ads'], ['Email', 'Sign-in codes through Resend, from the site\'s own domain']];
  s.addTable(rows.map(([a, b]) => [{ text: a, options: { bold: true, color: X.amber } }, { text: b, options: { color: X.text } }]), { x: M, y: 1.7, w: 6.4, colW: [1.35, 5.05], fontSize: 13, border: { type: 'solid', color: X.rule, pt: 0.75 }, fill: { color: X.ground }, margin: [0.1, 0.12, 0.1, 0.1], valign: 'middle' });
  T(s, 'LINK PREVIEWS, DRAWN FOR EVERY PAGE', { x: 7.35, y: 1.7, w: 5.4, h: 0.3, fontSize: 11, bold: true, color: X.muted, charSpacing: 1 });
  const og = ['drawdown', 'stages', 'incometax', 'guide'];
  const ow = (W - 7.35 - M - 0.2) / 2, oh = ow * 630 / 1200;
  og.forEach((n, i) => s.addImage({ path: new URL(`../../web/public/og/${n}.jpg`, import.meta.url).pathname, x: 7.35 + (i % 2) * (ow + 0.2), y: 2.1 + Math.floor(i / 2) * (oh + 0.2), w: ow, h: oh }));
  rect(s, 7.35, 2.3 + 2 * (oh + 0.2), W - 7.35 - M, 1.55, X.raised, { round: true, r: 0.12 });
  T(s, [{ text: 'Error reports that can\'t leak a plan', options: { bold: true, breakLine: true } }, { text: 'Errors only, production only. Addresses cut to the path, so the # holding a tool\'s inputs never leaves the page. No breadcrumbs, user details or local variables.', options: { color: X.muted, fontSize: 12 } }], { x: 7.6, y: 2.45 + 2 * (oh + 0.2), w: W - 7.85 - M, h: 1.3, fontSize: 15 });
});

A('Accounts and privacy', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Under the hood'); title(s, 'Local first. An account is only a way to sync');
  const d = await card('signin_dialog', { pad: 0, radius: 22 });
  const dh = H - 1.75 - 0.6, dw = dh * d.ar;
  s.addImage({ path: d.path, x: W - M - dw, y: 1.75, w: dw, h: dh, shadow: shadow() });
  const cards = [['What an account stores', X.gain, ['Email, and a first name if given', 'The household', 'Saved scenarios, by tool', 'Guide and Paycheck plan answers']], ['What it never stores', X.loss, ['Numbers typed but not saved', 'Browsing activity', 'Anything for advertisers: there are none', 'Share-link inputs, after the #']], ['Signing in, and out for good', X.amber, ['A 6-digit email code, or Google', 'Download everything, any time', 'Delete: sessions end, then the data goes']]];
  const area = W - 2 * M - dw - 0.4, cw = (area - 0.5) / 3;
  cards.forEach(([h, c, xs], i) => { const x = M + i * (cw + 0.25); rect(s, x, 1.75, cw, 3.55, X.raised, { round: true, r: 0.12 }); T(s, h.toUpperCase(), { x: x + 0.2, y: 1.95, w: cw - 0.4, h: 0.5, fontSize: 11, bold: true, color: c, charSpacing: 1 }); T(s, bullets(xs, { gap: 6 }), { x: x + 0.2, y: 2.5, w: cw - 0.4, h: 2.7, fontSize: 14 }); });
  T(s, 'Changes save to the browser first and push shortly after; a two-way merge runs on sign-in. If both sides changed a scenario, both are kept. Each person reaches only their own rows, and backups run weekly, encrypted.', { x: M, y: 5.5, w: area, h: 1.3, fontSize: 14, color: X.muted });
});

A('Where the numbers come from', async () => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: APP });
  kick(s, 'Under the hood'); title(s, '22 figures, each with a source and a due date');
  const groups = [['Taxes', [['Federal brackets', 'IRS Revenue Procedure', 'Yearly'], ['Contribution limits', 'IRS notices', 'Yearly'], ['Social Security figures', 'SSA fact sheet', 'Yearly'], ['State tax, 50 + DC', 'Tax Foundation, states', 'Yearly'], ['RMD tables', 'IRS Pub. 590-B', 'Yearly']]], ['Healthcare', [['Medicare B, IRMAA', 'CMS', 'Yearly'], ['Part D, Medigap', 'CMS, KFF', 'Yearly'], ['ACA premiums', 'KFF, HHS, IRS', 'Yearly']]], ['Markets', [['Stocks, bonds, inflation', 'Shiller (Yale), BLS', 'Yearly'], ['T-bills, small value', 'French Data Library', 'Yearly'], ['Today\'s CAPE', 'multpl.com', 'Monthly']]], ['Housing and defaults', [['Mortgage rate', 'Freddie Mac survey', 'Quarterly'], ['Home price and rent', 'NAR, Census, Zillow', 'Yearly'], ['College, children', 'College Board, USDA', 'Yearly']]]];
  const cw = (W - 2 * M - 0.6) / 4;
  groups.forEach(([g, xs], i) => { const x = M + i * (cw + 0.2); T(s, g.toUpperCase(), { x, y: 1.7, w: cw, h: 0.3, fontSize: 11, bold: true, color: X.amber, charSpacing: 1 }); xs.forEach(([n, src, how], j) => { const y = 2.1 + j * 0.8; rect(s, x, y, cw, 0.7, X.raised, { round: true, r: 0.08 }); T(s, [{ text: n, options: { bold: true, breakLine: true } }, { text: src, options: { color: X.muted, fontSize: 11 } }], { x: x + 0.15, y: y + 0.08, w: cw - 1.1, h: 0.55, fontSize: 13 }); T(s, how, { x: x + cw - 1.0, y, w: 0.85, h: 0.7, fontSize: 11, color: X.amber, align: 'right', valign: 'middle' }); }); });
  T(s, 'Anything coming due is flagged at the start of every working session. Figures are never invented, each is cited beside it in the code, and a new tax year is added beside the old one, never over it.', { x: M, y: 6.25, w: W - 2 * M, h: 0.55, fontSize: 14, color: X.muted });
});

/* ---------- appendix divider, with a link to every appendix slide ---------- */
{
  const first = pres.slides.length + 2; // the divider is next; the appendix starts after it
  const s = pres.addSlide({ masterName: 'DIVIDER', sectionTitle: APP });
  s.addText('APPENDIX', { placeholder: 'kicker' });
  s.addText('Every tool, and the whole build', { placeholder: 'title' });
  const names = appendix.map((a) => a.name);
  const half = Math.ceil(names.length / 2);
  [names.slice(0, half), names.slice(half)].forEach((list, c) => {
    T(s, list.map((n, i) => ({ text: `${String(first + c * half + i).padStart(2, '0')}   ${n}`, options: { hyperlink: { slide: first + c * half + i }, breakLine: i < list.length - 1, paraSpaceAfter: 4 } })), { x: 7.75 + c * 2.65, y: 1.1, w: 2.6, h: 5.9, fontSize: 11, color: X.text });
  });
  s.addShape(pres.ShapeType.line, { x: 7.5, y: 0.95, w: 0, h: 6.1, line: { color: X.rule, width: 1 } });
}
for (const a of appendix) await a.fn();

const out = new URL('../RetCalc-Deck.pptx', import.meta.url).pathname;
await pres.writeFile({ fileName: out });
await applyTheme(out, THEME);
console.log('slides', pres.slides.length, '->', out);
