/* The Calculator's scenarios: the things you see coming, each a sentence
   on the Calculator and a change to the plan's saving year by year
   underneath (cover.ts yearlySaving), or to the return the Calculator's
   stages earn (calc.ts stagesFor). Children are a scenario too, but their
   facts stay in Profile: here they're only switched off, which runs the
   plan without them. Everything is in today's dollars. No React. */

import { parseNum } from "@/lib/format";
import { COVER_ORDER, type CoverLine } from "@/tools/plan/model";
import type { Monthly } from "@/tools/plan/kids";

export type ScenarioKind = "children" | "saving" | "returns" | "lump";
/** Which account a change goes into or comes out of: one, or the
    dashboard's order (brokerage first). */
export type ScenarioAcct = "auto" | CoverLine;
/** How a saving change is sized: dollars a month, a share of what's saved
    then, or a share more (or less) each year, compounding. */
export type ScenarioMode = "amount" | "pct" | "pctYearly";

export interface Scenario {
  id: string;
  kind: ScenarioKind;
  name: string;
  on: boolean;
  /** Your age when it starts (a lump sum: the age it arrives). */
  from: number;
  /** Your age when it ends; 0 means retirement. */
  until: number;
  mode: ScenarioMode;
  /** Saving: dollars a month or percent, less when negative. A lump sum:
      dollars, taken out when negative. */
  amount: number;
  /** Years it's phased in over (a return: years it climbs over); 0 at once. */
  ramp: number;
  acct: ScenarioAcct;
  /** A return before inflation (0.09 is 9%), for a returns scenario. */
  nominal: number;
}

export const SCENARIO_KINDS: Record<ScenarioKind, string> = { children: "Children", saving: "Saving", returns: "Returns", lump: "Lump sum" };
export const ACCT_NAMES: Record<CoverLine, string> = { trad: "Traditional", roth: "Roth", brok: "Brokerage", hsa: "HSA" };
/** The account in a sentence: "brokerage", but "Roth" and "HSA". */
export const acctWord = (k: CoverLine) => (k === "roth" || k === "hsa" ? ACCT_NAMES[k] : ACCT_NAMES[k].toLowerCase());

/** The children's own row: one per profile, always first. */
export const CHILDREN_ID = "children";

const blank = (id: string, kind: ScenarioKind): Scenario => ({ id, kind, name: "", on: true, from: 0, until: 0, mode: "amount", amount: 0, ramp: 0, acct: "auto", nominal: 0 });

/** A new scenario of a kind, with the kind's usual figures; `from` is your age now. */
export function newScenario(id: string, kind: ScenarioKind, age: number, nominal: number): Scenario {
  const s = blank(id, kind);
  s.from = Math.min(99, age + 5);
  if (kind === "saving") Object.assign(s, { name: "A raise", amount: 500 });
  if (kind === "lump") Object.assign(s, { name: "An inheritance", amount: 50000, acct: "brok" });
  if (kind === "returns") Object.assign(s, { name: "Different returns", nominal: Math.round((nominal + 0.015) * 1000) / 1000, ramp: 0 });
  if (kind === "children") Object.assign(s, { id: CHILDREN_ID, name: "Children" });
  return s;
}

/** Saved scenarios, keeping only sound ones. */
export function readScenarios(v: unknown): Scenario[] {
  if (!Array.isArray(v)) return [];
  const out: Scenario[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const kind = o.kind;
    if (kind !== "children" && kind !== "saving" && kind !== "returns" && kind !== "lump") continue;
    const num = (k: string, d: number) => (typeof o[k] === "number" && isFinite(o[k] as number) ? (o[k] as number) : d);
    const s = blank(typeof o.id === "string" && o.id ? o.id : "s" + out.length, kind);
    s.name = typeof o.name === "string" ? o.name : "";
    s.on = o.on !== false;
    s.from = num("from", 0); s.until = num("until", 0); s.amount = num("amount", 0); s.ramp = Math.max(0, num("ramp", 0)); s.nominal = num("nominal", 0);
    s.mode = o.mode === "pct" || o.mode === "pctYearly" ? o.mode : "amount";
    s.acct = (COVER_ORDER as readonly string[]).includes(String(o.acct)) ? (o.acct as CoverLine) : "auto";
    if (kind === "children") s.id = CHILDREN_ID;
    if (out.some((y) => y.id === s.id)) continue;
    out.push(s);
  }
  return out;
}

