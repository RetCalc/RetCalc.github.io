/* The Dashboard's printed report: everything its pages show, gathered from
   the Dashboard's own code (model.ts results, flows.ts, the Guide's plan it
   runs on, the Drawdown Simulator's run behind the chance of success), with
   nothing worked out here but sums, sorting and each history start's own
   figures. The pages only lay it out. Which pages appear follows the
   household: one person or two, owning or renting, children and college,
   retiring before 59½ or 65, changes ahead in the Calculator, abroad. No
   React, so it can run anywhere the Dashboard's model does. */

import { plSSParts } from "@/lib/engine/typed-plan";
import { ddWindows, runDrawdown } from "@/lib/engine/typed-drawdown";
import { parseNum } from "@/lib/format";
import { drawdownSetup } from "@/tools/drawdown/model";
import { DD_UI } from "@/tools/drawdown/text";
import { FACTORS, fras, pias, rating, target } from "@/tools/guide/calc";
import type { BandYear, Phase, PhaseId, RunSummary, Stop } from "@/tools/guide/report/model";
import { bridgeSummary, earlyRetirees } from "../bridge";
import { collegeChildren, collegeKid, collegeNeedOf, collegeYears } from "../college";
import { ALL_TOGETHER, COLLEGE_LINE, detailed, drawdownFor, flow, growthLines, mixWords, personSaving, retireMix, stocksOf } from "../flows";
import { raiseWords } from "../yearly";
import { healthGap } from "../health";
import { payoffDrop } from "../housing";
import { ASSET_GROUPS, DEBT_GROUPS, groupOf, kindName, ownerOf } from "../kinds";
import { ageOf, answers, couple, grossYear, payYear, holdings, mortgage, nameOf, outsideUS, people, results, spendMonth, type Results } from "../model";
import { allSteps } from "../nextsteps";
import { explain } from "../readiness";
import { liveScenarios, scenarioName, scenarioSentence } from "../scenarios";
import { PER_LABEL, hasAccounts, netWorth, sum, type DashData, type Item } from "../store";

export type PageId = "cover" | "stand" | "worth" | "income" | "spending" | "saving" | "home" | "family" | "changes" | "road" | "last" | "bridge" | "social"
  | "health" | "money" | "score" | "next" | "sources" | "saveyears" | "years";
export interface PageInfo { id: PageId; title: string; n: number; because?: string }

const PHASE_NAMES: Record<PhaseId, string> = {
  save: "Working and saving", early: "Before Medicare", medicare: "Medicare, before Social Security",
  ssEarly: "Social Security, before Medicare", ss: "Social Security", rmd: "Required withdrawals",
};
/** Kinds in a word or two, for a table column. */
const SHORT_KIND: Record<string, string> = { workplace: "401(k), 403(b)", g457: "457(b)", ira: "IRA", roth: "Roth", hsa: "HSA", brokerage: "Brokerage", cash: "Cash", home: "Home", other: "Other",
  mortgage: "Mortgage", car: "Car loan", student: "Student loan", loan: "Loan", card: "Credit card" };
const quant = (s: number[], q: number) => s[Math.min(s.length - 1, Math.max(0, Math.floor(s.length * q)))];
/** Each month's amount of a budget line. */
const monthly = (amount: string, freq: number) => (parseNum(amount) || 0) * (freq || 12) / 12;

