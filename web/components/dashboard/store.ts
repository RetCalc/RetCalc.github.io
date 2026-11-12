"use client";

/* What the Dashboard keeps: the profile (setup's answers and everything the
   sections add), and dated entries of what the household has and owes.
   Stored under retcalc.dashboard.v1 and synced to the account
   (lib/storage.ts), separate from Your household, the Guide and the tools.
   A person can keep more than one profile (Profiles on the Profile tab):
   each added one is its own item, dashboard-p-<id>, listed with its name
   in dashboard-profiles (lib/sync/merge.ts). Which is open stays on this
   device; everything below reads and writes the open one. */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/lib/storage";
import { SYNCED_EVENT } from "@/lib/sync/engine";
import { MAIN_PROFILE, PROFILES_KEY, profileKey, readProfileList, type ProfileList, type ProfileRef } from "@/lib/sync/merge";
import type { ToolInputs } from "@/components/tools/ToolState";
import { readScenarios, type Scenario } from "./scenarios";
import { readRule } from "@/tools/plan/kidsRead";
import type { CoverRule } from "@/tools/plan/model";

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
  /** Paychecks per year ("52", "26", "24", "12") when the pay is given per year or per month; otherwise the "how often" says it. */
  paid?: string;
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
  /** Debts being paid off (Net worth's Plan payments; debts.ts): what's
      paid on each a month, and whether a paid-off debt's payment goes on to
      the next. Each is a line in the budget until it's paid off. */
  debtPlan?: DebtPlan;
  home: "own" | "rent" | null;
  /** Setup's home answers, until accounts hold the home and the mortgage. */
  value: number | null; owed: number | null; rent: number | null;
  /** The mortgage: rate (0.065 is 6.5%) and payment per month. */
  mortRate: number | null; mortPay: number | null;
  /** Owning's costs beyond the loan, per month in dollars, as set in the
      Mortgage Calculator on Home (home.ts): the budget's housing lines. */
  homeCosts?: { tax: number; ins: number; pmi: number; hoa: number; maint: number; util: number };
  /** Health cover on Retirement has been opened (Next steps' step done). */
  healthSeen?: boolean;
  /** Renting: renter's insurance per month, the budget's insurance line. */
  rentIns?: number | null;
  assume: Assumptions;
  /** Social Security: checked by the person, each benefit at full
      retirement age per month from a statement (null: estimated), and the
      age to claim (null: full retirement age to the nearest year, 67 for anyone
      born in 1960 or later, or retirement if later). */
  ss: { checked: boolean; own1: number | null; own2: number | null; claim: number | null; claim2: number | null;
    /** The share of the benefit expected, in percent (cuts if the trust
        fund runs short): every benefit in the plan is scaled by it. Unset: 100. */
    pct?: number | null };
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
  /** Retiring before 59½: the Early Retirement Bridge's choices once you've
      made it your plan (bridge.ts), and the day you did. Its figures always
      come from the plan. Unset: no bridge plan yet. */
  bridge?: { inputs: ToolInputs; at: string };
  /** The tools behind the tabs, as their own inputs: budget (pay, the
      budget and the saving sliders), tax (the deductions and local tax on
      Taxes & Savings), social (pay history), drawdown (the strategy, its
      settings and the mix once retired), healthcare (the benchmark premium),
      mortgage (owning's costs, extra payments and refinancing, on Home),
      rentbuy (renting or buying, tried on Home). */
  tools: { budget?: ToolInputs; tax?: ToolInputs; social?: ToolInputs; drawdown?: ToolInputs; healthcare?: ToolInputs; mortgage?: ToolInputs; rentbuy?: ToolInputs };
  /** How much saving rose each year (one rate for everything); replaced by
      `growth`, read only to carry an older profile over. */
  raise: number;
  /** How each saving line grew each year beyond inflation, by the Paycheck
      tab's lines; replaced by `yearly`, read only to carry an older
      profile over. */
  growth: Partial<Record<"match" | "hsa" | "rothIra" | "k401max" | "brok", number>>;
  /** Year by year: each of you's raise a year beyond inflation (0.01 is
      1%), how much of each raise, after tax, is saved (0.5 is half; null
      saves the same share of take-home pay as now), and figures typed into
      its table. */
  yearly: { raise: [number, number]; keep: number | null; edits?: YearEdit[] };
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
  /** How the children's costs come out of saving ("How will you cover
      it?"), every stage alike. Unset: the dashboard's usual order. */
  coverRule?: CoverRule | null;
  /** The Calculator's scenarios (scenarios.ts): changes in saving, a lump
      sum, a different return from an age on, and the children's row,
      switched on or off. They change the plan's saving year by year, so
      every tab follows them. Unset: none yet. */
  scenarios?: Scenario[];
}

