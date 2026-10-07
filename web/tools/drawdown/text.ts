/* What the Drawdown Simulator says: each strategy's names and blurb, and the
   sentences and labels built from a plan and its results. Several come back
   as HTML (a figure in bold, a warning colored), as the old page wrote them;
   anything a person typed is escaped first. From src/js/app/15-drawdown.js,
   15b-drawdown-views.js, 15c-drawdown-strategies.js and 15d-drawdown-history.js. */
import { MON } from "@/components/charts/HistNotes";
import {
  CAPE_NOW, CAPE_NOW_ASOF, DD_STRAT, HIST_M_CAPE, HIST_START, HIST_STOCK, ddComfort, ddEraFor, ddMCHistory, ddPrep, ddRmdDivisor,
  ddWindows, ddWithDial, runDrawdown, type DdHist, type DdHistRun, type DdOpts, type DdPrep, type DdRun, type DdTarget, type DdWindow,
} from "@/lib/engine/typed-drawdown";
import { fmtNum, money, pctStr } from "@/lib/format";
import { firstSpend, type DdItem, type PathStage } from "./model";

/** A legend entry: a colored dot and its label, as HTML. */
export const swatch = (c: string, t: string) => `<span><i style='background:${c}'></i>${t}</span>`;

export const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/* ---- the strategies, as the page names them ---- */
export const DD_FAMILY: Record<string, string> = { steady: "Steady income", share: "Share of the portfolio", guard: "Guardrails", smooth: "Smoothed", value: "Valuation" };
interface UI { name: string; short: string; card?: string; dial?: string; rate?: string; blocks: string[]; blurb: string }
export const DD_UI: Record<string, UI> = {
  fixed: { name: "Fixed amount, rising with inflation", short: "Fixed", card: "Fixed amount", dial: "rate", rate: "Starting withdrawal rate", blocks: ["ddSkipWrap"],
    blurb: "The 4% rule's way: year one's amount, then the same plus inflation, whatever markets do." },
  kitces: { name: "Kitces ratchet", short: "Ratchet", dial: "rate", rate: "Starting withdrawal rate", blocks: ["ddKitWrap", "ddSkipWrap"],
    blurb: "Fixed spending that never falls, stepped up after strong markets." },
  pct: { name: "Fixed % of portfolio each year", short: "Fixed %", card: "% of portfolio", dial: "rate", rate: "Percentage taken each year", blocks: [],
    blurb: "The same share of the portfolio every year: it can't run out, but spending swings with markets." },
  clyatt: { name: "95% rule", short: "95% rule", dial: "rate", rate: "Percentage taken each year", blocks: ["ddClyWrap"],
    blurb: "A share of the portfolio, but never under 95% of last year's spending." },
  oneovern: { name: "1/N: the balance over the years left", short: "1/N", card: "1/N", blocks: [],
    blurb: "The balance divided by the years left, so it spends everything by the end." },
  rmd: { name: "RMD method", short: "RMD method", blocks: [],
    blurb: "The balance divided by the IRS life-expectancy divisor for your age, as required distributions work." },
  vpw: { name: "Variable percentage withdrawal (VPW)", short: "VPW", card: "Variable percentage (VPW)", dial: "vpwRate", blocks: ["ddVpwWrap", "ddVpwNote"],
    blurb: "The Bogleheads method: an annuity-style payment on what's left, worked out again each year." },
  guardrails: { name: "Guyton-Klinger Guardrails", short: "Guardrails", dial: "rate", rate: "Starting withdrawal rate", blocks: ["ddGuardWrap", "ddGuardExample", "ddSkipWrap"],
    blurb: "Steady spending with a cut or a raise when the withdrawal rate drifts too far." },
  riskgr: { name: "Risk-based guardrails", short: "Risk-based", dial: "rgTarget", blocks: ["ddRgWrap"],
    blurb: "Holds spending until history's odds of it lasting leave a band, then resets to the target." },
  floorceil: { name: "Floor & ceiling", short: "Floor & ceiling", dial: "rate", rate: "Target withdrawal rate", blocks: ["ddFloorWrap"],
    blurb: "Aims at a share of the portfolio, but moves spending at most a set step a year." },
  vanguard: { name: "Vanguard dynamic spending", short: "Vanguard", dial: "rate", rate: "Target withdrawal rate", blocks: ["ddVgWrap"],
    blurb: "Floor and ceiling with Vanguard's limits: up 5% or down 2.5% at most a year." },
  yale: { name: "Yale Endowment", short: "Yale", dial: "yaleRate", rate: "Starting withdrawal rate", blocks: ["ddYaleWrap", "ddYaleNote"],
    blurb: "Mostly last year's spending, partly a share of today's portfolio." },
  hebeler: { name: "Hebeler Autopilot II", short: "Autopilot II", dial: "hebRate", blocks: ["ddHebWrap"],
    blurb: "Mostly last year's spending, partly an annuity-style payment on what's left." },
  sensible: { name: "Sensible withdrawals", short: "Sensible", dial: "rate", rate: "Base withdrawal rate", blocks: ["ddSensWrap"],
    blurb: "A steady base, plus a share of each year's real gains." },
  cape: { name: "CAPE-based", short: "CAPE", dial: "capeA", blocks: ["ddCapeWrap"],
    blurb: "A base rate plus a share of the market's earnings yield: more when stocks are cheap, less when they're dear." },
};
/** Display names, for compare and the summary. */
export const DD_STRAT_NAMES: Record<string, string> = Object.fromEntries(Object.entries(DD_UI).map(([k, u]) => [k, u.card || u.name]));

