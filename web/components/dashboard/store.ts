"use client";

/* What the Dashboard keeps: the profile (setup's answers and everything the
   sections add), and dated entries of what the household has and owes.
   Stored under retcalc.dashboard.v1 and synced to the account
   (lib/storage.ts), separate from Your household, the Guide and the tools. */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/lib/storage";
import { SYNCED_EVENT } from "@/lib/sync/engine";
import type { ToolInputs } from "@/components/tools/ToolState";

export type Per = "week" | "2weeks" | "twice" | "month" | "year";
export const PER_LABEL: Record<Per, string> = { week: "per week", "2weeks": "every two weeks", twice: "twice a month", month: "per month", year: "per year" };
export const PER_YEAR: Record<Per, number> = { week: 52, "2weeks": 26, twice: 24, month: 12, year: 1 };

/** Where taxes are figured: a state's two letters, or outside the US. */
export const OUTSIDE_US = "nonus";

export interface Person {
  name: string;
  /** Birth month (1 to 12) and year: ages stay right as the years pass. */
  bm: number | null; by: number | null;
  retire: number | null;
  pay: number | null; per: Per; taxed: "before" | "after";
}
export interface Kid { name: string; bm: number | null; by: number | null }
/** Money coming in besides pay: side work, rent from a property. After
    taxes, per month. */
export interface OtherIncome { id: string; name: string; amount: number | null }
/** A line of the budget, per month. */
export interface BudgetLine { id: string; name: string; amount: number | null }

export interface Assumptions {
  /** Growth per year before retirement, before inflation (0.076 is 7.6%). */
  growth: number;
  /** Prices rising per year. Growth less inflation is what savings gain. */
  inflation: number;
  /** Share in stocks once retired, 0 to 100. */
  stocks: number;
}
export const DEFAULT_ASSUMPTIONS: Assumptions = { growth: 1.045 * 1.03 - 1, inflation: 0.03, stocks: 60 };

/** A child's college as applied from College Savings: the age it starts,
    years of it, and what you'll pay a year (today's dollars). */
export interface CollegeKid { start: number; years: number; cost: number }
/** College Savings' figures, applied: each child's (in collegeChildren's
    order), what's saved for it, its return and tuition's inflation (percent). */
export interface CollegePlan { kids: CollegeKid[]; saved: number; ret: number; infl: number }

export interface Profile {
  who: "single" | "couple" | null;
  kids: number;
  p1: Person; p2: Person;
  kidList: Kid[];
  /** A state's two letters, OUTSIDE_US, or not given. */
  state: string | null;
  /** Setup's one number until accounts are added; counted as a 401(k). */
  saved: number | null;
  contrib: number | null; cper: "month" | "2weeks" | "year";
  /** What employers add, per month, and whether it's the whole match. */
  employer: number | null; match: "full" | "partial" | "none" | null;
  other: OtherIncome[];
  /** Per month: setup's one number, or the budget's total when it's used. */
  spend: number | null;
  budget: BudgetLine[]; useBudget: boolean;
  /** Per month once retired; null means the same as today. */
  retSpend: number | null;
  home: "own" | "rent" | null;
  /** Setup's home answers, until accounts hold the home and the mortgage. */
  value: number | null; owed: number | null; rent: number | null;
  /** The mortgage: rate (0.065 is 6.5%) and payment per month. */
  mortRate: number | null; mortPay: number | null;
  assume: Assumptions;
  /** Social Security: checked by the person, each benefit at full
      retirement age per month from a statement (null: estimated), and the
      age to claim (null: 67, or retirement if later). */
  ss: { checked: boolean; own1: number | null; own2: number | null; claim: number | null; claim2: number | null };
  /** The withdrawal strategy chosen (the Drawdown Simulator's ids); null: none yet. */
  strategy: string | null;
  /** The Drawdown Simulator's own figures, set on Retirement in place of
      the plan's (the starting rate, balance, years, Social Security): kept
      as typed until "Use the plan's figures". A starting rate here decides
      what the plan spends once retired; retSpend is then the goal. */
  ddOwn?: Record<string, string>;
  /** The Calculator's historical mode mix while saving, in percent: US
      stocks, small-cap value and cash (bonds the rest), and where the
      stocks' total glides to in the last stage. Unset until changed there. */
  calcMix?: { stock: string; sv: string; cash: string; end: string };
  /** Everything else changed in the Calculator (fees, returns, stages,
      settings), by its Stages input: kept in place of the plan's figures.
      When its result differs from the plan's own, that result is the
      plan's savings at retirement (calc.ts, calcFvOf). Unset: the plan's. */
  calcOwn?: Record<string, unknown>;
  /** The tools behind the tabs, as their own inputs: budget (pay, the
      budget and the saving sliders), tax, social (pay history), drawdown. */
  tools: { budget?: ToolInputs; tax?: ToolInputs; social?: ToolInputs; drawdown?: ToolInputs };
  /** How much saving rose each year (one rate for everything); replaced by
      `growth`, read only to carry an older profile over. */
  raise: number;
  /** How each saving line grows each year beyond inflation (0.02 is 2%),
      by the Paycheck tab's lines; each stops at its limit. */
  growth: Partial<Record<"match" | "hsa" | "rothIra" | "k401max" | "brok", number>>;
  /** Children planned: how many, years until the first, and years apart. */
  /** Children planned: how many, years until the first and between them.
      `bornAge` is your age at the first one's birth, kept so "the first in"
      counts down as the years pass instead of always being the same. */
  planned: { count: number; firstIn: number; spacing: number; bornAge?: number };
  /** Paid childcare before school, and where (it sets the cost). */
  childcare: boolean; careArea: "city" | "suburb" | "rural";
  /** Helping with college: how much, and the kind of school (its yearly
      cost); `plan` once College Savings' figures are applied (they replace
      the kind of school and how much, until one of those is picked again). */
  college: { help: "none" | "part" | "all"; cost: number; plan?: CollegePlan };
  /** Children's costs per month when they aren't the typical ones ("" for
      typical): birth to 5, 6 to 12, 13 to 18; and a later child's share of
      the first's, in percent. */
  childCosts: { early: string; school: string; teen: string; later: string };
  /** In the Calculator, which accounts give up saving for each stage's
      children's costs ("How will you cover it?"), by stage. */
  kidCover: Record<string, Record<string, number>>;
}