export type AssetKind = "workplace" | "g457" | "ira" | "roth" | "brokerage" | "hsa" | "cash" | "home" | "other";
export type DebtKind = "mortgage" | "car" | "student" | "card" | "loan";
export interface Item {
  id: string; side: "asset" | "debt"; kind: AssetKind | DebtKind; name: string; value: number;
  /** A debt's interest rate (0.069 is 6.9%). */
  rate?: number | null;
  /** What was put in, when known: a brokerage account's cost basis, or a
      Roth's own contributions (what can come out any time, tax-free). */
  basis?: number | null;
  /** Whose it is, for a couple (0 you, 1 your partner; null shared, split
      evenly). Left out, a retirement account's is guessed from the name. */
  owner?: 0 | 1 | null;
}
/** A figure typed into Year by year's table: your pay (`pay0`), your
    partner's (`pay1`) or spending, per year in today's dollars, for its
    calendar year only (`once`) or from it to retirement. */
export interface YearEdit { what: "pay0" | "pay1" | "spend"; year: number; amount: number; once: boolean }

/** What the household had and owed on a day (YYYY-MM-DD). One a day:
    saving again the same day replaces it. */
/** One debt's payment plan, by the debt's id on Net worth. `full`: a card
    paid off in full each month (nothing to plan: it's spending). `replace`:
    a car loan whose payment goes on to the next car once it's paid off. */
export interface DebtPay { id: string; name: string; kind: DebtKind; pay: number; full?: boolean; replace?: boolean }
export interface DebtPlan { roll: boolean; debts: DebtPay[] }
export interface Entry { date: string; items: Item[]; from: "setup" | "accounts" }

export interface DashData {
  profile: Profile;
  entries: Entry[];
  /** Setup: the step reached, the steps skipped, and whether it's finished. */
  step: number; skipped: string[]; done: boolean;
}

const VERSION = 1;

const person = (): Person => ({ name: "", bm: null, by: null, retire: null, pay: null, per: "year", taxed: "before" });
export const EMPTY_PROFILE: Profile = {
  who: null, kids: 0, p1: person(), p2: person(), kidList: [], state: null,
  saved: null, contrib: null, cper: "month", employer: null, match: null, other: [],
  spend: null, budget: [], useBudget: false, retSpend: null,
  home: null, value: null, owed: null, rent: null, mortRate: null, mortPay: null,
  assume: DEFAULT_ASSUMPTIONS,
  ss: { checked: false, own1: null, own2: null, claim: null, claim2: null }, strategy: null,
  tools: {}, raise: 0, growth: {}, yearly: { raise: [0, 0], keep: null },
  planned: { count: 0, firstIn: 2, spacing: 3 }, childcare: true, careArea: "suburb",
  college: { help: "none", cost: 27000 },
  childCosts: { early: "", school: "", teen: "", later: "80" },
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
const notify = () => listeners.forEach((l) => l());
function load(key = profileKey(openId())): DashData {
  const v = readStored<DashData>(key, VERSION);
  if (!v) return EMPTY;
  const p = { ...EMPTY_PROFILE, ...v.profile };
  p.assume = { ...DEFAULT_ASSUMPTIONS, ...v.profile?.assume };
  p.ss = { ...EMPTY_PROFILE.ss, ...v.profile?.ss };
  p.tools = { ...v.profile?.tools };
  p.planned = { ...EMPTY_PROFILE.planned, ...v.profile?.planned };
  p.college = { ...EMPTY_PROFILE.college, ...v.profile?.college };
  // The school choices follow the College Board's yearly figures: a plan saved with last year's takes this year's.
  p.college.cost = ({ 26000: 27000, 61000: 63000 } as Record<number, number>)[p.college.cost] ?? p.college.cost;
  p.childCosts = { ...EMPTY_PROFILE.childCosts, ...v.profile?.childCosts };
  if (v.profile?.scenarios != null) p.scenarios = readScenarios(v.profile.scenarios, { dashboard: true });
  // The rule for the children's costs; amounts typed by stage before it are dropped.
  p.coverRule = readRule(v.profile?.coverRule);
  delete (p as { kidCover?: unknown }).kidCover;
  // Years until the first planned child, from the age you'll be then.
  const age = ageNow(p.p1);
  if (p.planned.bornAge != null && age != null) p.planned = { ...p.planned, firstIn: Math.max(0, Math.round((p.planned.bornAge - age) * 2) / 2) };
  // Raises, from before pay was planned year by year: saving's own growth
  // (one rate, or each line's), the average of the rates set.
  const y = v.profile?.yearly;
  if (y && Array.isArray(y.raise)) {
    const edits = Array.isArray(y.edits) ? y.edits.filter((e): e is YearEdit => !!e && ["pay0", "pay1", "spend"].includes(e.what) && Number.isFinite(e.year) && Number.isFinite(e.amount)).map((e) => ({ what: e.what, year: Math.round(e.year), amount: Math.max(0, e.amount), once: !!e.once })) : [];
    p.yearly = { raise: [Number(y.raise[0]) || 0, Number(y.raise[1]) || 0], keep: typeof y.keep === "number" ? y.keep : null, ...(edits.length ? { edits } : {}) };
  }
  else {
    const set = Object.values(v.profile?.growth ?? {}).filter((g): g is number => typeof g === "number" && g > 0);
    const r = set.length ? set.reduce((a, g) => a + g, 0) / set.length : v.profile?.raise || 0;
    p.yearly = { raise: [r, r], keep: null };
  }
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
  writeStored(profileKey(openId()), VERSION, next);
  notify();
}

/* ---------- Profiles ---------- */

const OPEN = "dashboard-open";
let index: ProfileList | null = null, open: string | null = null;

/** The profiles, in order: never empty (the first is there before it's named). */
function profiles(): ProfileList {
  if (index) return index;
  const v = readProfileList(readStored(PROFILES_KEY, 1));
  if (!v.list.length) v.list = [{ id: MAIN_PROFILE, name: "" }];
  return (index = v);
}
/** The open profile: this device's choice while it still exists, else the first. */
function openId(): string {
  if (open && profiles().list.some((p) => p.id === open)) return open;
  const mine = readStored<string>(OPEN, 1);
  return (open = profiles().list.some((p) => p.id === mine) ? mine! : profiles().list[0].id);
}
function saveList(next: ProfileList) {
  index = next;
  writeStored(PROFILES_KEY, 1, next);
}
/** Re-reads everything after the account sent something new. */
function reread() {
  index = null; open = null; current = load();
  notify();
}

/** A profile's name as shown: its own, else the people in it, else a default. */
export function profileLabel(ref: ProfileRef, d: DashData = readProfile(ref.id)): string {
  if (ref.name.trim()) return ref.name.trim();
  const a = d.profile.p1.name.trim(), b = d.profile.who === "couple" ? d.profile.p2.name.trim() : "";
  return a && b ? `${a} and ${b}` : a || b || "My profile";
}
/** A profile's saved data (not only the open one's). */
export const readProfile = (id: string) => (id === openId() ? get() : load(profileKey(id)));

/** Opens a profile on this device. */
export function openProfile(id: string) {
  if (!profiles().list.some((p) => p.id === id)) return;
  open = id;
  writeStored(OPEN, 1, id);
  current = load();
  notify();
}
/** Adds a profile, empty or a copy of another's, and opens it. */
export function addProfile(name: string, copyOf?: string): string {
  const id = newId();
  const data: DashData = copyOf ? JSON.parse(JSON.stringify(readProfile(copyOf))) : EMPTY;
  writeStored(profileKey(id), VERSION, data);
  saveList({ ...profiles(), list: [...profiles().list, { id, name: name.trim() }] });
  openProfile(id);
  return id;
}
export function renameProfile(id: string, name: string) {
  saveList({ ...profiles(), list: profiles().list.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)) });
  notify();
}
/** Deletes a profile, here and in the account (never the last one). The
    first in the list opens if it was the open one. */