/* ---- small words ---- */
/** A setting as words would write it: 0.5, 33.7, 2.25, 90, no padding. */
export const ddN = (v: number) => String(+(Math.round(v * 100) / 100));
export const pct1 = (x: number) => (x < 0 ? "−" : "") + pctStr(Math.abs(x), 1);

/** The year of retirement as an age, once one is set. */
export const ageVal = (age: number | null, year: number) => (age != null ? age + year - 1 : year);

/** When a retirement began: the year, or with a start every month, the month too. */
export function startLabel(r: { startYear: number; startMonth?: number | null }, monthly: boolean): string {
  if (r.startMonth == null) return String(r.startYear);
  return monthly || r.startMonth !== 1 ? MON[r.startMonth - 1] + " " + r.startYear : String(r.startYear);
}
export function outcomeText(r: DdRun, age: number | null): string {
  if (!r.depleted) return "Survived";
  return age != null ? "Ran out at age " + ageVal(age, r.depletedYear!) : "Ran out in year " + r.depletedYear;
}
export const rateClass = (r: number) => (r >= 0.95 ? "pos" : r >= 0.85 ? "mid" : "neg");
/** The same rating as a tone, for its glyph (check, warning circle, x). */
export const rateTone = (r: number) => (r >= 0.95 ? "gain" : r >= 0.85 ? "text" : "loss") as "gain" | "text" | "loss";

/** The setting a search found, in words. */
export function dialText(id: string, v: number | null, o?: DdOpts): string {
  if (v == null) return "—";
  const D = DD_STRAT[id]?.dial;
  if (!D) return "";
  if (D.key === "vpwRate" || D.key === "hebRate") return pctStr(v / 100, 2) + " real return";
  if (D.key === "rgTarget") return ddN(Math.round(v * 10) / 10) + "% chance";
  if (D.key === "capeA") return pctStr(v / 100, 2) + " + " + ddN(o && o.capeB != null ? o.capeB : 0.5) + " × 1/CAPE";
  if (D.key === "yaleRate") return pctStr(v / 100, 2) + " target";
  return pctStr(v / 100, 2) + " start";
}