/** The children switched off: the plan runs without them. */
export const kidsOff = (list: Scenario[] | undefined) => !!list?.some((s) => s.kind === "children" && !s.on);
/** The scenarios on, other than the children (they're in the plan itself). */
export const liveScenarios = (list: Scenario[] | undefined) => (list ?? []).filter((s) => s.on && s.kind !== "children");
/** Whether a returns scenario is on: the Calculator then sets the return
    year by year, and its result is the plan's savings at retirement. */
export const returnsOn = (list: Scenario[] | undefined) => liveScenarios(list).some((s) => s.kind === "returns");
/** The scenarios only the Calculator's stages can run: a different return,
    and a lump sum (a one-off amount on the first day of an age, which the
    plan's own saving year by year can't hold). With one on, the
    Calculator's result is the plan's savings at retirement. */
export const ownOn = (list: Scenario[] | undefined) => liveScenarios(list).some((s) => s.kind === "returns" || s.kind === "lump");
/** The profile's scenarios without the Calculator's own kinds. */
export const withoutOwn = (list: Scenario[] | undefined) => (list ?? []).filter((s) => s.kind !== "returns" && s.kind !== "lump");
/** The lump sums on, in order. */
export const lumpsOn = (list: Scenario[] | undefined) => liveScenarios(list).filter((s) => s.kind === "lump");
/** A lump's account as the Stages model names it. */
export const lumpAccount = (s: Scenario): "t" | "r" | "b" | "h" => (s.acct === "trad" ? "t" : s.acct === "roth" ? "r" : s.acct === "hsa" ? "h" : "b");

/** Your ages a scenario runs over: from, and up to (not including). */
export function spanOf(s: Scenario, end: number): [number, number] {
  if (s.kind === "lump") return [s.from, s.from + 1];
  return [s.from, s.kind === "returns" || !(s.until > s.from) ? end : Math.min(end, s.until)];
}
const runs = (s: Scenario, t: number, end: number) => { const [a, b] = spanOf(s, end); return t >= a && t < b; };

/** A change that stops saving outright (100% less, fully phased in by its k-th year). */
const stops = (s: Scenario, k: number) => s.mode === "pct" && s.amount <= -100 && phased(s.ramp, k) >= 1;
/** The share of a change in by its k-th year (k from 0), phased in over `ramp` years. */
const phased = (ramp: number, k: number) => (ramp > 0 ? Math.min(1, (k + 1) / ramp) : 1);

export interface YearChange {
  /** Dollars a month taken out of saving (the children's cover takes it), and
      the accounts named for it, as "How will you cover it?" types them. */
  cut: number; typed: Partial<Monthly>;
  /** Dollars a month added, by account. */
  add: Monthly;
  /** The scenarios at work this year. */
  tags: string[];
}

/** What the saving scenarios do in the year you're `t`, on saving of
    `own` a month then (your own, before the children's costs). Later
    scenarios build on earlier ones: a share works on the saving as the
    ones before it leave it. Lump sums aren't here: they're one-offs on
    the Calculator's stages (calc.ts). */
export function yearChange(list: Scenario[], t: number, end: number, own: number): YearChange {
  const out: YearChange = { cut: 0, typed: {}, add: { brok: 0, roth: 0, trad: 0, hsa: 0 }, tags: [] };
  let running = own, stopped: string | null = null;
  for (const s of liveScenarios(list)) {
    if (s.kind !== "saving" || !runs(s, t, end)) continue;
    const k = t - s.from;
    if (stops(s, k)) { stopped = s.id; continue; }
    let d = 0;
    if (s.mode === "amount") d = s.amount * phased(s.ramp, k);
    else if (s.mode === "pct") d = (running * s.amount / 100) * phased(s.ramp, k);
    else d = running * (Math.pow(1 + s.amount / 100, k + 1) - 1);
    d = Math.round(d);
    if (d === 0) continue;
    out.tags.push(s.id);
    running += d;
    if (d > 0) { out.add[s.acct === "auto" ? "brok" : s.acct] += d; continue; }
    out.cut += -d;
    if (s.acct !== "auto") out.typed[s.acct] = (out.typed[s.acct] ?? 0) + -d;
  }
  // Saving stopped: nothing goes in, whatever the other changes add.
  if (stopped) return { cut: own, typed: {}, add: { brok: 0, roth: 0, trad: 0, hsa: 0 }, tags: [...out.tags, stopped] };
  return out;
}

