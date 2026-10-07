#!/usr/bin/env node
/* The readiness guide's numbers check: the fixture households
   (guide-fixtures.mjs) through the guide's own code, compared with the
   figures recorded before the overhaul started (guide.json).

     node scripts/baseline/guide.mjs record    # run the harness, check it, save guide.json
     node scripts/baseline/guide.mjs check     # run the guide's code; print differences, exit 1 if any

   Run from web/. Two ways of getting the same figures:

   - The harness, below: the script that produced the figures in the build
     brief (section 6), ported from the legacy files to lib/engine. Its input
     mapping is today's planIn (tools/guide/calc.ts), frozen here, and its
     score is today's, frozen too. `record` runs it, checks it against the
     figures the documents published, checks that the guide's code agrees
     with it to the cent, and only then saves.
   - The guide's code (tools/guide/), which the overhaul rewrites. `check`
     runs it and compares every figure with the record. A figure may differ
     only where guide.json lists the difference under "deliberate": the
     three score corrections (doc 3, section 3, item 7), each with its
     decision. Anything else that moves fails. */
import { register } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const QUIET = "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON";
if (!process.execArgv.includes(QUIET)) {
  const { spawnSync } = await import("node:child_process");
  process.exit(spawnSync(process.execPath, [QUIET, ...process.argv.slice(1)], { stdio: "inherit" }).status ?? 1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "guide.json");
register(pathToFileURL(join(HERE, "loader.mjs")).href);
const E = { ...(await import("@/lib/engine/typed-plan")), ...(await import("@/lib/engine/typed")), ...(await import("@/lib/engine/typed-drawdown")) };
const { FIXTURES, LEVERS, PUBLISHED } = await import("./guide-fixtures.mjs");

/* ---------- the harness (build brief, section 6), frozen ---------- */
const BASIC_INFL = E.BASIC_INFL;
const ok = (v) => typeof v === "number" && isFinite(v), pos = (v) => ok(v) && v > 0;

function planIn(a, over = {}) { // mirrors gdPlanIn / calc.ts planIn
  const has = (k) => Object.prototype.hasOwnProperty.call(over, k), mar = a.status === "m";
  if (!ok(a.age) || !ok(a.retire) || !ok(a.saved) || !ok(a.contrib) || !pos(a.retSpend)) return null;
  const retire = has("retire") ? over.retire : a.retire;
  if (!(retire > a.age)) return null;
  const monthly = has("monthly") ? over.monthly : (a.contrib || 0) + (a.employer || 0);
  const spend = has("spend") ? over.spend : a.retSpend;
  if (!(spend > 0)) return null;
  let stop = has("stopAge") ? over.stopAge : a.stopAge;
  if (!ok(stop) || stop >= retire) stop = null; if (stop != null) stop = Math.max(a.age, stop);
  const emp = Math.min(Math.max(0, monthly), a.employer || 0), mine = Math.max(0, monthly - emp);
  const to = a.saveTo || "trad";
  const sp = to === "roth" ? { t: 0, r: mine, b: 0 } : to === "half" ? { t: mine / 2, r: mine / 2, b: 0 } : to === "brok" ? { t: 0, r: 0, b: mine } : { t: mine, r: 0, b: 0 };
  const saved = Math.max(0, a.saved || 0), roth = Math.min(saved, pos(a.rothNow) ? a.rothNow : 0);
  const brok = Math.min(saved - roth, pos(a.brokNow) ? a.brokNow : 0), trad = saved - roth - brok;
  const yrs1 = Math.max(1, Math.min(35, Math.round(retire) - 22));
  const spAt = mar && ok(a.spouseAge) ? a.spouseAge + (retire - a.age) : retire;
  const yrs2 = Math.max(1, Math.min(35, Math.round(spAt) - 22));
  const pia1 = pos(a.ssOwn) ? a.ssOwn : E.ssEstimate(a.income || 0, yrs1, 67).pia;
  const pia2 = !mar ? 0 : pos(a.ssOwn2) ? a.ssOwn2 : E.ssEstimate(a.income2 || 0, yrs2, 67).pia;
  const r = Math.min(70, Math.round(retire));
  const claim = ok(a.ssClaim) ? Math.max(62, Math.min(70, Math.max(a.ssClaim, r))) : Math.max(67, r);
  let end = 95 - Math.round(retire);
  if (mar && ok(a.spouseAge)) end = Math.max(end, 95 - Math.round(a.spouseAge + (retire - a.age)));
  const mix = ok(a.retMix) && a.retMix >= 0 && a.retMix <= 100 ? a.retMix : 60;
  const target = a.target === 0.95 || a.target === 1 ? a.target : 0.9;
  return { status: mar ? "m" : "s", state: a.state || "IL", age: a.age, spouseAge: mar && ok(a.spouseAge) ? a.spouseAge : null,
    retire, stopAge: stop, trad, roth, brok, rothBasis: roth * 0.5, brokBasis: brok * 0.6,
    saveTrad: sp.t + emp, saveRoth: sp.r, saveBrok: sp.b, real: a.risk || 0.045, infl: BASIC_INFL, spend,
    pia1, pia2, claim1: claim, claim2: claim, pension: pos(a.pension) ? a.pension * 12 : 0,
    pensionAge: ok(a.pensionAge) ? a.pensionAge : null, pensionCola: a.pensionCola === "yes",
    aca: retire < 65 && a.hcIncl !== "yes", household: mar ? 2 : 1, rule55: a.rule55 === "yes", heirRate: E.PL_HEIR,
    mix, years: Math.max(20, Math.min(60, end)), target, strategy: "fixed", minSpend: 0, fromYear: E.HIST_START, monthly };
}
function hSim(a, over) { // mirrors gdSim / calc.ts sim, without optimizer choices
  const I = planIn(a, over);
  if (!I) return null;
  const P = E.plAtRetire(I), C = E.plPrep(P), T = E.plBaseTactics(C);
  const H = E.plHistory(C, T, { paths: true }), D = E.plDetail(C, T), S = E.plSSParts(C, T);
  let tx = 0, hc = 0, hn = 0;
  D.rows.forEach((r) => { tx += r.tax + r.irmaa; if (r.health > 0) { hc += r.health; hn++; } });
  const taxYr = D.rows.length ? tx / D.rows.length : 0;
  return { I, P, T, H, fv: P.fv, success: H.successRate, taxYr, hcYr: hn ? hc / hn : 0, hcYears: hn, lifeTax: H.medTax,
    ss: S.total, portIncome: P.fv * 0.04, spend: I.spend, retire: I.retire, monthly: I.monthly, years: C.years, medianEnd: H.medianEnd,
    coverage: (P.fv * 0.04 + S.total + I.pension) / (I.spend + taxYr) };
}
function hNeed(S, goal) { // mirrors gdNeed / calc.ts need
  const P = S.P, n = S.H.total, maxFail = Math.floor(n * (1 - goal) + 1e-9);
  const lasts = (fv) => {
    const k = S.fv >= 1000 ? fv / S.fv : 0;
    const Q = S.fv >= 1000 ? { ...P, trad: P.trad * k, roth: P.roth * k, rothBasis: P.rothBasis * k, brok: P.brok * k, brokBasis: P.brokBasis * k }
      : { ...P, trad: fv, roth: 0, rothBasis: 0, brok: 0, brokBasis: 0 };
    const H = E.plHistory(E.plPrep(Q), S.T, { stopAfter: maxFail });
    return !H.partial && H.total - H.survived <= maxFail;
  };
  let lo = 0, hi = Math.max(S.spend * 60, S.fv * 2);
  if (lasts(0)) return 0;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (lasts(m)) hi = m; else lo = m; }
  return Math.ceil(hi / 1000) * 1000;
}
/* Today's score (calc.ts parts and score, before the corrections of D2). */
const interp = (x, pts) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
};
const WEIGHTS = { outlook: 40, rate: 20, cushion: 15, debt: 15, flow: 10 };
function hScore(a, S) {
  const P = {}, mar = a.status === "m", inc = (a.income || 0) + (mar ? a.income2 || 0 : 0);
  const goal = a.target === 0.95 || a.target === 1 ? a.target : 0.9;
  const coast = ok(a.stopAge) && ok(a.age) && a.stopAge <= a.age && !(ok(a.retire) && a.stopAge >= a.retire);
  if (S) P.outlook = interp(S.success, [[0.25, 0], [0.5, 0.35], [0.7, 0.6], [0.85, 0.85], [0.95, 1]]);
  if (inc > 0 && ok(a.contrib) && a.match) {
    const r = ((coast ? 0 : (a.contrib || 0) + (a.employer || 0)) * 12) / inc;
    let p = interp(r, [[0, 0], [0.05, 0.35], [0.1, 0.7], [0.15, 1]]);
    if (S && S.success >= goal - 1e-9) p = 1;
    if (a.match === "partial") p *= 0.75;
    P.rate = p;
  }
  if (ok(a.cash) && pos(a.spend)) P.cushion = interp(a.cash / a.spend, [[0, 0], [1, 0.3], [3, 0.75], [6, 1]]);
  if (a.debtHas === "no") P.debt = 1;
  else if (a.debtHas === "yes" && ok(a.debtTotal) && inc > 0) {
    const hi = Math.min(a.debtHi || 0, a.debtTotal), lo = a.debtTotal - hi;
    P.debt = Math.max(0, 1 - Math.min(1, (hi / inc) * 4) * 0.7 - Math.min(1, lo / inc) * 0.3);
  }
  if (pos(a.takehome) && pos(a.spend)) P.flow = interp((a.takehome - a.spend) / a.takehome, [[-0.05, 0], [0, 0.25], [0.1, 0.75], [0.2, 1]]);
  const have = Object.keys(WEIGHTS).filter((k) => k in P), w = have.reduce((s, k) => s + WEIGHTS[k], 0);
  return { score: have.length >= 2 ? Math.round((have.reduce((s, k) => s + WEIGHTS[k] * P[k], 0) / w) * 100) : null, P };
}
function pias(a, retire) {
  const I = planIn(a, { retire });
  return I ? { pia1: I.pia1, pia2: I.pia2 } : { pia1: null, pia2: null };
}