/* ---- the mix ---- */
export const DD_ASSETS: [key: "stock" | "sv" | "bond" | "cash", id: string | null, name: string, desc: string][] = [
  ["stock", "ddStock", "US stocks", "The S&P 500, dividends reinvested"],
  ["sv", "ddSV", "Small-cap value", "Small companies priced low against their book value (Fama-French)"],
  ["bond", null, "Bonds", "10-year US Treasuries"],
  ["cash", "ddCash", "Cash", "One-month Treasury bills"],
];
export function mixParts(o: DdOpts) {
  return { stock: o.stockPct, sv: o.svPct, bond: Math.max(0, 100 - o.stockPct - o.svPct - o.cashPct), cash: o.cashPct };
}
export function mixText(o: DdOpts): string {
  const m = mixParts(o), names = { stock: "US stocks", sv: "small value", bond: "bonds", cash: "cash" };
  let t = DD_ASSETS.map(([k]) => (m[k] > 0 ? ddN(m[k]) + "% " + names[k] : "")).filter(Boolean).join(", ");
  if (o.stockPctEnd != null) t += ", gliding to " + ddN(o.stockPctEnd) + "% stocks";
  if (o.gShare > 0) return ddN(o.gShare) + "% buys " + (o.gType === "annuity" ? "an annuity" : "a TIPS ladder") + " · the rest: " + (t || "nothing invested");
  return t || "Nothing invested";
}
/** How often the mix is put back, as a short phrase. */
export function rebalText(o: { rebal: string; rebalN: number; rebalBand: number }): string {
  return o.rebal === "every" ? "Every " + o.rebalN + " years" : o.rebal === "band" ? "When off by more than " + ddN(o.rebalBand) + " points"
    : o.rebal === "never" ? "Never" : "Every year";
}
export function rebalNote(o: DdOpts): string {
  const one = [o.stockPct, o.svPct, mixParts(o).bond, o.cashPct].filter((v) => v > 0).length < 2;
  return one ? "With one asset there's nothing to rebalance."
    : o.rebal === "never" ? "The mix drifts with markets: stocks tend to grow into a bigger share." + (o.stockPctEnd != null ? " The glide has no effect without rebalancing." : "")
      : o.rebal === "every" ? "Between rebalances the mix drifts with markets." + (o.stockPctEnd != null ? " The glide takes effect at each rebalance." : "")
        : o.rebal === "band" ? "Checked each year, after the year's withdrawal." : "";
}

/* ---- spending ---- */
/** Year one's spending: in model.ts, beside the setup that uses it. */
export { firstSpend };
export function rateOf(o: DdOpts, P?: DdPrep): number {
  const p = P || ddPrep(o);
  return p.initial > 0 ? firstSpend(o, p) / p.initial : 0;
}
/** A line in words: one amount, or where a schedule starts and ends up. */
export function lineWords(c: number | number[], age: number | null, unit = ""): string {
  if (!Array.isArray(c)) return money(c || 0) + unit;
  const a = c[0], z = c[c.length - 1];
  let i = 1, j: number;
  for (; i < c.length && Math.abs(c[i] - a) < 0.5; i++);
  if (i >= c.length) return money(a) + unit;
  for (j = i; j < c.length && Math.abs(c[j] - z) >= 0.5; j++);
  const at = (k: number) => (age != null ? "age " + ddN(ageVal(age, k + 1)) : "year " + (k + 1));
  return money(a) + unit + (j > i ? ", easing to " + money(z) + unit + " by " + at(j) : ", then " + money(z) + unit + " from " + at(i)) +
    (c.slice(j).some((v) => Math.abs(v - z) >= 0.5) ? " and changing again" : "");
}
/** A plan in a line: strategy, its setting, the mix and the years. */
export function planLabel(o: DdOpts): string {
  const u = DD_UI[o.strategy] || ({} as UI), D = DD_STRAT[o.strategy]?.dial;
  return (u.card || u.name || o.strategy) + (D ? ", " + dialText(o.strategy, o[D.key] as number, o) : "") + ", " +
    mixText(o) + ", " + fmtNum(o.years) + " years" + (o.monthly ? ", every month" : "");
}

/** The hard start a strategy is shown through: 1966 when the record has it
    for this length of retirement, or else the start that ended worst. */
export function hardStart(o: DdOpts): DdWindow | null {
  const W = ddWindows(o);
  for (const w of W) if (w.year === 1966 && w.month === 1) return w;
  if (!W.length) return null;
  let worst: { w: DdWindow; end: number } | null = null;
  const P = ddPrep(o);
  for (const w of W) {
    const r = runDrawdown(o, w.seq, { lite: true }, P);
    if (!worst || r.endReal < worst.end) worst = { w, end: r.endReal };
  }
  return worst!.w;
}
/** Each year's spending through one start, in today's dollars. */
export const spendThrough = (o: DdOpts, w: DdWindow, P?: DdPrep) => runDrawdown(o, w.seq, null, P || ddPrep(o)).rows.map((r) => r.realSpend);

