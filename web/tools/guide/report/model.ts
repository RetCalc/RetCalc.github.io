/* The full report's figures (REPORT_BRIEF.md): everything its pages show,
   gathered from the Guide's own code (calc.ts, moves.ts, score.ts,
   schedule.ts, college.ts), with nothing worked out here but sums, sorting
   and the historical range by year. The pages only lay it out. Which pages
   appear depends on the plan: a saving schedule, college, retiring before
   65. No React, so tests run it in Node against every fixture household. */

import { debtDate } from "@/lib/engine/typed";
import { plSSParts } from "@/lib/engine/typed-plan";
import { money as fmtMoney } from "@/lib/format";
import { DEBT_DEFAULTS, debtCompute, type DebtRow } from "@/tools/debt/model";
import { OP_GOALS, opClaims, opConvUntil, opTacticsLine } from "@/tools/optimizer/words";
import { FACTORS, ok, pias, pos, rating, sim, stratName, target, withGuess, type Levers, type Sim } from "../calc";
import { collegeToday, type CollegePlanToday } from "../college";
import { factsHere, planLists, type Move } from "../moves";
import { CHILD_COST, CHILD_SOURCE, children, hasChanges, householdByAge, shortfall, type Stage } from "../schedule";
import { planSources } from "../score";
import type { Answers, Sources } from "../store";

/** The first names the report is printed with; kept in this browser only. */
export interface ReportNames { you?: string; spouse?: string }

export type PageId = "cover" | "stand" | "road" | "family" | "college" | "bridge" | "last" | "money" | "social" | "pension" | "roadmap" | "health" | "debt" | "score" | "moves" | "sources" | "years";
export interface PageInfo { id: PageId; title: string; n: number; because?: string }
export type PhaseId = "save" | "early" | "medicare" | "ssEarly" | "ss" | "rmd";
export interface Phase { id: PhaseId; name: string; from: number; to: number }
export interface Stop { age: number; t: string; d: string; est?: boolean }
export interface BandYear { age: number; lo: number; mid: number; hi: number; min: number; max: number }
export interface RunSummary { y: number; ok: boolean; end: number; low: number; lowAge: number; outAge: number | null; path: number[] }

const PHASE_NAMES: Record<PhaseId, string> = {
  save: "Saving", early: "Before Medicare", medicare: "Medicare, before Social Security",
  ssEarly: "Social Security, before Medicare", ss: "Social Security", rmd: "Required withdrawals",
};