export type AssetKind = "workplace" | "ira" | "roth" | "brokerage" | "hsa" | "cash" | "home" | "other";
export type DebtKind = "mortgage" | "car" | "student" | "card" | "loan";
export interface Item {
  id: string; side: "asset" | "debt"; kind: AssetKind | DebtKind; name: string; value: number;
  /** A debt's interest rate (0.069 is 6.9%). */
  rate?: number | null;
}
/** What the household had and owed on a day (YYYY-MM-DD). One a day:
    saving again the same day replaces it. */
export interface Entry { date: string; items: Item[]; from: "setup" | "accounts" }

export interface DashData {
  profile: Profile;
  entries: Entry[];
  /** Setup: the step reached, the steps skipped, and whether it's finished. */
  step: number; skipped: string[]; done: boolean;
}

const KEY = "dashboard", VERSION = 1;

const person = (): Person => ({ name: "", bm: null, by: null, retire: null, pay: null, per: "year", taxed: "before" });
export const EMPTY_PROFILE: Profile = {
  who: null, kids: 0, p1: person(), p2: person(), kidList: [], state: null,
  saved: null, contrib: null, cper: "month", employer: null, match: null, other: [],
  spend: null, budget: [], useBudget: false, retSpend: null,
  home: null, value: null, owed: null, rent: null, mortRate: null, mortPay: null,
  assume: DEFAULT_ASSUMPTIONS,
  ss: { checked: false, own1: null, own2: null, claim: null, claim2: null }, strategy: null,
  tools: {}, raise: 0, growth: {},
  planned: { count: 0, firstIn: 2, spacing: 3 }, childcare: true, careArea: "suburb",
  college: { help: "none", cost: 26000 },
  childCosts: { early: "", school: "", teen: "", later: "80" }, kidCover: {},
};
export const EMPTY: DashData = { profile: EMPTY_PROFILE, entries: [], step: 0, skipped: [], done: false };

let seq = 0;
export const newId = () => Date.now().toString(36) + (seq++).toString(36);

/* Entries saved before accounts existed held three numbers. */
type OldEntry = { date: string; saved: number; value: number; owed: number };
function upgrade(e: Entry | OldEntry): Entry {
  if ("items" in e) return e;
  const items: Item[] = [{ id: "saved", side: "asset", kind: "workplace", name: "Savings, all together", value: e.saved }];
  if (e.value) items.push({ id: "home", side: "asset", kind: "home", name: "Home", value: e.value });
  if (e.owed) items.push({ id: "mortgage", side: "debt", kind: "mortgage", name: "Mortgage", value: e.owed, rate: null });
  return { date: e.date, items, from: "setup" };
}

/** Age today in whole years (as model.ts's ageOf, which can't be imported here). */
function ageNow(p: Pick<Person, "bm" | "by">, d = new Date()): number | null {
  if (!p.by) return null;
  return Math.floor(((d.getFullYear() - p.by) * 12 + d.getMonth() + 1 - (p.bm || 1)) / 12);
}

/* One copy for every component on the page, kept in step with storage and
   with whatever the account sync brings in. */