/** A line on what the strategy does, for those whose fields don't say it. */
export function stratNote(o: DdOpts, firstW: number, r1: number): string {
  if (!(o.initial > 0)) return "";
  const yr1 = "<b>" + money(firstW) + "</b>", p = (v: number, d = 2) => pctStr(v / 100, d);
  switch (o.strategy) {
    case "kitces":
      return "Starts at " + yr1 + " and never falls. Whenever the portfolio is " + ddN(o.kitThresh) +
        "% above where it started, after inflation, spending rises " + ddN(o.kitRaise) + "%, at most once every " +
        ddN(o.kitGap) + (o.kitGap === 1 ? " year." : " years.");
    case "clyatt":
      return "Takes " + p(o.initialPct) + " of the portfolio each year, " + yr1 + " in year one, but never less than " +
        ddN(o.clyFloor) + "% of last year's spending in dollars, so a crash brings a run of small cuts rather than one big one.";
    case "oneovern":
      return "Year one takes 1/" + o.years + " of the portfolio, " + yr1 + ". The share rises every year, to all of what's left in the last.";
    case "rmd": {
      const age = o.retireAge != null ? o.retireAge : 65;
      return "Year one takes the portfolio ÷ " + ddN(Math.round(ddRmdDivisor(age) * 10) / 10) + ", " + yr1 + " (" + pctStr(r1, 2) + ")" +
        (o.retireAge == null ? ", taking 65 since no age is set above" : "") + ". The share rises with age: " +
        pctStr(1 / ddRmdDivisor(75), 1) + " at 75, " + pctStr(1 / ddRmdDivisor(85), 1) + " at 85.";
    }
    case "riskgr":
      return "Year one: " + yr1 + " (" + pctStr(r1, 2) + "), the spending with a " + ddN(o.rgTarget) + "% chance of lasting " +
        o.years + " years at your stock mix, by history, counting Social Security and other income still to come. It then holds, with inflation, " +
        "until that chance falls below " + ddN(o.rgLo) + "% or rises above " + ddN(o.rgHi) + "%, and resets to " + ddN(o.rgTarget) + "%.";
    case "vanguard":
      return "Aims at " + p(o.initialPct) + " of the current portfolio, " + yr1 + " in year one, but spending never rises more than " +
        ddN(o.vgCeil) + "% or falls more than " + ddN(o.vgFloor) + "% from last year's, after inflation.";
    case "floorceil":
      return "Aims at " + p(o.initialPct) + " of the current portfolio, but moves spending at most " + ddN(o.floorPct) +
        "% down or " + ddN(o.ceilPct) + "% up from last year's, after inflation.";
    case "hebeler":
      return "Year one takes the payment that would spend the portfolio over " + o.years + " years at " + p(o.hebRate) + " real, " +
        yr1 + " (" + pctStr(r1, 2) + "). After that, " + ddN(o.hebWeight) + "% of last year's spending with inflation, plus " +
        ddN(100 - o.hebWeight) + "% of that payment, worked out again on what's left.";
    case "sensible":
      return "Each year: " + yr1 + ", rising with inflation, plus " + ddN(o.sensExtra) + "% of last year's real investment gains whenever there were any.";
    case "cape": {
      const avg = HIST_M_CAPE.reduce((a, c) => a + c, 0) / HIST_M_CAPE.length;
      return "Takes " + p(o.capeA) + " plus " + ddN(o.capeB) + " × 1/CAPE of the portfolio each year. At today's CAPE, " +
        CAPE_NOW.toFixed(1) + " (" + CAPE_NOW_ASOF + "), that's " + pctStr(r1, 2) + ", " + yr1 + "; at the average since 1926, " +
        avg.toFixed(1) + ", it would be " + p(o.capeA + o.capeB * 100 / avg) + ".";
    }
  }
  return "";
}

/* ---- the risk target ---- */
export function target(d: Record<string, unknown>, comfort: number | number[]): DdTarget {
  return { crit: d.tCrit === "lasts" ? "lasts" : "comfort", conf: Math.min(100, Math.max(50, (d.tConf as number) || 100)) / 100, comfort };
}
export const critWords = (T: DdTarget, age: number | null) =>
  T.crit === "comfort" ? "spending never falls below " + lineWords(T.comfort, age, " a year") : "the money lasts the whole retirement";
