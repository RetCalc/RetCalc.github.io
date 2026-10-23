"use client";

/* What the Dashboard keeps: the profile (setup's answers and everything the
   sections add), and dated entries of what the household has and owes.
   Stored under retcalc.dashboard.v1 and synced to the account
   (lib/storage.ts), separate from Your household, the Guide and the tools. */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readStored, writeStored } from "@/lib/storage";
import { SYNCED_EVENT } from "@/lib/sync/engine";

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
  ss: { checked: boolean; own1: number | null; own2: number | null; claim: number | null };
  /** The withdrawal strategy chosen, by the Guide's ids; null: none yet. */
  strategy: string | null;
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
  ss: { checked: false, own1: null, own2: null, claim: null }, strategy: null,
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