export function deleteProfile(id: string) {
  const L = profiles();
  if (L.list.length < 2 || !L.list.some((p) => p.id === id)) return;
  const wasOpen = openId() === id;
  saveList({ list: L.list.filter((p) => p.id !== id), gone: [...new Set([...L.gone, id])] });
  writeStored(profileKey(id), VERSION, null);
  if (wasOpen) openProfile(profiles().list[0].id);
  else notify();
}

interface ProfilesView { list: ProfileRef[]; open: string }
let view: ProfilesView | null = null;
function getView(): ProfilesView {
  const list = profiles().list, o = openId();
  if (!view || view.list !== list || view.open !== o) view = { list, open: o };
  return view;
}
const SERVER_VIEW: ProfilesView = { list: [{ id: MAIN_PROFILE, name: "" }], open: MAIN_PROFILE };
/** The profiles and which is open, kept current. */
export function useProfiles(): ProfilesView {
  useSyncedReload();
  return useSyncExternalStore(subscribe, getView, () => SERVER_VIEW);
}

/** Items arriving from the account replace what's shown: the open profile,
    or the list (a profile renamed, added or deleted elsewhere). */
function useSyncedReload() {
  useEffect(() => {
    const on = (e: Event) => {
      const keys = (e as CustomEvent<string[]>).detail ?? [];
      if (keys.includes(PROFILES_KEY) || keys.includes(profileKey(openId()))) reread();
    };
    window.addEventListener(SYNCED_EVENT, on);
    return () => window.removeEventListener(SYNCED_EVENT, on);
  }, []);
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
  useSyncedReload();
  const update = useCallback((f: (d: DashData) => DashData) => save(f(get())), []);
  const setProfile = useCallback((f: (p: Profile) => Profile) => save({ ...get(), profile: f(get().profile) }), []);
  return { data, update, setProfile };
}