export const targetWords = (T: DdTarget, age: number | null) =>
  critWords(T, age) + (Array.isArray(T.comfort) ? ", in " : " in ") + (T.conf >= 1 ? "every historical start" : pctStr(T.conf, 0) + " of historical starts");

/** A strategy's dial, turned, as saved fields, plus the minimum a comfort
    target holds a flexible strategy to. */
export function dialFields(o: DdOpts, id: string, v: number, T?: DdTarget): Record<string, unknown> {
  const x = ddWithDial({ ...o, strategy: id }, v), out: Record<string, unknown> = { strategy: id };
  const key = DD_STRAT[id].dial?.key, r2 = (n: number) => Math.round(n * 100) / 100;
  if (key === "initialPct") out.rate = r2(x.initialPct);
  if (key === "vpwRate") out.vpwRate = r2(x.vpwRate);
  if (key === "hebRate") out.hebRate = r2(x.hebRate);
  if (key === "capeA") out.capeA = r2(x.capeA);
  if (key === "yaleRate") Object.assign(out, { yaleRate: r2(x.yaleRate), rate: r2(x.initialPct) });
  if (key === "rgTarget") Object.assign(out, { rgTarget: r2(x.rgTarget), rgLo: r2(x.rgLo), rgHi: r2(x.rgHi) });
  if (T?.crit === "comfort" && !Array.isArray(T.comfort) && DD_STRAT[id].limits !== false) out.spendFloor = Math.round(Math.max(o.spendFloor || 0, T.comfort));
  return out;
}

/* ---- Monte Carlo ---- */
/** What the Monte Carlo runs draw, in words. */
export function mcWords(o: DdOpts): string {
  const span = (HIST_START + 1) + "–" + (HIST_START + HIST_STOCK.length - 1);
  let w = o.mcBlock > 1
    ? "Each run strings together " + o.years + " years from the " + span + " record, " + o.mcBlock +
      " consecutive years at a time, so the streaks history had, good and bad, stay together."
    : "Each run draws " + o.years + " years at random from the " + span + " record. This captures the range " +
      "of possible returns but not the way bad years clustered; drawing several years together, or the historical view, shows that.";
  if (o.mcOwn) {
    const H = ddMCHistory(), parts: string[] = [];
    const add = (k: keyof typeof H, name: string) => {
      if (Math.abs(o.mcRet[k] - H[k]) >= 0.05) parts.push(name + " " + ddN(o.mcRet[k]) + "% a year (history " + H[k].toFixed(1) + "%)");
    };
    add("stock", "US stocks");
    if (o.svPct > 0) add("sv", "small value");
    if (o.stockPct + o.svPct + o.cashPct < 100 || o.stockPctEnd != null) add("bond", "bonds");
    if (o.cashPct > 0) add("cash", "cash");
    add("infl", "inflation");
    w += parts.length ? " Each year is shifted so the long run compounds to your figures: " + parts.join(", ") + "."
      : " Your figures match history's, so each year runs as it happened.";
  }
  return w;
}

/* ---- history's lessons ---- */
/** What a run's dot measures: what's left, or for a strategy built to spend
    everything, its typical year's spending. */
export function seqMeasure(o: DdOpts) {
  return DD_STRAT[o.strategy].spendsDown
    ? { of: (r: DdHistRun) => r.medRealSpend, name: "typical year's spending", axis: "Typical year's spending" }
    : { of: (r: DdHistRun) => r.endReal, name: "what was left", axis: "Left at the end, today's $" };
}
/** Two starts that make the point: one that ran out though its whole
    retirement averaged more than one that lasted, or failing that, two that
    averaged about the same and ended furthest apart. */