const HARNESS = {
  sim: (a, over) => hSim(a, over),
  need: (a, S) => hNeed(S, a.target === 0.95 || a.target === 1 ? a.target : 0.9),
  score: (a, S) => hScore(a, S),
  pias,
};

/* ---------- the guide's own code ---------- */
const G = await import("@/tools/guide/calc");
const LIVE = {
  sim: (a, over) => G.sim(a, over),
  need: (a, S) => G.need(a, S),
  score: (a) => { const R = G.score(a); return { score: R.score, P: Object.fromEntries(Object.entries(R.P).map(([k, v]) => [k, v.p])) }; },
  pias: (a, retire) => { const p = G.pias(a, retire); return { pia1: p.pia1, pia2: p.pia2 }; },
};

/* ---------- the figures ---------- */
const cents = (v) => (v == null ? null : Math.round(v * 100) / 100);
const share = (v) => (v == null ? null : Math.round(v * 1e6) / 1e6);

function figures(X, a) {
  const S = X.sim(a);
  if (!S) return { plan: null };
  const p = X.pias(a, a.retire), sc = X.score(a, S);
  const out = {
    pia1: cents(p.pia1), pia2: cents(p.pia2), fv: cents(S.fv), portIncome: cents(S.portIncome), ss: cents(S.ss.total ?? S.ss),
    taxYr: cents(S.taxYr), hcYr: cents(S.hcYr), hcYears: S.hcYears, lifeTax: cents(S.lifeTax),
    success: share(S.success), survived: S.H.survived, total: S.H.total, medianEnd: cents(S.H.medianEnd), coverage: share(S.coverage),
    need: X.need(a, S), score: sc.score,
    areas: Object.fromEntries(Object.entries(WEIGHTS).map(([k, w]) => [k, k in sc.P ? Math.round(sc.P[k] * w) : null])),
    shares: Object.fromEntries(Object.keys(WEIGHTS).map((k) => [k, k in sc.P ? share(sc.P[k]) : null])),
    levers: {},
  };
  for (const L of LEVERS) {
    const T = X.sim(a, L.over(S));
    out.levers[L.id] = T ? { fv: cents(T.fv), need: X.need(a, T), success: share(T.success), successPct: Math.round(T.success * 100) } : null;
  }
  return out;
}
const runAll = (X) => Object.fromEntries(FIXTURES.map((f) => [f.id, figures(X, f.a)]));