export function dashReport(d: DashData, today = new Date()) {
  const pr = d.profile, entries = d.entries;
  const R: Results = results(pr, entries);
  const S = R.S, a = answers(pr, entries);
  if (!S || a.age == null || R.retireYear == null) return { missing: R.gap ?? "Your plan needs your ages, pay, savings and spending." } as const;
  const two = couple(pr), abroad = outsideUS(pr);
  const F = flow(pr), H = holdings(entries, pr), last = entries[entries.length - 1] ?? null;

  /* ---------- who, in words ---------- */
  const n1 = pr.p1.name.trim(), n2 = two ? pr.p2.name.trim() : "";
  const age0 = Math.round(a.age), age2 = two ? ageOf(pr.p2) : null;
  const gap = two && age2 != null ? a.age - age2 : 0;
  const by1 = pr.p1.by ?? today.getFullYear() - age0;
  const who = {
    two, n1, n2,
    title: n1 && n2 ? n1 + " and " + n2 : n1 || "Your financial plan",
    /** Every age in the report is the first person's, as the Dashboard's plan counts them. */
    axis: n1 ? n1 + "'s age" : "Your age",
    axisIn: n1 ? n1 + "'s age" : "your age",
    first: n1 || "you", second: n2 || "your partner",
    First: n1 || "You", Second: n2 || "Your partner",
    /** Both ages at one of the first person's: "Sam 62, Jordan 60". */
    pair: (age: number) => (two && age2 != null ? (n1 || "You") + " " + age + ", " + (n2 || "your partner") + " " + Math.round(age - gap) : String(age)),
    /** The partner's age `n`, as one of the first person's. */
    mine: (n: number) => Math.round(n + gap),
  };
  /** The calendar year the first person turns `age`. */
  const yearOf = (age: number) => by1 + age;

  /* ---------- the plan's moments ---------- */
  const retire = Math.round(S.retire), rows = S.D.rows, end = rows.length ? rows[rows.length - 1].age : retire + S.years - 1;
  const claim1 = S.ss.claim, claim2 = two && S.ss.a2 > 0 ? who.mine(S.ss.claim2) : null;
  const firstClaim = abroad ? 999 : Math.min(claim1, claim2 ?? claim1);
  const rmdAge = (S.C as unknown as { rmdAge?: number }).rmdAge ?? 75;
  const med2 = two ? who.mine(65) : null, firstMed = Math.min(65, med2 ?? 65);
  const phaseAt = (t: number): PhaseId => {
    if (t < retire) return "save";
    if (t >= rmdAge) return "rmd";
    const m = t >= firstMed, s = t >= firstClaim;
    return s ? (m ? "ss" : "ssEarly") : m ? "medicare" : "early";
  };
  const phases: Phase[] = [];
  for (let t = age0; t <= end; t++) {
    const id = phaseAt(t), l = phases[phases.length - 1];
    if (l && l.id === id) l.to = t + 1; else phases.push({ id, name: PHASE_NAMES[id], from: t, to: t + 1 });
  }

  const kids = collegeChildren(pr), kidYears = collegeYears(pr), M = mortgage(pr, entries);
  const stops: Stop[] = [{ age: age0, t: "Today", d: two ? who.pair(age0) + "." : "Age " + age0 + "." }];
  kids.forEach((c) => { if (c.planned && c.bornIn > 0) stops.push({ age: age0 + c.bornIn, t: "A child born", d: "Planned about " + c.bornIn + (c.bornIn === 1 ? " year" : " years") + " from now." }); });
  if (pr.college.help !== "none") kids.forEach((c, i) => { const s = age0 + kidYears[i]; if (kidYears[i] > 0 && s < end) stops.push({ age: s, t: (c.planned ? "College" : c.name + "'s college") + " begins", d: collegeKid(pr, i).years + " years of it." }); });
  if (M.payoff != null && M.payoff < yearOf(end)) stops.push({ age: Math.round(age0 + (M.payoff - today.getFullYear())), t: "Mortgage paid off", d: "At today's payment." });
  const r2 = two && pr.p2.retire != null && age2 != null ? who.mine(pr.p2.retire) : null;
  stops.push({ age: retire, t: r2 === retire ? "You both retire" : (two ? who.First + " retires" : "Retire"), d: who.pair(retire) + "." });
  if (r2 != null && r2 !== retire) stops.push({ age: r2, t: who.Second + " retires", d: who.pair(r2) + "." });
  if (retire < 59.5) stops.push({ age: 60, t: "Age 59½", d: "401(k) and IRA withdrawals become penalty-free." });
  if (!abroad && firstMed > age0) stops.push({ age: firstMed, t: "Medicare", d: two ? "At 65 for each of you." : "At 65." });
  if (!abroad) stops.push({ age: firstClaim, t: "Social Security", d: !two || claim2 == null ? "Claimed at " + claim1 + "." : S.ss.claim2 === claim1 ? "Each of you claims at " + claim1 + "." : "Claimed at " + claim1 + " and " + S.ss.claim2 + "." });
  if (rmdAge < end) stops.push({ age: rmdAge, t: "Required withdrawals", d: "The IRS sets a minimum from traditional accounts." });
  stops.sort((x, y) => x.age - y.age);

  /* ---------- the run behind the chance of success ----------
     The Retirement tab's simulator on the plan: every starting month since
     1926 for the chance, each January start for the bars and the table,
     each year's spread for the fan. */
  const dd = drawdownFor(pr, R.ddPlan), { o, P } = drawdownSetup(dd), W = ddWindows(o);
  const years = o.years, cols = Array.from({ length: years }, () => [] as number[]), spends = Array.from({ length: years }, () => [] as number[]);
  const runs: RunSummary[] = [];
  let ok = 0;
  W.forEach((w) => {
    const r = runDrawdown(o, w.seq, null, P);
    if (!r.depleted) ok++;
    const path = Array.from({ length: years }, (_, y) => Math.max(0, r.rows[y]?.realEnd ?? 0));
    path.forEach((v, y) => { cols[y].push(v); spends[y].push(r.rows[y]?.realSpend ?? 0); });
    if (w.month === 1) {
      const low = Math.min(...path), at = path.indexOf(low);
      runs.push({ y: w.year, ok: !r.depleted, end: path[path.length - 1] ?? 0, low, lowAge: retire + 1 + Math.max(0, at),
        outAge: r.depleted && r.depletedYear != null ? retire + r.depletedYear : null, path });
    }
  });
  const band: (BandYear & { p25: number; p75: number })[] = cols.map((c, y) => {
    const s = c.slice().sort((p, q) => p - q);
    return { age: retire + 1 + y, lo: quant(s, 0.1), p25: quant(s, 0.25), mid: quant(s, 0.5), p75: quant(s, 0.75), hi: quant(s, 0.9), min: s[0] ?? 0, max: s[s.length - 1] ?? 0 };
  });
  const spendBand = spends.map((c, y) => { const s = c.slice().sort((p, q) => p - q); return { age: retire + 1 + y, lo: quant(s, 0.1), mid: quant(s, 0.5), hi: quant(s, 0.9) }; });
  const lasting = runs.some((r) => r.ok) ? runs.filter((r) => r.ok) : runs;
  const worst = lasting.reduce((m, r) => (r.end < m.end ? r : m), lasting[0] ?? { y: 0, ok: false, end: 0, low: 0, lowAge: 0, outAge: null, path: [] });
  const strat = pr.strategy && DD_UI[pr.strategy] ? { id: pr.strategy, name: DD_UI[pr.strategy].name, blurb: DD_UI[pr.strategy].blurb } : null;
  const adapts = !!strat && strat.id !== "fixed" && spendBand.some((b) => b.hi - b.lo > Math.max(500, b.mid * 0.05));
  const hist = { ok, of: W.length, first: W[0]?.year ?? 1926, lastStart: runs[runs.length - 1]?.y ?? 0, years, band, spendBand, adapts, strat,
    firstSpend: drawdownSetup(dd).firstW, medianEnd: band.length ? band[band.length - 1].mid : 0 };

  /* ---------- the money, year by year (the steady path) ---------- */
  const total = (f: (r: (typeof rows)[number]) => number) => rows.reduce((t, r) => t + f(r), 0);
  const money = {
    in: [["Social Security", total((r) => r.ss), "ss"], ["Pension", total((r) => r.pension), "pension"], ["Traditional accounts", total((r) => r.trad), "trad"],
      ["Roth", total((r) => r.roth), "roth"], ["Brokerage", total((r) => r.brok), "brok"]] as [string, number, string][],
    out: [["Spent", total((r) => r.spend - r.short), "spent"], ["Income tax", total((r) => r.tax + r.irmaa), "tax"], ["Health insurance", total((r) => r.health), "health"],
      ["Penalties", total((r) => r.pen), "pen"], ["Reinvested", total((r) => r.surplus), "surplus"]] as [string, number, string][],
    tax: total((r) => r.tax + r.irmaa), taxAfterRmd: total((r) => (r.age >= rmdAge ? r.tax + r.irmaa : 0)),
  };

  /* ---------- net worth ---------- */
  const items = last?.items ?? [];
  const names: [string, string] | null = two ? [pr.p1.name, pr.p2.name] : null;
  const itemRow = (i: Item) => {
    const w = ownerOf(i, names);
    return { name: i.name.trim() || kindName(i.kind), kind: SHORT_KIND[i.kind] ?? kindName(i.kind), value: i.value, rate: i.rate ?? null, basis: i.basis ?? null,
      whose: w == null ? null : nameOf(pr, w), gain: i.kind === "brokerage" && i.basis != null ? i.value - i.basis : null };
  };
  const groups = (side: Item["side"], list: { id: string; name: string }[]) => list.map((g) => {
    const its = items.filter((i) => i.side === side && groupOf(i.kind) === g.id && i.value > 0).sort((x, y) => y.value - x.value);
    return { id: g.id, name: g.name, total: its.reduce((t, i) => t + i.value, 0), items: its.map(itemRow) };
  }).filter((g) => g.items.length);
  const hist2 = entries.map((e) => ({ date: e.date, t: Number(e.date.slice(0, 4)) + (Number(e.date.slice(5, 7)) - 1) / 12 + (Number(e.date.slice(8, 10)) - 1) / 365,
    nw: netWorth(e), assets: sum(e.items, "asset"), debts: sum(e.items, "debt") }));
  const yearAgo = hist2.length > 1 ? hist2.slice(0, -1).reverse().find((h) => (today.getTime() - new Date(h.date).getTime()) / 864e5 >= 330) ?? null : null;
  const worth = {
    // With no balances entered yet, setup's figures: what's saved and the home, less the mortgage.
    accounts: hasAccounts(entries), date: last?.date ?? null, assets: last ? sum(items, "asset") : H.trad + H.home, debts: last ? sum(items, "debt") : H.mortgage, net: last ? netWorth(last) : H.total,
    assetGroups: groups("asset", ASSET_GROUPS), debtGroups: groups("debt", DEBT_GROUPS),
    history: hist2, first: hist2[0] ?? null, prev: hist2.length > 1 ? hist2[hist2.length - 2] : null, yearAgo,
    debtsHigh: H.debtsHigh, cash: H.cash, H,
  };

  /* ---------- income, taxes and spending ---------- */
  // Abroad, pay is entered after taxes and stays so; at home it's shown before them.
  const pay = people(pr).map((p, i) => ({ name: nameOf(pr, i ? 1 : 0), year: (abroad ? payYear(p) : grossYear(p)) ?? 0, entered: p.pay, per: PER_LABEL[p.per], after: p.taxed === "after", retire: p.retire }));
  const save = { F, lines: growthLines(pr, F).filter((l) => l.amount > 0.5 || l.capped), raises: raiseWords(pr, two ? [nameOf(pr, 0), nameOf(pr, 1)] : null), per: [0, ...(two ? [1] : [])].map((i) => ({ name: nameOf(pr, i as 0 | 1), ...personSaving(F, i as 0 | 1) })),
    rate: F.gross > 0 ? (F.invested + F.match) / F.gross : null,
    /** The plan's own saving each year to retirement, a month, by account (children's costs taken out). */
    years: (a.yearly ?? []).slice(0, Math.max(0, retire - age0)).map((y, k) => ({ age: age0 + k, t: y.t, r: y.r, b: y.b, short: y.short })),
    atRetire: (() => { const p = S.P as unknown as { trad: number; roth: number; brok: number; rothBasis?: number }; return { trad: p.trad, roth: p.roth, brok: p.brok }; })(),
    path: S.path.slice(0, Math.max(1, retire - age0 + 1)).map((v, k) => ({ age: age0 + k, v })),
  };
  const budgetRows = F.b.rows.filter((r) => monthly(r.amount, r.freq) > 0 && r.desc !== COLLEGE_LINE);
  const spend = {
    month: spendMonth(pr) ?? 0, total: F.spend, detailed: detailed(F.b),
    // The budget's one-number line ("Everything else") sits in a group of its own, by its own name.
    groups: (() => { const g: Record<string, number> = {};
      budgetRows.forEach((r) => { const k = r.desc === ALL_TOGETHER ? ALL_TOGETHER : r.group || "Custom"; g[k] = (g[k] ?? 0) + monthly(r.amount, r.freq); });
      return Object.entries(g).map(([group, month]) => ({ group, month })).sort((x, y) => y.month - x.month); })(),
    lines: budgetRows.map((r) => ({ group: r.desc === ALL_TOGETHER ? ALL_TOGETHER : r.group || "Custom", desc: r.desc, month: monthly(r.amount, r.freq) })).sort((x, y) => y.month - x.month),
    college: F.college, efMonths: F.efMonths, efTarget: F.efTarget, cash: H.cash, cushion: R.cushion,
    goal: R.goal, planSpend: R.spend, own: pr.ddOwn?.rate != null, drop: payoffDrop(pr, entries),
  };

  /* ---------- the conditional pages ---------- */
  const home = pr.home === "own" ? {
    own: true as const, value: H.home, owed: H.mortgage, equity: H.home - H.mortgage, M, costs: pr.homeCosts ?? null, drop: spend.drop,
    /** What's owed at the start of each year until it's paid, at today's payment. */
    bal: (() => {
      // Each year from today: owed at its start, and the interest and principal paid in it.
      const out: { year: number; owed: number; interest: number; principal: number }[] = [];
      if (!(M.owed > 0) || !M.pay || M.months == null) return out;
      let b = M.owed;
      const r = (M.rate ?? 0) / 12;
      for (let k = 0; k < M.months && out.length < 41; k++) {
        if (k % 12 === 0) out.push({ year: today.getFullYear() + k / 12, owed: b, interest: 0, principal: 0 });
        const i = b * r, row = out[out.length - 1], paid = Math.min(b + i, M.pay);
        row.interest += i; row.principal += paid - i;
        b = Math.max(0, b + i - paid);
      }
      out.push({ year: today.getFullYear() + M.months / 12, owed: 0, interest: 0, principal: 0 });
      return out;
    })(),
  } : pr.home === "rent" ? { own: false as const, rent: pr.rent ?? 0, ins: pr.rentIns ?? 0 } : null;
  // A home owned outright with none of its costs set says all it has on Net worth.
  const homeShown = home && (home.own ? home.owed > 0 || !!home.costs : home.rent > 0);

  const kidsNow = kids.filter((c) => !c.planned && c.age < 30);
  const family = kids.length ? {
    kids: kids.map((c, i) => ({ ...c, college: pr.college.help !== "none" ? { from: today.getFullYear() + kidYears[i], ...collegeKid(pr, i) } : null })),
    help: pr.college.help, need: collegeNeedOf(pr), saving: F.college, plan: pr.college.plan ?? null, childcare: pr.childcare, careArea: pr.careArea,
    sched: S.sched ?? null, now: kidsNow.length,
  } : null;

  const changeList = liveScenarios(pr.scenarios).filter((s) => !s.id.startsWith("__"));
  const changes = changeList.length ? (() => {
    // The plan with none of the Calculator's changes, for what they add up to.
    const pr0 = { ...pr, scenarios: (pr.scenarios ?? []).filter((s) => s.kind === "children" || s.id.startsWith("__")) }, base = results(pr0, entries);
    const y0 = answers(pr0, entries).yearly ?? [], n = Math.max(0, retire - age0);
    return { list: changeList.map((s) => ({ name: scenarioName(s), sentence: scenarioSentence(s, retire, pr.assume.growth), kind: s.kind })),
      without: base.atRetire, success: base.success,
      /** Savings by age to retirement, with the changes and without. */
      path: S.path.slice(0, n + 1).map((v, k) => ({ age: age0 + k, v })), path0: (base.S?.path ?? []).slice(0, n + 1).map((v, k) => ({ age: age0 + k, v })),
      /** Saving a month each year, with and without. */
      saving: (a.yearly ?? []).slice(0, n).map((y, k) => ({ age: age0 + k, v: y.t + y.r + y.b, v0: y0[k] ? y0[k].t + y0[k].r + y0[k].b : 0 })) };
  })() : null;

  const early = earlyRetirees(pr)[0] ?? null;
  const bridge = early ? (() => {
    const yrs = rows.filter((r) => r.age < 59.5), Pp = S.P as unknown as { trad: number; roth: number; brok: number; rothBasis?: number };
    const tot = (k: "trad" | "roth" | "brok" | "pen" | "tax" | "health") => yrs.reduce((t, r) => t + r[k], 0);
    return { early, rows: yrs, at: { trad: Pp.trad, roth: Pp.roth, brok: Pp.brok, rothBasis: Pp.rothBasis ?? 0 }, out: { trad: tot("trad"), roth: tot("roth"), brok: tot("brok") },
      pen: tot("pen"), tax: tot("tax"), health: tot("health"), plan: pr.bridge ? bridgeSummary(pr, entries, R) : null, dock: R.bridgeDock };
  })() : null;

  const hg = healthGap(pr);
  const health = hg && S.hcYr > 0 ? { gap: hg, rows: rows.filter((r) => r.age < Math.max(65, med2 ?? 0) + 3), before: total((r) => (r.health - r.med > 0 ? r.health - r.med : 0)), avg: S.hcYr, years: S.hcYears } : null;

  /* Social Security: each benefit at the plan's claiming ages, and what each
     would get claiming at 62 to 70 (the other held where it is). */
  const social = !abroad ? (() => {
    const pia = pias(a, retire), Fr = fras(a), g2 = two && age2 != null ? Math.round(age2 - a.age!) : 0;
    const c2 = S.ss.claim2 ?? S.ss.claim, ages = [62, 63, 64, 65, 66, 67, 68, 69, 70];
    const at = (x1: number, x2: number) => plSSParts({ P: { pia1: pia.pia1, pia2: pia.pia2, fra1: Fr.fra1, fra2: Fr.fra2 }, married: two, gap: g2 }, { c1: x1, c2: x2 });
    return { two, fra1: Fr.fra1, fra2: Fr.fra2, pia1: pia.pia1, pia2: pia.pia2, own1: pia.own, own2: pia.own2, a1: S.ss.a1, a2: S.ss.a2, claim1: S.ss.claim, claim2: c2,
      spousal: S.ss.spousal, survivor: Math.max(S.ss.a1, S.ss.a2), pct: pr.ss.pct ?? 100, checked: pr.ss.checked,
      ladder1: ages.map((c) => { const x = at(c, c2); return { age: c, v: x.own1 + x.top1 }; }),
      ladder2: two ? ages.map((c) => { const x = at(S.ss.claim, c); return { age: c, v: x.own2 + x.top2 }; }) : [] };
  })() : null;

  /* ---------- the score, each area explained, and what to do ---------- */
  const score = R.score;
  const areas = FACTORS.map((f) => ({ ...f, part: R.parts[f.id] ?? null, why: explain(f.id, pr, entries, R) }));
  const steps = allSteps(d, R);
  const mix = retireMix(pr);

  /* ---------- pages ---------- */
  const pages: PageInfo[] = [];
  const add = (id: PageId, title: string, because?: string) => pages.push({ id, title, because, n: pages.length + 1 });
  add("cover", who.title);
  add("stand", "Where you stand");
  add("worth", "Net worth");
  add("income", abroad ? "Income" : "Income and taxes");
  add("spending", "Spending");
  add("saving", "Saving and investing");
  if (homeShown) add("home", home!.own ? "Your home" : "Renting", home!.own ? "On this report because you own your home" : "On this report because you rent");
  if (family) add("family", family.kids.length > 1 ? "Your children" : "Your child", "On this report because of the children in your plan");
  if (changes) add("changes", "Changes ahead", "On this report because of the changes in your Calculator");
  add("road", "The road from here");
  add("last", "Will it last?");
  if (bridge) add("bridge", "Getting to 59½", "On this report because " + (early!.name === "You" ? "you retire" : early!.name + " retires") + " before 59½");
  if (social) add("social", two ? "Social Security for both of you" : "Social Security");
  if (health) add("health", "Health cover before Medicare", "On this report because you stop work before 65");
  add("money", "Where the money comes from");
  add("score", "Your readiness score");
  add("next", "Next steps");
  add("sources", "Assumptions and method");
  // The tables run over as many sheets as they need, split evenly.
  const PER = 37;
  const split = (n: number) => { const sheets = Math.max(1, Math.ceil(n / PER)); return Math.ceil(n / sheets); };
  const perSave = split(save.years.length), perYears = split(rows.length);
  for (let i = 0; i < save.years.length; i += perSave) add("saveyears", i ? "Saving year by year, continued" : "Saving year by year");
  for (let i = 0; i < rows.length; i += perYears) add("years", i ? "Retirement year by year, continued" : "Retirement year by year");

  return {
    /** The cover map's legend goes top right when the plan's climb fills the top left. */
    legendRight: (() => { const pts = R.path, hi = Math.max(1, ...pts.map((q) => q.hi)), t0 = pts[0]?.t ?? 0, t1 = pts[pts.length - 1]?.t ?? 1;
      return pts.some((q) => q.t < t0 + (t1 - t0) * 0.42 && q.hi > hi * 0.5); })(),
    /** The age the cover's map starts at: the first balance entered, or today. */
    mapFrom: Math.floor(Math.min(a.age, ...hist2.map((h) => a.age! - (today.getTime() - new Date(h.date + "T12:00:00").getTime()) / 3.15576e10))),
    missing: null, pr, entries, R, S, a, F, H, who, abroad, today, yearOf, age0, retire, end, rmdAge, firstClaim, firstMed, claim2, med2, r2,
    phases, stops, runs, worst, hist, rows, money, worth, pay, other: pr.other.filter((x) => (x.amount ?? 0) > 0), save, spend, home: homeShown ? home : null,
    family, changes, bridge, health, social, score, rating: rating(score, R.partial), areas, steps, mix, mixWords: mixWords(mix), stocks: stocksOf(mix),
    goal: target(a), pages, perSave, perYears,
    // For the Guide's charts, which take the plan's figures by these names.
    factors: FACTORS, Rg: { P: R.parts as Record<string, { p: number; txt: string }>, score: score ?? 0 },
    date: today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), year0: today.getFullYear(),
  };
}
export type DashReport = Exclude<ReturnType<typeof dashReport>, { missing: string }>;