export function seqPair(H: DdHist, M: ReturnType<typeof seqMeasure>) {
  const fails = H.runs.filter((r) => r.depleted), lasts = H.runs.filter((r) => !r.depleted);
  if (fails.length && lasts.length) {
    const f = fails.reduce((a, b) => (b.full.port > a.full.port ? b : a));
    const s = lasts.reduce((a, b) => (b.full.port < a.full.port ? b : a));
    if (s.full.port < f.full.port - 0.0005) return { kind: "beat" as const, a: f, b: s };
  }
  let best: { kind: "same"; a: DdHistRun; b: DdHistRun; g: number } | null = null;
  const runs = H.runs.length > 150 ? H.runs.filter((r) => r.startMonth === 1) : H.runs;
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    const a = runs[i], b = runs[j];
    if (Math.abs(a.full.port - b.full.port) > 0.0025) continue;
    const g = Math.abs(M.of(a) - M.of(b));
    if (!best || g > best.g) best = { kind: "same", a: M.of(a) < M.of(b) ? a : b, b: M.of(a) < M.of(b) ? b : a, g };
  }
  return best;
}
/** Why the start picked went as it did: its first years, what they left, and its era. */
export function whyText(o: DdOpts, r: DdHistRun, H: DdHist, age: number | null): string {
  const d = r.dec1, n = d.years;
  if (!n || !r.rows.length) return "";
  const ps = H.runs.map((x) => x.dec1.port).sort((a, b) => a - b);
  const med = ps[Math.floor(ps.length / 2)];
  const below = ps.filter((v) => v < d.port - 1e-12).length / ps.length;
  const ends = H.runs.map((x) => x.endReal).sort((a, b) => a - b);
  const endRank = ends.filter((v) => v < r.endReal - 1e-6).length / ends.length;
  const lead = r.depleted ? "Why it ran out" : endRank < 0.2 ? "Why it was hard" : endRank >= 0.8 ? "Why it went well" : "How it went";
  const start = r.rows[0].start, row = r.rows[n - 1], left = start > 0 ? row.realEnd / start : 0;
  const nx = r.rows[n];
  const rate = nx && row.realEnd > 0 ? nx.realWithdrawal / row.realEnd : null;
  const where = below < 0.1 ? "among the worst on record" : below < 0.33 ? "weaker than most" : below >= 0.9 ? "among the best on record" :
    below >= 0.67 ? "stronger than most" : "about typical";
  let txt = "<b>" + lead + ":</b> its first " + n + " years returned " + pct1(d.port) + " a year after inflation at your mix " +
    "(stocks " + pct1(d.stock) + ", bonds " + pct1(d.bond) + ", with inflation at " + pctStr(d.infl, 1) + " a year), " + where +
    "; the typical start's returned " + pct1(med) + ". ";
  if (n < o.years)
    txt += "Withdrawing through them left " + pctStr(left, 0) + " of the starting balance, after inflation" +
      (rate != null ? ", so year " + (n + 1) + "'s withdrawal was " + pctStr(rate, 1) + " of what was left" : "") + ". ";
  if (r.depleted) {
    const when = age != null ? "at age " + ageVal(age, r.depletedYear!) : "in year " + r.depletedYear;
    txt += below < 0.5 ? "Too little was left for the years after to rebuild: it ran out " + when + ". " : "The damage came later: it ran out " + when + ". ";
  }
  const era = ddEraFor(r.startYear);
  if (era) txt += "<i>" + era.title + ".</i> " + era.note;
  return "<span class='ddwhy'>" + txt + "</span>";
}

/** The comfort line's note, when it's left blank. */
export function comfortNote(o: DdOpts, P: DdPrep, age: number | null): string {
  const c = ddComfort(o, P);
  return o.comfort > 0 ? ""
    : (o.spendFloor > 0 || Array.isArray(c)) && DD_STRAT[o.strategy].limits !== false
      ? "Blank: your minimum spending, " + lineWords(c, age, " a year") + "."
      : "Blank: 80% of year one's spending, " + money(c as number) + " a year.";
}

/** Stages in the order they take effect, each with its working start year. */
export function wdOrder(list: PathStage[]) {
  return list.map((st, i) => ({ st, i, start: Math.max(2, Math.round(st.start || 0)) })).sort((a, b) => a.start - b.start || a.i - b.i);
}

/** A custom income or expense in a line. */
export function describeItem(it: DdItem, age: number | null): string {
  const when = it.startYear === 1 ? "starting immediately" : age != null ? "starting at age " + ageVal(age, it.startYear) : "starting year " + it.startYear;
  const dur = it.duration.type === "once" ? "one time" : it.duration.type === "years" ? "for " + it.duration.years + " years" : "rest of retirement";
  return money(it.annual) + "/yr, " + when + ", " + dur + " · " + (it.inflate ? "inflation-adjusted" : "fixed amount");
}