/** The return before inflation in the year you're `t`: the plan's, or what
    a returns scenario makes it (stepped, or climbing over its years). */
export function nominalAt(list: Scenario[], t: number, base: number): { nominal: number; tags: string[] } {
  let nominal = base;
  const tags: string[] = [];
  for (const s of liveScenarios(list)) {
    if (s.kind !== "returns" || t < s.from) continue;
    nominal = nominal + (s.nominal - nominal) * phased(s.ramp, t - s.from);
    tags.push(s.id);
  }
  return { nominal, tags };
}

/* ---------- words ---------- */

const pctText = (v: number) => String(Math.round(Math.abs(v) * 100) / 100) + "%";
const moneyText = (v: number) => "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
export const pctOf = (r: number) => (r * 100).toFixed(2).replace(/\.?0+$/, "") + "%";

/** A scenario as one sentence, in today's dollars. `years`: the plan
    counts years from now, not ages ("from year 5", "at the start of year
    5"), and `pot`: there's one pot, no accounts to name. */
export function scenarioSentence(s: Scenario, end: number, baseNominal: number, opts: { years?: boolean; pot?: boolean } = {}): string {
  if (s.kind === "children") return "";
  const Y = !!opts.years, at = (n: number) => (Y ? (n === 0 ? "now" : `year ${n}`) : String(n));
  if (s.kind === "returns") {
    const how = s.ramp > 0 ? `climb from ${pctOf(baseNominal)} to ${pctOf(s.nominal)} over ${s.ramp} ${s.ramp === 1 ? "year" : "years"}` : `change to ${pctOf(s.nominal)}`;
    return `Returns ${how} from ${at(s.from)}, before inflation.`;
  }
  if (s.kind === "lump") {
    const where = opts.pot ? "your savings" : s.acct === "auto" ? "brokerage" : acctWord(s.acct);
    const day = Y ? (s.from === 0 ? "today" : `at the start of year ${s.from}`) : `on the day you turn ${s.from}`;
    return s.amount < 0 ? `${moneyText(s.amount)} taken out of ${where} ${day}.` : `${moneyText(s.amount)} put into ${where} ${day}.`;
  }
  const [, to] = spanOf(s, end);
  const until = to >= end ? "to retirement" : `until ${at(to)}`;
  const less = s.amount < 0;
  const where = opts.pot ? "" : ", " + (less ? (s.acct === "auto" ? "out of brokerage first" : `out of ${acctWord(s.acct)} first`) : (s.acct === "auto" ? "into brokerage" : `into ${acctWord(s.acct)}`));
  if (s.mode === "pct" && s.amount <= -100) return `Stop saving from ${at(s.from)} ${until}: nothing more goes in${opts.pot ? "" : ", the employer match included"}.`;
  if (s.mode === "pctYearly") return `Save ${pctText(s.amount)} ${less ? "less" : "more"} each year from ${at(s.from)} ${until}, compounding (${pctText(s.amount)} ${less ? "less" : "more"} than the year before, every year)${where}.`;
  const amt = s.mode === "amount" ? `${moneyText(s.amount)} per month` : `${pctText(s.amount)} of what you'd save then`;
  const how = s.ramp > 0 ? `, phased in over ${s.ramp} ${s.ramp === 1 ? "year" : "years"}` : "";
  return `Save ${amt} ${less ? "less" : "more"} from ${at(s.from)} ${until}${how}${where}.`;
}

/** The kind's usual name when the typed one is blank. */
export const scenarioName = (s: Scenario) => s.name.trim() || (s.kind === "children" ? "Children" : s.kind === "returns" ? "Different returns" : s.kind === "lump" ? (s.amount < 0 ? "A big expense" : "A windfall") : s.amount < 0 ? "Saving less" : "Saving more");

/** A field's text as a number, or null when blank or not one. */
export const numOrNull = (v: string) => (v.trim() === "" || !isFinite(parseNum(v)) ? null : parseNum(v));