const quant = (s: number[], q: number) => { const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.min(s.length - 1, lo + 1); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const clean = (s?: string) => (s || "").trim().replace(/\s+/g, " ").slice(0, 30);

export function reportModel(a0: Answers, src: Sources, levers: Levers, names: ReportNames = {}, today = new Date()) {
  const a = withGuess(a0), F = factsHere(a, levers), S = F.S as Sim | null;
  if (!S || !ok(a.age)) return null;
  const age0 = Math.round(a.age);
  const L = planLists(a, src, F);
  const score = L.R.score;
  if (score == null) return null;
  const married = a.status === "m" && ok(a.spouseAge);
  const you = clean(names.you), spouse = married ? clean(names.spouse) : "";

  /* ---------- who, in words ---------- */
  const gap = married ? a.age - a.spouseAge! : 0;
  const who = {
    married, you, spouse,
    title: you && spouse ? you + " and " + spouse : you || "Your retirement plan",
    /** "Maya's age" / "Your age": every age in the report is the first person's. */
    axis: you ? you + "'s age" : "Your age",
    /** The same inside a sentence: "Maya's age" / "your age". */
    axisIn: you ? you + "'s age" : "your age",
    /** Both ages at one of yours: "Maya 62, Sam 60". */
    pair: (age: number) => (married ? (you || "You") + " " + age + ", " + (spouse || "your spouse") + " " + Math.round(age - gap) : String(age)),
    first: you || "you", second: spouse || "your spouse",
    /** The spouse's age `n` as one of yours. */
    mine: (n: number) => Math.round(n + gap),
  };

  /* ---------- the plan's moments ---------- */
  const retire = Math.round(S.retire), end = S.D.rows.length ? S.D.rows[S.D.rows.length - 1].age : retire + S.years - 1;
  const claim1 = S.ss.claim, claim2 = married ? who.mine(S.ss.claim2 ?? S.ss.claim) : null;
  const firstClaim = Math.min(claim1, claim2 ?? claim1);
  const rmdAge = (S.C as unknown as { rmdAge?: number }).rmdAge ?? 75;
  const med1 = 65, med2 = married ? who.mine(65) : null;
  const firstMed = Math.min(med1, med2 ?? med1);
  const phaseAt = (t: number): PhaseId => {
    if (t < retire) return "save";
    if (t >= rmdAge) return "rmd";
    const m = t >= firstMed, s = t >= firstClaim;
    return s ? (m ? "ss" : "ssEarly") : m ? "medicare" : "early";
  };
  const phases: Phase[] = [];
  for (let t = age0; t <= end; t++) {
    const id = phaseAt(t), last = phases[phases.length - 1];
    if (last && last.id === id) last.to = t + 1; else phases.push({ id, name: PHASE_NAMES[id], from: t, to: t + 1 });
  }

  const kids = children(a), college = collegeToday(a);
  const stops: Stop[] = [{ age: age0, t: "Today", d: married ? who.pair(age0) + "." : "Age " + age0 + "." }];
  kids.filter((c) => c.planned).forEach((c, i, all) => stops.push({ age: c.born, t: all.length > 1 ? "Child " + (i + 1) + " born" : kids.length > 1 ? "Second child" : "A child born",
    d: "Planned " + (c.born - age0) + " years from now" + (c.childcare ? ", with childcare to 6." : ".") }));
  (college?.kids ?? []).forEach((k, i, all) => { if (k.from > age0) stops.push({ age: k.from, t: all.length > 1 ? (i ? "Second college" : "College begins") : "College begins", d: "Four years of college, to " + k.to + (k.to > retire && k.from < retire ? ", past retirement." : ".") }); });
  stops.push({ age: retire, t: "Retire", d: who.pair(retire) + "." });
  if (retire < 59.5) stops.push({ age: 60, t: "Age 59½", d: "401(k) and IRA withdrawals become penalty-free." });
  if (firstMed > age0) stops.push({ age: firstMed, t: "Medicare", d: married ? "At 65 for each of you." : "At 65." });
  const c2 = S.ss.claim2 ?? S.ss.claim;
  stops.push({ age: firstClaim, t: "Social Security", d: !married ? "You claim at " + S.ss.claim + "." : c2 === S.ss.claim ? "Each of you claims at " + S.ss.claim + "." : "Claiming at " + S.ss.claim + " and " + c2 + "." });
  if (S.pension > 0 && ok(a.pensionAge) && a.pensionAge !== retire) stops.push({ age: Math.round(a.pensionAge), t: "Pension", d: "Starts at " + a.pensionAge + "." });
  if (rmdAge < end) stops.push({ age: rmdAge, t: "Required withdrawals", d: "The IRS sets a minimum from traditional accounts." });
  stops.sort((x, y) => x.age - y.age);

  /* ---------- history ---------- */
  const runs: RunSummary[] = S.H.runs.map((r) => {
    const path = Array.from(r.path ?? []), low = path.length ? Math.min(...path) : 0, at = path.indexOf(low), out = path.findIndex((v) => v <= 0);
    return { y: r.startYear, ok: r.ok, end: r.end, low, lowAge: retire + Math.max(0, at), outAge: r.ok || out < 0 ? null : retire + out, path };
  });
  const band: BandYear[] = [];
  const n = runs.length ? runs[0].path.length : 0;
  for (let i = 0; i < n; i++) {
    const col = runs.map((r) => r.path[i] ?? 0).sort((x, y) => x - y);
    band.push({ age: retire + i, lo: quant(col, 0.1), mid: quant(col, 0.5), hi: quant(col, 0.9), min: col[0], max: col[col.length - 1] });
  }
  // The least left among the retirements that lasted (all of them, when none did).
  const lasting = runs.some((r) => r.ok) ? runs.filter((r) => r.ok) : runs;
  const worst = lasting.reduce((m, r) => (r.end < m.end ? r : m), lasting[0]);
  const accum = S.path.map((v, i) => ({ age: age0 + i, v }));

  /* ---------- the money, year by year (the steady path) ---------- */
  const rows = S.D.rows;
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((t, r) => t + f(r), 0);
  const money = {
    in: [["Social Security", sum((r) => r.ss), "ss"], ["Pension", sum((r) => r.pension), "pension"], ["Traditional accounts", sum((r) => r.trad), "trad"],
      ["Roth", sum((r) => r.roth), "roth"], ["Brokerage", sum((r) => r.brok), "brok"]] as [string, number, string][],
    out: [["Spent", sum((r) => r.spend - r.short), "spent"], ["Income tax", sum((r) => r.tax + r.irmaa), "tax"], ["Health insurance", sum((r) => r.health), "health"],
      ["Penalties", sum((r) => r.pen), "pen"], ["Reinvested", sum((r) => r.surplus), "surplus"]] as [string, number, string][],
    taxAfterRmd: sum((r) => (r.age >= rmdAge ? r.tax + r.irmaa : 0)), tax: sum((r) => r.tax + r.irmaa),
  };

  /* ---------- the margin (or the gap), from the Guide's own options ---------- */
  const goal = target(a), ahead = !!F.O?.ahead;
  const pick = (id: string) => F.O?.list.find((o) => o.id === id)?.set;
  const levers3: { fig: string; label: string }[] = [];
  if (ahead) {
    const e = pick("earlier"), c = pick("coast"), m = pick("more");
    if (e?.retire != null) levers3.push({ fig: String(e.retire), label: "retire " + (retire - e.retire) + (retire - e.retire === 1 ? " year" : " years") + " sooner" });
    if (c) levers3.push({ fig: c.stopAge! <= a.age ? "Stop" : String(c.stopAge), label: c.stopAge! <= a.age ? "saving now and coast" : "stop saving at that age" });
    if (m?.retSpend != null) levers3.push({ fig: fmtMoney(m.retSpend), label: "per year to spend, not " + fmtMoney(a.retSpend!) });
  } else {
    const x = pick("extra"), l = pick("later"), sp = pick("less-spend");
    if (x?.contrib != null) levers3.push({ fig: fmtMoney(x.contrib - (a.contrib || 0)), label: "per month more saved" });
    if (l?.retire != null) levers3.push({ fig: String(l.retire), label: "retire at this age instead" });
    if (sp?.retSpend != null) levers3.push({ fig: fmtMoney(sp.retSpend), label: "per year to spend in retirement" });
  }

  /* ---------- the conditional pages ---------- */
  const changes = hasChanges(a) && S.sched ? (() => {
    const flat = sim(a, { flat: true });
    return { sched: S.sched as Stage[], short: shortfall(S.sched), flat, house: householdByAge(a, retire + 1).filter((h) => h.age < retire),
      kids, planned: kids.filter((c) => c.planned).length, cost: CHILD_COST, source: CHILD_SOURCE, monthly: S.monthly };
  })() : null;
  const healthRows = rows.filter((r) => r.age < Math.max(firstMed, med2 ?? 0) + 3);
  const health = retire < 65 && S.hcYr > 0 ? { rows: healthRows, before: sum((r) => (r.health - r.med) > 0 ? r.health - r.med : 0), years: S.hcYears, avg: S.hcYr, med1, med2 } : null;
  const collegePage = college && college.kids.length ? college : null;

  /* Getting to 59½: the plan's own years before it, account by account,
     and the Early Retirement Bridge's verdict when the Guide went there. */
  const bridge = retire < 59.5 ? (() => {
    const yrs = rows.filter((r) => r.age < 59.5), P = S.P as unknown as { trad: number; roth: number; brok: number; rothBasis?: number };
    const tot = (k: "trad" | "roth" | "brok" | "pen" | "tax" | "health") => yrs.reduce((t, r) => t + r[k], 0);
    return { rows: yrs, years: Math.ceil(59.5 - retire), at: { trad: P.trad, roth: P.roth, brok: P.brok, rothBasis: P.rothBasis ?? 0 },
      out: { trad: tot("trad"), roth: tot("roth"), brok: tot("brok") }, pen: tot("pen"), tax: tot("tax"), health: tot("health"),
      rule55: a.rule55 === "yes" && retire >= 55, tool: a.bridge ? { phrase: a.bridge, hold: a.bridgeHold ?? null, left: a.bridgeLeft ?? null } : null,
      move: L.list.find((m) => m.id === "bridge" || m.id === "bridge-shore") ?? null };
  })() : null;

  /* A pension: what it pays, from when, and how much of the spending it
     carries; without a cost-of-living raise it shrinks in today's dollars. */
  const pension = S.pension > 0 && pos(a.pension) ? (() => {
    const from = Math.round(ok(a.pensionAge) ? a.pensionAge : retire), first = rows.find((r) => r.pension > 0);
    const last = rows[rows.length - 1];
    return { monthly: a.pension!, from, cola: a.pensionCola === "yes", firstYear: first?.pension ?? 0, lastYear: last.pension,
      share: first ? first.pension / Math.max(1, first.spend) : 0, total: rows.reduce((t, r) => t + r.pension, 0),
      withSS: rows.find((r) => r.age >= Math.max(firstClaim, claim2 ?? 0) && r.pension > 0) ?? null };
  })() : null;

  /* Social Security for a couple: each benefit at the plan's claiming ages,
     what each would get claiming at 62 to 70 (the other held where it is),
     and what the survivor keeps. */
  const social = married ? (() => {
    const pia = pias(a, retire), g2 = Math.round(a.spouseAge! - a.age!);
    const at = (c1: number, c2: number) => plSSParts({ P: { pia1: pia.pia1, pia2: pia.pia2 }, married: true, gap: g2 }, { c1, c2 });
    const c2 = S.ss.claim2 ?? S.ss.claim, ages = [62, 63, 64, 65, 66, 67, 68, 69, 70];
    return { pia1: pia.pia1, pia2: pia.pia2, own1: pia.own, own2: pia.own2, a1: S.ss.a1, a2: S.ss.a2, claim1: S.ss.claim, claim2: c2,
      spousal: S.ss.spousal, survivor: Math.max(S.ss.a1, S.ss.a2),
      ladder1: ages.map((c) => { const x = at(c, c2); return { age: c, v: x.own1 + x.top1 }; }),
      ladder2: ages.map((c) => { const x = at(S.ss.claim, c); return { age: c, v: x.own2 + x.top2 }; }) };
  })() : null;

  /* The Plan Optimizer's roadmap, once applied: against the same plan
     without it (base), as the Guide's own sim works both out. */
  const roadmap = S.tactics ? (() => {
    const base = sim(a, undefined, true), C = S.C as unknown as { married: boolean; gap?: number; rmdAge?: number };
    const goal = a.optGoal === "last" || a.optGoal === "spend" ? a.optGoal : "legacy";
    return { claims: opClaims(S.T, C), claimsShort: opClaims(S.T, C, true), line: opTacticsLine(S.T, C), until: opConvUntil(S.T, C), goal: OP_GOALS[goal][0], goalDesc: OP_GOALS[goal][1],
      conv: rows.filter((r) => r.conv > 0).map((r) => ({ age: r.age, conv: r.conv })), convTotal: rows.reduce((t, r) => t + r.conv, 0),
      base: base ? { tax: base.lifeTax, success: base.success, legacy: base.H.medLegacy, claim: base.ss.claim, claim2: base.ss.claim2, ss: base.ss.total } : null,
      now: { tax: S.lifeTax, success: S.success, legacy: S.H.medLegacy } };
  })() : null;

  /* Debt: the Debt Payoff tool's own plan when the Guide brought the debts
     back from it, or the quick totals the Guide asked for. */
  const debt = a.debtHas === "yes" && pos(a.debtTotal) ? (() => {
    const rowsIn = Array.isArray(a.debtRows) ? (a.debtRows as DebtRow[]) : [];
    const D = rowsIn.length ? debtCompute({ ...DEBT_DEFAULTS, rows: rowsIn, extra: String(a.debtExtra ?? 0), mode: "avalanche" }) : null;
    const plan = D?.plan ?? null;
    return { total: a.debtTotal!, hi: a.debtHi ?? 0, min: a.debtMin ?? null, extra: a.debtExtra ?? 0, months: a.debtMonths ?? null,
      free: a.debtMonths ? debtDate(a.debtMonths) : plan && !plan.pick.stalled ? debtDate(plan.pick.monthsTotal) : null,
      plan: plan ? { order: plan.pick.order.map((d) => ({ desc: d.desc, apr: d.apr * 100, start: d.start, interest: d.interest, month: d.paidMonth })),
        interest: plan.pick.totalInterest, months: plan.pick.monthsTotal, stalled: plan.pick.stalled, minInterest: plan.mn.totalInterest, minMonths: plan.mn.monthsTotal,
        saved: plan.saved, warn: plan.warn } : null,
      moves: L.list.filter((m) => m.area === "debt") };
  })() : null;

  const pages: PageInfo[] = [];
  const add = (id: PageId, title: string, because?: string) => pages.push({ id, title, because, n: pages.length + 1 });
  add("cover", who.title);
  add("stand", "Where you stand");
  add("road", "The road from here");
  if (changes) add("family", changes.kids.length ? "Saving as the family grows" : "Saving as things change", "On this report because of your changes ahead");
  if (collegePage) add("college", collegePage.kids.length > 1 ? "College for " + (collegePage.kids.length === 2 ? "two" : collegePage.kids.length) : "College", "On this report because you're saving for college");
  if (bridge) add("bridge", "Getting to 59½", "On this report because you retire before 59½");
  add("last", "Will it last?");
  add("money", "Where the money comes from");
  if (social) add("social", "Social Security for both of you", "On this report because you plan as a couple");
  if (pension) add("pension", "Your pension", "On this report because you have a pension");
  if (roadmap) add("roadmap", "Your Plan Optimizer roadmap", "On this report because you applied the Plan Optimizer");
  if (health) add("health", "Health insurance before Medicare", "On this report because you retire before 65");
  if (debt) add("debt", "Paying off debt", "On this report because you have debt besides a mortgage");
  add("score", "Your score, area by area");
  add("moves", "Your next moves");
  add("sources", "Assumptions and sources");
  // The year-by-year table runs over as many pages as it needs.
  // At most 36 rows a sheet, split evenly so the last sheet isn't a few rows.
  const PER = Math.ceil(rows.length / Math.max(1, Math.ceil(rows.length / 36)));
  for (let i = 0; i < rows.length; i += PER) add("years", i ? "Year by year, continued" : "Year by year");

  return {
    a, a0, S, F, need: F.need ?? 0, goal, ahead, levers3, R: { ...L.R, score }, rating: rating(score), list: L.list as Move[], kit: L.kit,
    why: planSources(a0, src), who, retire, end, rmdAge, firstClaim, firstMed, claim2, phases, stops, runs, band, worst, accum, rows, money,
    changes, college: collegePage as CollegePlanToday | null, health, bridge, pension, social, roadmap, debt, pages, perPage: PER, factors: FACTORS, strategy: stratName(a.strategy || "fixed"),
    date: today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), year0: today.getFullYear(),
  };
}
export type ReportModel = NonNullable<ReturnType<typeof reportModel>>;