function flat(o, pre = "") {
  return Object.entries(o ?? {}).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, pre + k + ".") : [[pre + k, v]]));
}
/** Every field where two sets of figures differ, as "field: was => now". */
function diff(was, now) {
  const A = new Map(flat(was)), B = new Map(flat(now)), lines = [];
  for (const k of new Set([...A.keys(), ...B.keys()])) if (A.get(k) !== B.get(k)) lines.push({ field: k, was: A.get(k), now: B.get(k) });
  return lines;
}

const cmd = process.argv[2];
if (cmd === "record") {
  const harness = runAll(HARNESS), live = runAll(LIVE);
  let bad = 0;
  // The documents' published figures, to the dollar.
  for (const [id, want] of Object.entries(PUBLISHED)) {
    const got = new Map(flat(harness[id]));
    for (const [k, v] of Object.entries(want)) {
      const g = got.get(k), r = g == null ? g : Math.round(g);
      if (r !== v) { bad++; console.log(`✗ ${id}: ${k} published ${v}, harness ${g}`); }
    }
  }
  // The guide's code as it stands gives the same figures as the harness.
  for (const f of FIXTURES) for (const d of diff(harness[f.id], live[f.id])) { bad++; console.log(`✗ ${f.id}: ${d.field} harness ${d.was}, guide ${d.now}`); }
  if (bad) { console.log(`\n${bad} difference(s); nothing recorded.`); process.exit(1); }
  const keep = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")).deliberate ?? [] : [];
  const households = Object.fromEntries(FIXTURES.map((f) => [f.id, { name: f.name, exercises: f.exercises, figures: harness[f.id] }]));
  writeFileSync(FILE, JSON.stringify({ recorded: new Date().toISOString(),
    about: "The readiness guide's figures for the fixture households (scripts/baseline/guide-fixtures.mjs), from the harness in guide.mjs, which reproduces the live guide to the cent. Money in today's dollars, to the cent; shares to six places. Only the entries under deliberate may differ in the guide's code, each a decision in doc 3.",
    households, deliberate: keep }, null, 2) + "\n");
  console.log(`Recorded ${FIXTURES.length} households to ${FILE}`);
  for (const f of FIXTURES) console.log(`  ${f.id}: ${f.name}`);
} else if (cmd === "check") {
  if (!existsSync(FILE)) { console.log("No baseline yet: run `node scripts/baseline/guide.mjs record` first."); process.exit(2); }
  const base = JSON.parse(readFileSync(FILE, "utf8")), live = runAll(LIVE);
  const allowed = new Map((base.deliberate ?? []).map((d) => [d.household + ":" + d.field, d]));
  let diffs = 0, used = 0;
  for (const [id, h] of Object.entries(base.households)) {
    if (!live[id]) { diffs++; console.log(`✗ ${id}\n    household missing from guide-fixtures.mjs`); continue; }
    const lines = [], notes = [];
    for (const d of diff(h.figures, live[id])) {
      const ok = allowed.get(id + ":" + d.field);
      if (ok && ok.from === d.was && ok.to === d.now) { used++; notes.push(`${d.field}: ${d.was} => ${d.now} (deliberate, ${ok.decision})`); }
      else lines.push(`${d.field}: ${d.was} => ${d.now}`);
    }
    if (lines.length) { diffs++; console.log(`✗ ${id}: ${h.name}\n    ${lines.join("\n    ")}`); }
    else console.log(`✓ ${id}: ${h.name}` + (notes.length ? "\n    " + notes.join("\n    ") : ""));
  }
  console.log(diffs ? `\n${diffs} household(s) differ from the baseline recorded ${base.recorded}.`
    : `\nAll ${Object.keys(base.households).length} households match the baseline recorded ${base.recorded}` + (used ? `, with ${used} deliberate change(s).` : "."));
  process.exit(diffs ? 1 : 0);
} else {
  console.log("Usage: node scripts/baseline/guide.mjs record | check");
  process.exit(2);
}