let current: DashData | null = null;
const listeners = new Set<() => void>();
function load(): DashData {
  const v = readStored<DashData>(KEY, VERSION);
  if (!v) return EMPTY;
  const p = { ...EMPTY_PROFILE, ...v.profile };
  p.assume = { ...DEFAULT_ASSUMPTIONS, ...v.profile?.assume };
  p.ss = { ...EMPTY_PROFILE.ss, ...v.profile?.ss };
  p.tools = { ...v.profile?.tools };
  p.planned = { ...EMPTY_PROFILE.planned, ...v.profile?.planned };
  p.college = { ...EMPTY_PROFILE.college, ...v.profile?.college };
  p.childCosts = { ...EMPTY_PROFILE.childCosts, ...v.profile?.childCosts };
  // Years until the first planned child, from the age you'll be then.
  const age = ageNow(p.p1);
  if (p.planned.bornAge != null && age != null) p.planned = { ...p.planned, firstIn: Math.max(0, Math.round((p.planned.bornAge - age) * 2) / 2) };
  // One rate for all saving, from before each line had its own.
  if (!v.profile?.growth && v.profile?.raise) p.growth = { match: p.raise, hsa: p.raise, rothIra: p.raise, k401max: p.raise, brok: p.raise };
  return { ...EMPTY, ...v, profile: p, entries: (v.entries ?? []).map(upgrade) };
}
function get(): DashData {
  if (!current) current = load();
  return current;
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function save(next: DashData) {
  // The age at the first planned child's birth follows "the first in".
  const p = next.profile, age = ageNow(p.p1);
  if (p.planned.count > 0 && age != null && p.planned.bornAge !== age + p.planned.firstIn) next = { ...next, profile: { ...p, planned: { ...p.planned, bornAge: age + p.planned.firstIn } } };
  current = next;
  writeStored(KEY, VERSION, next);
  listeners.forEach((l) => l());
}

/** Today, as YYYY-MM-DD in the person's own time zone. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The entry setup's answers make: savings and the home, as of today. */
export function entryFrom(p: Profile, date = today()): Entry | null {
  if (p.saved == null && p.home !== "own") return null;
  return upgrade({ date, saved: p.saved ?? 0, value: p.home === "own" ? p.value ?? 0 : 0, owed: p.home === "own" ? p.owed ?? 0 : 0 });
}
/** Adds an entry, replacing one already saved for that day. */
export function withEntry(entries: Entry[], e: Entry): Entry[] {
  return [...entries.filter((x) => x.date !== e.date), e].sort((a, b) => a.date.localeCompare(b.date));
}
/** Today's entry with the home and mortgage set: a copy of the latest
    entry (or setup's), saved as today's, replacing one already saved today. */
export function withHome(d: DashData, v: { value?: number | null; owed?: number | null; rate?: number | null }): Entry[] {
  const last = d.entries[d.entries.length - 1] ?? entryFrom(d.profile);
  let items = (last?.items ?? []).map((i) => ({ ...i }));
  const put = (side: Item["side"], kind: AssetKind | DebtKind, name: string, patch: Partial<Item>) => {
    const i = items.findIndex((x) => x.side === side && x.kind === kind);
    if (i >= 0) items[i] = { ...items[i], ...patch };
    else items = [...items, { id: newId(), side, kind, name, value: 0, ...(side === "debt" ? { rate: null } : {}), ...patch }];
  };
  if (v.value !== undefined) put("asset", "home", "Home", { value: v.value ?? 0 });
  if (v.owed !== undefined) put("debt", "mortgage", "Mortgage", { value: v.owed ?? 0 });
  if (v.rate !== undefined) put("debt", "mortgage", "Mortgage", { rate: v.rate });
  return withEntry(d.entries, { date: today(), items: items.filter((i) => i.value > 0 || i.kind === "home"), from: last?.from ?? "setup" });
}

export const sum = (items: Item[], side: Item["side"], kinds?: string[]) =>
  items.filter((i) => i.side === side && (!kinds || kinds.includes(i.kind))).reduce((s, i) => s + (i.value || 0), 0);
export const netWorth = (e: Entry) => sum(e.items, "asset") - sum(e.items, "debt");
/** Whether the household has given its accounts, not just setup's one number. */
export const hasAccounts = (entries: Entry[]) => entries.some((e) => e.from === "accounts");

/** What's stored right now, read straight from this browser (not the
    first render's empty copy). */
export const readDashboard = () => get();
/** Nothing answered yet: setup hasn't been started. */
export const unstarted = (d: DashData) => !d.done && d.step === 0 && d.profile.who == null;

export function useDashboard() {
  const data = useSyncExternalStore(subscribe, get, () => EMPTY);
  // Items arriving from the account replace what's shown.
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string[]>).detail?.includes(KEY)) { current = load(); listeners.forEach((l) => l()); }
    };
    window.addEventListener(SYNCED_EVENT, on);
    return () => window.removeEventListener(SYNCED_EVENT, on);
  }, []);
  const update = useCallback((f: (d: DashData) => DashData) => save(f(get())), []);
  const setProfile = useCallback((f: (p: Profile) => Profile) => save({ ...get(), profile: f(get().profile) }), []);
  return { data, update, setProfile };
}
